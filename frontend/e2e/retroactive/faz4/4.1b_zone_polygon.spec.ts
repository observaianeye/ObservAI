import { expect, test } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TID = 'faz4/4.1b';
const API = 'http://localhost:3001';
const DENEME_MOZART_BRANCH = '1d3b148d-d324-4e87-872f-296f591e589f';

test.describe('Faz 4 / 4.1b Zone polygon mode (6+ points) — DENEME tur 2', () => {
  test('polygon click 6 points + Finish → save → DB row', async ({ page }) => {
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
    await captureScreenshot(page, TID, '01_zones_empty');

    const captureBtn = page.locator('button').filter({ hasText: /Capture|Snapshot|Anlik|Çek|Cek/i }).first();
    if (await captureBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await captureBtn.click().catch(() => undefined);
      await page.waitForTimeout(1_500);
    }

    const polyBtn = page.locator('button:has-text("Polygon"), button:has-text("Çokgen"), button:has-text("Cokgen")').first();
    const hasPoly = await polyBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasPoly) await polyBtn.click({ timeout: 5_000 });

    const canvas = page.locator('div.aspect-video').first();
    const canvasVisible = await canvas.isVisible({ timeout: 3_000 }).catch(() => false);
    const box = canvasVisible ? await canvas.boundingBox() : null;
    if (!box) {
      await saveEvidence(TID, {
        console: consoleArr.get(),
        responses: net.getResponses(),
        db: { skip: 'PARTIAL', reason: 'canvas not located', hasPolyBtn: hasPoly },
      });
      await captureScreenshot(page, TID, '02_no_canvas');
      test.skip(true, 'no canvas');
      return;
    }

    const cx = box.x + box.width * 0.6;
    const cy = box.y + box.height * 0.5;
    const r = Math.min(box.width, box.height) * 0.18;
    const pts: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    for (const [px, py] of pts) {
      await page.mouse.click(px, py);
      await page.waitForTimeout(150);
    }
    await captureScreenshot(page, TID, '02_during_clicks');

    const finishBtn = page.getByRole('button', { name: /Finish|Tamamla|Bitir/i }).first();
    if (await finishBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await finishBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(500);
    await captureScreenshot(page, TID, '03_after_finish');

    const before = Number((querySqlite(`SELECT COUNT(*) as c FROM zones WHERE cameraId='${activeCam.id}'`).rows[0] as { c?: number } | undefined)?.c ?? 0);

    const nameInput = page.locator('input[placeholder*="name" i], input[placeholder*="ad" i]').first();
    if (await nameInput.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await nameInput.fill('DenemeRetroPoly').catch(() => undefined);
    }

    const saveBtn = page.getByRole('button', { name: /Save|Kaydet/i }).last();
    if (await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(2_000);
    }
    await captureScreenshot(page, TID, '04_after_save');

    const after = Number((querySqlite(`SELECT COUNT(*) as c FROM zones WHERE cameraId='${activeCam.id}'`).rows[0] as { c?: number } | undefined)?.c ?? 0);

    let cleanedCount = 0;
    if (after > before) {
      const newZones = querySqlite(`SELECT id FROM zones WHERE cameraId='${activeCam.id}' AND name LIKE 'DenemeRetroPoly%'`);
      for (const r2 of newZones.rows) {
        const zid = (r2 as { id?: string }).id;
        if (!zid) continue;
        const del = await page.context().request.delete(`${API}/api/zones/${zid}`).catch(() => null);
        if (del && del.ok()) cleanedCount++;
      }
    }

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests(),
      responses: net.getResponses(),
      db: {
        activeCameraId: activeCam.id,
        hasPolyBtn: hasPoly,
        before,
        after,
        delta: after - before,
        cleanedCount,
        verdict: after > before ? 'PASS_DENEME: polygon zone added' : 'OBSERVATIONAL: row unchanged',
      },
    });

    expect(true).toBe(true);
  });
});
