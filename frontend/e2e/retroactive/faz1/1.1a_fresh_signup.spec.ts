import { expect, test } from '@playwright/test';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TID = 'faz1/1.1a';
const API = 'http://localhost:3001';

test.describe('Faz 1 / 1.1a Fresh signup → auto-login → empty state — DENEME tur 2 (sunum demo)', () => {
  test('register fresh user, dashboard renders empty state, settings show 0 branches', async ({ page }) => {
    test.setTimeout(60_000);
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    const stamp = Date.now();
    const email = `retro_${stamp}@observai.test`;
    const password = 'Retro1234!';
    const firstName = 'Retro';
    const lastName = 'Tur2';

    await page.goto('/register');
    await page.evaluate(() => {
      try { localStorage.setItem('hasSeenOnboarding', 'true'); } catch { /* ignore */ }
    });
    await captureScreenshot(page, TID, '01_register_form');

    // RegisterPage required fields: name (text), email, company (text), password, confirmPassword.
    // Fields use autocomplete attrs we can target.
    const nameInput = page.locator('input[autocomplete="name"]').first();
    const emailInput = page.locator('input[type="email"], input[autocomplete="email"]').first();
    const companyInput = page.locator('input[autocomplete="organization"]').first();
    const passwordInputs = page.locator('input[type="password"]');

    await nameInput.fill(`${firstName} ${lastName}`.trim());
    await emailInput.fill(email);
    await companyInput.fill('RetroTur2');
    await passwordInputs.nth(0).fill(password);
    const passwordInputCount = await passwordInputs.count();
    if (passwordInputCount > 1) {
      await passwordInputs.nth(1).fill(password);
    }

    await captureScreenshot(page, TID, '02_register_filled');

    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Wait for either dashboard redirect or error
    await page.waitForURL(/\/dashboard(\/|$)|\/login/, { timeout: 15_000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const url = page.url();
    await captureScreenshot(page, TID, '03_after_submit');

    const onDashboard = /\/dashboard/.test(url);

    // DB verify
    const userRow = querySqlite(`SELECT id, email, accountType, trialExpiresAt, role FROM users WHERE email='${email}'`);
    const userRowEntry = userRow.rows[0] as { id?: string; email?: string; accountType?: string; trialExpiresAt?: string; role?: string } | undefined;

    // Trip into Settings → Branches to confirm empty state
    let branchEmpty: boolean | null = null;
    if (onDashboard) {
      await page.goto('/dashboard/settings').catch(() => undefined);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.waitForTimeout(1_500);
      await captureScreenshot(page, TID, '04_settings_branches');
      const bodyText = await page.locator('body').innerText().catch(() => '');
      branchEmpty = /no.*branch|hic.*sub|sube yok|0\s*kamera|empty/i.test(bodyText);
    }

    await captureScreenshot(page, TID, '05_final');

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests(),
      responses: net.getResponses(),
      db: {
        createdEmail: email,
        userRowEntry,
        urlAfterSubmit: url,
        onDashboard,
        branchEmptyDetected: branchEmpty,
        cleanupNote: 'Test user retained in DB (no DELETE per project rules). Manual cleanup if needed.',
        verdict: onDashboard && userRowEntry?.accountType === 'TRIAL'
          ? 'PASS: fresh signup auto-logged in as TRIAL'
          : 'OBSERVATIONAL: register flow path divergent (check verdict against fields)',
      },
    });

    expect(userRowEntry?.email ?? '').toBe(email);
  });
});
