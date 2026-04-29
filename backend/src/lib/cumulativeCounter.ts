/**
 * Cumulative-counter delta helpers.
 *
 * The Python analytics engine emits `peopleIn` and `peopleOut` as cumulative
 * counters (incremented in-process since engine boot — see
 * `analytics.py: self.people_in += 1`). Each AnalyticsLog row carries the
 * running total at sample time, NOT the per-tick delta.
 *
 * Most analytics aggregations want a delta ("how many entered between t1 and
 * t2") not a sum-of-cumulatives. Summing cumulative values across N logs
 * yields O(N²) garbage (e.g. 3946 logs with peopleIn growing 0→12 sums to
 * thousands instead of 12).
 *
 * `cumulativeDelta` walks logs in time order and returns the total positive
 * growth, with engine-restart detection: when the counter drops between two
 * samples, we treat it as a new run starting at 0 and add the post-restart
 * value.
 *
 * Edge cases:
 *  - Empty input → 0
 *  - Single log → 0 (we cannot derive a delta from one sample without a prior
 *    baseline; downstream tolerates this since the next bucket picks up where
 *    we left off)
 *  - Logs out of order → sorted internally (callers don't have to order)
 */

export interface CumulativeSample {
  peopleIn: number;
  timestamp: Date | string | number;
}

function toMs(t: Date | string | number): number {
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'number') return t;
  return new Date(t).getTime();
}

export function cumulativeDelta<T extends CumulativeSample>(
  logs: ReadonlyArray<T>,
  field: keyof T = 'peopleIn' as keyof T,
): number {
  if (logs.length < 2) return 0;
  const sorted = [...logs].sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
  let total = 0;
  let prev = Number(sorted[0][field] ?? 0);
  for (let i = 1; i < sorted.length; i++) {
    const cur = Number(sorted[i][field] ?? 0);
    if (cur >= prev) {
      total += cur - prev;
    } else {
      // engine restart: previous run ended at `prev`, new run is at `cur`
      total += cur;
    }
    prev = cur;
  }
  return total;
}
