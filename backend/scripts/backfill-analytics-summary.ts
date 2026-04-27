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
 * Cafe model:
 *   - Open hours: 08:00–23:00 (last active hour stamped at 22:00)
 *   - Closed hours: 23 + 00..07 → strictly zero traffic
 *   - Lunch peak: 12–14, Dinner peak: 19–21
 *   - Weekly: Fri/Sat busiest, Tue/Wed quietest
 *   - Today (offset 0) is partially seeded up to the current hour so the
 *     "this week" curve in Trends includes live-looking data instead of
 *     cliff-dropping yesterday → today.
 *
 * Usage:
 *   npm run seed:history           # last 90 days (default — covers 7/30/90 windows)
 *   BACKFILL_DAYS=30 npm run seed:history
 *
 * Idempotency: each AnalyticsSummary row has a unique (cameraId, date, hour)
 * index. Re-running overwrites existing synthetic entries. Real entries
 * (same key) will also be overwritten — so do NOT run against prod without
 * a safety gate.
 */
import { prisma } from '../src/lib/db';

// Hours 0..23. Closed hours are exactly 0 so the chart shows a flat line at
// the cafe's closed window — no fake midnight noise.
const HOURLY_WEIGHTS = [
  0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, // 00-07 closed
  0.30, 0.45, 0.55, 0.70,                         // 08-11 morning + lead-in
  1.00, 0.95, 0.65,                               // 12-14 lunch peak
  0.45, 0.50, 0.65,                               // 15-17 afternoon
  0.85, 1.00, 0.95, 0.70,                         // 18-21 dinner peak
  0.45,                                           // 22 wind-down
  0.00,                                           // 23 closed (last hour)
] as const;

// Mon..Sun multiplier. Friday/Saturday spike, Tue/Wed dip.
const WEEKDAY_MOD = [0.92, 0.82, 0.85, 0.95, 1.25, 1.40, 1.10] as const;

const AGE_BUCKETS = ['0-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;
const AGE_DISTRIBUTION: Record<string, number> = {
  '0-17': 5,
  '18-24': 26,
  '25-34': 34,
  '35-44': 18,
  '45-54': 10,
  '55-64': 5,
  '65+': 2,
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
// Box-Muller normal sample, clamped to [0.4, 1.6] so the noise looks like
// daily variation and not freak outliers.
function noise(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  const scaled = 1 + 0.18 * z;
  return Math.max(0.4, Math.min(1.6, scaled));
}

interface HourRow {
  totalEntries: number;
  totalExits: number;
  peakOccupancy: number;
  avgOccupancy: number;
  avgQueueLength: number;
  avgWaitTime: number;
  demographics: string;
}

function generateHourlyRow(baseTraffic: number, dayMod: number, hourIdx: number, seasonalMod: number): HourRow {
  const weight = HOURLY_WEIGHTS[hourIdx];

  if (weight === 0) {
    // Closed hour → genuine zero. Demographics empty, no queue/wait.
    return {
      totalEntries: 0,
      totalExits: 0,
      peakOccupancy: 0,
      avgOccupancy: 0,
      avgQueueLength: 0,
      avgWaitTime: 0,
      demographics: JSON.stringify({
        gender: { male: 0, female: 0 },
        age: {},
        samples: 0,
        _synthetic: true,
      }),
    };
  }

  const entries = Math.max(0, Math.round(baseTraffic * dayMod * seasonalMod * weight * noise()));
  // Most arrivals leave within the hour. Slight overhang during early-evening
  // ramp-up (people lingering through to dinner peak).
  const exitFactor = hourIdx >= 12 && hourIdx <= 14 ? randFloat(0.85, 1.0)
                  : hourIdx >= 19 && hourIdx <= 21 ? randFloat(0.80, 0.95)
                  : randFloat(0.92, 1.05);
  const exits = Math.max(0, Math.round(entries * exitFactor));

  // Peak occupancy is bounded by the floor capacity; avg is a fraction of peak.
  const peak = Math.max(1, Math.round(entries * randFloat(0.55, 0.95)));
  const avg = Math.max(1, Math.round(peak * randFloat(0.55, 0.85)));

  // Demographics: weight by AGE_DISTRIBUTION but jitter each bucket so two
  // identical hours don't render as identical pie charts.
  const ageCounts: Record<string, number> = {};
  let remaining = entries;
  for (const bucket of AGE_BUCKETS) {
    const share = (AGE_DISTRIBUTION[bucket] / 100) * randFloat(0.85, 1.15);
    const n = Math.round(entries * share);
    ageCounts[bucket] = n;
    remaining -= n;
  }
  // Push leftover into 25-34 (largest cafe bucket) so the totals reconcile.
  ageCounts['25-34'] = Math.max(0, (ageCounts['25-34'] ?? 0) + remaining);

  const malePct = randFloat(0.42, 0.58);
  const male = Math.round(entries * malePct);
  const female = Math.max(0, entries - male);

  // Queue + wait only meaningful during peak windows. Rest of day → near zero.
  const isPeak = (hourIdx >= 12 && hourIdx <= 14) || (hourIdx >= 19 && hourIdx <= 21);
  const avgQueueLength = isPeak ? randFloat(1.5, 4.5) : randFloat(0, 0.8);
  const avgWaitTime = isPeak ? randFloat(60, 180) : randFloat(15, 60);

  return {
    totalEntries: entries,
    totalExits: exits,
    peakOccupancy: peak,
    avgOccupancy: avg,
    avgQueueLength,
    avgWaitTime,
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

// Slight 90-day upward drift (~+12% over 90 days) plus a week-long noise band
// so the lookback feels like a growing business, not a flat repeating loop.
function seasonalMultiplier(dayOffset: number): number {
  const trend = 1 + (90 - dayOffset) / 90 * 0.12;
  const weekly = 1 + Math.sin(dayOffset * 0.9) * 0.06;
  return trend * weekly;
}

// ─── Real historical weather per branch ──────────────────────────────────────
// Open-Meteo Archive API (free, no key). Returns daily aggregates for the
// branch's exact lat/lon, so two cafes in different cities see different
// weather-driven traffic. Cached per (lat,lon) within a single backfill run.
interface DailyWeather {
  precipitation: number;  // mm
  tMax: number;           // °C
  tMin: number;           // °C
  weatherCode: number;    // WMO code
}
const weatherCache = new Map<string, Map<string, DailyWeather>>();

async function fetchHistoricalWeather(
  latitude: number,
  longitude: number,
  startDate: Date,
  endDate: Date,
): Promise<Map<string, DailyWeather>> {
  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached) return cached;

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${latitude}&longitude=${longitude}` +
    `&start_date=${fmt(startDate)}&end_date=${fmt(endDate)}` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,weather_code` +
    `&timezone=auto`;

  const result = new Map<string, DailyWeather>();
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[backfill] weather fetch ${res.status} for ${cacheKey} — falling back to neutral`);
      weatherCache.set(cacheKey, result);
      return result;
    }
    const j = await res.json() as {
      daily?: {
        time: string[];
        precipitation_sum: (number | null)[];
        temperature_2m_max: (number | null)[];
        temperature_2m_min: (number | null)[];
        weather_code: (number | null)[];
      };
    };
    if (j.daily) {
      for (let i = 0; i < j.daily.time.length; i++) {
        result.set(j.daily.time[i], {
          precipitation: j.daily.precipitation_sum[i] ?? 0,
          tMax: j.daily.temperature_2m_max[i] ?? 20,
          tMin: j.daily.temperature_2m_min[i] ?? 10,
          weatherCode: j.daily.weather_code[i] ?? 0,
        });
      }
    }
  } catch (err) {
    console.warn(`[backfill] weather fetch failed for ${cacheKey}:`, err instanceof Error ? err.message : err);
  }
  weatherCache.set(cacheKey, result);
  return result;
}

// Daily weather → visitor multiplier. Heavy rain hurts most; mild dry days
// give a small bump. Numbers are deliberately gentle (0.6..1.10) so the
// long-run trend stays the dominant signal — weather is texture, not noise.
function weatherMultiplier(w: DailyWeather | undefined): number {
  if (!w) return 1.0;
  let m = 1.0;
  if (w.precipitation > 15) m *= 0.65;       // storm / heavy rain
  else if (w.precipitation > 5) m *= 0.80;   // moderate rain
  else if (w.precipitation > 1) m *= 0.92;   // drizzle
  else m *= 1.04;                            // dry
  if (w.tMax >= 18 && w.tMax <= 26) m *= 1.05;     // perfect cafe weather
  else if (w.tMax >= 12 && w.tMax < 18) m *= 0.98;
  else if (w.tMax > 32) m *= 0.92;                  // hot
  else if (w.tMax < 5) m *= 0.85;                   // cold
  else if (w.tMax < 0) m *= 0.75;                   // freezing
  // WMO codes 95-99 = thunderstorm — extra penalty on top of precipitation
  if (w.weatherCode >= 95) m *= 0.85;
  if (w.weatherCode >= 71 && w.weatherCode <= 77) m *= 0.78; // snow
  return m;
}

// Hourly traffic congestion (heuristic — no historical TomTom). Heavy rush
// hour traffic = harder to reach a cafe by car/bus = mild visitor reduction.
// Cafe peak hours (lunch, dinner) get a slight boost from foot traffic
// in busy commercial areas.
function trafficMultiplier(hour: number, isWeekend: boolean): number {
  if (isWeekend) {
    // Weekends: leisurely, lunch + evening crowds drive cafe traffic up
    if (hour >= 12 && hour <= 14) return 1.05;
    if (hour >= 18 && hour <= 21) return 1.06;
    if (hour >= 22 || hour < 8) return 0.95;
    return 1.00;
  }
  // Weekdays: rush hour (commute home/from work) makes cafe access slightly harder
  if (hour >= 7 && hour <= 9) return 0.94;
  if (hour >= 17 && hour <= 19) return 0.95;
  if (hour >= 12 && hour <= 13) return 1.04; // lunch break — close-by office foot traffic
  if (hour >= 22 || hour < 6) return 0.92;
  return 1.0;
}

async function backfillOneCamera(
  cameraId: string,
  days: number,
  branchCoords: { latitude: number; longitude: number } | null,
): Promise<number> {
  let written = 0;
  const today = startOfDay(new Date());
  const nowHour = new Date().getHours();

  // Pull the full window once per branch (Open-Meteo accepts ranges, so this
  // is one HTTP call per unique location for the whole backfill).
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);
  const weather = branchCoords
    ? await fetchHistoricalWeather(branchCoords.latitude, branchCoords.longitude, startDate, today)
    : new Map<string, DailyWeather>();

  // Walk from oldest to today (offset 0). Including today gives Trends'
  // "this week" curve a non-empty rightmost slice.
  for (let dayOffset = days; dayOffset >= 0; dayOffset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - dayOffset);
    const weekdayMod = WEEKDAY_MOD[day.getDay() === 0 ? 6 : day.getDay() - 1]; // Mon=0 ... Sun=6
    const baseTraffic = randInt(38, 72);
    const seasonalMod = seasonalMultiplier(dayOffset);
    const dayKey = day.toISOString().slice(0, 10);
    const weatherMod = weatherMultiplier(weather.get(dayKey));
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

    const dailyTotals = { entries: 0, exits: 0, peakOccupancy: 0, avgOccupancySum: 0 };
    const mergedDemographics = {
      gender: { male: 0, female: 0 },
      age: {} as Record<string, number>,
      samples: 0,
    };

    // Hourly rows. For today, only emit hours up to the current real hour so
    // the page doesn't show 23:00 traffic at 14:00.
    const lastHour = dayOffset === 0 ? Math.min(23, nowHour) : 23;
    for (let hour = 0; hour <= lastHour; hour++) {
      const trafficMod = trafficMultiplier(hour, isWeekend);
      const row = generateHourlyRow(baseTraffic, weekdayMod, hour, seasonalMod * weatherMod * trafficMod);
      await prisma.analyticsSummary.upsert({
        where: { cameraId_date_hour: { cameraId, date: day, hour } },
        create: { cameraId, date: day, hour, ...row },
        update: { ...row },
      });
      written++;

      dailyTotals.entries += row.totalEntries;
      dailyTotals.exits += row.totalExits;
      dailyTotals.peakOccupancy = Math.max(dailyTotals.peakOccupancy, row.peakOccupancy);
      dailyTotals.avgOccupancySum += row.avgOccupancy;

      const demo = JSON.parse(row.demographics);
      mergedDemographics.gender.male += demo.gender.male ?? 0;
      mergedDemographics.gender.female += demo.gender.female ?? 0;
      for (const [bucket, count] of Object.entries(demo.age as Record<string, number>)) {
        mergedDemographics.age[bucket] = (mergedDemographics.age[bucket] ?? 0) + count;
      }
      mergedDemographics.samples += demo.samples ?? 0;
    }

    // Daily rollup (hour=null). Avg occupancy averaged across active hours
    // only — averaging across 24 including 8 closed hours of 0 understates it.
    const activeHours = Math.max(1, lastHour + 1 - 8); // 08..lastHour
    const dailyData = {
      totalEntries: dailyTotals.entries,
      totalExits: dailyTotals.exits,
      peakOccupancy: dailyTotals.peakOccupancy,
      avgOccupancy: dailyTotals.avgOccupancySum / activeHours,
      avgQueueLength: randFloat(0.4, 2.2),
      avgWaitTime: randFloat(45, 130),
      demographics: JSON.stringify({ ...mergedDemographics, _synthetic: true }),
    };

    // SQLite doesn't unique-index nulls, so look up the daily row by hand.
    const existing = await prisma.analyticsSummary.findFirst({
      where: { cameraId, date: day, hour: null },
    });
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
  const days = Number(process.env.BACKFILL_DAYS || 90);
  console.log(`\n[backfill] Starting — ${days} days of synthetic AnalyticsSummary (cafe 08:00-23:00)`);

  const cameras = await prisma.camera.findMany({
    select: {
      id: true,
      name: true,
      branch: { select: { id: true, name: true, latitude: true, longitude: true } },
    },
  });
  if (cameras.length === 0) {
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
    cameras.push({ ...camera, branch: null });
  }

  let total = 0;
  for (const cam of cameras) {
    const branchLabel = cam.branch ? `${cam.branch.name} (${cam.branch.latitude.toFixed(2)}, ${cam.branch.longitude.toFixed(2)})` : 'no branch — neutral weather';
    console.log(`[backfill] Camera: ${cam.name} (${cam.id}) — ${branchLabel}`);
    const coords = cam.branch ? { latitude: cam.branch.latitude, longitude: cam.branch.longitude } : null;
    const n = await backfillOneCamera(cam.id, days, coords);
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
