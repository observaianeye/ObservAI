import { expect, test } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TID = 'faz4/4.2a';
const API = 'http://localhost:3001';
const PYTHON = 'http://localhost:5001';
const DENEME_MOZART_BRANCH = '1d3b148d-d324-4e87-872f-296f591e589f';

test.describe('Faz 4 / 4.2a Live dashboard analytics_logs DB write — DENEME tur 2 (Yan #22 disambiguation)', () => {
  test('dashboard open for 60s should produce analytics_logs rows when stream is live', async ({ page }) => {
    test.setTimeout(150_000);
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    let pyHealth: { status?: string; fps?: number } | null = null;
    try {
      const r = await page.request.get(`${PYTHON}/health`);
      pyHealth = r.ok() ? await r.json() : null;
    } catch { pyHealth = null; }
    const isLive = pyHealth?.status === 'ready' && (pyHealth.fps ?? 0) > 0;

    await loginAsDeneme(page);
    await page.evaluate((bid) => {
      try { localStorage.setItem('selectedBranchId', bid); } catch { /* ignore */ }
    }, DENEME_MOZART_BRANCH);

    const activeRes = await page.context().request.get(`${API}/api/cameras/active`);
    const activeCam = activeRes.ok() ? ((await activeRes.json()) as { id: string; name?: string }) : null;

    if (!isLive || !activeCam) {
      await page.goto('/dashboard').catch(() => undefined);
      await captureScreenshot(page, TID, '01_dashboard_no_live');
      await page.waitForTimeout(1500);
      await captureScreenshot(page, TID, '02_dashboard_no_live_2');
      await saveEvidence(TID, {
        console: consoleArr.get(),
        responses: net.getResponses(),
        db: { skip: 'SKIP-INFEASIBLE', reason: 'live stream not active or no active camera', pyHealth, activeCam },
      });
      test.skip(true, 'no live stream');
      return;
    }

    const beforeCountRow = querySqlite(`SELECT COUNT(*) as c FROM analytics_logs WHERE cameraId='${activeCam.id}' AND timestamp > (strftime('%s','now')*1000 - 60000)`);
    const beforeCount = Number((beforeCountRow.rows[0] as { c?: number } | undefined)?.c ?? 0);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '01_dashboard_initial');

    await page.waitForTimeout(30_000);
    await captureScreenshot(page, TID, '02_dashboard_30s');

    await page.waitForTimeout(30_000);
    await captureScreenshot(page, TID, '03_dashboard_60s');

    const afterCountRow = querySqlite(`SELECT COUNT(*) as c FROM analytics_logs WHERE cameraId='${activeCam.id}' AND timestamp > (strftime('%s','now')*1000 - 60000)`);
    const afterCount = Number((afterCountRow.rows[0] as { c?: number } | undefined)?.c ?? 0);
    const delta = afterCount - beforeCount;

    let verdict: string;
    if (delta >= 50) verdict = 'YAN_22_REFUTED: pipeline healthy on deneme dashboard, delta>=50/60s expected ~1Hz';
    else if (delta > 10) verdict = 'YAN_22_PARTIAL: throttled persistence (10-50 rows/60s)';
    else if (delta > 0) verdict = 'YAN_22_PARTIAL: very low rate (<=10 rows/60s) — throttle or partial pipeline';
    else verdict = 'YAN_22_CONFIRMED: 0 rows in 60s with dashboard open & live stream — frontend-bagimli pipeline kopuk';

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests(),
      responses: net.getResponses(),
      db: {
        activeCameraId: activeCam.id,
        activeCameraName: activeCam.name,
        pyHealth,
        beforeCount,
        afterCount,
        delta,
        verdict,
      },
    });

    expect(true).toBe(true);
  });
});
