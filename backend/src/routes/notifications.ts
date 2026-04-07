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
import { sendTelegramTest, verifyTelegramBot } from '../services/telegramService';
import { verifySmtp, sendAlertEmail } from '../services/emailService';

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
