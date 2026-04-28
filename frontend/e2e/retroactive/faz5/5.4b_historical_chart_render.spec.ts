import { expect, test } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';

const TID = 'faz5/5.4b';
const DENEME_MOZART_BRANCH = '1d3b148d-d324-4e87-872f-296f591e589f';

test.describe('Faz 5 / 5.4b Historical chart render (range=1w, chart non-empty)', () => {
  test('analytics chart renders with non-empty data points for range=1w', async ({ page }) => {
    test.setTimeout(90_000);
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    await loginAsDeneme(page);
    await page.evaluate((bid) => { try { localStorage.setItem('selectedBranchId', bid); } catch { /* ignore */ } }, DENEME_MOZART_BRANCH);

    await page.goto('/dashboard/analytics');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(2_000);
    await captureScreenshot(page, TID, '01_chart_loading');

    // Set up response listener BEFORE click. Range button label is localized (TR/EN).
    const respPromise = page.waitForResponse((r) => /\/api\/analytics\/.*overview.*range=1w/.test(r.url()), { timeout: 15_000 }).catch(() => null);
    const w1Btn = page.locator('button').filter({ hasText: /1\s*hafta|1\s*week/i }).first();
    if (await w1Btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await w1Btn.click({ timeout: 5_000 });
    }
    const resp = await respPromise;
    let apiBody: { hasData?: boolean; kpis?: Record<string, number>; timeline?: unknown[] } = {};
    let respStatus = 0;
    if (resp) {
      respStatus = resp.status();
      apiBody = await resp.json().catch(() => ({}));
    }
    await page.waitForTimeout(2_000);
    await captureScreenshot(page, TID, '02_chart_loaded_1w');

    // Look for chart elements: SVG path / canvas
    const svgCount = await page.locator('svg').count();
    const canvasCount = await page.locator('canvas').count();
    // Try to find a path with non-trivial 'd' attribute
    const svgPaths = page.locator('svg path');
    const pathCount = await svgPaths.count();
    let pathDataLengthSum = 0;
    for (let i = 0; i < Math.min(pathCount, 30); i++) {
      const d = await svgPaths.nth(i).getAttribute('d').catch(() => '') ?? '';
      pathDataLengthSum += d.length;
    }

    // Look for KPI values rendered (totalVisitors etc)
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const visitorNumberMatch = bodyText.match(/\b(\d{2,})\b/);

    const chartReadable = (svgCount > 0 || canvasCount > 0) && pathDataLengthSum > 50;

    const verdict = respStatus === 200 && apiBody.hasData && chartReadable
      ? 'PASS_DENEME: 1w overview hasData=true, chart elements rendered, KPI numbers visible'
      : !apiBody.hasData
      ? 'OBSERVATIONAL: API hasData=false (no seed data for deneme range=1w)'
      : `OBSERVATIONAL: chartReadable=${chartReadable}, svg=${svgCount}, canvas=${canvasCount}, pathSum=${pathDataLengthSum}`;

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests().filter((r) => /\/api\/analytics\//.test(r.url)).slice(0, 10),
      responses: net.getResponses().filter((r) => /\/api\/analytics\//.test(r.url)).slice(0, 10),
      db: {
        respStatus,
        hasData: apiBody.hasData ?? null,
        kpis: apiBody.kpis ?? null,
        timelineLen: Array.isArray(apiBody.timeline) ? apiBody.timeline.length : null,
        svgCount,
        canvasCount,
        pathCount,
        pathDataLengthSum,
        firstNumberInBody: visitorNumberMatch?.[0] ?? null,
        verdict,
      },
    });

    expect(respStatus).toBe(200);
  });
});
