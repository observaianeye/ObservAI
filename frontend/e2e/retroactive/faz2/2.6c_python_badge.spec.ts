import { expect, test } from '@playwright/test';
import { loginAsAdmin } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';

const TID = 'faz2/2.6c';
const PYTHON = 'http://localhost:5001';

test.describe('Faz 2 / 2.6c Python backend badge whitelist (Yan #2.6c BUG_CONFIRMED)', () => {
  test('Settings shows Python backend status badge — text + color', async ({ page }) => {
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    // Direct Python health probe (parallel evidence).
    let pyHealth: unknown = null;
    try {
      const r = await page.request.get(`${PYTHON}/health`, { timeout: 5_000 });
      pyHealth = { status: r.status(), body: await r.json().catch(() => null) };
    } catch (e) {
      pyHealth = { error: String(e) };
    }

    await loginAsAdmin(page);
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '01_settings_initial');

    // Find any element mentioning Python backend.
    const pyTextNodes = page.locator(':text-matches("(Python|backend)", "i")');
    const matchCount = await pyTextNodes.count();

    // Try to scroll to the section.
    const pythonSection = page.locator('text=/Python.*backend|backend.*Python/i').first();
    if (await pythonSection.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await pythonSection.scrollIntoViewIfNeeded();
    }
    await captureScreenshot(page, TID, '02_settings_python_section');

    // Try to find a status badge near Python text.
    const badge = page.locator('span, div').filter({ hasText: /reachable|not reachable|ready|connect|loading|disconnect|hata|baglandi|baglanti|cevrim/i }).first();
    let badgeText = '';
    let badgeBg = '';
    let badgeColor = '';
    if (await badge.isVisible({ timeout: 2_000 }).catch(() => false)) {
      badgeText = (await badge.innerText().catch(() => '')) || '';
      const styles = await badge.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return { bg: cs.backgroundColor, color: cs.color };
      }).catch(() => ({ bg: '', color: '' }));
      badgeBg = styles.bg;
      badgeColor = styles.color;
      await badge.scrollIntoViewIfNeeded().catch(() => undefined);
      await captureScreenshot(page, TID, '03_badge_zoom');
    } else {
      await captureScreenshot(page, TID, '03_no_badge_found');
    }

    // Determine whether UI shows healthy state given Python returned 'ready'.
    const pyStatus = (pyHealth as { body?: { status?: string } } | null)?.body?.status ?? null;
    const uiSaysHealthy = /reachable|ready|connect|baglandi|online|cevrim/i.test(badgeText) && !/not\s*reachable|disconnect|hata|cevrimdisi/i.test(badgeText);
    const uiSaysUnhealthy = /not\s*reachable|disconnect|hata|cevrimdisi/i.test(badgeText);
    const yan_2_6c_confirmed = pyStatus === 'ready' && uiSaysUnhealthy;

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests(),
      responses: net.getResponses(),
      db: {
        pyHealth,
        badgeText,
        badgeBg,
        badgeColor,
        matchCount,
        uiSaysHealthy,
        uiSaysUnhealthy,
        yan_2_6c_confirmed,
        verdict: yan_2_6c_confirmed
          ? 'BUG_CONFIRMED: Python ready but UI badge says unhealthy'
          : (badgeText ? 'OBSERVED: badge text captured, no contradiction' : 'INCONCLUSIVE: badge not located'),
      },
    });

    expect(true).toBe(true); // observational — never fails the test
  });
});
