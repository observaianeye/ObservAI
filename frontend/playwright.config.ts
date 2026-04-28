import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for ObservAI frontend.
 *
 * Assumes backend (:3001) and frontend (:5173) are already running.
 * For CI, launch them via start-all.bat or separate workflow steps before running.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,  // DB-state sensitive (auth tests share test user)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  outputDir: '../test-results/playwright-artifacts',
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../test-results/playwright-html' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
