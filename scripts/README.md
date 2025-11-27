# Scripts - Yardımcı Betikler

Bu klasör, ObservAI projesinin çeşitli bileşenlerini başlatmak ve yönetmek için kullanılan shell scriptlerini içerir.

## İçindeki Dosyalar

### start-camera-backend.sh
Python kamera backend'ini başlatan script:
- Virtual environment aktivasyonu
- Bağımlılık kontrolü
- WebSocket sunucusu başlatma
- Port 5000'de çalışır
- Hata yönetimi ve loglama

**Kullanım:**
```bash
chmod +x scripts/start-camera-backend.sh
./scripts/start-camera-backend.sh
```

### start_camera.sh
Kamera görüntü işleme pipeline'ını başlatır:
- Kamera kaynağını yapılandırır
- Bölge konfigürasyonunu yükler
- Metrik çıktısı ayarlar
- Display modunu etkinleştirir/devre dışı bırakır

**Kullanım:**
```bash
chmod +x scripts/start_camera.sh
./scripts/start_camera.sh
```

### start_camera_websocket.sh
WebSocket desteği ile kamera backend'ini başlatır:
- Frontend entegrasyonu için optimize edilmiş
- Gerçek zamanlı frame streaming
- Otomatik yeniden başlatma
- Hata toleransı

**Kullanım:**
```bash
chmod +x scripts/start_camera_websocket.sh
./scripts/start_camera_websocket.sh
```

## Ne İçin Kullanılır?

Bu scriptler şunlar için kullanılır:
- **Hızlı Başlatma** - Komponentleri tek komutla başlatma
- **Ortam Yönetimi** - Virtual environment ve bağımlılık kontrolü
- **Konfigürasyon** - Varsayılan parametreleri uygulama
- **Hata Yönetimi** - Graceful shutdown ve hata yakalama
- **Otomasyon** - Geliştirme ve deployment süreçlerini otomatikleştirme

## Script Çalıştırma İzinleri

Scriptleri çalıştırmadan önce execute izni verin:

```bash
chmod +x scripts/*.sh
```

## Özelleştirme

Scriptleri kendi ihtiyaçlarınıza göre düzenleyebilirsiniz:
- Kamera kaynağını değiştirin (webcam index veya video path)
- Port numaralarını ayarlayın
- Bölge konfigürasyon dosyasını güncelleyin
- Display modunu açın/kapatın
- Log seviyesini değiştirin

## Örnek Kullanım Senaryoları

### Geliştirme Ortamı
```bash
# Terminal 1: Frontend
cd frontend && pnpm dev

# Terminal 2: Python Backend
./scripts/start-camera-backend.sh

# Terminal 3: Backend API (opsiyonel)
cd backend && pnpm dev
```

### Production Ortamı
```bash
# Headless mod (display olmadan)
./scripts/start_camera_websocket.sh --no-display

# Farklı port ile
PORT=5001 ./scripts/start-camera-backend.sh
```

### Test Ortamı
```bash
# Video dosyası ile test
SOURCE_VIDEO="test_video.mp4" ./scripts/start_camera.sh
```

## Sorun Giderme

### Script Çalışmıyor
```bash
# İzinleri kontrol et
ls -la scripts/

# İzin ver
chmod +x scripts/start-camera-backend.sh
```

### Virtual Environment Bulunamıyor
```bash
# Manuel olarak oluştur
cd packages/camera-analytics
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

### Port Kullanımda
```bash
# Kullanılan portu bul ve sonlandır
lsof -i :5000
kill -9 <PID>
```

## Notlar

- Tüm scriptler bash shell için yazılmıştır
- macOS ve Linux üzerinde test edilmiştir
- Windows için Git Bash veya WSL kullanın
- Production ortamında systemd veya PM2 kullanımı önerilir
