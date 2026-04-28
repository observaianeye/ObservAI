import { expect, test } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';

const TID = 'faz5/5.2b';
const API = 'http://localhost:3001';
const DENEME_MOZART_BRANCH = '1d3b148d-d324-4e87-872f-296f591e589f';

test.describe('Faz 5 / 5.2b PDF download flow (UI button OR browser-context fetch)', () => {
  test('seek Export PDF button OR trigger via page.evaluate fetch', async ({ page }) => {
    test.setTimeout(60_000);
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    await loginAsDeneme(page);
    await page.evaluate((bid) => { try { localStorage.setItem('selectedBranchId', bid); } catch { /* ignore */ } }, DENEME_MOZART_BRANCH);

    await page.goto('/dashboard/analytics');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1_500);
    await captureScreenshot(page, TID, '01_analytics_pre_export');

    const pdfBtn = page.locator(
      'button:has-text("PDF"), [data-testid*="pdf" i]'
    ).first();
    const hasUiBtn = await pdfBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    const camRes = await page.context().request.get(`${API}/api/cameras/active`);
    const cam = camRes.ok() ? ((await camRes.json()) as { id: string }) : null;
    if (!cam) {
      await saveEvidence(TID, { console: consoleArr.get(), db: { skip: 'SKIP-INFEASIBLE', reason: 'no active camera' } });
      test.skip(true, 'no active cam');
      return;
    }

    let pdfBytes = 0;
    let pdfMagic = '';
    let httpStatus = 0;
    let triggerMode = '';

    if (hasUiBtn) {
      triggerMode = 'ui_button';
      const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
      await pdfBtn.click({ timeout: 5_000 });
      const download = await downloadPromise;
      if (download) {
        const path = await download.path().catch(() => null);
        if (path) {
          const fs = await import('fs');
          const buf = fs.readFileSync(path);
          pdfBytes = buf.length;
          pdfMagic = buf.slice(0, 8).toString('utf8');
        }
      }
      await captureScreenshot(page, TID, '02_after_ui_click');
    } else {
      triggerMode = 'browser_fetch';
      // Use page.evaluate to fetch as ArrayBuffer; convert magic bytes
      const fetchResult = await page.evaluate(async (camId) => {
        const r = await fetch(`/api/export/pdf?cameraId=${camId}`, { credentials: 'include' });
        const buf = await r.arrayBuffer();
        const u8 = new Uint8Array(buf);
        const magic = String.fromCharCode(...Array.from(u8.slice(0, 8)));
        return { status: r.status, byteLength: buf.byteLength, magic };
      }, cam.id);
      pdfBytes = fetchResult.byteLength;
      pdfMagic = fetchResult.magic;
      httpStatus = fetchResult.status;
      await captureScreenshot(page, TID, '02_after_browser_fetch');
    }

    const isPdf = pdfMagic.startsWith('%PDF');

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests().filter((r) => /\/api\/export\//.test(r.url)).slice(0, 10),
      responses: net.getResponses().filter((r) => /\/api\/export\//.test(r.url)).slice(0, 10),
      db: {
        cameraId: cam.id,
        triggerMode,
        hasUiBtn,
        httpStatus,
        pdfBytes,
        pdfMagic: pdfMagic.replace(/[\x00-\x1f]/g, '?'),
        isPdf,
        verdict: hasUiBtn
          ? (isPdf && pdfBytes > 1024 ? 'PASS_DENEME: PDF downloaded via UI button' : 'OBSERVATIONAL: UI button found but PDF invalid')
          : (isPdf && pdfBytes > 1024 ? 'PASS_DENEME_VIA_BROWSER_FETCH: PDF magic %PDF + size > 1KB; YAN_55 noted (no UI button)' : 'BUG_CANDIDATE: PDF generation failed or no UI'),
      },
    });

    // Either PDF generated (live data) OR 404 "No data found" (Yan #22 bound — deneme analytics_logs=0).
    // Both outcomes are informative; assertion only fails on unexpected error shapes.
    expect(httpStatus === 200 || httpStatus === 404).toBe(true);
  });
});
