# Faz 2 — Camera & Streaming + FPS

Tarih: 2026-04-28
Branch: refactor-partal
Onceki: 00-discovery.md, 01-auth-branch-settings.md, 01b-auth-branch-settings-retry.md
Browser: Playwright Chromium 1217 (devices['Desktop Chrome']) — `pnpm exec playwright --version` = 1.59.1
Test user: `admin@observai.com` / `demo1234` (TRIAL/MANAGER, seeded)
Live source aktif: `MozartHigh.MOV` (3840x2160, 3 MJPEG client baglandi, FPS ~16)

## Pre-flight ozeti

| Kontrol | Sonuc |
|---------|-------|
| FE 5173 / BE 3001 / PY 5001 / Ollama 11434 | hepsi 200 ✓ |
| Playwright chromium-1217 binary | mevcut (`AppData\Local\ms-playwright\chromium-1217\chrome-win64`) ✓ |
| `:5001/health` ilk curl | **`{"service":"MiroFish-Offline Backend","status":"ok"}`** (ANOMALI, ~5dk sonra normalize oldu) |
| `:5001/health` sonraki curl'lar | `{"status":"ready",...,"fps":15-17,"clients":3}` ✓ ObservAI dogru |
| Cameras (admin user, ilk durum) | 1 (Webcam 0) — branch yok → CRUD silently FAIL |
| Branch admin user | 0 → Faz2 testi icin **2 branch eklendi** (`Faz2 Admin Branch` + `Faz2 Admin Branch B`) |
| Pyhton process listesi | 2 python.exe (PID 31152 venv, PID 40648 system Python) — port 5001 owner = 40648 |
| `tasklist`/`Get-CimInstance` cmdline | Ikisi de `camera_analytics.run_with_websocket --ws-port 5001` (CLAUDE.md ile uyumlu) |
| MiroFish kaynak kodda var mi? | grep `packages/`, `backend/`, `frontend/` → **0 match** |
| MiroFish Windows servis | `Get-Service` → **0 match** |
| MozartHigh.MOV resolution | **3840x2160 (4K)** — bandwidth/FPS hedeflerini direkt etkiler |

## Birlesik Test Tablosu (~20 alt-test)

| ID | Test | Sonuc | Kanit | Sure |
|----|------|-------|-------|------|
| 2.1a | Webcam camera ekle | **PASS** | playwright camera-sources test 1 + db_after.txt | <2s |
| 2.1b | YouTube camera ekle | **PASS** | ayni test 1 (`Cmd YT`) | <2s |
| 2.1c | RTSP/IP camera ekle | **PASS** | ayni test 1 (`Cmd RTSP`) | <2s |
| 2.1d | Camera duzenle (rename + sourceValue) | **PASS** | playwright test 2 | ~3s |
| 2.1e | Camera sil | **PASS** | playwright test 3 | <2s |
| 2.1bonus | Reuse + activate stream-readiness | **PASS** | playwright test 4 | ~4s |
| 2.1bonus2 | Stream URL builder kontrat | **PASS** | playwright test 5 | <3s |
| 2.2a | MJPEG inference mode (default) | **PASS** | 2.2/2.2a_headers.txt + sample_inference.mjpeg | 5s |
| 2.2b | Inference annotation overlay | **PASS** | sample_inference.mjpeg JPEG SOF marker → 4K boyut, frame degisiyor | 5s |
| 2.2c | MJPEG smooth mode | **PASS** | 2.2c_smooth_5s.txt + sample_smooth.mjpeg | 5s |
| 2.2d | Stream stop / disconnect | **PASS-CODE** | code review: cameraBackendService unmount handler + AbortController | n/a |
| 2.3a | Inference mode FPS | **FAIL** | 2.3a_fps_60s.txt — mean=17.08, p5=13.90, hedef >=22/>=18 | 60s |
| 2.3b | Smooth mode browser FPS | **PARTIAL** | server-side MJPEG 19.2 fps (96 frame/5s); client rAF olcum BLOCKED (Playwright headless gerek farkli sekme) | 5s |
| 2.3c | Inference latency | **FAIL** | 2.3c_latency.txt — total mean=103.9ms p95=148ms, hedef <50/<100ms | n/a |
| 2.3d | Network bandwidth | **FAIL** | 2.3d_bandwidth_summary.txt — 99 Mbps inference / 119 Mbps smooth, hedef 5-15 Mbps | n/a |
| 2.4a | Branch A→B switch (cycle 1/3) | **PASS-PARTIAL** | 2.4a_after_switch.png (B aktif, "Faz2 Admin Branch B — Istanbul"); 2. cycle test crash (page closed) — BUG candidate | ~10s |
| 2.4b | Camera switch ayni branch | **SKIP-INFEASIBLE** | admin user'in branch B'sinde sadece RTSP/YouTube cam, gercek stream yok | — |
| 2.4c | Source switch (admin panel) | **SKIP-INFEASIBLE** | UI yok / belirsiz | — |
| 2.4d | Stres 5 ardisik switch | **PASS** | playwright stress test, 0 console errors | ~6s |
| 2.5a | Backend kapali UI durumu | **PASS-CODE** | 2.5_reconnect_code_review.md — kod yolu PASS, live kill skipped | n/a |
| 2.5b | Reconnect davranisi | **PASS-CODE** | ayni — Socket.IO auto-reconnect + 10sn health poll | n/a |
| 2.5c | Webcam fiziksel disconnect | **SKIP-INFEASIBLE** | otomasyonda webcam yok | — |
| 2.6a | "not reachable" mesaji kaynagi | **PASS** | i18n strings.ts:2561 + SettingsPage.tsx:506 | n/a |
| 2.6b | Hangi endpoint | **PASS** | `/api/python-backend/health` Node proxy → :5001/health | n/a |
| 2.6c | Tani | **BUG_CONFIRMED** | 2.6_bug_summary.md — UI yalnizca status==='ready' kabul ediyor; 'ok' (MiroFish shape) → red badge | n/a |
| 2.7a | Resolution sweep | **SKIP-COSTLY** | 5+ dk restart, current streaming kesicek | — |
| 2.7b | frameSkip sweep | **SKIP-COSTLY** | ayni | — |

**Tahlil:** 16 sub-test (skip cikar = 16 / 20 testable). PASS = 13, FAIL = 3, BUG = 1 (2.6c), SKIP = 4 (3 INFEASIBLE + 2 COSTLY + 1 PARTIAL). Hesaplama:
- Strict pass orani: 13/20 = **65%**
- Testable-only pass orani: 13 / (13+3+1) = **76.5%**

Hedef ≥ 80% icin FPS/latency/bandwidth FAIL'leri ana sebep — kaynak: MozartHigh.MOV **4K resolution** (annotated frame'ler 4K JPEG olarak akiyor, 800KB/frame). Faz 0 cıkti'sinde resolution=416 yazilan default config UI'dan, ama Python prosesin çalisma anındaki etkin resolution farkli (4K source → 4K output).

## Detay (her test icin)

### 2.1a–e Camera CRUD (5 PASS + 2 BONUS PASS)

**Adim:**
1. `pnpm exec playwright test camera-sources.spec.ts --reporter=line`
2. **Pre-condition (KRITIK):** admin@observai.com kullanici icin branch olusturuldu (POST /api/branches). Branch yoksa CRUD form silently fail (UI input alanlari dolu, "Add Source" tikladiktan sonra hicbir sey olmuyor — "Once bir sube secin" kirmizi metin gösteriliyor).

**Beklenen:** 5/5 test PASS.

**Gerceklesen:**
- Ilk koşu: 5/5 FAIL (`waitFor camera-card timeout 10s`) → screenshot bulgu: "Once bir sube secin"
- Branch admin user'a eklendi (curl POST /api/branches)
- Ikinci koşu: **5/5 PASS (21.8s)**

**Kanit:** `screenshots/02/2.1/2.1_no_branch_bug.png` (silent fail UI), `screenshots/02/2.1/db_after.txt` (DB state +4 cam: Cmd Webcam, Cmd File, Cmd RTSP, Cmd YT, hepsi `branchId=f42ffe77`).

**Olcum:** her CRUD operasyonu < 3sn (form submit → DB → UI).

**Kullanici nasil tekrarlar:**
1. `cd backend && curl -c /tmp/c -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@observai.com","password":"demo1234"}'`
2. `curl -b /tmp/c -X POST http://localhost:3001/api/branches -H "Content-Type: application/json" -d '{"name":"Test","city":"Ankara","latitude":39.93,"longitude":32.86,"timezone":"Europe/Istanbul","isDefault":true}'`
3. `cd frontend && pnpm exec playwright test camera-sources.spec.ts`

**Sonuc:** PASS — auth, branch, ve CRUD calisiyor.

**🐛 YAN BULGU (UX, orta seviye):** Branch yokken kamera ekleme formu **silently fail** ediyor. Form input'lar full doldurulup submit edildikten sonra hicbir toast/error/redirect gostermiyor; sadece form alaninda kucuk kirmizi yazi "Once bir sube secin (ust menuden)" var ama kullanici submit'in sessizce iptal edildigini gormuyor. Ek olarak hardcoded TR string ("Once bir sube secin"), EN locale'inde de TR gosterilir → Faz 7 i18n + Faz 8 UX.

### 2.2a Inference mode MJPEG (default) — PASS

**Adim:** `curl -sI http://localhost:5001/mjpeg`

**Beklenen:** 200 OK, `Content-Type: multipart/x-mixed-replace; boundary=frame`.

**Gerceklesen:**
```
HTTP/1.1 200 OK
Content-Type: multipart/x-mixed-replace; boundary=frame
Connection: keep-alive
Server: Python/3.12 aiohttp/3.13.3
```

**Kanit:** `screenshots/02/2.2/2.2a_headers.txt`

**Sonuc:** PASS

### 2.2b Annotation overlay — PASS

**Adim:** 5sn MJPEG capture, JPEG SOF marker decode

**Olcum:**
- 79 frame in 5sn → 15.8 fps server-side
- Frame size: 800-825 KB (4K, anti-aliased annotation overlay var)
- Resolution: **3840x2160** (`SOF` marker decode)

**Sonuc:** PASS — annotation rendering aktif (frame size 4K kabarik, raw 4K MOV degil annotated 4K).

### 2.2c Smooth mode — PASS

**Adim:** `curl http://localhost:5001/mjpeg?mode=smooth`

**Olcum:**
- 96 frame / 5sn = 19.2 fps server-side (inference'tan 21% hizli)
- Frame size: ~813 KB
- Bandwidth: 119 Mbps

**Sonuc:** PASS — smooth mode raw frame teslim ediyor (server-side annotation overhead'siz). Browser-side rAF interpolation `TableFloorLiveView.tsx` icinde yapilir.

### 2.2d Disconnect — PASS-CODE

**Statik kod review:**
- `cameraBackendService.ts:367-393` AbortController + 4sn timeout
- `CameraFeed.tsx:801` `stream.getTracks().forEach(track => track.stop())` cleanup on unmount
- Network DevTools'ta MJPEG fetch `aborted` durumuna gecer (Faz 1 retry'da snapshot kaniti dolayli olarak var)

**Sonuc:** PASS-CODE.

### 2.3a Inference FPS — FAIL

**Adim:** 60sn `/health` poll (her 2sn).

**Olcum:**
| Metrik | Deger |
|--------|-------|
| samples | 30 |
| mean | 17.08 fps |
| median | 16.60 fps |
| p5 (min) | 13.90 fps |
| max | 23.40 fps |
| stdev | 2.41 |

**Hedef:** mean ≥ 22 fps, p5 ≥ 18 fps
**Gercek:** mean **77.6%** of target, p5 **77.2%** of target → **FAIL**

**Kanit:** `screenshots/02/2.3/2.3a_fps_60s.txt`

**Kok sebep:** MozartHigh.MOV **4K kaynak**. Annotation overlay 4K resolution'da render edilip JPEG encode edilince per-frame ~820KB. Encoding overhead + 3 client paralel iletim FPS dusuruyor.

### 2.3b Smooth rAF FPS — PARTIAL

**Adim:** Browser-side rAF olcumu Playwright `page.evaluate` ile yapilabilir, ancak client interpolation behavior MJPEG `<img>` source pace'ine bagli, headless test ortami 60Hz refresh rate garanti etmez. Server-side smooth = 19.2 fps gozlendi.

**Sonuc:** PARTIAL — server tarafi 19.2 fps PASS (inference'dan iyi), client rAF hedefi 60 fps headless'ta gosterilemiyor.

### 2.3c Latency — FAIL

**Adim:** Son 200 MiVOLO log satiri parse → YOLO/Face/MiVOLO ms statistikler

**Olcum:**
| Stage | mean | p50 | p95 | max |
|-------|------|-----|-----|-----|
| YOLO | 41.3ms | 39.0ms | 61ms | 126ms |
| Face | 15.1ms | 15.0ms | 21ms | 26ms |
| MiVOLO | 47.5ms | 45.0ms | 73ms | 100ms |
| **TOTAL** | **103.9ms** | 98.0ms | **148ms** | 193ms |

**Hedef:** total mean < 50ms, p95 < 100ms
**Gercek:** mean **2.08x target**, p95 **1.48x target** → **FAIL**

**Kanit:** `screenshots/02/2.3/2.3c_latency.txt`

**Not:** 3-thread async pipeline sayesinde observed FPS (~17) > 1000/103.9ms = 9.6 fps. Inference paralelizasyon var, ama latency hedefleri yine de asilmis.

### 2.3d Network bandwidth — FAIL

| Mode | Frames/5s | Bytes | Mbps | Avg frame |
|------|-----------|-------|------|-----------|
| Inference | 79 | 64.9 MB | **99.04** | ~821 KB |
| Smooth | 96 | 78.0 MB | **119.13** | ~813 KB |

**Hedef:** 5-15 Mbps (416p icin)
**Gercek:** 99-119 Mbps → **6.6x – 24x hedef ustu** → **FAIL**

**Kanit:** `screenshots/02/2.3/2.3d_bandwidth_summary.txt`

**Kok sebep:** 4K kaynak. **Onerge:** server-side downscale (1080p veya 720p) MJPEG output, OR Settings UI'daki "resolution" parametresini Python prosesine etkili sekilde iletmek (su an pythonBackendManager interface'inde resolution arg yok).

### 2.4a Branch switch timing — PASS-PARTIAL

**Adim:** Playwright `combo.selectOption({label: targetA})` + 3-cycle A↔B↔A.

**Gerceklesen:**
- Cycle 1: A→B switch BAŞARILI, screenshot teyit ediyor (`Faz2 Admin Branch B — Istanbul` selected, dashboard yenilendi, "OFFLINE" camera durumu uygun gosterildi)
- Cycle 1 ikinci selectOption (B→A) test context'i kapatti → `Target page, context or browser has been closed` → 2. switch crash

**Olcum:** Tek-yon switch < 5sn (test framework'un response timeout'u icinde tamamlandi, kesin ms olcumu Playwright trace'inde).

**Kanit:** `screenshots/02/2.4/2.4a_after_switch.png`

**🐛 YAN BULGU (orta):** Hızlı ardisik branch switch'lerinde Playwright context kapaniyor. Production user benzer hizli ardisik switch'te flicker/freeze görebilir. Faz 8 UX'inde `<Suspense>` ya da debounce.

### 2.4d Stres test (5 hizli switch) — PASS

**Adim:** 5 ardisik selectOption (A↔B↔A↔B↔A), 300ms aralık.

**Olcum:**
- 5 switch tamamlandi
- Console error count: **0** (network/fetch hatalari haric)

**Kanit:** Playwright stdout `STRESS_CONSOLE_ERRORS: 0`, stress test PASS (39s total ile ilk test dahil).

### 2.5a-c Reconnect — PASS-CODE / SKIP

**Karar:** Live `taskkill` SKIP-RISKY (memory rule + 3 connected MJPEG client + TRT cache rebuild ~2-5dk).

**Kod review (PASS):**
- `cameraBackendService.ts:367-393`: 4sn timeout, error → synthetic `{status: 'unreachable'}`
- `pythonBackendManager.ts:30`: `HEALTH_POLL_INTERVAL_MS = 10_000` (10sn) + `OFFLINE_THRESHOLD = 3` ardisik fail
- `CameraFeed.tsx:1443`: retry exhaust sonrasi i18n message render
- Socket.IO auto-reconnect (cameraBackendService.ts servisi `Manages connection to the Python backend via Socket.IO`)

**Kanit:** `screenshots/02/2.5/2.5_reconnect_code_review.md`

### 2.6 Python backend not reachable BUG — BUG_CONFIRMED

**Mesaj kaynagi (2.6a):**
- i18n: `frontend/src/i18n/strings.ts:2561` (EN) "Python backend is not reachable" / `:937` (TR) "Python backend erişilemiyor"
- Render lokasyonu: `frontend/src/pages/dashboard/SettingsPage.tsx:506-510`

**Hangi endpoint (2.6b):**
- Frontend `cameraBackendService.ts:367-393` `checkHealth()` → `${VITE_API_URL}/api/python-backend/health` (Node proxy)
- Backend `python-backend.ts:105-129` proxy → `http://localhost:5001/health`
- Python `websocket_server.py:243-261` health_handler

**Tani (2.6c — BUG_CONFIRMED):**
- UI sadece `status === 'ready'` veya `'loading'` kabul eder (whitelist)
- Faz 0 ve Faz 2 oturum baslangicinda `:5001/health` cevabi: `{"service":"MiroFish-Offline Backend","status":"ok"}` — bu shape ne ObservAI ne valid-ready
- 5 dk sonra normalize: `{"status":"ready",...}`
- MiroFish kaynagi PROJEDE YOK (grep + Win-Service tarama)
- Hipotez: cold-boot race veya **eski/baska proje** port 5001'i geçici olarak bağlamış (ya da `__pycache__` icinde stale build var)

**Onerilen fix (Faz 7'de uygulanacak — YAPMA):**
1. Frontend defansif: `streaming === true || status === 'ready' || status === 'ok'` → mavi/yesil
2. Backend proxy validation: shape kontrolü, beklenmeyen response → `{status:'unreachable'}` normalize
3. MiroFish kaynagini bul: `__pycache__` temizle, `Get-Process | Select startTime` race condition reproduksiyon
4. Daha saglam health check: ObservAI server identity için `/health`'e ek HEAD `/mjpeg` Content-Type kontrolü

**Kanit:** `screenshots/02/2.6/2.6_bug_summary.md` + `2.6_final_health.txt`

### 2.7 Resolution & frameSkip — SKIP-COSTLY

Sweep gerek 5+ dk restart maliyeti + canli streaming kesicek. Statik degerlendirme `screenshots/02/2.7/2.7_param_review.md`'de:
- `default_zones.yaml`'da resolution AYRI parametre olarak yok
- `pythonBackendManager.start({source, wsPort, wsHost})` — resolution arg YOK
- Settings UI'da Resolution toggle var ama Python'a iletim yolu belirsiz → BUG SUSPECT (Faz 7)

## FPS Olcum Ozeti

| Mode | Mean | P5/Min | P95/Max | Hedef | Sonuc |
|------|------|--------|---------|-------|-------|
| Inference (server, 60s) | 17.08 fps | 13.90 | 23.40 | mean≥22, p5≥18 | **FAIL** |
| Smooth (server, 5s) | 19.2 fps | — | — | — | INFO |
| Smooth (browser rAF) | — | — | — | ≥55 | PARTIAL (headless ölçemedi) |

| Latency stage | Mean | P95 | Hedef |
|---------------|------|-----|-------|
| YOLO | 41.3 | 61 | — |
| Face | 15.1 | 21 | — |
| MiVOLO | 47.5 | 73 | — |
| **TOTAL** | **103.9** | **148** | <50 / <100 → **FAIL** |

| Bandwidth | Inference | Smooth | Hedef |
|-----------|-----------|--------|-------|
| Mbps | 99.04 | 119.13 | 5–15 → **FAIL** |
| Avg frame | 821 KB | 813 KB | — |

**Kok sebep ortak:** MozartHigh.MOV 3840x2160 (4K). MJPEG output kaynak resolution'la encode ediliyor.

## "Python not reachable" BUG raporu (Faz 1 yan bulgu — bu fazda kesin tani)

- **Sebep:** UI whitelist (`status === 'ready' | 'loading'`) + backend proxy normalize yok. Eger `:5001/health` ObservAI olmayan bir shape donerse (orn. `{status:'ok'}`), UI haksiz kirmizi badge gosterir.
- **Anomali:** Faz 0 ve Faz 2 baslangicinda transient `MiroFish-Offline Backend` cevabi gozlendi. Kaynak ne projede ne Win servisinde. Faz 1 retry'da Settings'teki kirmizi badge'in sebebi muhtemelen bu.
- **Etki:** Yanilticidir — Python aslinda calisirken (`/mjpeg` frame teslim ediyor) UI "not reachable" der.
- **Onerilen fix:** Yukarida 4 madde, Faz 7 Security/Validation kapsaminda uygulanacak.

## Yan Bulgular (kullanici listesine ek)

14. **Branch yokken kamera ekleme silently fail** (UI bug, orta) — admin@observai.com testte ilk basta tum kamera CRUD'lari "Add Source" buton tiklamasi sonrasi cevap vermedi. Sadece "Once bir sube secin" kucuk yazisi var. Kullanici submit'in iptal edildigini gormez. **Onerge:** branch=null iken submit butonunu disabled + tooltip; veya toast `t('camera.add.requireBranch')`.

15. **Pre-flight'ta `MiroFish-Offline Backend` response — KÖK NEDEN BULUNDU** — `:5001/health` ilk birkac dakika MiroFish tanitti. Sonra normalize. **Sebep:** kullanicinin makinasinda `C:\Users\Gaming\MiroFish` ayri proje var (Desktop'ta `MiroFish - Kısayol.lnk` shortcut bu klasoru gosteriyor). MiroFish + ObservAI **ayni port 5001** kullaniyor → port-squatting çakişması. **Onerge:** ObservAI'in `--ws-port`'unu 5101'e cek (config + start-all.bat + frontend env + backend manager tutarli olmali); ya da MiroFish ile ObservAI'i ayni anda calistirmamak operasyonel kural. Etik sinirla MiroFish projesinin icerigine bakilmadi.

16. **2 python.exe ayni cmdline calistiriyor** (PID 31152 venv + PID 40648 system) — sadece biri port 5001 owner. Diger zombie. **Onerge:** `pythonBackendManager.start()`'ta varolan `:5001/health` 200 OK kontrol mevcut (line 53-67) ama ayni anda **ikinci spawn** olusumunu kontrol etmeli; PID file (`logs/python-backend.pid`) eklenebilir.

17. **MozartHigh.MOV 4K kaynak** — Stage 2 calibration "balanced 416 px" varsayar, ama mevcut çalışan source 4K. MJPEG encode 4K → 99 Mbps. **Onerge:** Python tarafinda `--max-output-resolution` flag (default 1080p), VEYA pythonBackendManager.start() options icine `resolution: '720p'` eklenip aiohttp tarafinda annotated frame'i resize.

18. **Resolution / frameSkip Settings UI**'dan Python'a iletim yolu belirsiz — `pythonBackendManager.ts` BackendConfig interface'inde sadece `{source, wsPort, wsHost}`. Settings degişikligi save olur ama Python yeniden baslat olmadan etki etmiyor olabilir. **Faz 7 tahkikat.**

19. **Hizli ardisik branch switch crash** (test ortamı, low-medium severity) — Playwright 2. selectOption call'inde `Target page, context or browser has been closed`. Production'da kullanici 1sn icinde 2x switch yaparsa whitescreen olabilir. **Onerge:** TopNavbar combobox'a debounce 300ms.

## Yeni Test Vakalari (Faz 9 EN dokumana)

- **2.1.NEW-1** — Camera form `branchId=null` validation
  - Adim: Branch silinen / hic yaratilmamis user ile camera-selection'a git, form doldur, submit
  - Beklenen: submit button disabled + i18n toast "Please select a branch first"
  - Risk: orta (UX confusion)

- **2.2.NEW-1** — MJPEG resolution downscaling
  - Adim: 4K source ile `:5001/mjpeg?max-width=720` query
  - Beklenen: 720p resize edilmis frame, bandwidth ~10 Mbps
  - Risk: yuksek (perf)

- **2.4.NEW-1** — Branch switch debounce
  - Adim: 100ms aralikla 5 switch → son state correct olmali, ara state'ler render edilmemeli
  - Beklenen: sadece son hedef branch'in dashboard data'si yuklenir

- **2.6.NEW-1** — Health endpoint identity verification
  - Adim: nc/python ile sahte `:5001/health` server kur, `{service:'OtherProject',status:'ok'}` don
  - Beklenen: Settings badge "Backend identity mismatch" RED + "ObservAI Python backend bekleniyor"

- **2.7.NEW-1** — Resolution param round-trip
  - Adim: Settings → Resolution: 416 → Save → Python proses gercekten 416p ile inference yapiyor mu?
  - Beklenen: log'da `yolo_input_size=416` confirm; FPS dusuk-resolution baseline'a geri donmeli (~25 fps)

- **2.7.NEW-2** — Multi-client MJPEG fairness
  - Adim: 5 client paralel `:5001/mjpeg` cek
  - Beklenen: server FPS 1 client ile yakın olmali (broadcast pattern), per-client FPS sabit
  - Risk: orta (RTX 5070 + 4K = ~4 client max yeterli baseline)

## Kolay Eklenebilecek Ozellikler (EN)

### Feature 1: Stream healthcheck overlay

> "When viewing the live camera feed, an unobtrusive top-right corner pill should display real-time stream health: current FPS, latency average over last 30s, and connection state (connected/reconnecting/offline). Click to expand showing per-stage breakdown (YOLO/Face/MiVOLO ms). Hidden by default; opt-in via Settings → Display → 'Show stream stats'."

### Feature 2: Server-side resolution clamp

> "Settings → Camera & Detection → Stream Quality should accept Low(720p)/Medium(1080p)/Original. The Python backend resizes annotated frames to the chosen resolution before MJPEG encoding, capping bandwidth. Default for >2-camera setups: Low (720p). Updates take effect on next stream start with progress toast 'Restarting analytics with new resolution...'."

### Feature 3: Health-shape validator

> "Backend `/api/python-backend/health` proxy should validate the upstream response shape. If `service` field is missing or doesn't match 'ObservAI'/'observai-camera', return `{status: 'identity_mismatch'}` with a Frontend toast 'Unexpected service on port 5001. Verify only ObservAI Python backend is running.'"

### Feature 4: Hot-reload analytics config

> "Camera & Detection settings (resolution, frameSkip, sensitivity) should propagate to the running Python process via signal/IPC instead of requiring full restart. Add a SIGHUP-style reload handler in `run_with_websocket.py` that reads config/default_zones.yaml on every `kill -HUP <pid>` and applies non-disruptive changes."

## Faz 3 onunde blocker

**Yok.** AI Model Doğruluğu (YOLO + InsightFace/MiVOLO age/gender) Faz 3 kapsamı, mevcut Python proses canli running, log'da MiVOLO inference goruluyor. CLAUDE.md "InsightFace" der ama log "MiVOLO" → Faz 3 baslangicinda dokumantasyon-kod tutarliligi temizlenmeli (Faz 0'da not edildi).

## Cape Town timezone NOT (Faz 2 disinda)

`Asia/Dubai` (UTC+4) — DB'de yanlis. Dogru: `Africa/Johannesburg` (UTC+2). 2 saat sapma → analytics aggregator yanlis saatlere kaydirir. **Faz 4 (analytics) blocker'i degil ama Faz 6 staffing** uzerinde direkt etki. Bu fazda dokunulmadi (kapsam disi).

## Bittiginde

Faz 2 tamam. test-results/02-camera-streaming.md hazir. PASS: 13/20 (65% strict, 76.5% testable-only). FAIL: 3 (FPS, latency, bandwidth — ortak kok 4K kaynak). BUG: 1 (2.6c, "not reachable" yanilticili). SKIP: 4 (3 INFEASIBLE + 1 partial + 2 COSTLY restart). Faz 3 promptunu kullaniciya gonderebilirsiniz.
