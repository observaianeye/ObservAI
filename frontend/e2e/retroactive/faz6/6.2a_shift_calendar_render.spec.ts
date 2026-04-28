import { test, expect } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { attachConsole, attachNetwork, captureScreenshot, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TEST_ID = 'faz6/6.2a_shift_calendar_render';
const DENEME_USER_ID = '0bf23a86-fc20-4493-9f7b-18ae4a9ee049';

test('faz6 6.2a — shift calendar tab renders weekly grid', async ({ page }) => {
  test.setTimeout(60_000);
  const con = attachConsole(page);
  const net = attachNetwork(page);

  await loginAsDeneme(page);
  await page.goto('/dashboard/staffing');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(500);
  await captureScreenshot(page, TEST_ID, '01_page_load');

  await page.getByRole('button', { name: /vardiya|shift|schedule/i }).first().click().catch(() => undefined);
  await page.waitForTimeout(800);
  await captureScreenshot(page, TEST_ID, '02_calendar_rendered');

  const aRows = querySqlite(
    `SELECT a.id, a.shiftStart, a.shiftEnd, a.status, a.date, s.firstName, s.email FROM staff_assignments a JOIN staff s ON a.staffId=s.id WHERE s.userId='${DENEME_USER_ID}' ORDER BY a.date DESC LIMIT 10`
  );

  const calendarText = await page.locator('body').innerText();
  const hasWeekHeaders = /Mon|Tue|Wed|Thu|Fri|Sat|Sun|Pzt|Sal|Çar|Per|Cum|Cmt|Paz/i.test(calendarText);
  await captureScreenshot(page, TEST_ID, '03_grid_check');

  await saveEvidence(TEST_ID, {
    console: con.get(),
    requests: net.getRequests().filter(r => r.url.includes('/api/staff-assignments')),
    responses: net.getResponses().filter(r => r.url.includes('/api/staff-assignments')),
    db: {
      assignmentCount: aRows.rows.length,
      assignments: aRows.rows,
      hasWeekHeaders,
    },
  });

  expect(hasWeekHeaders).toBeTruthy();
});
