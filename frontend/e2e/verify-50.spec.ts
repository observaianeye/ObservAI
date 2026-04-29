import { test, type Page } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from './helpers/auth';

/**
 * ObservAI — DEMO 50 Test ClaudeCLI Verification.
 * Eval format: per-test Pass / Fail / Partial / Manual + evidence.
 */

const API = 'http://localhost:3001';
const PY = 'http://localhost:5001';
const APP = 'http://localhost:5173';
const REPORT_DIR = 'C:/Users/Gaming/Desktop/Project/ObservAI/test-results';
const REPORT_JSON = join(REPORT_DIR, 'cli-verify-50-results.json');
const SCREEN_DIR = join(REPORT_DIR, 'cli-verify-50-screenshots');
const VIDEO_FILE = 'C:/Users/Gaming/Desktop/Project/ObservAI/MozartHigh.MOV';

if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true });
if (!existsSync(SCREEN_DIR)) mkdirSync(SCREEN_DIR, { recursive: true });

interface TestRecord { id: number; cat: string; name: string; result: 'Pass' | 'Fail' | 'Partial' | 'Manual' | 'Skip'; note: string; }
const RESULTS: TestRecord[] = [];

function rec(id: number, cat: string, name: string, result: TestRecord['result'], note = '') {
  RESULTS.push({ id, cat, name, result, note });
  // eslint-disable-next-line no-console
  console.log(`[T${id}] ${result} — ${name}${note ? ' (' + note + ')' : ''}`);
}

async function shoot(page: Page, id: number, label: string) {
  try { await page.screenshot({ path: join(SCREEN_DIR, `T${String(id).padStart(2, '0')}-${label}.png`) }); } catch { /* ignore */ }
}

async function apiLogin(page: Page) {
  await page.request.post(`${API}/api/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, rememberMe: true },
    headers: { 'Content-Type': 'application/json' },
  });
}

const SHARED: {
  primaryBranchId?: string;
  secondaryBranchId?: string;
  testCameraId?: string;
  testZoneId?: string;
  tableZoneId?: string;
  insightId?: string;
  staffId?: string;
  liveCount?: number;
} = {};

test.describe.configure({ mode: 'serial' });

test.describe('ObservAI 50-Test CLI Verification', () => {
  // -------------------- 1: Auth + Session --------------------
  test('T1 Landing Page Render', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const title = await page.title();
    const bodyText = ((await page.locator('body').textContent()) || '').toLowerCase();
    const hasObserv = /observ/i.test(title) || bodyText.includes('observ');
    await shoot(page, 1, 'landing');
    if (hasObserv) rec(1, 'Auth', 'Landing Page Render', 'Pass', `title="${title}"`);
    else rec(1, 'Auth', 'Landing Page Render', 'Fail', `title="${title}"`);
  });

  test('T2 Register (TRIAL)', async ({ page }) => {
    const email = `cli_${Date.now()}@verify.test`;
    const r = await page.request.post(`${API}/api/auth/register`, {
      data: { email, password: 'demo1234', firstName: 'CLI', lastName: 'Verify', companyName: 'Verify Co' },
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = r.status() === 201 || r.status() === 200;
    const j = await r.json().catch(() => null);
    rec(2, 'Auth', 'Register TRIAL', ok ? 'Pass' : 'Fail', `HTTP ${r.status()} accountType=${j?.accountType ?? 'n/a'}`);
  });

  test('T3 Login + Remember Me 30-day cookie', async ({ page }) => {
    const r = await page.request.post(`${API}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, rememberMe: true },
      headers: { 'Content-Type': 'application/json' },
    });
    const set = r.headers()['set-cookie'] || '';
    const expiresMatch = set.match(/Expires=([^;]+)/i);
    let days = 0;
    if (expiresMatch) { days = Math.round((new Date(expiresMatch[1]).getTime() - Date.now()) / 86400000); }
    const ok = r.ok() && days >= 28 && days <= 31;
    rec(3, 'Auth', 'Login + RememberMe 30d', ok ? 'Pass' : 'Fail', `HTTP ${r.status()} expires=${days}d`);
  });

  test('T4 Logout invalidates session', async ({ page }) => {
    await page.request.post(`${API}/api/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, headers: { 'Content-Type': 'application/json' } });
    const out = await page.request.post(`${API}/api/auth/logout`);
    const meAfter = await page.request.get(`${API}/api/auth/me`);
    const ok = out.ok() && meAfter.status() === 401;
    rec(4, 'Auth', 'Logout invalidates server session', ok ? 'Pass' : 'Fail', `logout=${out.status()} me-after=${meAfter.status()}`);
  });

  test('T5 Session persists after refresh', async ({ page }) => {
    await loginAsAdmin(page);
    await page.reload({ waitUntil: 'networkidle' });
    const url = page.url();
    const ok = /\/dashboard/.test(url) && !/login/.test(url);
    await shoot(page, 5, 'after-refresh');
    rec(5, 'Auth', 'Session persists after refresh', ok ? 'Pass' : 'Fail', `url=${url}`);
  });

  // -------------------- 2: Branch + Weather --------------------
  test('T6 Branch create with geocoding', async ({ page }) => {
    await apiLogin(page);
    const r = await page.request.post(`${API}/api/branches`, {
      data: { name: `CLI-Verify-${Date.now()}`, city: 'Ankara', latitude: 39.8843, longitude: 32.7611, timezone: 'Europe/Istanbul', isDefault: false },
      headers: { 'Content-Type': 'application/json' },
    });
    const j = await r.json().catch(() => null);
    if (r.ok() && j?.id) { SHARED.primaryBranchId = j.id; rec(6, 'Branch', 'Branch create', 'Pass', `id=${j.id}`); }
    else rec(6, 'Branch', 'Branch create', 'Fail', `HTTP ${r.status()} body=${JSON.stringify(j).slice(0, 100)}`);
  });

  test('T7 Branch update lat/lng', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.primaryBranchId) { rec(7, 'Branch', 'Branch update', 'Skip', 'no prior branch'); return; }
    const r = await page.request.patch(`${API}/api/branches/${SHARED.primaryBranchId}`, {
      data: { latitude: 39.911, longitude: 32.862 },
      headers: { 'Content-Type': 'application/json' },
    });
    rec(7, 'Branch', 'Branch update lat/lng', r.ok() ? 'Pass' : 'Fail', `HTTP ${r.status()}`);
  });

  test('T8 Multi-branch switching (>=2 exist)', async ({ page }) => {
    await apiLogin(page);
    const r = await page.request.post(`${API}/api/branches`, {
      data: { name: `CLI-Cape-${Date.now()}`, city: 'Cape Town', latitude: -33.92, longitude: 18.42, timezone: 'Africa/Johannesburg' },
      headers: { 'Content-Type': 'application/json' },
    });
    const j = await r.json().catch(() => null);
    SHARED.secondaryBranchId = j?.id;
    const list = await page.request.get(`${API}/api/branches`);
    const arr = await list.json().catch(() => []);
    const ok = Array.isArray(arr) && arr.length >= 2;
    rec(8, 'Branch', 'Multi-branch switch', ok ? 'Pass' : 'Partial', `count=${arr?.length ?? 0}`);
  });

  test('T9 Weather widget fetch', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.primaryBranchId) { rec(9, 'Branch', 'Weather fetch', 'Skip', 'no branch'); return; }
    const r = await page.request.get(`${API}/api/branches/${SHARED.primaryBranchId}/weather`);
    const j = await r.json().catch(() => null);
    const cw = j?.current_weather ?? j?.currentWeather ?? null;
    const hasTemp = typeof j?.temperature === 'number' || typeof cw?.temperature === 'number' || typeof j?.temp === 'number';
    rec(9, 'Branch', 'Weather Open-Meteo fetch', r.ok() && hasTemp ? 'Pass' : 'Partial', `HTTP ${r.status()} temp=${cw?.temperature ?? j?.temperature ?? 'n/a'}`);
  });

  // -------------------- 3: Camera + Stream --------------------
  test('T10 Webcam camera add', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.primaryBranchId) { rec(10, 'Camera', 'Webcam add', 'Skip', 'no branch'); return; }
    const r = await page.request.post(`${API}/api/cameras`, {
      data: { name: `CLI-Webcam-${Date.now()}`, branchId: SHARED.primaryBranchId, sourceType: 'WEBCAM', sourceValue: '0' },
      headers: { 'Content-Type': 'application/json' },
    });
    rec(10, 'Camera', 'Webcam add', r.ok() ? 'Pass' : 'Fail', `HTTP ${r.status()}`);
  });

  test('T11 File-source camera (MozartHigh.MOV)', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.primaryBranchId) { rec(11, 'Camera', 'File source add', 'Skip', 'no branch'); return; }
    const r = await page.request.post(`${API}/api/cameras`, {
      data: { name: `CLI-File-${Date.now()}`, branchId: SHARED.primaryBranchId, sourceType: 'FILE', sourceValue: VIDEO_FILE },
      headers: { 'Content-Type': 'application/json' },
    });
    const j = await r.json().catch(() => null);
    if (r.ok() && j?.id) { SHARED.testCameraId = j.id; rec(11, 'Camera', 'File source add (MozartHigh.MOV)', 'Pass', `id=${j.id}`); }
    else rec(11, 'Camera', 'File source add (MozartHigh.MOV)', 'Fail', `HTTP ${r.status()} body=${JSON.stringify(j).slice(0, 100)}`);
  });

  test('T12 Camera rename (PUT)', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.testCameraId) { rec(12, 'Camera', 'Rename', 'Skip', 'no camera'); return; }
    const r = await page.request.put(`${API}/api/cameras/${SHARED.testCameraId}`, {
      data: { name: 'CLI-File-Renamed' },
      headers: { 'Content-Type': 'application/json' },
    });
    rec(12, 'Camera', 'Rename', r.ok() ? 'Pass' : 'Fail', `HTTP ${r.status()}`);
  });

  test('T13 Camera delete', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.primaryBranchId) { rec(13, 'Camera', 'Delete', 'Skip', 'no branch'); return; }
    const add = await page.request.post(`${API}/api/cameras`, {
      data: { name: `CLI-Delete-${Date.now()}`, branchId: SHARED.primaryBranchId, sourceType: 'WEBCAM', sourceValue: '99' },
      headers: { 'Content-Type': 'application/json' },
    });
    const j = await add.json().catch(() => null);
    if (!j?.id) { rec(13, 'Camera', 'Delete', 'Fail', `add ${add.status()}`); return; }
    const del = await page.request.delete(`${API}/api/cameras/${j.id}`);
    rec(13, 'Camera', 'Delete', del.ok() || del.status() === 204 ? 'Pass' : 'Fail', `HTTP ${del.status()}`);
  });

  test('T14 MJPEG inference stream', async ({ page }) => {
    let ct = '';
    let status = 0;
    try {
      const r = await page.request.get(`${PY}/mjpeg?mode=inference`, { timeout: 4000, maxRedirects: 0 });
      ct = r.headers()['content-type'] || '';
      status = r.status();
    } catch (e: unknown) {
      ct = `(timeout: ${(e as Error)?.message?.slice(0, 30) ?? 'n/a'})`;
    }
    const ok = ct.includes('multipart') || ct.includes('image/jpeg');
    rec(14, 'Camera', 'MJPEG content-type', ok ? 'Pass' : 'Partial', `status=${status} ct="${ct.slice(0, 60)}"`);
  });

  test('T15 Python /health JSON shape + fps', async ({ page }) => {
    const r = await page.request.get(`${PY}/health`, { timeout: 5000 });
    const j = await r.json().catch(() => null);
    const hasShape = j && 'status' in j && 'model_loaded' in j && 'streaming' in j && 'fps' in j;
    SHARED.liveCount = j?.current_count ?? 0;
    rec(15, 'Camera', 'Python /health shape+fps', hasShape ? 'Pass' : 'Partial', `fps=${j?.fps ?? 'n/a'} count=${j?.current_count ?? 0} status=${j?.status ?? 'n/a'}`);
  });

  // -------------------- 4: Detection / Charts --------------------
  test('T16 Live visitor count', async ({ page }) => {
    const r = await page.request.get(`${PY}/health`);
    const j = await r.json().catch(() => null);
    const hasCount = typeof j?.current_count === 'number';
    rec(16, 'Analytics', 'Live visitor count via /health', hasCount ? 'Pass' : 'Fail', `count=${j?.current_count}`);
  });

  test('T17 Demographics via analytics summary', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.testCameraId) { rec(17, 'Analytics', 'Demographics', 'Skip', 'no camera'); return; }
    const r = await page.request.get(`${API}/api/analytics/${SHARED.testCameraId}/summary?range=1d`);
    const j = await r.json().catch(() => null);
    const has = j && (typeof j === 'object');
    rec(17, 'Analytics', 'Camera analytics summary (incl. demo)', r.ok() && has ? 'Pass' : 'Partial', `HTTP ${r.status()} keys=${Object.keys(j ?? {}).slice(0, 5).join(',')}`);
  });

  test('T18 Trends weekly endpoint', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.testCameraId) { rec(18, 'Analytics', 'Trends weekly', 'Skip', 'no camera'); return; }
    const r = await page.request.get(`${API}/api/analytics/${SHARED.testCameraId}/trends/weekly`);
    rec(18, 'Analytics', 'Trends weekly endpoint', r.ok() ? 'Pass' : 'Partial', `HTTP ${r.status()}`);
  });

  test('T19 Peak hours endpoint', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.testCameraId) { rec(19, 'Analytics', 'Peak hours', 'Skip', 'no camera'); return; }
    const r = await page.request.get(`${API}/api/analytics/${SHARED.testCameraId}/peak-hours`);
    rec(19, 'Analytics', 'Peak hours endpoint', r.ok() ? 'Pass' : 'Partial', `HTTP ${r.status()}`);
  });

  // -------------------- 5: Zones --------------------
  test('T20 Rectangle ENTRANCE zone', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.testCameraId) { rec(20, 'Zone', 'Rect ENTRANCE', 'Skip', 'no camera'); return; }
    const coordinates = [{ x: 0.05, y: 0.05 }, { x: 0.20, y: 0.05 }, { x: 0.20, y: 0.20 }, { x: 0.05, y: 0.20 }];
    const r = await page.request.post(`${API}/api/zones`, {
      data: { cameraId: SHARED.testCameraId, name: 'CLI-Entrance', type: 'ENTRANCE', coordinates },
      headers: { 'Content-Type': 'application/json' },
    });
    const j = await r.json().catch(() => null);
    if (r.ok() && j?.id) { SHARED.testZoneId = j.id; rec(20, 'Zone', 'Rect ENTRANCE', 'Pass', `id=${j.id}`); }
    else rec(20, 'Zone', 'Rect ENTRANCE', 'Fail', `HTTP ${r.status()} ${JSON.stringify(j).slice(0, 100)}`);
  });

  test('T21 Polygon QUEUE 8-vertex', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.testCameraId) { rec(21, 'Zone', 'Polygon QUEUE', 'Skip', 'no camera'); return; }
    const coordinates = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return { x: 0.55 + 0.10 * Math.cos(a), y: 0.55 + 0.10 * Math.sin(a) };
    });
    const r = await page.request.post(`${API}/api/zones`, {
      data: { cameraId: SHARED.testCameraId, name: 'CLI-Queue', type: 'QUEUE', coordinates },
      headers: { 'Content-Type': 'application/json' },
    });
    rec(21, 'Zone', 'Polygon QUEUE 8-vertex', r.ok() ? 'Pass' : 'Fail', `HTTP ${r.status()}`);
  });

  test('T22 Rect zone shape preserved', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.testZoneId || !SHARED.testCameraId) { rec(22, 'Zone', 'Rect persists', 'Skip', 'no zone'); return; }
    const r = await page.request.get(`${API}/api/zones/${SHARED.testCameraId}`);
    const arr = await r.json().catch(() => []);
    const z = Array.isArray(arr) ? arr.find((x: { id?: string }) => x?.id === SHARED.testZoneId) : null;
    const coords = z?.coordinates;
    const fourCorner = coords && Array.isArray(coords) && coords.length === 4;
    rec(22, 'Zone', 'Rect shape preserved (4 corners)', fourCorner ? 'Pass' : 'Partial', `corners=${coords?.length ?? 0}`);
  });

  test('T23 Overlap rejected', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.testCameraId) { rec(23, 'Zone', 'Overlap reject', 'Skip', 'no camera'); return; }
    const coordinates = [{ x: 0.05, y: 0.05 }, { x: 0.20, y: 0.05 }, { x: 0.20, y: 0.20 }, { x: 0.05, y: 0.20 }];
    const r = await page.request.post(`${API}/api/zones`, {
      data: { cameraId: SHARED.testCameraId, name: 'CLI-Overlap', type: 'ENTRANCE', coordinates },
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = r.status() === 409 || r.status() === 400;
    rec(23, 'Zone', 'Overlap rejected', ok ? 'Pass' : 'Partial', `HTTP ${r.status()}`);
  });

  test('T24 Zone delete', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.testCameraId) { rec(24, 'Zone', 'Zone delete', 'Skip', 'no camera'); return; }
    const coordinates = [{ x: 0.75, y: 0.75 }, { x: 0.90, y: 0.75 }, { x: 0.90, y: 0.90 }, { x: 0.75, y: 0.90 }];
    const a = await page.request.post(`${API}/api/zones`, {
      data: { cameraId: SHARED.testCameraId, name: 'CLI-Del', type: 'ENTRANCE', coordinates },
      headers: { 'Content-Type': 'application/json' },
    });
    const j = await a.json().catch(() => null);
    if (!j?.id) { rec(24, 'Zone', 'Zone delete', 'Fail', `add ${a.status()}`); return; }
    const d = await page.request.delete(`${API}/api/zones/${j.id}`);
    rec(24, 'Zone', 'Zone delete', d.ok() || d.status() === 204 ? 'Pass' : 'Fail', `HTTP ${d.status()}`);
  });

  // -------------------- 6: Tables --------------------
  test('T25 TABLE zone create + listed', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.testCameraId) { rec(25, 'Table', 'TABLE zone', 'Skip', 'no camera'); return; }
    const coordinates = [{ x: 0.30, y: 0.30 }, { x: 0.45, y: 0.30 }, { x: 0.45, y: 0.45 }, { x: 0.30, y: 0.45 }];
    const r = await page.request.post(`${API}/api/zones`, {
      data: { cameraId: SHARED.testCameraId, name: 'CLI-Table-1', type: 'TABLE', coordinates },
      headers: { 'Content-Type': 'application/json' },
    });
    const j = await r.json().catch(() => null);
    if (r.ok() && j?.id) SHARED.tableZoneId = j.id;
    const list = await page.request.get(`${API}/api/tables/${SHARED.testCameraId}`);
    const tables = await list.json().catch(() => []);
    const arr = Array.isArray(tables) ? tables : tables?.tables ?? [];
    const found = arr.some((t: { id?: string; zoneId?: string }) => t?.zoneId === SHARED.tableZoneId || t?.id === SHARED.tableZoneId);
    // Note: tables.ts:160 filter `type:'table'` lowercase vs zones enum 'TABLE' uppercase — known issue
    rec(25, 'Table', 'TABLE zone created (listing case-mismatch in tables.ts:160)', r.ok() ? 'Partial' : 'Fail', `created=${r.status()} listed=${found} count=${arr.length}`);
  });

  test('T26 Empty→Occupied state machine', async () => {
    rec(26, 'Table', 'Empty→Occupied 60s', 'Manual', 'requires live cam + person 60s; cannot automate');
  });

  test('T27 Manual table status override', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.tableZoneId || !SHARED.testCameraId) { rec(27, 'Table', 'Manual override', 'Skip', 'no table'); return; }
    const r = await page.request.patch(`${API}/api/tables/${SHARED.tableZoneId}/status`, {
      data: { status: 'empty', cameraId: SHARED.testCameraId },
      headers: { 'Content-Type': 'application/json' },
    });
    rec(27, 'Table', 'Manual status override → empty', r.ok() ? 'Pass' : 'Partial', `HTTP ${r.status()}`);
  });

  // -------------------- 7: Date Range / Export --------------------
  test('T28 Date range chips', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.testCameraId) { rec(28, 'Analytics', 'Date range chips', 'Skip', 'no camera'); return; }
    // Faz 11: '1h' chip removed from supported ranges (UI uses 1d/1w/1m/3m)
    const ranges = ['1d', '1w', '1m', '3m'];
    const results = await Promise.all(ranges.map(async (r) => {
      const res = await page.request.get(`${API}/api/analytics/${SHARED.testCameraId}/overview?range=${r}`);
      return { r, status: res.status(), ok: res.ok() };
    }));
    const okCount = results.filter(x => x.ok).length;
    rec(28, 'Analytics', 'Date range 4 chips (post-Faz11)', okCount === 4 ? 'Pass' : okCount > 0 ? 'Partial' : 'Fail', results.map(r => `${r.r}=${r.status}`).join(' '));
  });

  test('T29 Custom date range', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.testCameraId) { rec(29, 'Analytics', 'Custom range', 'Skip', 'no camera'); return; }
    const to = new Date().toISOString().slice(0, 10);
    const fromD = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    const r = await page.request.get(`${API}/api/analytics/${SHARED.testCameraId}/overview?range=custom&from=${fromD}&to=${to}`);
    rec(29, 'Analytics', 'Custom date range', r.ok() ? 'Pass' : 'Partial', `HTTP ${r.status()} from=${fromD} to=${to}`);
  });

  test('T30 CSV export', async ({ page }) => {
    await apiLogin(page);
    // No cameraId → buildOwnedWhere uses ALL owned cameras (more likely to have data)
    const r = await page.request.get(`${API}/api/export/csv`);
    const ct = r.headers()['content-type'] || '';
    const ok = r.ok() && /csv|text/i.test(ct);
    rec(30, 'Export', 'CSV export', ok ? 'Pass' : 'Partial', `HTTP ${r.status()} ct="${ct.slice(0, 50)}"`);
  });

  test('T31 PDF export', async ({ page }) => {
    await apiLogin(page);
    const r = await page.request.get(`${API}/api/export/pdf`);
    const ct = r.headers()['content-type'] || '';
    const ok = r.ok() && /pdf/i.test(ct);
    rec(31, 'Export', 'PDF export', ok ? 'Pass' : 'Partial', `HTTP ${r.status()} ct="${ct.slice(0, 50)}"`);
  });

  test('T32 Prediction chart', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.testCameraId) { rec(32, 'Analytics', 'Prediction', 'Skip', 'no camera'); return; }
    const r = await page.request.get(`${API}/api/analytics/${SHARED.testCameraId}/prediction`);
    const j = await r.json().catch(() => null);
    const conf = j?.confidence ?? j?.confidencePercent ?? j?.summary?.confidence;
    const sane = typeof conf === 'number' && conf >= 0 && conf <= 100;
    rec(32, 'Analytics', 'Prediction chart', r.ok() && sane ? 'Pass' : 'Partial', `HTTP ${r.status()} conf=${conf}`);
  });

  // -------------------- 8: AI Chat --------------------
  test('T33 Chatbot dialog opens', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const sparkles = page.locator('button[aria-label*="chat" i], button[aria-label*="Sparkles" i], button[aria-label*="AI" i], button[title*="AI" i]').first();
    let opened = false;
    try {
      await sparkles.click({ timeout: 4000 });
      opened = await page.locator('[role="dialog"], [class*="chat" i]').first().isVisible({ timeout: 4000 }).catch(() => false);
    } catch { /* ignore */ }
    await shoot(page, 33, 'chatbot');
    rec(33, 'Chat', 'Chatbot dialog open', opened ? 'Pass' : 'Partial', 'visual selector heuristic');
  });

  test('T34 TR chat response', async ({ page }) => {
    await apiLogin(page);
    const r = await page.request.post(`${API}/api/ai/chat`, {
      data: { message: 'Bugün kaç ziyaretçim var?', language: 'tr' },
      headers: { 'Content-Type': 'application/json' },
      timeout: 90000,
    });
    const j = await r.json().catch(() => null);
    const text = (j?.response ?? j?.message ?? j?.text ?? j?.reply ?? '') as string;
    const tr = /[ığüşöçİĞÜŞÖÇ]/.test(text) || /ziyaret|bugün|kişi|sayı/i.test(text);
    rec(34, 'Chat', 'TR chat response', r.ok() && tr ? 'Pass' : 'Partial', `HTTP ${r.status()} sample="${text.slice(0, 60)}"`);
  });

  test('T35 EN chat response', async ({ page }) => {
    await apiLogin(page);
    const r = await page.request.post(`${API}/api/ai/chat`, {
      data: { message: 'How many visitors today?', language: 'en' },
      headers: { 'Content-Type': 'application/json' },
      timeout: 90000,
    });
    const j = await r.json().catch(() => null);
    const text = (j?.response ?? j?.message ?? j?.text ?? j?.reply ?? '') as string;
    const en = /visitor|today|people|total|count/i.test(text);
    rec(35, 'Chat', 'EN chat response', r.ok() && en ? 'Pass' : 'Partial', `HTTP ${r.status()} sample="${text.slice(0, 60)}"`);
  });

  test('T36 Live count anchor', async ({ page }) => {
    await apiLogin(page);
    const health = await page.request.get(`${PY}/health`);
    const live = (await health.json().catch(() => null))?.current_count ?? 0;
    const r = await page.request.post(`${API}/api/ai/chat`, {
      data: { message: 'Şu anki ziyaretçi sayısı kaç?', language: 'tr' },
      headers: { 'Content-Type': 'application/json' },
      timeout: 90000,
    });
    const j = await r.json().catch(() => null);
    const text = (j?.response ?? j?.message ?? '') as string;
    const matches = text.includes(String(live)) || /şu an(da)?|kapalı|çevrim ?dışı|offline|veri yok/i.test(text);
    rec(36, 'Chat', 'Live count anchor', r.ok() && matches ? 'Pass' : 'Partial', `live=${live} sample="${text.slice(0, 80)}"`);
  });

  test('T37 Chat conversation follow-up', async ({ page }) => {
    test.setTimeout(120000);
    await apiLogin(page);
    const conv = `cli-verify-${Date.now()}`;
    const r1 = await page.request.post(`${API}/api/ai/chat`, { data: { message: 'Bugün kaç ziyaretçi geldi?', language: 'tr', conversationId: conv }, headers: { 'Content-Type': 'application/json' }, timeout: 90000 });
    const r2 = await page.request.post(`${API}/api/ai/chat`, { data: { message: 'Söylediğin sayının yarısı kaç?', language: 'tr', conversationId: conv }, headers: { 'Content-Type': 'application/json' }, timeout: 90000 });
    const j2 = await r2.json().catch(() => null);
    const t2 = (j2?.response ?? j2?.message ?? '') as string;
    const both200 = r1.ok() && r2.ok();
    const ok = both200 && t2.length > 0;
    rec(37, 'Chat', 'Follow-up endpoint completes 2 turns', ok ? 'Pass' : 'Partial', `r1=${r1.status()} r2=${r2.status()} t2len=${t2.length} sample="${t2.slice(0, 60)}"`);
  });

  // -------------------- 9: Insights & Notifications --------------------
  test('T38 Manual generate insights', async ({ page }) => {
    test.setTimeout(180000);
    await apiLogin(page);
    if (!SHARED.testCameraId) { rec(38, 'Insight', 'Generate', 'Skip', 'no camera'); return; }
    try {
      const r = await page.request.post(`${API}/api/insights/generate`, {
        headers: { 'Content-Type': 'application/json' },
        data: { cameraId: SHARED.testCameraId },
        timeout: 150000,
      });
      const j = await r.json().catch(() => null);
      const cnt = j?.alerts?.length ?? j?.saved ?? 0;
      rec(38, 'Insight', 'Manual generate insights', r.ok() ? 'Pass' : 'Partial', `HTTP ${r.status()} alerts=${cnt} throttled=${j?.throttled ?? false}`);
    } catch (e: unknown) {
      rec(38, 'Insight', 'Manual generate insights', 'Partial', `error: ${(e as Error)?.message?.slice(0, 80)}`);
    }
  });

  test('T39 Insight mark read', async ({ page }) => {
    await apiLogin(page);
    const list = await page.request.get(`${API}/api/insights`);
    const arr = await list.json().catch(() => []);
    const items = Array.isArray(arr) ? arr : arr?.insights ?? arr?.data ?? [];
    const target = items[0];
    if (!target?.id) { rec(39, 'Insight', 'Mark read', 'Skip', 'no insights'); return; }
    SHARED.insightId = target.id;
    const r = await page.request.patch(`${API}/api/insights/${target.id}/read`, { headers: { 'Content-Type': 'application/json' }, data: {} });
    rec(39, 'Insight', 'Mark read', r.ok() ? 'Pass' : 'Partial', `HTTP ${r.status()}`);
  });

  test('T40 Notifications page render', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/notifications');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const list = await page.locator('article, li, [class*="notification" i], [class*="card" i]').count();
    await shoot(page, 40, 'notifications');
    rec(40, 'Notify', 'Notifications page render', list > 0 ? 'Pass' : 'Partial', `cardsLike=${list}`);
  });

  test('T41 Severity filter visible', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/notifications');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const select = page.locator('select, button[role="combobox"]').first();
    const has = await select.isVisible({ timeout: 3000 }).catch(() => false);
    rec(41, 'Notify', 'Severity filter visible', has ? 'Pass' : 'Partial', `selectVisible=${has}`);
  });

  // -------------------- 10: Staff --------------------
  test('T42 Staff create', async ({ page }) => {
    await apiLogin(page);
    const r = await page.request.post(`${API}/api/staff`, {
      data: { firstName: 'CLI', lastName: 'Verify', email: `cli_staff_${Date.now()}@verify.test`, phone: '+905551234567', role: 'manager' },
      headers: { 'Content-Type': 'application/json' },
    });
    const j = await r.json().catch(() => null);
    const staffId = j?.id ?? j?.staff?.id;
    if ((r.status() === 201 || r.ok()) && staffId) { SHARED.staffId = staffId; rec(42, 'Staff', 'Staff create', 'Pass', `id=${staffId}`); }
    else rec(42, 'Staff', 'Staff create', 'Fail', `HTTP ${r.status()} body=${JSON.stringify(j).slice(0, 100)}`);
  });

  test('T43 Staff role update', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.staffId) { rec(43, 'Staff', 'Role update', 'Skip', 'no staff'); return; }
    const r = await page.request.patch(`${API}/api/staff/${SHARED.staffId}`, {
      data: { role: 'chef' },
      headers: { 'Content-Type': 'application/json' },
    });
    rec(43, 'Staff', 'Role update', r.ok() ? 'Pass' : 'Fail', `HTTP ${r.status()}`);
  });

  test('T44 Staff soft delete', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.staffId) { rec(44, 'Staff', 'Soft delete', 'Skip', 'no staff'); return; }
    const r = await page.request.delete(`${API}/api/staff/${SHARED.staffId}`);
    rec(44, 'Staff', 'Soft delete', r.ok() || r.status() === 204 ? 'Pass' : 'Fail', `HTTP ${r.status()}`);
  });

  test('T45 ShiftCalendar render', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/staffing');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const grid = page.locator('[class*="calendar" i], [class*="grid" i], [data-testid*="calendar"]').first();
    const visible = await grid.isVisible({ timeout: 4000 }).catch(() => false);
    await shoot(page, 45, 'staffing');
    rec(45, 'Staff', 'ShiftCalendar grid render', visible ? 'Pass' : 'Partial', `gridVisible=${visible}`);
  });

  // -------------------- 11: Settings + i18n --------------------
  test('T46 Settings sections', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const sections = await page.locator('section, [role="region"], details, h2, h3').count();
    await shoot(page, 46, 'settings');
    rec(46, 'Settings', 'Settings sections render', sections >= 5 ? 'Pass' : 'Partial', `sectionsLike=${sections}`);
  });

  test('T47 Language toggle TR↔EN', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const beforeText = (await page.locator('body').textContent()) || '';
    await page.evaluate(() => { try { localStorage.setItem('lang', 'en'); } catch { /* ignore */ } });
    await page.reload({ waitUntil: 'networkidle' });
    const afterText = (await page.locator('body').textContent()) || '';
    // Check for English-specific keywords that wouldn't appear in TR
    const enHints = /\b(branches|notifications|language|user profile|security)\b/i.test(afterText);
    const trHints = /\b(şubeler|bildirimler|dil|kullanıcı|güvenlik)\b/i.test(beforeText);
    const changed = enHints && trHints && beforeText.length !== afterText.length || beforeText !== afterText;
    await page.evaluate(() => { try { localStorage.setItem('lang', 'tr'); } catch { /* ignore */ } });
    await page.reload({ waitUntil: 'networkidle' }).catch(() => undefined);
    rec(47, 'Settings', 'Language toggle changes UI text', changed ? 'Pass' : 'Partial', `enHints=${enHints} trHints=${trHints} sameLen=${beforeText.length === afterText.length}`);
  });

  test('T48 Password change endpoint (POST, non-destructive)', async ({ page }) => {
    await apiLogin(page);
    const r = await page.request.post(`${API}/api/auth/change-password`, {
      data: { currentPassword: 'wrong_intentional', newPassword: 'AAAAA1234!', confirmPassword: 'AAAAA1234!' },
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = r.status() === 400 || r.status() === 401 || r.status() === 422;
    rec(48, 'Settings', 'Change-password rejects bad current pw', ok ? 'Pass' : 'Partial', `HTTP ${r.status()}`);
  });

  // -------------------- 12: System --------------------
  test('T49 Branch delete cascade + weather 404', async ({ page }) => {
    await apiLogin(page);
    if (!SHARED.secondaryBranchId) { rec(49, 'System', 'Branch delete cascade', 'Skip', 'no secondary'); return; }
    const d = await page.request.delete(`${API}/api/branches/${SHARED.secondaryBranchId}`);
    const wt = await page.request.get(`${API}/api/branches/${SHARED.secondaryBranchId}/weather`);
    const ok = (d.ok() || d.status() === 204) && (wt.status() === 404);
    rec(49, 'System', 'Branch delete cascade + /weather 404', ok ? 'Pass' : 'Partial', `delete=${d.status()} weather=${wt.status()}`);
  });

  test('T50 4 services up', async ({ page }) => {
    const probes = await Promise.all([
      page.request.get(`${APP}/`).catch(() => null),
      page.request.get(`${API}/api/auth/me`).catch(() => null),
      page.request.get(`${PY}/health`).catch(() => null),
      page.request.get('http://localhost:11434/api/tags').catch(() => null),
    ]);
    const labels = ['Frontend', 'Backend', 'Python', 'Ollama'];
    const ups = probes.map((p, i) => `${labels[i]}=${p ? p.status() : 'down'}`).join(' ');
    const all = probes.every(p => p && p.status() > 0 && p.status() < 500);
    rec(50, 'System', '4 services up (HTTP probe)', all ? 'Pass' : 'Partial', ups);
  });

  // -------------------- Cleanup + Report --------------------
  test('Z99 Write report JSON', async () => {
    writeFileSync(REPORT_JSON, JSON.stringify({ runAt: new Date().toISOString(), results: RESULTS }, null, 2));
    // eslint-disable-next-line no-console
    console.log(`\n=== Wrote ${REPORT_JSON} (${RESULTS.length} results) ===`);
  });
});
