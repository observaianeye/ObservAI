# ObservAI - Hızlı Başlangıç Kılavuzu

## 🚀 Sistemi Başlatma

### Yöntem 1: Otomatik Script'ler (Önerilen)

**macOS/Linux:**
```bash
# Tüm servisleri tek seferde başlat
./start-all.sh

# Servisleri durdurmak için
./stop-all.sh
```

**Windows:**
```cmd
REM Tüm servisleri tek seferde başlat
start-all.bat

REM Servisleri durdurmak için
stop-all.bat
```

**Alternatif - Ayrı Script'ler:**

**macOS/Linux:**
```bash
# Terminal 1 - Backend
./start-backend.sh

# Terminal 2 - Frontend
./start-frontend.sh
```

**Windows:**
```cmd
REM Terminal 1 - Backend
start-backend.bat

REM Terminal 2 - Frontend
start-frontend.bat
```

### Yöntem 2: Manuel Başlatma

**macOS/Linux - Backend:**
```bash
cd packages/camera-analytics
source venv/bin/activate    # Virtual environment'ı aktif et
python3 -m camera_analytics.run_with_websocket --source 0
```

**Windows - Backend:**
```cmd
cd packages\camera-analytics
venv\Scripts\activate.bat    REM Virtual environment'ı aktif et
python -m camera_analytics.run_with_websocket --source 0
```

**Frontend (Tüm Platformlar):**
```bash
cd frontend
pnpm dev
```

## 📹 Kamera Seçimi

### MacBook Kamerası
- Source: **Webcam**
- Index: `0`
- Her zaman çalışır

### iPhone Kamerası (Continuity Camera)
1. iPhone'u USB ile bağla VEYA aynı WiFi ağına bağla
2. macOS'ta Continuity Camera etkin olmalı
3. Source: **iPhone**
4. Sistem otomatik olarak doğru kamera index'ini bulacak

### YouTube Live Stream
1. Source: **Video Link**
2. YouTube Live URL'ini yapıştır
3. Otomatik retry mekanizması ile stream başlatılır

## 🐛 Sorun Giderme

### "No module named 'lap'" Hatası

**macOS/Linux:**
```bash
cd packages/camera-analytics
venv/bin/pip install lap
```

**Windows:**
```cmd
cd packages\camera-analytics
venv\Scripts\activate.bat
pip install lap
```

### Kamera Siyah Ekran
**Backend loglarını kontrol et:**
- `[INFO] ✓ Camera found at index X` - Hangi kameraların bulunduğunu gösterir
- `[ERROR] Camera opened but cannot read frames` - Kamera açık ama frame gelmiyor
- `[INFO] Using camera at index X for iPhone` - iPhone hangi index'te

**Çözüm:**
1. Backend'i durdur (Ctrl+C)
2. 5 saniye bekle (kamera release için)
3. Backend'i tekrar başlat: `./start-backend.sh`

### Overlay Yanıp Sönüyor
- **AI Insights** butonu ile LIVE ANALYTICS ve DEMOGRAPHICS panellerini kontrol et
- **Heatmap** butonu ile heatmap overlay'i ayrı olarak kontrol et
- Her ikisi de bağımsız çalışır

### Frontend Bağlanamıyor
1. Backend'in çalıştığını doğrula: `http://localhost:5001` açık olmalı
2. Browser console'da hata var mı kontrol et (F12)
3. Backend'i yeniden başlat

## ✨ Yeni Özellikler

### Bağımsız Overlay Kontrolleri
- **AI Insights** (mavi buton): LIVE ANALYTICS + DEMOGRAPHICS panelleri
- **Heatmap** (mor buton): Heatmap overlay'i
- Her biri ayrı ayrı açılıp kapatılabilir
- Artık yanıp sönme sorunu yok!

### Akıllı Kamera Keşfi
- iPhone kamerası otomatik olarak bulunur
- Index sorunları otomatik çözülür
- Detaylı log output'ları ile hata ayıklama kolay

### Stream Retry Mekanizması
- YouTube stream'leri otomatik yeniden denenir
- Exponential backoff: 1s, 2s, 4s gecikme ile 3 deneme
- Network sorunlarında daha kararlı çalışır

### Kamera Geçiş Süresi
- MacBook ↔ iPhone geçişi için 5 saniyelik temizleme süresi
- "Switching camera source..." loading ekranı
- Artık dual camera sorunu yok

## 📊 Sistem Gereksinimleri

- **macOS/Linux/Windows** (Windows için: [WINDOWS_SETUP.md](../WINDOWS_SETUP.md))
- Python 3.11+ (virtual environment içinde)
- Node.js 18+ + pnpm (frontend için)
- Minimum 8GB RAM
- Webcam (Windows'ta DirectShow uyumlu)
- **macOS özel:** iPhone (Continuity Camera) desteği

## 🎯 İlk Çalıştırma Checklist

**macOS/Linux:**
- [ ] Tüm servisleri başlat: `./start-all.sh` (veya ayrı script'ler)
- [ ] Backend başladığını doğrula (log'larda "WebSocket server started")
- [ ] Browser'da açılan sayfaya git (genellikle http://localhost:5173)
- [ ] MacBook kamerasını test et (Webcam seçeneği)
- [ ] AI Insights ve Heatmap butonlarını test et
- [ ] iPhone kamerasını bağla ve test et (opsiyonel)

**Windows:**
- [ ] Tüm servisleri başlat: `start-all.bat`
- [ ] Backend başladığını doğrula (log dosyalarını kontrol et: `logs\`)
- [ ] Browser'da açılan sayfaya git (genellikle http://localhost:5173)
- [ ] Webcam'i test et (Source: 0)
- [ ] AI Insights ve Heatmap butonlarını test et
- [ ] Detaylı kurulum için: [WINDOWS_SETUP.md](../WINDOWS_SETUP.md)

## 💡 İpuçları

1. **Backend önce başlatılmalı** - Frontend bağlanmadan önce backend hazır olmalı
2. **Kamera değiştirirken 5 saniye bekle** - Loading screen gösterir
3. **Virtual environment unutma** - Backend mutlaka venv içinde çalışmalı
   - **macOS/Linux:** `source venv/bin/activate`
   - **Windows:** `venv\Scripts\activate.bat`
4. **Log'ları takip et** - Sorun olursa:
   - **macOS/Linux:** Backend terminal'ine bak
   - **Windows:** `logs\` klasöründeki log dosyalarını kontrol et
5. **Windows kullanıcıları:** Detaylı kurulum ve sorun giderme için [WINDOWS_SETUP.md](../WINDOWS_SETUP.md) dosyasına bakın

---

Sorularınız için: [GitHub Issues](https://github.com/anthropics/claude-code/issues)
