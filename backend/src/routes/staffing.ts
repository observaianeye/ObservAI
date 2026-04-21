/**
 * Staff shift management and optimization routes
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

const MIN_DAYS_FOR_RECOMMENDATIONS = 3;

/**
 * Resolve a branchId that may be a literal UUID, "default", or empty/unknown.
 * - "default" or unknown → user's isDefault branch, or first branch if none flagged
 * - UUID → verified to belong to user
 * Returns null when no usable branch exists.
 */
async function resolveBranchId(userId: string, raw: string | undefined): Promise<string | null> {
  if (raw && raw !== 'default') {
    const hit = await prisma.branch.findFirst({
      where: { id: raw, userId },
      select: { id: true },
    });
    if (hit) return hit.id;
  }
  const fallback = await prisma.branch.findFirst({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  return fallback?.id ?? null;
}

// POST /api/staffing - Save staff shifts (bulk)
router.post('/', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      branchId: z.string().min(1),
      date: z.string(), // ISO date string
      shifts: z.array(z.object({
        hour: z.number().int().min(0).max(23),
        staffCount: z.number().int().min(0),
      })),
      createdBy: z.string().min(1),
    });
    const data = schema.parse(req.body);
    const dateObj = new Date(data.date);
    dateObj.setHours(0, 0, 0, 0);

    // Upsert each hour
    const results = await Promise.all(
      data.shifts.map(shift =>
        prisma.staffShift.upsert({
          where: {
            branchId_date_hour: {
              branchId: data.branchId,
              date: dateObj,
              hour: shift.hour,
            },
          },
          update: { staffCount: shift.staffCount },
          create: {
            branchId: data.branchId,
            date: dateObj,
            hour: shift.hour,
            staffCount: shift.staffCount,
            createdBy: data.createdBy,
          },
        })
      )
    );

    res.json({ saved: results.length });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[staffing] Error:', error);
    res.status(500).json({ error: 'Failed to save shifts' });
  }
});

// GET /api/staffing/:branchId/current - Today's shifts
router.get('/:branchId/current', async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const shifts = await prisma.staffShift.findMany({
      where: { branchId, date: today },
      orderBy: { hour: 'asc' },
    });

    // Fill missing hours with 0
    const hourlyStaff = new Array(24).fill(0);
    for (const s of shifts) {
      hourlyStaff[s.hour] = s.staffCount;
    }

    res.json({ date: today.toISOString(), hourlyStaff, shifts });
  } catch (error: any) {
    console.error('[staffing/current] Error:', error);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// GET /api/staffing/:branchId/history - Last 30 days
router.get('/:branchId/history', async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const shifts = await prisma.staffShift.findMany({
      where: { branchId, date: { gte: thirtyDaysAgo } },
      orderBy: [{ date: 'desc' }, { hour: 'asc' }],
    });

    res.json({ shifts });
  } catch (error: any) {
    console.error('[staffing/history] Error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/staffing/:branchId/recommendations - Staff optimization
// cameraId is optional; when omitted (or "default") we aggregate across every
// camera in the branch. Returns `needsMoreData: true` when fewer than
// MIN_DAYS_FOR_RECOMMENDATIONS distinct days of analytics exist, so the UI
// can render a progress state instead of a confusing empty chart.
router.get('/:branchId/recommendations', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const rawBranchId = req.params.branchId;
    const rawCameraId = typeof req.query.cameraId === 'string' ? req.query.cameraId : undefined;

    const branchId = await resolveBranchId(userId, rawBranchId);
    if (!branchId) {
      return res.json({
        recommendations: [],
        summary: { understaffedHours: 0, overstaffedHours: 0, criticalHours: [] },
        needsMoreData: true,
        daysRemaining: MIN_DAYS_FOR_RECOMMENDATIONS,
        reason: 'no_branch',
      });
    }

    // Resolve camera scope — single camera or every camera in the branch.
    let cameraIdFilter: { in: string[] } | string | undefined;
    if (rawCameraId && rawCameraId !== 'default') {
      const hit = await prisma.camera.findFirst({
        where: { id: rawCameraId, branchId, createdBy: userId },
        select: { id: true },
      });
      if (hit) cameraIdFilter = hit.id;
    }
    if (!cameraIdFilter) {
      const cams = await prisma.camera.findMany({
        where: { branchId, createdBy: userId },
        select: { id: true },
      });
      if (cams.length === 0) {
        return res.json({
          recommendations: [],
          summary: { understaffedHours: 0, overstaffedHours: 0, criticalHours: [] },
          needsMoreData: true,
          daysRemaining: MIN_DAYS_FOR_RECOMMENDATIONS,
          reason: 'no_cameras',
        });
      }
      cameraIdFilter = { in: cams.map((c) => c.id) };
    }

    // Get today's shifts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const shifts = await prisma.staffShift.findMany({
      where: { branchId, date: today },
    });
    const staffByHour: Record<number, number> = {};
    for (const s of shifts) staffByHour[s.hour] = s.staffCount;

    // Get last 30 days hourly traffic summaries for the chosen camera scope.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const summaries = await prisma.analyticsSummary.findMany({
      where: {
        cameraId: cameraIdFilter,
        date: { gte: thirtyDaysAgo },
        hour: { not: null },
      },
    });

    // Count distinct calendar days — recommendations need at least 3 days.
    const distinctDays = new Set(summaries.map((s) => s.date.toISOString().slice(0, 10)));
    const daysCollected = distinctDays.size;

    if (daysCollected < MIN_DAYS_FOR_RECOMMENDATIONS) {
      return res.json({
        recommendations: [],
        summary: { understaffedHours: 0, overstaffedHours: 0, criticalHours: [] },
        needsMoreData: true,
        daysCollected,
        daysRemaining: MIN_DAYS_FOR_RECOMMENDATIONS - daysCollected,
        reason: daysCollected === 0 ? 'no_analytics' : 'insufficient_history',
      });
    }

    const hourlyTotals: number[] = new Array(24).fill(0);
    const hourlyCounts: number[] = new Array(24).fill(0);
    for (const s of summaries) {
      const h = s.hour ?? 0;
      hourlyTotals[h] += s.totalEntries;
      hourlyCounts[h]++;
    }

    const TARGET_RATIO = 10; // 10 customers per staff member
    const recommendations: Array<{
      hour: number;
      avgCustomers: number;
      staffCount: number;
      ratio: number;
      status: 'optimal' | 'understaffed' | 'overstaffed';
      optimal: number;
    }> = [];

    for (let h = 7; h <= 23; h++) {
      const avgCustomers = hourlyCounts[h] > 0 ? Math.round(hourlyTotals[h] / hourlyCounts[h]) : 0;
      const staff = staffByHour[h] ?? 0;
      const ratio = staff > 0 ? Math.round(avgCustomers / staff) : avgCustomers;
      const optimal = Math.max(1, Math.ceil(avgCustomers / TARGET_RATIO));

      let status: 'optimal' | 'understaffed' | 'overstaffed' = 'optimal';
      if (staff > 0 && ratio > 15) status = 'understaffed';
      else if (staff > 0 && ratio < 3 && avgCustomers > 0) status = 'overstaffed';
      else if (staff === 0 && avgCustomers > 0) status = 'understaffed';

      recommendations.push({ hour: h, avgCustomers, staffCount: staff, ratio, status, optimal });
    }

    const understaffedHours = recommendations.filter((r) => r.status === 'understaffed');
    const overstaffedHours = recommendations.filter((r) => r.status === 'overstaffed');

    res.json({
      recommendations,
      summary: {
        understaffedHours: understaffedHours.length,
        overstaffedHours: overstaffedHours.length,
        criticalHours: understaffedHours.filter((r) => r.ratio > 20).map((r) => r.hour),
      },
      needsMoreData: false,
      daysCollected,
    });
  } catch (error: unknown) {
    console.error('[staffing/recommendations] Error:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

export default router;
