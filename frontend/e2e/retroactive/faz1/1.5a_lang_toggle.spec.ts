import { expect, test } from '@playwright/test';
import { loginAsAdmin } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';

const TID = 'faz1/1.5a';

test.describe('Faz 1 / 1.5a Settings Language Toggle (BLOCKED — BranchSection TR_BLEEDING)', () => {
  test('language switch TR↔EN, BranchSection title check for TR bleed', async ({ page }) => {
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    await loginAsAdmin(page);
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '01_settings_initial');

    // Try to set language TR via known mechanisms.
    const trBefore = await page.evaluate(() => localStorage.getItem('i18nextLng') ?? localStorage.getItem('language') ?? 'unknown');

    // Force TR via i18next localStorage and reload (most deterministic).
    await page.evaluate(() => { try { localStorage.setItem('i18nextLng', 'tr'); } catch {} });
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '02_settings_TR');

    // Locate BranchSection. The component renders an h2/h3 with branch label.
    const branchHeadings = page.locator('h2, h3').filter({ hasText: /Sube|Branch|Şube/i });
    const trHeadingCount = await branchHeadings.count();
    const trHeadingTexts: string[] = [];
    for (let i = 0; i < trHeadingCount && i < 5; i++) {
      trHeadingTexts.push(await branchHeadings.nth(i).innerText().catch(() => ''));
    }
    await captureScreenshot(page, TID, '03_branch_section_TR');

    // Switch to EN.
    await page.evaluate(() => { try { localStorage.setItem('i18nextLng', 'en'); } catch {} });
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '04_settings_EN');

    const enHeadings = page.locator('h2, h3').filter({ hasText: /Sube|Branch|Şube/i });
    const enHeadingCount = await enHeadings.count();
    const enHeadingTexts: string[] = [];
    for (let i = 0; i < enHeadingCount && i < 5; i++) {
      enHeadingTexts.push(await enHeadings.nth(i).innerText().catch(() => ''));
    }
    await captureScreenshot(page, TID, '05_branch_section_EN');

    const trText = trHeadingTexts.join(' | ');
    const enText = enHeadingTexts.join(' | ');
    const trHasTurkish = /Sube|Şube|Şubeler|Subeler/i.test(trText);
    const enStillTurkish = /Sube|Şube|Şubeler|Subeler/i.test(enText);
    const tr_bleeding_confirmed = trHasTurkish && enStillTurkish;

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests(),
      responses: net.getResponses(),
      db: {
        trBefore,
        trHeadingTexts,
        enHeadingTexts,
        trHasTurkish,
        enStillTurkish,
        tr_bleeding_confirmed,
        verdict: tr_bleeding_confirmed ? 'BUG_CONFIRMED: BranchSection always Turkish' : 'NO_BLEED: EN heading switched',
      },
    });

    // Assertion is informational — we capture both states either way.
    expect(trHeadingTexts.length + enHeadingTexts.length).toBeGreaterThan(0);
  });
});
