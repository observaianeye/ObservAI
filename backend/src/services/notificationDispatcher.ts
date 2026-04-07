/**
 * Notification Dispatcher
 *
 * Orchestrates notification delivery across channels:
 *   - In-App: Always (saved to DB via insightEngine)
 *   - Telegram: severity >= user's notifySeverity threshold
 *   - Email: severity >= user's notifySeverity threshold (if emailNotifications enabled)
 *
 * Respects quiet hours and rate limiting.
 */

import { prisma } from '../lib/db';
import { sendTelegramMessage } from './telegramService';
import { sendAlertEmail } from './emailService';

// Severity levels ordered from lowest to highest
const SEVERITY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

interface DispatchResult {
  telegram: { sent: number; failed: number };
  email: { sent: number; failed: number };
}

interface InsightPayload {
  type: string;
  severity: string;
  title: string;
  message: string;
  cameraId: string;
  cameraName?: string;
}

/**
 * Dispatch a notification to all eligible users for a given insight.
 */
export async function dispatchNotification(insight: InsightPayload): Promise<DispatchResult> {
  const result: DispatchResult = {
    telegram: { sent: 0, failed: 0 },
    email: { sent: 0, failed: 0 },
  };

  // Only dispatch for severity >= medium (low = info only, saved to DB)
  const insightRank = SEVERITY_RANK[insight.severity] ?? 0;
  if (insightRank < SEVERITY_RANK.medium) {
    return result;
  }

  try {
    // Get all active users with notification settings
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        telegramChatId: true,
        telegramNotifications: true,
        emailNotifications: true,
        notifySeverity: true,
        quietHoursEnabled: true,
        quietHoursStart: true,
        quietHoursEnd: true,
      },
    });

    for (const user of users) {
      // Check if insight severity meets user's minimum threshold
      const userMinRank = SEVERITY_RANK[user.notifySeverity] ?? SEVERITY_RANK.high;
      if (insightRank < userMinRank) continue;

      // Check quiet hours
      if (user.quietHoursEnabled && isInQuietHours(user.quietHoursStart, user.quietHoursEnd)) {
        continue;
      }

      // Telegram
      if (user.telegramNotifications && user.telegramChatId) {
        const tgResult = await sendTelegramMessage(
          user.telegramChatId,
          insight.title,
          insight.message,
          insight.severity,
          insight.cameraName
        );
        if (tgResult.success) {
          result.telegram.sent++;
        } else {
          result.telegram.failed++;
        }
      }

      // Email
      if (user.emailNotifications && user.email) {
        const emailResult = await sendAlertEmail(
          user.email,
          insight.title,
          insight.message,
          insight.severity,
          insight.cameraName
        );
        if (emailResult.success) {
          result.email.sent++;
        } else {
          result.email.failed++;
        }
      }
    }
  } catch (err) {
    console.error('[Dispatcher] Error dispatching notification:', err instanceof Error ? err.message : err);
  }

  if (result.telegram.sent > 0 || result.email.sent > 0) {
    console.log(
      `[Dispatcher] ${insight.severity.toUpperCase()} "${insight.title}" → ` +
      `Telegram: ${result.telegram.sent} sent, Email: ${result.email.sent} sent`
    );
  }

  return result;
}

/**
 * Dispatch notifications for a batch of insights (e.g. from generateInsights).
 */
export async function dispatchBatch(insights: InsightPayload[]): Promise<DispatchResult> {
  const totals: DispatchResult = {
    telegram: { sent: 0, failed: 0 },
    email: { sent: 0, failed: 0 },
  };

  for (const insight of insights) {
    const r = await dispatchNotification(insight);
    totals.telegram.sent += r.telegram.sent;
    totals.telegram.failed += r.telegram.failed;
    totals.email.sent += r.email.sent;
    totals.email.failed += r.email.failed;
  }

  return totals;
}

/**
 * Check if current time falls within quiet hours.
 * quietHoursStart/End are "HH:MM" strings in local time.
 */
function isInQuietHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  if (startMinutes <= endMinutes) {
    // Same day range: e.g. 09:00 - 17:00
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range: e.g. 22:00 - 08:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}
