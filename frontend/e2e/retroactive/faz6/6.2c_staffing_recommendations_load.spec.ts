import { test, expect } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { attachConsole, attachNetwork, captureScreenshot, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TEST_ID = 'faz6/6.2c_staffing_recommendations_load';
const DENEME_USER_ID = '0bf23a86-fc20-4493-9f7b-18ae4a9ee049';

/**
 * NOTE: Prompt expected an "AI Brifi" summary button (POST /api/staffing/summary).
 * Reality (post-source review): no such endpoint exists. The system has a
 * "Recommendations" tab driven by GET /api/staffing/:branchId/recommendations
 * (algorithmic, NOT Ollama-AI). This spec verifies the recommendations tab.
 */
test('faz6 6.2c — recommendations tab loads (algorithmic, not AI summary)', async ({ page }) => {
  test.setTimeout(45_000);
  const con = attachConsole(page);
  const net = attachNetwork(page);

  await loginAsDeneme(page);
  const branchRow = querySqlite(`SELECT id, name FROM branches WHERE userId='${DENEME_USER_ID}' LIMIT 1`);
  const branchId = (branchRow.rows[0] as { id?: string } | undefined)?.id ?? '';

  await page.goto('/dashboard/staffing');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await captureScreenshot(page, TEST_ID, '01_pre_click');

  const respPromise = page.waitForResponse(
    r => r.url().includes('/api/staffing/') && r.url().includes('/recommendations'),
    { timeout: 10_000 }
  ).catch(() => null);
  await page.getByRole('button', { name: /oneri|recommendation|recommendations/i }).first().click().catch(() => undefined);
  await page.waitForTimeout(800);
  await captureScreenshot(page, TEST_ID, '02_recs_loading');

  const resp = await respPromise;
  await page.waitForTimeout(1500);
  await captureScreenshot(page, TEST_ID, '03_recs_loaded');

  const bodyText = await page.locator('body').innerText();
  const hasHourCards = /(\b0[7-9]:00|\b1[0-9]:00|\b2[0-3]:00)/.test(bodyText);
  const hasEmptyHint = /not enough|insufficient|yeterli|gun|day/i.test(bodyText);

  await saveEvidence(TEST_ID, {
    console: con.get(),
    requests: net.getRequests().filter(r => r.url.includes('/api/staffing')),
    responses: net.getResponses().filter(r => r.url.includes('/api/staffing')),
    db: {
      branchId,
      recsHttp: resp?.status() ?? null,
      hasHourCards,
      hasEmptyHint,
      bodySnippet: bodyText.slice(0, 400),
    },
  });

  expect(resp?.ok() ?? false).toBeTruthy();
  expect(hasHourCards || hasEmptyHint).toBeTruthy();
});
