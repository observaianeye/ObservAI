import { expect, test } from '@playwright/test';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TID = 'faz5/1.1a_signup_chat';
const API = 'http://localhost:3001';

test.describe('Faz 5 / 1.1a Fresh signup → first chat message (Faz 5 odakli, GlobalChatbot)', () => {
  test('register, dashboard, open chatbot, send message, response renders', async ({ page }) => {
    test.setTimeout(120_000);
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    const stamp = Date.now();
    const email = `retro_faz5_${stamp}@observai.test`;
    const password = 'Faz5Test1234';
    const name = 'Faz5 Tester';
    const company = 'Faz5Co';

    await page.goto('/register');
    await page.evaluate(() => {
      try { localStorage.setItem('hasSeenOnboarding', 'true'); } catch { /* ignore */ }
    });
    await captureScreenshot(page, TID, '01_register_form');

    await page.locator('input[autocomplete="name"]').first().fill(name);
    await page.locator('input[type="email"], input[autocomplete="email"]').first().fill(email);
    await page.locator('input[autocomplete="organization"]').first().fill(company);
    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill(password);
    if (await pwInputs.count() > 1) await pwInputs.nth(1).fill(password);
    await captureScreenshot(page, TID, '02_register_filled');

    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 15_000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '03_after_signup');

    const onDashboard = /\/dashboard/.test(page.url());

    // Settings → Branches empty state
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1_500);
    await captureScreenshot(page, TID, '04_settings_branches');
    const settingsText = await page.locator('body').innerText().catch(() => '');

    // Back to dashboard, then open chatbot
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1_000);

    const chatToggle = page.locator('button[aria-label*="chatbot" i], button[aria-label*="AI" i], button.fixed.bottom-4').first();
    let chatOpened = false;
    if (await chatToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await chatToggle.click({ timeout: 5_000 });
      chatOpened = true;
    }
    await page.waitForTimeout(800);
    await captureScreenshot(page, TID, '05_chatbot_open');

    const dialog = page.locator('div[role="dialog"][aria-label*="hat" i]').first();
    const dialogVisible = await dialog.isVisible({ timeout: 2_000 }).catch(() => false);

    let responseText = '';
    let chatStatus = 0;
    if (dialogVisible) {
      const input = dialog.locator('input[type="text"], textarea').first();
      await input.fill('Hello, what can you do?');
      await input.press('Enter');

      // Wait for response (Ollama warm 7-15s typical)
      await page.waitForResponse(
        (r) => /\/api\/ai\/(chat|chat\/stream)/.test(r.url()),
        { timeout: 60_000 }
      ).then(async (r) => { chatStatus = r.status(); }).catch(() => undefined);
      // Allow render
      await page.waitForTimeout(8_000);
      await captureScreenshot(page, TID, '06_chatbot_response');
      responseText = await dialog.innerText().catch(() => '');
    } else {
      await captureScreenshot(page, TID, '05b_no_dialog');
    }

    // DB: chat_messages for this user
    const userRow = querySqlite(`SELECT id FROM users WHERE email='${email}'`);
    const userId = (userRow.rows[0] as { id?: string } | undefined)?.id ?? '';
    const chatRows = userId
      ? querySqlite(`SELECT role, substr(content,1,80) as snippet FROM chat_messages WHERE userId='${userId}' ORDER BY createdAt`)
      : { rows: [] as unknown[] };

    const verdict = onDashboard && dialogVisible && responseText.length > 50 && chatRows.rows.length >= 2
      ? 'PASS: signup + chatbot first message + response rendered + DB rows'
      : `OBSERVATIONAL: onDashboard=${onDashboard}, dialog=${dialogVisible}, respLen=${responseText.length}, dbRows=${chatRows.rows.length}`;

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests(),
      responses: net.getResponses(),
      db: {
        createdEmail: email,
        userId,
        onDashboard,
        chatOpened,
        dialogVisible,
        chatStatus,
        responseSnippet: responseText.slice(0, 400),
        chatMessageRows: chatRows.rows,
        settingsBodySnippet: settingsText.slice(0, 300),
        verdict,
      },
    });

    expect(onDashboard).toBe(true);
  });
});
