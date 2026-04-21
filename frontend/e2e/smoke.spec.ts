import { expect, test } from '@playwright/test';

/**
 * Smoke test — proves the test harness boots and the dev server responds.
 * Runs without needing backend (landing page is public).
 */
test.describe('smoke', () => {
  test('landing page renders', async ({ page }) => {
    await page.goto('/');
    // Landing route usually redirects to /login or shows the marketing hero.
    await expect(page).toHaveURL(/\/(login|$)/);
  });

  test('login route accessible', async ({ page }) => {
    await page.goto('/login');
    // Email + password inputs must be visible for the Stage 8 auth-persistence spec to build on.
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
