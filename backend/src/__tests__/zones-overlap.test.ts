/**
 * Yan #31 — Real polygon-polygon overlap detection.
 *
 * The zone-create endpoint previously rejected any new zone whose bounding
 * box happened to share area with an existing zone, even when the actual
 * polygons did not intersect (classic U-shape false positive). This test
 * locks down the new behaviour:
 *  - Real intersections (rect-rect / rect-poly / poly-poly) still 409.
 *  - Bbox-overlapping but interior-disjoint shapes (U-shape) get 201.
 *  - Adjacent zones sharing only a boundary edge get 201.
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
  requireManager: (req: any, _res: any, next: any) => {
    req.user = { id: 'u1', role: 'MANAGER' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/tenantScope', () => ({
  requireCameraOwnership: () => (_req: any, _res: any, next: any) => next(),
  requireZoneOwnership: () => (_req: any, _res: any, next: any) => next(),
  userOwnsCamera: vi.fn().mockResolvedValue(true),
}));

const zoneFindMany = vi.fn();
const zoneCreate = vi.fn();
vi.mock('../lib/db', () => ({
  prisma: {
    zone: {
      findMany: (...args: any[]) => zoneFindMany(...args),
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

function rect(x1: number, y1: number, x2: number, y2: number): { x: number; y: number }[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

const CAMERA_ID = '11111111-1111-1111-1111-111111111111';

function postZone(coords: { x: number; y: number }[], name = 'New') {
  return request(makeApp())
    .post('/api/zones')
    .send({ cameraId: CAMERA_ID, name, type: 'CUSTOM', coordinates: coords });
}

describe('Yan #31 — zones polygon-polygon overlap', () => {
  beforeEach(() => {
    zoneFindMany.mockReset();
    zoneCreate.mockReset();
    zoneCreate.mockResolvedValue({ id: 'z-new' });
  });

  it('rejects rect-rect real overlap with 409 (regression)', async () => {
    zoneFindMany.mockResolvedValue([
      { id: 'z1', coordinates: JSON.stringify(rect(0.1, 0.1, 0.5, 0.5)) },
    ]);
    const res = await postZone(rect(0.3, 0.3, 0.7, 0.7));
    expect(res.status).toBe(409);
    expect(zoneCreate).not.toHaveBeenCalled();
  });

  it('rejects rect-poly real overlap with 409', async () => {
    // Existing rect spanning (0.1, 0.1) -> (0.6, 0.6).
    zoneFindMany.mockResolvedValue([
      { id: 'z1', coordinates: JSON.stringify(rect(0.1, 0.1, 0.6, 0.6)) },
    ]);
    // Triangle whose vertex (0.4, 0.4) sits squarely inside the rect.
    const tri = [
      { x: 0.4, y: 0.4 },
      { x: 0.9, y: 0.5 },
      { x: 0.9, y: 0.9 },
    ];
    const res = await postZone(tri);
    expect(res.status).toBe(409);
    expect(zoneCreate).not.toHaveBeenCalled();
  });

  it('rejects poly-poly real intersection with 409', async () => {
    // Existing diamond around centre (0.5, 0.5).
    const diamond = [
      { x: 0.5, y: 0.2 },
      { x: 0.8, y: 0.5 },
      { x: 0.5, y: 0.8 },
      { x: 0.2, y: 0.5 },
    ];
    zoneFindMany.mockResolvedValue([
      { id: 'z1', coordinates: JSON.stringify(diamond) },
    ]);
    // New rotated diamond shifted right — edges genuinely cross.
    const newDiamond = [
      { x: 0.7, y: 0.2 },
      { x: 1.0, y: 0.5 },
      { x: 0.7, y: 0.8 },
      { x: 0.4, y: 0.5 },
    ];
    const res = await postZone(newDiamond);
    expect(res.status).toBe(409);
  });

  it('accepts U-shape inside another rect bbox (bbox overlaps, interiors do not)', async () => {
    // Existing U: bbox is (0, 0)..(1, 1) but the interior is hollow in the
    // middle column. A rect drawn into the hollow column shares the U's bbox
    // yet does not actually intersect any U edge or interior.
    const uShape = [
      { x: 0.0, y: 0.0 },
      { x: 1.0, y: 0.0 },
      { x: 1.0, y: 1.0 },
      { x: 0.7, y: 1.0 },
      { x: 0.7, y: 0.3 },
      { x: 0.3, y: 0.3 },
      { x: 0.3, y: 1.0 },
      { x: 0.0, y: 1.0 },
    ];
    zoneFindMany.mockResolvedValue([
      { id: 'z1', coordinates: JSON.stringify(uShape) },
    ]);
    // Small rect placed in the hollow channel of the U.
    const inner = rect(0.4, 0.5, 0.6, 0.9);
    const res = await postZone(inner);
    expect(res.status).not.toBe(409);
    expect(res.status).toBe(201);
  });

  it('accepts adjacent zones sharing only a boundary edge', async () => {
    // Existing rect (0.1, 0.1) -> (0.5, 0.9). New rect (0.5, 0.1) -> (0.9, 0.9)
    // shares the vertical edge x=0.5 — touching adjacency, no interior overlap.
    zoneFindMany.mockResolvedValue([
      { id: 'z1', coordinates: JSON.stringify(rect(0.1, 0.1, 0.5, 0.9)) },
    ]);
    const adjacent = rect(0.5, 0.1, 0.9, 0.9);
    const res = await postZone(adjacent);
    expect(res.status).not.toBe(409);
    expect(res.status).toBe(201);
  });
});
