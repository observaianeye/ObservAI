/**
 * Faz 10 Bug #6 — POST /api/notifications/dev-trigger inserts a synthetic
 * Insight row of any catalog event type so the NotificationsPage UI can be
 * exercised without waiting for the live engine to organically trigger one.
 *
 * Catalog: queue_overflow / table_cleaning_overdue / peak_occupancy_threshold
 *        / fps_drop / low_visitor_alert / zone_enter_spike / demographic_shift
 *        / visitor_surge / engine_offline.
 *
 * Production guard: NODE_ENV=production must reject with 403.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../middleware/authMiddleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'u1', role: 'MANAGER' };
    next();
  },
}));

const insightCreate = vi.fn();
vi.mock('../lib/db', () => ({
  prisma: {
    insight: {
      create: (...args: any[]) => insightCreate(...args),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1', email: 'u@test.com' }), update: vi.fn() },
  },
}));

vi.mock('../services/notificationDispatcher', () => ({
  dispatchBatch: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/emailService', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  verifySmtp: vi.fn().mockResolvedValue({ configured: false, connected: false }),
}));

import notificationsRouter from '../routes/notifications';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', notificationsRouter);
  return app;
}

const CAM = '11111111-1111-1111-1111-111111111111';

describe('Faz 10 Bug #6 — POST /api/notifications/dev-trigger', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    insightCreate.mockReset();
    insightCreate.mockImplementation(({ data }: any) => Promise.resolve({ id: 'ins-1', ...data }));
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('inserts a queue_overflow Insight row with severity high', async () => {
    const res = await request(makeApp()).post(`/api/notifications/dev-trigger?event=queue_overflow&cameraId=${CAM}`);
    expect(res.status).toBe(201);
    expect(insightCreate).toHaveBeenCalledOnce();
    const arg = insightCreate.mock.calls[0][0].data;
    expect(arg.cameraId).toBe(CAM);
    expect(arg.type).toBe('queue_overflow');
    expect(arg.severity).toBe('high');
    expect(arg.title).toContain('Queue Overflow');
  });

  it.each([
    ['table_cleaning_overdue', 'table_cleaning'],
    ['peak_occupancy_threshold', 'occupancy_alert'],
    ['fps_drop', 'fps_drop'],
    ['low_visitor_alert', 'low_visitor_alert'],
    ['zone_enter_spike', 'crowd_surge'],
    ['demographic_shift', 'demographic_trend'],
    ['visitor_surge', 'trend'],
    ['engine_offline', 'system_alert'],
  ])('catalog event %s maps to insight type %s', async (event, expectedType) => {
    const res = await request(makeApp()).post(`/api/notifications/dev-trigger?event=${event}&cameraId=${CAM}`);
    expect(res.status).toBe(201);
    const arg = insightCreate.mock.calls[0][0].data;
    expect(arg.type).toBe(expectedType);
  });

  it('rejects unknown event with 400 + lists allowed events', async () => {
    const res = await request(makeApp()).post(`/api/notifications/dev-trigger?event=bogus&cameraId=${CAM}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unknown event');
    expect(Array.isArray(res.body.allowed)).toBe(true);
    expect(res.body.allowed).toContain('queue_overflow');
    expect(insightCreate).not.toHaveBeenCalled();
  });

  it('rejects missing cameraId with 400', async () => {
    const res = await request(makeApp()).post('/api/notifications/dev-trigger?event=queue_overflow');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cameraId/i);
  });

  it('rejects in production with 403', async () => {
    process.env.NODE_ENV = 'production';
    const res = await request(makeApp()).post(`/api/notifications/dev-trigger?event=queue_overflow&cameraId=${CAM}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/dev-trigger.*production/i);
    expect(insightCreate).not.toHaveBeenCalled();
  });

  it('marks the inserted row with devTrigger=true in context JSON', async () => {
    const res = await request(makeApp()).post(`/api/notifications/dev-trigger?event=queue_overflow&cameraId=${CAM}`);
    expect(res.status).toBe(201);
    const arg = insightCreate.mock.calls[0][0].data;
    const ctx = JSON.parse(arg.context);
    expect(ctx.devTrigger).toBe(true);
    expect(ctx.event).toBe('queue_overflow');
  });
});
