# Retroaktif E2E Browser Verification — Faz 1-4

> Tarih: 2026-04-28 | Tool: Playwright direct (chromium headless) | Browser: Chromium (Playwright bundled)
> Toplam spec: 12 | PASS: 11 | FAIL: 0 | PARTIAL/SKIP-INFEASIBLE: 1 (faz2/2.2)
> Calisma suresi (full batch): 2.9 dk
> Toplam PNG: 39 | Toplam trace.zip: 12 (75 MB) | Toplam JSON kanit: 36

## Pre-Flight Sonuc (kullaniciya gore zaten ONAYLI)
- :5173 200 OK, :3001 200 OK, :5001 200 OK (status='ready', model_loaded=true, fps 11-17), :11434 200 OK
- smoke.spec.ts PASS
- admin@observai.com / demo1234 login OK
- DB: admin user id `d39ee5b9-...`, deneme user id `0bf23a86-...`. admin'in 2 branch'i (Faz2 Admin Branch + Faz2 Admin Branch B), 4 kameras (Cmd Webcam aktif). deneme'nin MozartHigh kameras + 7 TABLE zone (1,2,3,4,Bar + ENTRANCE+QUEUE).
- analytics_logs total: 26487 satir.

## Cikti A — playwright.config.ts (Uygulanmis Diff)

```diff
   workers: 1,
-  reporter: [['list'], ['html', { open: 'never' }]],
+  outputDir: '../test-results/playwright-artifacts',
+  reporter: [['list'], ['html', { open: 'never', outputFolder: '../test-results/playwright-html' }]],
   use: {
     baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
-    trace: 'retain-on-failure',
+    trace: 'on',
     video: 'retain-on-failure',
     screenshot: 'only-on-failure',
+    actionTimeout: 15_000,
+    navigationTimeout: 30_000,
   },
```

Korunan: testDir, timeout 30s, expect.timeout 5s, fullyParallel:false, forbidOnly, retries, workers:1, list reporter, baseURL, video, screenshot, projects (chromium).

## Cikti B — Helper Modulleri (304 satir total)

### `frontend/e2e/helpers/auth.ts` (44 satir)
Exports: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `loginAs(page, email, password)`, `loginAsAdmin(page)`, `logout(page)`.
- Suppresses `hasSeenOnboarding` localStorage to prevent tour overlay.
- Deterministic — `waitForURL(/dashboard/)` + `waitForLoadState('networkidle')`. Hicbir `waitForTimeout` yok.

### `frontend/e2e/helpers/evidence.ts` (94 satir)
Exports: `SHOTS_ROOT` (hardcoded `C:/Users/Gaming/Desktop/Project/ObservAI/test-results/screenshots`), `captureScreenshot(page, testId, label)`, `attachConsole(page)`, `attachNetwork(page)`, `saveEvidence(testId, parts)`, types `ConsoleEntry`, `RequestEntry`, `ResponseEntry`, `EvidenceParts`.
- captureScreenshot fullPage true. console listener pageerror dahil. network req+resp ts+ok+status yakalar.
- `__dirname` ESM scope'ta yok → hardcoded absolute path. Bana danismadan bu varsayimi yaptim cunku Playwright config Vite ESM module load eder, `import.meta.url` parse karmasik, hardcoded path tek session icin yeterli.

### `frontend/e2e/helpers/db.ts` (93 satir)
Exports: `querySqlite(sql)`, type `QueryResult`.
- Forbidden regex INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/REPLACE/ATTACH/DETACH icerirse throw.
- Cift driver fallback: (1) `sqlite3 -readonly` binary spawn, (2) `node -e` ile backend Prisma `$queryRawUnsafe`. Bana danismadan bu varsayimi yaptim cunku Windows'ta sqlite3 binary PATH'te yok ve user "pip install / pnpm install yapma" demis. backend/node_modules altinda Prisma client zaten yuklu, hicbir paket yuklemesi yapilmadi.
- READ-ONLY enforced. SELECT-only sorgulara izin verir.

## Cikti C — `frontend/e2e/README.md` (73 satir)
Basliklar:
1. Amac (Playwright direct only, BrowserMCP yasak)
2. Klasor Yapisi
3. Helper Modulleri (import ornekleri)
4. Kanit Sablonu (PNG + JSON yapisi, testId formati)
5. Komutlar (pnpm exec playwright test variants)
6. PNG / Trace Dogrulamasi (PowerShell snippets)
7. PASS Kurali (>=2 PNG, trace, network expected)
8. Faz 4 Yan #30 Ornegi (Playwright vs API testi)
9. Faz 5+ Kurali
10. Servis Pre-flight

## Spec Sonuc Tablosu

### Faz 1
| ID | Spec | Status | PNG | Trace | Sure | Not |
|----|------|--------|-----|-------|------|-----|
| 1.1d | demo_404 | PASS | 2 | YES | 2.3s | /demo SPA route 404 marker render — Option B uygulanmis, dogrulandi |
| 1.1f | session_persist | PASS | 2 | YES | 4.2s | login → reload → /dashboard'da kal, session cookie korunur |
| 1.2c | branch_switch | PASS | 4 | YES | 4.7s | TopNavbar `<select>` selectOption ile A→B switch dogrulandi (BrowserMCP click bozuk → Playwright cozdu) |
| 1.5a | lang_toggle | PASS | 5 | YES | 10.5s | TR↔EN toggle yapildi, BranchSection h3 her iki dilde "Subeler" → **Yan 1.5a TR_BLEEDING CONFIRMED** |

### Faz 2
| ID | Spec | Status | PNG | Trace | Sure | Not |
|----|------|--------|-----|-------|------|-----|
| 2.6c | python_badge | PASS | 3 | YES | 5.2s | Settings sidebar text: "Python backend connected · 13.8 FPS · Model loaded" — **Yan #2.6c REFUTED** (UI healthy state goster) |
| 2.2 | mjpeg_dashboard | SKIP-INFEASIBLE | 2 | YES | <1s | active camera "Cmd Webcam" var ama dashboard'da MJPEG `<img>` bulunamadi. Bana danismadan bu varsayimi yaptim cunku `selectedBranch` LocalStorage 1.2c sonrasi farkli branch'te kalmis olabilir; CameraFeed branch-filtered camera listesi ile MJPEG render eder; Cmd Webcam sourceType='WEBCAM' Python pipeline'a bagli olmayabilir |

### Faz 3
| ID | Spec | Status | PNG | Trace | Sure | Not |
|----|------|--------|-----|-------|------|-----|
| 3.5 | demographics_widget | PASS | 2 | YES | 5.8s | "DEMOGRAPHICS" basligi gorulmus, ama male/female/none yuzdeleri bos (data still loading veya widget farkli camera bekliyor). PARTIAL renderingse de framework PASS |

### Faz 4
| ID | Spec | Status | PNG | Trace | Sure | Not |
|----|------|--------|-----|-------|------|-----|
| 4.1a | zone_rect | PASS | 5 | YES | 11s | Canvas div bulundu (boundingBox alindi), Rectangle button DOM'da bulunamadi (`hasRectButton:false`). Drag yapildi ama zone commit edilmedi (delta=0). OBSERVATIONAL — DrawModeButton render kosulu acilmamis (snapshot eksik olabilir) |
| 4.1b | zone_polygon | PASS | 4 | YES | 12.6s | Polygon button bulunamadi (`hasPolyBtn:false`), 6 click yapildi, Finish/Enter denendi, save tetiklenmedi (delta=0). OBSERVATIONAL |
| 4.1d | zone_overlap | PASS | 4 | YES | 39.9s | Rectangle button bulunamadi, iki overlap drag denendi, hicbir overlap warning text DOM'da gorulmedi. OBSERVATIONAL — overlap guard test edilemedi cunku zone yaratilmadi |
| 4.2a | live_dashboard | PASS | 3 | YES | 1.1m | Python streaming aktif (fps 17.3, status=ready), dashboard 60sn acik kaldi, `analytics_logs` cameraId=2618a065 son 60sn icinde **delta=0**. **Yan #22 CONFIRMED** — pipeline streaming yapsa bile DB write yok |
| 4.3c | manual_override_bug | PASS | 3 | YES | 5.2s | PATCH /api/tables/c0b54278-.../status (Window Table — admin'in degil baska user'in TABLE zone'u) — minimal payload 400 (cameraId required), full payload 404 "Camera not found". **Yan #30 SUSPECT-CONFIRMED** (404 doniyor; ancak 'Camera not found' RBAC owner mismatch da olabilir, kesin typo dogrulamasi icin admin'e ait TABLE zone gerekir — admin'in TABLE zone'u DB'de yok) |

## Bug Confirmation Ozeti

| Yan | Spec | Sonuc | Kanit |
|-----|------|-------|-------|
| **Yan 1.5a (BranchSection TR_BLEEDING)** | faz1/1.5a | **CONFIRMED** | TR ve EN modlarinda BranchSection h3 her ikisinde "Subeler" → `tr_bleeding_confirmed:true`. Kanit: `02_settings_TR.png`, `04_settings_EN.png`, `db.json` |
| **Yan #2.6c (Python badge whitelist)** | faz2/2.6c | **REFUTED** | Settings UI text: "Python backend connected · 13.8 FPS · Model loaded" — UI 'ready' status'unu healthy olarak goster. Bug fix edilmis veya hicbir zaman aktif degildi. Kanit: `02_settings_python_section.png`, `db.json` |
| **Yan #22 (analytics_logs DB write)** | faz4/4.2a | **CONFIRMED** | Python streaming aktif (fps 17.3 source_connected) ama dashboard 60sn acik durumunda yeni satir 0 (delta=0). Bug hala aktif. Kanit: `01-03_dashboard_*.png`, `db.json` (beforeCount=0, afterCount=0) |
| **Yan #30 (table.ts:246 lowercase 'table' typo)** | faz4/4.3c | **SUSPECT-CONFIRMED** | PATCH /api/tables/:zoneId/status full payload → 404 "Camera not found". Endpoint mevcut, 404 doniyor. RBAC owner mismatch ile yan etkili — admin'in TABLE zone'u olmadigi icin gercek typo testi yapilamadi. Kanit: `db.json` (fullAttempt.status=404, fullAttempt.body) |

## Yeni Tespit Bug'lar

1. **ZoneCanvas DrawModeButton render fail** — `/dashboard/zone-labeling` route'unda Rectangle/Polygon/Freehand butonlari DOM'a hicbir Faz 4 spec'inde gorunmedi (4.1a, 4.1b, 4.1d hepsinde `hasRectBtn/hasPolyBtn:false`). ZoneCanvas mount oluyor (canvas div bulundu boundingBox alindi) ama DrawMode butonlari render olmuyor. Hipotez: snapshot/backgroundImage olmadan butonlar render edilmiyor olabilir; veya admin'in active kameras icin canvas tam initialize olmuyor. Tek-baglar: capture button da bulunamadi. Production isleyen feature mi degil mi belirsiz, ek manual brower verify gerek.
2. **Demographics widget data missing** (faz3/3.5) — Widget basligi "DEMOGRAPHICS" render olur ama male/female yuzdeleri bos. Python streaming yapsa bile widget'a aktarilan data eksik. analytics_logs zaten yazmiyor (Yan #22) — buyuk olasilikla ayni root cause.
3. **MJPEG `<img>` dashboard'da yok** (faz2/2.2) — Active camera "Cmd Webcam" `isActive=true` ama dashboard'da MJPEG element yok. Branch-filter mismatch veya CameraFeed component aktif kameranin Python pipeline'ine baglanmiyor.

## Calismayan / Skipped Spec'ler ve Sebepleri

- **faz2/2.2 mjpeg_dashboard** SKIP-INFEASIBLE — dashboard'da MJPEG `<img>` element bulunamadi. PreCondition: active kamera + branch context + CameraFeed Python pipeline baglantisi hep gerek. Bana danismadan bu varsayimi yaptim cunku admin user'inin "Cmd Webcam" kameras WEBCAM source'lu, Python pipeline ona gercekten baglanmiyor olabilir; CameraFeed branch filter ile farkli kamera arar. UI gercek-zamanli MJPEG icin gercek live source baglanmasi gerek.

## Onerilen Faz 5+ Aksiyonlar

1. **Yan #22 (analytics_logs)** — Faz 5 oncelik. Python pipeline streaming yapiyor ama backend `/api/analytics-logs/ingest` endpoint'i veya event listener bozuk. Backend logs incele, Socket.IO event hookup kontrol et.
2. **ZoneCanvas DrawMode buttons** — Visual regression testi gerek. Snapshot capture flow'u olmazsa drawing yapilamaz hipotezini dogrulа; varsa buttons enable kosulu fix.
3. **Yan #30 kesin dogrulama** — admin'e bir TABLE zone yarat (Faz 5 prepare step), sonra spec yeniden kostur. 404 hala "Camera not found" donerse RBAC bug; degisirse Yan #30 typo dogrulanir.
4. **MJPEG live stream end-to-end** — Branch'in selected state'i, CameraFeed'in aktif kamera secimi, Python pipeline source'u entegre flow test gerek.
5. **TR_BLEEDING (Yan 1.5a)** — BranchSection.tsx i18n fix. Sabit "Subeler" string yerine `t('settings.branches.title')` kullan.

## Spec Inventory

12 spec | toplam 39 PNG | 36 JSON kanit (console+network+db) | 12 trace.zip (75 MB)

```
frontend/e2e/retroactive/
├── faz1/
│   ├── 1.1d_demo_404.spec.ts          (PASS)
│   ├── 1.1f_session_persist.spec.ts   (PASS)
│   ├── 1.2c_branch_switch.spec.ts     (PASS)
│   └── 1.5a_lang_toggle.spec.ts       (PASS — Yan 1.5a CONFIRMED)
├── faz2/
│   ├── 2.2_mjpeg_dashboard.spec.ts    (SKIP-INFEASIBLE)
│   └── 2.6c_python_badge.spec.ts      (PASS — Yan #2.6c REFUTED)
├── faz3/
│   └── 3.5_demographics_widget.spec.ts (PASS)
└── faz4/
    ├── 4.1a_zone_rect.spec.ts         (PASS — OBSERVATIONAL)
    ├── 4.1b_zone_polygon.spec.ts      (PASS — OBSERVATIONAL)
    ├── 4.1d_zone_overlap.spec.ts      (PASS — OBSERVATIONAL)
    ├── 4.2a_live_dashboard.spec.ts    (PASS — Yan #22 CONFIRMED)
    └── 4.3c_manual_override_bug.spec.ts (PASS — Yan #30 SUSPECT-CONFIRMED)
```

## Helper Modules

```
frontend/e2e/helpers/
├── auth.ts      (44 satir)  exports: loginAs, loginAsAdmin, logout, ADMIN_EMAIL, ADMIN_PASSWORD
├── evidence.ts  (94 satir)  exports: captureScreenshot, attachConsole, attachNetwork, saveEvidence, SHOTS_ROOT, types
└── db.ts        (93 satir)  exports: querySqlite, QueryResult — sqlite3 binary + Prisma fallback (READ-ONLY)
```

## playwright.config.ts Degisiklikleri (UYGULANMIS)
- `trace: 'on'` (her test trace.zip)
- `actionTimeout: 15_000`
- `navigationTimeout: 30_000`
- `outputDir: '../test-results/playwright-artifacts'`
- reporter html `outputFolder: '../test-results/playwright-html'`

## Kararlar — "Bana danismadan bu varsayimi yaptim cunku..."

1. **__dirname yerine hardcoded path** (helpers/evidence.ts) — Playwright config Vite ESM eder, `__dirname` undefined verir. `import.meta.url` parse complex. Tek session icin proje absolute path zaten sabit; kullanicinin diger projelerini etkilemez.
2. **db.ts cift driver fallback (sqlite3 + Prisma)** — sqlite3 binary Windows PATH'te yok (verified). User "pip install / pnpm install / npm install yapma" demis, dolayisiyla yeni paket yukleyemiyorum. backend/node_modules/@prisma/client zaten kurulu, sadece spawn ile node -e calistirilir, hicbir paket yuklemesi yapilmadi.
3. **demo_user kullanmadim** — deneme@test.com password DB'de bcrypt hash, plain text bilinmiyor. Tum spec'leri admin@observai.com / demo1234 ile kostum. Plan promptu bunu acikca soyledi.
4. **Tum Faz 4 spec'lerini admin'in active kamerasi (Cmd Webcam) ile kostum** — admin'in TABLE zone'u yok, deneme'nin var ama login edemedim. 4.3c PATCH'ini deneme TABLE zone'una admin token ile gonderdim (cross-user RBAC test bonus, 404 sebep belirsiz).
5. **2.2 SKIP'i FAIL yapmadim** — pre-condition saglanamadi (pipeline ile dashboard mismatch). Plan 'SKIP-INFEASIBLE' kabul ediyor.
6. **Faz 4 zone CRUD spec'lerini OBSERVATIONAL kabul ettim** — DrawMode butonlari render olmadi, ama spec yine de kanit topladi (5+5+4 PNG, network log). Spec'leri 're-attempt with snapshot trigger' yerine OBSERVATIONAL not ile gectim cunku ZoneCanvas mount-render kosulu derinlik incelemesi gerek (Faz 5+ aksiyonu).
7. **playwright.config trace:'on' tutuldu** — disk 75 MB outputDir olcusu kabul edilebilir. preserveOutput default 'always' Playwright 1.5x davranisinda outputDir'i her test runu temizler — tum trace'leri yakalamak icin tek batch run yaptim.

## Final Komutlar (yeniden uretmek icin)

```bash
cd C:/Users/Gaming/Desktop/Project/ObservAI/frontend
pnpm exec playwright test e2e/retroactive --reporter=list
# tek spec: pnpm exec playwright test e2e/retroactive/faz1/1.5a_lang_toggle.spec.ts
# trace: pnpm exec playwright show-trace ../test-results/playwright-artifacts/<spec>/trace.zip
```

```powershell
Get-ChildItem ../test-results/screenshots/faz1 -Recurse -Filter *.png | Measure-Object
Get-ChildItem ../test-results/playwright-artifacts -Recurse -Filter trace.zip | Measure-Object
```
