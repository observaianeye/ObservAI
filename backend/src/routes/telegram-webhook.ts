/**
 * Telegram webhook + onboarding link routes (ADIM 19).
 *
 * Flow:
 *   1. Owner creates a Staff record → backend issues a single-use onboarding
 *      token (random 32 chars, unique).
 *   2. Frontend renders a QR code / deep link: t.me/<BOT_USERNAME>?start=<token>
 *   3. Staff scans the QR, presses "Start" inside Telegram, which sends
 *      "/start <token>" back to the bot.
 *   4. Telegram delivers the update to POST /api/webhooks/telegram. We look up
 *      the staff row by token, persist the chat_id, clear the token, and send
 *      a confirmation message back to the user.
 *
 * Security notes:
 *   - The token is single-use and not guessable (randomBytes + hex).
 *   - In production, set `TELEGRAM_WEBHOOK_SECRET` and configure the Telegram
 *     bot with `setWebhook?secret_token=...`; Telegram then sends the header
 *     `X-Telegram-Bot-Api-Secret-Token` on every request. We reject mismatches.
 *   - Without the secret env var we accept all requests (dev fallback); the
 *     worst outcome is a garbage chat_id binding to an already-revoked token,
 *     which simply fails to find a match.
 */

import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { authenticate } from '../middleware/authMiddleware';
import { sendTelegramMessage } from '../services/telegramService';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateOnboardingToken(): string {
  return crypto.randomBytes(16).toString('hex'); // 32-char hex
}

function botUsername(): string | null {
  const raw = process.env.TELEGRAM_BOT_USERNAME;
  if (!raw) return null;
  return raw.replace(/^@/, '').trim() || null;
}

// ─── POST /api/webhooks/telegram (Telegram → backend) ──────────────────────

router.post('/telegram', async (req: Request, res: Response) => {
  // Verify Telegram's secret header in production.
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const incoming = req.header('X-Telegram-Bot-Api-Secret-Token');
    if (incoming !== expectedSecret) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
  }

  // Always 200 back to Telegram to prevent retries, even on internal errors.
  try {
    const message = req.body?.message;
    const text: string | undefined = message?.text;
    const chatId: number | undefined = message?.chat?.id;

    if (!text || !chatId || !text.startsWith('/start')) {
      return res.status(200).json({ ok: true });
    }

    const token = text.replace('/start', '').trim();
    if (!token) {
      // Plain /start without a payload — send guidance and exit.
      await sendTelegramMessage(
        String(chatId),
        'ObservAI',
        'Lutfen yoneticinizin verdigi baglantiyi kullanin. Ornek: https://t.me/BOT?start=TOKEN',
        'low'
      );
      return res.status(200).json({ ok: true });
    }

    const staff = await prisma.staff.findUnique({
      where: { telegramOnboardingToken: token },
      select: { id: true, userId: true, firstName: true, lastName: true },
    });
    if (!staff) {
      await sendTelegramMessage(
        String(chatId),
        'ObservAI',
        'Bu baglanti artik gecerli degil. Yoneticinizden yeni bir baglanti isteyin.',
        'low'
      );
      return res.status(200).json({ ok: true });
    }

    await prisma.staff.update({
      where: { id: staff.id },
      data: {
        telegramChatId: String(chatId),
        telegramOnboardingToken: null, // single-use: invalidate immediately
      },
    });

    await prisma.notificationLog.create({
      data: {
        userId: staff.userId,
        staffId: staff.id,
        event: 'onboarding',
        channel: 'telegram',
        target: String(chatId),
        success: true,
        payload: JSON.stringify({ firstName: staff.firstName, lastName: staff.lastName }),
      },
    }).catch(() => {});

    await sendTelegramMessage(
      String(chatId),
      'ObservAI - Baglanti Basarili',
      `Merhaba ${staff.firstName}! Bildirim hesabiniz bagland\u0131. Vardiya atandiginda buradan bilgi alacaksiniz.`,
      'low'
    );

    return res.status(200).json({ ok: true, staffId: staff.id });
  } catch (err) {
    console.error('[telegram-webhook]', err instanceof Error ? err.message : err);
    // Swallow; Telegram will retry if we 5xx.
    return res.status(200).json({ ok: true });
  }
});

// ─── GET /api/webhooks/telegram/link/:staffId ──────────────────────────────
// Returns the deep-link URL for the caller to render as a QR code. Issues (or
// rotates) the onboarding token on demand.

router.get('/telegram/link/:staffId', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const bot = botUsername();
  if (!bot) {
    return res.status(503).json({ error: 'TELEGRAM_BOT_USERNAME not configured' });
  }

  const staff = await prisma.staff.findFirst({
    where: { id: req.params.staffId, userId },
    select: { id: true, telegramChatId: true, telegramOnboardingToken: true },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  if (staff.telegramChatId) {
    return res.json({
      alreadyLinked: true,
      chatId: staff.telegramChatId,
      url: null,
      botUsername: bot,
    });
  }

  let token = staff.telegramOnboardingToken;
  if (!token) {
    token = generateOnboardingToken();
    await prisma.staff.update({ where: { id: staff.id }, data: { telegramOnboardingToken: token } });
  }

  const url = `https://t.me/${bot}?start=${token}`;
  res.json({ alreadyLinked: false, url, botUsername: bot, token });
});

// ─── POST /api/webhooks/telegram/link/:staffId/rotate ──────────────────────
// Force-rotate the onboarding token (useful if the old link leaked).

const RotateBody = z.object({}).optional();

router.post('/telegram/link/:staffId/rotate', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  RotateBody.parse(req.body ?? {}); // noop but enforces body shape

  const bot = botUsername();
  if (!bot) return res.status(503).json({ error: 'TELEGRAM_BOT_USERNAME not configured' });

  const staff = await prisma.staff.findFirst({
    where: { id: req.params.staffId, userId },
    select: { id: true },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  const token = generateOnboardingToken();
  await prisma.staff.update({
    where: { id: staff.id },
    data: { telegramOnboardingToken: token, telegramChatId: null },
  });

  res.json({ url: `https://t.me/${bot}?start=${token}`, token, botUsername: bot });
});

// ─── DELETE /api/webhooks/telegram/link/:staffId ───────────────────────────
// Unlink a staff member from their Telegram chat.

router.delete('/telegram/link/:staffId', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const staff = await prisma.staff.findFirst({
    where: { id: req.params.staffId, userId },
    select: { id: true },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  await prisma.staff.update({
    where: { id: staff.id },
    data: { telegramChatId: null, telegramOnboardingToken: null },
  });

  res.json({ ok: true });
});

export default router;
