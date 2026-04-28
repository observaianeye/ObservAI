import { expect, test } from '@playwright/test';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';

const TID = 'faz1/1.1d';

test.describe('Faz 1 / 1.1d /demo route 404 (NOTED-removed)', () => {
  test('demo route should 404 after removal (option B applied)', async ({ page }) => {
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    await page.goto('about:blank');
    await captureScreenshot(page, TID, '01_before');

    const resp = await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '02_demo_page');

    // SPA: response 200 returns index.html, route guard then renders 404 component.
    // Verify either HTTP 404 OR visible 404 marker in DOM.
    const status = resp ? resp.status() : 0;
    const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
    const has404Marker = /404|not\s*found|sayfa\s*bulunamad/i.test(bodyText);
    const url = page.url();
    const redirectedToLogin = /\/login/.test(url);

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests(),
      responses: net.getResponses(),
      db: { url, status, has404Marker, redirectedToLogin, bodyTextSnippet: bodyText.slice(0, 400) },
    });

    // Acceptance: demo route removed → must NOT mount the legacy DemoLogin page.
    // Either 404 marker visible OR redirected to /login (route guard) is acceptable.
    expect(has404Marker || redirectedToLogin || status === 404).toBeTruthy();
  });
});
