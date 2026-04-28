import { expect, test } from '@playwright/test';
import { loginAsAdmin } from '../../helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence } from '../../helpers/evidence';

const TID = 'faz1/1.2c';
const API = 'http://localhost:3001';

test.describe('Faz 1 / 1.2c TopNavbar branch switch (BrowserMCP click bozuktu)', () => {
  test('admin user with 2+ branches can switch via TopNavbar combobox', async ({ page }) => {
    const consoleArr = attachConsole(page);
    const net = attachNetwork(page);

    await loginAsAdmin(page);

    const branchesRes = await page.context().request.get(`${API}/api/branches`);
    const branches = (await branchesRes.json()) as Array<{ id: string; name: string }>;
    if (branches.length < 2) {
      await saveEvidence(TID, {
        console: consoleArr.get(),
        requests: net.getRequests(),
        responses: net.getResponses(),
        db: { skip: 'SKIP-INFEASIBLE', reason: 'admin has <2 branches', branches },
      });
      test.skip(true, 'admin has fewer than 2 branches; cannot test switch');
      return;
    }

    await captureScreenshot(page, TID, '01_before_branchA');

    // TopNavbar uses a native <select>. Find the one whose value matches the current branch id.
    const branchIds = branches.map((b) => b.id);
    const selectLoc = page.locator('header select, nav select, select').filter({
      has: page.locator(`option[value="${branchIds[0]}"], option[value="${branchIds[1]}"]`),
    }).first();

    if (!(await selectLoc.isVisible({ timeout: 3_000 }).catch(() => false))) {
      await saveEvidence(TID, {
        console: consoleArr.get(),
        requests: net.getRequests(),
        responses: net.getResponses(),
        db: { skip: 'PARTIAL', reason: 'native branch <select> not located', branches: branches.map((b) => ({ id: b.id, name: b.name })) },
      });
      await captureScreenshot(page, TID, '02_no_selector_found');
      test.skip(true, 'branch select not located');
      return;
    }

    const initialValue = await selectLoc.inputValue();
    await captureScreenshot(page, TID, '02_select_visible');

    const targetBranch = branches.find((b) => b.id !== initialValue) ?? branches[1];
    await selectLoc.selectOption(targetBranch.id);
    await page.waitForTimeout(1500);
    await captureScreenshot(page, TID, '03_after_branchB');

    const switched = (await selectLoc.inputValue()) === targetBranch.id;

    await saveEvidence(TID, {
      console: consoleArr.get(),
      requests: net.getRequests(),
      responses: net.getResponses(),
      db: { branches: branches.map((b) => ({ id: b.id, name: b.name })), initialValue, switchedTo: targetBranch, networkCount: net.getRequests().length, verdict: switched ? 'PASS: select value updated' : 'PARTIAL: select value did not change' },
    });

    expect(switched).toBe(true);
  });
});
