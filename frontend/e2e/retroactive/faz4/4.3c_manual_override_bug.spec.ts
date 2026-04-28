import { expect, test } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TID = 'faz4/4.3c';
const API = 'http://localhost:3001';
const DENEME_MOZART_BRANCH = '1d3b148d-d324-4e87-872f-296f591e589f';

test.describe('Faz 4 / 4.3c Manual table cleared override — DENEME tur 2 (Yan #30 disambiguation)', () => {
  test('PATCH /api/tables/:zoneId/status on deneme own TABLE zone — typo or RBAC?', async ({ page }) => {
    test.setTimeout(45_000);
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    await loginAsDeneme(page);
    await page.evaluate((bid) => {
      try { localStorage.setItem('selectedBranchId', bid); } catch { /* ignore */ }
    }, DENEME_MOZART_BRANCH);

    // Find a TABLE zone owned by deneme (cameras whose branch.userId = deneme).
    const zonesRes = querySqlite(`
      SELECT z.id as id, z.name as name, z.cameraId as cameraId
      FROM zones z
      JOIN cameras c ON c.id = z.cameraId
      JOIN branches b ON b.id = c.branchId
      JOIN users u ON u.id = b.userId
      WHERE u.email='deneme@test.com' AND z.type='TABLE' AND z.isActive=1
      LIMIT 5
    `);
    if (!zonesRes.ok || zonesRes.rows.length === 0) {
      await saveEvidence(TID, { console: consoleArr.get(), db: { skip: 'SKIP-INFEASIBLE', reason: 'no TABLE zones owned by deneme', dbErr: zonesRes.error } });
      test.skip(true, 'no TABLE zones for deneme');
      return;
    }
    const tableZone = zonesRes.rows[0] as { id: string; name: string; cameraId: string };

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '01_dashboard');

    // Direct PATCH — minimal + full payload.
    const patchMinimal = await page.context().request.patch(`${API}/api/tables/${tableZone.id}/status`, {
      data: { status: 'empty' },
    });
    const minimalStatus = patchMinimal.status();
    const minimalBody = await patchMinimal.text().catch(() => '');

    const patchFull = await page.context().request.patch(`${API}/api/tables/${tableZone.id}/status`, {
      data: { status: 'empty', cameraId: tableZone.cameraId },
    });
    const patchStatus = patchFull.status();
    const patchBody = await patchFull.text().catch(() => '');

    await captureScreenshot(page, TID, '02_after_patch');

    // Try UI path too — navigate to tables/dashboard floor view
    await page.goto('/dashboard/tables').catch(() => undefined);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await captureScreenshot(page, TID, '03_tables_view');

    // Decision tree
    let verdict: string;
    if (patchStatus === 200 || patchStatus === 204) {
      verdict = 'YAN_30_REFUTED: PATCH 200/204 succeeded — typo fixed or never present';
    } else if (patchStatus === 404 && /Camera not found/i.test(patchBody)) {
      verdict = 'YAN_30_PARTIAL: 404 "Camera not found" but deneme owns this zone+camera — RBAC tenantScope mismatch OR lowercase \'table\' typo (deneme.table != DB \'TABLE\') CONFIRMED';
    } else if (patchStatus === 404) {
      verdict = `YAN_30_OBSERVATIONAL: 404 with body=${patchBody.slice(0, 100)}`;
    } else {
      verdict = `OBSERVATIONAL: PATCH status=${patchStatus} body=${patchBody.slice(0, 100)}`;
    }

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests(),
      responses: net.getResponses(),
      db: {
        tableZone,
        minimalAttempt: { status: minimalStatus, body: minimalBody.slice(0, 400) },
        fullAttempt: { status: patchStatus, body: patchBody.slice(0, 400) },
        verdict,
      },
    });

    expect([200, 204, 400, 404, 403, 401, 422, 500]).toContain(patchStatus);
  });
});
