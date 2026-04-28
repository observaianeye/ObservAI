/**
 * AI Q&A Routes
 * Natural language interface powered by Ollama (primary) with Gemini fallback
 */

import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { GEMINI_MODEL_CANDIDATES, OLLAMA_MODEL_PRIORITY, isGeminiFallbackError } from '../lib/aiConfig';
import { authenticate } from '../middleware/authMiddleware';
import { userOwnsCamera, userOwnsBranch } from '../middleware/tenantScope';
import { CameraIdOptionalSchema } from '../lib/schemas';

const router = Router();

// Validation schema
const ChatRequestSchema = z.object({
  message: z.string().min(1),
  // Yan #40: cameraId now uses the shared UUID schema so /chat and /export
  // share one contract.
  cameraId: CameraIdOptionalSchema,
  // Yan #46: branch-level questions ("tüm subelerimde kaç ziyaretçi?") need
  // multi-camera aggregate. branchId is alternative to cameraId.
  branchId: z.string().uuid().optional(),
  // Frontend dil tercihi — yoksa heuristic devreye girer (geriye doğru uyumlu)
  lang: z.enum(['tr', 'en']).optional(),
  // Conversation history anchor — frontend persists this in localStorage so
  // follow-ups in the same session get the last N turns injected as context.
  conversationId: z.string().min(1).max(128).optional(),
});

// Stage 6: Gate streaming + persistent history behind a feature flag.
// When off, the route behaves exactly as it did pre-Stage-6 (non-streaming, stateless).
const STREAMING_ENABLED = process.env.ENABLE_AI_STREAMING === 'true';
const MAX_HISTORY_TURNS = 10;

/**
 * POST /api/ai/chat - Natural language Q&A
 *
 * Accepts user questions and returns AI-generated responses based on real-time analytics data
 */
// Error type guards and categorization
type GeminiErrorCode = 'NO_KEY' | 'QUOTA_EXCEEDED' | 'MODEL_NOT_FOUND' | 'AUTH_ERROR' | 'UPSTREAM_ERROR' | 'UNKNOWN';

interface ErrorResponse {
  error: string;
  errorCode: GeminiErrorCode;
  timestamp: string;
}

function categorizeGeminiError(error: unknown): { code: GeminiErrorCode; message: string; statusCode: number } {
  if (!(error instanceof Error)) {
    return {
      code: 'UNKNOWN',
      message: 'Bilinmeyen hata oluştu. Lütfen daha sonra tekrar deneyin.',
      statusCode: 500,
    };
  }

  const msg = error.message.toLowerCase();

  // NO_KEY: API key tanımlı değil
  if (msg.includes('api_key') && msg.includes('undefined')) {
    return {
      code: 'NO_KEY',
      message: 'Gemini API key tanımlı değil. backend/.env dosyasına GEMINI_API_KEY ekleyin.',
      statusCode: 503,
    };
  }

  // QUOTA_EXCEEDED: Kota limiti aşıldı
  if (msg.includes('quota') || msg.includes('429') || msg.includes('resource_exhausted')) {
    return {
      code: 'QUOTA_EXCEEDED',
      message: 'API kota limiti aşıldı. Lütfen bekleyin veya planı yükseltin.',
      statusCode: 429,
    };
  }

  // MODEL_NOT_FOUND: Model bulunamadı
  if (msg.includes('404') || msg.includes('model') || msg.includes('not found')) {
    return {
      code: 'MODEL_NOT_FOUND',
      message: 'Model bulunamadı. Desteklenen model listesi: gemini-2.5-flash, gemini-2.0-flash-001',
      statusCode: 502,
    };
  }

  // AUTH_ERROR: Geçersiz API key veya yetki sorunu
  if (msg.includes('403') || msg.includes('permission') || msg.includes('unauthorized') || msg.includes('invalid') && msg.includes('key')) {
    return {
      code: 'AUTH_ERROR',
      message: 'API key geçersiz veya yetkisiz. key\'i kontrol edin.',
      statusCode: 401,
    };
  }

  // UPSTREAM_ERROR: Diğer network hataları
  if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('timeout')) {
    return {
      code: 'UPSTREAM_ERROR',
      message: 'Upstream AI servis hatası. Lütfen daha sonra tekrar deneyin.',
      statusCode: 502,
    };
  }

  return {
    code: 'UNKNOWN',
    message: 'Bilinmeyen AI servisi hatası.',
    statusCode: 500,
  };
}

// Ollama integration
//
// Yan #36: env model selection used `startsWith` which non-deterministically
// resolved `OLLAMA_MODEL=llama3.1:8b` to `llama3.1:8b-8k` because the 8K
// variant happened to come first in `/api/tags`. Use exact match first, then
// fall back to the `:latest` tag, then the prefix form (so `qwen3` still
// matches `qwen3:14b` if the env value is unqualified).
export async function getAvailableOllamaModel(ollamaUrl: string): Promise<string | null> {
  try {
    const envModel = process.env.OLLAMA_MODEL;

    const res = await fetch(`${ollamaUrl}/api/tags`);
    if (!res.ok) return null;
    const data: any = await res.json();
    const models: string[] = data.models?.map((m: any) => m.name) || [];

    if (envModel) {
      const exact = models.find((m: string) => m === envModel);
      if (exact) return exact;
      const latest = models.find((m: string) => m === `${envModel}:latest`);
      if (latest) return latest;
      const tagged = models.find((m: string) => m.startsWith(`${envModel}:`));
      if (tagged) return tagged;
      console.warn(`[AI] OLLAMA_MODEL=${envModel} not found, falling back to priority list`);
    }

    // Priority list is defined in lib/aiConfig so the insight engine and
    // the chat route share the same preference order.
    for (const p of OLLAMA_MODEL_PRIORITY) {
      const exact = models.find((m: string) => m === p);
      if (exact) return exact;
      const latest = models.find((m: string) => m === `${p}:latest`);
      if (latest) return latest;
      const tagged = models.find((m: string) => m.startsWith(`${p}:`));
      if (tagged) return tagged;
    }
    return models[0] || null;
  } catch {
    return null;
  }
}

export async function callOllama(
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number }
): Promise<{ response: string; model: string }> {
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = await getAvailableOllamaModel(OLLAMA_URL);

  if (!model) {
    throw new Error('OLLAMA_NO_MODEL: No models available. Run: ollama pull llama3.1:8b');
  }

  const timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '60000', 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const ollamaOptions: Record<string, number> = {
      temperature: opts?.temperature ?? 0.4,
      num_predict: opts?.maxTokens ?? 1024,
      num_ctx: parseInt(process.env.OLLAMA_NUM_CTX || '2048', 10),
    };
    // Only forward num_gpu when explicitly configured. Ollama auto-offloads to
    // GPU by default — passing 0 forces pure CPU and tanks throughput on a
    // 14B model like qwen3.
    if (process.env.OLLAMA_NUM_GPU !== undefined) {
      ollamaOptions.num_gpu = parseInt(process.env.OLLAMA_NUM_GPU, 10);
    }
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        // Thinking models (qwen3, deepseek-r1, etc.) burn the entire num_predict
        // budget on hidden reasoning before emitting visible output. Disable so
        // analytics responses stay under the timeout.
        think: false,
        options: ollamaOptions,
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
    }

    const data: any = await res.json();
    return { response: data.response, model };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Ollama timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Streaming variant of callOllama — emits each content chunk via `onChunk`
 * and resolves with the assembled final response when the stream closes.
 *
 * Uses Ollama's NDJSON streaming protocol: one JSON object per line with
 * `{ response: "...", done: false }` until a final `{ done: true }` line.
 *
 * If the upstream connection drops mid-stream we propagate the error so the
 * SSE handler can surface it to the client and persist a partial response.
 */
export async function callOllamaStream(
  prompt: string,
  onChunk: (chunk: string) => void,
  opts?: { maxTokens?: number; temperature?: number; signal?: AbortSignal }
): Promise<{ response: string; model: string }> {
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = await getAvailableOllamaModel(OLLAMA_URL);

  if (!model) {
    throw new Error('OLLAMA_NO_MODEL: No models available. Run: ollama pull qwen3:14b');
  }

  const timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Chain the caller's abort signal into ours so client disconnect cancels upstream.
  if (opts?.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const ollamaOptions: Record<string, number> = {
      temperature: opts?.temperature ?? 0.4,
      num_predict: opts?.maxTokens ?? 1024,
      num_ctx: parseInt(process.env.OLLAMA_NUM_CTX || '4096', 10),
    };
    if (process.env.OLLAMA_NUM_GPU !== undefined) {
      ollamaOptions.num_gpu = parseInt(process.env.OLLAMA_NUM_GPU, 10);
    }
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
        think: false,
        options: ollamaOptions,
      })
    });

    if (!res.ok || !res.body) {
      throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Ollama emits one JSON object per line; keep the trailing partial for next read.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as { response?: string; done?: boolean };
          if (parsed.response) {
            full += parsed.response;
            onChunk(parsed.response);
          }
          if (parsed.done) {
            // Intentionally keep reading in case a final trailing newline follows.
          }
        } catch {
          // Ignore malformed lines — Ollama sometimes writes keepalives.
        }
      }
    }
    return { response: full, model };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Ollama stream aborted after ${timeoutMs}ms or by client disconnect`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Load the most recent `MAX_HISTORY_TURNS` turns for a conversation, oldest-first,
 * so we can inject them into the prompt. Best-effort: swallows DB errors and
 * returns an empty array so a missing table never breaks chat.
 *
 * Tenant isolation (Yan #37): the userId filter prevents one tenant from
 * injecting another tenant's chat history into their prompt by guessing or
 * reusing a conversationId belonging to a different user.
 */
export async function loadConversationHistory(conversationId: string, userId: string): Promise<Array<{ role: string; content: string }>> {
  try {
    const rows = await (prisma as any).chatMessage.findMany({
      where: { conversationId, userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_TURNS,
      select: { role: true, content: true },
    });
    return rows.reverse();
  } catch (err) {
    console.warn('[AI] loadConversationHistory failed (table missing?):', err instanceof Error ? err.message : err);
    return [];
  }
}

async function saveChatMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  userId?: string,
  model?: string,
): Promise<void> {
  try {
    await (prisma as any).chatMessage.create({
      data: { conversationId, role, content, userId: userId ?? null, model: model ?? null },
    });
  } catch (err) {
    console.warn('[AI] saveChatMessage failed:', err instanceof Error ? err.message : err);
  }
}

export function renderHistoryForPrompt(history: Array<{ role: string; content: string }>): string {
  if (history.length === 0) return '';
  const lines = history.map((m) => {
    const label = m.role === 'user' ? 'USER' : 'ASSISTANT';
    return `${label}: ${m.content}`;
  });
  return `\nCONVERSATION HISTORY (oldest first):\n${lines.join('\n')}\n`;
}

/**
 * Check if Ollama is reachable and has models available.
 * Used at startup and by the /debug endpoint.
 */
export async function checkOllamaHealth(): Promise<{
  status: 'online' | 'offline' | 'no_models';
  models: string[];
  url: string;
  selectedModel: string | null;
}> {
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) {
      return { status: 'offline', models: [], url: OLLAMA_URL, selectedModel: null };
    }
    const data: any = await res.json();
    const models = data.models?.map((m: any) => m.name) || [];
    if (models.length === 0) {
      return { status: 'no_models', models: [], url: OLLAMA_URL, selectedModel: null };
    }
    const selectedModel = await getAvailableOllamaModel(OLLAMA_URL);
    return { status: 'online', models, url: OLLAMA_URL, selectedModel };
  } catch {
    return { status: 'offline', models: [], url: OLLAMA_URL, selectedModel: null };
  }
}

router.post('/chat', authenticate, async (req: Request, res: Response) => {
  try {
    const { message, cameraId, branchId, lang, conversationId } = ChatRequestSchema.parse(req.body);

    if (cameraId && !(await userOwnsCamera(req.user.id, cameraId))) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    if (branchId && !(await userOwnsBranch(req.user.id, branchId))) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Get recent analytics data for context (branchId aggregates multi-cam)
    const recentAnalytics = await getRecentAnalyticsContext(cameraId, branchId);

    // Pull the last N turns so follow-up questions work ("peki cinsiyet dağılımı?").
    const history = conversationId ? await loadConversationHistory(conversationId, req.user.id) : [];
    const analyticsWithHistory = recentAnalytics + renderHistoryForPrompt(history);

    // Build context prompt
    const contextPrompt = buildContextPrompt(message, analyticsWithHistory, lang);

    // Persist the user's turn first so it's present even if generation fails.
    if (conversationId) {
      await saveChatMessage(conversationId, 'user', message, (req as any).user?.id);
    }

    const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';

    // Try Ollama first (default), fall back to Gemini
    if (AI_PROVIDER === 'ollama') {
      try {
        const { response: aiResponse, model: modelName } = await callOllama(contextPrompt, { maxTokens: 512, temperature: 0.4 });
        if (conversationId) {
          await saveChatMessage(conversationId, 'assistant', aiResponse, (req as any).user?.id, `ollama/${modelName}`);
        }
        return res.json({
          message: aiResponse,
          timestamp: new Date().toISOString(),
          model: `ollama/${modelName}`
        });
      } catch (ollamaErr: unknown) {
        const errMsg = ollamaErr instanceof Error ? ollamaErr.message : '';
        console.warn(`[AI] Ollama failed: ${errMsg}`);

        // If Ollama has no models, return helpful error
        if (errMsg.includes('OLLAMA_NO_MODEL')) {
          return res.status(503).json({
            error: 'Ollama model not found. Run: ollama pull llama3.1:8b',
            errorCode: 'NO_MODEL',
            timestamp: new Date().toISOString(),
          });
        }

        // If Ollama is not running, return helpful error
        if (errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch failed')) {
          return res.status(503).json({
            error: 'Ollama is not running. Start Ollama and try again.',
            errorCode: 'OLLAMA_OFFLINE',
            timestamp: new Date().toISOString(),
          });
        }

        // Fall through to Gemini if configured
        if (!process.env.GEMINI_API_KEY) {
          return res.status(503).json({
            error: `AI service unavailable: ${errMsg}`,
            errorCode: 'UPSTREAM_ERROR',
            timestamp: new Date().toISOString(),
          });
        }
        console.log('[AI] Falling back to Gemini...');
      }
    }

    // Gemini fallback / primary
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    if (!GEMINI_API_KEY) {
      return res.status(503).json({
        error: 'No AI provider available. Set AI_PROVIDER=ollama or provide GEMINI_API_KEY.',
        errorCode: 'NO_KEY',
        timestamp: new Date().toISOString(),
      } as ErrorResponse);
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // Walk the centralized candidate list. Each entry is tried once; quota /
    // 404 errors fall through to the next, anything else is rethrown.
    let lastErr: unknown = null;
    for (const modelName of GEMINI_MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(contextPrompt);
        const response = await result.response;
        const text = response.text();
        if (conversationId) {
          await saveChatMessage(conversationId, 'assistant', text, (req as any).user?.id, `gemini/${modelName}`);
        }
        return res.json({
          message: text,
          timestamp: new Date().toISOString(),
          model: modelName,
        });
      } catch (err) {
        lastErr = err;
        if (!isGeminiFallbackError(err)) {
          throw err;
        }
        console.warn(`[AI] Gemini model ${modelName} failed, trying next candidate`);
      }
    }
    throw lastErr ?? new Error('Gemini candidates exhausted');

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }

    const timestamp = new Date().toISOString();
    const { code, message, statusCode } = categorizeGeminiError(error);

    console.error(`[AI] ${code} error at ${timestamp}:`, error instanceof Error ? error.message : String(error));

    return res.status(statusCode).json({
      error: message,
      errorCode: code,
      timestamp,
    } as ErrorResponse);
  }
});

/**
 * POST /api/ai/chat/stream — SSE streaming variant of /chat (Stage 6).
 *
 * Protocol (event: data), each chunk is one JSON object:
 *   { type: 'chunk', content: '...' }     — incremental token(s)
 *   { type: 'done', model, fullResponse } — terminator with final assembled text
 *   { type: 'error', error, errorCode }   — fatal error; stream ends
 *
 * Persists both the user message and the assembled assistant reply to
 * `chat_messages` when `conversationId` is supplied. Gated behind
 * ENABLE_AI_STREAMING — returns 404 when the flag is off so the frontend can
 * fall back to /chat without feature detection.
 */
router.post('/chat/stream', authenticate, async (req: Request, res: Response) => {
  if (!STREAMING_ENABLED) {
    return res.status(404).json({ error: 'Streaming disabled. Set ENABLE_AI_STREAMING=true.' });
  }

  // Parse & validate before setting SSE headers so validation errors can use normal JSON.
  let parsed: z.infer<typeof ChatRequestSchema>;
  try {
    parsed = ChatRequestSchema.parse(req.body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    throw err;
  }
  const { message, cameraId, branchId, lang, conversationId } = parsed;

  if (cameraId && !(await userOwnsCamera(req.user.id, cameraId))) {
    return res.status(404).json({ error: 'Camera not found' });
  }
  if (branchId && !(await userOwnsBranch(req.user.id, branchId))) {
    return res.status(404).json({ error: 'Branch not found' });
  }

  // SSE headers — once set we must keep writing events, not switch to JSON.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if proxied
  res.flushHeaders?.();

  const send = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Cancel upstream Ollama call if the client disconnects mid-stream.
  const upstreamAbort = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) upstreamAbort.abort();
  });

  try {
    const recentAnalytics = await getRecentAnalyticsContext(cameraId, branchId);
    const history = conversationId ? await loadConversationHistory(conversationId, req.user.id) : [];
    const contextPrompt = buildContextPrompt(message, recentAnalytics + renderHistoryForPrompt(history), lang);

    if (conversationId) {
      await saveChatMessage(conversationId, 'user', message, (req as any).user?.id);
    }

    const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';
    if (AI_PROVIDER !== 'ollama') {
      send({ type: 'error', error: 'Streaming only supported with AI_PROVIDER=ollama', errorCode: 'STREAM_UNSUPPORTED' });
      res.end();
      return;
    }

    const { response: full, model: modelName } = await callOllamaStream(
      contextPrompt,
      (chunk) => send({ type: 'chunk', content: chunk }),
      { maxTokens: 512, temperature: 0.4, signal: upstreamAbort.signal },
    );

    if (conversationId && full.length > 0) {
      await saveChatMessage(conversationId, 'assistant', full, (req as any).user?.id, `ollama/${modelName}`);
    }

    send({ type: 'done', model: `ollama/${modelName}`, fullResponse: full });
    res.end();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[AI stream] error:', errMsg);
    const isAbort = errMsg.includes('aborted');
    send({
      type: 'error',
      error: isAbort ? 'Stream cancelled' : errMsg,
      errorCode: errMsg.includes('OLLAMA_NO_MODEL') ? 'NO_MODEL'
        : errMsg.includes('ECONNREFUSED') ? 'OLLAMA_OFFLINE'
        : 'UPSTREAM_ERROR',
    });
    res.end();
  }
});

/**
 * GET /api/ai/debug — Gemini API key ve model durumunu test eder
 */
interface DebugResponse {
  status: 'OK' | 'NO_KEY' | 'ERROR' | 'ALL_QUOTA_EXHAUSTED';
  model?: string;
  message?: string;
  keyPrefix: string;
}

/**
 * GET /api/ai/status - Quick AI provider status check (used by frontend badge)
 * Returns provider info without making actual AI calls.
 */
router.get('/status', async (req: Request, res: Response) => {
  const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';
  const ollamaHealth = await checkOllamaHealth();
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;

  res.json({
    provider: AI_PROVIDER,
    ollama: {
      status: ollamaHealth.status,
      model: ollamaHealth.selectedModel,
      url: ollamaHealth.url,
    },
    gemini: {
      available: hasGeminiKey,
    },
    // Overall: is any AI provider usable?
    available: ollamaHealth.status === 'online' || hasGeminiKey,
    // Stage 6: surfaces whether /chat/stream is live so the frontend can
    // upgrade to EventSource instead of feature-detecting via 404.
    streamingEnabled: STREAMING_ENABLED && AI_PROVIDER === 'ollama',
  });
});

router.get('/debug', async (req: Request, res: Response) => {
  const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';
  const ollamaHealth = await checkOllamaHealth();

  const result: any = {
    provider: AI_PROVIDER,
    ollama: {
      status: ollamaHealth.status,
      models: ollamaHealth.models,
      url: ollamaHealth.url,
      selectedModel: ollamaHealth.selectedModel,
    },
    gemini: { status: 'unknown' }
  };

  // Check Gemini
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) {
    result.gemini.status = 'no_key';
  } else {
    result.gemini.keyPrefix = key.slice(0, 8) + '...';
    for (const m of GEMINI_MODEL_CANDIDATES) {
      try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: m });
        await model.generateContent('Say "OK" only.');
        result.gemini.status = 'ok';
        result.gemini.model = m;
        break;
      } catch (err: unknown) {
        if (!isGeminiFallbackError(err)) {
          result.gemini.status = 'error';
          result.gemini.error = err instanceof Error ? err.message : 'Unknown';
          break;
        }
      }
    }
    if (result.gemini.status === 'unknown') {
      result.gemini.status = 'quota_exhausted';
    }
  }

  res.json(result);
});

/**
 * Fetch recent analytics data for context.
 *
 * Yan #46: branchId widens the lookup to every camera in the branch so
 * branch-level questions ("tüm subelerimde kaç ziyaretçi?") aggregate
 * across cameras instead of returning one camera's slice.
 */
async function getRecentAnalyticsContext(cameraId?: string, branchId?: string): Promise<string> {
  try {
    const where: any = {};
    if (cameraId) {
      where.cameraId = cameraId;
    } else if (branchId) {
      where.camera = { branchId };
    }

    // Get recent analytics logs (last 100 entries)
    const logs = await prisma.analyticsLog.findMany({
      where,
      orderBy: {
        timestamp: 'desc'
      },
      take: 100,
      include: {
        camera: {
          select: {
            id: true,
            name: true,
            sourceType: true
          }
        }
      }
    });

    if (logs.length === 0) {
      return 'No recent analytics data available.';
    }

    // Calculate summary statistics
    const totalPeopleIn = logs.reduce((sum, log) => sum + log.peopleIn, 0);
    const totalPeopleOut = logs.reduce((sum, log) => sum + log.peopleOut, 0);
    const avgCurrentCount = Math.round(
      logs.reduce((sum, log) => sum + log.currentCount, 0) / logs.length
    );
    const avgQueueCount = logs.filter(l => l.queueCount !== null).length > 0
      ? Math.round(
        logs
          .filter(l => l.queueCount !== null)
          .reduce((sum, log) => sum + (log.queueCount || 0), 0) /
        logs.filter(l => l.queueCount !== null).length
      )
      : null;
    const avgWaitTime = logs.filter(l => l.avgWaitTime !== null).length > 0
      ? (
        logs
          .filter(l => l.avgWaitTime !== null)
          .reduce((sum, log) => sum + (log.avgWaitTime || 0), 0) /
        logs.filter(l => l.avgWaitTime !== null).length
      ).toFixed(1)
      : null;

    // Extract demographics data
    const demographics = extractDemographics(logs);

    // Get zone insights
    const zoneInsights = await getZoneInsights();

    // Build structured context string
    let context = '=== VENUE ANALYTICS DATA ===\n\n';

    if (logs[0].camera) {
      context += `| Field          | Value                    |\n`;
      context += `|----------------|-------------------------|\n`;
      context += `| Camera         | ${logs[0].camera.name}  |\n`;
      context += `| Source Type    | ${logs[0].camera.sourceType} |\n`;
      context += `| Time Range     | ${logs[logs.length - 1].timestamp.toISOString()} to ${logs[0].timestamp.toISOString()} |\n`;
      context += `| Data Points    | ${logs.length}          |\n\n`;
    } else {
      context += `Time Range: ${logs[logs.length - 1].timestamp.toISOString()} to ${logs[0].timestamp.toISOString()}\n`;
      context += `Data Points: ${logs.length}\n\n`;
    }

    context += '--- Traffic Summary ---\n';
    context += `| Metric                 | Value       |\n`;
    context += `|------------------------|------------|\n`;
    context += `| Total People Entered   | ${totalPeopleIn}        |\n`;
    context += `| Total People Exited    | ${totalPeopleOut}        |\n`;
    context += `| Current Count (Avg)    | ${avgCurrentCount}       |\n`;
    context += `| Net Traffic            | ${totalPeopleIn - totalPeopleOut} |\n`;
    if (avgQueueCount !== null) {
      context += `| Queue Count (Avg)      | ${avgQueueCount}        |\n`;
    }
    if (avgWaitTime !== null) {
      context += `| Average Wait Time      | ${avgWaitTime} seconds  |\n`;
    }
    context += '\n';

    if (demographics) {
      context += `--- Demographics ---\n${demographics}\n`;
    }

    if (zoneInsights) {
      context += `--- Zone Insights ---\n${zoneInsights}\n`;
    }

    // Hava durumu (Open-Meteo, ücretsiz, API key gerektirmiyor)
    // Try to use branch coordinates if available, default to Ankara
    let weatherLat = 39.9334;
    let weatherLon = 32.8597;
    try {
      const defaultBranch = await prisma.branch.findFirst({
        where: { isDefault: true },
        select: { latitude: true, longitude: true, city: true }
      });
      if (defaultBranch) {
        weatherLat = defaultBranch.latitude;
        weatherLon = defaultBranch.longitude;
      }
    } catch { /* branch lookup optional */ }

    try {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${weatherLat}&longitude=${weatherLon}&current_weather=true&hourly=precipitation_probability&forecast_days=1`
      );
      if (weatherRes.ok) {
        const weatherData: any = await weatherRes.json();
        const cw = weatherData.current_weather;
        const wmoDesc: Record<number, string> = {
          0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
          45: 'Foggy', 51: 'Light drizzle', 61: 'Slight rain', 63: 'Moderate rain',
          65: 'Heavy rain', 71: 'Slight snow', 80: 'Rain showers', 95: 'Thunderstorm',
        };
        const desc = wmoDesc[cw.weathercode] || `Code ${cw.weathercode}`;
        const precipProb = weatherData.hourly?.precipitation_probability?.[new Date().getHours()] ?? null;
        context += `\n--- Current Weather ---\n`;
        context += `Temperature: ${cw.temperature}°C, ${desc}, Wind: ${cw.windspeed} km/h\n`;
        if (precipProb !== null) context += `Rain Probability: ${precipProb}%\n`;
      }
    } catch { /* hava durumu opsiyonel */ }

    // Add latest snapshot data
    const latestLog = logs[0];
    context += `\n--- Latest Snapshot (${latestLog.timestamp.toISOString()}) ---\n`;
    context += `People In: ${latestLog.peopleIn}\n`;
    context += `People Out: ${latestLog.peopleOut}\n`;
    context += `Current Count: ${latestLog.currentCount}\n`;
    if (latestLog.queueCount !== null) {
      context += `Queue Count: ${latestLog.queueCount}\n`;
    }
    if (latestLog.fps !== null) {
      context += `FPS: ${latestLog.fps}\n`;
    }

    return context;
  } catch (error) {
    console.error('Error fetching analytics context:', error);
    return 'Error fetching analytics data.';
  }
}

/**
 * Extract demographics summary from logs
 */
function extractDemographics(logs: any[]): string | null {
  try {
    const demographicsLogs = logs.filter(log => log.demographics && Object.keys(log.demographics).length > 0);

    if (demographicsLogs.length === 0) {
      return null;
    }

    // Aggregate demographics data
    const genderCounts: Record<string, number> = {};
    const ageCounts: Record<string, number> = {};

    demographicsLogs.forEach(log => {
      const demo = log.demographics as any;

      // Count genders
      if (demo.gender) {
        Object.entries(demo.gender).forEach(([gender, count]) => {
          genderCounts[gender] = (genderCounts[gender] || 0) + (count as number);
        });
      }

      // Count age groups
      if (demo.age) {
        Object.entries(demo.age).forEach(([age, count]) => {
          ageCounts[age] = (ageCounts[age] || 0) + (count as number);
        });
      }
    });

    let demoStr = '';

    if (Object.keys(genderCounts).length > 0) {
      demoStr += 'Gender Distribution:\n';
      Object.entries(genderCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([gender, count]) => {
          demoStr += `  ${gender}: ${count}\n`;
        });
    }

    if (Object.keys(ageCounts).length > 0) {
      demoStr += '\nAge Distribution:\n';
      Object.entries(ageCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([age, count]) => {
          demoStr += `  ${age}: ${count}\n`;
        });
    }

    return demoStr || null;
  } catch (error) {
    console.error('Error extracting demographics:', error);
    return null;
  }
}

/**
 * Get recent zone insights
 */
async function getZoneInsights(): Promise<string | null> {
  try {
    const insights = await prisma.zoneInsight.findMany({
      orderBy: {
        timestamp: 'desc'
      },
      take: 20,
      include: {
        zone: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    if (insights.length === 0) {
      return null;
    }

    let insightsStr = '';
    insights.forEach((insight, index) => {
      insightsStr += `${index + 1}. ${insight.message}\n`;
      insightsStr += `   Zone: ${insight.zone?.name || insight.zoneId}\n`;
      insightsStr += `   Duration: ${Math.round(insight.duration / 60)} minutes\n`;
      if (insight.gender) {
        insightsStr += `   Gender: ${insight.gender}\n`;
      }
      if (insight.age) {
        insightsStr += `   Age: ${insight.age}\n`;
      }
      insightsStr += '\n';
    });

    return insightsStr;
  } catch (error) {
    console.error('Error fetching zone insights:', error);
    return null;
  }
}

/**
 * Build the full context prompt for the AI model (Ollama or Gemini).
 * Optimized for speed, data accuracy, and bilingual quality.
 *
 * `lang` (when provided by the frontend) takes precedence over the heuristic.
 */
function buildContextPrompt(userMessage: string, analyticsContext: string, lang?: 'tr' | 'en'): string {
  let isTurkish: boolean;
  if (lang === 'tr') {
    isTurkish = true;
  } else if (lang === 'en') {
    isTurkish = false;
  } else {
    // Heuristic fallback when frontend hasn't passed a preference.
    const turkishChars = /[çğıöşüÇĞİÖŞÜ]/;
    const turkishWords = /\b(merhaba|nasıl|nedir|kaç|kişi|bugün|şu an|müşteri|ziyaretçi|analiz|durum|hava|kuyruk|bekleme|yoğun|saat|cinsiyet|yaş|kadın|erkek|öneri|rapor|kafe)\b/i;
    isTurkish = turkishChars.test(userMessage) || turkishWords.test(userMessage);
  }

  const langInstruction = isTurkish
    ? `DİL: Tamamen Türkçe yanıt ver. Doğal, akıcı Türkçe kullan.`
    : `LANGUAGE: Respond entirely in English. Use natural, fluent English.`;

  const roleInstruction = isTurkish
    ? `Sen ObservAI platformunun kafe/restoran analitik asistanısın. Yöneticilere verilere dayalı, uygulanabilir öneriler sunuyorsun.`
    : `You are ObservAI's cafe/restaurant analytics assistant. You provide data-driven, actionable advice to managers.`;

  return `${roleInstruction}

${langInstruction}

ANALYTICS DATA:
${analyticsContext}
---

QUESTION: ${userMessage}

RULES:
- Use ONLY the data above. Quote exact numbers (e.g. "23 visitors", "4.2 min wait").
- Maximum 4 sentences. Be direct, no filler.
- If data is insufficient, say what IS available.
- Suggest 1 concrete action when relevant (staffing, queue, layout, marketing).
- Correlate weather with traffic if weather data exists.
- For demographics: suggest targeted actions based on dominant group.

ANSWER:`;
}

export default router;
