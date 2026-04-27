/**
 * AI Insights API Routes
 *
 * Endpoints for real-time alerts, trend analysis, and AI recommendations.
 * Uses raw SQL for the 'insights' table since Prisma client needs regeneration.
 * After running `npx prisma generate` on Windows, these can be migrated to typed Prisma queries.
 *
 * Routes:
 *   GET    /api/insights                   - List all insights (filterable)
 *   GET    /api/insights/unread-count      - Get unread insight count
 *   GET    /api/insights/stats/:cameraId   - Aggregated stats for a camera
 *   GET    /api/insights/trends/:cameraId  - Trend analysis for a camera
 *   GET    /api/insights/recommendations   - AI-powered recommendations
 *   POST   /api/insights/generate          - Force insight generation
 *   PATCH  /api/insights/:id/read          - Mark insight as read
 *   DELETE /api/insights/:id               - Delete a single insight
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import {
  analyzeTrends,
  getStats,
  getAIRecommendations,
  getAISummary,
  generateInsights,
} from '../services/insightEngine';
import { authenticate } from '../middleware/authMiddleware';
import { requireCameraOwnership, userOwnsCamera } from '../middleware/tenantScope';

const router = Router();

async function ownedCameraIdsForUser(userId: string): Promise<string[]> {
  const cams = await prisma.camera.findMany({
    where: { createdBy: userId },
    select: { id: true },
  });
  return cams.map((c) => c.id);
}

// Restricts the visible camera ids to those belonging to a specific branch
// owned by the caller. Returns null if the branch does not exist or is owned
// by another user — caller should treat that as "no insights".
async function ownedBranchCameraIds(userId: string, branchId: string): Promise<string[] | null> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, userId },
    select: { id: true },
  });
  if (!branch) return null;
  const cams = await prisma.camera.findMany({
    where: { createdBy: userId, branchId },
    select: { id: true },
  });
  return cams.map((c) => c.id);
}

// Quote a string for inline SQL — only used to build the IN (...) list of
// caller-owned camera ids, which themselves come from the database (UUID
// strings or 'sample-<uuid>'). Defensive escape in case future rows include
// other characters.
function sqlQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface InsightRow {
  id: string;
  cameraId: string;
  zoneId: string | null;
  type: string;
  severity: string;
  title: string;
  message: string;
  context: string | null;
  isRead: boolean | number;
  expiresAt: string | null;
  createdAt: string;
}

// ─── Validation Schemas ──────────────────────────────────────────────────────

const GenerateSchema = z.object({
  // UUID zorunluluğu kaldırıldı — 'sample-camera-1' gibi non-uuid ID'leri destekler
  cameraId: z.string().min(1),
  type: z.string().optional(),
});

// ─── GET /api/insights ───────────────────────────────────────────────────────

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { cameraId, branchId, type, severity, isRead, limit: limitStr, startDate, endDate } = req.query;
    const limit = limitStr ? Math.min(parseInt(limitStr as string), 200) : 50;

    const ownedIds = await ownedCameraIdsForUser(req.user.id);
    if (cameraId && !ownedIds.includes(cameraId as string)) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    let scopedIds: string[];
    if (cameraId) {
      scopedIds = [cameraId as string];
    } else if (branchId) {
      const branchIds = await ownedBranchCameraIds(req.user.id, branchId as string);
      if (branchIds === null) return res.status(404).json({ error: 'Branch not found' });
      scopedIds = branchIds;
    } else {
      scopedIds = ownedIds;
    }
    if (scopedIds.length === 0) return res.json({ insights: [], total: 0, filters: { cameraId, branchId, type, severity } });

    // Build WHERE clauses with parameterised values where possible.
    const conditions: string[] = [`"cameraId" IN (${scopedIds.map(sqlQuote).join(',')})`];
    if (type) conditions.push(`"type" = ${sqlQuote(String(type))}`);
    if (severity) conditions.push(`"severity" = ${sqlQuote(String(severity))}`);
    if (isRead !== undefined) conditions.push(`"isRead" = ${isRead === 'true' ? 1 : 0}`);
    if (startDate) conditions.push(`"createdAt" >= ${sqlQuote(new Date(startDate as string).toISOString())}`);
    if (endDate) conditions.push(`"createdAt" <= ${sqlQuote(new Date(endDate as string).toISOString())}`);

    const whereClause = conditions.join(' AND ');

    const insights = await prisma.$queryRawUnsafe<InsightRow[]>(
      `SELECT * FROM insights WHERE ${whereClause} ORDER BY "createdAt" DESC LIMIT ${limit}`
    );

    // Parse context JSON and normalize isRead
    const parsed = insights.map(i => ({
      ...i,
      isRead: i.isRead === 1 || i.isRead === true,
      context: i.context ? safeJsonParse(i.context) : null,
    }));

    res.json({
      insights: parsed,
      total: parsed.length,
      filters: { cameraId, branchId, type, severity },
    });
  } catch (error) {
    console.error('[Insights] List error:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// ─── GET /api/insights/unread-count ──────────────────────────────────────────
// NOTE: This must be BEFORE /:id routes to avoid parameter capture

router.get('/unread-count', authenticate, async (req: Request, res: Response) => {
  try {
    const cameraId = req.query.cameraId as string | undefined;
    const branchId = req.query.branchId as string | undefined;
    const ownedIds = await ownedCameraIdsForUser(req.user.id);
    if (cameraId && !ownedIds.includes(cameraId)) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    let scopedIds: string[];
    if (cameraId) {
      scopedIds = [cameraId];
    } else if (branchId) {
      const branchIds = await ownedBranchCameraIds(req.user.id, branchId);
      if (branchIds === null) return res.status(404).json({ error: 'Branch not found' });
      scopedIds = branchIds;
    } else {
      scopedIds = ownedIds;
    }
    if (scopedIds.length === 0) return res.json({ unreadCount: 0 });

    const query = `SELECT COUNT(*) as cnt FROM insights WHERE "isRead" = 0 AND "cameraId" IN (${scopedIds.map(sqlQuote).join(',')})`;
    const result = await prisma.$queryRawUnsafe<{ cnt: number }[]>(query);
    res.json({ unreadCount: Number(result[0]?.cnt || 0) });
  } catch (error) {
    console.error('[Insights] Unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// ─── GET /api/insights/stats/:cameraId ───────────────────────────────────────

router.get('/stats/:cameraId', authenticate, requireCameraOwnership('cameraId'), async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const period = (req.query.period as 'day' | 'week' | 'month') || 'day';

    if (!['day', 'week', 'month'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Use: day, week, month' });
    }

    const stats = await getStats(cameraId, period);
    res.json(stats);
  } catch (error) {
    console.error('[Insights] Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── GET /api/insights/trends/:cameraId ──────────────────────────────────────

router.get('/trends/:cameraId', authenticate, requireCameraOwnership('cameraId'), async (req: Request, res: Response) => {
  try {
    const { cameraId } = req.params;
    const { startDate, endDate } = req.query;

    const now = new Date();
    const start = startDate ? new Date(startDate as string) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : now;

    const trends = await analyzeTrends(cameraId, start, end);
    res.json(trends);
  } catch (error) {
    console.error('[Insights] Trends error:', error);
    res.status(500).json({ error: 'Failed to analyze trends' });
  }
});

// ─── GET /api/insights/recommendations ───────────────────────────────────────

router.get('/recommendations', authenticate, async (req: Request, res: Response) => {
  try {
    const cameraId = req.query.cameraId as string | undefined;
    if (cameraId && !(await userOwnsCamera(req.user.id, cameraId))) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    const recommendations = await getAIRecommendations(cameraId);

    // Determine which AI source was used
    const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';
    let source = 'demo';
    if (AI_PROVIDER === 'ollama') {
      source = 'ollama';
    } else if (process.env.GEMINI_API_KEY) {
      source = 'gemini';
    }

    res.json({
      recommendations,
      generatedAt: new Date().toISOString(),
      source,
    });
  } catch (error) {
    console.error('[Insights] Recommendations error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// ─── GET /api/insights/summary ───────────────────────────────────────────────

router.get('/summary', authenticate, async (req: Request, res: Response) => {
  try {
    const cameraId = req.query.cameraId as string | undefined;
    if (cameraId && !(await userOwnsCamera(req.user.id, cameraId))) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    const summary = await getAISummary(cameraId);
    res.json({
      ...summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Insights] Summary error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// ─── POST /api/insights/generate ─────────────────────────────────────────────

router.post('/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { cameraId } = GenerateSchema.parse(req.body);

    if (!(await userOwnsCamera(req.user.id, cameraId))) {
      return res.status(404).json({ error: 'Camera not found' });
    }

    const result = await generateInsights(cameraId);

    res.json({
      message: `Generated ${result.alerts.length} insight(s), saved ${result.saved} to database.`,
      alerts: result.alerts,
      trends: result.trends,
      saved: result.saved,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('[Insights] Generate error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// ─── PATCH /api/insights/:id/read ────────────────────────────────────────────

router.patch('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ownedIds = await ownedCameraIdsForUser(req.user.id);
    if (ownedIds.length === 0) return res.status(404).json({ error: 'Insight not found' });

    const owned = await prisma.$queryRawUnsafe<InsightRow[]>(
      `SELECT * FROM insights WHERE id = ${sqlQuote(id)} AND "cameraId" IN (${ownedIds.map(sqlQuote).join(',')})`
    );
    if (owned.length === 0) return res.status(404).json({ error: 'Insight not found' });

    await prisma.$executeRaw`UPDATE insights SET "isRead" = 1 WHERE id = ${id}`;
    const result = await prisma.$queryRaw<InsightRow[]>`SELECT * FROM insights WHERE id = ${id}`;

    res.json({ ...result[0], isRead: true });
  } catch (error) {
    console.error('[Insights] Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark insight as read' });
  }
});

// ─── DELETE /api/insights/:id ────────────────────────────────────────────────

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ownedIds = await ownedCameraIdsForUser(req.user.id);
    if (ownedIds.length === 0) return res.status(404).json({ error: 'Insight not found' });

    const owned = await prisma.$queryRawUnsafe<InsightRow[]>(
      `SELECT id FROM insights WHERE id = ${sqlQuote(id)} AND "cameraId" IN (${ownedIds.map(sqlQuote).join(',')})`
    );
    if (owned.length === 0) return res.status(404).json({ error: 'Insight not found' });

    await prisma.$executeRaw`DELETE FROM insights WHERE id = ${id}`;
    res.json({ message: 'Insight deleted', id });
  } catch (error) {
    console.error('[Insights] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete insight' });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeJsonParse(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

export default router;
