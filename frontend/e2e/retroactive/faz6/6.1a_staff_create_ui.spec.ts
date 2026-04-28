import { test, expect } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { attachConsole, attachNetwork, captureScreenshot, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TEST_ID = 'faz6/6.1a_staff_create_ui';
const DENEME_USER_ID = '0bf23a86-fc20-4493-9f7b-18ae4a9ee049';

test('faz6 6.1a — staff create via UI form', async ({ page }) => {
  test.setTimeout(60_000);
  const con = attachConsole(page);
  const net = attachNetwork(page);

  await loginAsDeneme(page);
  await page.goto('/dashboard/staffing');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(700);
  await captureScreenshot(page, TEST_ID, '01_staffing_list');

  const beforeCount = querySqlite(`SELECT id FROM staff WHERE userId='${DENEME_USER_ID}'`).rows.length;

  const addBtn = page.getByRole('button', { name: /add staff|yeni personel|personel ekle/i }).first();
  await addBtn.waitFor({ state: 'visible', timeout: 8_000 });
  await addBtn.click();
  await page.waitForTimeout(400);
  await captureScreenshot(page, TEST_ID, '02_form_open');

  const uniq = Date.now();
  const lnameVal = `Tester${uniq}`;
  const emailVal = `faz6staff_${uniq}@test.local`;

  await page.locator('input[placeholder="Ayse"]').fill('Faz6');
  await page.locator('input[placeholder="Yilmaz"]').fill(lnameVal);
  await page.locator('input[type="email"]').fill(emailVal);
  await page.locator('input[type="tel"]').fill('+905551112233');
  await page.locator('select').selectOption('manager').catch(() => undefined);
  await captureScreenshot(page, TEST_ID, '03_form_filled');

  const respPromise = page.waitForResponse(r => r.url().includes('/api/staff') && r.request().method() === 'POST', { timeout: 10_000 }).catch(() => null);
  // Modal submit button — last() to avoid strict-mode collision with page header "Add staff"
  await page.getByRole('button', { name: /^(Ekle|Add)$/ }).last().click();
  const resp = await respPromise;
  await page.waitForTimeout(1200);
  await captureScreenshot(page, TEST_ID, '04_after_create');

  const afterRows = querySqlite(`SELECT id, firstName, lastName, email, role FROM staff WHERE userId='${DENEME_USER_ID}' AND email='${emailVal}'`);
  const afterCount = querySqlite(`SELECT id FROM staff WHERE userId='${DENEME_USER_ID}'`).rows.length;

  const db = {
    beforeCount,
    afterCount,
    delta: afterCount - beforeCount,
    createdRow: afterRows.rows[0] ?? null,
    httpStatus: resp?.status() ?? null,
    submittedEmail: emailVal,
  };
  await saveEvidence(TEST_ID, {
    console: con.get(),
    requests: net.getRequests().filter(r => r.url.includes('/api/staff')),
    responses: net.getResponses().filter(r => r.url.includes('/api/staff')),
    db,
  });

  expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
  expect(afterRows.rows.length).toBe(1);
});
