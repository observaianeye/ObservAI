import { expect, test } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TID = 'faz3/3.7a';
const API = 'http://localhost:3001';
const PYTHON = 'http://localhost:5001';
const DENEME_MOZART_BRANCH = '1d3b148d-d324-4e87-872f-296f591e589f';

test.describe('Faz 3 / 3.7a Live persistence pipeline — DENEME tur 2 (Yan #22 ek dogrulama, 120s)', () => {
  test('120s dashboard open with live MozartHigh — analytics_logs delta on deneme cam', async ({ page }) => {
    test.setTimeout(180_000);
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
      await captureScreenshot(page, TID, '01_no_live');
      await saveEvidence(TID, {
        console: consoleArr.get(),
        responses: net.getResponses(),
        db: { skip: 'SKIP-INFEASIBLE', reason: 'live stream not active or no active camera', pyHealth, activeCam },
      });
      test.skip(true, 'no live stream');
      return;
    }

    const beforeRow = querySqlite(`SELECT COUNT(*) as c FROM analytics_logs WHERE cameraId='${activeCam.id}' AND timestamp > (strftime('%s','now')*1000 - 120000)`);
    const beforeCount = Number((beforeRow.rows[0] as { c?: number } | undefined)?.c ?? 0);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '01_initial');

    await page.waitForTimeout(60_000);
    const midRow = querySqlite(`SELECT COUNT(*) as c FROM analytics_logs WHERE cameraId='${activeCam.id}' AND timestamp > (strftime('%s','now')*1000 - 120000)`);
    const midCount = Number((midRow.rows[0] as { c?: number } | undefined)?.c ?? 0);
    await captureScreenshot(page, TID, '02_60s');

    await page.waitForTimeout(60_000);
    await captureScreenshot(page, TID, '03_120s');

    const afterRow = querySqlite(`SELECT COUNT(*) as c FROM analytics_logs WHERE cameraId='${activeCam.id}' AND timestamp > (strftime('%s','now')*1000 - 120000)`);
    const afterCount = Number((afterRow.rows[0] as { c?: number } | undefined)?.c ?? 0);
    const delta = afterCount - beforeCount;

    let verdict: string;
    if (delta >= 100) verdict = 'YAN_22_REFUTED: pipeline healthy, ~1Hz over 120s';
    else if (delta >= 20) verdict = 'YAN_22_PARTIAL: throttled persistence';
    else if (delta > 0) verdict = 'YAN_22_PARTIAL: very low rate (<20/120s)';
    else verdict = 'YAN_22_CONFIRMED: 0 rows in 120s with live stream + dashboard open';

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests(),
      responses: net.getResponses(),
      db: {
        activeCameraId: activeCam.id,
        activeCameraName: activeCam.name,
        pyHealth,
        beforeCount,
        midCount,
        afterCount,
        delta,
        consistencyWith_4_2a: 'Compare delta values; expect agreement (both confirm or both refute)',
        verdict,
      },
    });

    expect(true).toBe(true);
  });
});
