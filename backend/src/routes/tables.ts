/**
 * Stage 5: Tables AI summary route.
 *
 * The Live View tab on TableOccupancyPage needs a short, actionable Turkish
 * commentary that reads like a shift manager's glance at the floor — "Masa 3 45
 * dakikadir dolu, Masa 5 temizlik bekliyor" etc. We build the prompt on the
 * server so the client only sends the structured floor state.
 *
 * Throttling is per-cameraId so one camera hammering the button doesn't drain
 * the Ollama worker, but two different cafes can still get fresh answers.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { callOllama } from './ai';
import { prisma } from '../lib/db';
import { authenticate } from '../middleware/authMiddleware';
import { requireCameraOwnership, userOwnsCamera } from '../middleware/tenantScope';

const router = Router();

// Pending manual overrides (force_empty) waiting for Python WebSocket to pick up.
// The Python analytics engine polls this list on each tick via an in-process hook.
// This is in-memory because overrides are one-shot and don't need persistence.
const pendingOverrides = new Map<string, { zoneId: string; action: 'force_empty'; at: number }[]>();

export function takePendingOverrides(cameraId: string): Array<{ zoneId: string; action: string }> {
  const list = pendingOverrides.get(cameraId) || [];
  pendingOverrides.delete(cameraId);
  return list;
}

const TableSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  status: z.enum(['empty', 'occupied', 'needs_cleaning', 'reserved']),
  currentOccupants: z.number().int().min(0),
  avgStaySeconds: z.number().min(0).optional(),
  occupancyDuration: z.number().min(0).optional(),
  turnoverCount: z.number().int().min(0).optional(),
  maxCapacity: z.number().int().min(1).optional(),
});

const DemographicsSchema = z
  .object({
    male: z.number().min(0).optional(),
    female: z.number().min(0).optional(),
    dominantAge: z.string().optional(),
  })
  .optional();

const AISummaryBody = z.object({
  cameraId: z.string().min(1),
  tables: z.array(TableSchema).max(100),
  totals: z
    .object({
      current: z.number().min(0),
      entries: z.number().min(0),
      exits: z.number().min(0),
      fps: z.number().min(0).optional(),
    })
    .optional(),
  demographics: DemographicsSchema,
  lang: z.enum(['tr', 'en']).default('tr'),
});

// In-memory throttle cache: cameraId → { result, expiresAt }.
// 30 s TTL matches the plan's "30sn throttle + side panel auto-refresh".
interface CacheEntry {
  summary: string;
  model: string;
  generatedAt: number;
  expiresAt: number;
}
const summaryCache = new Map<string, CacheEntry>();
const THROTTLE_MS = 30_000;

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}sn`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}dk ${s}sn`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}sa ${m}dk`;
}

function buildPrompt(body: z.infer<typeof AISummaryBody>): string {
  const { tables, totals, demographics, lang } = body;

  const tableLines = tables.map((t, i) => {
    const label = t.name || `Masa ${i + 1}`;
    const dur = t.occupancyDuration ? formatDuration(t.occupancyDuration) : '-';
    const cap = t.maxCapacity ? `/${t.maxCapacity}` : '';
    const statusTr: Record<string, string> = {
      empty: 'bos',
      occupied: 'dolu',
      needs_cleaning: 'temizlik bekliyor',
      reserved: 'rezerve',
    };
    return `${label}: ${statusTr[t.status] || t.status} (${t.currentOccupants}${cap} kisi, ${dur})`;
  });

  const totalsLine = totals
    ? `Anlik: ${totals.current} kisi | Giris/Cikis bugun: ${totals.entries}/${totals.exits}`
    : '';

  const demoLine = demographics
    ? `Demografik: %${Math.round((demographics.male || 0))}E %${Math.round((demographics.female || 0))}K, dominant yas=${demographics.dominantAge || '-'}`
    : '';

  if (lang === 'en') {
    return [
      'You are a restaurant floor manager. Produce a very short status brief (2-4 lines max) in English based on the data below.',
      'Mention only what is actionable: tables that need cleaning, long-occupancy tables, free tables that could be offered to waiting guests.',
      'Do not repeat raw numbers that the dashboard already shows — translate them into shift decisions.',
      '',
      'FLOOR STATE:',
      ...tableLines,
      totalsLine,
      demoLine,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    'Bir kafe/restoran salon sorumlususun. Asagidaki veriye dayanarak 2-4 satirdan uzun olmayan, aksiyona yonelik Turkce kisa bir brief ver.',
    'Sadece harekete gecilebilecek noktalari soyle: temizlenmesi gereken masalar, uzun suredir oturanlar, bos masalar.',
    'Panelde zaten gorunen ham sayilari tekrar etme — vardiya kararina cevir.',
    '',
    'SALON DURUMU:',
    ...tableLines,
    totalsLine,
    demoLine,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * POST /api/tables/ai-summary
 *
 * Body: { cameraId, tables[], totals?, demographics?, lang? }
 * Returns: { summary, model, cached, generatedAt }
 */
/**
 * GET /api/tables/:cameraId
 *
 * Returns list of TABLE-type zones for this camera, including current status
 * and occupant count. The status + occupants come from the latest AnalyticsLog
 * payload (Python side owns state machine); we enrich with zone metadata from
 * the DB.
 */
router.get('/:cameraId', authenticate, requireCameraOwnership('cameraId'), async (req: Request, res: Response) => {
  const { cameraId } = req.params;

  const zones = await prisma.zone.findMany({
    where: { cameraId, type: 'table', isActive: true },
    select: { id: true, name: true, coordinates: true, color: true },
  });

  if (zones.length === 0) {
    return res.json({ cameraId, tables: [], generatedAt: Date.now() });
  }

  // Pull latest status from most recent analytics log
  const latestLog = await prisma.analyticsLog.findFirst({
    where: { cameraId },
    orderBy: { timestamp: 'desc' },
    select: { activePeople: true, timestamp: true },
  });

  // Pull today's TableEvent cycles for turnover stats
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const events = await prisma.tableEvent.findMany({
    where: { cameraId, createdAt: { gte: dayStart } },
    select: { zoneId: true, status: true, duration: true },
  });
  const turnoverByZone = new Map<string, number>();
  const avgDurationByZone = new Map<string, { sum: number; n: number }>();
  for (const ev of events) {
    if (ev.status === 'occupied') {
      turnoverByZone.set(ev.zoneId, (turnoverByZone.get(ev.zoneId) ?? 0) + 1);
      if (ev.duration && ev.duration > 0) {
        const cur = avgDurationByZone.get(ev.zoneId) ?? { sum: 0, n: 0 };
        cur.sum += ev.duration;
        cur.n += 1;
        avgDurationByZone.set(ev.zoneId, cur);
      }
    }
  }

  const tables = zones.map((zone) => {
    const avg = avgDurationByZone.get(zone.id);
    return {
      id: zone.id,
      name: zone.name,
      color: zone.color,
      coordinates: zone.coordinates,
      status: 'empty' as string,        // Python engine updates via WebSocket
      currentOccupants: 0,
      occupancyDuration: 0,
      turnoverCount: turnoverByZone.get(zone.id) ?? 0,
      avgStaySeconds: avg ? avg.sum / avg.n : null,
    };
  });

  return res.json({
    cameraId,
    tables,
    lastUpdate: latestLog?.timestamp ?? null,
    generatedAt: Date.now(),
  });
});

/**
 * PATCH /api/tables/:zoneId/status
 *
 * Body: { cameraId: string, status: "empty" }
 *
 * Staff manually marks a table as cleaned. We queue a force_empty override
 * that the Python engine picks up on its next tick.
 */
const StatusPatchBody = z.object({
  cameraId: z.string().min(1),
  status: z.enum(['empty']),  // only manual 'empty' transition supported
  note: z.string().optional(),
});

router.patch('/:zoneId/status', authenticate, async (req: Request, res: Response) => {
  const { zoneId } = req.params;
  const parsed = StatusPatchBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', issues: parsed.error.issues });
  }
  const { cameraId } = parsed.data;

  if (!(await userOwnsCamera(req.user.id, cameraId))) {
    return res.status(404).json({ error: 'Camera not found' });
  }

  const zone = await prisma.zone.findFirst({
    where: { id: zoneId, cameraId, type: 'table', isActive: true },
  });
  if (!zone) {
    return res.status(404).json({ error: 'Table zone not found' });
  }

  // Queue override for Python pipeline
  const list = pendingOverrides.get(cameraId) ?? [];
  list.push({ zoneId, action: 'force_empty', at: Date.now() });
  pendingOverrides.set(cameraId, list);

  // Persist the manual cleaning event
  await prisma.tableEvent.create({
    data: {
      zoneId,
      cameraId,
      status: 'empty',
      startTime: new Date(),
      endTime: new Date(),
      occupants: 0,
      duration: 0,
    },
  });

  return res.json({
    ok: true,
    zoneId,
    status: 'empty',
    appliedAt: Date.now(),
  });
});

router.post('/ai-summary', authenticate, async (req: Request, res: Response) => {
  const parsed = AISummaryBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', issues: parsed.error.issues });
  }

  const { cameraId } = parsed.data;

  if (!(await userOwnsCamera(req.user.id, cameraId))) {
    return res.status(404).json({ error: 'Camera not found' });
  }

  const now = Date.now();

  const cached = summaryCache.get(cameraId);
  if (cached && cached.expiresAt > now) {
    return res.json({
      summary: cached.summary,
      model: cached.model,
      cached: true,
      generatedAt: cached.generatedAt,
      nextRefreshMs: cached.expiresAt - now,
    });
  }

  const prompt = buildPrompt(parsed.data);

  try {
    const { response, model } = await callOllama(prompt, {
      maxTokens: 400,
      temperature: 0.3,
    });

    const summary = (response || '').trim();
    const entry: CacheEntry = {
      summary,
      model,
      generatedAt: now,
      expiresAt: now + THROTTLE_MS,
    };
    summaryCache.set(cameraId, entry);

    return res.json({
      summary,
      model,
      cached: false,
      generatedAt: now,
      nextRefreshMs: THROTTLE_MS,
    });
  } catch (err: any) {
    // If Ollama is down, surface a graceful fallback so the panel doesn't go
    // blank — the client renders this in a muted tone.
    const msg: string = err?.message || 'Ollama unreachable';
    const fallback =
      parsed.data.lang === 'en'
        ? 'AI commentary temporarily unavailable (Ollama offline). Check start-all.bat.'
        : 'AI yorumu simdilik kullanilamiyor (Ollama kapali). start-all.bat ile servisi acin.';
    return res.status(200).json({
      summary: fallback,
      model: 'fallback',
      cached: false,
      generatedAt: now,
      nextRefreshMs: THROTTLE_MS,
      error: msg,
    });
  }
});

export default router;
