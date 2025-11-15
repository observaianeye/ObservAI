# ObservAI - Hızlı Başlangıç Referansı

## 🚀 Hızlı Komutlar

### 1️⃣ Kurulum (İlk Kez)

```bash
cd ObservAI/packages/camera-analytics
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

### 2️⃣ Çalıştırma Komutları

| Özellik | Komut |
|---------|-------|
| **Basit Kamera** | `./scripts/start_camera.sh 0` |
| **WebSocket Streaming** | `./scripts/start_camera_websocket.sh 0` |
| **Görsel ile** | `./scripts/start_camera.sh 0 --display` |
| **Zone Gösterimi** | `./scripts/start_camera.sh 0 --display --show-zones` |
| **iPhone Kamera** | `./scripts/start_camera_websocket.sh 1` |
| **YouTube Stream** | `./scripts/start_camera_websocket.sh "YOUTUBE_URL"` |
| **Video Dosyası** | `./scripts/start_camera_websocket.sh /path/to/video.mp4` |

### 3️⃣ Kamera Kaynakları

- `0` = MacBook webcam
- `1` = iPhone (Continuity Camera)
- `2+` = External USB kameralar
- `"rtsp://..."` = IP kamera
- `"https://youtube.com/..."` = YouTube live
- `"/path/to/video.mp4"` = Video dosyası

### 4️⃣ Environment Variables

```bash
# Port değiştir (varsayılan 5001)
WS_PORT=8080 ./scripts/start_camera_websocket.sh 0

# Host değiştir (varsayılan 0.0.0.0)
WS_HOST=127.0.0.1 ./scripts/start_camera_websocket.sh 0
```

## 🎯 10 Ana Özellik

### 1. Kişi Tespiti ve Takibi
- **Ne yapıyor**: YOLOv8 ile kişi tespit eder, ByteTrack ile takip eder
- **Komut**: `./scripts/start_camera.sh 0`
- **Çıktı**: JSON metrikleri

### 2. WebSocket Real-Time Streaming
- **Ne yapıyor**: Web dashboard'a canlı veri gönderir
- **Komut**: `./scripts/start_camera_websocket.sh 0`
- **Bağlantı**: `ws://localhost:5001`

### 3. Çoklu Kamera Desteği
- **Ne yapıyor**: MacBook, iPhone, IP, YouTube destekler
- **Komut**: `./scripts/start_camera_websocket.sh [SOURCE]`

### 4. Görsel Overlay
- **Ne yapıyor**: Video üzerinde bounding box gösterir
- **Komut**: `./scripts/start_camera.sh 0 --display`
- **Kontrol**: Q=çıkış, Space=duraklat

### 5. Zone (Bölge) Analizi
- **Ne yapıyor**: Özel bölgelerde kişi sayar
- **Config**: `packages/camera-analytics/config/default_zones.yaml`
- **Komut**: `./scripts/start_camera.sh 0 --show-zones`

### 6. Giriş/Çıkış Sayımı
- **Ne yapıyor**: Entrance line ile içeri/dışarı sayar
- **Otomatik**: Tüm modlarda aktif
- **Metrik**: `entry_count`, `exit_count`, `current`

### 7. Demografik Analiz
- **Ne yapıyor**: Yaş ve cinsiyet tahmini
- **Kurulum**: `pip install insightface onnxruntime`
- **Otomatik**: InsightFace varsa aktif olur

### 8. Heatmap
- **Ne yapıyor**: En yoğun alanları gösterir
- **Grid**: 50x50 varsayılan
- **API**: `engine.get_heatmap()`

### 9. Dwell Time
- **Ne yapıyor**: Kişilerin ne kadar kaldığını ölçer
- **Metrik**: `average_dwell_time`
- **Birim**: Saniye

### 10. Queue Detection
- **Ne yapıyor**: Kuyruk alanında kaç kişi var sayar
- **Config**: `queue_zone` tanımla
- **Alert**: Eşik değeri aşınca bildirim

## 📊 Metrik Çıktısı

```json
{
  "current": 8,
  "entry_count": 42,
  "exit_count": 34,
  "queue_count": 3,
  "average_dwell_time": 125.5,
  "demographics": {
    "gender": {"male": 5, "female": 3},
    "age_groups": {
      "child": 1,
      "teen": 2,
      "adult": 4,
      "senior": 1
    }
  },
  "heatmap": [[0, 5, 12, ...], ...],
  "zones": {
    "table_1": {"count": 4, "occupancy": 0.8}
  }
}
```

## 🐍 Python API Örneği

```python
from camera_analytics.analytics import CameraAnalyticsEngine
import cv2

# Engine oluştur
engine = CameraAnalyticsEngine()

# Video aç
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # İşle
    metrics = engine.process_frame(frame)

    # Kullan
    print(f"Current: {metrics['current']}")

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
```

## 🔧 Konfigürasyon

### Zone Tanımlama (`config/default_zones.yaml`):

```yaml
entrance_line:
  start: [0.3, 0.5]  # Normalize koordinatlar (0-1)
  end: [0.7, 0.5]
  inside_on: "bottom"

queue_zone:
  id: "queue"
  name: "Kuyruk"
  polygon:
    - [0.1, 0.3]
    - [0.3, 0.3]
    - [0.3, 0.7]
    - [0.1, 0.7]

tables:
  - id: "table_1"
    name: "Masa 1"
    polygon:
      - [0.5, 0.2]
      - [0.7, 0.2]
      - [0.7, 0.4]
      - [0.5, 0.4]
```

## 🛠️ Sorun Giderme

### Port Çakışması (macOS AirPlay)
```bash
WS_PORT=8080 ./scripts/start_camera_websocket.sh 0
```

### Kamera Bulunamıyor
```bash
# Kamerayı kontrol et
system_profiler SPCameraDataType  # macOS
ls -l /dev/video*  # Linux
```

### InsightFace Hatası
```bash
# Manuel model indir
mkdir -p ~/.insightface/models
# Buffalo_l modelini indir ve .insightface/models/ içine koy
```

### Düşük FPS
```bash
# Daha küçük model kullan: yolov8n.pt
# Frame skip: config.process_every_n_frames = 2
# Resolution düşür: config.input_size = (640, 480)
```

## 📁 Önemli Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `docs/HOW_TO_RUN.md` | **Detaylı kılavuz** |
| `COMPLETE_GUIDE.md` | Tam dokümantasyon |
| `packages/camera-analytics/config/default_zones.yaml` | Zone config |
| `packages/data/camera/latest_metrics.json` | Metrik çıktısı |
| `scripts/start_camera.sh` | Basit başlatma |
| `scripts/start_camera_websocket.sh` | WebSocket ile başlatma |

## 🌐 WebSocket Client Örneği

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5001');

socket.on('connect', () => {
  console.log('Connected to ObservAI');
});

socket.on('metrics_update', (data) => {
  console.log('Current people:', data.current);
  console.log('Entries:', data.entry_count);
  console.log('Exits:', data.exit_count);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
```

## 📖 Ek Kaynaklar

- **Detaylı Kılavuz**: [docs/HOW_TO_RUN.md](docs/HOW_TO_RUN.md)
- **Performans**: [packages/camera-analytics/PERFORMANCE_GUIDE.md](packages/camera-analytics/PERFORMANCE_GUIDE.md)
- **Kamera Kaynakları**: [docs/CAMERA_SOURCES_GUIDE.md](docs/CAMERA_SOURCES_GUIDE.md)
- **Proje Özeti**: [README.md](README.md)

---

**🎓 Bilkent University CTIS 411 - Team 12**
