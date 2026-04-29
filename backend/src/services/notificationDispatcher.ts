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

// Yan #6: shared audit hook for non-staff-shift dispatch paths (password
// reset email, daily summary, etc.). The file log used to only contain
// staff_shift entries; non-staff dispatches were invisible to ops.
export function appendNotificationAudit(entry: {
  event: string;
  channel: 'email';
  target?: string | null;
  success: boolean;
  error?: string | null;
  [k: string]: unknown;
}): void {
  writeAudit(entry);
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

// Faz 11 anti-spam pillars
//
//  1. Default severity gate is HIGH (was MEDIUM). Low/medium alerts stay in
//     the in-app inbox only. The previous default emailed routine signals
//     like "Peak Hour Approaching" every cron tick, which was the loudest
//     spam contributor on the user's inbox.
//  2. Per-(userId, cameraId, type) cooldown. We query NotificationLog for a
//     prior successful dispatch within COOLDOWN_HOURS and skip if found —
//     stops every cron tick / Notifications-refresh from refiring the same
//     "Analytics Engine Offline" / "High Occupancy Alert" pair.
//  3. Owner-scoped recipients. Old dispatcher fanned out to every active
//     user in the DB, which means any seeded test account
//     (smoke-…@observai.test, retro_…@observai.test, etc.) received every
//     production alert. Now we only email the user who owns the camera
//     (camera.createdBy → User).
//  4. Synthetic-target blocklist. Even when the owner row points at a fake
//     domain (.test/.example/etc.) or a tagged username (smoke-, retro_,
//     sweep+, test_, faz_), we refuse to dispatch. Defensive — these
//     accounts shouldn't have real inboxes.
const DEFAULT_MIN_SEVERITY = SEVERITY_RANK.high;
const COOLDOWN_HOURS = Number(process.env.ALERT_COOLDOWN_HOURS || 6);
const BLOCKED_EMAIL_DEFAULT = [
  /\.test$/i,                     // any .test TLD
  /@(?:test|example)\.(?:com|org|net)$/i,
  /@observai\.test$/i,
  /^(?:smoke|retro_|retro-|sweep|test_|faz_|e2e|deneme|dev_)[^@]*@/i,
];

function compileBlocklist(): RegExp[] {
  const env = process.env.EMAIL_BLOCKLIST_PATTERNS;
  if (!env) return BLOCKED_EMAIL_DEFAULT;
  const parts = env.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return BLOCKED_EMAIL_DEFAULT;
  try {
    return parts.map((p) => new RegExp(p, 'i'));
  } catch (err) {
    console.warn('[Dispatcher] Invalid EMAIL_BLOCKLIST_PATTERNS, using defaults:', err instanceof Error ? err.message : err);
    return BLOCKED_EMAIL_DEFAULT;
  }
}

const BLOCKED_EMAIL_PATTERNS = compileBlocklist();

function isBlockedRecipient(email: string): boolean {
  return BLOCKED_EMAIL_PATTERNS.some((rx) => rx.test(email));
}

/**
 * Look up the most recent successful alert email sent to this user for
 * (cameraId, type) within the cooldown window. Returns true when one exists
 * — caller skips the dispatch.
 *
 * The lookup uses NotificationLog.payload (a JSON string) and matches on the
 * cooldownKey we embed at write time. SQLite doesn't have JSON ops, so this
 * is a `LIKE %"cooldownKey":"<key>"%` substring scan — bounded by the
 * createdAt index and per-user filter, the row count stays small.
 */
async function isWithinCooldown(userId: string, cameraId: string, type: string): Promise<boolean> {
  if (COOLDOWN_HOURS <= 0) return false;
  const since = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
  const cooldownKey = `${cameraId}:${type}`;
  try {
    const recent = await prisma.notificationLog.findFirst({
      where: {
        userId,
        event: 'alert',
        channel: 'email',
        success: true,
        createdAt: { gte: since },
        payload: { contains: `"cooldownKey":"${cooldownKey}"` },
      },
      select: { id: true },
    });
    return !!recent;
  } catch (err) {
    console.warn('[Dispatcher] cooldown lookup failed (allowing send):', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Resolve the owner User for a camera. Returns null when the camera or its
 * owner row is missing — caller treats that as "no eligible recipient".
 */
async function findCameraOwner(cameraId: string): Promise<{
  id: string;
  email: string | null;
  emailNotifications: boolean;
  notifySeverity: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
} | null> {
  try {
    const cam = await prisma.camera.findUnique({
      where: { id: cameraId },
      select: { createdBy: true },
    });
    if (!cam?.createdBy) return null;
    const user = await prisma.user.findUnique({
      where: { id: cam.createdBy },
      select: {
        id: true,
        email: true,
        emailNotifications: true,
        notifySeverity: true,
        quietHoursEnabled: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) return null;
    return user;
  } catch (err) {
    console.warn('[Dispatcher] owner lookup failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

interface DispatchResult {
  email: { sent: number; failed: number; skipped: number };
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
 * Dispatch a notification to the owner of the camera, subject to severity
 * gate, cooldown window, blocklist filter, and quiet hours. Email-only.
 */
export async function dispatchNotification(insight: InsightPayload): Promise<DispatchResult> {
  const result: DispatchResult = {
    email: { sent: 0, failed: 0, skipped: 0 },
  };

  const insightRank = SEVERITY_RANK[insight.severity] ?? 0;
  // Hard floor: low alerts never leave the in-app inbox.
  if (insightRank < SEVERITY_RANK.medium) {
    return result;
  }

  try {
    const owner = await findCameraOwner(insight.cameraId);
    if (!owner) {
      return result; // no eligible recipient
    }

    // User-level severity threshold. notifySeverity defaults to 'high' on
    // new accounts; legacy rows that explicitly opted into 'medium' still
    // get those alerts — the global default below only governs unset users.
    const userMinRank = SEVERITY_RANK[owner.notifySeverity] ?? DEFAULT_MIN_SEVERITY;
    if (insightRank < userMinRank) {
      result.email.skipped++;
      return result;
    }

    // Quiet hours
    if (owner.quietHoursEnabled && isInQuietHours(owner.quietHoursStart, owner.quietHoursEnd)) {
      result.email.skipped++;
      return result;
    }

    if (!owner.emailNotifications || !owner.email) {
      return result;
    }

    if (isBlockedRecipient(owner.email)) {
      result.email.skipped++;
      writeAudit({
        event: 'alert',
        channel: 'email',
        userId: owner.id,
        target: owner.email,
        success: false,
        error: 'blocked_synthetic_recipient',
        severity: insight.severity,
        title: insight.title,
      });
      return result;
    }

    if (await isWithinCooldown(owner.id, insight.cameraId, insight.type)) {
      result.email.skipped++;
      writeAudit({
        event: 'alert',
        channel: 'email',
        userId: owner.id,
        target: owner.email,
        success: false,
        error: 'cooldown',
        severity: insight.severity,
        title: insight.title,
        cameraId: insight.cameraId,
        type: insight.type,
      });
      return result;
    }

    const emailResult = await sendAlertEmail(
      owner.email,
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
    const cooldownKey = `${insight.cameraId}:${insight.type}`;
    await writeNotificationLog({
      userId: owner.id,
      event: 'alert',
      channel: 'email',
      target: owner.email,
      success: emailResult.success,
      error: emailResult.error,
      payload: {
        title: insight.title,
        severity: insight.severity,
        cameraName: insight.cameraName,
        cameraId: insight.cameraId,
        type: insight.type,
        cooldownKey,
      },
    });
    writeAudit({
      event: 'alert',
      channel: 'email',
      userId: owner.id,
      target: owner.email,
      success: emailResult.success,
      error: emailResult.error ?? null,
      severity: insight.severity,
      title: insight.title,
      cameraId: insight.cameraId,
      type: insight.type,
    });
  } catch (err) {
    console.error('[Dispatcher] Error dispatching notification:', err instanceof Error ? err.message : err);
  }

  if (result.email.sent > 0 || result.email.skipped > 0) {
    console.log(
      `[Dispatcher] ${insight.severity.toUpperCase()} "${insight.title}" → ` +
      `Email sent=${result.email.sent} skipped=${result.email.skipped} failed=${result.email.failed}`
    );
  }

  return result;
}

/**
 * Dispatch notifications for a batch of insights (e.g. from generateInsights).
 */
export async function dispatchBatch(insights: InsightPayload[]): Promise<DispatchResult> {
  const totals: DispatchResult = {
    email: { sent: 0, failed: 0, skipped: 0 },
  };

  for (const insight of insights) {
    const r = await dispatchNotification(insight);
    totals.email.sent += r.email.sent;
    totals.email.failed += r.email.failed;
    totals.email.skipped += r.email.skipped;
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
