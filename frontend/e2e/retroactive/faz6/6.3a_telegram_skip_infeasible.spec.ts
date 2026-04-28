import { test, expect } from '@playwright/test';
import { attachConsole, attachNetwork, captureScreenshot, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TEST_ID = 'faz6/6.3a_telegram_skip_infeasible';

/**
 * Documented SKIP-INFEASIBLE: Telegram dispatch was REMOVED from the system.
 * Source code review (notificationDispatcher.ts:6) explicitly states
 * "Email-only dispatch. Telegram was removed per product decision".
 *
 * Staff schema (staff.ts) has NO `telegramChatId` field. Only email + phone.
 *
 * This spec captures the evidence (DB column inspection + frontend rendering).
 */
test('faz6 6.3a — Telegram channel removed (SKIP-INFEASIBLE, evidence-only)', async ({ page }) => {
  test.setTimeout(30_000);
  const con = attachConsole(page);
  const net = attachNetwork(page);

  const cols = querySqlite(`PRAGMA table_info(staff)`);
  const colNames = (cols.rows as Array<{ name?: string }>).map(c => c.name ?? '');
  const hasTelegramCol = colNames.some(n => /telegram/i.test(n));

  const channelDist = querySqlite(
    `SELECT channel, COUNT(*) AS c FROM notification_logs GROUP BY channel`
  );

  await page.goto('/');
  await captureScreenshot(page, TEST_ID, '01_landing');
  await page.goto('/login');
  await captureScreenshot(page, TEST_ID, '02_login');

  await saveEvidence(TEST_ID, {
    console: con.get(),
    requests: net.getRequests(),
    responses: net.getResponses(),
    db: {
      verdict: 'SKIP-INFEASIBLE',
      reason: 'Telegram removed (email-only system per notificationDispatcher.ts:6)',
      staffColumns: colNames,
      hasTelegramColumn: hasTelegramCol,
      notificationChannels: channelDist.rows,
    },
  });

  expect(hasTelegramCol).toBe(false);
  const tgRows = (channelDist.rows as Array<{ channel?: string }>).filter(r => /telegram/i.test(r.channel ?? ''));
  expect(tgRows.length).toBe(0);
});
