/**
 * Central AI provider configuration.
 * Single source of truth for Gemini + Ollama model priorities, consumed by
 * the chat route and the insightEngine so the two don't drift apart.
 */

/** Gemini candidates tried in order, with automatic fallback on quota/404. */
export const GEMINI_MODEL_CANDIDATES: readonly string[] = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
];

/**
 * Ollama model tag prefixes, tried in preference order.
 * qwen3:14b (9GB) leads — fits fully in 12GB VRAM (RTX 5070) and responds in seconds.
 * gemma4:26b (17GB) ranks last because it does not fit in 12GB VRAM and falls back to
 * CPU inference (>180s/request). Promote it on hosts with >=24GB VRAM.
 */
export const OLLAMA_MODEL_PRIORITY: readonly string[] = [
  'qwen3:14b',
  'qwen3',
  'llama3.3:latest',
  'llama3.3',
  'llama3.2:latest',
  'llama3.2',
  'qwen2.5:7b',
  'qwen2.5',
  'llama3.1:8b',
  'llama3:8b',
  'gemma2',
  'mistral',
  'phi3',
  'qwen2',
  'gemma4:26b',
  'gemma4',
];

/** Returns true if an error looks like a Gemini quota/404/exhaustion case worth retrying against the next model. */
export function isGeminiFallbackError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('429') ||
    msg.includes('404') ||
    msg.includes('resource_exhausted') ||
    msg.includes('model not found')
  );
}
