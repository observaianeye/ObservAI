import type { Page } from '@playwright/test';

export const ADMIN_EMAIL = 'admin@observai.com';
export const ADMIN_PASSWORD = 'demo1234';

export const DENEME_EMAIL = 'deneme@test.com';
export const DENEME_PASSWORD = '12345678';

/**
 * Login via UI form. Suppresses onboarding tour to avoid intercepted clicks.
 */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => {
    try {
      localStorage.setItem('hasSeenOnboarding', 'true');
    } catch {
      /* ignore */
    }
  });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
}

export async function loginAsDeneme(page: Page): Promise<void> {
  await loginAs(page, DENEME_EMAIL, DENEME_PASSWORD);
}

/**
 * Logout via API + redirect verify. UI dropdown varies per layout, API more deterministic.
 */
export async function logout(page: Page): Promise<void> {
  await page.request.post('/api/auth/logout').catch(() => undefined);
  await page.evaluate(() => {
    try {
      localStorage.removeItem('rememberedEmail');
      localStorage.removeItem('rememberMe');
    } catch {
      /* ignore */
    }
  });
  await page.goto('/login');
  await page.waitForURL(/\/login(\/|$)/, { timeout: 10_000 });
}
