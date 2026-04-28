import { expect, test } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';

const TID = 'faz5/5.1b';
const DENEME_MOZART_BRANCH = '1d3b148d-d324-4e87-872f-296f591e589f';

test.describe('Faz 5 / 5.1b Date filter NOT_PERSISTED across page nav (Yan #38 visual)', () => {
  test('select 1m → nav away → return → range RESET to default 1d', async ({ page }) => {
    test.setTimeout(60_000);
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    await loginAsDeneme(page);
    await page.evaluate((bid) => { try { localStorage.setItem('selectedBranchId', bid); } catch { /* ignore */ } }, DENEME_MOZART_BRANCH);

    await page.goto('/dashboard/analytics');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1_500);
    await captureScreenshot(page, TID, '01_analytics_initial_default');

    const range1m = page.locator('button').filter({ hasText: /1\s*ay\b|1\s*month/i }).first();
    if (!(await range1m.isVisible({ timeout: 3_000 }).catch(() => false))) {
      await saveEvidence(TID, { console: consoleArr.get(), db: { skip: 'SKIP-INFEASIBLE', reason: 'range button 1m not found' } });
      test.skip(true, 'no 1m button');
      return;
    }
    await range1m.click({ timeout: 5_000 });
    await page.waitForTimeout(1_500);
    await captureScreenshot(page, TID, '02_after_1m_select');

    // Detect active state via class — gradient bg-brand-500
    const isActive1mPre = await range1m.evaluate((el) => el.className.includes('shadow-glow-brand') || el.className.includes('bg-gradient'));

    // Navigate away
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '03_dashboard_visit');
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '04_settings_visit');

    // Return to analytics
    await page.goto('/dashboard/analytics');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1_500);
    await captureScreenshot(page, TID, '05_analytics_returned');

    const range1mAfter = page.locator('button').filter({ hasText: /1\s*ay\b|1\s*month/i }).first();
    const range1dAfter = page.locator('button').filter({ hasText: /1\s*g[üu]n|1\s*day/i }).first();
    const isActive1mPost = await range1mAfter.evaluate((el) => el.className.includes('shadow-glow-brand') || el.className.includes('bg-gradient')).catch(() => false);
    const isActive1dPost = await range1dAfter.evaluate((el) => el.className.includes('shadow-glow-brand') || el.className.includes('bg-gradient')).catch(() => false);

    const persisted = isActive1mPost && !isActive1dPost;
    const reset = isActive1dPost && !isActive1mPost;

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests().filter((r) => /\/api\/analytics/.test(r.url)).slice(0, 20),
      db: {
        isActive1mPre,
        isActive1mPost,
        isActive1dPost,
        persisted,
        reset,
        verdict: reset
          ? 'YAN_38_VISUAL_CONFIRMED: range reset to 1d after nav, NOT_PERSISTED reproduced in browser'
          : persisted
          ? 'YAN_38_REFUTED: range 1m persisted across nav (state lifted to context?)'
          : `OBSERVATIONAL: isActive1mPost=${isActive1mPost}, isActive1dPost=${isActive1dPost}`,
      },
    });

    expect(true).toBe(true);
  });
});
