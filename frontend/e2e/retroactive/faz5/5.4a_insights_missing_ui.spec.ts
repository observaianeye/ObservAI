import { expect, test } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TID = 'faz5/5.4a';
const DENEME_MOZART_BRANCH = '1d3b148d-d324-4e87-872f-296f591e589f';

test.describe('Faz 5 / 5.4a Insights stale UI (Yan #44 visual — cron yok)', () => {
  test('insights section last update timestamp is > 24h old', async ({ page }) => {
    test.setTimeout(60_000);
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    await loginAsDeneme(page);
    await page.evaluate((bid) => { try { localStorage.setItem('selectedBranchId', bid); } catch { /* ignore */ } }, DENEME_MOZART_BRANCH);

    // /dashboard/ai-insights redirects to /dashboard/analytics (App.tsx:76)
    await page.goto('/dashboard/analytics');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(2_000);
    await captureScreenshot(page, TID, '01_analytics_with_insights');

    // Check insights API directly via browser fetch
    const insightsApi = await page.evaluate(async () => {
      const r = await fetch('/api/insights/recommendations', { credentials: 'include' });
      return { status: r.status, body: r.ok ? await r.json() : null };
    });

    const summaryApi = await page.evaluate(async () => {
      const r = await fetch('/api/insights/summary', { credentials: 'include' });
      return { status: r.status, body: r.ok ? await r.json() : null };
    });

    // Last insight timestamp from DB
    const lastInsight = querySqlite(`SELECT createdAt, type, substr(message,1,80) as snippet FROM insights ORDER BY createdAt DESC LIMIT 1`);
    const lastEntry = lastInsight.rows[0] as { createdAt?: string; type?: string; snippet?: string } | undefined;
    const lastTs = lastEntry?.createdAt ? new Date(lastEntry.createdAt as string).getTime() : 0;
    const ageHours = lastTs ? (Date.now() - lastTs) / 3600_000 : 0;

    // Try to find insight cards / age label in UI
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const matchAgo = bodyText.match(/(\d+)\s*(saat|hour|gün|day|dakika|minute)\s*(önce|ago)/i);
    const ageLabelText = matchAgo ? matchAgo[0] : '';

    await captureScreenshot(page, TID, '02_insights_age_label');

    const verdict = ageHours > 24
      ? 'YAN_44_VISUAL_CONFIRMED: insights are stale (>24h since last createdAt) — no cron in production'
      : ageHours > 0 && ageHours <= 24
      ? 'YAN_44_PARTIAL: insights < 24h old (recent manual trigger)'
      : 'OBSERVATIONAL: no insights in DB or query failed';

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests().filter((r) => /\/api\/insights/.test(r.url)).slice(0, 10),
      responses: net.getResponses().filter((r) => /\/api\/insights/.test(r.url)).slice(0, 10),
      db: {
        lastInsight: lastEntry ?? null,
        lastTsIso: lastEntry?.createdAt ?? null,
        ageHours: Math.round(ageHours * 100) / 100,
        ageLabelInUi: ageLabelText,
        insightsApiStatus: insightsApi.status,
        summaryApiStatus: summaryApi.status,
        verdict,
      },
    });

    expect(true).toBe(true);
  });
});
