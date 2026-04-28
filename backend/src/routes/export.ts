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

const router = Router();

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
  cameraId: z.string().uuid().optional(),
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

    // Prepare data for CSV
    const csvData = logs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      camera: log.camera?.name || log.cameraId,
      peopleIn: log.peopleIn,
      peopleOut: log.peopleOut,
      currentCount: log.currentCount,
      queueCount: log.queueCount || 0,
      avgWaitTime: log.avgWaitTime || 0,
      longestWaitTime: log.longestWaitTime || 0,
      fps: log.fps || 0
    }));

    // Generate CSV with locale-aware headers
    const parser = new Parser({
      fields: [
        { label: labels.timestamp, value: 'timestamp' },
        { label: labels.camera, value: 'camera' },
        { label: labels.peopleIn, value: 'peopleIn' },
        { label: labels.peopleOut, value: 'peopleOut' },
        { label: labels.currentCount, value: 'currentCount' },
        { label: labels.queueCount, value: 'queueCount' },
        { label: labels.avgWaitTime, value: 'avgWaitTime' },
        { label: labels.longestWaitTime, value: 'longestWaitTime' },
        { label: labels.fps, value: 'fps' }
      ],
      withBOM: true, // Excel needs UTF-8 BOM to render TR diacritics correctly
    });

    const csv = parser.parse(csvData);

    // Set headers for file download
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = labels.csvFilename(dateStr);
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

    // Calculate summary statistics
    const totalPeopleIn = logs.reduce((sum, log) => sum + log.peopleIn, 0);
    const totalPeopleOut = logs.reduce((sum, log) => sum + log.peopleOut, 0);
    const avgCurrentCount = Math.round(
      logs.reduce((sum, log) => sum + log.currentCount, 0) / logs.length
    );
    const avgQueueCount = logs.filter(l => l.queueCount !== null).length > 0
      ? Math.round(
          logs
            .filter(l => l.queueCount !== null)
            .reduce((sum, log) => sum + (log.queueCount || 0), 0) /
          logs.filter(l => l.queueCount !== null).length
        )
      : 0;

    // Create PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    // Set headers for file download
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = labels.pdfFilename(dateStr);
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
    doc.text(`${pdfLabel(labels.avgQueue)}: ${avgQueueCount}`);
    doc.moveDown(2);

    // Add data table header
    doc.fontSize(12).text(pdfLabel(labels.detailSection), { underline: true });
    doc.moveDown();

    // Table headers
    doc.fontSize(8);
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 150;
    const col3 = 220;
    const col4 = 280;
    const col5 = 340;
    const col6 = 400;
    const col7 = 460;
    const col8 = 520;

    doc.text(pdfLabel(labels.detailTimestamp), col1, tableTop);
    doc.text(pdfLabel(labels.detailPeopleIn), col2, tableTop);
    doc.text(pdfLabel(labels.detailPeopleOut), col3, tableTop);
    doc.text(pdfLabel(labels.detailCurrent), col4, tableTop);
    doc.text(pdfLabel(labels.detailQueue), col5, tableTop);
    doc.text(pdfLabel(labels.detailAvgWait), col6, tableTop);
    doc.text(pdfLabel(labels.detailMaxWait), col7, tableTop);
    doc.text(pdfLabel(labels.detailFps), col8, tableTop);

    doc.moveTo(col1, doc.y + 5).lineTo(570, doc.y + 5).stroke();
    doc.moveDown();

    // Add data rows (limit to prevent PDF from being too large)
    const displayLimit = Math.min(logs.length, 100);
    for (let i = 0; i < displayLimit; i++) {
      const log = logs[i];
      const y = doc.y;

      // Check if we need a new page
      if (y > 700) {
        doc.addPage();
        doc.y = 50;
      }

      doc.text(new Date(log.timestamp).toLocaleTimeString(), col1, doc.y);
      doc.text(log.peopleIn.toString(), col2, y);
      doc.text(log.peopleOut.toString(), col3, y);
      doc.text(log.currentCount.toString(), col4, y);
      doc.text((log.queueCount || 0).toString(), col5, y);
      doc.text((log.avgWaitTime || 0).toFixed(1), col6, y);
      doc.text((log.longestWaitTime || 0).toFixed(1), col7, y);
      doc.text((log.fps || 0).toFixed(0), col8, y);

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
