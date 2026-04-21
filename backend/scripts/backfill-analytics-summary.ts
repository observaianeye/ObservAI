/**
 * Historical AnalyticsSummary backfill.
 *
 * Generates realistic-looking AnalyticsSummary rows for the past N days
 * for every Camera in the DB. We do NOT fabricate raw AnalyticsLog rows —
 * those stay authentic, sourced from Python engine emissions. The summary
 * table is where the Historical / Trends / Insights UIs read from, so this
 * script is enough to bring those screens to life on dev databases where
 * no real camera has been live for a month.
 *
 * Usage:
 *   npm run seed:history           # last 30 days
 *   BACKFILL_DAYS=90 npm run seed:history
 *
 * Idempotency: each AnalyticsSummary row has a unique (cameraId, date, hour)
 * index. Re-running overwrites existing synthetic entries. Real entries
 * (same key) will also be overwritten — so do NOT run against prod without
 * a safety gate.
 */
import { prisma } from '../src/lib/db';

// Cafe/restaurant traffic profile (hourly weights 0..23)
// Peak lunch 12-14, peak dinner 19-21, quiet 03-06.
const HOURLY_WEIGHTS = [
  0.05, 0.02, 0.01, 0.01, 0.01, 0.02, // 0-5 (night)
  0.05, 0.15, 0.25, 0.30, 0.40, 0.55, // 6-11 (morning → lunch build-up)
  0.85, 0.95, 0.75, 0.45, 0.40, 0.55, // 12-17 (lunch peak → afternoon lull → early evening)
  0.80, 1.00, 0.90, 0.65, 0.40, 0.20, // 18-23 (dinner peak → closing)
];

// Weekly modifier: Mon..Sun
const WEEKDAY_MOD = [0.85, 0.90, 0.92, 0.95, 1.15, 1.30, 1.05];

const AGE_BUCKETS = ['0-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;
// Cafe-realistic age distribution (%)
const AGE_DISTRIBUTION: Record<string, number> = {
  '0-17': 6,
  '18-24': 26,
  '25-34': 32,
  '35-44': 18,
  '45-54': 10,
  '55-64': 5,
  '65+': 3,
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateHourlyRow(baseTraffic: number, dayMod: number, hourIdx: number) {
  const weight = HOURLY_WEIGHTS[hourIdx];
  const entries = Math.max(0, Math.round(baseTraffic * dayMod * weight * randFloat(0.85, 1.2)));
  // Most entries exit within the same hour, small overhang
  const exits = Math.max(0, Math.round(entries * randFloat(0.90, 1.05)));
  const peak = Math.max(1, Math.round(entries * randFloat(0.55, 1.1)));
  const avg = Math.max(1, peak * randFloat(0.55, 0.90));

  // Demographics — sample from distribution weighted by entries
  const ageCounts: Record<string, number> = {};
  let remaining = entries;
  for (const bucket of AGE_BUCKETS) {
    const n = Math.round((entries * AGE_DISTRIBUTION[bucket]) / 100);
    ageCounts[bucket] = n;
    remaining -= n;
  }
  // Absorb rounding leftover into 25-34 (cafe central bucket)
  if (remaining !== 0) {
    ageCounts['25-34'] = Math.max(0, (ageCounts['25-34'] ?? 0) + remaining);
  }

  const malePct = randFloat(0.42, 0.58);
  const male = Math.round(entries * malePct);
  const female = Math.max(0, entries - male);

  return {
    totalEntries: entries,
    totalExits: exits,
    peakOccupancy: peak,
    avgOccupancy: avg,
    avgQueueLength: hourIdx >= 12 && hourIdx <= 14 ? randFloat(0.5, 3.5) : randFloat(0, 1.2),
    avgWaitTime: hourIdx >= 12 && hourIdx <= 14 ? randFloat(60, 180) : randFloat(30, 90),
    demographics: JSON.stringify({
      gender: { male, female },
      age: ageCounts,
      samples: entries,
      _synthetic: true,
    }),
  };
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

async function backfillOneCamera(cameraId: string, days: number): Promise<number> {
  let written = 0;
  const today = startOfDay(new Date());

  for (let dayOffset = days; dayOffset >= 1; dayOffset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - dayOffset);
    const weekdayMod = WEEKDAY_MOD[day.getDay() === 0 ? 6 : day.getDay() - 1]; // Mon=0
    const baseTraffic = randInt(35, 85); // baseline entries per hour at peak

    const hourlyTotals = { entries: 0, exits: 0, peakOccupancy: 0, avgOccupancy: 0 };
    const mergedDemographics: { gender: Record<string, number>; age: Record<string, number>; samples: number } = {
      gender: { male: 0, female: 0 },
      age: {},
      samples: 0,
    };

    // Hourly rows
    for (let hour = 0; hour < 24; hour++) {
      const row = generateHourlyRow(baseTraffic, weekdayMod, hour);
      await prisma.analyticsSummary.upsert({
        where: { cameraId_date_hour: { cameraId, date: day, hour } },
        create: { cameraId, date: day, hour, ...row },
        update: { ...row },
      });
      written++;

      hourlyTotals.entries += row.totalEntries;
      hourlyTotals.exits += row.totalExits;
      hourlyTotals.peakOccupancy = Math.max(hourlyTotals.peakOccupancy, row.peakOccupancy);
      hourlyTotals.avgOccupancy += row.avgOccupancy;

      const demo = JSON.parse(row.demographics!);
      mergedDemographics.gender.male = (mergedDemographics.gender.male ?? 0) + (demo.gender.male ?? 0);
      mergedDemographics.gender.female = (mergedDemographics.gender.female ?? 0) + (demo.gender.female ?? 0);
      for (const [bucket, count] of Object.entries(demo.age as Record<string, number>)) {
        mergedDemographics.age[bucket] = (mergedDemographics.age[bucket] ?? 0) + count;
      }
      mergedDemographics.samples += demo.samples ?? 0;
    }

    // Daily rollup (hour=null). SQLite doesn't unique-index nulls so we emulate via findFirst.
    const existing = await prisma.analyticsSummary.findFirst({
      where: { cameraId, date: day, hour: null },
    });
    const dailyData = {
      totalEntries: hourlyTotals.entries,
      totalExits: hourlyTotals.exits,
      peakOccupancy: hourlyTotals.peakOccupancy,
      avgOccupancy: hourlyTotals.avgOccupancy / 24,
      avgQueueLength: randFloat(0.3, 2.5),
      avgWaitTime: randFloat(45, 130),
      demographics: JSON.stringify({ ...mergedDemographics, _synthetic: true }),
    };
    if (existing) {
      await prisma.analyticsSummary.update({ where: { id: existing.id }, data: dailyData });
    } else {
      await prisma.analyticsSummary.create({
        data: { cameraId, date: day, hour: null, ...dailyData },
      });
    }
    written++;
  }

  return written;
}

async function main() {
  const days = Number(process.env.BACKFILL_DAYS || 30);
  console.log(`\n[backfill] Starting — ${days} days of synthetic AnalyticsSummary`);

  const cameras = await prisma.camera.findMany({ select: { id: true, name: true } });
  if (cameras.length === 0) {
    // Create a placeholder camera so Historical page has something to show
    console.log('[backfill] No cameras found — creating one synthetic camera for demo');
    const user = await prisma.user.findFirst();
    if (!user) {
      console.error('[backfill] No user in DB — cannot proceed. Register first.');
      process.exit(1);
    }
    const camera = await prisma.camera.create({
      data: {
        name: 'Demo Kamera',
        description: 'Backfill ile olusturuldu — gercek kamera baglaninca bu silinebilir',
        sourceType: 'webcam',
        sourceValue: '0',
        createdBy: user.id,
      },
      select: { id: true, name: true },
    });
    cameras.push(camera);
  }

  let total = 0;
  for (const cam of cameras) {
    console.log(`[backfill] Camera: ${cam.name} (${cam.id})`);
    const n = await backfillOneCamera(cam.id, days);
    console.log(`           +${n} rows`);
    total += n;
  }

  console.log(`\n[backfill] Done — ${total} rows written across ${cameras.length} camera(s)`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[backfill] Failed:', err);
  process.exit(1);
});
