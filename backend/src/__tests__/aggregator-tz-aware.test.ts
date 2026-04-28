/**
 * Yan #45 fix coverage: startOfDayInTz / endOfDayInTz must compute the UTC
 * instant of branch-local midnight, NOT the host's local midnight. Both
 * branches we run today (Mozart C / Europe/Istanbul, Cape Town Ekhaya /
 * Africa/Johannesburg) sit on fixed offsets (no DST), so the expected UTC
 * timestamps are deterministic and don't drift across the year.
 */
import { describe, it, expect } from 'vitest';
import { startOfDayInTz, endOfDayInTz } from '../services/analyticsAggregator';

describe('analyticsAggregator branch-tz aware day windows (Yan #45)', () => {
  it('startOfDayInTz Europe/Istanbul (UTC+3) for 2026-04-25 returns 2026-04-24T21:00Z', () => {
    // Pick a UTC instant that falls inside 2026-04-25 in Istanbul wall clock.
    // 2026-04-25T08:00Z is 2026-04-25T11:00 in Istanbul → local day = 2026-04-25.
    const reference = new Date('2026-04-25T08:00:00Z');
    const start = startOfDayInTz(reference, 'Europe/Istanbul');
    expect(start.toISOString()).toBe('2026-04-24T21:00:00.000Z');

    const end = endOfDayInTz(reference, 'Europe/Istanbul');
    expect(end.toISOString()).toBe('2026-04-25T21:00:00.000Z');
  });

  it('startOfDayInTz Africa/Johannesburg (UTC+2) for 2026-04-25 returns 2026-04-24T22:00Z', () => {
    // 2026-04-25T06:00Z = 2026-04-25T08:00 in Johannesburg → local day = 2026-04-25.
    const reference = new Date('2026-04-25T06:00:00Z');
    const start = startOfDayInTz(reference, 'Africa/Johannesburg');
    expect(start.toISOString()).toBe('2026-04-24T22:00:00.000Z');

    const end = endOfDayInTz(reference, 'Africa/Johannesburg');
    expect(end.toISOString()).toBe('2026-04-25T22:00:00.000Z');
  });
});
