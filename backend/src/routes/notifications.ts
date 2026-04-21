/**
 * Notification Settings & Channels API Routes
 *
 * Endpoints for managing user notification preferences (Telegram, Email, quiet hours).
 *
 * Routes:
 *   GET    /api/notifications/settings          - Get current user's notification settings
 *   PUT    /api/notifications/settings          - Update notification settings
 *   POST   /api/notifications/test/telegram     - Send test Telegram message
 *   POST   /api/notifications/test/email        - Send test email
 *   GET    /api/notifications/channels/status   - Check Telegram bot + SMTP status
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import {
  sendTelegramTest,
  verifyTelegramBot,
  sendStaffAssignmentTelegram,
} from '../services/telegramService';
import {
  verifySmtp,
  sendAlertEmail,
  sendStaffShiftEmail,
} from '../services/emailService';
import { notifyStaffShift } from '../services/notificationDispatcher';

const router = Router();

// ─── Validation ─────────────────────────────────────────────────────────────

const UpdateSettingsSchema = z.object({
  telegramChatId: z.string().nullable().optional(),
  telegramNotifications: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  notifySeverity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().nullable().optional(),
  quietHoursEnd: z.string().nullable().optional(),
  dailySummaryEnabled: z.boolean().optional(),
  dailySummaryTime: z.string().nullable().optional(),
});

// ─── Helper: get userId from session cookie ─────────────────────────────────

async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const token = req.cookies?.session;
  if (!token) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { token },
      select: { userId: true, expiresAt: true },
    });
    if (!session || session.expiresAt < new Date()) return null;
    return session.userId;
  } catch {
    return null;
  }
}

// ─── GET /api/notifications/settings ────────────────────────────────────────

router.get('/settings', async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramChatId: true,
        telegramNotifications: true,
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

router.put('/settings', async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const data = UpdateSettingsSchema.parse(req.body);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.telegramChatId !== undefined && { telegramChatId: data.telegramChatId }),
        ...(data.telegramNotifications !== undefined && { telegramNotifications: data.telegramNotifications }),
        ...(data.emailNotifications !== undefined && { emailNotifications: data.emailNotifications }),
        ...(data.notifySeverity !== undefined && { notifySeverity: data.notifySeverity }),
        ...(data.quietHoursEnabled !== undefined && { quietHoursEnabled: data.quietHoursEnabled }),
        ...(data.quietHoursStart !== undefined && { quietHoursStart: data.quietHoursStart }),
        ...(data.quietHoursEnd !== undefined && { quietHoursEnd: data.quietHoursEnd }),
        ...(data.dailySummaryEnabled !== undefined && { dailySummaryEnabled: data.dailySummaryEnabled }),
        ...(data.dailySummaryTime !== undefined && { dailySummaryTime: data.dailySummaryTime }),
      },
      select: {
        telegramChatId: true,
        telegramNotifications: true,
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

// ─── POST /api/notifications/test/telegram ──────────────────────────────────

router.post('/test/telegram', async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true },
    });

    if (!user?.telegramChatId) {
      return res.status(400).json({ error: 'Telegram chat ID not configured' });
    }

    const result = await sendTelegramTest(user.telegramChatId);
    res.json(result);
  } catch (error) {
    console.error('[Notifications] Telegram test error:', error);
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

// ─── POST /api/notifications/test/email ─────────────────────────────────────

router.post('/test/email', async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

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
// Dispatch a staff shift notification via Telegram + Email. The audit log at
// backend/logs/notification-dispatch.log records the delivery result so the
// user can prove the system actually talks to Telegram/SMTP.

const TestStaffSchema = z.object({
  staffId: z.string().uuid(),
  mode: z.enum(['telegram', 'email', 'both']).default('both'),
  // Optional synthetic payload override — lets caller test without creating
  // a real StaffAssignment.
  preview: z.object({
    date: z.string(),
    shiftStart: z.string(),
    shiftEnd: z.string(),
    role: z.string().optional(),
  }).optional(),
});

router.post('/test-staff', async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const parsed = TestStaffSchema.parse(req.body);

    const staff = await prisma.staff.findFirst({
      where: { id: parsed.staffId, userId },
    });
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    // Preview mode: send directly without creating an assignment row
    if (parsed.preview) {
      const preview = parsed.preview;
      const fullName = `${staff.firstName} ${staff.lastName}`.trim();
      const result: { telegram?: { sent: boolean; error?: string }; email?: { sent: boolean; error?: string } } = {};
      const sharedPayload = {
        staffName: fullName,
        branchName: 'Test',
        date: preview.date,
        shiftStart: preview.shiftStart,
        shiftEnd: preview.shiftEnd,
        role: preview.role,
      };

      if ((parsed.mode === 'telegram' || parsed.mode === 'both') && staff.telegramChatId) {
        const tg = await sendStaffAssignmentTelegram(staff.telegramChatId, sharedPayload);
        result.telegram = { sent: tg.success, error: tg.error };
        await prisma.notificationLog.create({
          data: {
            userId,
            staffId: staff.id,
            event: 'test',
            channel: 'telegram',
            target: staff.telegramChatId,
            success: tg.success,
            error: tg.error ?? null,
            payload: JSON.stringify(sharedPayload),
          },
        }).catch(() => {});
      }

      if ((parsed.mode === 'email' || parsed.mode === 'both') && staff.email) {
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

    const result = await notifyStaffShift(assignment.id, { mode: parsed.mode });
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
// Authenticated KPI feed for the Staffing page. Reports how many notifications
// actually left the server in the requested window, split by channel. The UI
// "BILDIRIM GONDERILDI X/Y" badge reads from here instead of faking the count.

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const windowDays = Math.max(1, Math.min(90, parseInt(String(req.query.days ?? '7'), 10) || 7));
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const rows = await prisma.notificationLog.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { channel: true, success: true, event: true, createdAt: true },
    });

    const telegramSent = rows.filter((r) => r.channel === 'telegram' && r.success).length;
    const telegramFailed = rows.filter((r) => r.channel === 'telegram' && !r.success).length;
    const emailSent = rows.filter((r) => r.channel === 'email' && r.success).length;
    const emailFailed = rows.filter((r) => r.channel === 'email' && !r.success).length;

    res.json({
      windowDays,
      since: since.toISOString(),
      totals: {
        telegram: { sent: telegramSent, failed: telegramFailed, total: telegramSent + telegramFailed },
        email: { sent: emailSent, failed: emailFailed, total: emailSent + emailFailed },
        all: { sent: telegramSent + emailSent, attempted: rows.length },
      },
    });
  } catch (error) {
    console.error('[Notifications] summary error:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to load notification summary' });
  }
});

// ─── GET /api/notifications/channels/status ─────────────────────────────────

router.get('/channels/status', async (req: Request, res: Response) => {
  try {
    const [telegramBot, smtpStatus] = await Promise.all([
      verifyTelegramBot(),
      verifySmtp(),
    ]);

    res.json({
      telegram: {
        configured: !!process.env.TELEGRAM_BOT_TOKEN,
        botValid: telegramBot.valid,
        botName: telegramBot.botName || null,
      },
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
