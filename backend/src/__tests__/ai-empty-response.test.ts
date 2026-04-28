/**
 * Yan #48 — callOllama must throw OLLAMA_EMPTY_RESPONSE when Ollama returns
 * 200 with an empty `response` field, so the /chat handler can fall through
 * to the Gemini fallback path instead of sending "" to the user.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubOllamaFetch(generateBody: { response?: string }) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (typeof url === 'string' && url.endsWith('/api/tags')) {
      return { ok: true, json: async () => ({ models: [{ name: 'llama3.1:8b' }] }) } as any;
    }
    if (typeof url === 'string' && url.endsWith('/api/generate')) {
      return { ok: true, json: async () => generateBody } as any;
    }
    throw new Error(`unexpected url ${url}`);
  }) as any);
}

describe('Yan #48 — callOllama empty response handling', () => {
  it('throws OLLAMA_EMPTY_RESPONSE when data.response is ""', async () => {
    stubOllamaFetch({ response: '' });
    const { callOllama } = await import('../routes/ai');
    await expect(callOllama('test prompt')).rejects.toThrow(/OLLAMA_EMPTY_RESPONSE/);
  });

  it('throws OLLAMA_EMPTY_RESPONSE when data.response is whitespace only', async () => {
    stubOllamaFetch({ response: '   \n\t  ' });
    const { callOllama } = await import('../routes/ai');
    await expect(callOllama('test prompt')).rejects.toThrow(/OLLAMA_EMPTY_RESPONSE/);
  });

  it('throws OLLAMA_EMPTY_RESPONSE when data.response is missing', async () => {
    stubOllamaFetch({});
    const { callOllama } = await import('../routes/ai');
    await expect(callOllama('test prompt')).rejects.toThrow(/OLLAMA_EMPTY_RESPONSE/);
  });

  it('returns response normally when non-empty', async () => {
    stubOllamaFetch({ response: 'real answer' });
    const { callOllama } = await import('../routes/ai');
    const out = await callOllama('test prompt');
    expect(out.response).toBe('real answer');
    expect(out.model).toBe('llama3.1:8b');
  });
});
