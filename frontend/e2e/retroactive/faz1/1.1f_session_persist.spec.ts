import { expect, test } from '@playwright/test';
import { loginAsAdmin } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';

const TID = 'faz1/1.1f';

test.describe('Faz 1 / 1.1f Session persists across page.reload()', () => {
  test('login + reload keeps user on /dashboard', async ({ page, context }) => {
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    await loginAsAdmin(page);
    await captureScreenshot(page, TID, '01_after_login');
    expect(page.url()).toMatch(/\/dashboard/);

    const cookiesBefore = await context.cookies();

    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '02_after_reload');

    const finalUrl = page.url();
    const stillOnDashboard = /\/dashboard/.test(finalUrl);
    const cookiesAfter = await context.cookies();

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests(),
      responses: net.getResponses(),
      db: {
        finalUrl,
        stillOnDashboard,
        cookiesBefore: cookiesBefore.map((c) => ({ name: c.name, expires: c.expires })),
        cookiesAfter: cookiesAfter.map((c) => ({ name: c.name, expires: c.expires })),
      },
    });

    expect(stillOnDashboard).toBe(true);
  });
});
