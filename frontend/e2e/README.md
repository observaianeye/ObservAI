# ObservAI E2E Test Klasoru

## Amac
Tum ObservAI E2E testleri **Playwright direct** (chromium headless) ile kosturulur.
**BrowserMCP YASAK** — Faz 2'den beri click/type bozuk, yanlis sinyal verir.

## Klasor Yapisi
- `e2e/<short>.spec.ts` — Mevcut/asil spec'ler (smoke, camera-sources, auth-persistence, faz2-switching, real-time-dashboard)
- `e2e/retroactive/<faz>/<test-id>_<short>.spec.ts` — Faz 1-4 BLOCKED/PARTIAL/STATIC alt-testleri Playwright'a tasinmis hali
- `e2e/helpers/` — Paylasilan auth + evidence + db wrapper'lari

## Helper Modulleri
```typescript
import { loginAs, loginAsAdmin, logout } from './helpers/auth';
import { captureScreenshot, attachConsole, attachNetwork, saveEvidence, SHOTS_ROOT } from './helpers/evidence';
import { querySqlite } from './helpers/db';
```

- `loginAsAdmin(page)` — admin@observai.com / demo1234, /dashboard URL bekler
- `captureScreenshot(page, testId, label)` — full-page PNG, `test-results/screenshots/<testId>/<label>.png`
- `attachConsole(page)` / `attachNetwork(page)` — listener kurar, getter dondurur
- `saveEvidence(testId, { console, requests, responses, db })` — JSON artefakt yazar
- `querySqlite(sql)` — `sqlite3 -readonly` spawn, INSERT/UPDATE/DELETE icerirse throw

## Kanit Sablonu
Her sub-test `test-results/screenshots/<faz<N>>/<test-id>/` altina:
- `01_before.png`, `02_after.png` (en az 2 PNG, asil 3-4 onerilen)
- `console.json` — page.on('console') + pageerror
- `network.json` — { requests:[], responses:[] }
- `db.json` — varsa SELECT sonucu / pre-post state
- `notes.json` — opsiyonel meta (skip sebep, gozlemler)

testId formati: `'faz<N>/<test-id>'` (orn: `'faz1/1.2c'`, `'faz4/4.3c'`).

## Komutlar
```bash
cd frontend
pnpm exec playwright test                                  # tumu
pnpm exec playwright test --headed                         # gorsel
pnpm exec playwright test --debug                          # Inspector
pnpm exec playwright test --ui                             # UI mode
pnpm exec playwright test e2e/retroactive/faz1/1.2c_branch_switch.spec.ts
pnpm exec playwright test --reporter=list
```

## PNG / Trace Dogrulamasi
```powershell
Get-ChildItem test-results/screenshots/faz4 -Recurse -Filter *.png | Measure-Object
Get-ChildItem test-results/playwright-artifacts -Recurse -Filter trace.zip | Measure-Object
```

## PASS Kurali
- 2'den az PNG → PASS sayilmaz, **PARTIAL** etiketle
- trace.zip eksikse → PARTIAL
- network.json'da beklenen endpoint cagrisi yoksa → PARTIAL
- Spec hata throw'larsa → FAIL
- Pre-condition saglanmiyorsa (orn: deneme user password yok, canli kamera yok) → **SKIP-INFEASIBLE** + sebep

## Faz 4 Yan #30 Ornegi (Playwright > API Testi)
`backend/src/routes/tables.ts:246` lowercase `'table'` typo. Sema enum `TABLE` (uppercase).
API test'i payload kabul edip 200 dondu zannetti (Prisma case-insensitive lookup'in patolojik davranisi).
Playwright spec'i UI'da "Temizlendi" butonu tikladi → PATCH `/api/tables/:zoneId/status` 404 toast yakaladi.
Playwright **gercek user yolu**'nu test ettigi icin yan etkiyi gozlemledi. Bu fark Playwright'in degerini gosterir.

## Faz 5+ Kurali
- Spec yoksa veya PNG yoksa **PASS YOK**
- Yeni faz baslarken once `frontend/e2e/retroactive/<faz>/` altina spec yaz, kos, kanit topla
- Manuel browser doğrulama (BrowserMCP) sadece kesif amacli, regression icin sayilmaz

## Servis Pre-flight
Test koşmadan once 4 servis 200 mu kontrol et:
- :5173 (frontend), :3001 (backend), :5001 (python analytics), :11434 (ollama)
- Hicbiri restart/kill edilmez, sadece curl ile dogrulanir
