/**
 * Yan #57: insights soft-dismiss UX. PATCH /api/insights/:id/dismiss must:
 *   1. Tenant-scope through ownedCameraIdsForUser → 404 for cross-tenant ids.
 *   2. Set dismissedAt to now via raw SQL UPDATE.
 *   3. Return { success: true, id, dismissedAt }.
 *
 * The ownership check is done by selecting the row first; the prisma
 * `findMany` mock returns the camera ids the test user owns, then a
 * `$queryRawUnsafe` mock simulates the inline SELECT on the insights table.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const cameraFindManyMock = vi.fn();
const queryRawUnsafeMock = vi.fn();
const executeRawMock = vi.fn();

vi.mock('../middleware/authMiddleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user' };
    next();
  },
}));

vi.mock('../middleware/tenantScope', () => ({
  userOwnsCamera: vi.fn(() => Promise.resolve(true)),
  requireCameraOwnership: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../lib/db', () => ({
  prisma: {
    camera: {
      findMany: (args: unknown) => cameraFindManyMock(args),
    },
    branch: {
      findFirst: vi.fn(),
    },
    $queryRawUnsafe: (...args: unknown[]) => queryRawUnsafeMock(...args),
    $queryRaw: vi.fn(),
    $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) =>
      executeRawMock(strings, ...values),
  },
}));

import insightsRouter from '../routes/insights';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/insights', insightsRouter);
  return app;
}

describe('PATCH /api/insights/:id/dismiss (Yan #57 soft-dismiss)', () => {
  beforeEach(() => {
    cameraFindManyMock.mockReset();
    queryRawUnsafeMock.mockReset();
    executeRawMock.mockReset();
    executeRawMock.mockResolvedValue(1);
  });

  it('200: marks the insight dismissedAt and returns success payload', async () => {
    // Caller owns one camera; the insight belongs to it.
    cameraFindManyMock.mockResolvedValueOnce([{ id: 'cam-1' }]);
    queryRawUnsafeMock.mockResolvedValueOnce([{ id: 'ins-1' }]);

    const app = makeApp();
    const res = await request(app).patch('/api/insights/ins-1/dismiss').send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBe('ins-1');
    expect(typeof res.body.dismissedAt).toBe('string');
    expect(new Date(res.body.dismissedAt).toString()).not.toBe('Invalid Date');

    // executeRaw should have run the UPDATE with the dismissedAt timestamp.
    expect(executeRawMock).toHaveBeenCalledTimes(1);
    const callArgs = executeRawMock.mock.calls[0] as unknown[];
    const stringsArr = callArgs[0] as TemplateStringsArray;
    const sql = Array.from(stringsArr).join('?');
    expect(sql).toContain('UPDATE insights');
    expect(sql).toContain('dismissedAt');
  });

  it('404: cross-tenant id returns Insight not found, no executeRaw fired', async () => {
    cameraFindManyMock.mockResolvedValueOnce([{ id: 'cam-1' }]);
    queryRawUnsafeMock.mockResolvedValueOnce([]); // insight not in caller's cameras

    const app = makeApp();
    const res = await request(app).patch('/api/insights/foreign-ins/dismiss').send();

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Insight not found');
    expect(executeRawMock).not.toHaveBeenCalled();
  });
});
