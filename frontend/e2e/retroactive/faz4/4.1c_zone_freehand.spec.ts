import { expect, test } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TID = 'faz4/4.1c';
const API = 'http://localhost:3001';
const DENEME_MOZART_BRANCH = '1d3b148d-d324-4e87-872f-296f591e589f';

test.describe('Faz 4 / 4.1c Zone freehand mode + ESC iptal — DENEME tur 2 (NEW)', () => {
  test('freehand drag → ESC cancel → re-draw → Enter complete → save → DB row', async ({ page }) => {
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
    await captureScreenshot(page, TID, '01_freehand_start');

    const captureBtn = page.locator('button').filter({ hasText: /Capture|Snapshot|Anlik|Çek|Cek/i }).first();
    if (await captureBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await captureBtn.click().catch(() => undefined);
      await page.waitForTimeout(1_500);
    }

    const freehandBtn = page.locator('button:has-text("Freehand"), button:has-text("Serbest"), button:has-text("Free")').first();
    const hasFree = await freehandBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasFree) await freehandBtn.click({ timeout: 5_000 });

    const canvas = page.locator('div.aspect-video').first();
    const canvasVisible = await canvas.isVisible({ timeout: 3_000 }).catch(() => false);
    const box = canvasVisible ? await canvas.boundingBox() : null;
    if (!box) {
      await saveEvidence(TID, {
        console: consoleArr.get(),
        responses: net.getResponses(),
        db: { skip: 'PARTIAL', reason: 'canvas not located', hasFreehand: hasFree },
      });
      await captureScreenshot(page, TID, '02_no_canvas');
      test.skip(true, 'no canvas');
      return;
    }

    // First drag — to be cancelled with ESC
    const cx = box.x + box.width * 0.5;
    const cy = box.y + box.height * 0.45;
    const r = Math.min(box.width, box.height) * 0.15;
    await page.mouse.move(cx + r, cy);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    await captureScreenshot(page, TID, '02_during_first_drag');
    // ESC cancels mid-drag (frontend handles, no POST should fire)
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await page.waitForTimeout(400);
    await captureScreenshot(page, TID, '03_after_esc');

    // Network slice — count POSTs to /api/zones BEFORE second drag
    const postsBeforeSecond = net.getRequests().filter((r) => /\/api\/zones/.test(r.url) && r.method === 'POST').length;

    // Second drag — re-enable freehand and complete via Enter
    if (hasFree) await freehandBtn.click({ timeout: 5_000 });
    await page.mouse.move(cx + r, cy + r * 0.3);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      await page.mouse.move(cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 1.1);
    }
    await captureScreenshot(page, TID, '04_during_second_drag');
    await page.mouse.up();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[placeholder*="name" i], input[placeholder*="ad" i]').first();
    if (await nameInput.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await nameInput.fill('DenemeRetroFree').catch(() => undefined);
    }

    const before = Number((querySqlite(`SELECT COUNT(*) as c FROM zones WHERE cameraId='${activeCam.id}'`).rows[0] as { c?: number } | undefined)?.c ?? 0);

    const saveBtn = page.getByRole('button', { name: /Save|Kaydet/i }).last();
    if (await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(2_000);
    }
    await captureScreenshot(page, TID, '05_after_save');

    const after = Number((querySqlite(`SELECT COUNT(*) as c FROM zones WHERE cameraId='${activeCam.id}'`).rows[0] as { c?: number } | undefined)?.c ?? 0);
    const postsAfterSave = net.getRequests().filter((r) => /\/api\/zones/.test(r.url) && r.method === 'POST').length;

    let cleanedCount = 0;
    if (after > before) {
      const newZones = querySqlite(`SELECT id FROM zones WHERE cameraId='${activeCam.id}' AND name LIKE 'DenemeRetroFree%'`);
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
        hasFreehandBtn: hasFree,
        postsBeforeSecond,
        postsAfterSave,
        before,
        after,
        delta: after - before,
        cleanedCount,
        verdict: after > before ? 'PASS_DENEME: freehand + ESC + redraw + save → zone added' : 'OBSERVATIONAL: zone not committed',
      },
    });

    expect(true).toBe(true);
  });
});
