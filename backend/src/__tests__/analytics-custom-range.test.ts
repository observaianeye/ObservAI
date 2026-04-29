/**
 * Yan #39 — GET /api/analytics/:cameraId/overview?range=custom&from=...&to=...
 *
 * Pins the validation gate before any DB work fires:
 *  - happy path (valid 30-day window) returns 200 with range=custom and the
 *    daily-summary shape.
 *  - from >= to is rejected with 400.
 *  - span > 365 days is rejected with 400 (no DB query).
 *  - non-ISO from/to is rejected with 400.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const findMany = vi.fn().mockResolvedValue([]);

vi.mock('../lib/db', () => ({
  prisma: {
    analyticsSummary: { findMany: (...a: unknown[]) => findMany(...(a as [])) },
    analyticsLog: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock('../middleware/authMiddleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'u1', role: 'MANAGER' };
    next();
  },
}));

vi.mock('../middleware/tenantScope', () => ({
  requireCameraOwnership: () => (_req: any, _res: any, next: any) => next(),
  requireZoneOwnership: () => (_req: any, _res: any, next: any) => next(),
  userOwnsCamera: vi.fn().mockResolvedValue(true),
}));

vi.mock('../lib/analyticsValidator', () => ({
  validateAnalyticsPayload: vi.fn(),
}));

vi.mock('../services/emailService', () => ({
  sendAlertEmail: vi.fn(),
}));

import analyticsRouter from '../routes/analytics';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', analyticsRouter);
  return app;
}

const CAMERA_ID = '11111111-1111-1111-1111-111111111111';

describe('Yan #39 — analytics overview custom date range', () => {
  beforeEach(() => {
    findMany.mockClear();
    findMany.mockResolvedValue([]);
  });

  it('returns 200 with range=custom for a valid 30-day window', async () => {
    const res = await request(makeApp())
      .get(`/api/analytics/${CAMERA_ID}/overview`)
      .query({ range: 'custom', from: '2026-04-01T00:00:00.000Z', to: '2026-05-01T00:00:00.000Z' });
    expect(res.status).toBe(200);
    expect(res.body.range).toBe('custom');
    expect(typeof res.body.rangeStart).toBe('string');
    expect(typeof res.body.rangeEnd).toBe('string');
    expect(findMany).toHaveBeenCalled();
  });

  it('rejects from >= to with 400 and no DB call', async () => {
    const res = await request(makeApp())
      .get(`/api/analytics/${CAMERA_ID}/overview`)
      .query({ range: 'custom', from: '2026-05-01T00:00:00.000Z', to: '2026-04-01T00:00:00.000Z' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/earlier/i);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects span > 365 days with 400 and no DB call', async () => {
    const res = await request(makeApp())
      .get(`/api/analytics/${CAMERA_ID}/overview`)
      .query({ range: 'custom', from: '2024-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/365/);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects non-ISO from/to with 400', async () => {
    const res = await request(makeApp())
      .get(`/api/analytics/${CAMERA_ID}/overview`)
      .query({ range: 'custom', from: 'not-a-date', to: '2026-04-01T00:00:00.000Z' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ISO/i);
    expect(findMany).not.toHaveBeenCalled();
  });
});
