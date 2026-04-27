/**
 * User management API routes.
 *
 * Self-service profile only. Account creation goes through /api/auth/register;
 * any cross-user listing or lookup is intentionally absent — the previous
 * GET / and GET /:id routes leaked the full user table to anyone who could
 * reach the API.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { authenticate } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/roleCheck';

const router = Router();

// GET /api/users - Admin only: list users.
router.get('/', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/me - Return the caller's profile (alias for /api/auth/me).
router.get('/me', authenticate, (req: Request, res: Response) => {
  const u = req.user;
  res.json({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    accountType: u.accountType || 'TRIAL',
    trialExpiresAt: u.trialExpiresAt?.toISOString() || null,
  });
});

// PATCH /api/users/profile - Update own profile.
router.patch('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const ProfileSchema = z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    });

    const data = ProfileSchema.parse(req.body);

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        accountType: true,
        trialExpiresAt: true,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
