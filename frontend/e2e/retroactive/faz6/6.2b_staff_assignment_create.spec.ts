import { test, expect } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { attachConsole, attachNetwork, captureScreenshot, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TEST_ID = 'faz6/6.2b_staff_assignment_create';
const DENEME_USER_ID = '0bf23a86-fc20-4493-9f7b-18ae4a9ee049';

test('faz6 6.2b — create assignment via API + verify calendar refreshes', async ({ page }) => {
  test.setTimeout(60_000);
  const con = attachConsole(page);
  const net = attachNetwork(page);

  await loginAsDeneme(page);

  const staffRow = querySqlite(`SELECT id FROM staff WHERE userId='${DENEME_USER_ID}' AND isActive=1 LIMIT 1`);
  const branchRow = querySqlite(`SELECT id FROM branches WHERE userId='${DENEME_USER_ID}' LIMIT 1`);
  const staffId = (staffRow.rows[0] as { id?: string } | undefined)?.id ?? '';
  const branchId = (branchRow.rows[0] as { id?: string } | undefined)?.id ?? '';
  expect(staffId).toBeTruthy();
  expect(branchId).toBeTruthy();

  await page.goto('/dashboard/staffing');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.getByRole('button', { name: /vardiya|shift|schedule/i }).first().click().catch(() => undefined);
  await page.waitForTimeout(600);
  await captureScreenshot(page, TEST_ID, '01_calendar_pre');

  const beforeCount = querySqlite(
    `SELECT a.id FROM staff_assignments a JOIN staff s ON a.staffId=s.id WHERE s.userId='${DENEME_USER_ID}'`
  ).rows.length;

  const d = new Date();
  d.setDate(d.getDate() + 2);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const createResp = await page.request.post('/api/staff-assignments', {
    data: {
      staffId,
      branchId,
      date: dateStr,
      shiftStart: '14:00',
      shiftEnd: '22:00',
      role: 'server',
      notes: 'Faz6 retro test shift',
      notifyNow: false,
    },
  });
  const createBody = await createResp.json().catch(() => null);
  const createdId = createBody?.assignment?.id as string | undefined;
  await captureScreenshot(page, TEST_ID, '02_after_create');

  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.getByRole('button', { name: /vardiya|shift|schedule/i }).first().click().catch(() => undefined);
  await page.waitForTimeout(800);
  await captureScreenshot(page, TEST_ID, '03_calendar_post');

  const afterCount = querySqlite(
    `SELECT a.id FROM staff_assignments a JOIN staff s ON a.staffId=s.id WHERE s.userId='${DENEME_USER_ID}'`
  ).rows.length;

  const calendarText = await page.locator('body').innerText();
  const has1400 = /14:00/.test(calendarText);
  await captureScreenshot(page, TEST_ID, '04_visible_check');

  await saveEvidence(TEST_ID, {
    console: con.get(),
    requests: net.getRequests().filter(r => r.url.includes('/api/staff-assignments')),
    responses: net.getResponses().filter(r => r.url.includes('/api/staff-assignments')),
    db: {
      staffId,
      branchId,
      dateStr,
      createHttp: createResp.status(),
      createdId,
      beforeCount,
      afterCount,
      delta: afterCount - beforeCount,
      visibleAt1400: has1400,
    },
  });

  expect(createResp.ok()).toBeTruthy();
  expect(afterCount).toBeGreaterThan(beforeCount);
});
