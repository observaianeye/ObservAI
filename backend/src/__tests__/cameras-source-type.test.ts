/**
 * Faz 10 / Issue #2 — Screen capture removed from accepted source types.
 *
 * Locks down the new zod enum on POST /api/cameras:
 *  - WEBCAM, FILE, RTSP, RTMP, HTTP, YOUTUBE, PHONE → 201 created
 *  - SCREEN_CAPTURE → 400 ValidationError (regression guard so a future enum
 *    edit cannot reintroduce the dev-only screen-grab path).
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
  userOwnsCamera: vi.fn().mockResolvedValue(true),
}));

const cameraCreate = vi.fn();
vi.mock('../lib/db', () => ({
  prisma: {
    camera: {
      create: (...args: any[]) => cameraCreate(...args),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    branch: {
      findFirst: vi.fn().mockResolvedValue({ id: 'b1' }),
    },
  },
}));

import camerasRouter from '../routes/cameras';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cameras', camerasRouter);
  return app;
}

function postCamera(sourceType: string, sourceValue = '0', extra: Record<string, unknown> = {}) {
  return request(makeApp())
    .post('/api/cameras')
    .send({ name: `cam-${sourceType.toLowerCase()}`, sourceType, sourceValue, ...extra });
}

describe('Faz 10 Issue #2 — cameras sourceType enum (screen_capture removed)', () => {
  beforeEach(() => {
    cameraCreate.mockReset();
    cameraCreate.mockImplementation(({ data }: any) => Promise.resolve({ id: 'cam-new', ...data }));
  });

  it('accepts WEBCAM', async () => {
    const res = await postCamera('WEBCAM', '0');
    expect(res.status).toBe(201);
    expect(cameraCreate).toHaveBeenCalledOnce();
  });

  it('accepts RTSP', async () => {
    const res = await postCamera('RTSP', 'rtsp://192.168.1.10:554/live');
    expect(res.status).toBe(201);
  });

  it('accepts HTTP (DroidCam etc.)', async () => {
    const res = await postCamera('HTTP', 'http://192.168.1.10:4747/video');
    expect(res.status).toBe(201);
  });

  it('accepts PHONE', async () => {
    const res = await postCamera('PHONE', 'http://192.168.1.10:4747/video');
    expect(res.status).toBe(201);
  });

  it('accepts YOUTUBE / FILE / RTMP', async () => {
    expect((await postCamera('YOUTUBE', 'https://youtube.com/watch?v=x')).status).toBe(201);
    expect((await postCamera('FILE', '/tmp/clip.mp4')).status).toBe(201);
    expect((await postCamera('RTMP', 'rtmp://stream/live')).status).toBe(201);
  });

  it('rejects SCREEN_CAPTURE with 400 (Faz 10 removal)', async () => {
    const res = await postCamera('SCREEN_CAPTURE', 'screen');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
    expect(cameraCreate).not.toHaveBeenCalled();
  });

  it('rejects unknown sourceType (e.g. screen, lowercase) with 400', async () => {
    const res = await postCamera('screen', 'screen');
    expect(res.status).toBe(400);
    expect(cameraCreate).not.toHaveBeenCalled();
  });
});
