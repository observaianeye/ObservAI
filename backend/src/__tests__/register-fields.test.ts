/**
 * Yan #2 — Register handler MUST persist firstName/lastName/companyName
 * when they are provided in the payload (previously the schema dropped them
 * silently and only `name` was honored, leaving the user profile blank).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed'),
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: vi.fn().mockResolvedValue('hashed'),
  compare: vi.fn().mockResolvedValue(true),
}));

vi.mock('../middleware/authMiddleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'u1', role: 'MANAGER' };
    next();
  },
}));

vi.mock('../services/emailService', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}));

const userCreate = vi.fn();
const sessionCreate = vi.fn().mockResolvedValue({ id: 'sess1' });

vi.mock('../lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: (...args: any[]) => userCreate(...args),
    },
    session: {
      create: (...args: any[]) => sessionCreate(...args),
    },
  },
}));

import authRouter from '../routes/auth';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

describe('Yan #2 — register accepts firstName/lastName/companyName', () => {
  beforeEach(() => {
    userCreate.mockReset();
    sessionCreate.mockClear();
  });

  it('persists explicit firstName/lastName/companyName from payload', async () => {
    userCreate.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      companyName: 'Analytical Co',
      role: 'MANAGER',
      accountType: 'TRIAL',
      trialExpiresAt: new Date(),
    });
    const app = makeApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'a@b.com',
        password: 'password123',
        firstName: 'Ada',
        lastName: 'Lovelace',
        companyName: 'Analytical Co',
      });
    expect(res.status).toBe(201);
    expect(userCreate).toHaveBeenCalledTimes(1);
    const data = userCreate.mock.calls[0][0].data;
    expect(data.firstName).toBe('Ada');
    expect(data.lastName).toBe('Lovelace');
    expect(data.companyName).toBe('Analytical Co');
  });

  it('still accepts legacy `name` and splits into first/last', async () => {
    userCreate.mockResolvedValue({
      id: 'u2',
      email: 'b@b.com',
      firstName: 'Charles',
      lastName: 'Babbage',
      companyName: null,
      role: 'MANAGER',
      accountType: 'TRIAL',
      trialExpiresAt: new Date(),
    });
    const app = makeApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'b@b.com',
        password: 'password123',
        name: 'Charles Babbage',
      });
    expect(res.status).toBe(201);
    const data = userCreate.mock.calls[0][0].data;
    expect(data.firstName).toBe('Charles');
    expect(data.lastName).toBe('Babbage');
    expect(data.companyName).toBeNull();
  });

  it('explicit firstName overrides legacy name split', async () => {
    userCreate.mockResolvedValue({
      id: 'u3',
      email: 'c@b.com',
      firstName: 'Grace',
      lastName: 'Hopper',
      companyName: 'COBOL Inc',
      role: 'MANAGER',
      accountType: 'TRIAL',
      trialExpiresAt: new Date(),
    });
    const app = makeApp();
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'c@b.com',
        password: 'password123',
        name: 'WRONG WRONG',
        firstName: 'Grace',
        lastName: 'Hopper',
        companyName: 'COBOL Inc',
        company: 'old-field-ignored',
      });
    const data = userCreate.mock.calls[0][0].data;
    expect(data.firstName).toBe('Grace');
    expect(data.lastName).toBe('Hopper');
    expect(data.companyName).toBe('COBOL Inc');
  });
});
