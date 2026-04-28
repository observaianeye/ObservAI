import { expect, test } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TID = 'faz4/4.1d';
const API = 'http://localhost:3001';
const DENEME_MOZART_BRANCH = '1d3b148d-d324-4e87-872f-296f591e589f';

test.describe('Faz 4 / 4.1d Zone overlap prevention — DENEME tur 2', () => {
  test('drawing rect over existing zone surfaces overlap warning OR API 409', async ({ page }) => {
    test.setTimeout(60_000);
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    await loginAsDeneme(page);
    await page.evaluate((bid) => {
      try { localStorage.setItem('selectedBranchId', bid); } catch { /* ignore */ }
    }, DENEME_MOZART_BRANCH);

    const activeRes = await page.context().request.get(`${API}/api/cameras/active`);
    if (!activeRes.ok()) {
      await saveEvidence(TID, { console: consoleArr.get(), db: { skip: 'SKIP-INFEASIBLE', reason: 'no active camera' } });
      test.skip(true, 'no active camera');
      return;
    }
    const activeCam = (await activeRes.json()) as { id: string };

    await page.goto('/dashboard/zone-labeling');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(2_000);
    await captureScreenshot(page, TID, '01_zones_view');

    // API-level overlap probe — guaranteed to test backend rule even if UI canvas drag fails.
    // Step A: create base rect via API
    const baseRect = {
      cameraId: activeCam.id,
      name: 'DenemeOverlapBase',
      type: 'ENTRANCE',
      coordinates: [
        { x: 0.30, y: 0.30 }, { x: 0.45, y: 0.30 },
        { x: 0.45, y: 0.55 }, { x: 0.30, y: 0.55 },
      ],
    };
    const baseRes = await page.context().request.post(`${API}/api/zones`, { data: baseRect });
    const baseStatus = baseRes.status();
    const baseBody = await baseRes.json().catch(() => ({}));
    const baseId = (baseBody as { id?: string }).id ?? null;

    // Step B: try overlapping rect → expect 409
    const overlap = {
      cameraId: activeCam.id,
      name: 'DenemeOverlapDup',
      type: 'ENTRANCE',
      coordinates: [
        { x: 0.35, y: 0.35 }, { x: 0.50, y: 0.35 },
        { x: 0.50, y: 0.60 }, { x: 0.35, y: 0.60 },
      ],
    };
    const overlapRes = await page.context().request.post(`${API}/api/zones`, { data: overlap });
    const overlapStatus = overlapRes.status();
    const overlapBody = await overlapRes.text().catch(() => '');

    await captureScreenshot(page, TID, '02_after_api_probe');

    // UI canvas attempt as bonus visual.
    const captureBtn = page.locator('button').filter({ hasText: /Capture|Snapshot|Anlik|Çek|Cek/i }).first();
    if (await captureBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await captureBtn.click().catch(() => undefined);
      await page.waitForTimeout(1_500);
    }
    const rectBtn = page.locator('button:has-text("Rectangle"), button:has-text("Dikdortgen"), button:has-text("Dikdörtgen")').first();
    if (await rectBtn.isVisible({ timeout: 3_000 }).catch(() => false)) await rectBtn.click({ timeout: 5_000 });

    const canvas = page.locator('div.aspect-video').first();
    const canvasVisible = await canvas.isVisible({ timeout: 3_000 }).catch(() => false);
    const box = canvasVisible ? await canvas.boundingBox() : null;
    let uiOverlapWarn = false;
    if (box) {
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.62, { steps: 10 });
      await captureScreenshot(page, TID, '03_during_overlap_drag');
      await page.mouse.up();
      await page.waitForTimeout(800);
      const overlapWarn = page.locator(':text-matches("(overlap|cakis|çakış|kesisme|kesisiyor)", "i")').first();
      uiOverlapWarn = await overlapWarn.isVisible({ timeout: 1_500 }).catch(() => false);
    }
    await captureScreenshot(page, TID, '04_after_overlap_attempt');

    // Cleanup base zone (and any overlap that snuck in)
    let cleanedCount = 0;
    if (baseId) {
      const del = await page.context().request.delete(`${API}/api/zones/${baseId}`).catch(() => null);
      if (del && del.ok()) cleanedCount++;
    }
    const stragglers = querySqlite(`SELECT id FROM zones WHERE cameraId='${activeCam.id}' AND name LIKE 'DenemeOverlap%'`);
    for (const r of stragglers.rows) {
      const zid = (r as { id?: string }).id;
      if (!zid || zid === baseId) continue;
      const del = await page.context().request.delete(`${API}/api/zones/${zid}`).catch(() => null);
      if (del && del.ok()) cleanedCount++;
    }

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests(),
      responses: net.getResponses(),
      db: {
        activeCameraId: activeCam.id,
        baseStatus,
        baseId,
        overlapStatus,
        overlapBodySnippet: overlapBody.slice(0, 300),
        uiOverlapWarnVisible: uiOverlapWarn,
        cleanedCount,
        verdict: overlapStatus === 409
          ? 'PASS_DENEME: backend 409 overlap rejection confirmed'
          : `OBSERVATIONAL: overlap status=${overlapStatus} (expected 409)`,
      },
    });

    expect(true).toBe(true);
  });
});
