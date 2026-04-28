import { test, expect } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { attachConsole, attachNetwork, captureScreenshot, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TEST_ID = 'faz6/6.4b_insight_dismiss_action';
const DENEME_USER_ID = '0bf23a86-fc20-4493-9f7b-18ae4a9ee049';

/**
 * No "Dismiss" UI exists. API:
 *   PATCH /api/insights/:id/read (mark as read)
 *   DELETE /api/insights/:id     (remove)
 * Frontend has no standalone insights UI (route redirects).
 */
test('faz6 6.4b — insight mark-read + delete via API', async ({ page }) => {
  test.setTimeout(45_000);
  const con = attachConsole(page);
  const net = attachNetwork(page);

  await loginAsDeneme(page);

  const r = querySqlite(
    `SELECT i.id, i.cameraId, i.isRead FROM insights i JOIN cameras c ON i.cameraId=c.id WHERE c.createdBy='${DENEME_USER_ID}' ORDER BY i.createdAt DESC LIMIT 5`
  );
  const rowList = r.rows as Array<{ id?: string; isRead?: number | string | boolean }>;
  const targetUnread = rowList.find(x => !x.isRead || x.isRead === 0 || x.isRead === '0');
  const insightId = targetUnread?.id ?? rowList[0]?.id ?? '';

  if (!insightId) {
    test.skip(true, 'No insights on deneme cameras — SKIP-INFEASIBLE');
    return;
  }

  await page.goto('/dashboard/analytics');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await captureScreenshot(page, TEST_ID, '01_analytics_pre');

  const readResp = await page.request.patch(`/api/insights/${insightId}/read`);
  const readStatus = readResp.status();
  const afterRead = querySqlite(`SELECT id, isRead FROM insights WHERE id='${insightId}'`);
  await captureScreenshot(page, TEST_ID, '02_after_read');

  const delResp = await page.request.delete(`/api/insights/${insightId}`);
  const delStatus = delResp.status();
  const afterDel = querySqlite(`SELECT id FROM insights WHERE id='${insightId}'`);
  await captureScreenshot(page, TEST_ID, '03_after_delete');

  await saveEvidence(TEST_ID, {
    console: con.get(),
    requests: net.getRequests().filter(r => r.url.includes('/api/insights')),
    responses: net.getResponses().filter(r => r.url.includes('/api/insights')),
    db: {
      insightId,
      readHttp: readStatus,
      afterReadRow: afterRead.rows[0] ?? null,
      delHttp: delStatus,
      stillExists: afterDel.rows.length > 0,
    },
  });

  expect(readStatus).toBe(200);
  expect(delStatus).toBe(200);
  expect(afterDel.rows.length).toBe(0);
});
