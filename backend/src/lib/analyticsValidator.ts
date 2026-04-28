/**
 * Analytics payload validator (Stage 7 — Data Integrity)
 *
 * Stronger sanity checks for data arriving at POST /api/analytics.
 * Returns a typed, sanitized object on success, or null on failure.
 * Invalid payloads are logged and dropped before hitting the DB.
 */

export interface AnalyticsPayload {
  cameraId: string;
  peopleIn: number;
  peopleOut: number;
  currentCount: number;
  demographics?: Record<string, unknown>;
  queueCount?: number;
  avgWaitTime?: number;
  longestWaitTime?: number;
  fps?: number;
  heatmap?: unknown;
  activePeople?: unknown;
  timestamp?: Date;
}

export interface ValidationResult {
  ok: boolean;
  payload: AnalyticsPayload | null;
  reasons: string[];
}

const MAX_PEOPLE = 200;
const MAX_FPS = 120;
const MIN_FPS = 0;
const MAX_QUEUE = 200;
const MAX_WAIT_SECONDS = 60 * 60; // 1 hour
const MAX_FUTURE_SKEW_MS = 5_000;
const MAX_PAST_AGE_MS = 60_000;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isNonNegativeInt(v: unknown, max: number): v is number {
  return isFiniteNumber(v) && Number.isInteger(v) && v >= 0 && v <= max;
}

function isInRange(v: unknown, min: number, max: number): v is number {
  return isFiniteNumber(v) && v >= min && v <= max;
}

export function validateAnalyticsPayload(raw: unknown, now: Date = new Date()): ValidationResult {
  const reasons: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { ok: false, payload: null, reasons: ['payload is not an object'] };
  }

  const p = raw as Record<string, unknown>;

  if (typeof p.cameraId !== 'string' || p.cameraId.trim().length === 0) {
    reasons.push('cameraId missing or not a string');
  }

  if (!isNonNegativeInt(p.peopleIn, MAX_PEOPLE)) {
    reasons.push(`peopleIn out of range (0..${MAX_PEOPLE})`);
  }
  if (!isNonNegativeInt(p.peopleOut, MAX_PEOPLE)) {
    reasons.push(`peopleOut out of range (0..${MAX_PEOPLE})`);
  }
  if (!isNonNegativeInt(p.currentCount, MAX_PEOPLE)) {
    reasons.push(`currentCount out of range (0..${MAX_PEOPLE})`);
  }

  if (p.fps !== undefined && p.fps !== null && !isInRange(p.fps, MIN_FPS, MAX_FPS)) {
    reasons.push(`fps out of range (${MIN_FPS}..${MAX_FPS})`);
  }

  if (p.queueCount !== undefined && p.queueCount !== null && !isNonNegativeInt(p.queueCount, MAX_QUEUE)) {
    reasons.push(`queueCount out of range (0..${MAX_QUEUE})`);
  }

  if (p.avgWaitTime !== undefined && p.avgWaitTime !== null && !isInRange(p.avgWaitTime, 0, MAX_WAIT_SECONDS)) {
    reasons.push(`avgWaitTime out of range (0..${MAX_WAIT_SECONDS}s)`);
  }

  if (p.longestWaitTime !== undefined && p.longestWaitTime !== null && !isInRange(p.longestWaitTime, 0, MAX_WAIT_SECONDS)) {
    reasons.push(`longestWaitTime out of range (0..${MAX_WAIT_SECONDS}s)`);
  }

  let timestamp: Date | undefined;
  if (p.timestamp !== undefined && p.timestamp !== null) {
    // Yan #28: reject seconds-cinsinden numeric timestamps explicitly. Any
    // integer below 10^12 is too small to be a recent ms epoch (10^12 ms =
    // 2001-09-09); this catches Python clients that sent time.time() instead
    // of int(time.time() * 1000).
    if (typeof p.timestamp === 'number' && Number.isFinite(p.timestamp) && p.timestamp < 1_000_000_000_000) {
      reasons.push('timestamp appears to be in seconds, expected milliseconds (>= 1e12)');
    } else {
      const parsed = p.timestamp instanceof Date ? p.timestamp : new Date(p.timestamp as string);
      if (Number.isNaN(parsed.getTime())) {
        reasons.push('timestamp is not a valid date');
      } else {
        const delta = parsed.getTime() - now.getTime();
        if (delta > MAX_FUTURE_SKEW_MS) {
          reasons.push(`timestamp is in the future by ${Math.round(delta / 1000)}s`);
        } else if (-delta > MAX_PAST_AGE_MS) {
          reasons.push(`timestamp is older than ${MAX_PAST_AGE_MS / 1000}s`);
        } else {
          timestamp = parsed;
        }
      }
    }
  }

  if (p.demographics !== undefined && p.demographics !== null && typeof p.demographics !== 'object') {
    reasons.push('demographics must be an object');
  }

  if (reasons.length > 0) {
    return { ok: false, payload: null, reasons };
  }

  const payload: AnalyticsPayload = {
    cameraId: (p.cameraId as string).trim(),
    peopleIn: p.peopleIn as number,
    peopleOut: p.peopleOut as number,
    currentCount: p.currentCount as number,
    demographics: (p.demographics ?? undefined) as Record<string, unknown> | undefined,
    queueCount: (p.queueCount ?? undefined) as number | undefined,
    avgWaitTime: (p.avgWaitTime ?? undefined) as number | undefined,
    longestWaitTime: (p.longestWaitTime ?? undefined) as number | undefined,
    fps: (p.fps ?? undefined) as number | undefined,
    heatmap: p.heatmap,
    activePeople: p.activePeople,
    timestamp,
  };

  return { ok: true, payload, reasons: [] };
}
