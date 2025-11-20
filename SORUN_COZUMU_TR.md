# Sorun Çözümü - ObservAI Kamera Sistemi

**Tarih:** 16 Kasım 2025  
**Tespit Edilen Sorunlar:** 4 adet

---

## 🔴 Tespit Edilen Sorunlar

### 1. Backend Çalışmıyor ❌
**Semptom:** "Backend Offline" yazıyor, "Detected: 0" kalıyor

**Neden:** Backend hiç başlatılmamış

### 2. iPhone Kamerası Bağlanmıyor ❌
**Semptom:** "No secondary camera found" hatası

**Neden:** Continuity Camera kurulu değil veya iPhone bağlı değil (Bu normal)

### 3. YouTube URL Girişi Gözükmüyor ❌
**Semptom:** Stream URL input field görünmüyor

**Neden:** Frontend yeni kod değişikliklerini yüklememiş, "Advanced" butonu yok

### 4. Zone Labeling Görüntü Yok ❌
**Semptom:** "No active camera feed found" hatası

**Neden:** Kamera çalışmıyor (backend offline olduğu için)

---

## ✅ Çözüm Adımları

### ADIM 1: Backend'i Başlat

**Terminal 1'de çalıştır:**

```bash
cd /Users/partalle/Projects/ObservAI

# Önce script'e çalıştırma izni ver (sadece ilk kez)
chmod +x scripts/start-camera-backend.sh

# Backend'i başlat
./scripts/start-camera-backend.sh 0 5000 --display
```

**Beklenen Çıktı:**
```
================================================
 ObservAI Camera Analytics Backend
================================================

✓ Virtual environment found
Configuration:
  Source: 0
  WebSocket Port: 5000
  Display: --display

🚀 Starting camera analytics backend...
   Backend will be available at: http://localhost:5000
   
[INFO] Starting camera analytics pipeline...
[INFO] YOLO model loaded: yolov8n.pt
[INFO] WebSocket server started on 0.0.0.0:5000
```

**⚠️ Eğer hata alırsan:**

```bash
# Virtual environment yoksa:
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
python3 -m venv .venv
source .venv/bin/activate
pip install -e .

# Sonra backend'i tekrar başlat
cd /Users/partalle/Projects/ObservAI
./scripts/start-camera-backend.sh 0 5000 --display
```

---

### ADIM 2: Frontend'i Yeniden Başlat

**Terminal 2'de çalıştır:**

```bash
cd /Users/partalle/Projects/ObservAI/frontend

# Önce çalışan Vite sunucusunu durdur (Ctrl+C ile)
# Sonra yeniden başlat:

npm run dev
```

**Beklenen Çıktı:**
```
  VITE v5.4.8  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

### ADIM 3: Browser'ı Yenile ve Test Et

1. **Tarayıcıda:** http://localhost:5173
2. **Hard Refresh yap:** `Cmd + Shift + R` (Mac) veya `Ctrl + Shift + R` (Windows)
3. **Login:** admin@observai.com / demo1234
4. **Camera Analytics** sayfasına git
5. **Live** moduna geç (sağ üstteki toggle)

---

## 🧪 Test Senaryoları

### Test 1: MacBook Kamerası ✅

**Adımlar:**
1. Backend çalışıyor olmalı (Terminal 1'de loglar akıyor)
2. Frontend'de "Backend Connected" yeşil yazmalı
3. Kameranın önüne geç
4. **Beklenen Sonuç:**
   - "Detected: 1" yazmalı (sağ altta)
   - Etrafında yeşil/mavi kutu çizilmeli
   - ♂ veya ♀ simgesi ve yaş gösterilmeli
   - "Current Visitors: 1" yazmalı

**Backend Terminal'de göreceğin:**
```
[INFO] Detections: 1 people
[INFO] Track track_123: male, adult, 5.2s
[INFO] Emitting analytics: current=1
```

---

### Test 2: Advanced Settings (YouTube, IP Camera) ✅

**Adımlar:**
1. Kamera kartında **Settings ikonu** (⚙️) tıkla
2. **"Advanced"** linkine tıkla
3. **Beklenen Sonuç:**
   - Stream URL input field görünmeli
   - File picker görünmeli
   - IP Camera listesi görünmeli

**Eğer "Advanced" butonu görünmüyorsa:**
- Frontend yeniden başlatılmamış
- Browser cache'i temizle: `Cmd + Shift + Delete`
- Hard refresh: `Cmd + Shift + R`

---

### Test 3: Zone Labeling ✅

**Adımlar:**
1. **Önce kamera çalışıyor olmalı** (Camera Analytics → Live mode → MacBook Cam)
2. Sol menüden **"Zone Labeling"** tıkla
3. **"Capture Camera"** butonuna tıkla
4. **Beklenen Sonuç:**
   - Kamera görüntüsü arka planda görünmeli
   - "Capture Failed" hatası OLMAMALI

**Eğer "No active camera feed found" hatası alırsan:**
- Camera Analytics sayfasına dön
- Kameranı Live modda başlat
- Video oynatılıyor olmalı
- Sonra Zone Labeling'e geri gel

---

### Test 4: Zone Çizme ✅

**Adımlar:**
1. Zone Labeling sayfasında kamera görüntüsü arka planda
2. **"Add Zone"** tıkla
3. Fare ile dikdörtgen çiz
4. Sağ panelden zone'u seç
5. İsim ver: "Test Bölgesi"
6. Tip seç: "Entrance"
7. **"Save All"** tıkla
8. **Camera Analytics** sayfasına dön
9. **Beklenen Sonuç:**
   - Video üzerinde yeşil kesik çizgili dikdörtgen görünmeli
   - "Test Bölgesi" yazısı olmalı

---

## 📋 Kontrol Listesi

Backend başarılı çalışıyor mu?
- [ ] Terminal'de `[INFO] WebSocket server started on 0.0.0.0:5000` yazıyor
- [ ] Terminal'de `[INFO] Processing frame... FPS: XX` yazıyor
- [ ] OpenCV penceresi açılıyor (--display ile çalıştırdıysan)

Frontend yeni kodu yükledi mi?
- [ ] Settings ikonuna tıkladığında "Advanced" butonu görünüyor
- [ ] Advanced'e tıkladığında "Stream URL" input field var
- [ ] Advanced'de "Local Video File" file picker var
- [ ] Advanced'de "IP Cameras" bölümü var

Kamera çalışıyor mu?
- [ ] Video akışı görünüyor
- [ ] "Backend Connected" yeşil yazıyor
- [ ] Kameranın önüne geçince "Detected: 1" oluyor
- [ ] Bounding box çiziliyor

Zone Labeling çalışıyor mu?
- [ ] "Capture Camera" tıklandığında kamera görüntüsü arka planda
- [ ] Zone çizilebiliyor
- [ ] Zone kaydediliyor
- [ ] Camera Analytics'te zone overlays görünüyor

---

## 🐛 Hala Sorun Varsa

### Backend başlamıyor

**Hata: "ModuleNotFoundError: No module named 'camera_analytics'"**

```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

**Hata: "No module named 'cv2'"**

```bash
pip install opencv-python
```

**Hata: "No module named 'ultralytics'"**

```bash
pip install ultralytics
```

**Hata: "Address already in use"**

```bash
# Port 5000 kullanımda, başka bir port dene:
./scripts/start-camera-backend.sh 0 5001 --display

# Frontend .env dosyasını güncelle:
# VITE_BACKEND_URL=http://localhost:5001
```

---

### Frontend yeni kodu yüklemedi

**Çözüm 1: Hard Refresh**
```
Cmd + Shift + R (Mac)
Ctrl + Shift + R (Windows)
```

**Çözüm 2: Cache Temizle**
1. Chrome DevTools aç (F12)
2. Network sekmesi
3. "Disable cache" işaretle
4. Sayfayı yenile

**Çözüm 3: Rebuild**
```bash
cd /Users/partalle/Projects/ObservAI/frontend
rm -rf node_modules/.vite
npm run dev
```

---

### Kamera izni yok

**macOS ayarlarından:**
1. System Settings → Privacy & Security → Camera
2. Chrome/Safari'yi etkinleştir
3. Tarayıcıyı yeniden başlat

---

### Zone Labeling görüntü yakalamıyor

**Nedeni:** Video element bulunamıyor

**Çözüm:**
1. Camera Analytics sayfasına git
2. Live moda geç
3. Kamerayı başlat (Settings → MacBook Cam)
4. Video oynatılıyor olmalı
5. Zone Labeling'e git
6. "Capture Camera" tıkla

---

## 📞 Yardım İçin Logları Kontrol Et

### Backend Logları

Terminal 1'de görmelisin:
```
[INFO] Starting camera analytics pipeline...
[INFO] Camera source: 0
[INFO] YOLO model loaded: yolov8n.pt
[INFO] Client connected: abc123
[INFO] Processing frame... FPS: 28.5
[INFO] Detections: 1 people
```

### Frontend Logları

Browser Console'da (F12) görmelisin:
```
[CameraBackend] Connecting to http://localhost:5000...
[CameraBackend] Connected to backend
[CameraFeed] Received detections: 1
```

---

## ✅ Başarı Kriterleri

**Tüm bunlar çalışıyorsa sistem hazır:**

1. ✅ Backend terminal'de "WebSocket server started" yazıyor
2. ✅ Frontend'de "Backend Connected" yeşil gösterge
3. ✅ Kameranın önüne geçince "Detected: 1" oluyor
4. ✅ Bounding box ve demographics gösteriliyor
5. ✅ Settings → Advanced → Stream URL input görünüyor
6. ✅ Zone Labeling'de kamera görüntüsü yakalanabiliyor
7. ✅ Zone çiziliyor ve kaydediliyor
8. ✅ Camera Analytics'te zone overlays görünüyor

---

## 🚀 Özet: En Hızlı Çözüm

```bash
# Terminal 1: Backend
cd /Users/partalle/Projects/ObservAI
./scripts/start-camera-backend.sh 0 5000 --display

# Terminal 2: Frontend (yeni terminal)
cd /Users/partalle/Projects/ObservAI/frontend
npm run dev

# Browser: Hard refresh
# Cmd + Shift + R
```

**Bu 3 adım sonrası her şey çalışmalı!**

---

**Sorun çözüldüyse:** `SESSION_4_COMPLETE.md` dosyasındaki test checklistini doldur.

**Hala sorun varsa:** Console loglarını ve backend terminal çıktısını kontrol et.

