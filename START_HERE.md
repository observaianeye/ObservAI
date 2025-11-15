# 🚀 ObservAI - BAŞLANGIÇ KILAVUZU

## ⚡ HIZLI BAŞLANGIÇ (2 Dakika)

### 1️⃣ Kurulum

```bash
cd /Users/partalle/Projects/ObservAI

# Otomatik kurulum scripti çalıştır
./setup_environment.sh
```

### 2️⃣ Kamera Analitiğini Başlat

```bash
# Terminal 1: Kamera analytics
cd packages/camera-analytics
source .venv/bin/activate
./../../scripts/start_camera.sh 0
```

## 📋 MEVCUT ÖZELLIKLER

ObservAI şu anda **SADECE kamera analytics backend**'ini içerir. Web frontend kaldırıldı.

### ✅ Çalışan Özellikler:

1. **Kişi Tespiti**: YOLOv8 ile gerçek zamanlı
2. **Kişi Takibi**: ByteTrack algoritması
3. **Giriş/Çıkış Sayımı**: Otomatik entrance line ile
4. **Zone Analizi**: Özel bölgeler tanımlama
5. **Heatmap**: Yoğunluk haritası
6. **WebSocket Streaming**: Gerçek zamanlı veri yayını
7. **JSON Çıktısı**: Metriklerin kaydedilmesi
8. **Çoklu Kamera Desteği**: MacBook, iPhone, IP, YouTube
9. **Demografik Analiz**: Yaş/cinsiyet (opsiyonel)
10. **Video Dosyası İşleme**: MP4, AVI, MOV

### ❌ Olmayan Özellikler:

- Web Dashboard (frontend removed)
- REST API sunucusu (apps/api removed)
- `pnpm dev` komutları (Node.js projesi yok)

## 🎯 NASIL KULLANILIR?

### A. MacBook Kamera

```bash
cd /Users/partalle/Projects/ObservAI
./scripts/start_camera.sh 0
```

### B. Video Dosyası

```bash
./scripts/start_camera.sh "/path/to/video.mp4"
```

### C. YouTube Live

```bash
./scripts/start_camera.sh "https://youtube.com/watch?v=VIDEO_ID"
```

### D. IP Kamera

```bash
./scripts/start_camera.sh "rtsp://admin:pass@192.168.1.100:554/stream"
```

### E. WebSocket ile Streaming

```bash
# Port 5001'de WebSocket server başlar
./scripts/start_camera_websocket.sh 0

# Farklı port
WS_PORT=8080 ./scripts/start_camera_websocket.sh 0
```

## 📊 ÇIKTI DOSYASI

Tüm metrikler burada kaydedilir:
```
/Users/partalle/Projects/ObservAI/packages/data/camera/latest_metrics.json
```

JSON yapısı:
```json
{
  "current": 5,
  "entry_count": 42,
  "exit_count": 37,
  "queue_count": 2,
  "average_dwell_time": 180.5,
  "heatmap": [[...], ...],
  "demographics": {...}
}
```

## 🔧 YAŞANAN SORUNLAR VE ÇÖZÜMLER

### ❌ SORUN 1: Python 3.14 Çok Yeni

**Hata:**
```
ERROR: Package 'camera-analytics' requires a different Python: 3.14.0 not in '<3.14,>=3.9'
```

**ÇÖZÜM:** Python 3.11 kullanın

```bash
# Mevcut venv sil
cd packages/camera-analytics
rm -rf .venv

# Python 3.11 ile yeniden oluştur
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e .
```

### ❌ SORUN 2: Script Bulunamıyor

**Hata:**
```
zsh: no such file or directory: ./scripts/start_camera.sh
```

**ÇÖZÜM:** Proje kök dizininden çalıştırın

```bash
# Yanlış (packages/camera-analytics içinde)
cd packages/camera-analytics
./scripts/start_camera.sh 0  # ❌ Bulamaz

# Doğru (proje root'undan)
cd /Users/partalle/Projects/ObservAI
./scripts/start_camera.sh 0  # ✅ Çalışır
```

### ❌ SORUN 3: Web Frontend Yok

**Hata:**
```
pnpm dev
# Command not found veya package.json yok
```

**ÇÖZÜM:** Web frontend kaldırıldı. Sadece kamera analytics çalışıyor.

Eğer dashboard istiyorsanız:
1. Kendi web projenizi oluşturun
2. WebSocket'e bağlanın: `ws://localhost:5001`
3. `metrics_update` event'ini dinleyin

## 📁 PROJE YAPISI

```
ObservAI/
├── packages/
│   ├── camera-analytics/      ← Python backend (AKTIF)
│   │   ├── .venv/             ← Virtual environment
│   │   ├── camera_analytics/  ← Kod
│   │   └── config/            ← Zone configs
│   └── data/                  ← Çıktılar
│       └── camera/
│           └── latest_metrics.json
├── scripts/                   ← Başlatma scriptleri
│   ├── start_camera.sh
│   └── start_camera_websocket.sh
├── docs/                      ← Dokümantasyon
├── setup_environment.sh       ← Kurulum scripti
└── START_HERE.md             ← Bu dosya
```

## 🔬 TEST KOMUTALARI

```bash
# 1. Import testi
cd packages/camera-analytics
source .venv/bin/activate
python3 -c "from camera_analytics.analytics import CameraAnalyticsEngine; print('OK')"

# 2. Kamera testi
python3 -c "import cv2; cap = cv2.VideoCapture(0); print('OK' if cap.isOpened() else 'FAIL')"

# 3. JSON çıktısını izle
watch -n 1 'cat packages/data/camera/latest_metrics.json | jq ".current"'

# 4. WebSocket test (başka terminal)
# Start server: ./scripts/start_camera_websocket.sh 0
# Then test:
python3 << 'EOF'
import socketio
sio = socketio.Client()
@sio.on('metrics_update')
def on_metrics(data):
    print(f"People: {data['current']}")
sio.connect('http://localhost:5001')
sio.wait()
EOF
```

## ⚙️ AYARLAR

### Zone (Bölge) Tanımlama

`packages/camera-analytics/config/default_zones.yaml` dosyasını düzenleyin:

```yaml
entrance_line:
  start: [0.3, 0.5]
  end: [0.7, 0.5]
  inside_on: "bottom"

queue_zone:
  id: "queue"
  polygon:
    - [0.1, 0.3]
    - [0.3, 0.3]
    - [0.3, 0.7]
    - [0.1, 0.7]
```

### Demografik Analiz Aktifleştirme

```bash
source packages/camera-analytics/.venv/bin/activate
pip install insightface onnxruntime

# Otomatik çalışacak
./scripts/start_camera.sh 0
```

## 📖 EK DOKÜMANTASYON

- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Tüm komutlar
- **[docs/HOW_TO_RUN.md](docs/HOW_TO_RUN.md)** - Detaylı kılavuz
- **[packages/camera-analytics/README.md](packages/camera-analytics/README.md)** - Python API

## 🎓 ÖZET

1. **Proje durumu**: Sadece Python kamera analytics çalışıyor
2. **Python sürümü**: 3.11 kullanın (3.14 desteklenmiyor)
3. **Scriptler**: Proje root'undan (`/Users/partalle/Projects/ObservAI`) çalıştırın
4. **Web frontend**: Yok - kendiniz oluşturmalısınız
5. **Çıktı**: JSON dosyası (`packages/data/camera/latest_metrics.json`)
6. **WebSocket**: Port 5001'de yayın yapar

## ✅ KONTROL LİSTESİ

- [ ] Python 3.11 kurulu
- [ ] Virtual environment oluşturuldu (`.venv`)
- [ ] Paketler yüklendi (`pip install -e .`)
- [ ] Scripts çalıştırılabilir (`chmod +x scripts/*.sh`)
- [ ] Kamera izinleri verildi (macOS Settings)
- [ ] Doğru dizinden çalıştırıyorum (project root)

---

**Hazır mısınız? Şimdi başlayın:**

```bash
cd /Users/partalle/Projects/ObservAI
./setup_environment.sh
./scripts/start_camera.sh 0
```

🎉 **Başarılar!**
