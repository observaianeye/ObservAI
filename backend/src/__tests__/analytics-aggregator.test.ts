import { describe, it, expect } from 'vitest';
import { computeStats, mergeDemographics } from '../services/analyticsAggregator';

describe('computeStats', () => {
  // peopleIn/peopleOut are cumulative engine counters (analytics.py). Tests
  // express scenarios as cumulative growth, and totals reflect the delta
  // between the first and last sample (with engine-restart handling).

  it('returns zeroes/nulls when bucket has only one sample', () => {
    // Single sample → cannot derive a delta without a prior baseline.
    const r = computeStats([
      { peopleIn: 1, peopleOut: 0, currentCount: 1, demographics: null, queueCount: null, avgWaitTime: null },
    ]);
    expect(r.totalEntries).toBe(0);
    expect(r.totalExits).toBe(0);
    expect(r.peakOccupancy).toBe(1);
    expect(r.avgOccupancy).toBe(1);
    expect(r.avgQueueLength).toBeNull();
    expect(r.avgWaitTime).toBeNull();
    expect(r.demographics).toBeNull();
  });

  it('computes entries/exits from cumulative counter growth', () => {
    // Cumulative timeline: peopleIn 2 → 5 → 7 means 5 net entries.
    // peopleOut 1 → 1 → 3 means 2 net exits.
    const r = computeStats([
      { peopleIn: 2, peopleOut: 1, currentCount: 5, demographics: null, queueCount: null, avgWaitTime: null },
      { peopleIn: 5, peopleOut: 1, currentCount: 8, demographics: null, queueCount: null, avgWaitTime: null },
      { peopleIn: 7, peopleOut: 3, currentCount: 6, demographics: null, queueCount: null, avgWaitTime: null },
    ]);
    expect(r.totalEntries).toBe(5);
    expect(r.totalExits).toBe(2);
    expect(r.peakOccupancy).toBe(8);
    // average of 5+8+6 = 19/3 ≈ 6.333
    expect(r.avgOccupancy).toBeCloseTo(6.333, 2);
  });

  it('handles engine restart by treating counter drops as a new run', () => {
    // First run: 5 → 12 (7 entries). Engine restarts → counter drops to 0.
    // Second run: 0 → 3 (3 entries). Total = 7 + 3 = 10.
    const r = computeStats([
      { peopleIn: 5, peopleOut: 0, currentCount: 5, demographics: null, queueCount: null, avgWaitTime: null },
      { peopleIn: 12, peopleOut: 0, currentCount: 12, demographics: null, queueCount: null, avgWaitTime: null },
      { peopleIn: 0, peopleOut: 0, currentCount: 0, demographics: null, queueCount: null, avgWaitTime: null },
      { peopleIn: 3, peopleOut: 0, currentCount: 3, demographics: null, queueCount: null, avgWaitTime: null },
    ]);
    expect(r.totalEntries).toBe(10);
  });

  it('averages queue length and wait time only over rows that have them', () => {
    // Two rows with queue data, one row without — the "without" row should
    // not pull the average toward 0.
    const r = computeStats([
      { peopleIn: 0, peopleOut: 0, currentCount: 0, demographics: null, queueCount: 4, avgWaitTime: 60 },
      { peopleIn: 0, peopleOut: 0, currentCount: 0, demographics: null, queueCount: 6, avgWaitTime: 40 },
      { peopleIn: 0, peopleOut: 0, currentCount: 0, demographics: null, queueCount: null, avgWaitTime: null },
    ]);
    expect(r.avgQueueLength).toBe(5);
    expect(r.avgWaitTime).toBe(50);
  });
});

describe('mergeDemographics', () => {
  it('returns null when nothing to merge', () => {
    expect(mergeDemographics([])).toBeNull();
    expect(mergeDemographics([{ demographics: null }])).toBeNull();
  });

  it('aggregates gender and age buckets across rows', () => {
    const out = mergeDemographics([
      { demographics: JSON.stringify({ gender: { male: 2, female: 1 }, age: { '25-34': 3 } }) },
      { demographics: JSON.stringify({ gender: { male: 1, female: 3 }, age: { '25-34': 2, '35-44': 1 } }) },
    ]);
    expect(out).not.toBeNull();
    const parsed = JSON.parse(out!);
    expect(parsed.gender).toEqual({ male: 3, female: 4 });
    expect(parsed.age).toEqual({ '25-34': 5, '35-44': 1 });
    expect(parsed.samples).toBe(2);
  });

  it('skips malformed demographics rows silently', () => {
    const out = mergeDemographics([
      { demographics: 'not-json' },
      { demographics: JSON.stringify({ gender: { male: 1 } }) },
    ]);
    expect(out).not.toBeNull();
    const parsed = JSON.parse(out!);
    expect(parsed.gender).toEqual({ male: 1 });
    expect(parsed.samples).toBe(1);
  });
});
