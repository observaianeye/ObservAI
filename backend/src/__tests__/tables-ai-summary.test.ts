/**
 * Stage 5: AI summary route tests.
 *
 * The route depends on Ollama via callOllama() — we mock that so these tests
 * can run offline and still exercise:
 *  - Zod validation rejects malformed bodies
 *  - First hit calls Ollama; second hit within 30 s is served from cache
 *  - Ollama failure falls through to a graceful Turkish/English fallback
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock first (hoisted) so the route picks up the mocked callOllama
vi.mock('../routes/ai', () => ({
  callOllama: vi.fn(),
}));

import tablesRouter from '../routes/tables';
import { callOllama } from '../routes/ai';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tables', tablesRouter);
  return app;
}

const okBody = {
  cameraId: `cam-${Math.random().toString(36).slice(2)}`,
  tables: [
    { id: 't1', name: 'Masa 1', status: 'occupied', currentOccupants: 3, occupancyDuration: 1800 },
    { id: 't2', name: 'Masa 2', status: 'empty', currentOccupants: 0 },
    { id: 't3', name: 'Masa 3', status: 'needs_cleaning', currentOccupants: 0 },
  ],
  totals: { current: 3, entries: 12, exits: 9 },
  lang: 'tr' as const,
};

describe('POST /api/tables/ai-summary', () => {
  beforeEach(() => {
    vi.mocked(callOllama).mockReset();
  });

  it('rejects missing cameraId with 400', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/tables/ai-summary').send({ tables: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('rejects invalid status values', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/tables/ai-summary')
      .send({ cameraId: 'x', tables: [{ id: 't1', status: 'flying', currentOccupants: 0 }] });
    expect(res.status).toBe(400);
  });

  it('calls Ollama on first hit and returns summary', async () => {
    vi.mocked(callOllama).mockResolvedValue({
      response: 'Masa 3 temizlik bekliyor. Masa 1 uzun suredir dolu.',
      model: 'qwen3:14b',
    });
    const app = makeApp();
    const res = await request(app).post('/api/tables/ai-summary').send(okBody);
    expect(res.status).toBe(200);
    expect(res.body.summary).toContain('Masa 3');
    expect(res.body.cached).toBe(false);
    expect(res.body.model).toBe('qwen3:14b');
    expect(vi.mocked(callOllama)).toHaveBeenCalledTimes(1);
  });

  it('serves cached summary on repeat hit within throttle window', async () => {
    vi.mocked(callOllama).mockResolvedValue({
      response: 'Brief one',
      model: 'qwen3:14b',
    });
    const app = makeApp();
    const body = { ...okBody, cameraId: `cam-throttle-${Date.now()}` };
    const first = await request(app).post('/api/tables/ai-summary').send(body);
    expect(first.body.cached).toBe(false);
    const second = await request(app).post('/api/tables/ai-summary').send(body);
    expect(second.body.cached).toBe(true);
    expect(second.body.summary).toBe('Brief one');
    expect(vi.mocked(callOllama)).toHaveBeenCalledTimes(1);
  });

  it('returns graceful fallback when Ollama throws', async () => {
    vi.mocked(callOllama).mockRejectedValue(new Error('ECONNREFUSED'));
    const app = makeApp();
    const body = { ...okBody, cameraId: `cam-down-${Date.now()}` };
    const res = await request(app).post('/api/tables/ai-summary').send(body);
    expect(res.status).toBe(200);
    expect(res.body.model).toBe('fallback');
    expect(res.body.summary).toMatch(/AI yorumu/);
    expect(res.body.error).toContain('ECONNREFUSED');
  });

  it('builds English prompt and returns when lang=en', async () => {
    let capturedPrompt = '';
    vi.mocked(callOllama).mockImplementation(async (prompt: string) => {
      capturedPrompt = prompt;
      return { response: 'English brief', model: 'qwen3:14b' };
    });
    const app = makeApp();
    const res = await request(app)
      .post('/api/tables/ai-summary')
      .send({ ...okBody, cameraId: `cam-en-${Date.now()}`, lang: 'en' });
    expect(res.status).toBe(200);
    expect(capturedPrompt).toContain('restaurant floor manager');
    expect(res.body.summary).toBe('English brief');
  });
});
