/**
 * QA 50-Test Browser Validation
 * Login: deneme@test.com / 12345678
 * Output: test-results/screenshots/T<N>.png
 */
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const FRONT = 'http://localhost:5173';
const API = 'http://localhost:3001';
const PY = 'http://localhost:5001';
const SHOTS = path.resolve(process.cwd(), '..', 'test-results', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const EVIDENCE: Record<string, any> = {};

async function login(page: Page, remember = true) {
  await page.goto(`${FRONT}/login`);
  await page.waitForLoadState('networkidle');
  // Find email/password fields by name or placeholder
  const email = page.locator('input[type="email"], input[name="email"]').first();
  await email.fill('deneme@test.com');
  const pass = page.locator('input[type="password"], input[name="password"]').first();
  await pass.fill('12345678');
  if (remember) {
    const rem = page.locator('input[type="checkbox"]').first();
    if (await rem.isVisible().catch(() => false)) await rem.check();
  }
  await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Giriş")').first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
}

test.describe.serial('ObservAI 50-test QA', () => {

  test('T1: Landing page renders', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(FRONT, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SHOTS, 'T1.png'), fullPage: false });
    const title = await page.title();
    const html = await page.content();
    EVIDENCE.T1 = { title, htmlBytes: html.length, errors: errors.slice(0, 3) };
    expect(html.length).toBeGreaterThan(500);
  });

  test('T5: Session refresh persistence', async ({ page }) => {
    await login(page);
    const urlBefore = page.url();
    await page.screenshot({ path: path.join(SHOTS, 'T5_before_refresh.png') });
    await page.reload({ waitUntil: 'networkidle' });
    const urlAfter = page.url();
    const stillLoggedIn = !urlAfter.includes('/login');
    await page.screenshot({ path: path.join(SHOTS, 'T5_after_refresh.png') });
    EVIDENCE.T5 = { urlBefore, urlAfter, stillLoggedIn };
    expect(stillLoggedIn).toBe(true);
  });

  test('T14+T17+T33: Dashboard render + chatbot + demographics', async ({ page }) => {
    await login(page);
    await page.goto(`${FRONT}/dashboard`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SHOTS, 'T14_dashboard.png'), fullPage: true });

    // Look for video / camera feed (MJPEG)
    const videoEls = await page.locator('img[src*="mjpeg"], video, canvas').count();
    EVIDENCE.T14 = { mediaElements: videoEls };

    // T17: demographics widget — try to find any text mentioning gender/age
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hasDemoKeywords = /demograf|erkek|kadın|gender|age|yaş|female|male/i.test(bodyText);
    EVIDENCE.T17 = { hasDemoKeywords, bodyTextLen: bodyText.length };

    // T33: chatbot sparkles button
    const chatBtn = page.locator('[data-testid="chatbot-toggle"]').first();
    const chatBtnVisible = await chatBtn.isVisible().catch(() => false);
    EVIDENCE.T33 = { chatBtnVisible };
    if (chatBtnVisible) {
      await chatBtn.click().catch(() => {});
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SHOTS, 'T33_chatbot.png') });
      const dialog = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);
      EVIDENCE.T33.dialogOpened = dialog;
    }
  });

  test('T46+T47: Settings sections + i18n toggle', async ({ page }) => {
    await login(page);
    await page.goto(`${FRONT}/dashboard/settings`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, 'T46_settings.png'), fullPage: true });

    const bodyText = await page.locator('body').innerText().catch(() => '');
    // Detect 5 settings sections — by Turkish/English keywords
    const sections = {
      branches: /şube|branch/i.test(bodyText),
      notifications: /bildirim|notification/i.test(bodyText),
      language: /dil|language|region/i.test(bodyText),
      profile: /profil|profile/i.test(bodyText),
      security: /güvenlik|security|password|şifre/i.test(bodyText),
    };
    const sectionsCount = Object.values(sections).filter(Boolean).length;
    EVIDENCE.T46 = { sections, sectionsCount };

    // T47: language toggle — find a select with TR/EN option
    const langSelect = page.locator('select').first();
    const langCount = await page.locator('select').count();
    EVIDENCE.T47 = { langSelectCount: langCount };

    // Try setting localStorage manually + reload to verify i18n
    const beforeLang = await page.evaluate(() => localStorage.getItem('lang'));
    await page.evaluate(() => localStorage.setItem('lang', 'en'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const afterLang = await page.evaluate(() => localStorage.getItem('lang'));
    const enText = await page.locator('body').innerText().catch(() => '');
    await page.screenshot({ path: path.join(SHOTS, 'T47_en.png') });

    await page.evaluate(() => localStorage.setItem('lang', 'tr'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const trText = await page.locator('body').innerText().catch(() => '');
    await page.screenshot({ path: path.join(SHOTS, 'T47_tr.png') });

    EVIDENCE.T47 = {
      ...EVIDENCE.T47,
      beforeLang,
      afterLang,
      enHasBranches: /branch/i.test(enText),
      trHasSube: /şube/i.test(trText),
    };
  });

  test('T26: Table state machine probe (60s observation)', async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
    await page.goto(`${FRONT}/dashboard/tables`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SHOTS, 'T26_initial.png'), fullPage: true });

    // Wait 65s and re-screenshot
    await page.waitForTimeout(65000);
    await page.screenshot({ path: path.join(SHOTS, 'T26_after65s.png'), fullPage: true });

    // Read tables data via API
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'session_token');
    const resp = await fetch(`${API}/api/tables/f1fd68f7-91be-4c01-8242-82baf69715dd`, {
      headers: { Cookie: `session_token=${sessionCookie?.value}` }
    });
    const data: any = await resp.json();
    EVIDENCE.T26 = {
      tableCount: data.tables?.length ?? 0,
      statuses: data.tables?.map((t: any) => ({ id: t.zoneId?.slice(0, 8), name: t.zoneName, status: t.status })) ?? [],
    };
  });

  test.afterAll(async () => {
    fs.writeFileSync(path.join(SHOTS, '..', 'qa-50-evidence.json'), JSON.stringify(EVIDENCE, null, 2));
  });
});
