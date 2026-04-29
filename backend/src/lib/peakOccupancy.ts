/**
 * Sanity-clamp a raw peakOccupancy reading.
 *
 * Why this exists: peakOccupancy in the DB is `max(currentCount)` over a
 * window. A single bad frame from the Python pipeline (track inflation,
 * zone double-count, lost-track ghost retention) can spike currentCount
 * far above the true concurrent count. Once that single sample lands in
 * AnalyticsLog or rolls into AnalyticsSummary, `max()` makes it sticky —
 * the KPI shows the spike forever. The seed before Faz 12 also generated
 * peak as `entries × 0.55-0.95` which inflated peak relative to avg by
 * 2-5x.
 *
 * Invariants enforced:
 *   1. peak ≤ totalEntries (you cannot have more concurrent people than
 *      ever entered the venue).
 *   2. peak ≥ ceil(avgOccupancy) (peak can't be below the average).
 *   3. Shock-spike guard: if raw peak > 30 absolute AND > avg × 5, fall
 *      back to ceil(avg × 2) — a conservative "very busy" heuristic that
 *      respects Little's Law for cafe-style traffic (peak typically
 *      1.5-2.5× avg for Poisson arrivals with bounded dwell).
 *
 * Both Analytics page KPI and AI Chat read this so the two surfaces always
 * report the same number.
 */
export function clampPeakOccupancy(
  rawPeak: number,
  totalEntries: number,
  avgOccupancy: number,
): number {
  const safePeak = Math.max(0, Math.floor(rawPeak));
  const safeEntries = Math.max(0, Math.floor(totalEntries));
  const safeAvg = Math.max(0, avgOccupancy);
  const hardCapped = Math.min(safePeak, safeEntries);
  const avgFloor = Math.ceil(safeAvg);
  if (hardCapped > 30 && safeAvg > 0 && hardCapped > safeAvg * 5) {
    const conservative = Math.ceil(safeAvg * 2);
    return Math.max(avgFloor, conservative);
  }
  return Math.max(hardCapped, avgFloor);
}
