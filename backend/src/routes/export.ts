/**
 * Export Routes - PDF/CSV generation for analytics data.
 *
 * Yan #41: locale-aware. CSV uses native UTF-8 (TR diacritics preserved);
 * PDF passes labels through turkishToAscii() because pdfkit's default
 * Helvetica drops glyphs outside Latin-1.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware';
import { EXPORT_LABELS, detectExportLocale } from '../lib/exportI18n';
import { turkishToAscii } from '../lib/turkishToAscii';
import { CameraIdOptionalSchema } from '../lib/schemas';
import { cumulativeDelta } from '../lib/cumulativeCounter';

const router = Router();

// Faz 11: demographics aggregator. AnalyticsLog.demographics is a JSON string
// snapshot per row ({gender:{male,female,unknown}, age:{0-17,18-24,...}}). Roll
// every row up into one consolidated breakdown for the PDF summary.
type DemoAgg = {
  gender: Record<string, number>;
  age: Record<string, number>;
  samples: number;
};

function emptyDemoAgg(): DemoAgg {
  return { gender: {}, age: {}, samples: 0 };
}

function mergeDemographicsJson(agg: DemoAgg, json: string | null | undefined): void {
  if (!json) return;
  try {
    const d = JSON.parse(json);
    if (d?.gender && typeof d.gender === 'object') {
      for (const [k, v] of Object.entries(d.gender)) {
        if (typeof v === 'number') agg.gender[k] = (agg.gender[k] ?? 0) + v;
      }
    }
    if (d?.age && typeof d.age === 'object') {
      for (const [k, v] of Object.entries(d.age)) {
        if (typeof v === 'number') agg.age[k] = (agg.age[k] ?? 0) + v;
      }
    }
    if (typeof d?.samples === 'number') agg.samples += d.samples;
    else agg.samples += 1;
  } catch { /* skip malformed row */ }
}

// Per-row CSV string e.g. "M:2 F:1; 25-34:2 35-44:1". Empty when no data.
function summarizeDemographicsForRow(json: string | null | undefined): string {
  if (!json) return '';
  try {
    const d = JSON.parse(json);
    const parts: string[] = [];
    if (d?.gender) {
      const g = d.gender;
      const segs: string[] = [];
      if (g.male) segs.push(`M:${g.male}`);
      if (g.female) segs.push(`F:${g.female}`);
      if (g.unknown) segs.push(`?:${g.unknown}`);
      if (segs.length > 0) parts.push(segs.join(' '));
    }
    if (d?.age) {
      const segs: string[] = [];
      for (const [k, v] of Object.entries(d.age)) {
        if (typeof v === 'number' && v > 0) segs.push(`${k}:${v}`);
      }
      if (segs.length > 0) parts.push(segs.join(' '));
    }
    return parts.join('; ');
  } catch {
    return '';
  }
}

// Yan #42: filename slug helper. Multi-branch SaaS exports used to all share
// `analytics_export_<date>.csv`, so a user juggling N branches couldn't tell
// downloaded files apart. Slug pulls branch + camera names through a
// deterministic ASCII fold and clamps each segment to 30 chars so neither a
// long name nor unicode jank produces an unusable filename.
export function slugifyForFilename(s: string | null | undefined): string {
  return (s ?? 'unknown')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30) || 'unknown';
}

async function resolveExportContext(cameraId: string | undefined): Promise<{ branchSlug: string; cameraSlug: string }> {
  if (!cameraId) return { branchSlug: 'all', cameraSlug: 'all' };
  const cam = await prisma.camera.findUnique({
    where: { id: cameraId },
    include: { branch: true },
  });
  return {
    branchSlug: slugifyForFilename(cam?.branch?.name),
    cameraSlug: slugifyForFilename(cam?.name),
  };
}

async function buildOwnedWhere(userId: string, params: { cameraId?: string; startDate?: string; endDate?: string }) {
  const ownedCams = await prisma.camera.findMany({
    where: { createdBy: userId },
    select: { id: true },
  });
  const ownedIds = ownedCams.map((c) => c.id);
  if (params.cameraId) {
    if (!ownedIds.includes(params.cameraId)) return null;
  }
  const where: any = {};
  if (params.cameraId) {
    where.cameraId = params.cameraId;
  } else {
    if (ownedIds.length === 0) return { __empty: true } as any;
    where.cameraId = { in: ownedIds };
  }
  if (params.startDate || params.endDate) {
    where.timestamp = {};
    if (params.startDate) where.timestamp.gte = new Date(params.startDate);
    if (params.endDate) where.timestamp.lte = new Date(params.endDate);
  }
  return where;
}

// Validation schema for export requests
const ExportRequestSchema = z.object({
  cameraId: CameraIdOptionalSchema,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().int().positive().max(10000).optional().default(1000)
});

/**
 * GET /api/export/csv - Export analytics data to CSV
 */
router.get('/csv', authenticate, async (req: Request, res: Response) => {
  try {
    const params = ExportRequestSchema.parse({
      cameraId: req.query.cameraId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 1000
    });

    const locale = detectExportLocale(req);
    const labels = EXPORT_LABELS[locale];

    const where = await buildOwnedWhere(req.user.id, params);
    if (where === null) return res.status(404).json({ error: 'Camera not found' });
    if ((where as any).__empty) return res.status(404).json({ error: 'No data found for the specified criteria' });

    // Fetch analytics data
    let logs: any[] = [];
    try {
      logs = await prisma.analyticsLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: params.limit,
        include: {
          camera: {
            select: {
              name: true,
              sourceType: true
            }
          }
        }
      });
    } catch (dbError) {
      // Demo mode: Generate sample data if database is unavailable
      console.log('[Export CSV] Database unavailable, using demo data');
      logs = generateDemoData(Math.min(params.limit, 50));
    }

    if (logs.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified criteria' });
    }

    // Faz 11: only the columns we actually capture reliably. queueCount,
    // avgWaitTime, longestWaitTime, fps were noise — most rows had defaults
    // (0 / null) because the cafe pipeline doesn't compute them.
    const csvData = logs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      camera: log.camera?.name || log.cameraId,
      peopleIn: log.peopleIn,
      peopleOut: log.peopleOut,
      currentCount: log.currentCount,
      demographics: summarizeDemographicsForRow(log.demographics),
    }));

    const parser = new Parser({
      fields: [
        { label: labels.timestamp, value: 'timestamp' },
        { label: labels.camera, value: 'camera' },
        { label: labels.peopleIn, value: 'peopleIn' },
        { label: labels.peopleOut, value: 'peopleOut' },
        { label: labels.currentCount, value: 'currentCount' },
        { label: labels.demographicsHeader, value: 'demographics' },
      ],
      withBOM: true, // Excel needs UTF-8 BOM to render TR diacritics correctly
    });

    const csv = parser.parse(csvData);

    // Set headers for file download
    const dateStr = new Date().toISOString().split('T')[0];
    const ctx = await resolveExportContext(params.cameraId);
    const baseFilename = labels.csvFilename(dateStr);
    const ext = baseFilename.endsWith('.csv') ? '.csv' : '';
    const stem = ext ? baseFilename.slice(0, -ext.length) : baseFilename;
    // Yan #42: prefix branch+camera slug so multi-branch downloads are unique.
    const filename = `${ctx.branchSlug}_${ctx.cameraSlug}_${stem}${ext}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Language', locale);
    res.send(csv);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('CSV Export Error:', error);
    res.status(500).json({ error: 'Failed to generate CSV export' });
  }
});

/**
 * GET /api/export/pdf - Export analytics data to PDF
 */
router.get('/pdf', authenticate, async (req: Request, res: Response) => {
  try {
    const params = ExportRequestSchema.parse({
      cameraId: req.query.cameraId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 1000
    });

    const locale = detectExportLocale(req);
    const labels = EXPORT_LABELS[locale];
    // PDF labels: ASCII-fold so Helvetica renders Turkish without missing-glyph boxes.
    const pdfLabel = (s: string) => locale === 'tr' ? turkishToAscii(s) : s;

    const where = await buildOwnedWhere(req.user.id, params);
    if (where === null) return res.status(404).json({ error: 'Camera not found' });
    if ((where as any).__empty) return res.status(404).json({ error: 'No data found for the specified criteria' });

    // Fetch analytics data
    let logs: any[] = [];
    try {
      logs = await prisma.analyticsLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: params.limit,
        include: {
          camera: {
            select: {
              name: true,
              sourceType: true
            }
          }
        }
      });
    } catch (dbError) {
      // Demo mode: Generate sample data if database is unavailable
      console.log('[Export PDF] Database unavailable, using demo data');
      logs = generateDemoData(Math.min(params.limit, 50));
    }

    if (logs.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified criteria' });
    }

    // Faz 11: drop queue/wait/fps from PDF summary too — they were either
    // zero-padded defaults or absent. Replace with a true peakCurrent (max
    // currentCount) plus an aggregated demographics block built from the
    // per-row demographics JSON snapshots.
    // peopleIn/peopleOut are cumulative engine counters — convert to delta.
    const totalPeopleIn = cumulativeDelta(logs, 'peopleIn');
    const totalPeopleOut = cumulativeDelta(logs, 'peopleOut');
    const avgCurrentCount = Math.round(
      logs.reduce((sum, log) => sum + log.currentCount, 0) / logs.length
    );
    const peakCurrentCount = logs.reduce((m, log) => Math.max(m, log.currentCount || 0), 0);

    const demoAgg = emptyDemoAgg();
    for (const log of logs) mergeDemographicsJson(demoAgg, log.demographics);
    const genderTotal = (demoAgg.gender.male ?? 0) + (demoAgg.gender.female ?? 0) + (demoAgg.gender.unknown ?? 0);
    const ageTotal = Object.values(demoAgg.age).reduce((s, v) => s + v, 0);

    // Create PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Set headers for file download
    const dateStr = new Date().toISOString().split('T')[0];
    const ctx = await resolveExportContext(params.cameraId);
    const basePdf = labels.pdfFilename(dateStr);
    const ext = basePdf.endsWith('.pdf') ? '.pdf' : '';
    const stem = ext ? basePdf.slice(0, -ext.length) : basePdf;
    // Yan #42: prefix branch+camera slug.
    const filename = `${ctx.branchSlug}_${ctx.cameraSlug}_${stem}${ext}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Language', locale);

    // Pipe PDF to response
    doc.pipe(res);

    // Add title
    doc.fontSize(20).text(pdfLabel(labels.pdfTitle), { align: 'center' });
    doc.moveDown();

    // Add report metadata
    doc.fontSize(10).text(`${pdfLabel(labels.generatedDate)}: ${new Date().toLocaleString()}`, { align: 'right' });
    doc.text(`${pdfLabel(labels.cameraField)}: ${pdfLabel(logs[0].camera?.name || params.cameraId || labels.allCameras)}`, { align: 'right' });
    doc.text(`${pdfLabel(labels.periodField)}: ${params.startDate || pdfLabel(labels.allTime)} - ${params.endDate || pdfLabel(labels.now)}`, { align: 'right' });
    doc.text(`${pdfLabel(labels.totalRecordsField)}: ${logs.length}`, { align: 'right' });
    doc.moveDown(2);

    // Add summary section
    doc.fontSize(14).text(pdfLabel(labels.summarySection), { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`${pdfLabel(labels.totalEntered)}: ${totalPeopleIn}`);
    doc.text(`${pdfLabel(labels.totalExited)}: ${totalPeopleOut}`);
    doc.text(`${pdfLabel(labels.avgCurrent)}: ${avgCurrentCount}`);
    doc.text(`${pdfLabel(labels.peakCurrent)}: ${peakCurrentCount}`);
    doc.moveDown(2);

    // Demographics block — only render when we have aggregated samples.
    doc.fontSize(14).text(pdfLabel(labels.demographicsSection), { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    if (demoAgg.samples === 0 || (genderTotal === 0 && ageTotal === 0)) {
      doc.text(pdfLabel(labels.noDemographics));
    } else {
      if (genderTotal > 0) {
        doc.font('Helvetica-Bold').text(pdfLabel(labels.genderHeader));
        doc.font('Helvetica');
        const m = demoAgg.gender.male ?? 0;
        const f = demoAgg.gender.female ?? 0;
        const u = demoAgg.gender.unknown ?? 0;
        const pct = (n: number) => `${Math.round((n / genderTotal) * 100)}%`;
        if (m > 0) doc.text(`  ${locale === 'tr' ? 'Erkek' : 'Male'}: ${m} (${pct(m)})`);
        if (f > 0) doc.text(`  ${locale === 'tr' ? 'Kadin' : 'Female'}: ${f} (${pct(f)})`);
        if (u > 0) doc.text(`  ${locale === 'tr' ? 'Bilinmiyor' : 'Unknown'}: ${u} (${pct(u)})`);
        doc.moveDown(0.5);
      }
      if (ageTotal > 0) {
        doc.font('Helvetica-Bold').text(pdfLabel(labels.ageHeader));
        doc.font('Helvetica');
        const order = ['0-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+', '55+'];
        const sortedAge = Object.entries(demoAgg.age)
          .filter(([, v]) => v > 0)
          .sort((a, b) => {
            const ai = order.indexOf(a[0]);
            const bi = order.indexOf(b[0]);
            if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          });
        for (const [bucket, n] of sortedAge) {
          const p = Math.round((n / ageTotal) * 100);
          doc.text(`  ${bucket}: ${n} (${p}%)`);
        }
      }
    }
    doc.moveDown(2);

    // Detail table — Faz 11 trimmed columns: timestamp, in, out, current.
    doc.fontSize(12).text(pdfLabel(labels.detailSection), { underline: true });
    doc.moveDown();

    doc.fontSize(9);
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 200;
    const col3 = 290;
    const col4 = 380;

    doc.text(pdfLabel(labels.detailTimestamp), col1, tableTop);
    doc.text(pdfLabel(labels.detailPeopleIn), col2, tableTop);
    doc.text(pdfLabel(labels.detailPeopleOut), col3, tableTop);
    doc.text(pdfLabel(labels.detailCurrent), col4, tableTop);

    doc.moveTo(col1, doc.y + 5).lineTo(540, doc.y + 5).stroke();
    doc.moveDown();

    const displayLimit = Math.min(logs.length, 100);
    for (let i = 0; i < displayLimit; i++) {
      const log = logs[i];
      const y = doc.y;

      if (y > 700) {
        doc.addPage();
        doc.y = 50;
      }

      const ts = new Date(log.timestamp);
      doc.text(`${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}`, col1, doc.y);
      doc.text(log.peopleIn.toString(), col2, y);
      doc.text(log.peopleOut.toString(), col3, y);
      doc.text(log.currentCount.toString(), col4, y);

      doc.moveDown(0.5);
    }

    if (logs.length > displayLimit) {
      doc.moveDown();
      doc.fontSize(10).text(pdfLabel(labels.moreRecords(logs.length - displayLimit)), { align: 'center' });
    }

    // Add footer
    doc.fontSize(8).text(
      pdfLabel(labels.footer),
      50,
      doc.page.height - 50,
      { align: 'center' }
    );

    // Finalize PDF
    doc.end();

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('PDF Export Error:', error);

    // If PDF generation fails and headers haven't been sent, send error response
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF export' });
    }
  }
});

/**
 * Generate demo data for testing without database
 */
function generateDemoData(count: number = 10): any[] {
  const demoLogs = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(now.getTime() - i * 60000); // 1 minute intervals
    demoLogs.push({
      id: `demo-${i}`,
      timestamp,
      cameraId: 'demo-camera-001',
      peopleIn: Math.floor(Math.random() * 10) + 1,
      peopleOut: Math.floor(Math.random() * 8),
      currentCount: Math.floor(Math.random() * 50) + 10,
      queueCount: Math.floor(Math.random() * 5),
      avgWaitTime: Math.random() * 60 + 10,
      longestWaitTime: Math.random() * 120 + 20,
      fps: 30 + Math.random() * 5,
      demographics: null,
      heatmap: null,
      activePeople: null,
      camera: {
        name: 'Demo Camera - Main Entrance',
        sourceType: 'webcam'
      }
    });
  }

  return demoLogs;
}

export default router;
