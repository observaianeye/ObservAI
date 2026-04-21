import { describe, expect, it } from 'vitest';
import {
  GEMINI_MODEL_CANDIDATES,
  OLLAMA_MODEL_PRIORITY,
  isGeminiFallbackError,
} from '../lib/aiConfig';

describe('aiConfig — GEMINI_MODEL_CANDIDATES', () => {
  it('contains at least one candidate', () => {
    expect(GEMINI_MODEL_CANDIDATES.length).toBeGreaterThan(0);
  });

  it('uses a flash model first (cost/latency-optimized default)', () => {
    expect(GEMINI_MODEL_CANDIDATES[0]).toMatch(/flash/i);
  });

  it('all entries are non-empty strings', () => {
    for (const m of GEMINI_MODEL_CANDIDATES) {
      expect(typeof m).toBe('string');
      expect(m.length).toBeGreaterThan(0);
    }
  });
});

describe('aiConfig — OLLAMA_MODEL_PRIORITY', () => {
  it('leads with qwen3:14b (primary per ADIM 11 + Stage 6)', () => {
    expect(OLLAMA_MODEL_PRIORITY[0]).toBe('qwen3:14b');
  });

  it('includes llama3.1:8b as fallback', () => {
    expect(OLLAMA_MODEL_PRIORITY).toContain('llama3.1:8b');
  });

  it('has no duplicates', () => {
    const seen = new Set(OLLAMA_MODEL_PRIORITY);
    expect(seen.size).toBe(OLLAMA_MODEL_PRIORITY.length);
  });
});

describe('aiConfig — isGeminiFallbackError', () => {
  it('matches quota error', () => {
    expect(isGeminiFallbackError(new Error('Quota exceeded for model X'))).toBe(true);
  });

  it('matches 429 rate limit', () => {
    expect(isGeminiFallbackError(new Error('Request failed: 429'))).toBe(true);
  });

  it('matches 404 model not found', () => {
    expect(isGeminiFallbackError(new Error('404 model not found'))).toBe(true);
  });

  it('matches resource_exhausted', () => {
    expect(isGeminiFallbackError(new Error('Reason: RESOURCE_EXHAUSTED'))).toBe(true);
  });

  it('does not match generic error', () => {
    expect(isGeminiFallbackError(new Error('Network timeout'))).toBe(false);
    expect(isGeminiFallbackError(new Error('Invalid API key'))).toBe(false);
  });

  it('tolerates non-Error inputs', () => {
    expect(isGeminiFallbackError('quota exceeded')).toBe(true);
    expect(isGeminiFallbackError(null)).toBe(false);
    expect(isGeminiFallbackError(undefined)).toBe(false);
  });
});
