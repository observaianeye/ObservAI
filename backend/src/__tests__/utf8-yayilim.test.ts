/**
 * Yan #34 yayilim coverage: utf8String() refine is now applied to
 * branches/staff/cameras name fields. These tests pin that a payload with
 * U+FFFD replacement chars is rejected with a 400 + zod-style error,
 * exercising every route that adopted the refine in this batch.
 *
 * Test isolation: each describe builds an Express app from the route's
 * router with auth/tenant middleware stubbed, and DB mocks resolved to
 * shapes that would normally let the request through. The validation
 * happens before the DB hit, so the rejection asserts purely on the
 * zod schema layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/authMiddleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user', role: 'MANAGER' };
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

vi.mock('../lib/db', () => ({
  prisma: {
    branch: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({ id: 'b1' }),
    },
    staff: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 's1' }),
    },
    camera: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'c1' }),
    },
  },
}));

import branchRouter from '../routes/branches';
import staffRouter from '../routes/staff';
import camerasRouter from '../routes/cameras';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/branches', branchRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/cameras', camerasRouter);
  return app;
}

describe('Yan #34 yayilim — utf8String refine across routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/branches with U+FFFD in name is rejected with 400', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/branches')
      .send({
        name: 'Sub�e',
        city: 'Istanbul',
        latitude: 41.0,
        longitude: 28.97,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
    expect(Array.isArray(res.body.details)).toBe(true);
    const msgs = JSON.stringify(res.body.details);
    expect(msgs).toMatch(/UTF-8|replacement/i);
  });

  it('POST /api/branches with valid TR diacritics passes validation (creates row)', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/branches')
      .send({
        name: 'Şube Beşiktaş',
        city: 'İstanbul',
        latitude: 41.0,
        longitude: 28.97,
      });
    expect(res.status).toBe(201);
  });

  it('POST /api/staff with U+FFFD in firstName is rejected with 400', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/staff')
      .send({
        firstName: 'A�hmet',
        lastName: 'Yilmaz',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid body/);
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(JSON.stringify(res.body.issues)).toMatch(/UTF-8|replacement/i);
  });

  it('POST /api/cameras with U+FFFD in name is rejected with 400', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/cameras')
      .send({
        name: 'Cam�era',
        sourceType: 'WEBCAM',
        sourceValue: '0',
      });
    expect(res.status).toBe(400);
    // cameras route returns either { error, details } or zod issue array
    const body = JSON.stringify(res.body);
    expect(body).toMatch(/UTF-8|replacement|Validation/i);
  });
});
