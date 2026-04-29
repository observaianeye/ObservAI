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
import { cumulativeDelta } from '../lib/cumulativeCounter';

type LogForAgg = {
  peopleIn: number;
  peopleOut: number;
  currentCount: number;
  demographics: string | null;
  queueCount: number | null;
  avgWaitTime: number | null;
  timestamp?: Date;
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

/**
 * Yan #45: branch-timezone-aware day window helpers.
 *
 * Until now `startOfDay` used the backend host's local timezone (typically
 * Europe/Istanbul on the dev box), so a Cape Town branch's "daily" rollup
 * was actually the Istanbul day window. That made `daily.totalEntries`
 * disagree with `sum(hourly.totalEntries)` by hours' worth of traffic.
 *
 * These helpers compute the UTC instant corresponding to local midnight in
 * an arbitrary IANA timezone, using only `Intl.DateTimeFormat` (no extra
 * dependency). The aggregator passes each camera's branch tz so each
 * branch's daily window aligns with its own wall clock.
 */
function tzOffsetMinutes(utcInstant: Date, tz: string): number {
  // Compare the same UTC instant rendered as wall clocks in UTC vs `tz`,
  // and return how many minutes ahead `tz` is of UTC. e.g. +180 for
  // Europe/Istanbul, +120 for Africa/Johannesburg, -300 for America/New_York
  // (during EST). DST is handled because Intl re-evaluates per instant.
  const fields: Intl.DateTimeFormatOptions = {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  };
  const utcParts = new Intl.DateTimeFormat('en-CA', { ...fields, timeZone: 'UTC' }).formatToParts(utcInstant);
  const tzParts = new Intl.DateTimeFormat('en-CA', { ...fields, timeZone: tz }).formatToParts(utcInstant);
  const toMap = (parts: Intl.DateTimeFormatPart[]) => {
    const m: Record<string, string> = {};
    for (const p of parts) m[p.type] = p.value;
    return m;
  };
  const u = toMap(utcParts);
  const t = toMap(tzParts);
  // Intl can emit hour=24 at midnight for some locales — coerce to 0.
  const uHour = Number(u.hour) === 24 ? 0 : Number(u.hour);
  const tHour = Number(t.hour) === 24 ? 0 : Number(t.hour);
  const utcMs = Date.UTC(+u.year, +u.month - 1, +u.day, uHour, +u.minute, +u.second);
  const tzMs = Date.UTC(+t.year, +t.month - 1, +t.day, tHour, +t.minute, +t.second);
  return (tzMs - utcMs) / 60000;
}

export function startOfDayInTz(date: Date, tz: string): Date {
  // Find the wall-clock date of `date` in `tz`, then return the UTC instant
  // of 00:00 on that local date.
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of dateParts) map[p.type] = p.value;
  const y = +map.year, m = +map.month, d = +map.day;
  // Take UTC-midnight as the seed, sample the tz offset at that instant,
  // and shift back. Sufficient for tz boundaries that don't fall mid-day.
  const seed = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offsetMin = tzOffsetMinutes(seed, tz);
  return new Date(seed.getTime() - offsetMin * 60000);
}

export function endOfDayInTz(date: Date, tz: string): Date {
  // Add 24h to the local-midnight instant — accurate when no DST jump
  // intervenes; the aggregator only consumes this as an exclusive upper
  // bound, so a 1h DST drift would just include/exclude one extra hour
  // (not a correctness regression for daily totals).
  return new Date(startOfDayInTz(date, tz).getTime() + 24 * 60 * 60 * 1000);
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
  // peopleIn/peopleOut are cumulative engine counters — convert to delta.
  // Logs without timestamps (legacy tests) fall back to row-order semantics:
  // we tag synthetic monotonic timestamps so the cumulative-delta helper can
  // still walk them deterministically.
  const stamped: Array<LogForAgg & { _ts: number }> = logs.map((l, i) => ({
    ...l,
    _ts: l.timestamp ? l.timestamp.getTime() : i,
  }));
  const sortable = stamped.map((l) => ({ peopleIn: l.peopleIn || 0, peopleOut: l.peopleOut || 0, timestamp: l._ts }));
  const totalEntries = cumulativeDelta(sortable, 'peopleIn');
  const totalExits = cumulativeDelta(sortable, 'peopleOut');
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
    orderBy: { timestamp: 'asc' },
    select: {
      timestamp: true,
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

async function getCameraBranchTimezone(cameraId: string): Promise<string> {
  // Fall back to Europe/Istanbul to preserve the historical default for
  // any camera that doesn't have a branch yet (legacy seed rows).
  const cam = await prisma.camera.findUnique({
    where: { id: cameraId },
    include: { branch: { select: { timezone: true } } },
  });
  return cam?.branch?.timezone ?? 'Europe/Istanbul';
}

async function aggregateDayBucket(cameraId: string, dayDate: Date): Promise<void> {
  const tz = await getCameraBranchTimezone(cameraId);
  const dayStart = startOfDayInTz(dayDate, tz);
  const dayEnd = endOfDayInTz(dayDate, tz);
  const logs = await prisma.analyticsLog.findMany({
    where: { cameraId, timestamp: { gte: dayStart, lt: dayEnd } },
    orderBy: { timestamp: 'asc' },
    select: {
      timestamp: true,
      peopleIn: true, peopleOut: true, currentCount: true,
      demographics: true, queueCount: true, avgWaitTime: true,
    },
  });
  if (logs.length === 0) return;

  const stats = computeStats(logs);

  // SQLite treats NULL as distinct in unique indexes; can't rely on upsert for hour=null.
  // The `date` key is the branch-local midnight instant — same camera in different
  // branches would land on different keys, which is what we want.
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
  // Cameras can be in any timezone, so we widen the search window by ±14h
  // (the maximum IANA offset spread) and then let aggregateDayBucket apply
  // each camera's precise branch-local bounds.
  const broadStart = new Date(dayDate.getTime() - 14 * 60 * 60 * 1000);
  const broadEnd = new Date(dayDate.getTime() + 38 * 60 * 60 * 1000);
  const cameras = await listCamerasWithLogsIn(broadStart, broadEnd);
  let done = 0;
  for (const cameraId of cameras) {
    try {
      await aggregateDayBucket(cameraId, dayDate);
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
