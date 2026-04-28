/**
 * Yan #3 — Server-side session invalidation via revokedAt.
 *
 * Logout MUST stamp revokedAt (soft-revoke, audit-friendly) instead of
 * hard-deleting the row. authenticate() then rejects revoked sessions
 * with 401 even if the cookie is replayed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sessionUpdateMany = vi.fn();
const sessionFindUnique = vi.fn();
const sessionDelete = vi.fn();

vi.mock('../lib/db', () => ({
  prisma: {
    session: {
      updateMany: (...args: any[]) => sessionUpdateMany(...args),
      findUnique: (...args: any[]) => sessionFindUnique(...args),
      delete: (...args: any[]) => sessionDelete(...args),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    passwordReset: {
      create: vi.fn(),
    },
  },
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
  hash: vi.fn(),
  compare: vi.fn(),
}));

vi.mock('../services/emailService', () => ({
  sendPasswordResetEmail: vi.fn(),
}));

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRouter from '../routes/auth';
import { authenticate } from '../middleware/authMiddleware';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.get('/api/protected', authenticate, (req: any, res) => {
    res.json({ ok: true, userId: req.user.id });
  });
  return app;
}

describe('Yan #3 — sessions.revokedAt server-side invalidation', () => {
  beforeEach(() => {
    sessionUpdateMany.mockReset();
    sessionFindUnique.mockReset();
    sessionDelete.mockReset();
  });

  it('logout calls updateMany with revokedAt set, not delete', async () => {
    sessionUpdateMany.mockResolvedValue({ count: 1 });
    const app = makeApp();
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'session_token=abc123');
    expect(res.status).toBe(200);
    expect(sessionUpdateMany).toHaveBeenCalledTimes(1);
    expect(sessionDelete).not.toHaveBeenCalled();
    const call = sessionUpdateMany.mock.calls[0][0];
    expect(call.where.token).toBe('abc123');
    expect(call.where.revokedAt).toBeNull();
    expect(call.data.revokedAt).toBeInstanceOf(Date);
  });

  it('authenticate rejects request with revokedAt set (replay)', async () => {
    sessionFindUnique.mockResolvedValue({
      id: 's1',
      token: 'abc123',
      userId: 'u1',
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: new Date(),
      user: { id: 'u1', email: 'a@b.com' },
    });
    const app = makeApp();
    const res = await request(app)
      .get('/api/protected')
      .set('Cookie', 'session_token=abc123');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/revoked/i);
    expect(sessionDelete).not.toHaveBeenCalled();
  });

  it('authenticate accepts active session (revokedAt null)', async () => {
    sessionFindUnique.mockResolvedValue({
      id: 's2',
      token: 'def456',
      userId: 'u2',
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      user: { id: 'u2', email: 'b@b.com' },
    });
    const app = makeApp();
    const res = await request(app)
      .get('/api/protected')
      .set('Cookie', 'session_token=def456');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.userId).toBe('u2');
  });
});
