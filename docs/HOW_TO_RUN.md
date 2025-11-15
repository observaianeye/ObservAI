# ObservAI - Nasıl Çalıştırılır

Bu kılavuz, ObservAI projesindeki **TÜM özellikleri** nasıl çalıştıracağınızı adım adım gösterir.

## 📋 İçindekiler

1. [Kurulum](#kurulum)
2. [Temel Kamera Analizi](#1-temel-kamera-analizi)
3. [WebSocket ile Real-Time Streaming](#2-websocket-ile-real-time-streaming)
4. [Farklı Kamera Kaynakları](#3-farklı-kamera-kaynakları)
5. [Görsel Overlay ile Çalıştırma](#4-görsel-overlay-ile-çalıştırma)
6. [Zone (Bölge) Analizi](#5-zone-bölge-analizi)
7. [Demografik Analiz](#6-demografik-analiz)
8. [Heatmap Görselleştirme](#7-heatmap-görselleştirme)
9. [Python API Kullanımı](#8-python-api-kullanımı)
10. [Sorun Giderme](#sorun-giderme)

---

## Kurulum

### 1. Python Environment Hazırlama

```bash
# Proje dizinine git
cd ObservAI/packages/camera-analytics

# Virtual environment oluştur
python3 -m venv .venv

# Aktive et
source .venv/bin/activate  # macOS/Linux
# VEYA
.venv\Scripts\activate     # Windows

# Bağımlılıkları yükle
pip install --upgrade pip
pip install -e .
```

### 2. Gerekli Paketleri Kontrol Et

```bash
# Core paketler (zorunlu)
pip install opencv-python ultralytics numpy aiohttp python-socketio

# Demografik analiz için (opsiyonel)
pip install insightface onnxruntime

# YouTube stream için (opsiyonel)
pip install yt-dlp
```

### 3. YOLO Modelini İndir

Model otomatik indirilecek, ama manuel de indirebilirsiniz:

```bash
cd packages/camera-analytics
wget https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt
```

---

## 1. Temel Kamera Analizi

### Özellikler:
- Kişi tespiti (YOLOv8)
- Kişi takibi (ByteTrack)
- Giriş/çıkış sayımı
- Mevcut kişi sayısı
- JSON dosyasına kayıt

### Çalıştırma:

```bash
# Proje kök dizininden

# MacBook kamerası
./scripts/start_camera.sh 0

# iPhone kamerası (Continuity Camera)
./scripts/start_camera.sh 1

# Video dosyası
./scripts/start_camera.sh /path/to/video.mp4
```

### Çıktı:
- Metriklerin kaydedileceği yer: `packages/data/camera/latest_metrics.json`
- Terminal'de gerçek zamanlı istatistikler

---

## 2. WebSocket ile Real-Time Streaming

### Özellikler:
- Web dashboard'a gerçek zamanlı veri gönderimi
- Socket.IO protokolü
- Çoklu istemci desteği
- Anlık metrik güncellemeleri

### Çalıştırma:

```bash
# MacBook kamerası + WebSocket
./scripts/start_camera_websocket.sh 0

# Farklı port kullanmak için
WS_PORT=8080 ./scripts/start_camera_websocket.sh 0

# Farklı host (tüm IP'lerden erişim)
WS_HOST=0.0.0.0 ./scripts/start_camera_websocket.sh 0
```

### WebSocket Bağlantısı:
- **Varsayılan**: `ws://localhost:5001`
- **Port değiştirme**: `WS_PORT` environment variable kullan

### Test Etme:

```bash
# Python istemcisi ile test
cd packages/camera-analytics
python3 << EOF
import socketio

sio = socketio.Client()

@sio.on('metrics_update')
def on_metrics(data):
    print(f"Current people: {data['current']}")
    print(f"Entries: {data['entry_count']}")
    print(f"Exits: {data['exit_count']}")

sio.connect('http://localhost:5001')
sio.wait()
EOF
```

---

## 3. Farklı Kamera Kaynakları

### A. MacBook Webcam

```bash
./scripts/start_camera_websocket.sh 0
```

### B. iPhone (Continuity Camera)

1. iPhone'u Mac'e kablolu veya WiFi ile bağla
2. Continuity Camera'yı aktive et
3. Çalıştır:

```bash
./scripts/start_camera_websocket.sh 1
```

### C. External USB Kamera

```bash
# Kamera indeksini bul
ls /dev/video*  # Linux
system_profiler SPCameraDataType  # macOS

# İndeks ile çalıştır (genelde 2, 3, vb.)
./scripts/start_camera_websocket.sh 2
```

### D. IP Kamera (RTSP)

```bash
./scripts/start_camera_websocket.sh "rtsp://username:password@192.168.1.100:554/stream"
```

### E. YouTube Live Stream

```bash
# yt-dlp yükle (eğer yoksa)
pip install yt-dlp

# YouTube URL ile çalıştır
./scripts/start_camera_websocket.sh "https://www.youtube.com/watch?v=VIDEO_ID"

# Örnek: Tokyo live stream
./scripts/start_camera_websocket.sh "https://www.youtube.com/watch?v=DjdUEyjx8GM"
```

### F. Video Dosyası

```bash
# MP4, AVI, MOV, vb.
./scripts/start_camera_websocket.sh /Users/yourname/Videos/test.mp4
```

---

## 4. Görsel Overlay ile Çalıştırma

### Özellikler:
- Gerçek zamanlı video görüntüsü
- Kişilerin etrafında bounding box
- Track ID gösterimi
- FPS counter

### Çalıştırma:

```bash
# Video penceresi ile
./scripts/start_camera.sh 0 --display

# WebSocket + Video penceresi
./scripts/start_camera_websocket.sh 0 --display
```

### Kontroller:
- **Q**: Çıkış
- **ESC**: Çıkış
- **Space**: Duraklat/Devam

---

## 5. Zone (Bölge) Analizi

### Özellikler:
- Özel bölgelerde kişi sayma
- Giriş çizgisi tanımlama
- Kuyruk analizi
- Masa/alan doluluk oranı

### Konfigürasyon:

`packages/camera-analytics/config/default_zones.yaml` dosyasını düzenle:

```yaml
# Giriş çizgisi
entrance_line:
  start: [0.3, 0.5]  # x, y (0-1 arası normalize)
  end: [0.7, 0.5]
  inside_on: "bottom"  # bottom veya top

# Kuyruk bölgesi
queue_zone:
  id: "queue"
  name: "Kuyruk Alanı"
  polygon:
    - [0.1, 0.3]
    - [0.3, 0.3]
    - [0.3, 0.7]
    - [0.1, 0.7]

# Masalar
tables:
  - id: "table_1"
    name: "Masa 1"
    polygon:
      - [0.5, 0.2]
      - [0.7, 0.2]
      - [0.7, 0.4]
      - [0.5, 0.4]
```

### Zone'ları Görsel Olarak Görmek:

```bash
./scripts/start_camera.sh 0 --display --show-zones
```

Sarı çizgiler ve poligonlar video üzerinde gösterilecek.

---

## 6. Demografik Analiz

### Özellikler:
- Yaş tahmini (0-100)
- Cinsiyet tespiti (Erkek/Kadın)
- Yaş grubu kategorileri:
  - Çocuk: 0-12
  - Genç: 13-17
  - Yetişkin: 18-64
  - Yaşlı: 65+

### Kurulum:

```bash
# InsightFace yükle
pip install insightface onnxruntime

# macOS Apple Silicon için
pip install onnxruntime-silicon
```

### Çalıştırma:

```bash
# Otomatik aktive olur
./scripts/start_camera_websocket.sh 0
```

### Çıktıda Göreceğiniz:

```json
{
  "demographics": {
    "gender": {
      "male": 5,
      "female": 3
    },
    "age_groups": {
      "child": 1,
      "teen": 2,
      "adult": 4,
      "senior": 1
    }
  }
}
```

---

## 7. Heatmap Görselleştirme

### Özellikler:
- Kişilerin en çok bulunduğu alanları gösterir
- Grid tabanlı analiz
- Zaman içinde birikimli

### Python API ile Kullanım:

```python
cd packages/camera-analytics
python3 << EOF
from camera_analytics.analytics import CameraAnalyticsEngine
from camera_analytics.config import AnalyticsConfig
import cv2

# Config
config = AnalyticsConfig()
config.heatmap_enabled = True
config.heatmap_grid_size = 50  # 50x50 grid

# Engine oluştur
engine = CameraAnalyticsEngine(config=config)

# Video kaynağı
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Process
    results = engine.process_frame(frame)

    # Heatmap data al
    heatmap_data = results['heatmap']
    print(f"Hotspot count: {len([x for row in heatmap_data for x in row if x > 10])}")

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
EOF
```

---

## 8. Python API Kullanımı

### Basit Örnek:

```python
from camera_analytics.analytics import CameraAnalyticsEngine
from camera_analytics.config import AnalyticsConfig
import cv2

# Konfigürasyon
config = AnalyticsConfig()
config.model_name = "yolov8n.pt"
config.conf_threshold = 0.3
config.iou_threshold = 0.7

# Engine oluştur
engine = CameraAnalyticsEngine(config=config)

# Video kaynağı
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Frame'i işle
    metrics = engine.process_frame(frame)

    # Metrikleri al
    print(f"Current: {metrics['current']}")
    print(f"Entries: {metrics['entry_count']}")
    print(f"Exits: {metrics['exit_count']}")

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
engine.cleanup()
```

### WebSocket Server ile Kullanım:

```python
from camera_analytics.websocket_server import WebSocketServer
from camera_analytics.analytics import CameraAnalyticsEngine
import asyncio
import cv2

async def main():
    # WebSocket server
    ws_server = WebSocketServer(host="0.0.0.0", port=5001)
    await ws_server.start()

    # Analytics engine
    engine = CameraAnalyticsEngine()
    cap = cv2.VideoCapture(0)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Process
        metrics = engine.process_frame(frame)

        # Broadcast
        await ws_server.broadcast_metrics(metrics)

        await asyncio.sleep(0.033)  # ~30 FPS

    cap.release()
    await ws_server.stop()

asyncio.run(main())
```

---

## 9. Gelişmiş Özellikler

### A. Custom Zone Tanımlama

```python
from camera_analytics.geometry import Zone, Line, Point

# Kuyruk bölgesi
queue_zone = Zone(
    zone_id="queue",
    name="Kuyruk Alanı",
    polygon=[
        Point(100, 200),
        Point(300, 200),
        Point(300, 500),
        Point(100, 500)
    ]
)

# Engine'e ekle
engine.add_zone(queue_zone)
```

### B. Giriş Çizgisi Tanımlama

```python
from camera_analytics.geometry import Line, Point

entrance = Line(
    start=Point(400, 300),
    end=Point(800, 300),
    inside_on="bottom"
)

engine.set_entrance_line(entrance)
```

### C. Event Callback'leri

```python
def on_entry(track_id, timestamp):
    print(f"Person {track_id} entered at {timestamp}")

def on_exit(track_id, timestamp):
    print(f"Person {track_id} exited at {timestamp}")

engine.on_entry = on_entry
engine.on_exit = on_exit
```

---

## 10. Performans Optimizasyonu

### Frame Skip (Daha Hızlı İşleme)

```python
config = AnalyticsConfig()
config.process_every_n_frames = 2  # Her 2 frame'de bir işle
```

### Daha Küçük Model Kullan

```bash
# yolov8n.pt (nano - en hızlı)
# yolov8s.pt (small)
# yolov8m.pt (medium)
```

### Resolution Düşür

```python
config.input_size = (640, 480)  # Varsayılan 1280x720
```

---

## Sorun Giderme

### 1. Kamera Bulunamadı

```bash
# macOS
system_profiler SPCameraDataType

# Linux
ls -l /dev/video*

# Test et
python3 -c "import cv2; cap = cv2.VideoCapture(0); print('OK' if cap.isOpened() else 'FAIL')"
```

### 2. WebSocket Bağlanamıyor

```bash
# Port'un kullanımda olup olmadığını kontrol et
lsof -i :5001

# macOS AirPlay Receiver ile çakışma varsa
WS_PORT=8080 ./scripts/start_camera_websocket.sh 0
```

### 3. InsightFace Hatası

```bash
# Model dosyalarını manuel indir
mkdir -p ~/.insightface/models
cd ~/.insightface/models

# Buffalo_l modelini indir
wget https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip
unzip buffalo_l.zip
```

### 4. Düşük FPS

```bash
# Daha küçük model kullan
# Model conf threshold'u yükselt
# Frame skip aktive et
# Resolution düşür
```

### 5. Memory Leak

```bash
# Heatmap grid size'ı küçült
# Track history'yi sınırla
config.max_track_history = 100  # Varsayılan 1000
```

---

## Özet Komutlar

```bash
# 1. Basit kamera analizi
./scripts/start_camera.sh 0

# 2. WebSocket ile streaming
./scripts/start_camera_websocket.sh 0

# 3. Video görüntüsü ile
./scripts/start_camera.sh 0 --display

# 4. Zone'ları göster
./scripts/start_camera.sh 0 --display --show-zones

# 5. YouTube stream
./scripts/start_camera_websocket.sh "https://youtube.com/watch?v=..."

# 6. Farklı port
WS_PORT=8080 ./scripts/start_camera_websocket.sh 0

# 7. IP kamera
./scripts/start_camera_websocket.sh "rtsp://192.168.1.100:554/stream"
```

---

## Ek Kaynaklar

- [COMPLETE_GUIDE.md](../COMPLETE_GUIDE.md) - Tam dokümantasyon
- [PERFORMANCE_GUIDE.md](../packages/camera-analytics/PERFORMANCE_GUIDE.md) - Performans optimizasyonu
- [CAMERA_SOURCES_GUIDE.md](./CAMERA_SOURCES_GUIDE.md) - Kamera kaynak seçenekleri
- [README.md](../README.md) - Proje özeti

---

**Hazırlayan**: ObservAI Team 12
**Tarih**: Ekim 2025
**Durum**: ✅ Güncel ve test edildi
