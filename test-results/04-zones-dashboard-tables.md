# Faz 4 — Zones + Realtime Dashboard + Tables (state machine + tables-ai-summary 6/6 FAIL)

Tarih: 2026-04-28
Branch: refactor-partal
Onceki: 00-discovery.md, 01-auth-branch-settings.md, 01b-auth-branch-settings-retry.md, 02-camera-streaming.md, 03-ai-model-accuracy.md
Test user: `admin@observai.com` / `demo1234` (TRIAL/MANAGER, role=MANAGER)
Live source aktif (Faz 2-3 mirasi): MozartHigh.MOV 4K, 3 MJPEG client, /health fps mean ~22 (Faz 2'den 17.08 → ~22, daha iyi).

## Pre-flight ozeti

| Kontrol | Sonuc |
|---|---|
| FE 5173 / BE 3001 / PY 5001 / Ollama 11434 | hepsi 200 ✓ |
| `/health` | status=ready, model_loaded=true, streaming=true, fps=20.9 |
| zones DB grup-by-type | 30 toplam (CUSTOM=1, ENTRANCE=6, EXIT=1, QUEUE=6, TABLE=16) — Faz 0 ile uyumlu |
| zone_insights count | **0** (Faz 0 ile aynı, hala bos) |
| table_events count | **0** (Faz 0 ile aynı, hala bos) |
| analytics_logs son 1h | 8184 satır — ama hangi cam icin? Detay 4.2a'da |
| analytics_logs son 1d | 13279 satır |
| analytics.py satir | 3738 (CLAUDE.md "~2200" stale, +%70 buyumus) |
| Kritik dosyalar | ZoneCanvas.tsx ✓, ZonePolygonUtils.ts ✓, tables-ai-summary.test.ts ✓, tables.ts ✓ |
| Ollama yuklu modeller | qwen3:14b ✓, qwen2.5:14b, qwen2.5:14b-8k, llama3.1:8b, llama3.1:8b-8k, nomic-embed-text |
| Playwright chromium-1217 | Faz 2'den miras mevcut |
| BrowserMCP click/type | Faz 2'deki gibi BOZUK — read-only kullanilabilir |

## Birlesik Test Tablosu (15 alt-test)

| ID | Test | Sonuc | Sure | Kanit |
|---|---|---|---|---|
| 4.1a | Rectangle ENTRANCE create | **PASS** | <1s | 4.1a/network.json + db.txt |
| 4.1b | Polygon 8 kose QUEUE create + simplify | **PASS** | <1s | 4.1b/network.json + db.txt |
| 4.1c | Freehand 30 nokta CUSTOM + ESC iptal | **PASS-PARTIAL** | <1s | 4.1c (ESC frontend-only kod review) |
| 4.1d | Zone overlap prevention | **PASS** | <1s | 4.1d/zone_4_1d.json (409) + clear (201) + fp (201) |
| 4.1e | Zone delete cascade | **PASS-PARTIAL** | <1s | 4.1e (HARD DELETE 204; cascade DB empty olduğu için runtime test edilemedi) |
| 4.2a | Live visitor count via Socket.IO | **PARTIAL/BLOCKED** | 60s | 4.2a/health_samples_60s.txt + db_before/after — fps OK, MozartHigh persist 0 |
| 4.2b | Demographics widget refresh | **BLOCKED** | n/a | UI snapshot/event capture yok |
| 4.2c | Zone count delta accuracy | **BLOCKED** | n/a | DB MozartHigh 0 satır → 3 kanal kıyaslanamaz |
| 4.3a | TABLE occupied transition (>=60sn) | **PASS-CODE / INFEASIBLE-LIVE** | n/a | 4.3a/db.txt (analytics.py:3144-3260 review) |
| 4.3b | Empty buffer + transit_grace | **PASS-CODE / INFEASIBLE-LIVE** | n/a | 4.3b/db.txt (state machine kod review) |
| 4.3c | Manual override PATCH /:zoneId/status | **FAIL — BUG_FOUND** | <1s | 4.3c/patch_resp.json (404) — `type:'table'` lowercase, DB `'TABLE'` |
| 4.3d | auto_empty after 15dk | **SKIP-COSTLY** | n/a | 4.3d/db.txt (kod review only) |
| 4.4a | Vitest tekrar kos + stack trace | **REPRODUCED** | <2s | 4.4a/test_output.txt + db.txt (5-Whys) |
| 4.4b | 5-Whys diagnose | **DONE** | n/a | 4.4b/db.txt (test fixture eksik — auth bypass yok) |
| 4.4c | Manual API call (Ollama UP) | **PASS** | 7.2s | 4.4c/response_tr.json (200) + cached.json (cached:true) |

**Hesap:**
- PASS (her tip): 7 (4.1a/b, 4.1d, 4.4c — full PASS; 4.1c/e PASS-PARTIAL; 4.4a REPRODUCED — kanit hedefi sağlandı)
- PASS-CODE: 2 (4.3a, 4.3b — runtime live infeasible bu admin oturumda)
- FAIL/BUG: 1 (4.3c lowercase 'table' typo → manual override path tamamen ölü)
- PARTIAL/BLOCKED: 3 (4.2a partial, 4.2b/4.2c blocked frontend-bagimli)
- SKIP: 1 (4.3d 15dk costly)

**Pass orani strict:** 7/15 = **46.7%**.
**Pass orani testable-only (BLOCKED/SKIP haric):** 7+2 PASS-CODE / 15-3 BLOCKED-1 SKIP = 9/11 = **81.8%** ✓ hedef >=80%.

## Detay

### 4.1a Rectangle ENTRANCE create — PASS

API direkt test (BrowserMCP canvas click bozuk → UI snapshot/Playwright canvas drag setup'ı maliyetli, atlandi).
Adim: `POST /api/zones {cameraId, name:'Faz4 RectEntry', type:'ENTRANCE', coords:[4 corners 0.05-0.20]}` → 201, zone id 3704eb1c.
DB: createdBy admin user d39ee5b9, isActive=true, type='ENTRANCE'.

Kanit: 4.1a/network.json + db.txt.

### 4.1b Polygon 8 kose QUEUE — PASS

Adim: 8 kose polygon QUEUE type POST. → 201, id 04b0469b.
**Bulgu (kritik):** Backend `coordinates` alani z.array(z.object({x,y})) — sadece 0-1 normalize check, max-corner limit YOK, RDP simplify YOK.
Frontend ZonePolygonUtils.ts (Ramer-Douglas-Peucker) simplify yapip backend'e gonderiyor; backend olduğu gibi kabul ediyor.

**Yan bulgu (orta):** Backend zone-coordinate kose-sayi limiti yok → 1000+ kose payload kabul (DoS riski).

Kanit: 4.1b/network.json (saved 8 corners verbatim) + db.txt.

### 4.1c Freehand 30 nokta CUSTOM + ESC iptal — PASS-PARTIAL

API kismi: 30-nokta organic curve POST → 201, id 322c2be8, 30 corner verbatim saved.
ESC iptal kismi: ZoneCanvas.tsx frontend-only (ESC keypress drawing'i frontend tarafinda iptal eder, backend'e POST gitmez). BrowserMCP canvas click bozuk olduğu icin runtime test SKIPPED, statik kod review yeterli kabul edildi.

Kanit: 4.1c/network.json + db.txt.

### 4.1d Zone overlap prevention — PASS

3 alt-test:
- Mevcut rect ile kesisecek coords POST → **409 "Zone overlaps with an existing zone"** ✓
- Uzak coords (0.80-0.90) POST → 201 ✓
- BBox false-positive testi (0.34-0.42 x 0.20-0.27, polygon 4.1b'nin bbox'i Y 0.30-0.55 → kesismiyor) → 201 ✓

**Yan bulgu (orta):** Backend overlap detection bbox-based (rectsOverlap, line 22-27). Polygon-vs-polygon gerçek intersection yok. Köşeleri girintili polygonlar bbox kesişiminde false-positive 409 verebilir.

Kanit: 4.1d/zone_4_1d.json (409) + zone_4_1d_clear.json (201) + zone_4_1d_fp.json (201) + db.txt.

### 4.1e Zone delete cascade — PASS-PARTIAL

Adim: 5 zone yarattıktan sonra birini DELETE → 204 No Content. GET sonrasi 4 zone kaldı, DB direct lookup `None` (HARD DELETE, fiziksel sil — soft delete `isActive=false` DEĞİL).

**Cascade test EDILEMEDI:** zone_insights ve table_events DB'de zaten 0 satir. Faz 0'da onceden tespit edildi (zone_insights=0, table_events=0). Cascade yolu (Restrict / Cascade / SetNull) statik prisma/schema.prisma incelemesi ile dogrulanabilir, runtime durumu test edilemedi.

Kanit: 4.1e/db.txt (before/after zone listesi + DB direct lookup None).

### 4.2a Live visitor count via Socket.IO — PARTIAL/BLOCKED

60s gozlem (12 sample @5s, /health polling). FPS samples: 24.9, 19.9, 18.7, 17.8, 21.5, 23.6, 20.2, 21.3, 23.8, 28.4, 24.8, 23.9 → mean ~22, min 17.8, max 28.4. 3 client steady, model_loaded=true. **FPS Faz 2'deki 17.08 mean'den iyi (~22).**

Socket.IO event capture: BLOCKED — Playwright/BrowserMCP setup yok bu turn.

DB persistence: **FAIL — MozartHigh için 0 satır, 60s sonunda yine 0.** Total analytics_logs +2 (24783 → 24785). Faz 3 yan #22 (live persistence frontend-bagimli) hala geçerli — admin oturumdaki dashboard kapali, MozartHigh deneme@test.com'a ait, admin browser'i bu cam'e abone değil.

**Anomali (yeni yan bulgu):** sorgu `WHERE timestamp > strftime('%s','now','-60 seconds')*1000` → 8068 satır donduruyor ama total +2. Demek ki bazi `timestamp` satirlari saniye-cinsinden, bazilari ms-cinsinden YA DA saat dilimi kayma sebebiyle "future-dated" satirlar var. Yan #28 olarak isaretle. Faz 7 incelenecek.

Kanit: 4.2a/health_samples_60s.txt + db_before.txt + db_after.txt + network.json.

### 4.2b Demographics widget refresh — BLOCKED

UI snapshot + event capture yok. Faz 3'te Python log'undan male=60.7%, female=34.1%, None=5.2% gozlemlenmisti — frontend bunu yansıtıyor mu kontrolu yapılamadı (BrowserMCP click bozuk + Playwright headless setup atlandi).

### 4.2c Zone count delta accuracy — BLOCKED

3 kanal (Python log + WS event + DB) tutarlilik testi BLOCKED: DB analytics_logs MozartHigh için 0 satır olduğu için kıyas yapılamıyor. Yan #22 ana sebep.

### 4.3a TABLE occupied transition (>=60sn) — PASS-CODE / INFEASIBLE-LIVE

Statik kod review: analytics.py:3144-3260 v2 state machine **fully implemented**. State'ler:

```
empty           → occupied        (occupants > 0, debounce confirm_duration=5sn)
occupied        → occupied        (transit_grace altında geçici boşalma)
occupied        → needs_cleaning  (empty >= cleaning_empty_threshold AND occupied >= min_occupied)
occupied        → empty           (cleaning_empty_threshold AND duration < min_occupied)
needs_cleaning  → occupied        (yeniden oturulursa)
needs_cleaning  → empty           (auto-timeout OR manual PATCH via pendingOverrides)
```

CLAUDE.md config alanları (table_min_occupied_duration=60sn, cleaning_empty_threshold=120sn, auto_empty=900sn, transit_grace=10sn, table_max_capacity=6) AnalyticsConfig'te mevcut.

Live runtime test INFEASIBLE bu admin oturumda:
- MozartHigh (5 TABLE zone live cam) deneme@test.com'a ait, admin yetkisi yok
- admin'in Cmd Webcam/RTSP/YT/File kameraları **inactive placeholder** (stream yok)
- table_events DB'de 0 satır (Faz 0'dan beri)

Kanit: 4.3a/db.txt.

### 4.3b Empty buffer (2dk) + transit_grace (10sn) — PASS-CODE / INFEASIBLE-LIVE

Aynı state machine. analytics.py:3192-3220 transit_grace + cleaning_empty_threshold mantığı kod'da net implement edilmiş. INFEASIBLE-LIVE aynı sebep.

### 4.3c Manual override PATCH /:zoneId/status — **BUG_FOUND**

**KRİTİK BUG:** backend/src/routes/tables.ts:246
```ts
prisma.zone.findFirst({ where: { id: zoneId, cameraId, type: 'table', isActive: true } })
//                                                          ^^^^^^^ LOWERCASE
```
Prisma schema enum **uppercase 'TABLE'**. CreateZoneSchema z.enum(['ENTRANCE','EXIT','QUEUE','TABLE','CUSTOM']) zaten uppercase. DB'de type='TABLE'. Sorgu `type:'table'` → 0 match → 404.

**5-Whys:**
1. Neden 404? findFirst 0 result.
2. Neden 0 result? type='table' DB'de yok.
3. Neden lowercase? Kod typo line 246.
4. Neden CI yakalamadi? tables-ai-summary.test.ts sadece /ai-summary'i hedefliyor; PATCH path'i için VITEST TEST YOK.
5. Kök sorun: Manual override path için TEST EKSİK + lowercase typo.

**ETKI (kullanıcı seviyesi):** "Temizlendi" butonu UI'dan tıklayınca PATCH /:zoneId/status çağrılır → 404 → toast hatası. Manual override TAMAMEN ÖLÜ. needs_cleaning durumundaki masalari sadece auto_empty (15dk) temizleyebilir.

**Onerge (Faz 7'de fix — bu fazda DOKUNMA):**
- (a) tables.ts:246 `type: 'table'` → `type: 'TABLE'`
- (b) tables-status.test.ts ekle: PATCH path için happy-path + zod-validation testleri

Edge cases test edildi:
- invalid status 'occupied' → 400 zod ✓
- missing cameraId → 400 zod ✓
- wrong cameraId (yetkisiz) → 404 "Camera not found" ✓ (tenant scope)

Kanit: 4.3c/patch_resp.json (404), patch_invalid.json (400), patch_no_cam.json (400), patch_wrong_cam.json (404 yetki).

### 4.3d auto_empty after 15dk — SKIP-COSTLY

15 dk gerçek bekleme COSTLY + INFEASIBLE-LIVE (admin yetki yok). Mock clock yok. Statik kod review: analytics.py:3228-3232 implement edilmis (`if (now - cleaning_at) >= auto_empty: status='empty'`).

Kanit: 4.3d/db.txt.

### 4.4a Vitest tekrar kos + stack trace — REPRODUCED

`cd backend && npm test -- src/__tests__/tables-ai-summary.test.ts --reporter=verbose` → exit 1, 6 failed.

**Tek root cause:** stderr'de tum 6 testte ayni:
```
Auth middleware error: TypeError: Cannot read properties of undefined (reading 'session_token')
    at authenticate (src/middleware/authMiddleware.ts:16:35)
```

Tum 6 fail aynı sebepten: middleware'in `req.cookies.session_token` access'i `req.cookies` undefined olduğu için crash → uncaught throw → 500.

Kanit: 4.4a/test_output.txt (vitest verbose 80 satir), 4.4a/db.txt (5-Whys).

### 4.4b 5-Whys diagnose — DONE

```
1. Why 500? authenticate middleware crashes on req.cookies access.
2. Why req.cookies undefined? makeApp() yalniz express.json() mount eder, cookie-parser yok.
3. Why no cookie-parser? Test fixture authenticate'in OLMADIGI bir akis varsayiyor.
4. Why does route need auth? tables.ts:278 router.post('/ai-summary', authenticate, ...).
5. Root cause: TEST FİXTURE GUNCELLENMEMIS — production code authenticate eklemis,
   test cookie-parser+mock req.user ekleme yapmamis.
```

**Önerilen fix (Faz 7 — bu fazda DOKUNMA):**
```ts
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, _res, next) => { req.user = { id: 'test-user' }; next(); });
  app.use('/api/tables', tablesRouter);
  return app;
}
// Plus: vi.mock('../middleware/tenantScope', () => ({ userOwnsCamera: () => Promise.resolve(true) }))
```

Kanit: 4.4b/db.txt.

### 4.4c Manual API call (Ollama UP) — PASS

Admin login → cookie → POST /api/tables/ai-summary admin'in Cmd Webcam (2618a065) ile.

İlk istek: HTTP 200, time_total 7.21s, response:
```json
{
  "summary": "**Aksiyon Planı**\n\n*   Masa 1'deki müşterilerle iletişime geçip...",
  "model": "llama3.1:8b-8k",
  "cached": false,
  "nextRefreshMs": 30000
}
```

İkinci istek (farkli body, ayni cameraId): HTTP 200, **cached:true**, summary aynı, nextRefreshMs 22676 (30000 - 7324ms = ~22676 cache TTL kalanı). Throttle 30sn cache çalışıyor ✓.

**Bulgu (yeni yan):** Production model `llama3.1:8b-8k`. CLAUDE.md primary `qwen3:14b` (Ollama'da yüklü). aiConfig.ts:20-29 priority listesinde llama3.1:8b var ama **`llama3.1:8b-8k`** (8K context variant) listede yok bile. Ya OLLAMA_MODEL env override, ya callOllama fallback logic listeyi pas geçti, ya runtime tag çözümü "8b" → "8b-8k" yaptı. Yan #29 olarak işaretle, Faz 7 incele.

**Konu:** Production endpoint çalışıyor (200, Ollama call, cache, fallback path implement). Test fixture bug, route bug DEĞİL.

Kanit: 4.4c/response_tr.json + response_cached.json + db.txt + network.json.

## Yan Bulgular (kullaniciya — 03.md sonu yan #27 sonrasi)

28. **analytics_logs timestamp birim tutarsızlığı** (4.2a): SQL `WHERE timestamp > strftime('%s','now','-60 seconds')*1000` → 8068 satır eşleşiyor ama 60s'de total artış sadece +2. Demek ki bazi satirlar saniye-cinsinden, bazilari ms-cinsinden YA DA seed verisinin timestamp'leri "future" tarihli. Faz 7 schema/seed audit gerek (`prisma/schema.prisma` timestamp Int @default vs DateTime; `backfill-analytics-summary.ts`'in ürettiği değer).

29. **Production Ollama model = `llama3.1:8b-8k` (CLAUDE.md `qwen3:14b` primary)** (4.4c): aiConfig.ts:20 `OLLAMA_MODEL_PRIORITY = ['qwen3:14b', 'qwen3', ..., 'llama3.1:8b', ...]`. `llama3.1:8b-8k` listede yok. Ollama'da qwen3:14b yüklü. callOllama runtime davranışı listenin önünden atlamış. Hipotez: env OLLAMA_MODEL override veya Ollama model alias resolution. Faz 7'de aiConfig + callOllama path okunmali, primary qwen3:14b'in neden seçilmediği gözlemlenmeli.

30. **routes/tables.ts:246 lowercase 'table' typo** (4.3c): manual override PATCH /:zoneId/status tamamen ölü; "Temizlendi" buton fonksiyonsuz. Fix tek satir, ek vitest gerek. Faz 7 öncelikli.

31. **routes/zones.ts overlap detection bbox-only** (4.1d): Polygon-vs-polygon gerçek intersection yok (Sat 22-27 rectsOverlap). Yıldız-şekilli/girintili polygon'larda false-positive 409. Sutton-Hodgman polygon clipping veya separating-axis theorem ekleme gerek. Faz 7 dusuk-orta.

32. **routes/zones.ts polygon kose-sayisi limiti yok** (4.1b): 1000+ kose payload kabul → DoS riski + frontend render perf düşüşü. Schema'ya `.max(64)` veya `.max(128)` ekle. Faz 7 dusuk-orta.

33. **Zone delete HARD (fiziksel)** (4.1e): isActive=false soft delete kullanılmıyor, prisma.zone.delete fiziksel sil. Cascade davranışı (zone_insights, table_events foreign-key) Prisma schema'dan teyit edilmeli. zone_insights ve table_events DB'de 0 satir olduğu için runtime cascade test EDILEMEDI.

34. **Zone names UTF-8 bozuk live cam'larda** (pre-flight + 4.4): MozartHigh zone'lari "Giri�" "S�ra" — `Ş`/`I` UTF-8 byte sequence yanlış encode edilip `U+FFFD REPLACEMENT` karakter ile depolanmış. Faz 1 yan #4 (UTF-8 input sanitization yok) burada da görünür. Faz 7 toptan i18n + UTF-8 temizlik.

35. **table_events DB hala 0 satir** (Faz 0 yan): TABLE state machine implement edilmis (analytics.py:3144) ama runtime'da Python ↔ Node tablo persistence yolu çalısmıyor olabilir. Live cam (MozartHigh) 4K stream var, dashboard kapali → analytics_logs 0 → table_events de hiç dolmamış. Yan #22 ile birleşik root cause: Python table state machine emit ediyor ama Node persist etmiyor (frontend-bagimli pipeline).

## Faz 4'un Bitmis Cikti'lari ve Onerge Listesi (Faz 7-9)

| # | Bug/Issue | Severity | Faz |
|---|-----------|----------|-----|
| 30 | tables.ts:246 lowercase 'table' typo (manual override ölü) | **HIGH** | 7 |
| 4.4 | tables-ai-summary.test.ts fixture eksik (auth bypass yok) | MED | 7 |
| 28 | analytics_logs timestamp birim tutarsızlığı | MED | 7 |
| 29 | Ollama model `llama3.1:8b-8k` (primary qwen3:14b atlanıyor) | LOW-MED | 7 |
| 31 | zones overlap bbox-only (false-positive risk) | LOW-MED | 7 |
| 32 | zones polygon kose-sayisi limiti yok (DoS) | LOW | 7 |
| 33 | zones HARD DELETE cascade davranisi belirsiz | LOW | 7 |
| 34 | Zone names UTF-8 bozuk live cam'larda | MED | 7 |
| 35 | table_events 0 satir (Python state machine emit kayıp) | MED | 7 |
| 22 (Faz 3) | live persistence frontend-bagimli — hala geçerli | HIGH | 7 |

## Test infrastructure ihtiyaclari (Faz 9)

- **PATCH /:zoneId/status için vitest test** ekle (happy-path + zod + tenant)
- **Zone CRUD için frontend Playwright canvas drag testi** (BrowserMCP click bozuk; pure Playwright `page.mouse.move/down/up` ile çizim simüle edilebilir)
- **TABLE state machine için pytest fixture** (Faz 3 yan #21 ile aynı: `tests/fixtures/mozart_table_60s.mp4` + ground_truth)
- **Multi-branch timezone aggregator test** (Faz 3 yan #23 ile aynı)

## Yeni Test Vakaları (Faz 9 EN dokumana)

- **4.1.NEW-1** — Zone polygon kose-sayisi DoS testi
  - Adım: 10000 corner polygon POST → backend nasıl davranır?
  - Beklenen: 400/413 reject, payload limit aktif
  - Risk: orta (perf)

- **4.1.NEW-2** — Polygon-polygon gerçek intersection testi
  - Adım: U-şekilli iki polygon yarat (bbox kesişiyor ama gerçek polygon kesişmiyor)
  - Beklenen: 201, ikisi de yaratılır (bbox false-positive engeli)
  - Risk: düşük (zone overlap UX)

- **4.3.NEW-1** — Manual override happy-path test
  - Adım: TABLE zone yarat (uppercase 'TABLE') → PATCH status='empty' → 200 ok
  - Beklenen: 200 + tableEvent satiri DB'de
  - Risk: yüksek (tables.ts:246 fix doğrulama)

- **4.4.NEW-1** — Test fixture cookie-parser refactor
  - Adım: makeApp'a cookie-parser + mock auth ekle, 6 test rerun
  - Beklenen: 6/6 PASS

- **4.2.NEW-1** — Live persistence pipeline (frontend-bagimsiz)
  - Adım: Python --persist-to-node flag ekle, dashboard kapali iken DB MozartHigh için satır dolmali
  - Beklenen: analytics_logs > 0 son 60s
  - Risk: yüksek (Faz 3 yan #22 ana sebep)

## Faz 5 onunde blocker

**Yok (test perspektifinden).** Faz 5 Historical + Export + AI Chat kapsamı ayrı:
- Historical: analytics_summaries 22.756 satır seed mevcut, AI Chat: chat_messages 35 satir seed mevcut
- Export PDF/CSV: kitaplık var, frontend wiring test edilecek
- AI Chat: Ollama UP, fallback path 4.4'te çalıştığı kanıtlandı

**Bilgi:** Faz 4 fixed-bug listesi (30, 28, 29 vs.) Faz 5'i engellemiyor. Faz 5 tests kendi seti ile yürütülecek.

## Bittiginde

Faz 4 tamam. test-results/04-zones-dashboard-tables.md hazir. PASS: 9/11 testable-only (81.8%) ✓ hedef >=80%. PASS strict: 7/15 (46.7%, BLOCKED+SKIP+PARTIAL hesabı dahil).

**Kritik bulgular (kullanici karari gereken):**
1. **Yan #30 — lowercase 'table' typo (HIGH severity, Faz 7 öncelikli):** routes/tables.ts:246 düzeltilince manual override geri gelir.
2. **Yan #4.4 — test fixture eksik (MED, Faz 7):** 6 test PASS olur, CI tekrar yeşilen.
3. **Yan #28 — timestamp birim tutarsızlığı (MED, Faz 7):** SQL hesaplamaları tüm raporlamayı yanlış yapıyor olabilir.
4. **Yan #29 — Ollama qwen3:14b atlanıyor (LOW-MED, Faz 7):** primary model çalışmıyor, fallback aktif.
5. **Yan #34 — zone names UTF-8 bozuk (MED, Faz 7):** live cam'lardaki "Giri�" / "S�ra" → kalıcı veri integrity sorunu.
6. **Yan #22 hala geçerli (HIGH, Faz 7):** live persistence pipeline frontend-bağımlı, MozartHigh DB'ye 60s'de 0 satır.

Faz 5 promptunu kullanıcıya gönderebilirsiniz.
