import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * Stage 8 — "Remember Me" must persist the session across browser restarts.
 *
 * The test simulates a cold browser restart using Playwright's storageState():
 *   1. Context A logs in with rememberMe=true → session cookie is issued with 30-day expiry.
 *   2. Storage state (cookies + localStorage) is serialized and Context A is torn down.
 *   3. Context B is rehydrated from that storage state → behaves as if the user
 *      reopened their browser days later. /dashboard must be reachable without re-login.
 *
 * Requires backend (:3001) + frontend (:5173) running with seeded admin user
 * (see backend/prisma/seed.ts: admin@observai.com / demo1234). If the backend is
 * unreachable we skip rather than fail — the CI Playwright matrix doesn't own the
 * backend process.
 */

const TEST_EMAIL = 'admin@observai.com';
const TEST_PASSWORD = 'demo1234';

async function backendReachable(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get('/api/auth/me', { timeout: 3_000 });
    // 200 (already logged in) or 401 (anonymous) both prove the API is alive.
    return res.status() === 200 || res.status() === 401;
  } catch {
    return false;
  }
}

test.describe('auth persistence (Remember Me)', () => {
  test('rememberMe keeps the user signed in across browser restart', async ({ browser, request }) => {
    test.skip(!(await backendReachable(request)), 'Backend not reachable on :3001 — skipping');

    // --- Context A: fresh browser, log in with Remember Me checked --------------
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();

    await pageA.goto('/login');
    await pageA.locator('input[type="email"]').fill(TEST_EMAIL);
    await pageA.locator('input[type="password"]').fill(TEST_PASSWORD);

    const rememberCheckbox = pageA.locator('input[type="checkbox"]').first();
    await rememberCheckbox.check();
    await expect(rememberCheckbox).toBeChecked();

    await pageA.locator('button[type="submit"]').click();
    await pageA.waitForURL(/\/dashboard(\/|$)/, { timeout: 15_000 });

    // The session cookie must be present AND have a future expiry (rememberMe=true → ~30d).
    const cookies = await ctxA.cookies();
    const sessionCookie = cookies.find((c) => /session|sid|auth/i.test(c.name));
    expect(sessionCookie, 'session cookie issued after login').toBeTruthy();
    if (sessionCookie) {
      // -1 means session cookie (browser-lifetime) — Remember Me must persist longer.
      expect(sessionCookie.expires).toBeGreaterThan(Math.floor(Date.now() / 1000));
    }

    const storageState = await ctxA.storageState();
    await ctxA.close();

    // --- Context B: brand-new context seeded from the saved storage state -------
    const ctxB = await browser.newContext({ storageState });
    const pageB = await ctxB.newPage();

    // Go straight to a protected route. ProtectedRoute will bounce anonymous users
    // to /login — so staying on /dashboard proves the cookie was honoured.
    await pageB.goto('/dashboard');
    await pageB.waitForLoadState('networkidle').catch(() => undefined);

    await expect(pageB).toHaveURL(/\/dashboard(\/|$)/, { timeout: 10_000 });

    await ctxB.close();
  });

  test('logout clears remembered state', async ({ browser, request }) => {
    test.skip(!(await backendReachable(request)), 'Backend not reachable on :3001 — skipping');

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto('/login');
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 15_000 });

    // Log out via the same XHR the UI uses. We don't depend on a specific menu
    // element because the logout button lives in a dropdown that varies per layout.
    const logoutRes = await page.request.post('/api/auth/logout');
    expect(logoutRes.ok()).toBeTruthy();

    // Clear the remembered-email localStorage the way AuthContext.logout does,
    // so a follow-up test run starts from a clean slate.
    await page.evaluate(() => {
      localStorage.removeItem('rememberedEmail');
      localStorage.removeItem('rememberMe');
    });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login(\/|$)/, { timeout: 10_000 });

    await ctx.close();
  });
});
