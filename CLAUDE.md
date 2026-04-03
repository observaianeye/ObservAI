# CLAUDE.md

ObservAI - Cafe/restoran icin gercek zamanli kamera analitik platformu. Ziyaretci sayimi, demografi (yas/cinsiyet), bolge takibi. Dil: Turkce.

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
python -m camera_analytics.run_with_websocket --model yolo11l.pt
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
- `contexts/AuthContext.tsx` — JWT auth; `DataModeContext.tsx` — Demo/Live

### Backend Onemli Dosyalar
- `src/index.ts` — Express giris noktasi
- `src/routes/` — REST: auth, analytics, cameras, zones, ai (Gemini), export, python-backend (proxy)
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
- `GEMINI_API_KEY` — AI Q&A icin
- `DATABASE_URL` — Prisma (default: SQLite)
- `VITE_BACKEND_URL=http://localhost:5001` — Python analytics
- `VITE_API_URL=http://localhost:3001` — Node backend

## Donanim

- **GPU**: NVIDIA RTX 5070 (12GB VRAM, CUDA)
- **Model**: yolo11l.pt (50MB, FP16 inference)
- **InsightFace**: buffalo_l (CUDA EP, genderage + detection + recognition)
- **TensorRT**: Kurulu degil — PyTorch CUDA + ONNX Runtime CUDA kullaniliyor

## Onemli Teknik Detaylar

### Demografi Pipeline
1. InsightFace full-frame face detection (her `face_detection_interval` frame'de)
2. Yuz → YOLO kisi bbox eslestirme (proportional tolerance)
3. Eslesmeyenler icin crop-based fallback (max 3 crop)
4. Quality-based confidence: face_size * pose_factor * det_score
5. Temporal smoothing: Age=EMA+weighted_median, Gender=decay-weighted voting
6. Demographics persistence cache: track drop → save → re-entry restore

### Konfigürasyon Parametreleri (default_zones.yaml)
```yaml
yolo_input_size: 640          # YOLO giris boyutu
face_detection_interval: 3    # Her N frame'de InsightFace calistir
demo_age_ema_alpha: 0.25      # Yas EMA smoothing (yuksek=hizli yakinlasma)
demo_min_confidence: 0.30     # Min yuz tespit guven esigi
demo_gender_consensus: 0.60   # Cinsiyet oylama esigi
demo_temporal_decay: 0.90     # Eski oylar icin azalma carpani
confidence_threshold: 0.5     # YOLO kisi tespit esigi
```

### JSON Serialization
Numpy float32/int64 degerleri `json.dump()` ile uyumsuz. `metrics.py` icinde `_to_native()` ve `analytics.py` icinde `_NumpyEncoder` ile cozuldu.

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
