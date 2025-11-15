# 📸 ObservAI Kamera Analytics - Kapsamlı Kurulum ve Kullanım Rehberi

> **Hoş Geldiniz!** Bu rehber, ObservAI kamera analitik sistemini sıfırdan kurmanıza ve **her türlü kamera kaynağını** (MacBook, iPhone, USB kamera, video dosyası, YouTube/Twitch canlı yayını, IP kamera) sisteme bağlamanıza yardımcı olacak.

---

## 📋 İçindekiler

1. [Sistem Gereksinimleri](#1-sistem-gereksinimleri)
2. [İlk Kurulum - Adım Adım](#2-ilk-kurulum---adım-adım)
3. [Kamera Kaynakları - Detaylı Kılavuz](#3-kamera-kaynakları---detaylı-kılavuz)
   - [3.1 MacBook/USB Kamera](#31-macbookusb-kamera)
   - [3.2 iPhone (Continuity Camera)](#32-iphone-continuity-camera)
   - [3.3 Video Dosyası (.mp4, .avi, .mov)](#33-video-dosyası-mp4-avi-mov)
   - [3.4 YouTube Canlı Yayını](#34-youtube-canlı-yayını)
   - [3.5 Twitch Canlı Yayını](#35-twitch-canlı-yayını)
   - [3.6 IP/CCTV Kamera (RTSP/HTTP)](#36-ipcctv-kamera-rtsphttp)
   - [3.7 Uzak Sunucu Kamerası](#37-uzak-sunucu-kamerası)
4. [Konfigürasyon Özelleştirme](#4-konfigürasyon-özelleştirme)
5. [API Entegrasyonu ve Test](#5-api-entegrasyonu-ve-test)
6. [Uyarı ve Bildirim Sistemi](#6-uyarı-ve-bildirim-sistemi)
7. [İleri Seviye Özelleştirmeler](#7-i̇leri-seviye-özelleştirmeler)
8. [Sorun Giderme](#8-sorun-giderme)

---

## 1. 🖥️ Sistem Gereksinimleri

### Donanım
- **İşlemci:** Intel/Apple Silicon Mac (M1/M2/M3 önerilen)
- **RAM:** Minimum 8GB (16GB önerilen)
- **Disk:** En az 5GB boş alan

### Yazılım
- **macOS:** 12.0 (Monterey) veya üzeri
- **Python:** 3.11 (önerilen) veya 3.9+
- **Node.js:** 18.x veya 20.x
- **pnpm:** 8.x veya üzeri

### Gerekli Araçlar
```bash
# Homebrew kurulu değilse
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Gerekli araçları yükle
brew install python@3.11 node pnpm jq ffmpeg yt-dlp
```

---

## 2. 🚀 İlk Kurulum - Adım Adım

Bu bölümde **3 terminal penceresi** kullanacağız. Her terminali ayrı ayrı açın ve aşağıdaki adımları takip edin.

### 📍 Terminal 1: Backend API Sunucusu

```bash
# Adım 1: Proje klasörüne git
cd ~/Desktop/ObservAI/observai

# Adım 2: Node bağımlılıklarını yükle
pnpm install

# Adım 3: .env dosyasını oluştur
cp .env.example .env

# Adım 4: .env dosyasını düzenle (gerekirse)
# nano .env veya VSCode ile açabilirsiniz

# Adım 5: Backend API'yi başlat
pnpm dev

# ✅ Beklenen Çıktı:
# [Nest] INFO  [NestFactory] Starting Nest application...
# [Nest] INFO  API listening on http://localhost:3333
```

> **Not:** Bu terminal açık kalmalı. API servisi çalışır durumda olmalı.

---

### 📍 Terminal 2: Python Kamera Analytics Ortamı

```bash
# Adım 1: Kamera analytics klasörüne git
cd ~/Desktop/ObservAI/observai/packages/camera-analytics

# Adım 2: Python sanal ortamı oluştur
python3.11 -m venv .venv

# Adım 3: Sanal ortamı aktifleştir
source .venv/bin/activate

# ✅ Terminal prompt'unuzun başında (.venv) görmelisiniz

# Adım 4: pip'i güncelle
python -m pip install --upgrade pip

# Adım 5: Ana paket ve bağımlılıkları yükle
python -m pip install -e .

# Bu adım YOLO, OpenCV, NumPy vb. tüm bağımlılıkları yükler
# Yaklaşık 2-5 dakika sürebilir

# Adım 6: Ek araçları yükle
python -m pip install pandas matplotlib tqdm jupyterlab yt-dlp streamlink

# Adım 7: Apple Silicon için onnxruntime yükle (M1/M2/M3 için)
python -m pip install onnxruntime-silicon==1.16.3

# Intel Mac kullanıyorsanız:
# python -m pip install onnxruntime

# Adım 8: Veri klasörünü oluştur
mkdir -p ../../data/camera

# ✅ Kurulum tamamlandı! Şimdi kamera kaynağını bağlayabilirsiniz.
```

> **Not:** Bu terminal de açık kalmalı. Buradan kamera analitiğini çalıştıracağız.

---

### 📍 Terminal 3: Test ve Yardımcı Komutlar

Bu terminali geçici testler, kamera indeks taraması ve API testleri için kullanacağız.

```bash
# Bu terminal ihtiyaç olduğunda kullanılacak
# Şimdilik açık tutabilirsiniz
```

---

## 3. 📹 Kamera Kaynakları - Detaylı Kılavuz

### 3.1 MacBook/USB Kamera

#### Adım 1: Kamera İzinlerini Kontrol Edin

```
🍎 macOS Ayarları
  └─ Gizlilik ve Güvenlik
      └─ Kamera
          └─ Terminal.app ✓ (İzin verildi)
```

#### Adım 2: Kamera İndeksini Bulun

**Terminal 3'te çalıştırın:**

```bash
python3 - <<'PY'
import cv2
print("📷 Kamera cihazları taranıyor...\n")
for idx in range(6):
    cap = cv2.VideoCapture(idx)
    ok, _ = cap.read()
    cap.release()
    status = "✅ Kullanılabilir" if ok else "❌ Kullanılamaz"
    if ok:
        print(f"İndeks {idx}: {status} 👈 BU KAMERAYI KULLANABİLİRSİNİZ")
    else:
        print(f"İndeks {idx}: {status}")
print("\n✅ Tarama tamamlandı!")
PY
```

**Örnek Çıktı:**
```
📷 Kamera cihazları taranıyor...

İndeks 0: ✅ Kullanılabilir 👈 BU KAMERAYI KULLANABİLİRSİNİZ
İndeks 1: ❌ Kullanılamaz
İndeks 2: ✅ Kullanılabilir 👈 BU KAMERAYI KULLANABİLİRSİNİZ
İndeks 3: ❌ Kullanılamaz
İndeks 4: ❌ Kullanılamaz
İndeks 5: ❌ Kullanılamaz

✅ Tarama tamamlandı!
```

#### Adım 3: Kamera Analitiğini Başlatın

**Terminal 2'de çalıştırın:**

```bash
# Sanal ortamın aktif olduğundan emin olun
# Terminal başında (.venv) yazıyor olmalı

# MacBook kamerası (genellikle indeks 0)
python -m camera_analytics.run \
  --source 0 \
  --output ../../data/camera/latest_metrics.json \
  --display

# USB kamera (örneğin indeks 2)
python -m camera_analytics.run \
  --source 2 \
  --output ../../data/camera/latest_metrics.json \
  --display
```

**Parametreler:**
- `--source 0`: Kamera indeksi (yukarıdaki taramada bulduğunuz değer)
- `--output`: JSON çıktısının kaydedileceği yer
- `--display`: Canlı görüntü penceresini göster

**Durdurmak için:** Pencereye tıklayıp `Q` tuşuna basın veya `Ctrl+C`

---

### 3.2 iPhone (Continuity Camera)

#### Ön Koşullar
- iPhone ve Mac aynı Apple ID'de oturum açmış olmalı
- Her ikisinde de Wi-Fi ve Bluetooth açık olmalı
- iPhone iOS 16+ ve Mac macOS Ventura+ olmalı

#### Adım 1: Continuity Camera'yı Etkinleştirin

1. Mac'inizde bir uygulama açın (örn. FaceTime veya Photo Booth)
2. Kamera menüsünden iPhone'unuzu seçin
3. iPhone kamerayı otomatik olarak aktifleştirecek

#### Adım 2: Kamera İndeksini Bulun

**Terminal 3'te çalıştırın:**

```bash
python3 - <<'PY'
import cv2
print("📱 iPhone dahil tüm kameralar taranıyor...\n")
for idx in range(10):
    cap = cv2.VideoCapture(idx)
    ok, _ = cap.read()
    if ok:
        print(f"İndeks {idx}: ✅ Kullanılabilir")
    cap.release()
PY
```

#### Adım 3: iPhone Kamerasıyla Başlatın

**Terminal 2'de çalıştırın:**

```bash
# iPhone'un bulunduğu indeksi kullanın (örn. 1)
python -m camera_analytics.run \
  --source 1 \
  --output ../../data/camera/latest_metrics.json \
  --display
```

#### Alternatif: IP Kamera Uygulamaları

Eğer Continuity Camera çalışmazsa, aşağıdaki uygulamaları kullanabilirsiniz:

**EpocCam:**
```bash
# EpocCam uygulamasını iPhone'a yükleyin
# Uygulamadan verilen IP adresini kullanın

python -m camera_analytics.run \
  --source "http://192.168.1.100:8080/video" \
  --output ../../data/camera/latest_metrics.json \
  --display
```

**Iriun Webcam:**
```bash
# Iriun'u yükleyin ve Mac driver'ı kurun
# Sonra normal kamera indeksi olarak kullanabilirsiniz

python -m camera_analytics.run \
  --source 0 \
  --output ../../data/camera/latest_metrics.json \
  --display
```

---

### 3.3 Video Dosyası (.mp4, .avi, .mov)

Video dosyalarını test amaçlı kullanabilir veya kaydedilmiş kamera görüntülerini analiz edebilirsiniz.

#### Adım 1: Video Dosyasını Hazırlayın

```bash
# Video dosyasının yolunu bulun
ls ~/Downloads/*.mp4
ls ~/Desktop/*.mov

# Örnek:
# /Users/partalle/Downloads/cafe_footage.mp4
```

#### Adım 2: Video Analitiğini Çalıştırın

**Terminal 2'de çalıştırın:**

```bash
# Tam dosya yolu ile
python -m camera_analytics.run \
  --source "/Users/partalle/Downloads/cafe_footage.mp4" \
  --output ../../data/camera/latest_metrics.json \
  --display

# Veya göreceli yol ile
python -m camera_analytics.run \
  --source "../../test_videos/sample.mp4" \
  --output ../../data/camera/latest_metrics.json \
  --display
```

> **Not:** Video bittiğinde analiz otomatik olarak durur. Döngü halinde çalıştırmak için `--loop` parametresi ekleyin (eklenmesi gerekirse).

#### Adım 3: Sonuçları Kontrol Edin

```bash
# JSON çıktısını görüntüle (Terminal 3)
jq '.' ../../data/camera/latest_metrics.json

# Sadece ziyaretçi sayılarını göster
jq '.peopleIn, .peopleOut, .current' ../../data/camera/latest_metrics.json
```

---

### 3.4 YouTube Canlı Yayını

YouTube canlı yayınlarını gerçek zamanlı olarak analiz edebilirsiniz.

#### Adım 1: Video URL'sini Alın

```
Örnek YouTube canlı yayın URL'leri:
https://www.youtube.com/watch?v=5qap5aO4i9A  (Times Square Canlı)
https://www.youtube.com/watch?v=wCcMcaiRbhM  (Kafe İçi Canlı)
```

#### Adım 2: Yayın Stream URL'sini Çıkarın

**Terminal 3'te çalıştırın:**

```bash
# yt-dlp ile stream URL'sini al
yt-dlp -g "https://www.youtube.com/watch?v=5qap5aO4i9A"

# Çıktı (örnek):
# https://manifest.googlevideo.com/api/manifest/hls_playlist/...m3u8
```

**Bu komutu kopyalayın, uzun bir .m3u8 URL'si verecek.**

#### Adım 3: Stream'i Analiz Edin

**Terminal 2'de çalıştırın:**

```bash
# ✅ DOĞRU KULLANIM: URL'yi tek tırnak içinde verin
python -m camera_analytics.run \
  --source 'https://manifest.googlevideo.com/api/manifest/hls_playlist/...m3u8' \
  --output ../../data/camera/latest_metrics.json \
  --display

# ❌ YANLIŞ: Tırnaksız kullanmayın
```

#### Adım 4: Token Yenilemesi (Uzun Süreli Kullanım)

YouTube stream token'ları yaklaşık 5-6 saat sonra sona erer. Sürekli çalıştırmak için:

**Otomatik yenileme scripti (Terminal 3):**

```bash
cd ~/Desktop/ObservAI/observai/packages/camera-analytics

# Script oluştur
cat > run_youtube_continuous.sh <<'SCRIPT'
#!/bin/bash
YOUTUBE_URL="https://www.youtube.com/watch?v=5qap5aO4i9A"

while true; do
    echo "🔄 Yeni stream URL alınıyor..."
    STREAM_URL=$(yt-dlp -g "$YOUTUBE_URL" 2>/dev/null | head -n1)

    if [ -z "$STREAM_URL" ]; then
        echo "❌ Stream URL alınamadı, 30 saniye sonra tekrar denenecek..."
        sleep 30
        continue
    fi

    echo "✅ Stream URL alındı, analiz başlatılıyor..."
    python -m camera_analytics.run \
        --source "$STREAM_URL" \
        --output ../../data/camera/latest_metrics.json \
        --display

    echo "⚠️ Stream sonlandı, 10 saniye sonra yeniden başlatılıyor..."
    sleep 10
done
SCRIPT

# Çalıştırılabilir yap
chmod +x run_youtube_continuous.sh

# Başlat
./run_youtube_continuous.sh
```

#### Düşük Kalite Kullanımı (Performans için)

```bash
# 720p veya daha düşük kalite için
yt-dlp -g -f 'bestvideo[height<=720]+bestaudio' "YOUTUBE_URL"

# Sadece video stream'i (ses yok)
yt-dlp -g -f 'bestvideo[height<=480]' "YOUTUBE_URL"
```

---

### 3.5 Twitch Canlı Yayını

Twitch yayınlarını analiz etmek için `streamlink` kullanacağız.

#### Adım 1: Streamlink Kurulumu

```bash
# Streamlink'i yükle (eğer yoksa)
brew install streamlink

# Veya pip ile
pip install streamlink
```

#### Adım 2: Twitch Stream URL'sini Alın

**Terminal 3'te test edin:**

```bash
# Twitch kanalı: https://www.twitch.tv/channelname
streamlink --stream-url https://www.twitch.tv/channelname best

# Çıktı (örnek):
# https://video-weaver.dfw04.hls.ttvnw.net/...m3u8
```

#### Adım 3: Stream'i Analiz Edin

**Terminal 2'de çalıştırın:**

```bash
# Önce stream URL'sini al
STREAM_URL=$(streamlink --stream-url https://www.twitch.tv/channelname best)

# Analiz et
python -m camera_analytics.run \
  --source "$STREAM_URL" \
  --output ../../data/camera/latest_metrics.json \
  --display
```

#### Tek Komutla Başlatma

```bash
# Streamlink çıktısını doğrudan pipe ile aktar
streamlink https://www.twitch.tv/channelname best -O | \
  python -m camera_analytics.run \
    --source - \
    --output ../../data/camera/latest_metrics.json
```

#### Kalite Seçenekleri

```bash
# Mevcut kaliteleri listele
streamlink https://www.twitch.tv/channelname

# Çıktı:
# Available streams: audio_only, 160p, 360p, 480p, 720p, 1080p (best)

# 720p kullan
streamlink --stream-url https://www.twitch.tv/channelname 720p
```

---

### 3.6 IP/CCTV Kamera (RTSP/HTTP)

Profesyonel IP kameraları veya CCTV sistemlerini bağlayın.

#### Yaygın IP Kamera URL Formatları

```bash
# RTSP (Real-Time Streaming Protocol)
rtsp://username:password@192.168.1.100:554/stream1
rtsp://admin:admin123@camera.local/live/ch00_0

# HTTP/MJPEG
http://192.168.1.100:8080/video
http://admin:admin123@192.168.1.100/mjpeg

# ONVIF Uyumlu Kameralar
rtsp://username:password@ip:554/onvif1
```

#### Adım 1: Kamera Bağlantı Bilgilerini Bulun

```
📱 Kamera yapılandırma arayüzüne girin
  └─ Genellikle: http://KAMERA_IP
      └─ Streaming ayarları
          └─ RTSP URL'sini kopyalayın
```

#### Adım 2: Bağlantıyı Test Edin

**Terminal 3'te test edin:**

```bash
# ffplay ile (hızlı test)
ffplay "rtsp://admin:password@192.168.1.100:554/stream1"

# VLC ile açmayı da deneyebilirsiniz
# Dosya > Ağ Akışını Aç > RTSP URL'sini girin
```

#### Adım 3: ObservAI ile Bağlayın

**Terminal 2'de çalıştırın:**

```bash
# RTSP kamera
python -m camera_analytics.run \
  --source "rtsp://admin:camera123@192.168.1.100:554/stream1" \
  --output ../../data/camera/latest_metrics.json \
  --display

# HTTP/MJPEG kamera
python -m camera_analytics.run \
  --source "http://admin:camera123@192.168.1.100:8080/video" \
  --output ../../data/camera/latest_metrics.json \
  --display
```

#### Çoklu Kamera Yönetimi

**Birden fazla kamera için ayrı terminal/process:**

```bash
# Terminal 2: Kamera 1
python -m camera_analytics.run \
  --source "rtsp://admin:pass@192.168.1.100/stream" \
  --output ../../data/camera/camera1_metrics.json \
  --display

# Terminal 4: Kamera 2
python -m camera_analytics.run \
  --source "rtsp://admin:pass@192.168.1.101/stream" \
  --output ../../data/camera/camera2_metrics.json \
  --display
```

#### Bağlantı Sorunlarında

```bash
# ffmpeg ile yeniden stream edin
ffmpeg -i "rtsp://admin:pass@192.168.1.100/stream" \
  -f rawvideo -pix_fmt bgr24 -an pipe:1 | \
  python -m camera_analytics.run \
    --source - \
    --output ../../data/camera/latest_metrics.json
```

---

### 3.7 Uzak Sunucu Kamerası

Başka bir sunucudaki kamera verilerini kullanın.

#### Senaryo 1: SSH Tunnel ile Kamera Erişimi

```bash
# Uzak sunucuya SSH tunnel açın (Terminal 3)
ssh -L 8554:localhost:554 user@remote-server.com

# Artık localhost:8554 uzak kamerayı işaret ediyor
# Terminal 2'de:
python -m camera_analytics.run \
  --source "rtsp://admin:pass@localhost:8554/stream" \
  --output ../../data/camera/latest_metrics.json \
  --display
```

#### Senaryo 2: Sunucudan Video Stream'i

```bash
# Uzak sunucuda ffmpeg ile stream yayını yapın
# Sunucuda (SSH ile bağlanın):
ffmpeg -f v4l2 -i /dev/video0 -f mpegts udp://YOUR_LOCAL_IP:8888

# Yerel makinenizde (Terminal 2):
python -m camera_analytics.run \
  --source "udp://0.0.0.0:8888" \
  --output ../../data/camera/latest_metrics.json \
  --display
```

#### Senaryo 3: WebRTC veya SRT Protokolü

```bash
# SRT (Secure Reliable Transport) kullanımı
# Sunucuda:
ffmpeg -i rtsp://camera -f mpegts srt://YOUR_IP:9000

# Yerel makinede:
python -m camera_analytics.run \
  --source "srt://0.0.0.0:9000" \
  --output ../../data/camera/latest_metrics.json \
  --display
```

---

## 4. ⚙️ Konfigürasyon Özelleştirme

### Konfigürasyon Dosyası

Tüm alan tanımlamaları ve eşikler `config/default_zones.yaml` dosyasında:

```bash
# Dosyayı düzenle
cd ~/Desktop/ObservAI/observai/packages/camera-analytics
nano config/default_zones.yaml

# Veya VSCode ile:
code config/default_zones.yaml
```

### Örnek Konfigürasyon

```yaml
# Giriş çizgisi (normalize koordinatlar 0.0-1.0)
entrance_line:
  start: [0.05, 0.95]  # Sol alt
  end: [0.95, 0.95]    # Sağ alt
  inside_on: top       # Üstteki alan "içeride"

# Kuyruk bölgesi
queue_zone:
  id: queue
  polygon:
    - [0.35, 0.55]  # Sol üst
    - [0.65, 0.55]  # Sağ üst
    - [0.65, 0.95]  # Sağ alt
    - [0.35, 0.95]  # Sol alt

# Masalar
tables:
  - id: table-1
    name: "Pencere Kenarı"
    polygon:
      - [0.05, 0.1]
      - [0.28, 0.1]
      - [0.28, 0.35]
      - [0.05, 0.35]

  - id: table-2
    name: "Orta Masa"
    polygon:
      - [0.36, 0.1]
      - [0.64, 0.1]
      - [0.64, 0.35]
      - [0.36, 0.35]

# Heatmap çözünürlüğü
heatmap:
  grid_width: 6   # Yatay bölünme
  grid_height: 4  # Dikey bölünme

# Uyarı eşikleri
alert_thresholds:
  queue_long_wait: 180.0        # 3 dakika
  queue_high_count: 8            # 8 kişi
  crowd_surge_threshold: 5       # 5 kişi artış
  crowd_surge_window: 30.0       # 30 saniye içinde
  table_long_stay: 7200.0        # 2 saat
```

### Koordinat Sistemini Anlama

```
(0,0) ─────────────────────── (1,0)
  │                              │
  │    Kamera Görüntüsü         │
  │    (Normalize Koordinatlar)  │
  │                              │
(0,1) ─────────────────────── (1,1)
```

**Kendi alanlarınızı çizmek için:**

1. Kamera görüntüsünü yakala
2. Koordinatları belirle (piksel → normalize)
3. YAML'e işle
4. Test et

### Özel Konfigürasyon Kullanma

```bash
# Kendi config dosyanızı oluşturun
cp config/default_zones.yaml config/my_cafe.yaml

# Düzenleyin
nano config/my_cafe.yaml

# Özel config ile çalıştırın
python -m camera_analytics.run \
  --source 0 \
  --config config/my_cafe.yaml \
  --output ../../data/camera/latest_metrics.json \
  --display
```

---

## 5. 🔌 API Entegrasyonu ve Test

### JSON Çıktısı Konumu

```bash
~/Desktop/ObservAI/observai/data/camera/latest_metrics.json
```

### JSON Yapısı

```json
{
  "ts": "2025-10-13T14:30:15.123Z",
  "peopleIn": 45,
  "peopleOut": 38,
  "current": 7,
  "ageBuckets": {
    "0-17": 1,
    "18-25": 3,
    "26-35": 2,
    "36-50": 1,
    "50+": 0
  },
  "gender": {
    "male": 4,
    "female": 3,
    "unknown": 0
  },
  "queue": {
    "current": 2,
    "averageWaitSeconds": 45.2,
    "longestWaitSeconds": 120.5
  },
  "tables": [
    {
      "id": "table-1",
      "name": "Pencere Kenarı",
      "currentOccupants": 3,
      "avgStaySeconds": 1850.5,
      "longestStaySeconds": 2400.0
    }
  ],
  "heatmap": [
    [0, 5, 12, 8, 3, 0],
    [2, 15, 25, 20, 10, 1],
    [1, 10, 18, 15, 8, 2],
    [0, 3, 8, 5, 2, 0]
  ],
  "alerts": [
    {
      "type": "long_queue",
      "severity": "high",
      "message": "Queue has 10 people waiting. Immediate attention needed.",
      "timestamp": "2025-10-13T14:30:15.123Z",
      "metadata": {
        "queueCount": 10
      }
    }
  ]
}
```

### API Endpoint'lerini Test Etme

**Terminal 3'te çalıştırın:**

```bash
# Genel metrikler
curl http://localhost:3333/camera/metrics | jq

# Sadece insan sayısı
curl http://localhost:3333/camera/people-count | jq

# Kuyruk durumu
curl http://localhost:3333/camera/queue-status | jq

# Uyarılar
curl http://localhost:3333/camera/alerts | jq

# Heatmap
curl http://localhost:3333/camera/heatmap | jq
```

### JSON Dosyasını Manuel İnceleme

```bash
# Tüm içeriği göster
cat ../../data/camera/latest_metrics.json | jq

# Sadece insan sayılarını göster
jq '.peopleIn, .peopleOut, .current' ../../data/camera/latest_metrics.json

# Uyarıları göster
jq '.alerts' ../../data/camera/latest_metrics.json

# Masa durumlarını göster
jq '.tables' ../../data/camera/latest_metrics.json

# Anlık güncelleme izle (real-time)
watch -n 1 'jq ".current, .queue.current" ../../data/camera/latest_metrics.json'
```

### Heatmap Görselleştirme

**JupyterLab ile (Terminal 2):**

```bash
# JupyterLab'i başlat
source .venv/bin/activate
jupyter lab

# Tarayıcıda açılacak, yeni notebook oluşturun ve şunu çalıştırın:
```

```python
import json
import numpy as np
import matplotlib.pyplot as plt

# Metrics'i yükle
with open('../../data/camera/latest_metrics.json') as f:
    data = json.load(f)

# Heatmap'i göster
heatmap = np.array(data['heatmap'])
plt.figure(figsize=(12, 8))
plt.imshow(heatmap, cmap='hot', interpolation='nearest')
plt.colorbar(label='Ziyaret Sayısı')
plt.title('Kafe İçi Yoğunluk Haritası')
plt.xlabel('Yatay Bölge')
plt.ylabel('Dikey Bölge')
plt.show()

# İstatistikler
print(f"📊 İçerideki Kişi: {data['current']}")
print(f"📥 Giren Toplam: {data['peopleIn']}")
print(f"📤 Çıkan Toplam: {data['peopleOut']}")
print(f"⏱️  Kuyruk Bekleme: {data['queue']['averageWaitSeconds']:.1f} saniye")
```

---

## 6. 🚨 Uyarı ve Bildirim Sistemi

### Uyarı Tipleri

| Tip | Açıklama | Önem Derecesi |
|-----|----------|---------------|
| `long_queue` | Uzun kuyruk bekleme süresi | high/medium |
| `crowd_surge` | Ani kalabalık artışı | medium |
| `long_table_occupancy` | Masa uzun süre dolu | low |
| `low_inventory` | Düşük stok (gelecekte) | medium |

### Uyarı Örnekleri

```json
{
  "type": "long_queue",
  "severity": "high",
  "message": "Queue wait time is 240s (avg). Consider adding staff.",
  "timestamp": "2025-10-13T14:30:15.123Z",
  "metadata": {
    "averageWaitSeconds": 240.0,
    "queueCount": 12
  }
}
```

```json
{
  "type": "crowd_surge",
  "severity": "medium",
  "message": "Sudden crowd increase detected: 7 new customers in 30s.",
  "timestamp": "2025-10-13T14:35:20.456Z",
  "metadata": {
    "increase": 7,
    "currentCount": 15,
    "previousCount": 8
  }
}
```

### Eşikleri Özelleştirme

`config/default_zones.yaml` dosyasında:

```yaml
alert_thresholds:
  queue_long_wait: 120.0        # 2 dakika (daha hassas)
  queue_high_count: 5            # 5 kişi (daha erken uyar)
  crowd_surge_threshold: 3       # 3 kişi artış
  crowd_surge_window: 20.0       # 20 saniye içinde
  table_long_stay: 5400.0        # 1.5 saat
```

### Uyarıları Gerçek Zamanlı İzleme

```bash
# Terminal 3'te çalıştırın
watch -n 2 'jq ".alerts | length" ../../data/camera/latest_metrics.json && jq ".alerts[-1]" ../../data/camera/latest_metrics.json'

# Her 2 saniyede bir:
# - Toplam uyarı sayısını
# - Son uyarıyı gösterir
```

---

## 7. 🎨 İleri Seviye Özelleştirmeler

### Farklı YOLO Modelleri

```bash
# Daha hızlı (düşük doğruluk)
python -m camera_analytics.run \
  --source 0 \
  --model yolov8n.pt \
  --output ../../data/camera/latest_metrics.json

# Daha yavaş (yüksek doğruluk)
python -m camera_analytics.run \
  --source 0 \
  --model yolov8x.pt \
  --output ../../data/camera/latest_metrics.json

# Özel eğitilmiş model
python -m camera_analytics.run \
  --source 0 \
  --model ./models/custom_cafe.pt \
  --output ../../data/camera/latest_metrics.json
```

### Sample Interval (Kayıt Sıklığı)

```bash
# Her 0.5 saniyede bir kaydet (daha sık)
python -m camera_analytics.run \
  --source 0 \
  --output ../../data/camera/latest_metrics.json \
  --sample-interval 0.5

# Her 5 saniyede bir kaydet (daha az)
python -m camera_analytics.run \
  --source 0 \
  --output ../../data/camera/latest_metrics.json \
  --sample-interval 5
```

### Demografiyi Devre Dışı Bırakma

Eğer InsightFace sorun çıkarıyorsa:

```bash
pip uninstall insightface -y

# Sistem otomatik olarak demografi olmadan çalışacak
# Gender ve age bilgileri "unknown" olarak dönecek
```

### Çoklu Çıktı Formatları

```python
# camera_analytics/analytics.py dosyasında _write_metrics metodunu düzenle
def _write_metrics(self, metrics: CameraMetrics) -> None:
    # JSON çıktısı
    with self.output_path.open("w", encoding="utf-8") as f:
        json.dump(metrics.to_dict(), f, indent=2)

    # CSV çıktısı (ek olarak)
    csv_path = self.output_path.parent / "metrics.csv"
    with csv_path.open("a", encoding="utf-8") as f:
        f.write(f"{metrics.ts},{metrics.current},{metrics.queue.current}\n")
```

---

## 8. 🔧 Sorun Giderme

### Kamera açılmıyor

**Sorun:** `[ERROR] Cannot open camera source 0`

**Çözüm:**
```bash
# 1. Kamera izinlerini kontrol et
# macOS Ayarları > Gizlilik ve Güvenlik > Kamera > Terminal ✓

# 2. Başka uygulamanın kullanıp kullanmadığını kontrol et
lsof | grep "AppleCamera"

# 3. Farklı indeksleri dene
python -m camera_analytics.run --source 1 ...
```

### Stream bağlantı hatası

**Sorun:** `[ERROR] Waiting for stream...`

**Çözüm:**
```bash
# URL'yi tırnakla kullanın
python -m camera_analytics.run --source "rtsp://..."

# ffplay ile test edin
ffplay "rtsp://admin:pass@192.168.1.100/stream"

# Network bağlantısını kontrol edin
ping 192.168.1.100
```

### NumPy/ONNX hataları

**Sorun:** `numpy.ndarray size changed`

**Çözüm:**
```bash
source .venv/bin/activate
pip install --force-reinstall numpy==1.26.4
pip install --force-reinstall onnxruntime-silicon==1.16.3
```

### InsightFace çöküyor

**Sorun:** `Segmentation fault: 11`

**Çözüm:**
```bash
# InsightFace'i kaldır
pip uninstall insightface -y

# Sistem demografi olmadan çalışacak
# Veya eski NumPy sürümüyle dene
pip install numpy==1.23.5 insightface
```

### Yüksek CPU kullanımı

**Sorun:** CPU %100'e yakın

**Çözüm:**
```bash
# 1. Daha küçük YOLO modeli kullan
--model yolov8n.pt

# 2. Sample interval'i artır
--sample-interval 2

# 3. Display'i kapat
# --display parametresini kaldır

# 4. Daha düşük çözünürlük kullan (stream için)
yt-dlp -g -f 'bestvideo[height<=480]' "URL"
```

### JSON dosyası güncellenmiyor

**Sorun:** Metrics dosyası eski

**Çözüm:**
```bash
# 1. Yazma iznini kontrol et
ls -la ../../data/camera/

# 2. Klasör oluştur
mkdir -p ../../data/camera

# 3. Manuel test
echo '{}' > ../../data/camera/latest_metrics.json

# 4. Çıktı yolunu kontrol et
python -m camera_analytics.run --output "$(pwd)/../../data/camera/latest_metrics.json" ...
```

### API bağlantı hatası

**Sorun:** `curl: (7) Failed to connect to localhost port 3333`

**Çözüm:**
```bash
# 1. API sunucusunun çalıştığını kontrol et (Terminal 1)
# pnpm dev çalışıyor olmalı

# 2. Port'un kullanımda olup olmadığını kontrol et
lsof -i :3333

# 3. .env dosyasını kontrol et
cat .env | grep PORT
```

---

## 🎯 Hızlı Başlangıç Özeti

### İlk Kez Kurulum (5 Dakika)

```bash
# Terminal 1: Backend
cd ~/Desktop/ObservAI/observai && pnpm install && pnpm dev

# Terminal 2: Python Ortamı
cd ~/Desktop/ObservAI/observai/packages/camera-analytics
python3.11 -m venv .venv && source .venv/bin/activate
python -m pip install -e .
mkdir -p ../../data/camera

# Terminal 2: Kamera Başlat
python -m camera_analytics.run \
  --source 0 \
  --output ../../data/camera/latest_metrics.json \
  --display

# Terminal 3: Test
curl http://localhost:3333/camera/metrics | jq
```

### Sonraki Kullanımlar (30 Saniye)

```bash
# Terminal 1
cd ~/Desktop/ObservAI/observai && pnpm dev

# Terminal 2
cd ~/Desktop/ObservAI/observai/packages/camera-analytics
source .venv/bin/activate
python -m camera_analytics.run --source 0 --output ../../data/camera/latest_metrics.json --display
```

---

## 📚 Ek Kaynaklar

### Proje Yapısı
```
ObservAI/observai/
├── apps/
│   ├── api/              # NestJS Backend API
│   └── web/              # React Frontend
├── packages/
│   ├── camera-analytics/ # Python kamera analytics
│   │   ├── camera_analytics/
│   │   ├── config/
│   │   │   └── default_zones.yaml
│   │   └── tests/
│   └── types/            # TypeScript type definitions
└── data/
    └── camera/
        └── latest_metrics.json
```

### Komut Parametreleri

| Parametre | Açıklama | Örnek |
|-----------|----------|-------|
| `--source` | Kamera kaynağı | `0`, `video.mp4`, `rtsp://...` |
| `--output` | JSON çıktı yolu | `../../data/camera/latest_metrics.json` |
| `--display` | Görsel pencere göster | (bayrak, değer yok) |
| `--config` | Özel config dosyası | `config/my_cafe.yaml` |
| `--model` | YOLO model dosyası | `yolov8n.pt` |
| `--sample-interval` | Kayıt sıklığı (saniye) | `1.0` |

### Yararlı Komutlar

```bash
# Python ortamını aktifleştir
source .venv/bin/activate

# Python ortamından çık
deactivate

# Kamera indekslerini listele
python3 -c "import cv2; [print(f'{i}: {cv2.VideoCapture(i).read()[0]}') for i in range(10)]"

# JSON'u izle (real-time)
watch -n 1 'jq ".current" ../../data/camera/latest_metrics.json'

# API'yi test et
curl -s http://localhost:3333/camera/metrics | jq '.data.current'

# Log dosyasına kaydet
python -m camera_analytics.run --source 0 --output ../../data/camera/latest_metrics.json 2>&1 | tee camera.log
```

---

## ✅ Kontrol Listesi

İlk kurulum tamamlandığında şunlar çalışıyor olmalı:

- [ ] Backend API (`http://localhost:3333`) çalışıyor
- [ ] Python virtual environment aktif
- [ ] Kamera açılıyor ve görüntü alınıyor
- [ ] `latest_metrics.json` dosyası düzenli güncelleniyor
- [ ] API endpoint'leri veri dönüyor
- [ ] Display penceresi açılıyor (eğer `--display` kullandıysanız)
- [ ] Uyarılar üretiliyor (eğer koşullar sağlanırsa)

---

## 🆘 Destek

Sorun yaşarsanız:

1. **Logları kontrol edin:** Terminal çıktılarında `[ERROR]` veya `[WARN]` arayın
2. **Sorun Giderme bölümüne bakın:** Yukarıdaki 8. bölüm
3. **GitHub Issues:** `https://github.com/partalemre/ObservAI/issues`

---

**🎉 Tebrikler! ObservAI kamera analytics sisteminiz çalışıyor!**

Bu rehberi izleyerek kafenizin, restoranınızın veya işletmenizin gerçek zamanlı analitiğini yapabilirsiniz.
