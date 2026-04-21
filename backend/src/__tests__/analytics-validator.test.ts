import { describe, it, expect } from 'vitest';
import { validateAnalyticsPayload } from '../lib/analyticsValidator';

describe('validateAnalyticsPayload', () => {
  const now = new Date('2026-04-20T12:00:00Z');

  const goodPayload = {
    cameraId: 'cam-1',
    peopleIn: 2,
    peopleOut: 1,
    currentCount: 4,
    fps: 28.5,
  };

  it('accepts a minimal valid payload', () => {
    const r = validateAnalyticsPayload(goodPayload, now);
    expect(r.ok).toBe(true);
    expect(r.payload?.cameraId).toBe('cam-1');
    expect(r.payload?.peopleIn).toBe(2);
    expect(r.reasons).toEqual([]);
  });

  it('rejects non-object input', () => {
    expect(validateAnalyticsPayload(null, now).ok).toBe(false);
    expect(validateAnalyticsPayload('string', now).ok).toBe(false);
    expect(validateAnalyticsPayload(42, now).ok).toBe(false);
  });

  it('rejects missing cameraId', () => {
    const r = validateAnalyticsPayload({ ...goodPayload, cameraId: '' }, now);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => /cameraId/.test(x))).toBe(true);
  });

  it('rejects negative counts', () => {
    // peopleIn/peopleOut/currentCount must all be non-negative ints.
    const r = validateAnalyticsPayload({ ...goodPayload, peopleIn: -1 }, now);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => /peopleIn/.test(x))).toBe(true);
  });

  it('rejects person counts above sane ceiling', () => {
    // 500 people on a single camera is almost certainly garbage from a
    // broken tracker — drop before it pollutes aggregates.
    const r = validateAnalyticsPayload({ ...goodPayload, currentCount: 500 }, now);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => /currentCount/.test(x))).toBe(true);
  });

  it('rejects fps outside [0, 120]', () => {
    expect(validateAnalyticsPayload({ ...goodPayload, fps: -5 }, now).ok).toBe(false);
    expect(validateAnalyticsPayload({ ...goodPayload, fps: 9999 }, now).ok).toBe(false);
  });

  it('accepts fps at bounds', () => {
    expect(validateAnalyticsPayload({ ...goodPayload, fps: 0 }, now).ok).toBe(true);
    expect(validateAnalyticsPayload({ ...goodPayload, fps: 120 }, now).ok).toBe(true);
  });

  it('rejects timestamps older than 60s', () => {
    const stale = new Date(now.getTime() - 90_000);
    const r = validateAnalyticsPayload({ ...goodPayload, timestamp: stale.toISOString() }, now);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => /timestamp/.test(x))).toBe(true);
  });

  it('rejects timestamps in the future', () => {
    const future = new Date(now.getTime() + 60_000);
    const r = validateAnalyticsPayload({ ...goodPayload, timestamp: future.toISOString() }, now);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => /timestamp/.test(x))).toBe(true);
  });

  it('accepts timestamps within the 60s window', () => {
    const recent = new Date(now.getTime() - 30_000);
    const r = validateAnalyticsPayload({ ...goodPayload, timestamp: recent.toISOString() }, now);
    expect(r.ok).toBe(true);
    expect(r.payload?.timestamp?.toISOString()).toBe(recent.toISOString());
  });

  it('tolerates optional fields being absent', () => {
    const r = validateAnalyticsPayload({
      cameraId: 'cam-1',
      peopleIn: 0,
      peopleOut: 0,
      currentCount: 0,
    }, now);
    expect(r.ok).toBe(true);
    expect(r.payload?.fps).toBeUndefined();
    expect(r.payload?.queueCount).toBeUndefined();
  });

  it('rejects non-object demographics', () => {
    const r = validateAnalyticsPayload({ ...goodPayload, demographics: 'oops' }, now);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => /demographics/.test(x))).toBe(true);
  });

  it('rejects NaN and Infinity fps', () => {
    // NaN/Infinity sneak through JSON if the sender stringifies them as null,
    // but if they ever arrive as numbers they must be dropped.
    expect(validateAnalyticsPayload({ ...goodPayload, fps: NaN }, now).ok).toBe(false);
    expect(validateAnalyticsPayload({ ...goodPayload, fps: Infinity }, now).ok).toBe(false);
  });
});
