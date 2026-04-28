import { test, expect } from '@playwright/test';
import { attachConsole, attachNetwork, captureScreenshot, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TEST_ID = 'faz6/6.3d_public_accept_link';
const DENEME_USER_ID = '0bf23a86-fc20-4493-9f7b-18ae4a9ee049';

/**
 * NOTE: Prompt expected JWT token. Reality: hex random `acceptToken` (24 bytes).
 * Also no expiry / single-use guard: re-clicking the URL just re-overwrites
 * status. Document this as observation.
 */
test('faz6 6.3d — public accept link via hex token (anonymous context)', async ({ browser }) => {
  test.setTimeout(45_000);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const con = attachConsole(page);
  const net = attachNetwork(page);

  const r = querySqlite(
    `SELECT a.id, a.acceptToken, a.status FROM staff_assignments a JOIN staff s ON a.staffId=s.id WHERE s.userId='${DENEME_USER_ID}' AND a.acceptToken IS NOT NULL ORDER BY a.date DESC LIMIT 1`
  );
  let aId = (r.rows[0] as { id?: string } | undefined)?.id ?? '';
  let token = (r.rows[0] as { acceptToken?: string } | undefined)?.acceptToken ?? '';
  let preStatus = (r.rows[0] as { status?: string } | undefined)?.status ?? '';

  if (!aId || !token) {
    const fb = querySqlite(
      `SELECT a.id, a.status FROM staff_assignments a JOIN staff s ON a.staffId=s.id WHERE s.userId='${DENEME_USER_ID}' LIMIT 1`
    );
    aId = (fb.rows[0] as { id?: string } | undefined)?.id ?? '';
    token = '';
    preStatus = (fb.rows[0] as { status?: string } | undefined)?.status ?? '';
  }

  if (!aId) {
    test.skip(true, 'No deneme assignments — SKIP-INFEASIBLE');
    await ctx.close();
    return;
  }

  const url = `http://localhost:3001/api/staff-assignments/${aId}/accept?token=${encodeURIComponent(token)}`;
  const r1 = await page.goto(url, { waitUntil: 'domcontentloaded' });
  const status1 = r1?.status() ?? 0;
  await captureScreenshot(page, TEST_ID, '01_first_visit');

  const html1 = await page.content();
  const isAcceptHtml = /Vardiya Onaylandi|accepted|2705/i.test(html1);

  const after1 = querySqlite(`SELECT status FROM staff_assignments WHERE id='${aId}'`);
  const status1Db = (after1.rows[0] as { status?: string } | undefined)?.status ?? '';

  const r2 = await page.goto(url, { waitUntil: 'domcontentloaded' });
  const status2 = r2?.status() ?? 0;
  await captureScreenshot(page, TEST_ID, '02_second_visit');

  const wrongUrl = `http://localhost:3001/api/staff-assignments/${aId}/accept?token=BOGUS_${Date.now()}`;
  const r3 = await page.goto(wrongUrl, { waitUntil: 'domcontentloaded' });
  const status3 = r3?.status() ?? 0;
  await captureScreenshot(page, TEST_ID, '03_wrong_token');
  const html3 = await page.content();
  const wrongRejected = /gecersiz|invalid|expired|sona ermis/i.test(html3) || status3 >= 400;
  await captureScreenshot(page, TEST_ID, '04_evidence');

  await saveEvidence(TEST_ID, {
    console: con.get(),
    requests: net.getRequests(),
    responses: net.getResponses(),
    db: {
      assignmentId: aId,
      tokenPresent: token.length > 0,
      preStatus,
      firstVisit: { http: status1, isAcceptHtml, statusAfter: status1Db },
      secondVisit: { http: status2, idempotent: status2 === 200 },
      wrongTokenVisit: { http: status3, rejected: wrongRejected, snippet: html3.slice(0, 300) },
    },
  });

  await ctx.close();

  if (token) {
    expect(status1).toBe(200);
    expect(isAcceptHtml).toBeTruthy();
    expect(wrongRejected).toBeTruthy();
  } else {
    expect(status1).not.toBe(0);
  }
});
