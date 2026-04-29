# CLAUDE.md

ObservAI - Cafe/restoran icin gercek zamanli kamera analitik platformu. Ziyaretci sayimi, demografi (yas/cinsiyet), bolge takibi. Dil: Turkce.

> **ROADMAP:** Gelistirme yol haritasi ve gorev takibi icin `ROADMAP.md` dosyasini oku. Her oturum basinda ROADMAP'i kontrol et ve uzerinde calistigin adimi `IN PROGRESS` olarak guncelle.

## Git Calisma Akisi (Ekip icin)

- **Ana repo:** https://github.com/observaianeye/ObservAI
- Her gelistirici **kendi ismiyle** bir branch'te calisir
- Bir adimi bitirince degisiklikleri `main`'e merge eder
- `main` branch her zaman calisan, kararlı (stable) kodun oldugu yerdir

### Branch Isimleri
| Kisi | Branch |
|------|--------|
| Emre Partal | `partal` |
| (Diger ekip uyeleri kendi isimlerini eklesin) |  |

### Gunluk Calisma Akisi
```bash
# 1. Kendi branch'ine gec ve main'den guncellemeleri al
git checkout <ismin>
git pull origin main

# 2. Calis, commit et, push et
git add <dosyalar>
git commit -m "aciklama"
git push origin <ismin>

# 3. Adim tamamlaninca: main'e merge et
git checkout main
git pull origin main
git merge <ismin>
git push origin main

# 4. Kendi branch'ine geri don ve devam et
git checkout <ismin>
git pull origin main
```

### CI/CD
- Push ve PR'larda GitHub Actions otomatik calisir (`.github/workflows/ci.yml`)
- Frontend: `pnpm typecheck` + `pnpm build`
- Backend: `prisma generate` + `npm run build`

## Servisler

| Servis | Port | Teknoloji |
|--------|------|-----------|
| Frontend | 5173 | React 18 + Vite + TypeScript |
| Backend API | 3001 | Express + Prisma + TypeScript |
| Python Analytics | 5001 | YOLO11L (kisi) + InsightFace (yuz tespiti) + MiVOLO (yas/cinsiyet) + WebSocket |
| Ollama AI | 11434 | Yerel LLM (qwen3:14b primary / llama3.1:8b fallback) |

## Baslatma / Durdurma (Windows)

```bash
start-all.bat          # Tum servisleri baslat (frontend + backend + camera-ai + prisma)
stop-all.bat           # Tum servisleri durdur
start-backend.bat      # Sadece camera analytics backend
start-frontend.bat     # Sadece frontend dev server
```

## Gelistirme Komutlari

```bash
# Frontend (frontend/)
pnpm install && pnpm dev        # :5173
pnpm build && pnpm typecheck    # Build + tip kontrolu

# Backend (backend/)
npm install && npm run dev      # :3001
npm run db:generate             # Prisma client olustur
npm run db:migrate              # Migration calistir
npm run db:studio               # Prisma Studio GUI

# Python Analytics (packages/camera-analytics/)
pip install -e ".[demographics]"
pip install tensorrt-cu12                       # TensorRT (NVIDIA GPU gerekli)
python -m camera_analytics.run_with_websocket --model yolo11l.pt
# NOT: Ilk calistirmada TensorRT engine derlenir (~2-5 dk). Sonraki baslatmalarda cache'ten yukler.
```

## Mimari

### Veri Akisi
Kamera/YouTube → YOLO11L kisi tespiti → InsightFace yuz tespiti → MiVOLO yas/cinsiyet → BoT-SORT takip → Bolge gecis tespiti → WebSocket → Frontend dashboard + SQLite

### 3-Thread Async Pipeline
```
Capture Thread → raw_frame_q(30) → Inference Thread (YOLO + InsightFace face det + MiVOLO age/gender) → result_q(10) → Main Thread (render + emit)
```

### Frontend Onemli Dosyalar
- `components/camera/CameraFeed.tsx` — Ana canli video (~1400 satir), MJPEG + WebSocket
- `components/camera/ZoneCanvas.tsx` — Bolge cizim: rect + polygon + freehand (framer-motion animasyonlu, ESC iptal, Enter/double-click/right-click tamamla)
- `components/camera/ZonePolygonUtils.ts` — Ramer-Douglas-Peucker simplify + ray-casting + bbox
- `components/staffing/{StaffForm,StaffList,ShiftCalendar,NotificationStatusBadge}.tsx` — Personel CRUD + haftalik vardiya takvimi + Email bildirim durumu (Telegram pasifize edildi — Yan #58, Faz 9)
- `components/settings/BranchSection.tsx` — Sube CRUD + OSM Nominatim geocoding + Google Maps baglantisi
- `components/dashboard/WeatherWidget.tsx` — Sube koordinatina bagli Open-Meteo widget, 10 dk localStorage cache
- `services/cameraBackendService.ts` — WebSocket client, health polling
- `contexts/AuthContext.tsx` — JWT auth (accountType: TRIAL/PAID/DEMO, demoLogin)
- `contexts/DataModeContext.tsx` — Demo/Live (default: live, demo kullanici icin kilitli)
- `contexts/DashboardFilterContext.tsx` — Branch/sube secimi ve tarih araligi filtreleme

### Backend Onemli Dosyalar
- `src/index.ts` — Express giris noktasi
- `src/routes/` — REST: auth, analytics, cameras, zones, ai (Ollama/Gemini), export, python-backend, branches, insights, notifications, staffing, staff, staff-assignments, tables
- `scripts/backfill-analytics-summary.ts` — 30 gun realistic synthetic AnalyticsSummary (npm run seed:history)
- `src/lib/pythonBackendManager.ts` — Python process yonetimi (model: yolo11l.pt) + health monitor (ADIM 17)
- `src/middleware/roleCheck.ts` — RBAC (ADMIN, MANAGER, ANALYST, VIEWER)
- `prisma/schema.prisma` — DB semasi (SQLite dev: `file:./dev.db`) + ChatMessage + AnalyticsSummary

#### Bildirim Servisleri (ADIM 4)
> **Yan #58 (Faz 9):** Telegram product karari ile kaldirildi. `telegramService.ts` dosyasi repo'dan silindi; `notificationDispatcher` **email-only**. `Staff.telegramChatId` schema alani Faz 10'da migration ile drop edilebilir (su an legacy NULL kolonu).
- `src/services/emailService.ts` — Nodemailer + HTML template, gunluk ozet + kritik alert (TEK aktif kanal)
- `src/services/notificationDispatcher.ts` — Severity bazli dispatch (CRITICAL/HIGH/MEDIUM/LOW), email-only

#### Staff & Table Tracking (ADIM 5)
- `src/routes/staffing.ts` — Vardiya bazli personel plani, peak saat + demografi verisine dayali. **Yan #60 (Faz 9):** `POST /api/staffing/summary` (Ollama brifi 30sn throttle) Faz 6 prompt beklentisinde vardı ama implement edilmedi; staffing su an SADECE algorithmic `/recommendations` (10 musteri/staff target, 7-23 saat grid) + `/current` + `/history` doner. AI brifi tables.ts'de mevcut (`POST /api/tables/ai-summary`); staffing'e benzer endpoint ister: Faz 10 backlog.
- `src/routes/staff.ts` — Staff CRUD (Prisma Staff modeli: firstName, lastName, email, phone, role; `telegramChatId` legacy alan, dispatch'te kullanilmaz — Yan #58)
- `src/routes/staff-assignments.ts` — StaffAssignment CRUD + POST /:id/notify + GET /:id/accept|decline (JWT token'li public link)
- `src/routes/tables.ts` — POST /ai-summary (Ollama brifi 30sn throttle), GET /:cameraId (zone+status), PATCH /:zoneId/status (manuel temizleme override → Python pipeline)
- `src/services/notificationDispatcher.ts` — `notifyStaffShift(assignmentId)` email-only dispatch (Yan #58 sonrasi Telegram pasif), audit log `backend/logs/notification-dispatch.log`
- TABLE zone tipi (analytics.py) — v2 state machine: occupied (>= 60sn) → empty buffer (2 dk user kurali) → needs_cleaning → auto_empty (15 dk), transit_grace 10sn (sandalye kaymasi)

#### AI Config + Data Integrity (ADIM 11, 16, 17)
- `src/lib/aiConfig.ts` — TEK kaynakta Ollama + Gemini listeler (routes/ai.ts ve services/insightEngine.ts ayni listeyi kullanir)
- `src/lib/analyticsValidator.ts` — Payload range/freshness check, invalid → log + drop
- `src/services/analyticsAggregator.ts` — node-cron saatlik + gunluk AnalyticsSummary upsert

### Python Analytics Onemli Dosyalar
- `analytics.py` — Ana motor (~2200 satir): TrackedPerson, temporal smoothing, zone, heatmap, privacy blur
- `run_with_websocket.py` — Bootstrap, WebSocket event handler, model preload
- `config.py` — AnalyticsConfig dataclass, YAML yukleme, 40+ parametre
- `age_gender.py` — Dual: InsightFace buffalo_l (face detection only, CUDA EP) + MiVOLO `MiVOLOEstimator` (yas/cinsiyet, Torch CUDA, mivolo_repo clone)
- `sources.py` — Video kaynak: webcam, YouTube/yt-dlp, RTSP, dosya
- `optimize.py` — Donanim tespiti (CUDA FP16 / CPU fallback)
- `metrics.py` — CameraMetrics dataclass, JSON serialization (numpy-safe)
- `overlay_viz.py` — Gorsel overlay rendering
- `websocket_server.py` — aiohttp + socketio server, /health, /mjpeg

### Konfigürasyon
- `config/default_zones.yaml` — Tum YOLO ve demografi parametreleri
- `camera_analytics/botsort.yaml` — BoT-SORT tracker ayarlari (with_reid: True)

## Ortam Degiskenleri

`.env.example` dosyalarini kopyala (root, backend/, frontend/).
- `AI_PROVIDER=ollama` — AI saglayici (ollama veya gemini)
- `OLLAMA_URL=http://localhost:11434` — Ollama API endpoint
- `OLLAMA_MODEL=llama3.1:8b` — Tercih edilen Ollama modeli
- `GEMINI_API_KEY` — Gemini fallback icin (opsiyonel)
- `DATABASE_URL` — Prisma (default: SQLite)
- `VITE_BACKEND_URL=http://localhost:5001` — Python analytics
- `VITE_API_URL=http://localhost:3001` — Node backend

## Donanim

- **GPU**: NVIDIA RTX 5070 (12GB VRAM, CUDA 13.2)
- **YOLO11L**: yolo11l.engine (TensorRT FP16, ~50MB person detection) — `yolo11l.pt`'den otomatik derlenir
- **InsightFace**: buffalo_l (CUDA EP / TensorRT EP FP16, **detection-only** kullanim — genderage modulu yuklu ama age_gender.py:343 yorumuna gore aktif kullanilmiyor; MiVOLO yas/cinsiyet tek otorite)
- **MiVOLO**: `mivolo_d1` (Torch CUDA, multi-input VOLO age/gender; `packages/camera-analytics/mivolo_repo/` clone — submodule degil, timm monkey patch sebebiyle)
- **TensorRT**: 10.16 — YOLO + InsightFace icin FP16 hizlandirilmis inference

### TensorRT Kurulumu (Ekip icin — Herkes Yapmalı)

NVIDIA GPU olan herkesin bilgisayarinda kurulmali. TensorRT, YOLO ve InsightFace inference'ini ~2-3x hizlandirir.

```bash
# 1. Venv'e TensorRT kur
cd packages/camera-analytics
pip install tensorrt-cu12

# 2. Ilk calistirmada engine'ler otomatik derlenir (~2-5 dk)
#    YOLO: yolo11l.pt → yolo11l.engine (Ultralytics export)
#    InsightFace: ONNX → TRT engine (onnxruntime TensorRT EP, cache: trt_engine_cache/)
python -m camera_analytics.run_with_websocket --source 1 --model yolo11l.pt

# 3. Sonraki baslatmalarda cache'ten yuklenir (anlik baslatma)
```

**Gereksinimler:**
- NVIDIA GPU (RTX 3000+ onerilen)
- NVIDIA Driver >= 550+
- Python 3.10-3.12
- onnxruntime-gpu >= 1.19 (zaten demographics dependency'de)

**Sorun giderme:**
- TensorRT yoksa otomatik fallback: CUDA EP → CPU EP (performans duşer ama calisir)
- `trt_engine_cache/` silip yeniden baslatmak engine'leri yeniden derler
- `yolo11l.engine` silmek YOLO engine'i yeniden derler
- Farkli GPU'da derlenmiş engine calismaz, silip yeniden derleyin

## Onemli Teknik Detaylar

### Demografi Pipeline
1. InsightFace full-frame **face detection** (her frame'de, RTX 5070 ile 960x960 det_size). genderage modulu yuklu ama `_allowed = ['detection', 'genderage']` kullanim sadece detection — age/gender icin sonuc atilir.
2. Yuz → YOLO kisi bbox eslestirme (proportional tolerance)
3. Eslesmeyenler icin crop-based fallback (max 3 crop, CLAHE low-light enhancement)
4. **MiVOLO** ile yas/cinsiyet: AYRI age/gender confidence — age=lenient pose penalty (default 0.85, yaw/150), gender=hysteresis band (0.35 lower / 0.65 upper, yaw>70 reject). InsightFace genderage kullanilmaz (age_gender.py:343 yorumu: "we use MiVOLO for age/gender, InsightFace only for detection").
5. Temporal smoothing: Age=EMA+weighted_median (stability dampening), Gender=decay-weighted voting + lock
6. Gender lock: 8 ardisik ayni cinsiyet oyu sonrasi cinsiyet kilitlenir (flip-flop engelleme)
7. Age lock: 30 sample + stability >= 0.95 olunca yas kilitlenir (frame-to-frame snap onler)
8. Demographics persistence cache: track drop → save → re-entry restore (120s pencere)
9. Belirsiz bolgedeki (0.35-0.65) gender skorlari None gecer — zorla M/F atamasi yok

### Konfigürasyon Parametreleri (default_zones.yaml — Stage 2-4 calibrated)
```yaml
yolo_input_size: 640           # YOLO giris boyutu
face_detection_interval: 2     # Stage 2: 3 → 2 (inference ceiling 18-20 → 23-26 FPS)
demo_age_ema_alpha: 0.20       # Stage 3: 0.25 → 0.20
demo_min_confidence: 0.35      # Stage 3: 0.40 → 0.35 (uzak yuzlerden daha fazla sinyal)
demo_gender_consensus: 0.70    # Stage 3: 0.80 → 0.70 (stuck gender fix)
demo_gender_lower_band: 0.35
demo_gender_upper_band: 0.65
demo_temporal_decay: 0.90      # Stage 3: 0.92 → 0.90
demo_gender_lock_threshold: 6  # Stage 3: 8 → 6 (hizli lock)
demo_age_lock_stability: 0.92  # Stage 3: 0.95 → 0.92 (lock gerçekten devreye girsin)
demo_age_lock_min_samples: 20  # Stage 3: 30 → 20
demo_pose_max_yaw: 70.0
confidence_threshold: 0.5
queue_alert_threshold: 5
zone_enter_debounce_frames: 5  # Stage 4: 3 → 5
zone_exit_debounce_frames: 10  # Stage 4: 5 → 10
zone_grace_period_s: 3.0       # Stage 4: YENI occlusion grace (seated occupant ghost-exit fix)
table_max_capacity: 6          # Stage 4: YENI overcount clamp (user belirtti)
bbox_smoothing_alpha_min: 0.2
bbox_smoothing_alpha_max: 0.9
```

```yaml
# botsort.yaml (Stage 4 calibrated)
track_high_thresh: 0.60        # Stage 4: 0.50 → 0.60 (false track azaltir)
new_track_thresh: 0.70         # Stage 4: 0.60 → 0.70 (yeni ID olusturmayi zorlastirir)
match_thresh: 0.65             # Stage 4: 0.75 → 0.65 (permissive IoU, ID swap azaltir)
track_buffer: 150              # Stage 4: 90 → 150 (3sn → 5sn occlusion tolere)
appearance_thresh: 0.50        # Stage 4: 0.35 → 0.50 (guclu re-ID)
```

### Display/Inference Decoupling (Stage 2 / ADIM 14)
MJPEG endpoint iki mod destekler:
- `GET /mjpeg?mode=inference` (default) — annotated frame stream, ~25 FPS
- `GET /mjpeg?mode=smooth` — raw frame + interpolated bbox overlay, 60 FPS

Default mod `OBSERVAI_MJPEG_MODE` env degiskeni ile degistirilir. Smooth mod `TrackedPerson.bbox_samples: deque(maxlen=2)` son 2 sample arasi linear extrapolation yapar; 200 ms inference gap'te freeze, 100 ms'den fazla extrapolate etmez (teleportation onler). Kullanim: `frontend/src/components/tables/TableFloorLiveView.tsx` smooth mode ile `<img>` tag uzerinden baglanir.

### JSON Serialization
Numpy float32/int64 degerleri `json.dump()` ile uyumsuz. `metrics.py` icinde `_to_native()` ve `analytics.py` icinde `_NumpyEncoder` ile cozuldu.

### Bbox Smoothing
Adaptive EMA ile YOLO bbox koordinatlarinda jitter engellenir:
- Kucuk yer degisiklik (jitter <1.5%): alpha=0.2 (agir smoothing)
- Orta hareket (1.5-5%): interpolated alpha (0.2-0.9 arasi)
- Buyuk yer degisiklik (>5%): alpha=0.9 (hafif smoothing)
- Ani ziplayis (>15% frame): alpha=1.0 (direkt kabul)

### Zone Hysteresis
Zone giris/cikis flip-flop engelleme:
- Giris: 3 ardisik frame icinde olmali
- Cikis: 5 ardisik frame disinda olmali

### Queue Zone
Queue zone tipi (amber renk) kafe/restoran icin kuyruk takibi saglar:
- Anlik kuyruk uzunlugu, ortalama bekleme suresi
- Configurable alert threshold (varsayilan: 5 kisi)
- Zone tipleri: entrance (mavi), exit (kirmizi), queue (amber)

### Zone Overlap Prevention
Zone'lar ic ice giremez. Frontend'te cizim sirasinda overlap tespiti yapilir.
Backend'te server-side validation ile guvenlik agi saglanir.

### AI Entegrasyonu (Ollama + Gemini fallback)
- Tek kaynakta yonetilir: `backend/src/lib/aiConfig.ts` — `routes/ai.ts` ve `services/insightEngine.ts` ayni listeyi kullanir
- Varsayilan saglayici: Ollama (local, http://localhost:11434)
- Ollama oncelik: qwen3:14b → qwen3 → llama3.3:latest → llama3.3 → llama3.2:latest → llama3.2 → qwen2.5:7b → qwen2.5 → llama3.1:8b → llama3:8b → gemma2 → mistral → phi3 → qwen2
- `OLLAMA_MODEL` env ile override
- `OLLAMA_TIMEOUT_MS` (default 60000) — AbortController ile istek zaman asimi
- Gemini candidates (fallback): gemini-2.5-flash → gemini-2.0-flash-001 → gemini-2.0-flash-lite
- `isGeminiFallbackError()` quota/429/404/resource_exhausted hatalarinda otomatik model degistirir
- Iki dil destegi: TR/EN (kullanici dilinde yanit verir)
- Hava durumu: Branch koordinatlarina gore Open-Meteo API

### Auth Akisi
- Register: 14 gun TRIAL hesap olusturur, otomatik login
- Demo: `/demo` route ile DEMO hesap (VIEWER rolu, 2 saat session)
- Demo kullanici Live mode'a gecemez (kilitli)
- accountType: TRIAL | PAID | DEMO

### Branch/Sube Yonetimi
- Her kullanicinin bir veya daha fazla subesi olabilir
- Sube koordinatlari hava durumu API'sine beslenir
- TopNavbar'da sube secici, Settings'te CRUD

### ONNX Runtime Thread Safety
InsightFace ONNX session'lari olusturuldugu thread'de kullanilmali. Inference thread'inde `prepare()` ile yeniden baslatiyor.

## Test Altyapisi (ADIM 13)

Her sonraki degisikligi olculebilir yapmak icin uc kanal test:

### Python (packages/camera-analytics)
- **pytest** + pytest-benchmark + pytest-timeout
- Markers: `@pytest.mark.gpu` (CI GPU'suz runner'da atlar), `@pytest.mark.slow`
- Fixtures: `tests/fixtures/mozart_cafe_{1,2}_short.mp4`, `ground_truth.json`, InsightFace t1-t4 sample'lari — **ASPIRATIONAL (Yan #21):** Bu fixture'lar Faz 3 raporundan beri planlandi ama henuz infrastrukture commit edilmedi (kaynak video + ground truth annotation mevcut degil). Faz 10 backlog'unda. Su an pytest dosyalari `@pytest.mark.skip` veya manuel "fixture missing" check ile atliyor; CI gercekte bu spec'leri kosturmuyor.
- Harness: `python -m camera_analytics.run --benchmark-mode --duration-s 30` → JSON rapor
- Metrikler: `fps_mean`, `fps_p95`, `id_churn_rate`, `zone_count_delta`, gender F1, age MAE
- Calistirma: `cd packages/camera-analytics && pytest -v`

### Backend (Node)
- **vitest** + supertest + coverage-v8
- Test DB: `file:./test.db` (izole, seed helper var)
- Kapsam: auth + session + ai-chat-history + ai-config + analytics-validator + analytics-aggregator + tables-ai-summary
- Calistirma: `cd backend && npm test` (41 test)

### Frontend E2E
- **@playwright/test** chromium headless
- Kapsam: auth-persistence (rememberMe browser restart), camera-mjpeg (smooth mode FPS overlay), tables-live-view (tab toggle)
- Calistirma: `cd frontend && pnpm test:e2e`

### CI (.github/workflows/ci.yml)
- Python: `pytest -m "not gpu"`
- Backend: `npm test`
- Frontend: `pnpm test:e2e` (chromium headless)

## Kod Kurallari

- **TypeScript**: strict mode, `any` yok
- **Python**: async/await, analytics engine'e sync fonksiyon ekleme
- **State**: React Context API (Redux/Zustand yok)
- **Styling**: TailwindCSS 3.4
- **Paket**: pnpm (frontend), npm (backend), pip (Python)

## Bilinen Sorunlar / Operasyonel Kurallar

### Yan #20 — MiroFish Docker collision (port 5001)
ObservAI Python analytics 5001'i kullanir. Geliştiricilerin bazilari ayni
makinede MiroFish (eski projedir, ayni port) calistirabilir. **Iki proje
ayni anda calismaz** — biri 5001'i tutar, oturucusu olmayan EADDRINUSE
hatasi ile boot'a basarsiz olur. Operasyonel kural:

```bash
# ObservAI'yi calistirmadan once 5001 bos olmali
netstat -ano | findstr ":5001"     # Windows
# Eger MiroFish container calisiyorsa onu durdur:
docker stop $(docker ps -q --filter "publish=5001")
# Veya MiroFish dev server'i kapat
```

`start-all.bat` boot oncesi `:5001 LISTEN` varsa "Port 5001 already in use"
uyarisi verip duruyor (Faz 9'da eklendi); MiroFish'e dair ozel mesaj yok,
sebep manuel kontrol gerek.

## Proje Yapisi

```
ObservAI/
├── frontend/              # React + Vite + TypeScript
├── backend/               # Express + Prisma + TypeScript
├── packages/
│   └── camera-analytics/  # Python YOLO + InsightFace
│       ├── camera_analytics/  # Ana Python modulu
│       ├── config/            # default_zones.yaml
│       ├── yolo11l.pt         # YOLO model (tek model)
│       └── venv/              # Python sanal ortam
├── scripts/               # health_check.py
├── logs/                  # Calisma zamani loglari
├── start-all.bat          # Tum servisleri baslat
├── stop-all.bat           # Tum servisleri durdur
├── start-backend.bat      # Sadece Python backend
├── start-frontend.bat     # Sadece frontend
└── CLAUDE.md              # Bu dosya
```
