/**
 * Yan #36 — OLLAMA_MODEL exact match (was startsWith, picked llama3.1:8b-8k
 * when env said llama3.1:8b because /api/tags listed the 8K variant first).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Reset module cache between tests so env changes propagate into the
// module-scoped functions inside ai.ts.
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OLLAMA_MODEL;
});

function mockTags(models: string[]) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ models: models.map((name) => ({ name })) }),
  })) as any);
}

describe('Yan #36 — getAvailableOllamaModel exact match', () => {
  it('OLLAMA_MODEL=llama3.1:8b picks exact tag, not 8b-8k variant', async () => {
    process.env.OLLAMA_MODEL = 'llama3.1:8b';
    mockTags(['llama3.1:8b-8k', 'llama3.1:8b', 'qwen3:14b']);

    const { getAvailableOllamaModel } = await import('../routes/ai');
    const selected = await getAvailableOllamaModel('http://localhost:11434');
    expect(selected).toBe('llama3.1:8b');
  });

  it('falls back to :latest when no exact match', async () => {
    process.env.OLLAMA_MODEL = 'qwen3';
    mockTags(['qwen3:latest', 'qwen3:14b']);

    const { getAvailableOllamaModel } = await import('../routes/ai');
    const selected = await getAvailableOllamaModel('http://localhost:11434');
    expect(selected).toBe('qwen3:latest');
  });

  it('falls back to priority list when env model not found', async () => {
    process.env.OLLAMA_MODEL = 'doesnotexist';
    mockTags(['llama3.1:8b-8k', 'llama3.1:8b', 'qwen3:14b']);

    const { getAvailableOllamaModel } = await import('../routes/ai');
    const selected = await getAvailableOllamaModel('http://localhost:11434');
    // priority list leads with qwen3:14b; exact match wins
    expect(selected).toBe('qwen3:14b');
  });
});
