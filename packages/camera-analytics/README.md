# Camera Analytics - Python Kamera İşleme Backend'i

Bu klasör, ObservAI platformunun kamera görüntü işleme ve analitik motorunu içerir.

## İçerik

Bu klasörde şunlar bulunur:
- **Python 3.9+** ile yazılmış gerçek zamanlı görüntü işleme
- **YOLO v8** ile insan tespiti
- **InsightFace** ile yaş/cinsiyet tahmini
- **WebSocket** sunucusu ile canlı görüntü aktarımı
- JSON formatında metrik çıktısı

## Özellikler

Bu Python paketi şu analitik özellikleri sağlar:

### 1. **Ziyaretçi Sayma**
- Giriş/çıkış takibi
- Anlık mekan doluluk oranı
- Tanımlı bölgeler üzerinden sayım

### 2. **Demografik Analiz**
- Yaş kategorisi tahmini (çocuk, genç, yetişkin, yaşlı)
- Cinsiyet dağılımı
- Gerçek zamanlı istatistikler

### 3. **Kuyruk Tespiti**
- Bekleme süresi tahmini
- Kuyruk uzunluğu analizi
- Yoğunluk haritası

### 4. **Isı Haritası (Heatmap)**
- Mekandaki sıcak noktalar
- Ziyaretçi hareketleri
- Yoğunluk analizi

### 5. **Bölge Analizi**
- Masa/alan bazlı bekleme süresi
- Bölge doluluk oranı
- Özel alan tanımlama

## Klasör Yapısı

```
packages/camera-analytics/
├── camera_analytics/          # Ana Python paketi
│   ├── __init__.py
│   ├── run.py                # CLI ana dosyası
│   ├── run_with_websocket.py # WebSocket sunuculu versiyon
│   ├── websocket_server.py   # WebSocket sunucu kodu
│   ├── detector.py           # YOLO insan tespiti
│   ├── demographics.py       # Yaş/cinsiyet tahmini
│   ├── tracker.py            # Multi-object tracking
│   ├── zone_manager.py       # Bölge yönetimi
│   └── metrics.py            # Metrik hesaplamaları
├── config/
│   └── default_zones.yaml    # Varsayılan bölge tanımları
├── models/                   # AI modelleri (ilk çalıştırmada indirilir)
├── .venv/                    # Python virtual environment
├── setup.py                  # Paket kurulum dosyası
└── requirements.txt          # Python bağımlılıkları
```

## Kullanılan Teknolojiler

- **Python 3.9+** - Programlama dili
- **OpenCV** - Görüntü işleme
- **YOLO v8** - Nesne tespiti (Ultralytics)
- **InsightFace** - Yüz analizi
- **WebSocket** - Gerçek zamanlı iletişim
- **NumPy** - Sayısal hesaplamalar
- **PyYAML** - Konfigürasyon yönetimi

## Kurulum ve Çalıştırma

### 1. Virtual Environment Oluştur

```bash
cd packages/camera-analytics
python3 -m venv .venv
source .venv/bin/activate  # Linux/macOS
# veya
.venv\Scripts\activate     # Windows
```

### 2. Bağımlılıkları Yükle

```bash
pip install --upgrade pip
pip install -e .
```

Bu komut şunları yapar:
- Tüm gerekli Python paketlerini kurar
- YOLOv8 ve InsightFace modellerini indirir
- Paketi editable modda kurar

### 3. Temel Kullanım (CLI)

```bash
# Webcam'den görüntü al (indeks 0)
python -m camera_analytics.run --source 0 --display

# Video dosyasından işle
python -m camera_analytics.run --source video.mp4 --display

# Metrikleri dosyaya kaydet
python -m camera_analytics.run \
  --source 0 \
  --output ../../data/camera/latest_metrics.json \
  --display
```

### 4. WebSocket Sunucu Modu

Frontend ile entegrasyon için:

```bash
python -m camera_analytics.run_with_websocket \
  --source 0 \
  --ws-host 0.0.0.0 \
  --ws-port 5000
```

Bu mod:
- WebSocket sunucusu başlatır (port 5000)
- Her frame'i JPEG olarak encode eder
- Frontend'e base64 formatında gönderir
- Gerçek zamanlı metrikler sağlar

## Komut Satırı Parametreleri

### run.py

```bash
python -m camera_analytics.run --help

Parametreler:
  --source        Kamera kaynağı (0, 1, ... veya video.mp4)
  --output        Metrik çıktı dosyası (JSON)
  --display       Canlı görüntü penceresi göster
  --zones         Özel bölge konfigürasyon dosyası (YAML)
  --fps           Hedef FPS (varsayılan: 30)
```

### run_with_websocket.py

```bash
python -m camera_analytics.run_with_websocket --help

Parametreler:
  --source        Kamera kaynağı
  --ws-host       WebSocket host (varsayılan: 0.0.0.0)
  --ws-port       WebSocket port (varsayılan: 5000)
  --display       Debug için görüntü penceresi
```

## Bölge Konfigürasyonu

`config/default_zones.yaml` dosyasını düzenleyerek bölgeleri özelleştirin:

```yaml
zones:
  - name: "Entrance"
    type: "entrance"
    coordinates:
      - [0.1, 0.1]  # Sol üst (x, y) normalize koordinatlar (0-1)
      - [0.4, 0.1]  # Sağ üst
      - [0.4, 0.3]  # Sağ alt
      - [0.1, 0.3]  # Sol alt

  - name: "Exit"
    type: "exit"
    coordinates:
      - [0.6, 0.7]
      - [0.9, 0.7]
      - [0.9, 0.9]
      - [0.6, 0.9]
```

**Not:** Koordinatlar normalize edilmiştir (0-1 arası), böylece farklı çözünürlüklerde çalışır.

## Çıktı Formatı (JSON)

```json
{
  "timestamp": "2024-11-27T10:30:00",
  "peopleIn": 15,
  "peopleOut": 8,
  "currentCount": 7,
  "demographics": {
    "gender": {
      "male": 4,
      "female": 3
    },
    "ages": {
      "child": 1,
      "young": 2,
      "adult": 3,
      "senior": 1
    }
  },
  "heatmap": [...],
  "zones": {
    "entrance": {
      "count": 15,
      "avgDwellTime": 2.5
    }
  }
}
```

## API ile Entegrasyon

Backend API'ye veri göndermek için:

```python
import requests
import json

# Metrikleri oku
with open('../../data/camera/latest_metrics.json') as f:
    metrics = json.load(f)

# API'ye gönder
response = requests.post(
    'http://localhost:3001/api/analytics',
    json={
        'cameraId': 'your-camera-id',
        'peopleIn': metrics['peopleIn'],
        'peopleOut': metrics['peopleOut'],
        'currentCount': metrics['currentCount'],
        'demographics': metrics['demographics']
    }
)
```

## Performans Optimizasyonu

### CPU Kullanımı
- YOLOv8n (nano) modeli kullanılır - hızlı ve hafif
- İsteğe bağlı frame skipping
- Configurable FPS limiti

### GPU Desteği
CUDA destekli GPU varsa:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

### Headless Mod
Sunucuda çalıştırırken `--display` parametresini kaldırın.

## Sorun Giderme

### Kamera Açılmıyor

```bash
# Mevcut kameraları listele (Linux)
v4l2-ctl --list-devices

# Farklı indeks dene
python -m camera_analytics.run --source 1 --display
```

### Model İndirme Hatası

```bash
# Manuel model indirme
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```

### Düşük FPS

- Frame boyutunu küçült
- YOLO güven eşiğini artır
- Frame skipping etkinleştir

### WebSocket Bağlantı Hatası

```bash
# Port kullanımda mı kontrol et
lsof -i :5000

# Farklı port kullan
python -m camera_analytics.run_with_websocket --ws-port 5001
```

## Sistem Gereksinimleri

### Minimum
- Python 3.9+
- 4 GB RAM
- CPU: 2 çekirdek
- Webcam veya video dosyası

### Önerilen
- Python 3.11
- 8 GB RAM
- GPU: NVIDIA (CUDA 11.8+)
- 1080p webcam

## Notlar

- İlk çalıştırmada AI modelleri indirilir (~200 MB)
- CPU'da çalışır, GPU opsiyoneldir
- Gerçek zamanlı işleme için en az 15 FPS hedeflenir
- Normalize koordinatlar sayesinde resolution-agnostic çalışır
