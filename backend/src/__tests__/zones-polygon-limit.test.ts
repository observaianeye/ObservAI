/**
 * Yan #32 — Polygon corner cap (max 128). A 1000-vertex polygon must be
 * rejected before it reaches the DB. Existing CreateZoneSchema also pins
 * the lower bound at 3 (a polygon needs at least a triangle), so this
 * doubles as a regression for the min(3) guard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/authMiddleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'u1', role: 'MANAGER' };
    next();
  },
}));

vi.mock('../middleware/roleCheck', () => ({
  requireManager: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/tenantScope', () => ({
  requireCameraOwnership: () => (_req: any, _res: any, next: any) => next(),
  requireZoneOwnership: () => (_req: any, _res: any, next: any) => next(),
  userOwnsCamera: vi.fn().mockResolvedValue(true),
}));

const zoneCreate = vi.fn();
vi.mock('../lib/db', () => ({
  prisma: {
    zone: {
      findMany: vi.fn().mockResolvedValue([]),
      create: (...args: any[]) => zoneCreate(...args),
    },
    camera: {
      findUnique: vi.fn().mockResolvedValue({ id: 'c1', userId: 'u1' }),
    },
  },
}));

import zonesRouter from '../routes/zones';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/zones', zonesRouter);
  return app;
}

function makePolygon(n: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => ({
    x: 0.5 + 0.4 * Math.cos((2 * Math.PI * i) / n),
    y: 0.5 + 0.4 * Math.sin((2 * Math.PI * i) / n),
  }));
}

describe('Yan #32 — zones polygon corner limit max(128)', () => {
  beforeEach(() => {
    zoneCreate.mockReset();
    zoneCreate.mockResolvedValue({ id: 'z1' });
  });

  it('rejects a 1000-vertex polygon with 400', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/zones')
      .send({
        cameraId: '11111111-1111-1111-1111-111111111111',
        name: 'Big',
        type: 'CUSTOM',
        coordinates: makePolygon(1000),
      });
    expect(res.status).toBe(400);
    expect(zoneCreate).not.toHaveBeenCalled();
  });

  it('accepts a 128-vertex polygon (boundary)', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/zones')
      .send({
        cameraId: '11111111-1111-1111-1111-111111111111',
        name: 'Edge',
        type: 'CUSTOM',
        coordinates: makePolygon(128),
      });
    // Validation must pass — DB layer is mocked so anything other than 400 is acceptable.
    expect(res.status).not.toBe(400);
  });

  it('rejects a 2-vertex polygon (under min)', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/zones')
      .send({
        cameraId: '11111111-1111-1111-1111-111111111111',
        name: 'Tiny',
        type: 'CUSTOM',
        coordinates: makePolygon(2),
      });
    expect(res.status).toBe(400);
    expect(zoneCreate).not.toHaveBeenCalled();
  });
});
