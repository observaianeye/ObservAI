/**
 * Yan #46 — AI chat branchId param.
 *
 * Without branchId, getRecentAnalyticsContext queries one camera (or all
 * cameras when neither is set). With branchId, the where clause must scope
 * to every camera in the branch via `camera: { branchId }` so branch-level
 * questions get aggregate context.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const analyticsFindManyMock = vi.fn();
const ownsBranchMock = vi.fn();
const ownsCameraMock = vi.fn();
const callOllamaMock = vi.fn();

vi.mock('../middleware/authMiddleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user' };
    next();
  },
}));

vi.mock('../middleware/tenantScope', () => ({
  userOwnsBranch: (...args: unknown[]) => ownsBranchMock(...args),
  userOwnsCamera: (...args: unknown[]) => ownsCameraMock(...args),
}));

vi.mock('../lib/db', () => ({
  prisma: {
    analyticsLog: {
      findMany: (args: unknown) => analyticsFindManyMock(args),
    },
    zoneInsight: {
      findMany: vi.fn(async () => []),
    },
    branch: {
      findFirst: vi.fn(async () => null),
    },
    chatMessage: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({})),
    },
  },
}));

beforeEach(() => {
  analyticsFindManyMock.mockReset();
  ownsBranchMock.mockReset();
  ownsCameraMock.mockReset();
  callOllamaMock.mockReset();
  // Default: empty analytics so prompt builder short-circuits to "No recent..."
  analyticsFindManyMock.mockResolvedValue([]);
  callOllamaMock.mockResolvedValue({ response: 'ok', model: 'llama3.1:8b' });
  process.env.AI_PROVIDER = 'ollama';
  process.env.GEMINI_API_KEY = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function loadApp() {
  // Stub fetch so getAvailableOllamaModel + Ollama call return canned data.
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (typeof url === 'string' && url.endsWith('/api/tags')) {
      return { ok: true, json: async () => ({ models: [{ name: 'llama3.1:8b' }] }) } as any;
    }
    return { ok: true, json: async () => ({ response: 'mocked answer' }) } as any;
  }) as any);

  const aiRouter = (await import('../routes/ai')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRouter);
  return app;
}

describe('Yan #46 — POST /api/ai/chat branchId multi-cam aggregate', () => {
  it('branchId scopes analytics where clause to camera.branchId', async () => {
    ownsBranchMock.mockResolvedValueOnce(true);
    const app = await loadApp();

    const branchId = '11111111-1111-1111-1111-111111111111';
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'Tüm subelerimde kaç kişi?', branchId, lang: 'tr' });

    expect(res.status).toBe(200);
    expect(analyticsFindManyMock).toHaveBeenCalled();
    const where = (analyticsFindManyMock.mock.calls[0][0] as { where: any }).where;
    // Must filter by branchId via camera relation, not by cameraId directly.
    expect(where).toEqual({ camera: { branchId } });
    expect(where.cameraId).toBeUndefined();
    expect(ownsBranchMock).toHaveBeenCalledWith('test-user', branchId);
  });

  it('cameraId still wins precedence when both supplied', async () => {
    ownsBranchMock.mockResolvedValueOnce(true);
    ownsCameraMock.mockResolvedValueOnce(true);
    const app = await loadApp();

    const cameraId = '22222222-2222-2222-2222-222222222222';
    const branchId = '11111111-1111-1111-1111-111111111111';
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'q', cameraId, branchId, lang: 'en' });

    expect(res.status).toBe(200);
    const where = (analyticsFindManyMock.mock.calls[0][0] as { where: any }).where;
    expect(where).toEqual({ cameraId });
  });

  it('branchId mismatch returns 404 Branch not found', async () => {
    ownsBranchMock.mockResolvedValueOnce(false);
    const app = await loadApp();

    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'q', branchId: '99999999-9999-9999-9999-999999999999', lang: 'en' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Branch not found');
    expect(analyticsFindManyMock).not.toHaveBeenCalled();
  });
});
