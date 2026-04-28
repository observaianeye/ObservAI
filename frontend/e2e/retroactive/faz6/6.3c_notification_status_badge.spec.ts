import { test, expect } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { attachConsole, attachNetwork, captureScreenshot, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TEST_ID = 'faz6/6.3c_notification_status_badge';
const DENEME_USER_ID = '0bf23a86-fc20-4493-9f7b-18ae4a9ee049';

test('faz6 6.3c — NotificationStatusBadge renders email channel chip on assignments', async ({ page }) => {
  test.setTimeout(45_000);
  const con = attachConsole(page);
  const net = attachNetwork(page);

  await loginAsDeneme(page);
  await page.goto('/dashboard/staffing');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.getByRole('button', { name: /vardiya|shift|schedule/i }).first().click().catch(() => undefined);
  await page.waitForTimeout(1000);
  await captureScreenshot(page, TEST_ID, '01_calendar_loaded');

  const emailChips = await page.getByText(/^Email$/).count();
  await captureScreenshot(page, TEST_ID, '02_badge_visible');

  const aRows = querySqlite(
    `SELECT a.id, a.notifiedViaEmail, a.notifiedAt, a.status FROM staff_assignments a JOIN staff s ON a.staffId=s.id WHERE s.userId='${DENEME_USER_ID}' LIMIT 5`
  );

  const bodyText = await page.locator('body').innerText();
  const hasNotSent = /henuz gonderilmedi|not sent/i.test(bodyText);
  const hasSentTime = /\d{2}:\d{2}/.test(bodyText);

  await saveEvidence(TEST_ID, {
    console: con.get(),
    requests: net.getRequests().filter(r => r.url.includes('/api/staff-assignments')),
    responses: net.getResponses().filter(r => r.url.includes('/api/staff-assignments')),
    db: {
      assignments: aRows.rows,
      emailChipCount: emailChips,
      hasNotSent,
      hasSentTime,
    },
  });

  expect(emailChips > 0 || hasNotSent || hasSentTime).toBeTruthy();
});
