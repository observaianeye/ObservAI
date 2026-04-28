import { describe, it, expect, vi, beforeEach } from 'vitest';

// Yan #44: a 6h cron tick that re-runs on the same UTC day must NOT stack
// duplicates. saveInsights() upserts on (cameraId, type, dateKey) — the test
// checks the SQL emitted by $executeRaw includes an ON CONFLICT clause and
// that two calls for the same insight produce two upsert calls (each idempotent
// against the existing row), not two duplicate INSERTs.

const mockExecuteRaw = vi.fn((...args: unknown[]) => {
  void args;
  return Promise.resolve(1);
});

vi.mock('../lib/db', () => ({
  prisma: {
    $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) =>
      mockExecuteRaw(strings, ...values),
  },
}));

import { saveInsights } from '../services/insightEngine';

describe('saveInsights idempotency (Yan #44 cron upsert)', () => {
  beforeEach(() => {
    mockExecuteRaw.mockReset();
    mockExecuteRaw.mockResolvedValue(1);
  });

  it('emits upsert SQL with ON CONFLICT(cameraId, type, dateKey) on every save', async () => {
    const insight = {
      type: 'crowd_surge' as const,
      severity: 'high' as const,
      title: 'surge',
      message: 'visitor spike',
      cameraId: 'cam-1',
    };
    await saveInsights([insight]);
    await saveInsights([insight]);

    expect(mockExecuteRaw).toHaveBeenCalledTimes(2);
    // $executeRaw template literal: first arg is the strings array.
    const stringsArr = (mockExecuteRaw.mock.calls[0] as unknown[])[0] as TemplateStringsArray;
    const fullSql = Array.from(stringsArr).join('?');
    expect(fullSql).toContain('INSERT INTO insights');
    expect(fullSql).toContain('ON CONFLICT');
    expect(fullSql).toContain('"cameraId"');
    expect(fullSql).toContain('"type"');
    expect(fullSql).toContain('"dateKey"');
    expect(fullSql).toContain('DO UPDATE');
  });

  it('uses todays UTC YYYY-MM-DD as the dateKey bucket', async () => {
    const insight = {
      type: 'demographic_trend' as const,
      severity: 'low' as const,
      title: 't',
      message: 'm',
      cameraId: 'cam-2',
    };
    await saveInsights([insight]);

    // Tagged template: values follow the strings array.
    const callArgs = mockExecuteRaw.mock.calls[0] as unknown[];
    const todayUtc = new Date().toISOString().slice(0, 10);
    // Find the dateKey value among the interpolated args.
    const interpolated = callArgs.slice(1);
    expect(interpolated).toContain(todayUtc);
  });
});
