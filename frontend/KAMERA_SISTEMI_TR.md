# Kamera Sistemi - Kullanım Kılavuzu

**Tarih:** 16 Kasım 2025  
**Durum:** Tam Entegrasyon Tamamlandı

## 📹 Genel Bakış

ObservAI kamera sistemi, 6 farklı kamera kaynağından canlı video akışı alabilir ve gerçek zamanlı insan tespiti yapabilir. YOLO v8 nano modeli kullanılarak kişi sayısı, cinsiyet, yaş grubu ve bekleme süreleri analiz edilir.

## 🎯 Desteklenen Kamera Kaynakları

### 1. MacBook Kamerası (Varsayılan)
**Açıklama:** Dizüstü bilgisayarınızın yerleşik kamerası

**Nasıl Kullanılır:**
1. Kamera Analitiği sayfasına gidin
2. "Canlı" moduna geçin
3. Kamera otomatik olarak başlar
4. Tarayıcı izni vermenizi isteyecektir

**Sistem İzinleri:**
- macOS: Sistem Tercihleri → Gizlilik ve Güvenlik → Kamera
- Tarayıcınızı (Chrome/Safari) etkinleştirin

**Sorun Giderme:**
- İzin hatası: Sistem tercihlerinden kamera iznini kontrol edin
- Video yok: Başka uygulama kamerayı kullanıyor olabilir
- Siyah ekran: Tarayıcıyı yeniden başlatın

---

### 2. iPhone Kamerası
**Açıklama:** iPhone'unuzu web kamerası olarak kullanın

**Gereksinimler:**
- macOS Ventura veya üzeri
- Continuity Camera özelliği aktif
- iPhone iOS 16 veya üzeri
- USB veya Wi-Fi bağlantısı

**Nasıl Kullanılır:**
1. iPhone'unuzu Mac'e USB ile bağlayın veya aynı Wi-Fi ağında olun
2. Kamera Analitiği → Ayarlar (⚙️) → "iPhone" seçin
3. iPhone otomatik olarak kamera moduna geçer
4. Video akışı başlar

**Alternatif Yöntem:**
- iPhone Safari'de http://[Mac-IP]:5173 adresini açın
- Doğrudan iPhone kamerasını kullanın

**Sorun Giderme:**
- "İkincil kamera bulunamadı" hatası:
  - Continuity Camera aktif mi?
  - iPhone USB ile bağlı mı?
  - macOS ve iOS güncel mi?

---

### 3. IP Kamera (RTSP/HTTP)
**Açıklama:** Ağ üzerinden bağlı güvenlik kameraları

**Desteklenen Protokoller:**
- RTSP (Real Time Streaming Protocol)
- HTTP/HTTPS video akışları

**Nasıl Kullanılır:**

**Adım 1: IP Kamera Ekleyin**
1. Kamera Analitiği → Ayarlar (⚙️) → "Gelişmiş"
2. "IP Kamera Ekle" → "+ Kamera Ekle"
3. Bilgileri girin:
   - **İsim:** Kamera adı (örn: "Giriş Kapısı")
   - **URL:** rtsp://kullanici:sifre@192.168.1.100:554/stream
   - **Tip:** RTSP veya HTTP
4. "Ekle" butonuna tıklayın

**Adım 2: Backend'i Başlatın**
```bash
./scripts/start-camera-backend.sh "rtsp://kullanici:sifre@192.168.1.100:554/stream" 5000
```

**Adım 3: Kamerayı Seçin**
- Ayarlar → IP kamera listesinden seçin
- Backend bağlantısı kurulduğunda tespit verileri gelmeye başlar

**URL Format Örnekleri:**
```
# RTSP (standart)
rtsp://admin:12345@192.168.1.100:554/stream1

# RTSP (Hikvision)
rtsp://admin:12345@192.168.1.100:554/Streaming/Channels/101

# HTTP (MJPEG)
http://192.168.1.100:8080/video
```

**Sorun Giderme:**
- Bağlantı hatası: IP adresini ve portu kontrol edin
- Yetkilendirme hatası: Kullanıcı adı/şifre doğru mu?
- Codec hatası: Backend RTSP desteği var mı?

---

### 4. Canlı Yayın URL (YouTube, RTMP, HLS)
**Açıklama:** İnternet üzerinden video akışları

**Desteklenen Kaynaklar:**
- YouTube canlı yayınları
- RTMP akışları
- HLS (m3u8) akışları
- Twitch yayınları

**Gereksinimler:**
```bash
brew install yt-dlp
```

**Nasıl Kullanılır:**
1. Kamera Analitiği → Ayarlar → "Gelişmiş"
2. "Stream URL (YouTube, RTSP, HLS)" alanına URL girin:
   ```
   https://www.youtube.com/watch?v=dQw4w9WgXcQ
   ```
3. "Bağlan" butonuna tıklayın
4. Terminal komutunu kopyalayın:
   ```bash
   ./scripts/start-camera-backend.sh "https://youtube.com/..." 5000
   ```
5. Terminalde çalıştırın
6. Backend bağlandığında tespit verileri gelir

**URL Format Örnekleri:**
```
# YouTube canlı yayın
https://www.youtube.com/watch?v=VIDEO_ID

# HLS stream
https://example.com/stream/playlist.m3u8

# RTMP
rtmp://server.com/live/stream_key
```

**Sorun Giderme:**
- yt-dlp bulunamadı: `brew install yt-dlp`
- Video özel/kaldırılmış: Genel bir video deneyin
- Yavaş akış: İnternet bağlantınızı kontrol edin

---

### 5. Yerel Video Dosyası
**Açıklama:** Bilgisayarınızdaki MP4, AVI, MOV dosyaları

**Desteklenen Formatlar:**
- MP4 (H.264)
- AVI
- MOV
- WebM
- MKV

**Nasıl Kullanılır:**

**Tarayıcıda Oynatma (Tespit YOK):**
1. Ayarlar → "Gelişmiş" → "Yerel Video Dosyası"
2. "Dosya Seç" → Video seçin
3. Video tarayıcıda oynatılır
4. YOLO tespiti ÇALIŞMAZ (sadece önizleme)

**Backend ile Tespit (Tavsiye Edilen):**
1. Video dosyasını bilinen bir yere kaydedin
2. Terminal komutunu çalıştırın:
   ```bash
   ./scripts/start-camera-backend.sh "/Users/kullanici/Desktop/video.mp4" 5000
   ```
3. Backend videoyu işler ve tespit verileri gönderir

**Sorun Giderme:**
- Video oynatmıyor: Format destekleniyor mu?
- Tespit yok: Backend ile mi başlattınız?
- Çok yavaş: Daha düşük çözünürlük deneyin

---

### 6. Ekran Kaydı (Zoom Toplantıları)
**Açıklama:** Ekranınızı veya uygulama penceresini kaydedin

**Kullanım Senaryoları:**
- Zoom toplantılarını izle
- Google Meet/Teams toplantıları
- Başka uygulamaların videoları

**ÖNEMLI KISITLAMA:**
⚠️ Tarayıcı güvenliği nedeniyle ekran içeriği backend'e GÖNDERİLEMEZ.
Sadece tarayıcıda önizleme gösterilir, YOLO tespiti ÇALIŞMAZ.

**Nasıl Kullanılır:**
1. Ayarlar → "Screen Capture" seçin
2. Tarayıcı izin penceresi açılır
3. Seçenekler:
   - Tüm ekran
   - Uygulama penceresi
   - Tarayıcı sekmesi
4. Seçin ve "Paylaş" tıklayın

**Sistem İzinleri (macOS):**
1. Sistem Ayarları → Gizlilik ve Güvenlik → Ekran Kaydı
2. Chrome/Safari'yi etkinleştirin
3. Tarayıcıyı yeniden başlatın
4. Tekrar deneyin

**Sorun Giderme:**
- İzin reddedildi: Sistem ayarlarından izin verin
- Siyah ekran: Bazı uygulamalar ekran kaydına izin vermez
- Hiçbir şey seçilemedi: ESC'ye basıp tekrar deneyin

---

## 🎨 Bölge Etiketleme

### Genel Bakış
Kamera görüntüsü üzerinde giriş/çıkış bölgelerini tanımlayın. Bu bölgeler canlı yayında görünür ve bölge bazlı metrikleri etkinleştirir.

### Adım Adım Kullanım

**1. Kamerayı Başlatın**
- Kamera Analitiği sayfasına gidin
- "Canlı" moduna geçin
- Kameranızı seçin ve başlatın (örn: MacBook Kamerası)
- Video akışının göründğünden emin olun

**2. Kamera Görüntüsünü Yakalayın**
- Sol menüden "Bölge Etiketleme" sayfasına gidin
- "Kamerayı Yakala" butonuna tıklayın
- Mevcut kamera görüntüsünün bir anlık görüntüsü arka plan olarak kullanılır

**3. Bölgeleri Çizin**
- "Bölge Ekle" butonuna tıklayın (Drawing... durumuna geçer)
- Fare ile dikdörtgen çizin:
  - Sol tık + Sürükle
  - Minimum 20x20 piksel boyut
- Bölge otomatik olarak oluşturulur

**4. Bölgeleri Düzenleyin**
- Sağ panelden bölgeyi seçin
- İsim değiştirin (örn: "Ana Giriş")
- Tip seçin:
  - **Giriş (Entrance):** Yeşil renk
  - **Çıkış (Exit):** Kırmızı renk
- Silmek için çöp kutusu ikonuna tıklayın

**5. Kaydedin**
- "Tümünü Kaydet" butonuna tıklayın
- Bölgeler localStorage'a kaydedilir
- Kamera Analitiği sayfasına dönün
- Bölgeler canlı video üzerinde kesik çizgiler olarak görünür

### Bölge Formatı (localStorage)
```json
[
  {
    "id": "1699876543210",
    "name": "Ana Giriş",
    "type": "entrance",
    "x": 150,
    "y": 200,
    "width": 300,
    "height": 150,
    "color": "#10b981"
  },
  {
    "id": "1699876543211",
    "name": "Çıkış Kapısı",
    "type": "exit",
    "x": 800,
    "y": 400,
    "width": 250,
    "height": 120,
    "color": "#ef4444"
  }
]
```

**localStorage Anahtarları:**
- `cameraZones`: Bölge tanımlamaları
- `zoneLabelingBackground`: Arka plan görüntüsü (base64 JPEG)

### İpuçları
- Giriş/çıkış noktalarını net bir şekilde görebileceğiniz bir kamera açısı seçin
- Bölgeleri çok küçük yapmayın (minimum 100x100 piksel önerilir)
- Bölge isimlerini açıklayıcı yapın
- Kamera açısını değiştirirseniz bölgeleri yeniden çizin

---

## 🔧 Backend Kurulumu

### Gereksinimler
```bash
# Python 3.9+
python --version

# Bağımlılıkları yükleyin
cd packages/camera-analytics
pip install -e .

# Opsiyonel: yt-dlp (YouTube için)
brew install yt-dlp
```

### Backend Başlatma

**Temel Komut:**
```bash
./scripts/start-camera-backend.sh [kaynak] [port] [--display]
```

**Parametreler:**
- `kaynak`: Kamera kaynağı (varsayılan: `0` = webcam)
- `port`: Socket.IO portu (varsayılan: `5000`)
- `--display`: OpenCV penceresini göster (isteğe bağlı)

**Örnekler:**
```bash
# Webcam (varsayılan)
./scripts/start-camera-backend.sh 0 5000

# Webcam + görselleştirme penceresi
./scripts/start-camera-backend.sh 0 5000 --display

# Video dosyası
./scripts/start-camera-backend.sh "/Users/kullanici/Desktop/test.mp4" 5000

# IP kamera (RTSP)
./scripts/start-camera-backend.sh "rtsp://admin:12345@192.168.1.100:554/stream" 5000

# YouTube
./scripts/start-camera-backend.sh "https://www.youtube.com/watch?v=..." 5000
```

### Backend Logları

**Başarılı Başlangıç:**
```
[INFO] Starting camera analytics pipeline...
[INFO] Camera source: 0
[INFO] YOLO model loaded: yolov8n.pt
[INFO] InsightFace model loaded (optional)
[INFO] WebSocket server started on 0.0.0.0:5000
✓ WebSocket server started on 0.0.0.0:5000
```

**Bağlantı Kuruldu:**
```
[INFO] Client connected: <socket_id>
[INFO] Processing frame... FPS: 28.5
[INFO] Detections: 2 people
```

### Socket.IO Olayları

**Backend → Frontend:**
- `global`: Genel analitik verileri (saniyede 1 kez)
  ```json
  {
    "timestamp": 1699876543,
    "entries": 15,
    "exits": 12,
    "current": 3,
    "queue": 0,
    "demographics": {
      "gender": { "male": 8, "female": 7, "unknown": 0 },
      "ages": { "child": 2, "teen": 5, "adult": 8, "senior": 0 }
    },
    "heatmap": {
      "points": [...],
      "gridWidth": 32,
      "gridHeight": 18
    },
    "fps": 28.5
  }
  ```

- `tracks`: Tespit edilen kişiler (frame başına)
  ```json
  [
    {
      "id": "track_123",
      "bbox": [0.25, 0.30, 0.15, 0.40],
      "gender": "male",
      "ageBucket": "adult",
      "dwellSec": 45,
      "state": "present"
    }
  ]
  ```

**Frontend → Backend:**
- `ping`: Bağlantı kontrolü
- `request_snapshot`: Anlık görüntü iste (gelecek özellik)

---

## 🧪 Test Senaryoları

### 1. MacBook Kamerası Testi
```bash
# Terminal 1: Backend
./scripts/start-camera-backend.sh 0 5000 --display

# Terminal 2: Frontend
cd frontend && npm run dev

# Tarayıcı: http://localhost:5173
# Login: admin@observai.com / demo1234
# Kamera Analitiği → Canlı → Kamera otomatik başlar
```

**Kontrol Listesi:**
- [ ] Video akışı görünüyor
- [ ] Kameranın önüne geçin
- [ ] "Detected: 1" gösteriyor
- [ ] Etrafınızda yeşil/mavi kutu çiziliyor
- [ ] Cinsiyet, yaş, süre etiketleri görünüyor
- [ ] "Mevcut Ziyaretçiler" sayısı artıyor
- [ ] Grafikler güncelleniyor

### 2. iPhone Kamerası Testi
**Ön Gereksinim:**
- iPhone USB veya Wi-Fi ile bağlı
- Continuity Camera aktif

```bash
# Backend aynı (webcam kullanır)
./scripts/start-camera-backend.sh 0 5000
```

**Frontend:**
1. Ayarlar → "iPhone" seçin
2. iPhone kamerası aktif olmalı
3. Video akışı iPhone'dan gelir
4. Backend webcam'den tespit verisi gönderir (karışık senaryo)

**Not:** Backend'in de iPhone'u kullanması için:
```bash
# iPhone device ID'sini bulun (genelde 1 veya 2)
./scripts/start-camera-backend.sh 1 5000
```

### 3. Bölge Etiketleme Testi
1. Kamerayı başlatın (MacBook)
2. Bölge Etiketleme sayfasına gidin
3. "Kamerayı Yakala" → Anlık görüntü arka planda
4. "Bölge Ekle" → Dikdörtgen çizin
5. İsim: "Test Bölgesi", Tip: "Giriş"
6. "Tümünü Kaydet"
7. Kamera Analitiği'ne dönün
8. Video üzerinde yeşil kesik çizgi görünmeli

### 4. Tam Ekran Testi
1. Kamera başlatıldı
2. Sağ üst köşede "tam ekran" ikonu (⛶)
3. Tıklayın → Tam ekran modu
4. ESC tuşu → Çık
5. Normal düzen geri gelir

### 5. Hata Senaryoları

**Backend Kapalı:**
- "Backend Offline" sarı gösterge
- "Waiting for backend..." mesajı
- Tespit sayısı 0 kalır
- Grafiklerde veri yok

**Kamera İzni Yok:**
- "Camera Error" mesajı
- İzin talimatları gösterilir
- "Retry" butonu

**Ekran Kaydı İzni Yok:**
- Detaylı hata mesajı
- Sistem ayarları yolu
- Yeniden deneme seçeneği

---

## 📊 Performans İpuçları

### Backend Optimizasyonu
```python
# packages/camera-analytics/camera_analytics/config.py

# Daha hızlı inference için:
YOLO_MODEL = "yolov8n.pt"  # nano model (en hızlı)
YOLO_CONF = 0.5  # Confidence threshold
YOLO_IOU = 0.45  # NMS threshold

# Daha yavaş ama daha doğru:
YOLO_MODEL = "yolov8s.pt"  # small model
YOLO_CONF = 0.6
```

### Video Çözünürlüğü
```typescript
// CameraFeed.tsx
video: {
  width: { ideal: 1280 },   // 1920 yerine
  height: { ideal: 720 }     // 1080 yerine
}
```

### Frame Rate Sınırlama
```python
# Backend'de FPS sınırı
time.sleep(0.033)  # ~30 FPS
```

---

## 🐛 Sık Karşılaşılan Sorunlar

### "Backend connection failed"
**Neden:** Backend çalışmıyor veya yanlış port  
**Çözüm:**
```bash
# Backend portunu kontrol edin
lsof -i :5000

# Backend başlatın
./scripts/start-camera-backend.sh 0 5000
```

### "No detections appearing"
**Neden:** Backend bağlı değil veya model yüklenmedi  
**Çözüm:**
- Backend loglarını kontrol edin
- YOLO model dosyası var mı?
- Kameranın önünde misiniz?

### "Zone overlays not showing"
**Neden:** Bölgeler kaydedilmemiş veya yanlış canvas boyutu  
**Çözüm:**
- localStorage'da `cameraZones` var mı?
- Browser console'da hata var mı?
- Bölgeleri yeniden çizin ve kaydedin

### "iPhone camera not switching"
**Neden:** İkinci kamera bulunamıyor  
**Çözüm:**
- Continuity Camera aktif mi?
- iPhone bağlı mı?
- Safari'de deneyin (Chrome'da sorun olabilir)

### "Screen capture shows black screen"
**Neden:** Uygulama ekran kaydına izin vermiyor  
**Çözüm:**
- Farklı pencere/uygulama deneyin
- Sistem izinlerini kontrol edin
- Tarayıcıyı yeniden başlatın

---

## 📞 Destek

**Dokümantasyon:**
- `IMPLEMENTATION_STATUS.md`: Genel durum
- `IMPLEMENTATION_GUIDE.md`: Kod örnekleri
- `QUICK_START_CAMERA.md`: Hızlı başlangıç

**Loglar:**
```bash
# Backend logları
./scripts/start-camera-backend.sh 0 5000 --display

# Frontend logları
# Browser DevTools → Console
# [CameraFeed] Connected to backend
# [CameraBackend] Received detections: 2
```

**Hata Raporlama:**
Lütfen şunları ekleyin:
1. İşletim sistemi ve sürüm
2. Tarayıcı ve sürüm
3. Kamera kaynağı tipi
4. Backend logları
5. Browser console hatası
6. Adım adım nasıl oluştuğu

---

**Son Güncelleme:** 16 Kasım 2025  
**Versiyon:** 1.0 (Session 4)  
**Durum:** Tüm özellikler tamamlandı ✅

