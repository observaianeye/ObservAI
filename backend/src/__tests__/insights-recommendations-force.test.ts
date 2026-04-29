/**
 * Faz 10 Bug #5 — `?force=true` query on GET /api/insights/recommendations
 * forwards `{force: true}` into getAIRecommendations(), which uses it to
 * defeat Ollama's silent prompt cache. Without this, the user-facing
 * "Refresh recommendations" button kept returning the same five lines no
 * matter how many times it was clicked.
 *
 * The cache-bypass mechanism (timestamp + random nonce appended to the
 * prompt body) lives in services/insightEngine.ts and is not directly
 * inspected here — these tests only assert the route correctly translates
 * `?force=...` into the service-layer flag.
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

vi.mock('../middleware/tenantScope', () => ({
  userOwnsCamera: vi.fn().mockResolvedValue(true),
  requireCameraOwnership: () => (_req: any, _res: any, next: any) => next(),
}));

const getRecsSpy = vi.fn();
vi.mock('../services/insightEngine', () => ({
  getAIRecommendations: (...args: any[]) => getRecsSpy(...args),
  // Other exports referenced by the routes file must be present so the
  // module resolves; stub them with no-op vitest mocks.
  generateInsights: vi.fn().mockResolvedValue({ alerts: [], saved: 0 }),
  buildRecommendationContext: vi.fn(),
  analyzeTrends: vi.fn(),
  generateAISummary: vi.fn(),
  saveInsights: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  prisma: {
    insight: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), updateMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    camera: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
    branch: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

import insightsRouter from '../routes/insights';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/insights', insightsRouter);
  return app;
}

describe('Faz 10 Bug #5 — /api/insights/recommendations ?force=true', () => {
  beforeEach(() => {
    getRecsSpy.mockReset();
    getRecsSpy.mockResolvedValue(['TR: oneri 1 | EN: rec 1', 'TR: oneri 2 | EN: rec 2']);
  });

  it('forwards force:true when ?force=true', async () => {
    const res = await request(makeApp()).get('/api/insights/recommendations?cameraId=cam1&force=true');
    expect(res.status).toBe(200);
    expect(getRecsSpy).toHaveBeenCalledWith('cam1', { force: true });
  });

  it('forwards force:true when ?force=1', async () => {
    const res = await request(makeApp()).get('/api/insights/recommendations?cameraId=cam1&force=1');
    expect(res.status).toBe(200);
    expect(getRecsSpy).toHaveBeenCalledWith('cam1', { force: true });
  });

  it('passes force:false when query param absent (default cache-friendly path)', async () => {
    const res = await request(makeApp()).get('/api/insights/recommendations?cameraId=cam1');
    expect(res.status).toBe(200);
    expect(getRecsSpy).toHaveBeenCalledWith('cam1', { force: false });
  });

  it('passes force:false when ?force=false (explicit opt-out)', async () => {
    const res = await request(makeApp()).get('/api/insights/recommendations?cameraId=cam1&force=false');
    expect(res.status).toBe(200);
    expect(getRecsSpy).toHaveBeenCalledWith('cam1', { force: false });
  });

  it('returns the recommendations array verbatim plus the source field', async () => {
    const res = await request(makeApp()).get('/api/insights/recommendations?cameraId=cam1&force=true');
    expect(res.status).toBe(200);
    expect(res.body.recommendations).toEqual(['TR: oneri 1 | EN: rec 1', 'TR: oneri 2 | EN: rec 2']);
    expect(typeof res.body.source).toBe('string');
  });
});
