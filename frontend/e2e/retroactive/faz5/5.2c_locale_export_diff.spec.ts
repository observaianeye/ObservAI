import { expect, test } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';

const TID = 'faz5/5.2c';
const API = 'http://localhost:3001';
const DENEME_MOZART_BRANCH = '1d3b148d-d324-4e87-872f-296f591e589f';

test.describe('Faz 5 / 5.2c Locale-aware export TR vs EN (Yan #41 visual)', () => {
  test('toggle Settings language TR/EN, fetch CSV both times, compare bytes', async ({ page }) => {
    test.setTimeout(120_000);
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    await loginAsDeneme(page);
    await page.evaluate((bid) => { try { localStorage.setItem('selectedBranchId', bid); } catch { /* ignore */ } }, DENEME_MOZART_BRANCH);

    const camRes = await page.context().request.get(`${API}/api/cameras/active`);
    const cam = camRes.ok() ? ((await camRes.json()) as { id: string }) : null;
    if (!cam) {
      await saveEvidence(TID, { console: consoleArr.get(), db: { skip: 'SKIP-INFEASIBLE', reason: 'no active camera' } });
      test.skip(true, 'no active cam');
      return;
    }

    // STEP 1: TR mode — set lang
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1_000);
    // Toggle: dispatch lang change directly via localStorage + reload (LanguageContext reads localStorage)
    await page.evaluate(() => { try { localStorage.setItem('lang', 'tr'); } catch { /* ignore */ } });
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '01_settings_TR');

    const trCsv = await page.evaluate(async (camId) => {
      const r = await fetch(`/api/export/csv?cameraId=${camId}`, {
        credentials: 'include',
        headers: { 'Accept-Language': 'tr-TR,tr' },
      });
      const text = await r.text();
      return { status: r.status, byteLength: text.length, firstLine: text.split(/\r?\n/)[0], md5: '', body: text.slice(0, 1000) };
    }, cam.id);
    await captureScreenshot(page, TID, '02_after_TR_fetch');

    // STEP 2: EN mode
    await page.evaluate(() => { try { localStorage.setItem('lang', 'en'); } catch { /* ignore */ } });
    await page.reload();
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '03_settings_EN');

    const enCsv = await page.evaluate(async (camId) => {
      const r = await fetch(`/api/export/csv?cameraId=${camId}`, {
        credentials: 'include',
        headers: { 'Accept-Language': 'en-US,en' },
      });
      const text = await r.text();
      return { status: r.status, byteLength: text.length, firstLine: text.split(/\r?\n/)[0], md5: '', body: text.slice(0, 1000) };
    }, cam.id);
    await captureScreenshot(page, TID, '04_after_EN_fetch');

    const sameSize = trCsv.byteLength === enCsv.byteLength;
    const sameHeader = trCsv.firstLine === enCsv.firstLine;
    const sameBody = trCsv.body === enCsv.body;

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests().filter((r) => /\/api\/export\//.test(r.url)).slice(0, 20),
      responses: net.getResponses().filter((r) => /\/api\/export\//.test(r.url)).slice(0, 20),
      db: {
        cameraId: cam.id,
        trBytes: trCsv.byteLength,
        trHeader: trCsv.firstLine,
        enBytes: enCsv.byteLength,
        enHeader: enCsv.firstLine,
        sameSize,
        sameHeader,
        sameBody,
        verdict: sameSize && sameHeader && sameBody
          ? 'YAN_41_VISUAL_CONFIRMED: TR and EN CSV byte-identical (server ignores Accept-Language + UI lang)'
          : 'YAN_41_REFUTED: locale-aware export now differs',
      },
    });

    expect(trCsv.byteLength).toBeGreaterThan(50);
    expect(enCsv.byteLength).toBeGreaterThan(50);
  });
});
