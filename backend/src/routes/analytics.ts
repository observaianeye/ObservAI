/**
 * Analytics data API routes
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';

const router = Router();

// Validation schema
const CreateAnalyticsLogSchema = z.object({
  cameraId: z.string().uuid(),
  peopleIn: z.number().int().min(0),
  peopleOut: z.number().int().min(0),
  currentCount: z.number().int().min(0),
  demographics: z.record(z.any()).optional(),
  queueCount: z.number().int().optional(),
  avgWaitTime: z.number().optional(),
  longestWaitTime: z.number().optional(),
  fps: z.number().optional(),
  heatmap: z.any().optional(),
  activePeople: z.any().optional()
});

// POST /api/analytics - Log analytics data
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = CreateAnalyticsLogSchema.parse(req.body);

    const log = await prisma.analyticsLog.create({
      data: {
        cameraId: data.cameraId,
        peopleIn: data.peopleIn,
        peopleOut: data.peopleOut,
        currentCount: data.currentCount,
        demographics: data.demographics,
        queueCount: data.queueCount,
        avgWaitTime: data.avgWaitTime,
        longestWaitTime: data.longestWaitTime,
        fps: data.fps,
        heatmap: data.heatmap,
        activePeople: data.activePeople
      }
    });

    res.status(201).json(log);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating analytics log:', error);
    res.status(500).json({ error: 'Failed to create analytics log' });
  }
});

// GET /api/analytics/:cameraId - Get analytics for a camera
router.get('/:cameraId', async (req: Request, res: Response) => {
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

    res.json(logs);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/analytics/:cameraId/summary - Get aggregated summary
router.get('/:cameraId/summary', async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const { date } = req.query;

    const where: any = { cameraId };
    if (date) {
      where.date = new Date(date as string);
    }

    const summaries = await prisma.analyticsSummary.findMany({
      where,
      orderBy: [
        { date: 'desc' },
        { hour: 'asc' }
      ]
    });

    res.json(summaries);
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
});

// POST /api/analytics/insights - Log zone insight
router.post('/insights', async (req: Request, res: Response) => {
  try {
    const { zoneId, personId, duration, gender, age, message } = req.body;

    if (!zoneId || !personId || !duration || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

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
router.get('/insights/:zoneId', async (req: Request, res: Response) => {
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

export default router;
