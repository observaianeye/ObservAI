/**
 * Faz 10 Bug #4 (Yan #22 wire-up) — pythonBackendManager.setCamera() POSTs
 * /set-camera and remembers the bound camera id for health-recovery rebind.
 * Plus the cameras /activate/:id route fires setCamera() so persistence
 * starts the moment the user picks an active camera.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const cameraUpdate = vi.fn();
const cameraUpdateMany = vi.fn();
vi.mock('../lib/db', () => ({
  prisma: {
    camera: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      update: (...args: any[]) => cameraUpdate(...args),
      updateMany: (...args: any[]) => cameraUpdateMany(...args),
      create: vi.fn(),
      delete: vi.fn(),
    },
    branch: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

const setCameraSpy = vi.fn().mockResolvedValue(true);
vi.mock('../lib/pythonBackendManager', () => ({
  pythonBackendManager: {
    setCamera: (...args: any[]) => setCameraSpy(...args),
    getBoundCameraId: vi.fn().mockReturnValue(null),
  },
}));

import camerasRouter from '../routes/cameras';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cameras', camerasRouter);
  return app;
}

const CAM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('Faz 10 Bug #4 — cameras /activate triggers Python /set-camera', () => {
  beforeEach(() => {
    cameraUpdate.mockReset();
    cameraUpdateMany.mockReset();
    setCameraSpy.mockReset();
    setCameraSpy.mockResolvedValue(true);
    cameraUpdateMany.mockResolvedValue({ count: 1 });
    cameraUpdate.mockResolvedValue({ id: CAM_ID, name: 'cam1', isActive: true });
  });

  it('POST /api/cameras/activate/:id returns 200 + calls pythonBackendManager.setCamera', async () => {
    const res = await request(makeApp()).post(`/api/cameras/activate/${CAM_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(CAM_ID);
    expect(cameraUpdateMany).toHaveBeenCalledOnce();
    expect(cameraUpdate).toHaveBeenCalledOnce();
    // setCamera fired with the activated camera id
    expect(setCameraSpy).toHaveBeenCalledWith(CAM_ID);
  });

  it('activation succeeds even when Python /set-camera fails (best-effort)', async () => {
    setCameraSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await request(makeApp()).post(`/api/cameras/activate/${CAM_ID}`);
    // Activation must not surface Python failure to the user
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(CAM_ID);
  });
});

describe('Faz 10 Bug #4 — pythonBackendManager.setCamera HTTP behaviour', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.resetModules();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('POSTs /set-camera with cameraId json body and returns true on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    globalThis.fetch = fetchMock as any;
    const { pythonBackendManager: mgr } = await vi.importActual<typeof import('../lib/pythonBackendManager')>('../lib/pythonBackendManager');
    const ok = await mgr.setCamera('cam-xyz');
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/set-camera');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ cameraId: 'cam-xyz' });
    expect(mgr.getBoundCameraId()).toBe('cam-xyz');
  });

  it('returns false (and does not throw) when Python /set-camera responds non-2xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as any;
    const { pythonBackendManager: mgr } = await vi.importActual<typeof import('../lib/pythonBackendManager')>('../lib/pythonBackendManager');
    const ok = await mgr.setCamera('cam-fail');
    expect(ok).toBe(false);
  });

  it('returns false (and does not throw) when Python is offline (fetch throws)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })) as any;
    const { pythonBackendManager: mgr } = await vi.importActual<typeof import('../lib/pythonBackendManager')>('../lib/pythonBackendManager');
    const ok = await mgr.setCamera('cam-offline');
    expect(ok).toBe(false);
  });

  it('rejects empty/invalid cameraId without making a network call', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as any;
    const { pythonBackendManager: mgr } = await vi.importActual<typeof import('../lib/pythonBackendManager')>('../lib/pythonBackendManager');
    expect(await mgr.setCamera('')).toBe(false);
    expect(await mgr.setCamera(null as any)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
