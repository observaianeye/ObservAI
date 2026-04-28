import { expect, test } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';

const TID = 'faz5/5.2a';
const API = 'http://localhost:3001';
const DENEME_MOZART_BRANCH = '1d3b148d-d324-4e87-872f-296f591e589f';

test.describe('Faz 5 / 5.2a CSV download flow (UI button OR browser-context fetch)', () => {
  test('seek Export CSV button OR trigger via page.evaluate fetch with cookie', async ({ page }) => {
    test.setTimeout(60_000);
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    await loginAsDeneme(page);
    await page.evaluate((bid) => { try { localStorage.setItem('selectedBranchId', bid); } catch { /* ignore */ } }, DENEME_MOZART_BRANCH);

    await page.goto('/dashboard/analytics');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1_500);
    await captureScreenshot(page, TID, '01_analytics_pre_export');

    // Try to find an Export CSV button (multilingual + role + text)
    const csvBtn = page.locator(
      'button:has-text("CSV"), button:has-text("Export"), button:has-text("Indir"), button:has-text("Disa Aktar"), button:has-text("Dışa Aktar"), [data-testid*="csv" i], [data-testid*="export" i]'
    ).first();
    const hasUiBtn = await csvBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    // Get active camera id
    const camRes = await page.context().request.get(`${API}/api/cameras/active`);
    const cam = camRes.ok() ? ((await camRes.json()) as { id: string; name?: string }) : null;
    if (!cam) {
      await saveEvidence(TID, { console: consoleArr.get(), db: { skip: 'SKIP-INFEASIBLE', reason: 'no active camera' } });
      test.skip(true, 'no active cam');
      return;
    }

    // Either click UI button (with download capture) OR fetch via page.evaluate (browser context).
    let csvBytes = 0;
    let csvFirstLine = '';
    let csvHttpStatus = 0;
    let triggerMode = '';

    if (hasUiBtn) {
      triggerMode = 'ui_button';
      const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
      await csvBtn.click({ timeout: 5_000 });
      const download = await downloadPromise;
      if (download) {
        const path = await download.path().catch(() => null);
        if (path) {
          const fs = await import('fs');
          csvBytes = fs.statSync(path).size;
          csvFirstLine = fs.readFileSync(path, 'utf8').split(/\r?\n/)[0];
        }
      }
      await captureScreenshot(page, TID, '02_after_ui_click');
    } else {
      triggerMode = 'browser_fetch';
      // Browser context fetch — uses page cookies, runs in browser thread, true browser-grounded test
      const fetchResult = await page.evaluate(async (camId) => {
        const r = await fetch(`/api/export/csv?cameraId=${camId}`, { credentials: 'include' });
        const text = await r.text();
        return { status: r.status, byteLength: text.length, firstLine: text.split(/\r?\n/)[0] };
      }, cam.id);
      csvBytes = fetchResult.byteLength;
      csvFirstLine = fetchResult.firstLine;
      csvHttpStatus = fetchResult.status;
      await captureScreenshot(page, TID, '02_after_browser_fetch');
    }

    const headerLooksOk = /Timestamp|Camera|People|FPS/i.test(csvFirstLine);

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests().filter((r) => /\/api\/export\//.test(r.url)).slice(0, 10),
      responses: net.getResponses().filter((r) => /\/api\/export\//.test(r.url)).slice(0, 10),
      db: {
        cameraId: cam.id,
        triggerMode,
        hasUiBtn,
        csvHttpStatus,
        csvBytes,
        csvFirstLine: csvFirstLine.slice(0, 200),
        headerLooksOk,
        verdict: hasUiBtn
          ? (csvBytes > 100 ? 'PASS_DENEME: CSV downloaded via UI button' : 'OBSERVATIONAL: UI button found but download empty')
          : (csvBytes > 100 && headerLooksOk ? 'PASS_DENEME_VIA_BROWSER_FETCH: CSV via page.evaluate; YAN_55 noted (no UI Export button)' : 'BUG_CANDIDATE: no UI button + fetch did not return data'),
      },
    });

    expect(csvBytes).toBeGreaterThan(50);
  });
});
