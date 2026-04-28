/**
 * Yan #30 fix coverage: PATCH /api/tables/:zoneId/status was 404'ing every
 * request because the Prisma lookup used the lowercase string 'table' while
 * the schema enum and stored rows use 'TABLE'. These tests pin the casing,
 * cover zod rejection, and confirm cross-tenant lookups stay 404.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const findFirstMock = vi.fn();
const tableEventCreateMock = vi.fn();
const ownsCameraMock = vi.fn();

vi.mock('../routes/ai', () => ({
  callOllama: vi.fn(),
}));

vi.mock('../middleware/authMiddleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user' };
    next();
  },
}));

vi.mock('../middleware/tenantScope', () => ({
  userOwnsCamera: (...args: unknown[]) => ownsCameraMock(...args),
  requireCameraOwnership: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../lib/db', () => ({
  prisma: {
    zone: {
      findFirst: (args: unknown) => findFirstMock(args),
    },
    tableEvent: {
      create: (args: unknown) => tableEventCreateMock(args),
    },
  },
}));

import tablesRouter from '../routes/tables';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tables', tablesRouter);
  return app;
}

describe('PATCH /api/tables/:zoneId/status (Yan #30 — TABLE casing fix)', () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    tableEventCreateMock.mockReset();
    ownsCameraMock.mockReset();
  });

  it('happy path: TABLE zone PATCH status=empty returns 200 and writes a tableEvent', async () => {
    ownsCameraMock.mockResolvedValueOnce(true);
    findFirstMock.mockResolvedValueOnce({ id: 'zone-1', cameraId: 'cam-1', type: 'TABLE' });
    tableEventCreateMock.mockResolvedValueOnce({ id: 'evt-1' });

    const app = makeApp();
    const res = await request(app)
      .patch('/api/tables/zone-1/status')
      .send({ cameraId: 'cam-1', status: 'empty' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.zoneId).toBe('zone-1');
    expect(res.body.status).toBe('empty');

    // Confirm the casing fix is in place — Prisma must be queried with 'TABLE',
    // never 'table'. If this regresses, the lookup returns 0 rows again.
    const where = (findFirstMock.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where.type).toBe('TABLE');
    expect(where.id).toBe('zone-1');
    expect(where.cameraId).toBe('cam-1');
    expect(where.isActive).toBe(true);

    expect(tableEventCreateMock).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid status values with 400 (zod refuses anything other than "empty")', async () => {
    ownsCameraMock.mockResolvedValueOnce(true);
    const app = makeApp();
    const res = await request(app)
      .patch('/api/tables/zone-1/status')
      .send({ cameraId: 'cam-1', status: 'occupied' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the cameraId does not belong to the requesting user', async () => {
    ownsCameraMock.mockResolvedValueOnce(false);
    const app = makeApp();
    const res = await request(app)
      .patch('/api/tables/zone-1/status')
      .send({ cameraId: 'cam-other-tenant', status: 'empty' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Camera not found');
    expect(findFirstMock).not.toHaveBeenCalled();
  });
});
