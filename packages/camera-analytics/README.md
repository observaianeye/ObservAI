# Camera Analytics Python Backend

## Genel Bakış

Python tabanlı kamera analitik motoru. YOLOv11n ile insan tespiti, MiVOLO ile yaş/cinsiyet analizi yapar. WebSocket (Socket.IO) ile frontend'e gerçek zamanlı veri gönderir.

## Klasör Yapısı

```
camera-analytics/
├── camera_analytics/
│   ├── analytics.py              # Ana engine (YOLOv11n)
│   ├── run_with_websocket.py     # WebSocket server başlatma
│   ├── websocket_server.py       # Socket.IO server
│   ├── age_gender.py             # MiVOLO wrapper
│   ├── sources.py                # Video kaynak yönetimi
│   ├── config.py                 # Konfigürasyon yükleme
│   └── kafka_producer.py         # Kafka producer (opsiyonel)
├── config/
│   ├── default_zones.yaml        # Varsayılan bölgeler
│   └── zones.json                # Kullanıcı tanımlı bölgeler
├── models/                       # AI modelleri
│   ├── yolo11n.pt                # YOLO model
│   └── mivolo_model.pth          # MiVOLO model
└── requirements.txt
```

## Nasıl Çalışır?

### 1. Başlatma - `run_with_websocket.py`

**Komut:**
```bash
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5001
```

**Akış:**
```
1. parse_args() → source, ws-port, config
2. CameraAnalyticsWithWebSocket.__init__()
3. AnalyticsWebSocketServer oluşturulur
4. await runner.start() → WebSocket server başlar
5. Client bağlanınca → start_analytics() çağrılır
6. CameraAnalyticsEngine.run() → Video işleme başlar
```

**Kod Blokları:**
- `main()` - Satır 334-344
- `CameraAnalyticsWithWebSocket.start()` - Satır 66-99
- `start_analytics()` - Satır 100-152

### 2. Video İşleme - `analytics.py`

**YOLOv11n Tespit:**
```python
# Satır 219: Model yükleme
self.model = YOLO('yolo11n.pt')

# Satır 672-683: Frame işleme
results = self.model.track(
    source=frame,
    persist=True,
    classes=[0],  # Sadece person
    tracker="camera_analytics/bytetrack.yaml",
    device=self.device,  # mps/cuda/cpu
    conf=self.conf
)
```

**MiVOLO Yaş/Cinsiyet:**
```python
# Satır 304-309: Estimator hazırlama
self.age_gender_estimator = EstimatorFactory.create_estimator()
self.age_gender_estimator.prepare()

# Satır 1047-1100: Async işleme
if self.frame_count % self.face_detection_interval == 0:
    future = self.demographics_executor.submit(
        self._process_demographics, frame, tracks
    )
```

**Kod Blokları:**
- `CameraAnalyticsEngine.__init__()` - Satır 165-347
- `_run_continuous()` - Satır 540-549
- `_process_result()` - Satır 1046-1200

### 3. WebSocket Server - `websocket_server.py`

**Socket.IO Events:**
```python
# Client → Server
socket.on('start_stream') → start_analytics()
socket.on('stop_stream') → stop_analytics()
socket.on('change_source') → change_source()
socket.on('update_zones') → update_zones()

# Server → Client
socket.emit('global', metrics)  # Analytics
socket.emit('tracks', detections)  # Person tracks
socket.emit('zone_insights', insights)  # Alerts
```

**MJPEG Stream:**
```python
# HTTP endpoint: /mjpeg
# Satır 93-151: MJPEG handler
async def mjpeg_handler(request):
    while True:
        frame = await asyncio.to_thread(self.on_get_frame)
        # JPEG encode
        await response.write(frame_bytes)
```

**Kod Blokları:**
- `AnalyticsWebSocketServer.__init__()` - Satır 25-73
- `_setup_handlers()` - Satır 75-151
- `broadcast_global_stream()` - Analytics yayını

### 4. Zone Yönetimi

**Zone Format:**
```python
# Frontend'den gelen format
{
  "id": "123",
  "name": "Entrance",
  "type": "entrance",
  "x": 0.1, "y": 0.2,
  "width": 0.3, "height": 0.4
}

# Backend'de polygon formatına dönüştürülür
polygon = [
    (x, y),
    (x + width, y),
    (x + width, y + height),
    (x, y + height)
]
```

**Kod Blokları:**
- `update_zones()` - Satır 348-386 (analytics.py)
- `_check_zone_occupancy()` - Zone içinde kişi kontrolü

## AI Modelleri

### YOLOv11n
- **Dosya:** `yolo11n.pt` (otomatik indirilir)
- **Kullanım:** İnsan tespiti ve takibi
- **Çağrı:** `analytics.py` Satır 219, 672
- **Optimizasyon:** Hardware auto-detect (MPS/CUDA/CPU)

### MiVOLO
- **Dosya:** `models/mivolo_model.pth`
- **Kullanım:** Yaş ve cinsiyet tahmini
- **Çağrı:** `age_gender.py` Satır 102-112
- **Wrapper:** `MiVOLOEstimator` class

### OpenCV
- **Kullanım:** Video capture, frame işleme
- **Çağrı:** `sources.py` - VideoSource classes
- **Backend:** AVFoundation (macOS), DirectShow (Windows), V4L2 (Linux)

## Çalıştırma

```bash
cd packages/camera-analytics
source venv/bin/activate
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5001
```

## Video Kaynakları

**Webcam:**
```bash
--source 0  # MacBook kamerası
--source 1  # iPhone (Continuity Camera)
```

**RTSP Stream:**
```bash
--source rtsp://192.168.1.100:554/stream
```

**YouTube Live:**
```bash
--source https://www.youtube.com/watch?v=...
```

**Video Dosyası:**
```bash
--source /path/to/video.mp4
```

## Konfigürasyon

**default_zones.yaml:**
```yaml
entrance_line:
  start: [0.05, 0.95]
  end: [0.95, 0.95]

tables:
  - id: entrance_zone
    name: Entrance
    polygon: [[0.05, 0.05], [0.30, 0.05], ...]
```

**zones.json:**
- Frontend'den güncellenir
- WebSocket event: `update_zones`
