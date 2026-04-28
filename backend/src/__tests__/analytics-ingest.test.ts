/**
 * Yan #22 coverage: POST /api/analytics/ingest is the Python -> Node
 * persistence channel. These tests pin the auth header check, the zod batch
 * validation, and confirm createMany is invoked with translated rows.
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const createManyMock = vi.fn();

vi.mock('../lib/db', () => ({
  prisma: {
    analyticsLog: {
      createMany: (args: unknown) => createManyMock(args),
    },
  },
}));

// The ingest endpoint reuses the analytics router which also wires in
// auth/tenant middleware for unrelated routes. Stub them so router import
// succeeds without a live cookie session — mirrors tables-status-patch.test.ts.
vi.mock('../middleware/authMiddleware', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/tenantScope', () => ({
  userOwnsCamera: vi.fn(),
  requireCameraOwnership: () => (_req: any, _res: any, next: any) => next(),
  requireZoneOwnership: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../lib/analyticsValidator', () => ({
  validateAnalyticsPayload: vi.fn(),
}));

vi.mock('../services/emailService', () => ({
  sendAlertEmail: vi.fn(),
}));

beforeAll(() => {
  process.env.OBSERVAI_INGEST_KEY = 'test-key-yan22';
});

import analyticsRouter from '../routes/analytics';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', analyticsRouter);
  return app;
}

const VALID_UUID = 'f1fd68f7-91be-4c01-8242-82baf69715dd';

function buildEntry(overrides: Record<string, unknown> = {}) {
  return {
    cameraId: VALID_UUID,
    timestamp: 1745000000000, // ms epoch
    currentCount: 5,
    peopleIn: 12,
    peopleOut: 7,
    queueCount: 1,
    avgWaitTime: 0,
    longestWaitTime: 0,
    fps: 25.5,
    ...overrides,
  };
}

describe('POST /api/analytics/ingest (Yan #22 — Python -> Node persistence)', () => {
  beforeEach(() => {
    createManyMock.mockReset();
  });

  it('happy path: valid batch + correct X-Ingest-Key persists rows and returns accepted count', async () => {
    createManyMock.mockResolvedValueOnce({ count: 2 });
    const batch = [buildEntry(), buildEntry({ peopleIn: 3, peopleOut: 1 })];

    const app = makeApp();
    const res = await request(app)
      .post('/api/analytics/ingest')
      .set('X-Ingest-Key', 'test-key-yan22')
      .send(batch);

    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe(2);
    expect(res.body.total).toBe(2);

    expect(createManyMock).toHaveBeenCalledTimes(1);
    const arg = createManyMock.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(arg.data).toHaveLength(2);
    // Schema field names are translated correctly + ms timestamp coerced to Date.
    const row = arg.data[0];
    expect(row.cameraId).toBe(VALID_UUID);
    expect(row.peopleIn).toBe(12);
    expect(row.peopleOut).toBe(7);
    expect(row.currentCount).toBe(5);
    expect(row.queueCount).toBe(1);
    expect(row.fps).toBe(25.5);
    expect(row.timestamp).toBeInstanceOf(Date);
    expect((row.timestamp as Date).getTime()).toBe(1745000000000);
  });

  it('rejects request with wrong X-Ingest-Key with 401 and never touches the DB', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/analytics/ingest')
      .set('X-Ingest-Key', 'wrong-secret')
      .send([buildEntry()]);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid or missing X-Ingest-Key/);
    expect(createManyMock).not.toHaveBeenCalled();
  });

  it('rejects batch with non-UUID cameraId with 400 + zod issues array', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/analytics/ingest')
      .set('X-Ingest-Key', 'test-key-yan22')
      .send([buildEntry({ cameraId: 'not-a-uuid' })]);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid batch');
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(res.body.issues.length).toBeGreaterThan(0);
    expect(createManyMock).not.toHaveBeenCalled();
  });
});
