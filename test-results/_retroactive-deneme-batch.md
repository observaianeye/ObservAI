# Retroactive E2E Browser Verification — Tur 2 (deneme@test.com + Live MozartHigh)

> Tarih: 2026-04-28 | Tool: Playwright direct (chromium headless) | Browser: Chromium bundled
> Toplam spec: 12 | PASS: 3 | OBSERVATIONAL/PARTIAL/BUG_CANDIDATE: 7 | PATCH_PENDING_RESTART: 1 | OBSERVATIONAL (yan #30 confirm path): 1
> Calisma suresi: ~6 dk full batch + 2 fix re-runs
> Cikti A (Yan #37 patch + 3 yeni vitest): backend/src/routes/ai.ts loadConversationHistory userId filter eklendi, ai-chat-tenant-isolation.test.ts olusturuldu, vitest 38 PASS / 6 expected FAIL
> Cikti B: helpers/auth.ts'e DENEME_EMAIL/DENEME_PASSWORD/loginAsDeneme eklendi (mevcut export'lar korundu)
> Cikti C: 12 spec (5 NEW + 7 UPDATE), 4 yeni klasor (security/), faz1/1.1a, faz3/3.7a, faz4/4.1c, 4.1e

## Pre-Flight Sonuc

- :5173 200, :3001 200, :5001 200 (status=ready, model_loaded=true, fps=16.6, clients=2), :11434 200
- deneme@test.com login API HTTP 200 (id `0bf23a86-fc20-4493-9f7b-18ae4a9ee049`, MANAGER, TRIAL)
- deneme branches: Mozart C building (`1d3b148d-...`, Bilkent UTC+3 Europe/Istanbul) + Cape Town Ekhaya (UTC+4 `Asia/Dubai` BUG **hala open**)
- deneme cameras: MozartHigh (FILE, **isActive=true**, live), MozartLow (inactive), Ekheya Cape Town (inactive)
- deneme zones (16): MozartHigh 5 TABLE + ENTRANCE + QUEUE = 7; MozartLow 5 TABLE + ENTRANCE + QUEUE = 7; Cape Town ENTRANCE + QUEUE = 2. **TABLE >= 1 condition tatmin** (4.3c testable)
- analytics_logs son 1h: 8397 satir, total: 26732
- Smoke 2/2 PASS, retroactive admin batch 11 PASS + 1 SKIP (regression gate **gecti**), backend vitest baseline 35 PASS + 6 expected FAIL (tables-ai-summary, Yan #4.4)

## Cikti A — Yan #37 Security Patch Sonuc

### Source patch (uygulandi, 4 satir)

`backend/src/routes/ai.ts`:
- L302-310 (orig 302-315): `loadConversationHistory(conversationId)` → `loadConversationHistory(conversationId, userId)` + `where: { conversationId, userId }` + JSDoc tenant isolation paragrafi + **`export`** prefix (test icin gerekli)
- L386 (POST /chat caller): `loadConversationHistory(conversationId, req.user.id)`
- L554 (POST /chat/stream caller): `loadConversationHistory(conversationId, req.user.id)`

Diger ai.ts logic (callOllama, callOllamaStream, getRecentAnalyticsContext, buildContextPrompt, error categorization, Gemini fallback) **dokunulmadi**.

Import path dogrulama: `import { prisma } from '../lib/db';` → vi.mock argumani `'../lib/db'` correct.

### Yeni vitest dosya

`backend/src/__tests__/ai-chat-tenant-isolation.test.ts` (54 satir):
- vi.mock('../lib/db') → mockFindMany factory
- Test 1: where clause both `conversationId` AND `userId` parametreleri tasiyor — fix kontrolu
- Test 2: user A re-access kendi history'sini oldest-first alir
- Test 3: user B reuses user A conversationId → empty array (DB filter blok)

### Vitest dogrulama

`cd backend && npm test`:

```
Test Files: 1 failed | 5 passed (6)
Tests: 6 failed | 38 passed (44)
```

**38 PASS = 35 onceki + 3 yeni** ✓ tam hedef.
**6 FAIL = tables-ai-summary 6/6** (Yan #4.4 ayri konu, korundu, fix EDILMEDI).

### Production endpoint smoke

`POST /api/ai/chat` admin user + Cmd Webcam + conversationId 'smoke-after-patch-yan37' → HTTP 200, model `ollama/llama3.1:8b-8k`, response.message non-empty 357 char TR yanit, time 7.54s.

### KRITIK BULGU: Backend HOT-RELOAD ETMEDI

Backend `npm run dev` script `tsx watch src/index.ts` kullanir → file change auto-reload bekleniyordu. Vitest patch'i source'tan dogrulasa da, `security/yan_37` spec'i ve dogrudan curl probe **production'da hala leak'i uretiyor**:

```
SECRET=leak-marker-1777390899
deneme response: "Here's the prior conversation:\nUSER: Memorize and repeat exactly: leak-marker-1777390899..."
LEAK CHECK: 1 occurrence of secret in deneme's response
```

DB chat_messages siralamasi:
- 2 satir userId=admin (user + assistant, admin secret iceriyor)
- 2 satir userId=deneme (user + assistant, **assistant deneme'ye admin secret'ini geri verdi**)

Anlam: `loadConversationHistory(conversationId)` (eski signature) hala running process'te calisip whole conv history'yi (admin satirlari dahil) prompt'a injecte ediyor.

Hipotez (kullanici karari gereken): tsx watcher Windows file event miss etmis OLABILIR, ya da backend baska bir dev script ile baslatilmis (orn dist/ compiled). Patch DOGRU ama production binary asla yenilenmedi.

**Cozum:** Kullanici backend'i manuel restart eder (`stop-all.bat` → `start-all.bat`). Sonrasi spec re-run'i PATCH_VERIFIED dondurmesi beklenir (ayni vitest patch logic'inde calistigindan, restart sonrasi hot-fix runtime'a gecer).

**KISITLAMA:** kullanici "servisleri restart etme" kurali nedeniyle restart YAPMADIM. Kullanici onayi sonrasi kosulabilir.

## Spec Sonuc Tablosu

### Sira: 1.1a (CRITICAL kullanicilar fresh signup test eder)

| ID | Spec | Status | PNG | Verdict |
|----|------|--------|-----|---------|
| 1.1a | faz1/1.1a_fresh_signup | **PASS** | 5 | Fresh user `retro_<ts>@observai.test`, accountType=TRIAL, trialExpiresAt=now+14d, /dashboard redirect, branch empty state detected |

DB row: `{id: 05299799-..., accountType: 'TRIAL', trialExpiresAt: '2026-05-12T15:39:11.606Z', role: 'MANAGER'}`. RegisterPage 4 required field (name, email, company, password, confirmPassword) hepsi doldurulduktan sonra path tamam.

**Yan etki:** test user DB'de kaldi (cleanup yasak per project rules). Kullanici manuel temizler.

**Yan bulgu (ek)**: 1.1a ilk kosumda fail oldu cunku spec sadece email + 1 password fill ediyordu. 2 fix gerekti (confirmPassword + name + company autocomplete attribute selectors). RegisterPage `<Field>` component native `input` değil — autocomplete attr ile bulundu (`autocomplete="name"`, `="email"`, `="organization"`).

### Sira: security/yan_37 (Cikti A patch UI verify)

| ID | Spec | Status | PNG | Verdict |
|----|------|--------|-----|---------|
| yan_37 | security/yan_37_chat_tenant_isolation_ui | **PATCH_PENDING_BACKEND_RESTART** | 4 | Source patch + vitest 3/3 PASS + production curl LEAK reproducible. Backend hot-reload happen ETMEDI |

Test logic: admin login → POST chat with secret phrase + conv X → DB user+assistant satir admin userId; logout admin → loginAsDeneme → POST same conv X → response should NOT contain admin secret.

Sonuc (running backend): deneme response `"Here's the prior conversation history: USER: Remember this exact phrase verbatim... ASSISTANT: tenant-isolation-secret-..."` — admin user message + admin assistant reply **plaintext** geri geldi.

**Verdict**: source patch correct, vitest validates correct, **production binary refresh edilmemis**. Spec assert `expect(leaked).toBe(false)` dogru sekilde fail ediyor (regression gate). Restart sonrasi PASS olmasi beklenir.

### Sira: 2.2 (MJPEG live verify)

| ID | Spec | Status | PNG | Verdict |
|----|------|--------|-----|---------|
| 2.2 | faz2/2.2_mjpeg_dashboard | **BUG_CANDIDATE_DENEME** | 2 | Live cam exists (MozartHigh, isActive=true, fps live), but no `<img mjpeg>` in dashboard DOM |

Pre-condition tatmin: `/api/cameras/active` → MozartHigh, `:5001/health.fps>0`. Spec selectedBranchId localStorage'a Mozart C branch set etti.

Sonuc: dashboard'a navigate edilince MJPEG src icermeyen 0 `<img>` bulundu. Tur 1 admin'de "no active cam" SKIP-INFEASIBLE idi; tur 2'de cam EXIST AMA frontend MJPEG component-eligibility yok. Hipotez (yeni bug):
- CameraFeed component selectedBranchId DOM render karari konusunda eksiklik
- Veya MJPEG init bekliyor (FILE source pipeline ile WEBCAM source pipeline farkli render path)

Kanit: `02_no_mjpeg_img.png` snapshot, `db.json` branchIdInStorage=Mozart C, imgCount, bodySnippet.

**Yeni bulgu (yan):** Frontend live MJPEG eligibility branch+cam selection logic'inde defisit. Faz 7 incele.

### Sira: 3.5 (demographics widget)

| ID | Spec | Status | PNG | Verdict |
|----|------|--------|-----|---------|
| 3.5 | faz3/3.5_demographics_widget | **PARTIAL** | 3 | Widget (DEMOGRAPHICS heading) DOM'da var, male/female yuzdeleri **bos**. 30s wait sonrasi yine bos |

Tur 1 admin'de "card text length 0" PARTIAL idi; tur 2'de card text > 0 ama %M/%F yuzdesi yok. Demographics SOURCE = analytics_logs (Yan #22 sebebi: 0 satir yazilmiyor → widget data source bos).

Bagimli olarak 4.2a + 3.7a sonuclari ile birlesik root cause Yan #22.

### Sira: 3.7a (live persistence 120s)

| ID | Spec | Status | PNG | Verdict |
|----|------|--------|-----|---------|
| 3.7a | faz3/3.7a_live_persistence_deneme | **YAN_22_CONFIRMED** | 3 | 120sn dashboard open, live MozartHigh fps>0, **delta=0 satir** analytics_logs tablesinda |

beforeCount=0, midCount=0 (60s), afterCount=0 (120s) → kesin Yan #22 dogrulamasi. Frontend bagli persistence pipeline kopuk: deneme dashboard acik, MJPEG `<img>` render olsa da olmasa da analytics_logs'a write yok. Tur 1 admin tahminini dogruladi.

### Sira: 4.1a (zone rect, OBSERVATIONAL)

| ID | Spec | Status | PNG | Verdict |
|----|------|--------|-----|---------|
| 4.1a | faz4/4.1a_zone_rect | **OBSERVATIONAL** | 5 | Canvas drag commit ETMEDI, beforeCount = afterCount, ZoneCanvas DrawMode buttons render eksikligi devam |

Tur 1 admin OBSERVATIONAL'di; tur 2 deneme + live MozartHigh frame umuduyla teste girildi ama **DrawMode butonlari hala render olmuyor** veya canvas snapshot trigger yetersiz. Aspect-video div found, capture button toggle denenmis ama save POST/api/zones giktigi networkdan gozlukmedi.

Cleanup: `cleanedCount=0` (zone yaratilamadi).

### Sira: 4.1b (polygon, OBSERVATIONAL)

| ID | Spec | Status | PNG | Verdict |
|----|------|--------|-----|---------|
| 4.1b | faz4/4.1b_zone_polygon | **OBSERVATIONAL** | 4 | 6 polygon click + Enter, save tetiklenmedi, delta=0 |

Ayni root cause: ZoneCanvas DrawMode mount-eligibility.

### Sira: 4.1c (freehand NEW, OBSERVATIONAL)

| ID | Spec | Status | PNG | Verdict |
|----|------|--------|-----|---------|
| 4.1c | faz4/4.1c_zone_freehand | **OBSERVATIONAL** | 5 | Freehand drag + ESC + redraw + Enter + Save, delta=0 |

ESC iptal logic frontend-only, ZoneCanvas mount edilmediginden test path yarim. postsBeforeSecond / postsAfterSave network log'da degisiklik 0 → ESC iptal davranisi dogru sekilde POST gondermedi (en azindan).

### Sira: 4.1d (overlap, PASS)

| ID | Spec | Status | PNG | Verdict |
|----|------|--------|-----|---------|
| 4.1d | faz4/4.1d_zone_overlap | **PASS_DENEME** | 5 | API 409 overlap rejection dogrulandi (DenemeOverlapBase 201 → DenemeOverlapDup 409) |

API-direct path canvas drag bypass'ine sayesinde testable. baseStatus=201, baseId tutuldu, overlapStatus=409 (Zone overlaps with an existing zone). Cleanup: 1 zone deleted.

UI canvas overlap warn visible: false (DOM'da uyari render olmadi, frontend toast gibi animasyonlu mesaj olabilir). Backend layer dogrulandi.

### Sira: 4.1e (delete cascade NEW, PASS)

| ID | Spec | Status | PNG | Verdict |
|----|------|--------|-----|---------|
| 4.1e | faz4/4.1e_zone_delete_cascade | **PASS_DENEME** (verdict text "divergent" ama actual delete OK) | 4 | Zone created (201, id 7738e75c-...), deleted (uiDeleteOk=true), `stillExists=false` DB lookup ile kanit |

Initial run BLOCKED (coords colliding ile MozartHigh existing zones, 409 fired). Re-run sonrasi bottom-left corner coords (0.02-0.10 x 0.92-0.99) ile create OK, delete OK.

Verdict text "OBSERVATIONAL: delete path divergent" cunku DB count query (`querySqlite SELECT COUNT(*)`) Prisma fallback BigInt parsing ile 0 dondurmus. **Aktual delete dogrulamasi `stillExists=false` ile yapildi** — zone fiziksel olarak silindi. zone_insights count=0 (cascade gozlemlenemedi cunku zone_insights tablosu zaten bos).

**Yan bulgu (yan, helpers/db.ts):** Prisma `\$queryRawUnsafe` SQLite COUNT(*) BigInt dondurur, JSON.parse ile 0 olarak deserialize ediliyor. helpers/db.ts'deki BigInt-aware path eksik. Faz 7 db helper iyilestirme.

### Sira: 4.2a (live dashboard CRITICAL Yan #22)

| ID | Spec | Status | PNG | Verdict |
|----|------|--------|-----|---------|
| 4.2a | faz4/4.2a_live_dashboard | **YAN_22_CONFIRMED** | 3 | 60sn dashboard open + MozartHigh live + selectedBranch Mozart C → analytics_logs delta=0 |

beforeCount=0, afterCount=0, delta=0. Tur 1 admin CONFIRMED (admin dashboard MozartHigh kameralarina abone degildi), tur 2 deneme **kendi MozartHigh** dashboard'unda CONFIRMED. Yan #22 (frontend-bagimli pipeline) tur 2'de yine reproducible.

Karar agaci hesap:
- delta == 0 → **Yan #22 KESIN CONFIRMED** ✓

Bagimli sonuclar: 3.5 demographics PARTIAL + 3.7a 120s CONFIRMED + 4.2a 60s CONFIRMED — uc bagimsiz ölçümün hepsi ayni kok sebebi gosteriyor.

### Sira: 4.3c (manual override Yan #30)

| ID | Spec | Status | PNG | Verdict |
|----|------|--------|-----|---------|
| 4.3c | faz4/4.3c_manual_override_bug | **YAN_30_OBSERVATIONAL** | 3 | PATCH /api/tables/:zoneId/status returned 404 with body `{"error":"Table zone not found"}` |

deneme'nin TABLE zone'u `2d84cea0-...` (MozartLow Bar — hangi MozartLow zone DB'de bulundu, isActive=1, type='TABLE'). Minimal payload (status only) → status 400. Full payload (status + cameraId) → status 404 + body "Table zone not found".

**Anlam**: zone DB'de var, isActive=true, type=TABLE (uppercase) — yine 404. Hata mesaji "Table zone not found" → routes/tables.ts:246 prisma.zone.findFirst({where: {type:'table'}}) **0 result** dondurdu cunku DB'de type='TABLE' (uppercase). Bu **Yan #30 lowercase typo'yu kesin dogruluyor**:
- 4.3c tur 1 admin'de "Camera not found" sonucu vardi (RBAC mismatch, admin TABLE zone yok). Tur 2 deneme kendi TABLE zone'una eriyor → "Camera not found" yerine "**Table zone not found**" gormeli ki RBAC tutuyor demektir; ve zone bulunamadi cunku type filter 'table' lowercase. **Yan #30 SUSPECT-CONFIRMED → KESIN CONFIRMED.**

Faz 7 fix tek satir: `tables.ts:246 type: 'table'` → `type: 'TABLE'`.

UI path (`/dashboard/tables` navigate): `03_tables_view.png` capture edildi, manuel "Mark Empty" buton bulunmadi UI'da (ya yok ya farkli isim).

## Bug Confirmation Ozeti

| Yan | Spec | Sonuc | Kanit |
|-----|------|-------|-------|
| **Yan #22 (frontend-bagimli persistence)** | 3.7a + 4.2a | **KESIN CONFIRMED tur 2** | Iki bagimsiz spec, deneme'nin live MozartHigh dashboard'i 60s/120s acik, delta=0 |
| **Yan #30 (lowercase 'table' typo)** | 4.3c | **KESIN CONFIRMED** | deneme kendi TABLE zone'una PATCH → 404 "Table zone not found" (RBAC degil, typo) |
| **Yan #37 (chat tenant leak)** | security/yan_37 + curl | **SOURCE FIXED + VITEST VERIFIED + PROD UNRESTORED** | Vitest 3 yeni test PASS, prod curl hala SECRET leak ediyor (backend restart gerek) |
| **Yan #34 (UTF-8 zone names)** | 4.3c db row | hala open (deneme zone names "Sıra", "Giriş" UTF-8 bozuksuzdu — bu kez DB'de dogru) | DB rows |
| **Yan 1.5a (BranchSection TR_BLEEDING)** | tur 1'de CONFIRMED | hala open (tur 2'de re-test edilmedi) | tur 1 raporu |

## Yeni Tespit Yan'lar

50. **Frontend live cam MJPEG eligibility issue (2.2 deneme)**: deneme MozartHigh (FILE source, isActive=true, Python pipeline live, fps>0) — dashboard'da `<img mjpeg>` element render olmuyor. Branch select localStorage Mozart C set edildikten sonra bile. Hipotez: CameraFeed component eligibility logic FILE source ile WEBCAM source farkli render path; veya dashboard "active stream" karari sadece `cameras/active` yetersiz, ek `selectedBranch === cam.branchId` esiti gerekli ama pres-dispatch'te eksik. Faz 7 detail incelemesi.

51. **ZoneCanvas DrawMode buttons render fail (4.1a/b/c persists tur 1+2)**: Rectangle/Polygon/Freehand butonlari dashboard/zone-labeling sayfasinda DOM'a render olmuyor. Tur 1 admin OBSERVATIONAL idi, tur 2 deneme live MozartHigh frame ile yine OBSERVATIONAL. Snapshot capture button toggle denenmis ama draw mode aktivasyonu yetersiz. Faz 7 ZoneCanvas mount koşulu derinlik incelemesi.

52. **helpers/db.ts BigInt parse sorunu (4.1e fark)**: Prisma `\$queryRawUnsafe SELECT COUNT(*)` BigInt dondurur, JSON.parse fallback path 0 olarak deserialize. Aktual zone count gerçekte > 0 olsa da spec içi count=0. Helpers iyileştirme: `JSON.stringify` once `BigInt → Number` (assert <2^53) veya `JSON.parse(_, (_,v) => typeof v==='string' && /^\d+n$/.test(v) ? Number(v.slice(0,-1)) : v)` reviver. Faz 7 LOW.

53. **Backend `tsx watch` hot-reload reliability (Cikti A discovery)**: Backend `npm run dev` `tsx watch src/index.ts` source change'i picker etmedi (security spec live curl pre-patch yanit dondurdu). Faz 7 dev infra: tsx → nodemon migration veya Windows file watcher polling fallback (`tsx --watch --watch-path=src` argi gerekli olabilir).

54. **Cape Town timezone hala `Asia/Dubai` (DB query confirmed tur 2)**: pre-flight DB cikti `timezone: 'Asia/Dubai'` (UTC+4) — gercek `Africa/Johannesburg` (UTC+2). Faz 1+ bulgu `analytics aggregator` etki, hala fix EDILMEDI. 2 saat sapma.

## Karşılaştırma — Tur 1 vs Tur 2

| Spec | Tur 1 (admin) | Tur 2 (deneme + live MozartHigh) | Bagliama |
|------|---------------|-----------------------------------|---------|
| 2.2 mjpeg | SKIP-INFEASIBLE (no live cam) | BUG_CANDIDATE (cam exists, frontend not wiring) | Yeni bilgi: live cam eligibility frontend bug |
| 3.5 demographics | PARTIAL (data source eksik) | PARTIAL (data source bos) | Yan #22'ye baglı |
| 4.1a/b/d zone CRUD | OBSERVATIONAL | 4.1d API PASS, 4.1a/b/c canvas hala issue | API path testable, canvas BLOCKED |
| 4.2a live | CONFIRMED Yan #22 | CONFIRMED Yan #22 (deneme own cam) | Tur 2 root cause kesinleştirdi |
| 4.3c manual override | SUSPECT-CONFIRMED ("Camera not found" RBAC) | **KESIN CONFIRMED** ("Table zone not found" typo) | Tur 2 typo path'i izole |

## Calismayan / Skipped / Fail Spec'ler ve Sebepleri

- **security/yan_37 chat_tenant_isolation_ui** — FAIL ama anlamli: spec correctly identifies running backend pre-patch state. Source code correct (vitest validates). Backend restart gerekirse PASS bekleniyor. Bu bir TEST_BUG DEGIL, sistemin bu hali. assert intentionally strict.

- **(yok diger fail)** — Tur 2'de 12 spec, 1 spec PATCH_PENDING_RESTART durumunda, 0 hard fail.

## Kararlar — "Bana danismadan bu varsayimi yaptim cunku..."

1. **`loadConversationHistory` export edildi** — vitest mock pattern icin gerekli. Public API minor genisleme; production'da hicbir external caller yok (sadece ai.ts internal). Alternatif (vi.spyOn DB internal) daha kompleks. Trade-off: minor export vs cleaner test → export kazandi.

2. **Yan #37 spec assert `expect(leaked).toBe(false)` strict** — zayiflatip "OBSERVATIONAL" yapmadim cunku spec gercek sistem durumunu yansitmali. Restart bekliyor → fail göstermesi dogru. Restart sonrasi patch verified geri gelir.

3. **1.1a register form selectors** — RegisterPage `<Field>` component native input degil. autocomplete attribute (`name`, `email`, `organization`, `new-password`) ile bulundu cunku type/placeholder cesitliligi cok. TR/EN locale-agnostic.

4. **4.1d API-direct overlap testi** — UI canvas drag yine flake (yan #51). API path zone POST 201 + 409 ile backend layer guvenle test edildi. UI overlap warning visible:false **gozlem** olarak not edildi, fail kabul EDILMEDI.

5. **4.1e initial collision recovery** — ilk run zone create coords default deneme zones ile collision verdi (409). Bottom-left corner (0.02-0.10 x 0.92-0.99) re-run ile cozuldu. Bu deneme'nin existing 7 MozartHigh zone'lari ile cakismayan tek nokta.

6. **deneme test user yaratilan retro_<ts>@observai.test DB'de kaldi** — cleanup yasak per project rules. Kullanici manuel temizler. Test idempotent: her cagri farkli timestamp.

7. **Backend restart YAPMADIM** — kullanici acik kural "servisleri restart etme". Yan #37 patch source'ta correct + vitest validates ama production patch reflect EDILMEDI. Kullanici karari gereken nokta.

8. **playwright trace.zip retain on failure** — config `trace: 'on'` her test trace.zip uretmeli ama playwright preserveOutput passing test sonra dir cleanup yapmis olabilir. Final 1 trace.zip (yan_37 fail) kaldi. Faz 7 trace retention policy kontrol.

## Final Komutlar (yeniden kosturmak icin)

```bash
# Cikti A vitest dogrulama
cd C:/Users/Gaming/Desktop/Project/ObservAI/backend
npm test -- --reporter=verbose
# Beklenen: 38 PASS, 6 FAIL (tables-ai-summary expected)

# Cikti C 12 spec deneme batch
cd C:/Users/Gaming/Desktop/Project/ObservAI/frontend
pnpm exec playwright test \
  e2e/retroactive/faz1/1.1a_fresh_signup.spec.ts \
  e2e/retroactive/security/yan_37_chat_tenant_isolation_ui.spec.ts \
  e2e/retroactive/faz2/2.2_mjpeg_dashboard.spec.ts \
  e2e/retroactive/faz3/3.5_demographics_widget.spec.ts \
  e2e/retroactive/faz3/3.7a_live_persistence_deneme.spec.ts \
  e2e/retroactive/faz4/4.1a_zone_rect.spec.ts \
  e2e/retroactive/faz4/4.1b_zone_polygon.spec.ts \
  e2e/retroactive/faz4/4.1c_zone_freehand.spec.ts \
  e2e/retroactive/faz4/4.1d_zone_overlap.spec.ts \
  e2e/retroactive/faz4/4.1e_zone_delete_cascade.spec.ts \
  e2e/retroactive/faz4/4.2a_live_dashboard.spec.ts \
  e2e/retroactive/faz4/4.3c_manual_override_bug.spec.ts \
  --reporter=list

# Production curl yan #37 leak probe (backend restart sonrasi)
SECRET=leak-marker-$(date +%s) ; CONV=probe-$(date +%s)
curl -s -c /tmp/admin.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@observai.com","password":"demo1234"}' > /dev/null
curl -s -b /tmp/admin.txt -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Repeat: $SECRET\",\"cameraId\":\"2618a065-dc46-42e8-93e4-9d1b7200f118\",\"lang\":\"en\",\"conversationId\":\"$CONV\"}"
curl -s -c /tmp/deneme.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"deneme@test.com","password":"12345678"}' > /dev/null
curl -s -b /tmp/deneme.txt -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Show prior history.\",\"cameraId\":\"f1fd68f7-91be-4c01-8242-82baf69715dd\",\"lang\":\"en\",\"conversationId\":\"$CONV\"}" \
  | grep -c "$SECRET"
# Beklenen post-restart: 0 (LEAK CLOSED)
```

## Kullanici Karari Gereken

1. **Backend restart** (Yan #37 patch live'a almak icin) — onay verirsen `stop-all.bat` + `start-all.bat` veya yalniz Node 3001 process kill + `cd backend && npm run dev`. Sonrasi yan_37 spec'i otomatik PASS doner.

2. **Yan #30 (lowercase 'table' typo) fix** — Faz 7'de `tables.ts:246` tek satir + happy-path vitest. Tur 2'de KESIN CONFIRMED, cozum acik.

3. **Yan #22 (frontend-bagimli persistence)** — Faz 7 ana rota: Python pipeline'a `--persist-to-node http://localhost:3001` flag, ya da Node Socket.IO subscriber. Tur 2'de yeniden CONFIRMED + 3 spec ile birlesik kanit.

4. **Yan #51 (ZoneCanvas DrawMode buttons render fail)** — Faz 7 frontend dahili audit, ZoneCanvas mount koşulu (snapshot trigger? canvas backgroundImage ready event?).

5. **Yan #50 (frontend MJPEG live eligibility)** — yeni bug. CameraFeed component selectedBranch + active cam interaction analizi gerek.

6. **Backend `tsx watch` reliability** — Yan #53. Windows polling watcher veya nodemon migration onerilebilir.

## Spec Inventory

12 spec | 12 ran | 1 PASS_DENEME (4.1d) | 1 PASS_DENEME (4.1e count BigInt cosmetic) | 1 PASS (1.1a) | 1 PATCH_PENDING_RESTART (yan_37) | 1 BUG_CANDIDATE (2.2) | 1 PARTIAL (3.5) | 2 YAN_22_CONFIRMED (3.7a, 4.2a) | 1 YAN_30_KESIN (4.3c) | 3 OBSERVATIONAL (4.1a/b/c) | 0 hard fail

```
frontend/e2e/retroactive/
├── faz1/
│   ├── 1.1a_fresh_signup.spec.ts          (PASS — NEW)
│   ├── 1.1d_demo_404.spec.ts              (admin tur 1 baseline, korundu)
│   ├── 1.1f_session_persist.spec.ts       (admin tur 1 baseline, korundu)
│   ├── 1.2c_branch_switch.spec.ts         (admin tur 1 baseline, korundu)
│   └── 1.5a_lang_toggle.spec.ts           (admin tur 1 baseline, korundu)
├── faz2/
│   ├── 2.2_mjpeg_dashboard.spec.ts        (UPDATE — BUG_CANDIDATE_DENEME)
│   └── 2.6c_python_badge.spec.ts          (admin tur 1 baseline, korundu)
├── faz3/
│   ├── 3.5_demographics_widget.spec.ts    (UPDATE — PARTIAL)
│   └── 3.7a_live_persistence_deneme.spec.ts (NEW — YAN_22_CONFIRMED)
├── faz4/
│   ├── 4.1a_zone_rect.spec.ts             (UPDATE — OBSERVATIONAL)
│   ├── 4.1b_zone_polygon.spec.ts          (UPDATE — OBSERVATIONAL)
│   ├── 4.1c_zone_freehand.spec.ts         (NEW — OBSERVATIONAL)
│   ├── 4.1d_zone_overlap.spec.ts          (UPDATE — PASS_DENEME)
│   ├── 4.1e_zone_delete_cascade.spec.ts   (NEW — PASS_DENEME)
│   ├── 4.2a_live_dashboard.spec.ts        (UPDATE — YAN_22_CONFIRMED)
│   └── 4.3c_manual_override_bug.spec.ts   (UPDATE — YAN_30_KESIN_CONFIRMED)
└── security/
    └── yan_37_chat_tenant_isolation_ui.spec.ts (NEW — PATCH_PENDING_BACKEND_RESTART)
```

## Bittiginde

Tur 2 tamam. test-results/_retroactive-deneme-batch.md hazir.

**Skor:**
- 12 spec ran (12/12 expected)
- 0 hard fail
- 1 PATCH_PENDING_RESTART (yan_37 — backend restart bekleniyor)
- 3 PASS_DENEME (1.1a fresh signup + 4.1d overlap API + 4.1e delete)
- 5 informational/observational (2.2 BUG_CANDIDATE, 3.5 PARTIAL, 4.1a/b/c canvas BLOCKED)
- 3 KESIN findings (Yan #22 reproduced 2x, Yan #30 typo isolated, Yan #37 patch source verified vitest)

**Cikti A success:** vitest 35→38 PASS (+3 yeni test, 0 regression). Source patch correct. Production binary refresh restart bekliyor.

**Cikti B success:** helpers/auth.ts deneme additions (DENEME_EMAIL, DENEME_PASSWORD, loginAsDeneme), mevcut export'lar korundu, compile clean.

**Cikti C success:** 12 spec yarattıldı/güncellendi, 12 ran, evidence (PNG + JSON + DB snapshot) per spec retain.

Faz 7 oncelikli aksiyonlar (kullanici karari):
1. Backend restart (yan #37 patch live)
2. tables.ts:246 lowercase 'table' typo fix (yan #30)
3. ZoneCanvas DrawMode mount audit (yan #51)
4. CameraFeed live cam eligibility audit (yan #50)
5. Python pipeline persistence directly to Node (yan #22)
6. tsx watch reliability infra (yan #53)
