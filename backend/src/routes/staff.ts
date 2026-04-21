/**
 * Staff (personnel) CRUD routes.
 *
 * Staff records represent individual employees — their name, contact info, and
 * notification channels (telegram chat id, email). Shift assignments are
 * handled separately by staff-assignments.ts.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../lib/db';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

function makeOnboardingToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

const CreateStaffBody = z.object({
  branchId: z.string().optional(),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  phone: z.string().max(32).optional().or(z.literal('').transform(() => undefined)),
  telegramChatId: z.string().max(64).optional().or(z.literal('').transform(() => undefined)),
  role: z.enum(['server', 'chef', 'cashier', 'host', 'manager']).optional(),
  isActive: z.boolean().optional(),
});

const UpdateStaffBody = CreateStaffBody.partial();

/**
 * GET /api/staff
 * Query: ?branchId=...&active=true
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { branchId, active } = req.query as { branchId?: string; active?: string };

  const staff = await prisma.staff.findMany({
    where: {
      userId,
      ...(branchId ? { branchId } : {}),
      ...(active === 'true' ? { isActive: true } : {}),
    },
    orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
  });

  return res.json({ staff });
});

/**
 * POST /api/staff
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = CreateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
  }

  // Seed an onboarding token unless a chat_id was provided up front. The token
  // powers the QR flow — once the staff member taps the deep link and Telegram
  // webhook fires, we store the chat_id and null the token.
  const chatId = parsed.data.telegramChatId ?? null;
  const created = await prisma.staff.create({
    data: {
      userId,
      branchId: parsed.data.branchId ?? null,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      telegramChatId: chatId,
      telegramOnboardingToken: chatId ? null : makeOnboardingToken(),
      role: parsed.data.role ?? 'server',
      isActive: parsed.data.isActive ?? true,
    },
  });

  return res.status(201).json({ staff: created });
});

/**
 * PATCH /api/staff/:id
 */
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = UpdateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
  }

  const existing = await prisma.staff.findFirst({
    where: { id: req.params.id, userId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'Staff not found' });

  const updated = await prisma.staff.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  return res.json({ staff: updated });
});

/**
 * DELETE /api/staff/:id
 * Soft delete by toggling isActive. Hard delete also supported via ?hard=1.
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const existing = await prisma.staff.findFirst({
    where: { id: req.params.id, userId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ error: 'Staff not found' });

  if (req.query.hard === '1') {
    await prisma.staff.delete({ where: { id: existing.id } });
    return res.json({ ok: true, deleted: true });
  }

  await prisma.staff.update({
    where: { id: existing.id },
    data: { isActive: false },
  });
  return res.json({ ok: true, deactivated: true });
});

export default router;
