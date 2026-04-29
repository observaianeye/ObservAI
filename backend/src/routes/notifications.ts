/**
 * Notification Settings & Channels API Routes
 *
 * Email-only. Endpoints for managing user notification preferences
 * and probing SMTP status. Telegram was removed per product decision.
 *
 * Routes:
 *   GET    /api/notifications/settings          - Get current user's notification settings
 *   PUT    /api/notifications/settings          - Update notification settings
 *   POST   /api/notifications/test/email        - Send test email
 *   GET    /api/notifications/channels/status   - Check SMTP status
 *   POST   /api/notifications/test-staff        - Send a staff shift notification via email
 *   GET    /api/notifications/summary           - KPI feed of sent notifications
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import {
  verifySmtp,
  sendAlertEmail,
  sendStaffShiftEmail,
} from '../services/emailService';
import { notifyStaffShift } from '../services/notificationDispatcher';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// ─── Validation ─────────────────────────────────────────────────────────────

const UpdateSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  notifySeverity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().nullable().optional(),
  quietHoursEnd: z.string().nullable().optional(),
  dailySummaryEnabled: z.boolean().optional(),
  dailySummaryTime: z.string().nullable().optional(),
});

// ─── GET /api/notifications/settings ────────────────────────────────────────

router.get('/settings', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        emailNotifications: true,
        notifySeverity: true,
        quietHoursEnabled: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        dailySummaryEnabled: true,
        dailySummaryTime: true,
        email: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('[Notifications] Settings get error:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

// ─── PUT /api/notifications/settings ────────────────────────────────────────

router.put('/settings', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const data = UpdateSettingsSchema.parse(req.body);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.emailNotifications !== undefined && { emailNotifications: data.emailNotifications }),
        ...(data.notifySeverity !== undefined && { notifySeverity: data.notifySeverity }),
        ...(data.quietHoursEnabled !== undefined && { quietHoursEnabled: data.quietHoursEnabled }),
        ...(data.quietHoursStart !== undefined && { quietHoursStart: data.quietHoursStart }),
        ...(data.quietHoursEnd !== undefined && { quietHoursEnd: data.quietHoursEnd }),
        ...(data.dailySummaryEnabled !== undefined && { dailySummaryEnabled: data.dailySummaryEnabled }),
        ...(data.dailySummaryTime !== undefined && { dailySummaryTime: data.dailySummaryTime }),
      },
      select: {
        emailNotifications: true,
        notifySeverity: true,
        quietHoursEnabled: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        dailySummaryEnabled: true,
        dailySummaryTime: true,
      },
    });

    res.json({ message: 'Notification settings updated', ...updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('[Notifications] Settings update error:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

// ─── POST /api/notifications/test/email ─────────────────────────────────────

router.post('/test/email', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user?.email) {
      return res.status(400).json({ error: 'User email not found' });
    }

    const result = await sendAlertEmail(
      user.email,
      'Test Bildirimi',
      'ObservAI email bildirim sistemi basariyla baglandi! Bu bir test mesajidir.',
      'low',
      'Test'
    );
    res.json(result);
  } catch (error) {
    console.error('[Notifications] Email test error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// ─── POST /api/notifications/test-staff ─────────────────────────────────────
// Dispatch a staff shift notification via email. The audit log at
// backend/logs/notification-dispatch.log records the delivery result.

const TestStaffSchema = z.object({
  staffId: z.string().uuid(),
  // Optional synthetic payload override — lets caller test without creating
  // a real StaffAssignment.
  preview: z.object({
    date: z.string(),
    shiftStart: z.string(),
    shiftEnd: z.string(),
    role: z.string().optional(),
  }).optional(),
});

router.post('/test-staff', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const parsed = TestStaffSchema.parse(req.body);

    const staff = await prisma.staff.findFirst({
      where: { id: parsed.staffId, userId },
    });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    // Preview mode: send directly without creating an assignment row
    if (parsed.preview) {
      const preview = parsed.preview;
      const fullName = `${staff.firstName} ${staff.lastName}`.trim();
      const result: { email?: { sent: boolean; error?: string } } = {};
      const sharedPayload = {
        staffName: fullName,
        branchName: 'Test',
        date: preview.date,
        shiftStart: preview.shiftStart,
        shiftEnd: preview.shiftEnd,
        role: preview.role,
      };

      if (staff.email) {
        const em = await sendStaffShiftEmail(staff.email, sharedPayload);
        result.email = { sent: em.success, error: em.error };
        await prisma.notificationLog.create({
          data: {
            userId,
            staffId: staff.id,
            event: 'test',
            channel: 'email',
            target: staff.email,
            success: em.success,
            error: em.error ?? null,
            payload: JSON.stringify(sharedPayload),
          },
        }).catch(() => {});
      }

      return res.json({ preview: true, result });
    }

    // Real mode: find a real assignment for this staff (latest) and re-notify
    const assignment = await prisma.staffAssignment.findFirst({
      where: { staffId: staff.id },
      orderBy: { date: 'desc' },
    });
    if (!assignment) {
      return res.status(404).json({ error: 'No assignment found for this staff — create one first' });
    }

    const result = await notifyStaffShift(assignment.id);
    return res.json({ assignmentId: assignment.id, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('[Notifications] test-staff error:', error);
    return res.status(500).json({ error: 'Failed to dispatch staff notification' });
  }
});

// ─── GET /api/notifications/summary ─────────────────────────────────────────
// Authenticated KPI feed for the Staffing page. Reports how many emails
// actually left the server in the requested window.

router.get('/summary', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const windowDays = Math.max(1, Math.min(90, parseInt(String(req.query.days ?? '7'), 10) || 7));
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const rows = await prisma.notificationLog.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { channel: true, success: true, event: true, createdAt: true },
    });

    const emailSent = rows.filter((r) => r.channel === 'email' && r.success).length;
    const emailFailed = rows.filter((r) => r.channel === 'email' && !r.success).length;

    res.json({
      windowDays,
      since: since.toISOString(),
      totals: {
        email: { sent: emailSent, failed: emailFailed, total: emailSent + emailFailed },
        all: { sent: emailSent, attempted: rows.length },
      },
    });
  } catch (error) {
    console.error('[Notifications] summary error:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to load notification summary' });
  }
});

// ─── POST /api/notifications/dev-trigger ────────────────────────────────────
//
// Faz 10 Bug #6 — dev-only endpoint to insert a synthetic Insight row of any
// catalog event type so the NotificationsPage UI can be exercised without
// waiting for the live engine to organically trigger one. Gated to NODE_ENV
// !== 'production' so it cannot be hit in a production deploy.
//
// Catalog (mirrors checkRealtimeAlerts + generateInsights triggers):
//   queue_overflow, table_cleaning_overdue, peak_occupancy_threshold,
//   fps_drop, low_visitor_alert, zone_enter_spike,
//   demographic_shift, visitor_surge, engine_offline
//
// Usage:
//   POST /api/notifications/dev-trigger?event=queue_overflow&cameraId=<uuid>
router.post('/dev-trigger', authenticate, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'dev-trigger disabled in production' });
  }
  const event = String(req.query.event || '').toLowerCase();
  const cameraId = String(req.query.cameraId || req.body?.cameraId || '');
  if (!cameraId) {
    return res.status(400).json({ error: 'cameraId query/body required' });
  }
  const CATALOG: Record<string, { type: string; severity: string; title: string; message: string }> = {
    queue_overflow: { type: 'queue_overflow', severity: 'high', title: 'Queue Overflow (DEV)', message: 'Synthetic dev event — current queue length is 7 people.' },
    table_cleaning_overdue: { type: 'table_cleaning', severity: 'medium', title: 'Table Cleaning Overdue (DEV)', message: 'Synthetic dev event — table 3 has been awaiting cleanup for 18 minutes.' },
    peak_occupancy_threshold: { type: 'occupancy_alert', severity: 'high', title: 'Peak Occupancy Threshold (DEV)', message: 'Synthetic dev event — current occupancy 94% of capacity.' },
    fps_drop: { type: 'fps_drop', severity: 'medium', title: 'Low FPS (DEV)', message: 'Synthetic dev event — average FPS 3.2 over the last 10 samples.' },
    low_visitor_alert: { type: 'low_visitor_alert', severity: 'low', title: 'No Visitors Detected (DEV)', message: 'Synthetic dev event — zero visitors during business hour.' },
    zone_enter_spike: { type: 'crowd_surge', severity: 'critical', title: 'Zone Enter Spike (DEV)', message: 'Synthetic dev event — entrance zone enters 2.4x hourly average.' },
    demographic_shift: { type: 'demographic_trend', severity: 'low', title: 'Demographic Shift (DEV)', message: 'Synthetic dev event — dominant gender flipped vs yesterday.' },
    visitor_surge: { type: 'trend', severity: 'medium', title: 'Visitor Surge (DEV)', message: 'Synthetic dev event — today +45% vs yesterday.' },
    engine_offline: { type: 'system_alert', severity: 'high', title: 'Analytics Engine Offline (DEV)', message: 'Synthetic dev event — no analytics samples in 30 minutes.' },
  };
  const spec = CATALOG[event];
  if (!spec) {
    return res.status(400).json({ error: 'unknown event', allowed: Object.keys(CATALOG) });
  }
  try {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const created = await prisma.insight.create({
      data: {
        cameraId,
        type: spec.type,
        severity: spec.severity,
        title: spec.title,
        message: spec.message,
        context: JSON.stringify({ devTrigger: true, event, triggeredAt: today.toISOString() }),
        // Use a unique dateKey per call so the @@unique([cameraId, type, dateKey]) constraint
        // doesn't reject repeated dev triggers within the same day.
        dateKey: `${dateKey}-dev-${Date.now()}`,
      },
    });
    return res.status(201).json({ ok: true, insight: created });
  } catch (err: any) {
    console.error('[Notifications dev-trigger] insert failed:', err);
    return res.status(500).json({ error: 'failed to create insight', detail: err?.message });
  }
});

// ─── GET /api/notifications/channels/status ─────────────────────────────────

router.get('/channels/status', async (_req: Request, res: Response) => {
  try {
    const smtpStatus = await verifySmtp();

    res.json({
      email: {
        configured: smtpStatus.configured,
        connected: smtpStatus.connected,
        error: smtpStatus.error || null,
      },
    });
  } catch (error) {
    console.error('[Notifications] Channel status error:', error);
    res.status(500).json({ error: 'Failed to check channel status' });
  }
});

export default router;
