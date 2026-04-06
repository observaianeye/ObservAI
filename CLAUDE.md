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
| Python Analytics | 5001 | YOLO11L + InsightFace + WebSocket |

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
Kamera/YouTube → YOLO11L kisi tespiti → InsightFace yas/cinsiyet → BoT-SORT takip → Bolge gecis tespiti → WebSocket → Frontend dashboard + SQLite

### 3-Thread Async Pipeline
```
Capture Thread → raw_frame_q(30) → Inference Thread (YOLO + InsightFace) → result_q(10) → Main Thread (render + emit)
```

### Frontend Onemli Dosyalar
- `components/camera/CameraFeed.tsx` — Ana canli video (~1400 satir), MJPEG + WebSocket
- `components/camera/ZoneCanvas.tsx` — Bolge cizim (normalize koordinat)
- `services/cameraBackendService.ts` — WebSocket client, health polling
- `contexts/AuthContext.tsx` — JWT auth (accountType: TRIAL/PAID/DEMO, demoLogin)
- `contexts/DataModeContext.tsx` — Demo/Live (default: live, demo kullanici icin kilitli)
- `contexts/DashboardFilterContext.tsx` — Branch/sube secimi ve tarih araligi filtreleme

### Backend Onemli Dosyalar
- `src/index.ts` — Express giris noktasi
- `src/routes/` — REST: auth, analytics, cameras, zones, ai (Ollama/Gemini), export, python-backend, branches, insights
- `src/lib/pythonBackendManager.ts` — Python process yonetimi (model: yolo11l.pt)
- `src/middleware/roleCheck.ts` — RBAC (ADMIN, MANAGER, ANALYST, VIEWER)
- `prisma/schema.prisma` — DB semasi (SQLite dev: `file:./dev.db`)

### Python Analytics Onemli Dosyalar
- `analytics.py` — Ana motor (~2200 satir): TrackedPerson, temporal smoothing, zone, heatmap, privacy blur
- `run_with_websocket.py` — Bootstrap, WebSocket event handler, model preload
- `config.py` — AnalyticsConfig dataclass, YAML yukleme, 40+ parametre
- `age_gender.py` — InsightFace buffalo_l wrapper (CUDA EP)
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
- **Model**: yolo11l.engine (TensorRT FP16, ~50MB) — `yolo11l.pt`'den otomatik derlenir
- **InsightFace**: buffalo_l (TensorRT EP FP16, genderage + detection + recognition)
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
1. InsightFace full-frame face detection (her frame'de, RTX 5070 ile 960x960 det_size)
2. Yuz → YOLO kisi bbox eslestirme (proportional tolerance)
3. Eslesmeyenler icin crop-based fallback (max 3 crop, CLAHE low-light enhancement)
4. AYRI age/gender confidence: age=lenient pose penalty, gender=strict (yaw>55 reject)
5. Temporal smoothing: Age=EMA+weighted_median (stability dampening), Gender=decay-weighted voting + lock
6. Gender lock: 8 ardisik ayni cinsiyet oyu sonrasi cinsiyet kilitlenir (flip-flop engelleme)
7. Demographics persistence cache: track drop → save → re-entry restore (120s pencere)

### Konfigürasyon Parametreleri (default_zones.yaml)
```yaml
yolo_input_size: 640          # YOLO giris boyutu
face_detection_interval: 1    # Her frame'de InsightFace calistir (RTX 5070)
demo_age_ema_alpha: 0.15      # Yas EMA smoothing (dusuk=daha stabil)
demo_min_confidence: 0.40     # Min yuz tespit guven esigi (yuksek=temiz tahmin)
demo_gender_consensus: 0.70   # Cinsiyet oylama esigi (yuksek=flip-flop engelleme)
demo_temporal_decay: 0.85     # Eski oylar icin azalma carpani
demo_gender_lock_threshold: 8 # Cinsiyet kilitleme icin ardisik oy sayisi
confidence_threshold: 0.5     # YOLO kisi tespit esigi
queue_alert_threshold: 5      # Queue zone alert kisi esigi
zone_enter_debounce_frames: 3 # Zone girisi icin ardisik frame sayisi
zone_exit_debounce_frames: 5  # Zone cikisi icin ardisik frame sayisi
bbox_smoothing_alpha_min: 0.2 # Bbox EMA min (jitter icin agir smoothing)
bbox_smoothing_alpha_max: 0.9 # Bbox EMA max (gercek hareket icin hafif smoothing)
```

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

### AI Entegrasyonu (Ollama)
- Varsayilan AI saglayici: Ollama (local, http://localhost:11434)
- Model oncelik sirasi: llama3.1:8b > llama3:8b > mistral > phi3
- Gemini fallback: GEMINI_API_KEY varsa otomatik fallback
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

## Kod Kurallari

- **TypeScript**: strict mode, `any` yok
- **Python**: async/await, analytics engine'e sync fonksiyon ekleme
- **State**: React Context API (Redux/Zustand yok)
- **Styling**: TailwindCSS 3.4
- **Paket**: pnpm (frontend), npm (backend), pip (Python)

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
