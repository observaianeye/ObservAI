/**
 * Insights Cron (Yan #44).
 *
 * Periodic generateInsights() pass over every active camera. Disabled by
 * default; enable with INSIGHT_CRON_ENABLED=true. Idempotency is handled by
 * saveInsights() upserting on (cameraId, type, dateKey).
 *
 * Schedule: first tick 30s after startup (let the server warm up), then every
 * 6 hours. Each tick aggregates success/fail counts for ops visibility.
 */

import { prisma } from '../lib/db';
import { generateInsights } from './insightEngine';

// Faz 11: cut from 6h→1h so notifications surface promptly; 15s warmup so the
// first tick doesn't race the aggregator's setImmediate boot pass.
const INTERVAL_MS = 60 * 60 * 1000;
const STARTUP_DELAY_MS = 15_000;

let timer: NodeJS.Timeout | null = null;
let kickoff: NodeJS.Timeout | null = null;

async function runOnce(): Promise<{ success: number; fail: number; total: number }> {
  console.log('[insights-cron] tick start');
  const cams = await prisma.camera.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  let success = 0;
  let fail = 0;
  for (const cam of cams) {
    try {
      await generateInsights(cam.id);
      success++;
    } catch (e) {
      fail++;
      console.error(`[insights-cron] cam ${cam.id} error:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`[insights-cron] tick done: ${success} ok, ${fail} fail (${cams.length} cams)`);
  return { success, fail, total: cams.length };
}

export function startInsightsCron(): void {
  // Faz 11: default ON. Was opt-in (INSIGHT_CRON_ENABLED=true) which left the
  // Notifications page empty in fresh installs. Set INSIGHT_CRON_ENABLED=false
  // to disable.
  if (process.env.INSIGHT_CRON_ENABLED === 'false') {
    console.log('[insights-cron] disabled (INSIGHT_CRON_ENABLED=false)');
    return;
  }
  if (timer) {
    console.log('[insights-cron] already running');
    return;
  }
  kickoff = setTimeout(() => {
    runOnce().catch((e) => console.error('[insights-cron] kickoff error:', e));
  }, STARTUP_DELAY_MS);
  timer = setInterval(() => {
    runOnce().catch((e) => console.error('[insights-cron] tick error:', e));
  }, INTERVAL_MS);
  console.log('[insights-cron] enabled, every 1h');
}

export function stopInsightsCron(): void {
  if (kickoff) {
    clearTimeout(kickoff);
    kickoff = null;
  }
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

// Test hook (vitest only).
export const _internals = { runOnce };
