/**
 * Yan #28 — Reject seconds-cinsinden numeric timestamps at the validator
 * layer so a Python client passing time.time() instead of int(time.time()*1000)
 * gets a clear 400 instead of a silent "older than 60s" rejection or, worse,
 * an analytics_logs row dated 1970.
 */
import { describe, it, expect } from 'vitest';
import { validateAnalyticsPayload } from '../lib/analyticsValidator';

const validBase = {
  cameraId: 'cam-1',
  peopleIn: 1,
  peopleOut: 0,
  currentCount: 1,
};

describe('Yan #28 — timestamp unit validation', () => {
  it('rejects timestamp in seconds (< 1e12) with clear error', () => {
    const result = validateAnalyticsPayload({ ...validBase, timestamp: 1_700_000_000 });
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => /seconds.*expected milliseconds/i.test(r))).toBe(true);
  });

  it('accepts timestamp in milliseconds (>= 1e12) within freshness window', () => {
    const nowMs = Date.now();
    const result = validateAnalyticsPayload({ ...validBase, timestamp: nowMs });
    expect(result.ok).toBe(true);
    expect(result.payload?.timestamp).toBeInstanceOf(Date);
    expect(result.payload?.timestamp?.getTime()).toBe(nowMs);
  });

  it('rejects ISO string timestamp older than 60s with freshness error (not unit error)', () => {
    const oldIso = new Date(Date.now() - 5 * 60_000).toISOString();
    const result = validateAnalyticsPayload({ ...validBase, timestamp: oldIso });
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => /older than/i.test(r))).toBe(true);
  });
});
