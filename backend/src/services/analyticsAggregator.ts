/**
 * Analytics aggregator (Stage 7 — Data Integrity)
 *
 * Rolls raw AnalyticsLog rows up into AnalyticsSummary at two granularities:
 *   - hourly: each completed hour → one row per cameraId (hour = 0..23)
 *   - daily:  each completed day  → one row per cameraId (hour = null)
 *
 * Idempotent: running twice for the same window overwrites the row with
 * fresh numbers. SQLite treats NULL as distinct in unique indexes, so the
 * daily path uses findFirst + update/create instead of upsert.
 *
 * Dependency-free: uses setInterval (no node-cron). The tick runs every
 * 5 minutes, but only does real work at the boundary — hourly rollup when
 * the previous-hour key changes, daily rollup when local midnight lands.
 */

import { prisma } from '../lib/db';

type LogForAgg = {
  peopleIn: number;
  peopleOut: number;
  currentCount: number;
  demographics: string | null;
  queueCount: number | null;
  avgWaitTime: number | null;
};

function startOfHour(d: Date): Date {
  const r = new Date(d);
  r.setMinutes(0, 0, 0);
  return r;
}

function endOfHour(d: Date): Date {
  const r = startOfHour(d);
  r.setHours(r.getHours() + 1);
  return r;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = startOfDay(d);
  r.setDate(r.getDate() + 1);
  return r;
}

export function mergeDemographics(rows: Array<{ demographics: string | null }>): string | null {
  const gender: Record<string, number> = {};
  const age: Record<string, number> = {};
  let count = 0;
  for (const row of rows) {
    if (!row.demographics) continue;
    try {
      const d = JSON.parse(row.demographics);
      if (d?.gender && typeof d.gender === 'object') {
        for (const [k, v] of Object.entries(d.gender)) {
          if (typeof v === 'number') gender[k] = (gender[k] ?? 0) + v;
        }
      }
      if (d?.age && typeof d.age === 'object') {
        for (const [k, v] of Object.entries(d.age)) {
          if (typeof v === 'number') age[k] = (age[k] ?? 0) + v;
        }
      }
      count++;
    } catch {
      // skip malformed rows
    }
  }
  if (count === 0) return null;
  return JSON.stringify({ gender, age, samples: count });
}

export function computeStats(logs: LogForAgg[]) {
  const totalEntries = logs.reduce((s, l) => s + (l.peopleIn || 0), 0);
  const totalExits = logs.reduce((s, l) => s + (l.peopleOut || 0), 0);
  const peakOccupancy = logs.reduce((m, l) => Math.max(m, l.currentCount || 0), 0);
  const avgOccupancy = logs.reduce((s, l) => s + (l.currentCount || 0), 0) / logs.length;

  const queueRows = logs.filter((l) => l.queueCount !== null && l.queueCount !== undefined);
  const avgQueueLength = queueRows.length > 0
    ? queueRows.reduce((s, l) => s + (l.queueCount ?? 0), 0) / queueRows.length
    : null;

  const waitRows = logs.filter((l) => l.avgWaitTime !== null && l.avgWaitTime !== undefined);
  const avgWaitTime = waitRows.length > 0
    ? waitRows.reduce((s, l) => s + (l.avgWaitTime ?? 0), 0) / waitRows.length
    : null;

  const demographics = mergeDemographics(logs);

  return { totalEntries, totalExits, peakOccupancy, avgOccupancy, avgQueueLength, avgWaitTime, demographics };
}

async function aggregateHourBucket(cameraId: string, hourStart: Date): Promise<void> {
  const hourEnd = endOfHour(hourStart);
  const logs = await prisma.analyticsLog.findMany({
    where: { cameraId, timestamp: { gte: hourStart, lt: hourEnd } },
    select: {
      peopleIn: true, peopleOut: true, currentCount: true,
      demographics: true, queueCount: true, avgWaitTime: true,
    },
  });
  if (logs.length === 0) return;

  const stats = computeStats(logs);
  const dateKey = startOfDay(hourStart);
  const hour = hourStart.getHours();

  await prisma.analyticsSummary.upsert({
    where: { cameraId_date_hour: { cameraId, date: dateKey, hour } },
    create: { cameraId, date: dateKey, hour, ...stats },
    update: { ...stats },
  });
}

async function aggregateDayBucket(cameraId: string, dayStart: Date): Promise<void> {
  const dayEnd = endOfDay(dayStart);
  const logs = await prisma.analyticsLog.findMany({
    where: { cameraId, timestamp: { gte: dayStart, lt: dayEnd } },
    select: {
      peopleIn: true, peopleOut: true, currentCount: true,
      demographics: true, queueCount: true, avgWaitTime: true,
    },
  });
  if (logs.length === 0) return;

  const stats = computeStats(logs);

  // SQLite treats NULL as distinct in unique indexes; can't rely on upsert for hour=null.
  const existing = await prisma.analyticsSummary.findFirst({
    where: { cameraId, date: dayStart, hour: null },
    select: { id: true },
  });

  if (existing) {
    await prisma.analyticsSummary.update({
      where: { id: existing.id },
      data: { ...stats },
    });
  } else {
    await prisma.analyticsSummary.create({
      data: { cameraId, date: dayStart, hour: null, ...stats },
    });
  }
}

async function listCamerasWithLogsIn(periodStart: Date, periodEnd: Date): Promise<string[]> {
  const rows = await prisma.analyticsLog.findMany({
    where: { timestamp: { gte: periodStart, lt: periodEnd } },
    select: { cameraId: true },
    distinct: ['cameraId'],
  });
  return rows.map((r) => r.cameraId);
}

export async function runHourlyAggregationFor(hourDate: Date): Promise<number> {
  const hourStart = startOfHour(hourDate);
  const hourEnd = endOfHour(hourStart);
  const cameras = await listCamerasWithLogsIn(hourStart, hourEnd);
  let done = 0;
  for (const cameraId of cameras) {
    try {
      await aggregateHourBucket(cameraId, hourStart);
      done++;
    } catch (err) {
      console.error(`[aggregator] hourly rollup failed for ${cameraId}:`, err);
    }
  }
  return done;
}

export async function runDailyAggregationFor(dayDate: Date): Promise<number> {
  const dayStart = startOfDay(dayDate);
  const dayEnd = endOfDay(dayStart);
  const cameras = await listCamerasWithLogsIn(dayStart, dayEnd);
  let done = 0;
  for (const cameraId of cameras) {
    try {
      await aggregateDayBucket(cameraId, dayStart);
      done++;
    } catch (err) {
      console.error(`[aggregator] daily rollup failed for ${cameraId}:`, err);
    }
  }
  return done;
}

let tickTimer: NodeJS.Timeout | null = null;

export function startAnalyticsAggregator(tickMs: number = 5 * 60 * 1000): void {
  if (tickTimer) return;

  let lastHourKey = '';
  let lastDayKey = '';

  const tick = async () => {
    const now = new Date();
    const previousHour = new Date(now.getTime() - 60 * 60 * 1000);
    const hourKey = `${previousHour.getFullYear()}-${previousHour.getMonth()}-${previousHour.getDate()}-${previousHour.getHours()}`;

    if (hourKey !== lastHourKey) {
      try {
        const n = await runHourlyAggregationFor(previousHour);
        if (n > 0) console.log(`[aggregator] hourly rollup: ${n} cameras, hour=${previousHour.getHours()}`);
        lastHourKey = hourKey;
      } catch (err) {
        console.error('[aggregator] hourly tick failed:', err);
      }
    }

    if (now.getHours() === 0) {
      const previousDay = new Date(now);
      previousDay.setDate(previousDay.getDate() - 1);
      const dayStart = startOfDay(previousDay);
      const dayKey = dayStart.toISOString();
      if (dayKey !== lastDayKey) {
        try {
          const n = await runDailyAggregationFor(previousDay);
          if (n > 0) console.log(`[aggregator] daily rollup: ${n} cameras, date=${dayKey.slice(0, 10)}`);
          lastDayKey = dayKey;
        } catch (err) {
          console.error('[aggregator] daily tick failed:', err);
        }
      }
    }
  };

  tickTimer = setInterval(() => { tick().catch(() => { /* best-effort */ }); }, tickMs);
  // Fire once after boot so we catch up on the last finished hour.
  setImmediate(() => { tick().catch(() => { /* best-effort */ }); });
  console.log(`[aggregator] started (tick=${Math.round(tickMs / 1000)}s)`);
}

export function stopAnalyticsAggregator(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}
