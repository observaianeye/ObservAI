/**
 * Staff shift management and optimization routes
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';

const router = Router();

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
router.get('/:branchId/recommendations', async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const cameraId = req.query.cameraId as string;

    if (!cameraId) {
      return res.status(400).json({ error: 'cameraId query parameter required' });
    }

    // Get today's shifts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const shifts = await prisma.staffShift.findMany({
      where: { branchId, date: today },
    });
    const staffByHour: Record<number, number> = {};
    for (const s of shifts) staffByHour[s.hour] = s.staffCount;

    // Get last 30 days average hourly traffic
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const summaries = await prisma.analyticsSummary.findMany({
      where: { cameraId, date: { gte: thirtyDaysAgo }, hour: { not: null } },
    });

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

    const understaffedHours = recommendations.filter(r => r.status === 'understaffed');
    const overstaffedHours = recommendations.filter(r => r.status === 'overstaffed');

    res.json({
      recommendations,
      summary: {
        understaffedHours: understaffedHours.length,
        overstaffedHours: overstaffedHours.length,
        criticalHours: understaffedHours.filter(r => r.ratio > 20).map(r => r.hour),
      },
    });
  } catch (error: any) {
    console.error('[staffing/recommendations] Error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

export default router;
