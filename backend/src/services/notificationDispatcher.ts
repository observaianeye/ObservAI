/**
 * Notification Dispatcher
 *
 * Email-only dispatch. Telegram was removed per product decision — the
 * in-app inbox stays as the always-on channel (saved to DB via
 * insightEngine), and email is the single outbound channel for alerts
 * and staff shift notifications.
 *
 * Respects quiet hours and rate limiting.
 */

import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/db';
import { sendAlertEmail, sendStaffShiftEmail } from './emailService';

// Append-only audit log for notification dispatches.
// The user asked for proof that notifications are working — this file is the
// audit trail. Each delivery (success or failure) appends one JSON line.
const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'notification-dispatch.log');

function ensureLogDir(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    // best-effort
  }
}

function writeAudit(entry: Record<string, unknown>): void {
  ensureLogDir();
  try {
    fs.appendFileSync(
      LOG_FILE,
      JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n',
      'utf8'
    );
  } catch (err) {
    console.error('[Dispatcher] Audit log write failed:', err);
  }
}

interface NotificationLogEntry {
  userId?: string | null;
  staffId?: string | null;
  assignmentId?: string | null;
  event: 'staff_shift' | 'alert' | 'test' | 'onboarding';
  channel: 'email';
  target?: string | null;
  success: boolean;
  messageId?: string | null;
  error?: string | null;
  payload?: unknown;
}

/**
 * Persist a single notification attempt to the DB. Never throws — this must
 * never break the dispatch pipeline. The file log (writeAudit) remains the
 * source of truth for debugging; the DB row is for the admin UI.
 */
async function writeNotificationLog(entry: NotificationLogEntry): Promise<void> {
  try {
    await prisma.notificationLog.create({
      data: {
        userId: entry.userId ?? null,
        staffId: entry.staffId ?? null,
        assignmentId: entry.assignmentId ?? null,
        event: entry.event,
        channel: entry.channel,
        target: entry.target ?? null,
        success: entry.success,
        messageId: entry.messageId ?? null,
        error: entry.error ?? null,
        payload: entry.payload ? JSON.stringify(entry.payload) : null,
      },
    });
  } catch (err) {
    console.error('[Dispatcher] notification log persist failed:', err instanceof Error ? err.message : err);
  }
}

// Severity levels ordered from lowest to highest
const SEVERITY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

interface DispatchResult {
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
        await writeNotificationLog({
          userId: user.id,
          event: 'alert',
          channel: 'email',
          target: user.email,
          success: emailResult.success,
          error: emailResult.error,
          payload: { title: insight.title, severity: insight.severity, cameraName: insight.cameraName },
        });
      }
    }
  } catch (err) {
    console.error('[Dispatcher] Error dispatching notification:', err instanceof Error ? err.message : err);
  }

  if (result.email.sent > 0) {
    console.log(
      `[Dispatcher] ${insight.severity.toUpperCase()} "${insight.title}" → ` +
      `Email: ${result.email.sent} sent`
    );
  }

  return result;
}

/**
 * Dispatch notifications for a batch of insights (e.g. from generateInsights).
 */
export async function dispatchBatch(insights: InsightPayload[]): Promise<DispatchResult> {
  const totals: DispatchResult = {
    email: { sent: 0, failed: 0 },
  };

  for (const insight of insights) {
    const r = await dispatchNotification(insight);
    totals.email.sent += r.email.sent;
    totals.email.failed += r.email.failed;
  }

  return totals;
}

interface StaffShiftDispatchResult {
  email: { sent: boolean; error?: string };
}

/**
 * Dispatch a staff shift assignment notification via email.
 *
 * The caller provides the assignment ID; this function loads the full record,
 * constructs the shareable accept/decline URLs, sends the email, and persists
 * the delivery status back to the assignment row.
 */
export async function notifyStaffShift(
  assignmentId: string,
  options: {
    publicBaseUrl?: string; // e.g. "https://observai.local" — for accept/decline links
  } = {}
): Promise<StaffShiftDispatchResult> {
  const baseUrl = options.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001';

  const result: StaffShiftDispatchResult = {
    email: { sent: false },
  };

  const assignment = await prisma.staffAssignment.findUnique({
    where: { id: assignmentId },
    include: { staff: true },
  });
  if (!assignment) {
    writeAudit({ event: 'staff_shift', id: assignmentId, error: 'assignment_not_found' });
    return result;
  }

  const branch = await prisma.branch.findUnique({
    where: { id: assignment.branchId },
    select: { name: true },
  });

  const fullName = `${assignment.staff.firstName} ${assignment.staff.lastName}`.trim();
  const dateStr = assignment.date.toLocaleDateString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const token = assignment.acceptToken || '';
  const acceptUrl = token ? `${baseUrl}/api/staff-assignments/${assignmentId}/accept?token=${token}` : undefined;
  const declineUrl = token ? `${baseUrl}/api/staff-assignments/${assignmentId}/decline?token=${token}` : undefined;

  const payload = {
    staffName: fullName,
    branchName: branch?.name ?? 'Sube',
    date: dateStr,
    shiftStart: assignment.shiftStart,
    shiftEnd: assignment.shiftEnd,
    role: assignment.role ?? undefined,
    acceptUrl,
    declineUrl,
  };

  if (assignment.staff.email) {
    const em = await sendStaffShiftEmail(assignment.staff.email, payload);
    result.email = { sent: em.success, error: em.error };
    writeAudit({
      event: 'staff_shift',
      channel: 'email',
      assignmentId,
      staffId: assignment.staff.id,
      email: assignment.staff.email,
      success: em.success,
      error: em.error,
    });
    await writeNotificationLog({
      userId: assignment.staff.userId,
      staffId: assignment.staff.id,
      assignmentId,
      event: 'staff_shift',
      channel: 'email',
      target: assignment.staff.email,
      success: em.success,
      error: em.error,
      payload,
    });
  } else {
    result.email.error = 'email not set';
    writeAudit({
      event: 'staff_shift', channel: 'email', assignmentId, success: false,
      error: 'email not set',
    });
    await writeNotificationLog({
      userId: assignment.staff.userId,
      staffId: assignment.staff.id,
      assignmentId,
      event: 'staff_shift',
      channel: 'email',
      success: false,
      error: 'email not set',
    });
  }

  // Persist delivery status
  await prisma.staffAssignment.update({
    where: { id: assignmentId },
    data: {
      notifiedViaEmail: result.email.sent,
      notifiedAt: result.email.sent ? new Date() : null,
    },
  });

  return result;
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
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  // Handle overnight quiet hours (e.g. 22:00 - 06:00)
  if (startMin > endMin) {
    return currentMinutes >= startMin || currentMinutes < endMin;
  }
  return currentMinutes >= startMin && currentMinutes < endMin;
}
