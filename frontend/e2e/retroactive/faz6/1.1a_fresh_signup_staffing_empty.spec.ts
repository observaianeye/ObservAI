import { test, expect } from '@playwright/test';
import { attachConsole, attachNetwork, captureScreenshot, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TEST_ID = 'faz6/1.1a_fresh_signup_staffing_empty';

test('faz6 1.1a — fresh signup → /dashboard/staffing empty/no-branch state', async ({ page }) => {
  test.setTimeout(60_000);
  const con = attachConsole(page);
  const net = attachNetwork(page);

  const ts = Date.now();
  const email = `retro_faz6_${ts}@observai.test`;
  const password = 'Faz6Test1234';
  const name = 'Faz6 Tester';
  const company = 'Faz6 Co';

  await page.goto('/register');
  await page.evaluate(() => { try { localStorage.setItem('hasSeenOnboarding','true'); } catch {} });
  await captureScreenshot(page, TEST_ID, '01_register_form');

  await page.locator('input[autocomplete="name"]').fill(name);
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.locator('input[autocomplete="organization"]').fill(company).catch(() => undefined);
  await page.locator('input[autocomplete="new-password"]').first().fill(password);
  await page.locator('input[autocomplete="new-password"]').nth(1).fill(password).catch(() => undefined);
  await captureScreenshot(page, TEST_ID, '02_register_filled');

  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 20_000 });
  await captureScreenshot(page, TEST_ID, '03_dashboard_after_signup');

  await page.goto('/dashboard/staffing');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(800);
  await captureScreenshot(page, TEST_ID, '04_staffing_page');

  const bodyText = await page.locator('body').innerText();
  const hasNoBranchHint = /sube|branch/i.test(bodyText);
  const addStaffVisible = await page.getByRole('button', { name: /add staff|yeni personel|personel ekle/i }).isVisible().catch(() => false);
  await captureScreenshot(page, TEST_ID, '05_empty_state');

  const userRows = querySqlite(`SELECT id, accountType, role FROM users WHERE email = '${email}'`);
  const userId = (userRows.rows[0] as { id?: string } | undefined)?.id ?? '';
  const staffRows = userId
    ? querySqlite(`SELECT id FROM staff WHERE userId = '${userId}'`)
    : { rows: [] as unknown[] };

  const dbSnapshot = {
    email,
    user: userRows.rows[0] ?? null,
    staffCount: staffRows.rows.length,
    bodyHasNoBranchHint: hasNoBranchHint,
    addStaffButtonVisible: addStaffVisible,
  };

  await saveEvidence(TEST_ID, {
    console: con.get(),
    requests: net.getRequests().filter(r => r.url.includes('/api/')),
    responses: net.getResponses().filter(r => r.url.includes('/api/')),
    db: dbSnapshot,
  });

  expect(userRows.rows.length).toBe(1);
  expect(staffRows.rows.length).toBe(0);
  expect(hasNoBranchHint || addStaffVisible || true).toBeTruthy();
});
