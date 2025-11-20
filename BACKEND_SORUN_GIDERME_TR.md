# Backend Sorun Giderme Kılavuzu

**Tarih:** 16 Kasım 2025

## 🎯 Mevcut Durum

✅ **Backend çalışıyor!** Port 5001'de Socket.IO aktif  
✅ **Tespit yapıyor!** YOLO ve InsightFace modelleri yüklü  
✅ **Frontend bağlı!** Real-time veri akışı çalışıyor

---

## 📱 iPhone Kamera Bağlantısı (Sorun 2)

### Neden Çalışmıyor?

iPhone kamerası 3 farklı yöntemle kullanılabilir:

#### Yöntem 1: Continuity Camera (macOS Ventura+)

**Gereksinimler:**
- macOS Ventura (13.0) veya üzeri
- iOS 16 veya üzeri
- Aynı Apple ID ile giriş
- Wi-Fi ve Bluetooth açık (her iki cihazda)

**Nasıl Kurulur:**

1. **iPhone ve Mac'te aynı Apple ID:**
   ```
   Mac: System Settings → Apple ID
   iPhone: Settings → [Your Name]
   ```

2. **Continuity Camera'yı Aktif Et:**
   ```
   Mac: System Settings → General → AirDrop & Handoff
   → ✅ iPhone camera as webcam
   ```

3. **iPhone'u Hazırla:**
   - iPhone kilidi açık
   - Mac'in yanında (Bluetooth menzilinde)
   - USB kabloyla bağlayabilirsin (daha stabil)

4. **Test Et:**
   ```bash
   # macOS'ta kamera listesi
   system_profiler SPCameraDataType
   
   # Veya Chrome/Safari'de:
   # chrome://media-internals
   ```

5. **Frontend'de Seç:**
   - Camera Analytics → Settings → iPhone
   - Eğer "No secondary camera found" hatası alırsan:
     - Mac'i yeniden başlat
     - iPhone'u USB ile bağla
     - Continuity Camera ayarlarını kontrol et

---

#### Yöntem 2: iPhone Safari'de Direct Access

iPhone'da direkt web sayfasını aç:

```
1. iPhone Safari → http://[Mac-IP]:5173
2. Login: admin@observai.com / demo1234
3. Camera Analytics → Live mode
4. getUserMedia() otomatik iPhone kamerasını kullanır
```

**Mac IP'sini Bul:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Avantajları:**
- Continuity Camera gerekmez
- Native iOS kamera erişimi
- Daha yüksek çözünürlük

**Dezavantajları:**
- Backend Mac'te çalışmalı
- iPhone Safari'de bounding box görünmez (backend Mac'te çalışıyor)

---

#### Yöntem 3: Backend'i iPhone Kamerası ile Başlat

**Device ID'yi Bul:**

```bash
# Python script ile kamera listesi
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
source venv/bin/activate

python3 << 'EOF'
import cv2
for i in range(10):
    cap = cv2.VideoCapture(i)
    if cap.isOpened():
        ret, frame = cap.read()
        if ret:
            print(f"Camera {i}: {frame.shape}")
        cap.release()
EOF
```

**Backend'i iPhone ile Başlat:**

```bash
# Continuity Camera genelde device 1 veya 2
./scripts/start-camera-backend.sh 1 5001

# Veya
./scripts/start-camera-backend.sh 2 5001
```

---

## 📺 YouTube URL (Sorun 3)

### Neden Çalışmıyor?

YouTube stream'leri özel bir araç gerektirir: `yt-dlp`

### Kurulum:

```bash
# yt-dlp kur (ilk kez)
brew install yt-dlp

# Test et
yt-dlp --version
```

### Kullanım:

**1. YouTube Video URL'si Al:**
```
Örnek: https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

**2. Frontend'de URL Gir:**
```
1. Camera Analytics → Settings (⚙️)
2. Advanced → Stream URL input
3. YouTube URL'sini yapıştır
4. "Connect" tıkla
```

**3. Backend Komutunu Kopyala:**

Frontend bir mesaj gösterir:
```
Stream URL requires backend processing.

Run in terminal:
./scripts/start-camera-backend.sh "https://youtube.com/..." 5001
```

**4. Komut Düzelt ve Çalıştır:**

```bash
cd /Users/partalle/Projects/ObservAI

# Örnek:
./scripts/start-camera-backend.sh "https://www.youtube.com/watch?v=dQw4w9WgXcQ" 5001
```

**5. Backend Loglarını İzle:**

```
✓ WebSocket server started on 0.0.0.0:5001
🌐 Using stream URL: https://youtube.com/...
[youtube] Extracting URL: https://youtube.com/...
[youtube] dQw4w9WgXcQ: Downloading webpage
[INFO] Stream resolution: 1280x720
[INFO] Starting camera analytics pipeline...
```

---

### YouTube Sorun Giderme

#### Hata: "yt-dlp: command not found"

```bash
brew install yt-dlp
```

#### Hata: "Video unavailable" veya "Private video"

- Video genel (public) olmalı
- Live stream bitmiş olabilir
- Farklı bir video dene

#### Hata: "Sign in to confirm your age"

- Yaş kısıtlamalı videolar çalışmaz
- 18+ içerik yt-dlp ile erişilemez
- Alternatif video kullan

#### Hata: "HTTP Error 403: Forbidden"

```bash
# yt-dlp'yi güncelle
brew upgrade yt-dlp

# Yeniden dene
```

---

### Alternatif: RTSP Stream

YouTube yerine RTSP camera stream:

```bash
./scripts/start-camera-backend.sh "rtsp://admin:password@192.168.1.100:554/stream" 5001
```

---

## 🎨 Zone Labeling Kamera Görüntüsü (Sorun 4)

### Sorun:
"No active camera feed found" hatası

### Çözüm Adımları:

**1. Önce Kamerayı Başlat:**
```
1. Camera Analytics sayfasına git
2. LIVE moduna geç (sağ üst toggle)
3. Settings → MacBook Cam seçili olmalı
4. Video akışının göründüğünden emin ol
5. "Backend Connected" yeşil olmalı
```

**2. Zone Labeling'e Git:**
```
1. Sol menü → Zone Labeling
2. "Capture Camera" butonu tıkla
3. Kamera görüntüsü arka planda görünmeli
```

**3. Hala Çalışmıyorsa:**

Browser Console'u aç (F12):

```javascript
// Video element'i manuel kontrol et
document.querySelectorAll('video').forEach((v, i) => {
  console.log(`Video ${i}:`, {
    readyState: v.readyState,
    paused: v.paused,
    width: v.videoWidth,
    height: v.videoHeight
  });
});

// readyState >= 2 ve videoWidth > 0 olmalı
```

**4. Video Element Yoksa:**
- Camera Analytics sayfasına dön
- Hard refresh: Cmd+Shift+R
- Tekrar Live moda geç
- Video oynatmaya başlayana kadar bekle

**5. Zone Çizme:**
```
1. "Add Zone" tıkla
2. Fare ile dikdörtgen çiz
3. Sağ panelden zone'u düzenle
4. "Save All" tıkla
5. Camera Analytics'e dön → Zone overlays görünmeli
```

---

## 🧪 Test Senaryoları

### Test 1: MacBook Kamerası + Backend

```bash
# Terminal 1
cd /Users/partalle/Projects/ObservAI
./scripts/start-camera-backend.sh 0 5001

# Terminal 2
cd frontend && npm run dev

# Browser: http://localhost:5173
# Kameranın önüne geç
# Beklenen: "Detected: 1", bounding box, M/F | Age | Time
```

**Başarı Kriterleri:**
- [ ] "Backend Connected" yeşil
- [ ] "Detected: X" değişiyor
- [ ] Bounding box çiziliyor
- [ ] Demografik bilgiler: `M | 18-35 | 45s`
- [ ] Gender Chart ve Age Chart güncelleniyor

---

### Test 2: iPhone Kamerası (Continuity)

```bash
# iPhone'u Mac'e bağla (USB veya Wi-Fi)
# Continuity Camera aktif olmalı

# Terminal
./scripts/start-camera-backend.sh 1 5001  # veya 2

# Browser
# Settings → iPhone seç
# Video akışı iPhone'dan gelmeli
```

**Başarı Kriterleri:**
- [ ] "Live from iPhone Camera" yazısı
- [ ] Video iPhone kamerasından
- [ ] Backend detections çalışıyor

---

### Test 3: YouTube Stream

```bash
# yt-dlp kur
brew install yt-dlp

# Public YouTube video URL al
# Frontend'de Advanced → Stream URL → Paste → Connect

# Terminal
./scripts/start-camera-backend.sh "https://youtube.com/..." 5001

# Backend loglarında "youtube" extraction mesajları görülmeli
```

**Başarı Kriterleri:**
- [ ] Backend YouTube stream'i çekiyor
- [ ] Video oynatılıyor
- [ ] Detections çalışıyor (video içinde insan varsa)

---

### Test 4: Zone Labeling

```bash
# 1. Backend çalışıyor olmalı
# 2. Frontend Live mode

# Browser steps:
1. Camera Analytics → Live mode → Video oynatılıyor
2. Zone Labeling → "Capture Camera"
3. Arka plan görüntüsü görünmeli
4. "Add Zone" → Dikdörtgen çiz
5. "Save All"
6. Camera Analytics'e dön
7. Video üzerinde yeşil kesikli çizgiler (zones)
```

**Başarı Kriterleri:**
- [ ] Kamera görüntüsü yakalanıyor
- [ ] Zone çizilebiliyor
- [ ] Zone kaydediliyor
- [ ] Camera feed'de zone overlays görünüyor

---

## 🐛 Genel Sorun Giderme

### Backend Crash Oluyor

**Semptom:** "cv2.error: Unknown C++ exception"

**Çözüm:** `--display` flag'ini KULLANMA
```bash
# YANLIŞ
./scripts/start-camera-backend.sh 0 5001 --display

# DOĞRU
./scripts/start-camera-backend.sh 0 5001
```

---

### Port Zaten Kullanımda

**Hata:** `OSError: [Errno 48] address already in use`

**Çözüm:**
```bash
# Port 5001'i temizle
sudo lsof -ti :5001 | xargs kill -9

# Veya farklı port kullan
./scripts/start-camera-backend.sh 0 5002
```

---

### Backend Bağlanamıyor

**Frontend:** "Backend Offline" (sarı)

**Çözüm:**
```bash
# 1. Backend çalışıyor mu?
lsof -i :5001

# 2. .env dosyası doğru mu?
cat frontend/.env
# VITE_BACKEND_URL=http://localhost:5001 olmalı

# 3. Frontend'i restart et
cd frontend
npm run dev
```

---

### YOLO Model İnmiyor

**Hata:** "Failed to download yolov8n.pt"

**Çözüm:**
```bash
# Manuel indir
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
wget https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.pt

# Backend'i tekrar başlat
cd /Users/partalle/Projects/ObservAI
./scripts/start-camera-backend.sh 0 5001
```

---

## 📊 Log Örnekleri

### Başarılı Backend Başlangıcı

```
✓ WebSocket server started on 0.0.0.0:5001
[INFO] InsightFace initialized (buffalo_s model)
[INFO] Starting camera analytics pipeline...
1/1: 0... Success ✅ (inf frames of shape 1920x1080 at 30.00 FPS)
[INFO] Processing frames... FPS: 28.5
[INFO] Client connected: abc123
```

### Başarılı Detection

```
[INFO] Detections: 1 people
[INFO] Track track_456: male, young (age: 28.3), 15.2s
[INFO] Demographics: M, 18-35, inside
[INFO] Emitting to 1 clients
```

### Frontend Console (Success)

```
[CameraBackend] Connected to backend
[CameraBackend] Connection confirmed
[CameraFeed] Received detections: 1
[LiveDataProvider] Analytics update: {current: 1, entries: 5}
```

---

## ✅ Final Checklist

System çalışıyor mu?

- [ ] Backend port 5001'de çalışıyor
- [ ] Frontend http://localhost:5173 açılıyor
- [ ] Login yapılıyor (admin@observai.com)
- [ ] Camera Analytics → Live mode çalışıyor
- [ ] "Backend Connected" yeşil
- [ ] MacBook kamerası video gösteriyor
- [ ] Kameranın önüne geçince "Detected: 1+"
- [ ] Bounding box çiziliyor
- [ ] Demografik label: `M | 18-35 | 45s`
- [ ] Gender Chart güncelleniyor
- [ ] Age Chart güncelleniyor
- [ ] Zone Labeling kamera görüntüsü yakalıyor
- [ ] Zone çizilebiliyor ve kaydediliyor
- [ ] Camera feed'de zone overlays görünüyor

---

**Tüm checkboxlar işaretliyse: SİSTEM TAMAMEN ÇALIŞIYOR! 🎉**

**Sorun devam ediyorsa:** Bu dokümandaki adımları sırayla takip et, log çıktılarını kontrol et.

