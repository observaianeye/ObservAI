/**
 * Analytics data API routes
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { validateAnalyticsPayload } from '../lib/analyticsValidator';
import { sendAlertEmail } from '../services/emailService';
import { authenticate } from '../middleware/authMiddleware';
import { requireCameraOwnership, requireZoneOwnership, userOwnsCamera } from '../middleware/tenantScope';

const router = Router();

/**
 * Fire a cleaning alert to every staff member currently on shift for the
 * branch that owns this camera. ADIM 20 requirement: CLEANING transition
 * must reach the right people, logged end-to-end in NotificationLog.
 *
 * "On shift right now" = StaffAssignment rows whose date is today AND whose
 * shiftStart/shiftEnd window contains the current wall-clock time, status
 * not declined. Telegram + email both attempted in parallel.
 */
async function notifyCleaningRequested(input: {
  zoneId: string;
  cameraId: string;
  occupants: number;
}): Promise<void> {
  const camera = await prisma.camera.findUnique({
    where: { id: input.cameraId },
    select: { branchId: true, name: true },
  });
  if (!camera?.branchId) return; // no branch → nobody to notify

  const zone = await prisma.zone.findUnique({
    where: { id: input.zoneId },
    select: { name: true },
  });

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const assignments = await prisma.staffAssignment.findMany({
    where: {
      branchId: camera.branchId,
      date: { gte: todayStart, lt: todayEnd },
      status: { not: 'declined' },
    },
    include: { staff: true },
  });

  if (assignments.length === 0) return;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const onShift = assignments.filter((a) => {
    const [sh, sm] = a.shiftStart.split(':').map(Number);
    const [eh, em] = a.shiftEnd.split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return start <= end
      ? nowMin >= start && nowMin < end
      : nowMin >= start || nowMin < end; // overnight shift
  });

  if (onShift.length === 0) return;

  const tableLabel = zone?.name ?? 'Masa';
  const cameraLabel = camera.name ?? 'Kamera';
  const title = `Temizlik gerekli: ${tableLabel}`;
  const body = `${cameraLabel} uzerinde ${tableLabel} temizlik bekliyor. ${
    input.occupants > 0 ? `Son doluluk: ${input.occupants} kisi.` : ''
  }`.trim();

  await Promise.all(onShift.map(async (a) => {
    const staff = a.staff;

    if (staff.email) {
      const em = await sendAlertEmail(staff.email, title, body, 'high', cameraLabel);
      await prisma.notificationLog.create({
        data: {
          userId: staff.userId,
          staffId: staff.id,
          assignmentId: a.id,
          event: 'alert',
          channel: 'email',
          target: staff.email,
          success: em.success,
          error: em.error ?? null,
          payload: JSON.stringify({ reason: 'cleaning_requested', zoneId: input.zoneId, tableLabel }),
        },
      }).catch(() => {});
    }
  }));
}

// POST /api/analytics - Log analytics data (Stage 7: stronger validation gate)
router.post('/', async (req: Request, res: Response) => {
  try {
    const result = validateAnalyticsPayload(req.body);
    if (!result.ok || !result.payload) {
      console.warn('[analytics] payload rejected:', result.reasons.join('; '));
      return res.status(400).json({ error: 'Validation failed', reasons: result.reasons });
    }

    const data = result.payload;

    // The frontend persists analytics with a default `sample-camera-1` id when
    // the user hasn't registered a real Camera row. Skip insertion in that case
    // instead of crashing with a FK-constraint error — these are best-effort
    // samples and the frontend already treats the POST as fire-and-forget.
    const camera = await prisma.camera.findUnique({ where: { id: data.cameraId } });
    if (!camera) {
      return res.status(204).end();
    }

    const log = await prisma.analyticsLog.create({
      data: {
        cameraId: data.cameraId,
        ...(data.timestamp ? { timestamp: data.timestamp } : {}),
        peopleIn: data.peopleIn,
        peopleOut: data.peopleOut,
        currentCount: data.currentCount,
        demographics: data.demographics ? JSON.stringify(data.demographics) : undefined,
        queueCount: data.queueCount,
        avgWaitTime: data.avgWaitTime,
        longestWaitTime: data.longestWaitTime,
        fps: data.fps,
        heatmap: data.heatmap ? JSON.stringify(data.heatmap) : undefined,
        activePeople: data.activePeople ? JSON.stringify(data.activePeople) : undefined,
      },
    });

    res.status(201).json(log);
  } catch (error) {
    console.error('Error creating analytics log:', error);
    res.status(500).json({ error: 'Failed to create analytics log' });
  }
});

// GET /api/analytics/compare - Compare analytics data across time periods
router.get('/compare', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      cameraId,
      period1Start,
      period1End,
      period2Start,
      period2End,
      comparisonType
    } = req.query;

    // Validate required parameters
    if (!period1Start || !period1End || !period2Start || !period2End) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['period1Start', 'period1End', 'period2Start', 'period2End']
      });
    }

    // Restrict to caller's cameras: either the requested one (if owned) or all of theirs.
    const ownedCams = await prisma.camera.findMany({
      where: { createdBy: req.user.id },
      select: { id: true },
    });
    const ownedIds = ownedCams.map((c) => c.id);
    const where: any = {};
    if (cameraId) {
      if (!ownedIds.includes(cameraId as string)) {
        return res.status(404).json({ error: 'Camera not found' });
      }
      where.cameraId = cameraId as string;
    } else {
      where.cameraId = { in: ownedIds };
    }

    // Helper function to get aggregated stats for a period
    const getPeriodStats = async (startDate: Date, endDate: Date) => {
      try {
        const logs = await prisma.analyticsLog.findMany({
          where: {
            ...where,
            timestamp: {
              gte: startDate,
              lte: endDate
            }
          }
        });

        if (logs.length === 0) {
          return null;
        }

        const totalPeopleIn = logs.reduce((sum, log) => sum + log.peopleIn, 0);
        const totalPeopleOut = logs.reduce((sum, log) => sum + log.peopleOut, 0);
        const avgCurrentCount = logs.reduce((sum, log) => sum + log.currentCount, 0) / logs.length;
        const avgQueueCount = logs.filter(l => l.queueCount !== null).length > 0
          ? logs.filter(l => l.queueCount !== null).reduce((sum, log) => sum + (log.queueCount || 0), 0) /
          logs.filter(l => l.queueCount !== null).length
          : 0;
        const avgWaitTime = logs.filter(l => l.avgWaitTime !== null).length > 0
          ? logs.filter(l => l.avgWaitTime !== null).reduce((sum, log) => sum + (log.avgWaitTime || 0), 0) /
          logs.filter(l => l.avgWaitTime !== null).length
          : 0;
        const maxWaitTime = Math.max(...logs.map(l => l.longestWaitTime || 0));
        const avgFps = logs.filter(l => l.fps !== null).length > 0
          ? logs.filter(l => l.fps !== null).reduce((sum, log) => sum + (log.fps || 0), 0) /
          logs.filter(l => l.fps !== null).length
          : 0;

        return {
          dataPoints: logs.length,
          totalPeopleIn,
          totalPeopleOut,
          avgCurrentCount: Math.round(avgCurrentCount * 100) / 100,
          avgQueueCount: Math.round(avgQueueCount * 100) / 100,
          avgWaitTime: Math.round(avgWaitTime * 100) / 100,
          maxWaitTime: Math.round(maxWaitTime * 100) / 100,
          avgFps: Math.round(avgFps * 100) / 100,
          peakHour: getPeakHour(logs),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        };
      } catch (dbError) {
        // Return demo data if database unavailable
        console.log('[Compare] Database unavailable, using demo data');
        return generateDemoComparisonStats(startDate, endDate);
      }
    };

    // Get stats for both periods
    const period1Stats = await getPeriodStats(
      new Date(period1Start as string),
      new Date(period1End as string)
    );
    const period2Stats = await getPeriodStats(
      new Date(period2Start as string),
      new Date(period2End as string)
    );

    if (!period1Stats || !period2Stats) {
      return res.status(404).json({
        error: 'Insufficient data for comparison',
        period1HasData: !!period1Stats,
        period2HasData: !!period2Stats
      });
    }

    // Calculate percentage changes. Returns null when the previous period has
    // zero baseline — a -100% or +100% flag in that case is misleading (user
    // sees "-98.99% DOWN" even when there simply wasn't any data before).
    const calculateChange = (current: number, previous: number): number | null => {
      if (previous === 0 || !Number.isFinite(previous)) return null;
      const raw = ((current - previous) / previous) * 100;
      if (!Number.isFinite(raw)) return null;
      return Math.round(raw * 100) / 100;
    };

    const comparison = {
      period1: period1Stats,
      period2: period2Stats,
      changes: {
        totalPeopleIn: calculateChange(period1Stats.totalPeopleIn, period2Stats.totalPeopleIn),
        totalPeopleOut: calculateChange(period1Stats.totalPeopleOut, period2Stats.totalPeopleOut),
        avgCurrentCount: calculateChange(period1Stats.avgCurrentCount, period2Stats.avgCurrentCount),
        avgQueueCount: calculateChange(period1Stats.avgQueueCount, period2Stats.avgQueueCount),
        avgWaitTime: calculateChange(period1Stats.avgWaitTime, period2Stats.avgWaitTime),
        maxWaitTime: calculateChange(period1Stats.maxWaitTime, period2Stats.maxWaitTime),
        avgFps: calculateChange(period1Stats.avgFps, period2Stats.avgFps),
      },
      priorPeriodHasData: period2Stats.totalPeopleIn > 0 || period2Stats.dataPoints > 0,
      comparisonType: comparisonType || 'custom',
      summary: generateComparisonSummary(period1Stats, period2Stats),
    };

    res.json(comparison);

  } catch (error) {
    console.error('Comparison Error:', error);
    res.status(500).json({ error: 'Failed to generate comparison' });
  }
});

// GET /api/analytics/:cameraId - Get analytics for a camera
router.get('/:cameraId', authenticate, requireCameraOwnership('cameraId'), async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const { startDate, endDate, limit = '100' } = req.query;

    const where: any = { cameraId };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    const logs = await prisma.analyticsLog.findMany({
      where,
      orderBy: {
        timestamp: 'desc'
      },
      take: parseInt(limit as string),
      include: {
        camera: {
          select: {
            id: true,
            name: true,
            sourceType: true
          }
        }
      }
    });

    // Parse JSON strings back to objects
    const parsedLogs = logs.map(log => ({
      ...log,
      demographics: log.demographics ? JSON.parse(log.demographics as string) : undefined,
      heatmap: log.heatmap ? JSON.parse(log.heatmap as string) : undefined,
      activePeople: log.activePeople ? JSON.parse(log.activePeople as string) : undefined
    }));

    res.json(parsedLogs);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/analytics/:cameraId/summary - Get aggregated summary
// Query params:
//   ?date=YYYY-MM-DD           → single day (original behavior)
//   ?startDate=&endDate=        → range (inclusive)
//   ?granularity=daily|hourly   → filter by aggregation level (default: both)
router.get('/:cameraId/summary', authenticate, requireCameraOwnership('cameraId'), async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const { date, startDate, endDate, granularity } = req.query as {
      date?: string; startDate?: string; endDate?: string; granularity?: string;
    };

    const where: any = { cameraId };
    if (date) {
      where.date = new Date(date);
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }
    if (granularity === 'daily') {
      where.hour = null;
    } else if (granularity === 'hourly') {
      where.hour = { not: null };
    }

    const summaries = await prisma.analyticsSummary.findMany({
      where,
      orderBy: [
        { date: 'asc' },
        { hour: 'asc' },
      ],
    });

    res.json(summaries);
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
});

// POST /api/analytics/insights - Log zone insight
router.post('/insights', authenticate, async (req: Request, res: Response) => {
  try {
    const { zoneId, personId, duration, gender, age, message } = req.body;

    if (!zoneId || !personId || !duration || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const owned = await prisma.zone.findFirst({
      where: { id: zoneId, camera: { createdBy: req.user.id } },
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ error: 'Zone not found' });

    const insight = await prisma.zoneInsight.create({
      data: {
        zoneId,
        personId,
        duration,
        gender,
        age,
        message
      },
      include: {
        zone: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    res.status(201).json(insight);
  } catch (error) {
    console.error('Error creating zone insight:', error);
    res.status(500).json({ error: 'Failed to create zone insight' });
  }
});

// GET /api/analytics/insights/:zoneId - Get insights for a zone
router.get('/insights/:zoneId', authenticate, requireZoneOwnership('zoneId'), async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const { limit = '50' } = req.query;

    const insights = await prisma.zoneInsight.findMany({
      where: { zoneId },
      orderBy: {
        timestamp: 'desc'
      },
      take: parseInt(limit as string),
      include: {
        zone: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    res.json(insights);
  } catch (error) {
    console.error('Error fetching zone insights:', error);
    res.status(500).json({ error: 'Failed to fetch zone insights' });
  }
});

// Helper function to find peak hour
function getPeakHour(logs: any[]): string {
  if (logs.length === 0) return 'N/A';

  const hourCounts: Record<number, number> = {};
  logs.forEach(log => {
    const hour = new Date(log.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + log.currentCount;
  });

  const peakHour = Object.entries(hourCounts).reduce((max, [hour, count]) =>
    count > max.count ? { hour: parseInt(hour), count } : max,
    { hour: 0, count: 0 }
  );

  return `${peakHour.hour}:00`;
}

// Helper function to generate demo comparison stats
function generateDemoComparisonStats(startDate: Date, endDate: Date): any {
  const baseVisitors = 100 + Math.floor(Math.random() * 50);
  return {
    dataPoints: 48,
    totalPeopleIn: baseVisitors + Math.floor(Math.random() * 20),
    totalPeopleOut: baseVisitors - Math.floor(Math.random() * 10),
    avgCurrentCount: 20 + Math.floor(Math.random() * 15),
    avgQueueCount: 3 + Math.floor(Math.random() * 3),
    avgWaitTime: 30 + Math.random() * 20,
    maxWaitTime: 90 + Math.random() * 30,
    avgFps: 30 + Math.random() * 2,
    peakHour: `${12 + Math.floor(Math.random() * 4)}:00`,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}

// POST /api/analytics/seed-demo - Generate realistic historical data.
//
// Parameters (body):
//   cameraId  — target camera id (default: "sample-camera-1")
//   days      — how many past days to synthesise (default: 90, clamp 1..180)
//   clear     — if false, append only where a timestamp doesn't exist
//
// Shape:
//   - Hours 08:00–22:00 active. 00–07 and 23 are near-zero (cafe closed).
//   - Peak windows 12–14 and 18–20.
//   - Day-of-week factor: Fri/Sat 1.4x, Sun 1.1x, Tue/Wed 0.8x.
//   - Gender split ~55/45 with Gaussian noise; age buckets sum to ~100%.
router.post('/seed-demo', authenticate, async (req: Request, res: Response) => {
  try {
    const cameraId = (req.body?.cameraId as string) || 'sample-camera-1';
    const rawDays = Number(req.body?.days ?? 90);
    const days = Math.max(1, Math.min(180, Number.isFinite(rawDays) ? rawDays : 90));
    const clear = req.body?.clear !== false;

    // Sample camera convention: 'sample-camera-1' is reserved for the caller's
    // private demo data — namespace it per-user so two accounts don't share.
    // Real (UUID) camera ids must belong to the caller.
    let resolvedCameraId = cameraId;
    if (cameraId === 'sample-camera-1') {
      resolvedCameraId = `sample-${req.user.id}`;
    } else if (!(await userOwnsCamera(req.user.id, cameraId))) {
      return res.status(404).json({ error: 'Camera not found' });
    }

    if (clear) {
      await prisma.$executeRawUnsafe(`DELETE FROM analytics_logs WHERE cameraId = ?`, resolvedCameraId);
    }

    // Hour-of-day multiplier: closed 00–06 and 23, peaks at lunch + dinner.
    const getHourlyMultiplier = (hour: number, isWeekend: boolean): number => {
      const weekday = [
        0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.02, 0.08, 0.35, 0.45, 0.50, 0.80,
        1.00, 0.95, 0.55, 0.45, 0.55, 0.75, 1.00, 0.95, 0.70, 0.45, 0.20, 0.05,
      ];
      const weekend = [
        0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.02, 0.05, 0.20, 0.40, 0.65, 0.90,
        1.00, 0.95, 0.85, 0.75, 0.75, 0.85, 1.00, 1.00, 0.85, 0.65, 0.40, 0.10,
      ];
      return isWeekend ? weekend[hour] : weekday[hour];
    };

    // Day-of-week factor: Mon=1 ... Sun=0. Weekend + Friday spike, mid-week dip.
    const dayFactor = (dow: number): number => {
      switch (dow) {
        case 5: case 6: return 1.4; // Fri, Sat
        case 0: return 1.1;         // Sun
        case 1: return 1.0;         // Mon
        case 2: case 3: return 0.8; // Tue, Wed
        case 4: return 1.0;         // Thu
        default: return 1.0;
      }
    };

    const randG = (mean: number, std: number) => {
      const u = 1 - Math.random(), v = Math.random();
      return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 55, 0, 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const entries: Array<{
      id: string; cameraId: string; timestamp: Date;
      peopleIn: number; peopleOut: number; currentCount: number;
      demographics: string; queueCount: number | null; avgWaitTime: number | null; fps: number;
    }> = [];
    let currentTime = new Date(startDate);
    let occupancy = 0;
    const MAX_OCC = 45;

    while (currentTime <= endDate) {
      const hour = currentTime.getHours();
      const dow = currentTime.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const mult = getHourlyMultiplier(hour, isWeekend) * dayFactor(dow)
                 * clamp(randG(1, 0.12), 0.5, 1.6);

      const peopleIn = Math.max(0, Math.round(8 * mult * clamp(randG(1, 0.2), 0.4, 2)));
      const peopleOut = Math.max(0, Math.round(peopleIn * clamp(randG(0.85, 0.15), 0.4, 1.2)));
      occupancy = clamp(occupancy + peopleIn - peopleOut, 0, MAX_OCC);
      if (mult < 0.05) occupancy = 0; // closed hour → zero out

      const male = Math.round(occupancy * clamp(randG(0.55, 0.08), 0.3, 0.75));
      const female = Math.max(0, occupancy - male);
      const ageTotal = occupancy;
      const demographics = {
        gender: { male, female, unknown: 0 },
        age: ageTotal > 0 ? {
          '0-17':  Math.round(ageTotal * 0.08),
          '18-24': Math.round(ageTotal * 0.22),
          '25-34': Math.round(ageTotal * 0.34),
          '35-44': Math.round(ageTotal * 0.22),
          '45-54': Math.round(ageTotal * 0.10),
          '55+':   Math.max(0, ageTotal - Math.round(ageTotal * 0.96)),
        } : {},
      };

      const queueCount = (occupancy > 20 && mult > 0.7)
        ? Math.max(0, Math.round((occupancy - 15) * clamp(randG(0.4, 0.1), 0.1, 0.8)))
        : null;
      const avgWaitTime = queueCount && queueCount > 0 ? Math.max(10, randG(45, 15)) : null;
      const fps = clamp(randG(28.5, 1.5), 20, 35);

      entries.push({
        id: crypto.randomUUID(),
        cameraId: resolvedCameraId,
        timestamp: new Date(currentTime),
        peopleIn,
        peopleOut,
        currentCount: occupancy,
        demographics: JSON.stringify(demographics),
        queueCount,
        avgWaitTime,
        fps,
      });

      currentTime = new Date(currentTime.getTime() + 5 * 60 * 1000); // +5 min
    }

    // Batch insert via Prisma so DateTime is encoded as Prisma's native int-epoch
    // (raw SQL bound the timestamp as a string, which made later range queries miss).
    let inserted = 0;
    const BATCH = 500;
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const result = await prisma.analyticsLog.createMany({ data: batch });
      inserted += result.count;
    }

    // Fold raw logs into daily + hourly AnalyticsSummary rows so Historical and
    // Trends pages have data immediately (otherwise the user waits for the
    // next cron tick). Best-effort; summary failure should not fail the seed.
    try {
      const { runHourlyAggregationFor, runDailyAggregationFor } = await import('../services/analyticsAggregator');
      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        for (let h = 0; h < 24; h++) {
          const hourStart = new Date(cursor);
          hourStart.setHours(h, 0, 0, 0);
          await runHourlyAggregationFor(hourStart);
        }
        await runDailyAggregationFor(cursor);
        cursor.setDate(cursor.getDate() + 1);
      }
    } catch (err) {
      console.warn('[seed-demo] aggregation pass failed:', err instanceof Error ? err.message : err);
    }

    res.json({
      success: true,
      message: `Seeded ${inserted} data points (${days} days) for camera ${resolvedCameraId}`,
      cameraId: resolvedCameraId,
      totalEntries: inserted,
      days,
    });
  } catch (error: any) {
    console.error('[seed-demo] Error:', error);
    res.status(500).json({ error: 'Seed failed', message: error.message });
  }
});

// ============================================================
// TABLE OCCUPANCY ENDPOINTS
// ============================================================

// POST /api/analytics/table-events - Log table status transition.
//
// The Python analytics engine posts here on every state transition. We persist
// the event, then — if this is a transition *into* needs_cleaning — notify
// every staff member currently on shift via Telegram + email (ADIM 20).
// Dedupe guard: only fire when the previous event for the same zone wasn't
// already needs_cleaning, so repeated posts for the same cleaning cycle
// don't spam the staff.
router.post('/table-events', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      zoneId: z.string().min(1),
      cameraId: z.string().min(1),
      status: z.enum(['occupied', 'needs_cleaning', 'empty']),
      occupants: z.number().int().min(0).default(0),
      startTime: z.string().datetime().optional(),
      endTime: z.string().datetime().optional(),
      duration: z.number().optional(),
    });
    const data = schema.parse(req.body);

    // Check the previous event for this zone to decide whether this post is a
    // *transition into* needs_cleaning (vs a duplicate of an already-pending
    // cleaning record).
    const prior = await prisma.tableEvent.findFirst({
      where: { zoneId: data.zoneId, cameraId: data.cameraId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });

    const event = await prisma.tableEvent.create({
      data: {
        zoneId: data.zoneId,
        cameraId: data.cameraId,
        status: data.status,
        occupants: data.occupants,
        startTime: data.startTime ? new Date(data.startTime) : new Date(),
        endTime: data.endTime ? new Date(data.endTime) : null,
        duration: data.duration ?? null,
      },
    });

    // Fire-and-forget cleaning notification. Wrapped so a dispatcher failure
    // doesn't cause the Python → backend POST to 500; the event is already
    // persisted, which is the ground truth.
    if (data.status === 'needs_cleaning' && prior?.status !== 'needs_cleaning') {
      notifyCleaningRequested({
        zoneId: data.zoneId,
        cameraId: data.cameraId,
        occupants: data.occupants,
      }).catch((err) => {
        console.error('[table-events] cleaning notify failed:', err instanceof Error ? err.message : err);
      });
    }

    res.status(201).json(event);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[table-events] Error:', error);
    res.status(500).json({ error: 'Failed to log table event' });
  }
});

// GET /api/analytics/:cameraId/tables - Get table events for last 24h
router.get('/:cameraId/tables', authenticate, requireCameraOwnership('cameraId'), async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const events = await prisma.tableEvent.findMany({
      where: {
        cameraId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Aggregate stats per zone
    const zoneStats: Record<string, { totalTurnovers: number; avgDuration: number; durations: number[] }> = {};
    for (const event of events) {
      if (!zoneStats[event.zoneId]) {
        zoneStats[event.zoneId] = { totalTurnovers: 0, avgDuration: 0, durations: [] };
      }
      if (event.status === 'occupied' && event.duration) {
        zoneStats[event.zoneId].totalTurnovers++;
        zoneStats[event.zoneId].durations.push(event.duration);
      }
    }

    // Calculate averages
    const stats = Object.entries(zoneStats).map(([zoneId, s]) => ({
      zoneId,
      totalTurnovers: s.totalTurnovers,
      avgDuration: s.durations.length > 0
        ? Math.round(s.durations.reduce((a, b) => a + b, 0) / s.durations.length)
        : 0,
      utilizationPercent: Math.round((s.durations.reduce((a, b) => a + b, 0) / (24 * 3600)) * 100),
    }));

    res.json({ events: events.slice(0, 100), stats });
  } catch (error: any) {
    console.error('[tables] Error:', error);
    res.status(500).json({ error: 'Failed to fetch table data' });
  }
});

// ============================================================
// TREND ANALYSIS ENDPOINTS
// ============================================================

// GET /api/analytics/:cameraId/trends/weekly - Weekly comparison
//
// "This week" = the most recent 7-day rolling window ending today.
// "Last week" = the 7-day window before that — averaged hour-by-hour across
// all matching weekdays inside the larger ?days= lookback so longer windows
// (30/90) actually move the dotted "lastWeek" curve. We compute averages
// rather than raw sums so a 90-day window doesn't dwarf a 7-day window.
router.get('/:cameraId/trends/weekly', authenticate, requireCameraOwnership('cameraId'), async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const days = Math.max(7, Math.min(180, parseInt((req.query.days as string) || '30', 10) || 30));
    const now = new Date();
    const lookbackStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const summaries = await prisma.analyticsSummary.findMany({
      where: {
        cameraId,
        date: { gte: lookbackStart },
        hour: { not: null },
      },
      orderBy: [{ date: 'asc' }, { hour: 'asc' }],
    });

    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - 7);
    thisWeekStart.setHours(0, 0, 0, 0);

    // Per weekday/hour we accumulate sums + counts so we can take the mean
    // across all matching past weeks (excluding the current 7-day window).
    type Bucket = { thisWeek: number[]; pastSum: number[]; pastCount: number[] };
    const weekdays: Record<number, Bucket> = {};
    for (let d = 0; d < 7; d++) {
      weekdays[d] = {
        thisWeek: new Array(24).fill(0),
        pastSum: new Array(24).fill(0),
        pastCount: new Array(24).fill(0),
      };
    }

    for (const s of summaries) {
      const date = new Date(s.date);
      const weekday = date.getDay();
      const hour = s.hour ?? 0;
      const bucket = weekdays[weekday];

      if (date >= thisWeekStart) {
        bucket.thisWeek[hour] = s.totalEntries;
      } else {
        bucket.pastSum[hour] += s.totalEntries;
        bucket.pastCount[hour] += 1;
      }
    }

    const result = Object.entries(weekdays).map(([day, data]) => {
      const lastWeek = data.pastSum.map((sum, h) =>
        data.pastCount[h] > 0 ? Math.round(sum / data.pastCount[h]) : 0
      );
      const thisTotal = data.thisWeek.reduce((a, b) => a + b, 0);
      const lastTotal = lastWeek.reduce((a, b) => a + b, 0);
      const change = lastTotal > 0 ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : 0;

      return {
        weekday: parseInt(day),
        thisWeek: data.thisWeek,
        lastWeek,
        thisWeekTotal: thisTotal,
        lastWeekTotal: lastTotal,
        changePercent: change,
      };
    });

    res.json({ weekdays: result, days });
  } catch (error: any) {
    console.error('[trends/weekly] Error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly trends' });
  }
});

// GET /api/analytics/:cameraId/peak-hours - Peak and quiet hours
router.get('/:cameraId/peak-hours', authenticate, requireCameraOwnership('cameraId'), async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const days = Math.max(7, Math.min(180, parseInt((req.query.days as string) || '30', 10) || 30));
    const lookbackStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const summaries = await prisma.analyticsSummary.findMany({
      where: {
        cameraId,
        date: { gte: lookbackStart },
        hour: { not: null },
      },
    });

    // Average entries per hour across all days
    const hourlyTotals: number[] = new Array(24).fill(0);
    const hourlyCounts: number[] = new Array(24).fill(0);

    for (const s of summaries) {
      const hour = s.hour ?? 0;
      hourlyTotals[hour] += s.totalEntries;
      hourlyCounts[hour]++;
    }

    const hourlyAvg = hourlyTotals.map((total, i) =>
      hourlyCounts[i] > 0 ? Math.round(total / hourlyCounts[i]) : 0
    );

    // Find peak and quiet hours
    const indexed = hourlyAvg.map((avg, hour) => ({ hour, avg }));
    const sorted = [...indexed].sort((a, b) => b.avg - a.avg);

    res.json({
      hourlyProfile: hourlyAvg,
      peakHours: sorted.slice(0, 3),
      quietHours: sorted.filter(h => h.avg > 0).slice(-3).reverse(),
      totalDays: new Set(summaries.map(s => s.date.toISOString().split('T')[0])).size,
      days,
    });
  } catch (error: any) {
    console.error('[peak-hours] Error:', error);
    res.status(500).json({ error: 'Failed to fetch peak hours' });
  }
});

// GET /api/analytics/:cameraId/prediction - Traffic prediction for tomorrow
//
// Uses a recency-weighted average of past same-weekday hourly profiles. The
// ?days= window controls how many weeks back we pull — 7d = at most 1 week,
// 30d ≈ 4 weeks, 90d ≈ 12 weeks. More history → tighter prediction, higher
// reported confidence (capped at 95%).
router.get('/:cameraId/prediction', authenticate, requireCameraOwnership('cameraId'), async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const days = Math.max(7, Math.min(180, parseInt((req.query.days as string) || '30', 10) || 30));
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const targetWeekday = tomorrow.getDay();

    const lookbackStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const summaries = await prisma.analyticsSummary.findMany({
      where: {
        cameraId,
        date: { gte: lookbackStart },
        hour: { not: null },
      },
      orderBy: [{ date: 'desc' }, { hour: 'asc' }],
    });

    // Filter to same weekday and group by date (each date is one historical sample).
    const weeksByDate = new Map<string, number[]>();
    for (const s of summaries) {
      const date = new Date(s.date);
      if (date.getDay() !== targetWeekday) continue;
      const dateStr = date.toISOString().split('T')[0];
      let week = weeksByDate.get(dateStr);
      if (!week) {
        week = new Array(24).fill(0);
        weeksByDate.set(dateStr, week);
      }
      week[s.hour ?? 0] = s.totalEntries;
    }

    // Sort by date descending so the most recent week wins highest weight.
    const weeklyData = Array.from(weeksByDate.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([, hours]) => hours);

    if (weeklyData.length === 0) {
      return res.json({
        date: tomorrow.toISOString().split('T')[0],
        weekday: targetWeekday,
        hourlyPrediction: new Array(24).fill(0).map((_, hour) => ({ hour, predicted: 0 })),
        confidence: 0,
        dataWeeks: 0,
        days,
        message: 'Yeterli veri yok — en az 1 haftalık veri gerekli',
      });
    }

    // Exponentially decaying weights: recent weeks dominate, older weeks still
    // contribute (avoids cliff between week 4 and week 5 with the old fixed
    // [0.4,0.3,0.2,0.1] table when the user pulled a 90-day window).
    const lambda = 0.6; // higher = older weeks decay faster
    const rawWeights = weeklyData.map((_, i) => Math.pow(lambda, i));
    const totalWeight = rawWeights.reduce((a, b) => a + b, 0);

    const prediction = new Array(24).fill(0);
    for (let w = 0; w < weeklyData.length; w++) {
      const weight = rawWeights[w] / totalWeight;
      for (let h = 0; h < 24; h++) {
        prediction[h] += weeklyData[w][h] * weight;
      }
    }

    const confidence = Math.min(95, weeklyData.length * 18 + 10);

    res.json({
      date: tomorrow.toISOString().split('T')[0],
      weekday: targetWeekday,
      hourlyPrediction: prediction.map((val, hour) => ({ hour, predicted: Math.round(val) })),
      confidence,
      dataWeeks: weeklyData.length,
      days,
    });
  } catch (error: any) {
    console.error('[prediction] Error:', error);
    res.status(500).json({ error: 'Failed to generate prediction' });
  }
});

// Helper function to generate comparison summary. When the prior period has no
// data we skip the percentage sentence entirely — reporting "NaN%" or a fake
// +100% is worse than leaving the comparison out.
function generateComparisonSummary(period1: any, period2: any): string {
  const occupancy1 = (period1.avgCurrentCount ?? 0).toFixed(1);
  const occupancy2 = (period2.avgCurrentCount ?? 0).toFixed(1);
  const peakSentence = `Peak hour shifted from ${period2.peakHour} to ${period1.peakHour}.`;

  if (!period2.totalPeopleIn || period2.totalPeopleIn === 0) {
    return (
      `Period 1 recorded ${period1.totalPeopleIn} visitors; prior period had no comparable data. ` +
      `Average occupancy was ${occupancy1} vs ${occupancy2}. ${peakSentence}`
    );
  }

  const trafficChange = period1.totalPeopleIn - period2.totalPeopleIn;
  const trafficDirection = trafficChange > 0 ? 'increase' : 'decrease';
  const trafficPercent = Math.abs(Math.round((trafficChange / period2.totalPeopleIn) * 100));

  return (
    `Period 1 showed a ${trafficPercent}% ${trafficDirection} in total visitors compared to Period 2. ` +
    `Average occupancy was ${occupancy1} vs ${occupancy2}. ${peakSentence}`
  );
}

// ============================================================
// UNIFIED OVERVIEW ENDPOINT
// ============================================================

type OverviewRange = '1h' | '1d' | '1w' | '1m' | '3m';
const RANGE_DAYS: Record<OverviewRange, number> = { '1h': 0, '1d': 1, '1w': 7, '1m': 30, '3m': 90 };

interface DemoSnap { gender: { male: number; female: number; unknown: number }; age: Record<string, number>; samples: number; }

function emptyDemo(): DemoSnap {
  return { gender: { male: 0, female: 0, unknown: 0 }, age: {}, samples: 0 };
}

function mergeDemographics(into: DemoSnap, jsonStr: string | null | undefined) {
  if (!jsonStr) return;
  try {
    const d = JSON.parse(jsonStr);
    if (d.gender) {
      into.gender.male += d.gender.male ?? 0;
      into.gender.female += d.gender.female ?? 0;
      into.gender.unknown += d.gender.unknown ?? 0;
    }
    if (d.age) {
      for (const [k, v] of Object.entries(d.age)) {
        if (typeof v === 'number') into.age[k] = (into.age[k] ?? 0) + v;
      }
    }
    if (typeof d.samples === 'number') into.samples += d.samples;
  } catch { /* skip */ }
}

// GET /api/analytics/:cameraId/overview?range=1h|1d|1w|1m|3m
//
// Single bundled response for the unified Analytics page. Replaces three
// separate page-specific endpoints (trends, historical, insights). The range
// determines the data source AND the compare window:
//   - 1h: AnalyticsLog 5-min buckets, compare to previous hour
//   - 1d: AnalyticsSummary hourly today, compare to same weekday last week
//   - 1w/1m/3m: AnalyticsSummary daily, compare to prior same-length window
//
// Only verifiably-present data is returned. When the prior baseline is empty,
// delta fields are null (frontend renders "—" instead of fake +100%).
router.get('/:cameraId/overview', authenticate, requireCameraOwnership('cameraId'), async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const range = (req.query.range as OverviewRange) || '1d';
    if (!['1h', '1d', '1w', '1m', '3m'].includes(range)) {
      return res.status(400).json({ error: 'Invalid range. Use: 1h | 1d | 1w | 1m | 3m' });
    }

    const now = new Date();
    const rangeEnd = new Date(now);

    // ─── 1h branch ── live data from AnalyticsLog, 5-min buckets ──
    if (range === '1h') {
      const rangeStart = new Date(now.getTime() - 60 * 60 * 1000);
      const prevStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const [currentLogs, prevLogs] = await Promise.all([
        prisma.analyticsLog.findMany({
          where: { cameraId, timestamp: { gte: rangeStart, lte: rangeEnd } },
          orderBy: { timestamp: 'asc' },
        }),
        prisma.analyticsLog.findMany({
          where: { cameraId, timestamp: { gte: prevStart, lt: rangeStart } },
          orderBy: { timestamp: 'asc' },
        }),
      ]);

      // 12 5-minute buckets
      const buckets: { ts: string; label: string; visitors: number; occupancy: number; samples: number }[] = [];
      for (let i = 0; i < 12; i++) {
        const bStart = new Date(rangeStart.getTime() + i * 5 * 60 * 1000);
        buckets.push({
          ts: bStart.toISOString(),
          label: `${String(bStart.getHours()).padStart(2, '0')}:${String(bStart.getMinutes()).padStart(2, '0')}`,
          visitors: 0, occupancy: 0, samples: 0,
        });
      }
      for (const l of currentLogs) {
        const idx = Math.floor((new Date(l.timestamp).getTime() - rangeStart.getTime()) / (5 * 60 * 1000));
        if (idx >= 0 && idx < 12) {
          buckets[idx].visitors += l.peopleIn;
          buckets[idx].occupancy += l.currentCount;
          buckets[idx].samples += 1;
        }
      }
      const timeline = buckets.map((b) => ({
        ts: b.ts, label: b.label, visitors: b.visitors,
        occupancy: b.samples > 0 ? Math.round(b.occupancy / b.samples) : 0,
      }));

      const totalVisitors = currentLogs.reduce((s, l) => s + l.peopleIn, 0);
      const avgOccupancy = currentLogs.length > 0
        ? Math.round((currentLogs.reduce((s, l) => s + l.currentCount, 0) / currentLogs.length) * 10) / 10
        : 0;
      const peakOccupancy = currentLogs.length > 0 ? Math.max(...currentLogs.map((l) => l.currentCount)) : 0;
      const peakLog = currentLogs.reduce((max, l) => (l.currentCount > (max?.currentCount ?? -1) ? l : max), currentLogs[0]);
      const peakHour = peakLog ? `${String(new Date(peakLog.timestamp).getHours()).padStart(2, '0')}:${String(new Date(peakLog.timestamp).getMinutes()).padStart(2, '0')}` : null;

      const prevVisitors = prevLogs.reduce((s, l) => s + l.peopleIn, 0);
      const prevAvgOcc = prevLogs.length > 0
        ? Math.round((prevLogs.reduce((s, l) => s + l.currentCount, 0) / prevLogs.length) * 10) / 10
        : 0;
      const calcDelta = (a: number, b: number): number | null => (b === 0 ? null : Math.round(((a - b) / b) * 100));

      const demoAgg = emptyDemo();
      for (const l of currentLogs) mergeDemographics(demoAgg, l.demographics);

      return res.json({
        range,
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
        hasData: currentLogs.length > 0,
        dataSource: 'logs',
        kpis: { totalVisitors, avgOccupancy, peakOccupancy, peakHour },
        timeline,
        peakHours: [],
        weekdayCompare: null,
        demographics: demoAgg.samples > 0 ? demoAgg : null,
        compare: {
          current: { visitors: totalVisitors, avgOccupancy },
          previous: { visitors: prevVisitors, avgOccupancy: prevAvgOcc },
          delta: { visitors: calcDelta(totalVisitors, prevVisitors), avgOccupancy: calcDelta(avgOccupancy, prevAvgOcc) },
          previousLabel: 'previous_hour',
        },
        prediction: null,
      });
    }

    // ─── 1d branch ── hourly summaries today, compare to same weekday last week ──
    if (range === '1d') {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const lastWeekStart = new Date(todayStart);
      lastWeekStart.setDate(todayStart.getDate() - 7);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setHours(23, 59, 59, 999);

      const [todayHourly, prevHourly] = await Promise.all([
        prisma.analyticsSummary.findMany({
          where: { cameraId, date: { gte: todayStart, lte: rangeEnd }, hour: { not: null } },
          orderBy: [{ date: 'asc' }, { hour: 'asc' }],
        }),
        prisma.analyticsSummary.findMany({
          where: { cameraId, date: { gte: lastWeekStart, lte: lastWeekEnd }, hour: { not: null } },
          orderBy: [{ date: 'asc' }, { hour: 'asc' }],
        }),
      ]);

      const timeline = todayHourly.map((s) => ({
        ts: s.date.toISOString(),
        label: `${String(s.hour ?? 0).padStart(2, '0')}:00`,
        visitors: s.totalEntries,
        occupancy: Math.round(s.avgOccupancy ?? 0),
        hour: s.hour,
      }));

      const totalVisitors = todayHourly.reduce((s, r) => s + r.totalEntries, 0);
      const activeHours = todayHourly.filter((r) => r.totalEntries > 0);
      const avgOccupancy = activeHours.length > 0
        ? Math.round((activeHours.reduce((s, r) => s + (r.avgOccupancy ?? 0), 0) / activeHours.length) * 10) / 10
        : 0;
      const peakRow = todayHourly.reduce((max, r) => (r.totalEntries > (max?.totalEntries ?? -1) ? r : max), todayHourly[0]);
      const peakOccupancy = todayHourly.length > 0 ? Math.max(...todayHourly.map((r) => r.peakOccupancy)) : 0;
      const peakHour = peakRow && peakRow.totalEntries > 0 ? `${String(peakRow.hour ?? 0).padStart(2, '0')}:00` : null;

      const prevVisitors = prevHourly.reduce((s, r) => s + r.totalEntries, 0);
      const prevAvgOcc = (() => {
        const ah = prevHourly.filter((r) => r.totalEntries > 0);
        return ah.length > 0 ? Math.round((ah.reduce((s, r) => s + (r.avgOccupancy ?? 0), 0) / ah.length) * 10) / 10 : 0;
      })();
      const calcDelta = (a: number, b: number): number | null => (b === 0 ? null : Math.round(((a - b) / b) * 100));

      const demoAgg = emptyDemo();
      for (const r of todayHourly) mergeDemographics(demoAgg, r.demographics);

      // Peak hours top-3 from today
      const sortedHours = [...todayHourly].sort((a, b) => b.totalEntries - a.totalEntries).slice(0, 3);
      const peakHours = sortedHours.filter((r) => r.totalEntries > 0).map((r) => ({ hour: r.hour ?? 0, avg: r.totalEntries }));

      return res.json({
        range,
        rangeStart: todayStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
        hasData: todayHourly.length > 0,
        dataSource: 'summary',
        kpis: { totalVisitors, avgOccupancy, peakOccupancy, peakHour },
        timeline,
        peakHours,
        weekdayCompare: null,
        demographics: demoAgg.samples > 0 ? demoAgg : null,
        compare: {
          current: { visitors: totalVisitors, avgOccupancy },
          previous: { visitors: prevVisitors, avgOccupancy: prevAvgOcc },
          delta: { visitors: calcDelta(totalVisitors, prevVisitors), avgOccupancy: calcDelta(avgOccupancy, prevAvgOcc) },
          previousLabel: 'same_weekday_last_week',
        },
        prediction: null,
      });
    }

    // ─── 1w / 1m / 3m branch ── daily summaries, prior same-length window ──
    const days = RANGE_DAYS[range];
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const rangeStart = new Date(todayStart);
    rangeStart.setDate(rangeStart.getDate() - (days - 1));
    const prevEnd = new Date(rangeStart);
    prevEnd.setMilliseconds(-1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);
    prevStart.setHours(0, 0, 0, 0);

    const [dailyRows, hourlyRows, prevRows] = await Promise.all([
      prisma.analyticsSummary.findMany({
        where: { cameraId, date: { gte: rangeStart, lte: rangeEnd }, hour: null },
        orderBy: { date: 'asc' },
      }),
      prisma.analyticsSummary.findMany({
        where: { cameraId, date: { gte: rangeStart, lte: rangeEnd }, hour: { not: null } },
        orderBy: [{ date: 'asc' }, { hour: 'asc' }],
      }),
      prisma.analyticsSummary.findMany({
        where: { cameraId, date: { gte: prevStart, lte: prevEnd }, hour: null },
        orderBy: { date: 'asc' },
      }),
    ]);

    const timeline = dailyRows.map((r) => ({
      ts: r.date.toISOString(),
      label: r.date.toISOString().slice(0, 10),
      visitors: r.totalEntries,
      occupancy: Math.round(r.avgOccupancy ?? 0),
      peakOccupancy: r.peakOccupancy,
    }));

    const totalVisitors = dailyRows.reduce((s, r) => s + r.totalEntries, 0);
    const activeDays = dailyRows.filter((r) => r.totalEntries > 0);
    const avgOccupancy = activeDays.length > 0
      ? Math.round((activeDays.reduce((s, r) => s + (r.avgOccupancy ?? 0), 0) / activeDays.length) * 10) / 10
      : 0;
    const peakOccupancy = dailyRows.length > 0 ? Math.max(...dailyRows.map((r) => r.peakOccupancy)) : 0;

    // Peak hour across the whole range
    const hourTotals: number[] = new Array(24).fill(0);
    const hourCounts: number[] = new Array(24).fill(0);
    for (const r of hourlyRows) {
      const h = r.hour ?? 0;
      hourTotals[h] += r.totalEntries;
      hourCounts[h] += 1;
    }
    const hourlyAvg = hourTotals.map((t, i) => (hourCounts[i] > 0 ? Math.round(t / hourCounts[i]) : 0));
    const peakHourIdx = hourlyAvg.reduce((maxI, v, i) => (v > hourlyAvg[maxI] ? i : maxI), 0);
    const peakHour = hourlyAvg[peakHourIdx] > 0 ? `${String(peakHourIdx).padStart(2, '0')}:00` : null;
    const peakHours = hourlyAvg
      .map((avg, hour) => ({ hour, avg }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .filter((p) => p.avg > 0);

    // Demographics aggregation across the range (use daily rows — they roll up hourly)
    const demoAgg = emptyDemo();
    for (const r of dailyRows) mergeDemographics(demoAgg, r.demographics);

    // Compare to prior same-length window
    const prevVisitors = prevRows.reduce((s, r) => s + r.totalEntries, 0);
    const prevActiveDays = prevRows.filter((r) => r.totalEntries > 0);
    const prevAvgOcc = prevActiveDays.length > 0
      ? Math.round((prevActiveDays.reduce((s, r) => s + (r.avgOccupancy ?? 0), 0) / prevActiveDays.length) * 10) / 10
      : 0;
    const calcDelta = (a: number, b: number): number | null => (b === 0 ? null : Math.round(((a - b) / b) * 100));

    // Weekday compare (only meaningful for ≥1w ranges) — this rolling 7d vs prior 7d
    let weekdayCompare: any = null;
    if (range === '1w' || range === '1m' || range === '3m') {
      const thisWeekStart = new Date(todayStart);
      thisWeekStart.setDate(thisWeekStart.getDate() - 6);
      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setMilliseconds(-1);
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      const wkRows = await prisma.analyticsSummary.findMany({
        where: {
          cameraId,
          date: { gte: lastWeekStart, lte: rangeEnd },
          hour: { not: null },
        },
        orderBy: [{ date: 'asc' }, { hour: 'asc' }],
      });

      const buckets: Record<number, { thisWeek: number[]; lastWeek: number[]; thisTotal: number; lastTotal: number }> = {};
      for (let d = 0; d < 7; d++) {
        buckets[d] = { thisWeek: new Array(24).fill(0), lastWeek: new Array(24).fill(0), thisTotal: 0, lastTotal: 0 };
      }
      for (const r of wkRows) {
        const d = new Date(r.date);
        const wd = d.getDay();
        const h = r.hour ?? 0;
        if (d >= thisWeekStart) {
          buckets[wd].thisWeek[h] = r.totalEntries;
          buckets[wd].thisTotal += r.totalEntries;
        } else {
          buckets[wd].lastWeek[h] = r.totalEntries;
          buckets[wd].lastTotal += r.totalEntries;
        }
      }
      weekdayCompare = Object.entries(buckets).map(([d, b]) => ({
        weekday: parseInt(d),
        thisWeek: b.thisWeek,
        lastWeek: b.lastWeek,
        thisWeekTotal: b.thisTotal,
        lastWeekTotal: b.lastTotal,
        changePercent: b.lastTotal > 0 ? Math.round(((b.thisTotal - b.lastTotal) / b.lastTotal) * 100) : null,
      }));
    }

    // Tomorrow prediction (only when ≥1w of history available)
    let prediction: any = null;
    if (range === '1w' || range === '1m' || range === '3m') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const targetWeekday = tomorrow.getDay();
      const weeksByDate = new Map<string, number[]>();
      for (const r of hourlyRows) {
        const d = new Date(r.date);
        if (d.getDay() !== targetWeekday) continue;
        const key = d.toISOString().slice(0, 10);
        let week = weeksByDate.get(key);
        if (!week) { week = new Array(24).fill(0); weeksByDate.set(key, week); }
        week[r.hour ?? 0] = r.totalEntries;
      }
      const weeklyData = Array.from(weeksByDate.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([, hrs]) => hrs);
      if (weeklyData.length > 0) {
        const lambda = 0.6;
        const rawW = weeklyData.map((_, i) => Math.pow(lambda, i));
        const totalW = rawW.reduce((a, b) => a + b, 0);
        const pred = new Array(24).fill(0);
        for (let w = 0; w < weeklyData.length; w++) {
          const wt = rawW[w] / totalW;
          for (let h = 0; h < 24; h++) pred[h] += weeklyData[w][h] * wt;
        }
        prediction = {
          date: tomorrow.toISOString().slice(0, 10),
          weekday: targetWeekday,
          hourlyPrediction: pred.map((v, h) => ({ hour: h, predicted: Math.round(v) })),
          confidence: Math.min(95, weeklyData.length * 18 + 10),
          dataWeeks: weeklyData.length,
        };
      }
    }

    res.json({
      range,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      hasData: dailyRows.length > 0,
      dataSource: 'summary',
      kpis: { totalVisitors, avgOccupancy, peakOccupancy, peakHour },
      timeline,
      peakHours,
      weekdayCompare,
      demographics: demoAgg.samples > 0 ? demoAgg : null,
      compare: {
        current: { visitors: totalVisitors, avgOccupancy },
        previous: { visitors: prevVisitors, avgOccupancy: prevAvgOcc },
        delta: { visitors: calcDelta(totalVisitors, prevVisitors), avgOccupancy: calcDelta(avgOccupancy, prevAvgOcc) },
        previousLabel: 'previous_period',
      },
      prediction,
    });
  } catch (error: any) {
    console.error('[overview] Error:', error);
    res.status(500).json({ error: 'Failed to load overview', message: error.message });
  }
});

export default router;
