/**
 * Staff shift assignment routes.
 *
 * Each assignment pairs a Staff member with a specific date + shift window.
 * When created (or explicitly re-notified), we dispatch Telegram + Email
 * notifications with accept/decline links.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../lib/db';
import { authenticate } from '../middleware/authMiddleware';
import { notifyStaffShift } from '../services/notificationDispatcher';

const router = Router();

const TimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const CreateAssignmentBody = z.object({
  staffId: z.string().uuid(),
  branchId: z.string().uuid(),
  date: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date'),
  shiftStart: z.string().regex(TimeRegex, 'HH:MM required'),
  shiftEnd: z.string().regex(TimeRegex, 'HH:MM required'),
  role: z.string().max(40).optional(),
  notes: z.string().max(400).optional(),
  notifyNow: z.boolean().optional(),
});

const NotifyBody = z.object({
  mode: z.enum(['telegram', 'email', 'both']).default('both'),
});

/**
 * GET /api/staff-assignments
 * Query: ?branchId=...&staffId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { branchId, staffId, from, to } = req.query as {
    branchId?: string; staffId?: string; from?: string; to?: string;
  };

  // Narrow to assignments whose staff belongs to this user (ownership check)
  const staffScope = await prisma.staff.findMany({
    where: { userId },
    select: { id: true },
  });
  const staffIds = staffScope.map((s) => s.id);

  const assignments = await prisma.staffAssignment.findMany({
    where: {
      staffId: staffId ? staffId : { in: staffIds },
      ...(branchId ? { branchId } : {}),
      ...(from ? { date: { gte: new Date(from) } } : {}),
      ...(to ? { date: { lte: new Date(to) } } : {}),
    },
    include: { staff: true },
    orderBy: [{ date: 'asc' }, { shiftStart: 'asc' }],
  });

  return res.json({ assignments });
});

/**
 * POST /api/staff-assignments
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = CreateAssignmentBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
  }

  // Ownership check
  const staff = await prisma.staff.findFirst({
    where: { id: parsed.data.staffId, userId },
    select: { id: true },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  const acceptToken = crypto.randomBytes(24).toString('hex');

  const created = await prisma.staffAssignment.create({
    data: {
      staffId: parsed.data.staffId,
      branchId: parsed.data.branchId,
      date: new Date(parsed.data.date),
      shiftStart: parsed.data.shiftStart,
      shiftEnd: parsed.data.shiftEnd,
      role: parsed.data.role ?? null,
      notes: parsed.data.notes ?? null,
      acceptToken,
      createdBy: userId,
    },
    include: { staff: true },
  });

  let notifyResult = null;
  if (parsed.data.notifyNow !== false) {
    notifyResult = await notifyStaffShift(created.id);
  }

  return res.status(201).json({ assignment: created, notification: notifyResult });
});

/**
 * POST /api/staff-assignments/:id/notify
 */
router.post('/:id/notify', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = NotifyBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
  }

  const assignment = await prisma.staffAssignment.findFirst({
    where: { id: req.params.id, staff: { userId } },
    select: { id: true },
  });
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  const result = await notifyStaffShift(assignment.id, { mode: parsed.data.mode });
  return res.json({ result });
});

/**
 * PATCH /api/staff-assignments/:id
 */
const UpdateAssignmentBody = z.object({
  shiftStart: z.string().regex(TimeRegex).optional(),
  shiftEnd: z.string().regex(TimeRegex).optional(),
  role: z.string().max(40).optional(),
  status: z.enum(['pending', 'accepted', 'declined', 'completed']).optional(),
  notes: z.string().max(400).optional(),
});
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = UpdateAssignmentBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
  }

  const assignment = await prisma.staffAssignment.findFirst({
    where: { id: req.params.id, staff: { userId } },
    select: { id: true },
  });
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  const updated = await prisma.staffAssignment.update({
    where: { id: assignment.id },
    data: parsed.data,
  });
  return res.json({ assignment: updated });
});

/**
 * DELETE /api/staff-assignments/:id
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const assignment = await prisma.staffAssignment.findFirst({
    where: { id: req.params.id, staff: { userId } },
    select: { id: true },
  });
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  await prisma.staffAssignment.delete({ where: { id: assignment.id } });
  return res.json({ ok: true });
});

/**
 * GET /api/staff-assignments/:id/accept?token=...
 * PUBLIC endpoint (no auth) — staff clicks link from email/telegram.
 */
router.get('/:id/accept', async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };
  if (!token) return res.status(400).send('Missing token');

  const assignment = await prisma.staffAssignment.findUnique({
    where: { id: req.params.id },
  });
  if (!assignment || assignment.acceptToken !== token) {
    return res.status(404).send('Gecersiz veya sona ermis bir baglanti.');
  }

  await prisma.staffAssignment.update({
    where: { id: assignment.id },
    data: { status: 'accepted' },
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vardiya Onaylandi</title>
<style>body{background:#0f0f14;color:#e5e5e5;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
.card{background:#1a1a24;padding:32px;border-radius:12px;max-width:420px;text-align:center;border:1px solid #2a2a3a;}</style></head>
<body><div class="card"><h2 style="color:#22c55e;margin:0 0 12px;">&#x2705; Vardiya Onaylandi</h2>
<p style="color:#a0a0b0;">Bu pencereyi kapatabilirsiniz. Vardiya planindasiniz.</p></div></body></html>`);
});

/**
 * GET /api/staff-assignments/:id/decline?token=...
 */
router.get('/:id/decline', async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };
  if (!token) return res.status(400).send('Missing token');

  const assignment = await prisma.staffAssignment.findUnique({
    where: { id: req.params.id },
  });
  if (!assignment || assignment.acceptToken !== token) {
    return res.status(404).send('Gecersiz veya sona ermis bir baglanti.');
  }

  await prisma.staffAssignment.update({
    where: { id: assignment.id },
    data: { status: 'declined' },
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vardiya Reddedildi</title>
<style>body{background:#0f0f14;color:#e5e5e5;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
.card{background:#1a1a24;padding:32px;border-radius:12px;max-width:420px;text-align:center;border:1px solid #2a2a3a;}</style></head>
<body><div class="card"><h2 style="color:#ef4444;margin:0 0 12px;">&#x274C; Vardiya Reddedildi</h2>
<p style="color:#a0a0b0;">Yoneticiniz bilgilendirilecek.</p></div></body></html>`);
});

export default router;
