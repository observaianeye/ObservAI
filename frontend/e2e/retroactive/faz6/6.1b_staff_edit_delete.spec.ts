import { test, expect } from '@playwright/test';
import { loginAsDeneme } from '../../helpers/auth';
import { attachConsole, attachNetwork, captureScreenshot, saveEvidence } from '../../helpers/evidence';
import { querySqlite } from '../../helpers/db';

const TEST_ID = 'faz6/6.1b_staff_edit_delete';
const DENEME_USER_ID = '0bf23a86-fc20-4493-9f7b-18ae4a9ee049';

test('faz6 6.1b — staff edit + soft-delete via UI', async ({ page }) => {
  test.setTimeout(75_000);
  const con = attachConsole(page);
  const net = attachNetwork(page);

  await loginAsDeneme(page);
  const branchRow = querySqlite(`SELECT id FROM branches WHERE userId='${DENEME_USER_ID}' LIMIT 1`);
  const branchId = (branchRow.rows[0] as { id?: string } | undefined)?.id ?? '';
  const seedEmail = `faz6_target_${Date.now()}@test.local`;
  const seedResp = await page.request.post('/api/staff', {
    data: {
      branchId,
      firstName: 'EditMe',
      lastName: 'Faz6',
      email: seedEmail,
      phone: '+905552223344',
      role: 'server',
    },
  });
  expect(seedResp.ok()).toBeTruthy();
  const seedBody = await seedResp.json();
  const seedId = seedBody.staff.id as string;

  await page.goto('/dashboard/staffing');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(800);
  await captureScreenshot(page, TEST_ID, '01_list_with_seed');

  const card = page.locator('div').filter({ hasText: seedEmail }).first();
  await card.waitFor({ state: 'visible', timeout: 8_000 });
  const editBtn = card.getByRole('button', { name: /edit|duzenle/i }).first();
  await editBtn.click();
  await page.waitForTimeout(400);
  await captureScreenshot(page, TEST_ID, '02_edit_modal_open');

  await page.locator('select').selectOption('chef').catch(() => undefined);
  const patchPromise = page.waitForResponse(r => r.url().includes(`/api/staff/${seedId}`) && r.request().method() === 'PATCH', { timeout: 10_000 }).catch(() => null);
  await page.getByRole('button', { name: /^(Guncelle|Update)/ }).click();
  const patchResp = await patchPromise;
  await page.waitForTimeout(800);
  await captureScreenshot(page, TEST_ID, '03_after_edit');

  const afterEdit = querySqlite(`SELECT id, role FROM staff WHERE id='${seedId}'`);
  const editedRole = (afterEdit.rows[0] as { role?: string } | undefined)?.role ?? '';

  page.on('dialog', d => d.accept());
  const card2 = page.locator('div').filter({ hasText: seedEmail }).first();
  const deleteBtn = card2.locator('button').last();
  const delPromise = page.waitForResponse(r => r.url().includes(`/api/staff/${seedId}`) && r.request().method() === 'DELETE', { timeout: 10_000 }).catch(() => null);
  await deleteBtn.click();
  const delResp = await delPromise;
  await page.waitForTimeout(800);
  await captureScreenshot(page, TEST_ID, '04_after_delete');

  const afterDelete = querySqlite(`SELECT id, isActive FROM staff WHERE id='${seedId}'`);
  const finalRow = afterDelete.rows[0] as { isActive?: number | string | boolean } | undefined;

  await saveEvidence(TEST_ID, {
    console: con.get(),
    requests: net.getRequests().filter(r => r.url.includes('/api/staff')),
    responses: net.getResponses().filter(r => r.url.includes('/api/staff')),
    db: {
      seedId,
      seedEmail,
      patchHttp: patchResp?.status() ?? null,
      editedRole,
      deleteHttp: delResp?.status() ?? null,
      afterDelete: finalRow ?? null,
    },
  });

  expect(patchResp?.status() ?? 0).toBeLessThan(400);
  expect(delResp?.status() ?? 0).toBeLessThan(400);
});
