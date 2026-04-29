/**
 * Faz 11 cleanup — wipe today's AnalyticsSummary rows for every camera and
 * re-fold them from raw AnalyticsLog using the (now-fixed) cumulative-aware
 * aggregator. Use this once to clear the bogus inflated entry counts that
 * the old aggregator wrote (e.g. 7672 entries/hour from 3946 cumulative
 * samples).
 *
 * Usage:
 *   npm run reset:today
 *
 * Idempotent: runs nightly aggregator-style logic, so re-running just
 * overwrites the same rows.
 */
import { prisma } from '../src/lib/db';
import { runHourlyAggregationFor } from '../src/services/analyticsAggregator';

async function main() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const removed = await prisma.analyticsSummary.deleteMany({
    where: { date: { gte: todayStart, lt: todayEnd } },
  });
  console.log(`[reset-today] Removed ${removed.count} stale AnalyticsSummary rows for today`);

  const currentHour = new Date().getHours();
  let folded = 0;
  for (let h = 0; h <= currentHour; h++) {
    const hourStart = new Date(todayStart);
    hourStart.setHours(h, 0, 0, 0);
    const n = await runHourlyAggregationFor(hourStart);
    if (n > 0) {
      console.log(`[reset-today] Re-aggregated hour ${String(h).padStart(2, '0')}:00 → ${n} cameras`);
      folded += n;
    }
  }
  console.log(`[reset-today] Done — ${folded} hour×camera buckets re-folded with cumulative-aware delta`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[reset-today] Failed:', err);
  process.exit(1);
});
