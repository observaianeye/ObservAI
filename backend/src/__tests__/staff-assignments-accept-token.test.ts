/**
 * Yan #59 — acceptToken expiry + idempotency.
 *
 *  - Happy path: first visit with valid unexpired token → 200 + acceptedAt set.
 *  - Replay: second visit (acceptedAt populated) → 200 idempotent message.
 *  - Expired: acceptTokenExpires in past → 410 Gone, NO mutation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const findUniqueMock = vi.fn();
const updateMock = vi.fn();

vi.mock('../middleware/authMiddleware', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../services/notificationDispatcher', () => ({
  notifyStaffShift: vi.fn(async () => ({ email: { sent: true } })),
}));

vi.mock('../lib/db', () => ({
  prisma: {
    staffAssignment: {
      findUnique: (args: unknown) => findUniqueMock(args),
      update: (args: unknown) => updateMock(args),
    },
  },
}));

import staffAssignmentsRouter from '../routes/staff-assignments';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/staff-assignments', staffAssignmentsRouter);
  return app;
}

const TOKEN = 'a'.repeat(48);
const ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  findUniqueMock.mockReset();
  updateMock.mockReset();
});

describe('Yan #59 — GET /:id/accept token expiry & idempotency', () => {
  it('happy path: first visit with valid token → 200 + acceptedAt set', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: ID,
      acceptToken: TOKEN,
      acceptTokenExpires: new Date(Date.now() + 60 * 60 * 1000), // 1h future
      acceptedAt: null,
      status: 'pending',
    });
    updateMock.mockResolvedValueOnce({});

    const res = await request(makeApp()).get(`/api/staff-assignments/${ID}/accept?token=${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Vardiya Onaylandi');
    expect(updateMock).toHaveBeenCalledTimes(1);
    const data = (updateMock.mock.calls[0][0] as { data: any }).data;
    expect(data.status).toBe('accepted');
    expect(data.acceptedAt).toBeInstanceOf(Date);
  });

  it('replay: second visit (acceptedAt set) → 200 idempotent message, no DB write', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: ID,
      acceptToken: TOKEN,
      acceptTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
      acceptedAt: new Date(Date.now() - 60 * 1000),
      status: 'accepted',
    });

    const res = await request(makeApp()).get(`/api/staff-assignments/${ID}/accept?token=${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Zaten Onaylanmis');
    // Critical: no second update — leaked token can't toggle status forever.
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('expired: acceptTokenExpires in past → 410 Gone, no DB write', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: ID,
      acceptToken: TOKEN,
      acceptTokenExpires: new Date(Date.now() - 60 * 1000), // 1 min past
      acceptedAt: null,
      status: 'pending',
    });

    const res = await request(makeApp()).get(`/api/staff-assignments/${ID}/accept?token=${TOKEN}`);

    expect(res.status).toBe(410);
    expect(res.text).toContain('Sona Ermis');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('wrong token: 404 Gecersiz, no DB write', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: ID,
      acceptToken: TOKEN,
      acceptTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
      acceptedAt: null,
      status: 'pending',
    });

    const res = await request(makeApp()).get(`/api/staff-assignments/${ID}/accept?token=BOGUS`);

    expect(res.status).toBe(404);
    expect(res.text).toContain('Gecersiz');
    expect(updateMock).not.toHaveBeenCalled();
  });
});
