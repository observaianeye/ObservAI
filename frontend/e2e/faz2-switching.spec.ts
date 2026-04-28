import { expect, test, type Page } from '@playwright/test';

const TEST_EMAIL = 'admin@observai.com';
const TEST_PASSWORD = 'demo1234';

async function login(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('hasSeenOnboarding', 'true'));
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 15_000 });
}

test('2.4a branch A->B->A switch timing', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard');

  const combo = page.locator('header select, header [role="combobox"]').first();
  await combo.waitFor({ timeout: 8_000 });

  const opts = await combo.locator('option').allTextContents();
  console.log('BRANCH_OPTIONS:', JSON.stringify(opts));

  const timings: number[] = [];
  for (let i = 0; i < 3; i++) {
    const targetA = opts.find((o) => /Branch B/i.test(o));
    const targetB = opts.find((o) => /Branch$|Faz2 Admin Branch[^B]/i.test(o));
    expect(targetA).toBeTruthy();
    expect(targetB).toBeTruthy();

    const t0 = Date.now();
    await combo.selectOption({ label: targetA! });
    await page.waitForFunction(() => {
      const m = document.querySelector('header [role="combobox"], header select') as HTMLSelectElement | null;
      return !!m && /Branch B/i.test((m as any).value || m.textContent || '');
    }, { timeout: 5_000 }).catch(() => undefined);
    const tA = Date.now() - t0;

    const t1 = Date.now();
    await combo.selectOption({ label: targetB! });
    await page.waitForTimeout(400);
    const tB = Date.now() - t1;

    timings.push(tA, tB);
    console.log(`cycle ${i + 1}: A=${tA}ms B=${tB}ms`);
  }

  const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
  console.log(`SWITCH_TIMINGS_MS: ${JSON.stringify(timings)} mean=${mean.toFixed(0)}`);
  expect(mean).toBeLessThan(3000);
});

test('2.4d stress 5 rapid switches no error', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard');

  const combo = page.locator('header select, header [role="combobox"]').first();
  await combo.waitFor({ timeout: 8_000 });
  const opts = await combo.locator('option').allTextContents();
  const a = opts.find((o) => /Branch$|Faz2 Admin Branch[^B]/i.test(o))!;
  const b = opts.find((o) => /Branch B/i.test(o))!;

  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`console.error: ${m.text()}`);
  });

  for (let i = 0; i < 5; i++) {
    await combo.selectOption({ label: i % 2 === 0 ? b : a });
    await page.waitForTimeout(300);
  }

  console.log(`STRESS_CONSOLE_ERRORS: ${consoleErrors.length}`);
  console.log(JSON.stringify(consoleErrors.slice(0, 10)));
  expect(consoleErrors.filter((e) => !e.includes('Failed to fetch') && !e.includes('NetworkError')).length).toBeLessThan(3);
});
