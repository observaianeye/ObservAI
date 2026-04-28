/**
 * Yan #28 — Normalize seconds-cinsinden analytics_logs timestamps to ms.
 *
 * Idempotent: re-runs are safe; rows already in ms (>= 1e10 raw integer)
 * are skipped. Run from backend/:
 *
 *   npx tsx scripts/normalize-timestamp.ts
 *
 * Note: SQLite stores Prisma DateTime as ISO text in our schema, so a raw
 * integer cast may not reflect the unit. This script targets the rare
 * case where a numeric (epoch-seconds) value made it past validation
 * before Yan #28's validator guard.
 */
import { PrismaClient } from '@prisma/client';

const SECONDS_THRESHOLD_RAW = 10_000_000_000; // 10^10 — anything below = seconds

async function main() {
  const p = new PrismaClient();
  try {
    const rows: Array<{ id: string; timestamp: number | bigint }> = await p.$queryRawUnsafe(
      `SELECT id, timestamp FROM analytics_logs
       WHERE typeof(timestamp) = 'integer' AND timestamp < ${SECONDS_THRESHOLD_RAW}`,
    );

    if (rows.length === 0) {
      console.log('[normalize-timestamp] 0 rows in seconds — nothing to do');
      return;
    }

    let fixed = 0;
    for (const row of rows) {
      const seconds = Number(row.timestamp);
      const ms = seconds * 1000;
      await p.analyticsLog.update({
        where: { id: row.id },
        data: { timestamp: new Date(ms) },
      });
      fixed += 1;
    }
    console.log(`[normalize-timestamp] normalized ${fixed} of ${rows.length} rows to ms`);
  } finally {
    await p.$disconnect();
  }
}

main().catch((err) => {
  console.error('[normalize-timestamp] failed:', err);
  process.exit(1);
});
