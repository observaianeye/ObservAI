# ObservAI - Kamera Analitik Platformu

ObservAI, gerçek zamanlı kamera görüntülerinden ziyaretçi analitiği, demografik bilgiler ve akıllı bölge takibi sağlayan modern bir kamera analitik platformudur.

## 📋 İçindekiler

- [Proje Hakkında](#proje-hakkında)
- [Özellikler](#özellikler)
- [Teknoloji Stack](#teknoloji-stack)
- [Proje Yapısı](#proje-yapısı)
- [İlk Kurulum](#ilk-kurulum)
- [Mevcut Projeyi Çalıştırma](#mevcut-projeyi-çalıştırma)
- [Bileşenler ve İşlevleri](#bileşenler-ve-i̇şlevleri)
- [Özellik - Kod Eşleştirmesi](#özellik---kod-eşleştirmesi)
- [Kullanım Senaryoları](#kullanım-senaryoları)
- [Sorun Giderme](#sorun-giderme)
- [Geliştirme Notları](#geliştirme-notları)

---

## 🎯 Proje Hakkında

ObservAI, yapay zeka destekli kamera analitikleri ile işletmelerin ziyaretçi davranışlarını anlamalarına yardımcı olan bir platformdur. Sistem üç ana bileşenden oluşur:

1. **Frontend (React)** - Kullanıcı arayüzü ve dashboard
2. **Backend (Node.js/Express)** - REST API ve veritabanı yönetimi
3. **Camera Analytics (Python)** - Görüntü işleme ve AI motoru

## ✨ Özellikler

### ✅ Tam Çalışan Özellikler (%20 - Production Ready)

#### 1. Kimlik Doğrulama (UC-01)
- Kullanıcı girişi ve oturum yönetimi
- Supabase ile güvenli kimlik doğrulama
- Demo hesap: `admin@observai.com` / `demo1234`

#### 2. Kamera Analitik Dashboard (UC-02)
- **Canlı Kamera Görüntüsü**: WebSocket üzerinden gerçek zamanlı video akışı
- **Isı Haritası**: Overlay ile yoğunluk gösterimi
- **Cinsiyet Dağılımı**: Donut chart ile görselleştirme
- **Yaş Dağılımı**: Bar chart ile kategorik gösterim
- **Ziyaretçi Sayacı**: Otomatik güncellenen widget
- **Bekleme Süresi Analizi**: Real-time dwell time metrikleri

#### 3. Bölge Etiketleme (UC-08)
- İnteraktif canvas üzerinde bölge çizimi
- Giriş/çıkış noktalarını tanımlama
- Bölgeleri düzenleme, silme ve kaydetme
- Konfigürasyon yönetimi

### 🚧 Kısmi Tamamlanmış Özellikler (%80)
- Kamera Seçimi
- AI Öngörüleri
- Geçmiş Analitikler
- Bildirimler
- Ayarlar

---

## 🛠 Teknoloji Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Tip güvenliği
- **Vite** - Build tool ve dev server
- **Tailwind CSS** - Styling
- **ECharts** - Grafik ve görselleştirme
- **React Router** - Routing
- **Socket.io-client** - WebSocket bağlantısı
- **Supabase** - Authentication

### Backend API
- **Node.js 18+** - Runtime
- **Express.js** - Web framework
- **TypeScript** - Tip güvenliği
- **Prisma** - ORM
- **PostgreSQL** - Veritabanı
- **JWT** - Token authentication

### Camera Analytics (Python)
- **Python 3.9+** - Core language
- **YOLO v8** - İnsan tespiti
- **InsightFace** - Yaş/cinsiyet analizi
- **OpenCV** - Görüntü işleme
- **WebSocket** - Real-time streaming
- **NumPy** - Numerical computing

---

## 📁 Proje Yapısı

```
ObservAI/
├── frontend/                  # React web uygulaması
│   ├── src/
│   │   ├── components/       # UI bileşenleri
│   │   │   ├── camera/       # Kamera widget'ları
│   │   │   └── layout/       # Sayfa düzeni
│   │   ├── pages/            # Sayfa bileşenleri
│   │   ├── services/         # API servisleri
│   │   ├── contexts/         # React contexts
│   │   └── App.tsx           # Ana uygulama
│   └── README.md             # Frontend dokümantasyonu
│
├── backend/                   # Node.js API sunucusu
│   ├── src/
│   │   ├── routes/           # API endpoint'leri
│   │   ├── controllers/      # İş mantığı
│   │   └── server.ts         # Ana sunucu
│   ├── prisma/
│   │   └── schema.prisma     # Veritabanı şeması
│   └── README.md             # Backend dokümantasyonu
│
├── packages/
│   └── camera-analytics/      # Python görüntü işleme
│       ├── camera_analytics/
│       │   ├── run.py        # CLI tool
│       │   ├── run_with_websocket.py  # WebSocket modu
│       │   ├── detector.py   # YOLO detector
│       │   ├── demographics.py # Yaş/cinsiyet
│       │   └── tracker.py    # Object tracking
│       ├── config/
│       │   └── default_zones.yaml
│       └── README.md         # Python dokümantasyonu
│
├── scripts/                   # Yardımcı betikler
│   ├── start-camera-backend.sh
│   ├── start_camera.sh
│   └── README.md
│
├── docs/                      # Teknik dokümantasyon
│   ├── CAMERA_SOURCES_GUIDE.md
│   ├── ECHARTS_USAGE_GUIDE.md
│   ├── PROJECT_SUMMARY.md
│   └── README.md
│
├── web-dashboard/             # Basit HTML demo
│
├── Team12_InitialPlan_v2 .pdf    # İlk proje planı
├── Team12_Prototype_V1 .pdf      # Prototip dokümantasyonu
├── Team12_SRS_V1 .pdf            # Yazılım gereksinim belgesi
│
└── README.md                  # Bu dosya
```

Her klasörün kendi README.md dosyası vardır ve o klasördeki kodların ne işe yaradığını detaylı olarak açıklar.

---

## 🚀 İlk Kurulum

Projeyi ilk defa kuruyorsanız, aşağıdaki adımları sırasıyla takip edin.

### Ön Gereksinimler

#### Sistem Gereksinimleri
- **Node.js** 18 veya üstü
- **Python** 3.9 veya üstü
- **PostgreSQL** 15 veya üstü (Backend kullanacaksanız)
- **pnpm** (NPM package manager)
- **Git**

#### Kurulumlar

**macOS:**
```bash
# Homebrew ile
brew install node python@3.11 postgresql@15 pnpm

# PostgreSQL'i başlat
brew services start postgresql@15
```

**Linux (Ubuntu/Debian):**
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python
sudo apt-get install python3.11 python3.11-venv python3-pip

# PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# pnpm
npm install -g pnpm
```

**Windows:**
- Node.js: [nodejs.org](https://nodejs.org/)
- Python: [python.org](https://www.python.org/)
- PostgreSQL: [postgresql.org](https://www.postgresql.org/)
- pnpm: `npm install -g pnpm`

### 1. Repository'yi Klonlayın

```bash
git clone <repository-url>
cd ObservAI
```

### 2. Frontend Kurulumu

```bash
cd frontend
pnpm install
```

**Ortam Değişkenleri:**

`frontend/.env` dosyası oluşturun:

```env
VITE_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJib2x0IiwicmVmIjoiMGVjOTBiNTdkNmU5NWZjYmRhMTk4MzJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODE1NzQsImV4cCI6MTc1ODg4MTU3NH0.9I8-U0x86Ak8t2DGaIk0HfvTSLsAyzdnz-Nw00mMkKw
```

### 3. Python Camera Analytics Kurulumu

```bash
cd ../packages/camera-analytics

# Virtual environment oluştur
python3 -m venv .venv

# Aktive et (macOS/Linux)
source .venv/bin/activate

# Aktive et (Windows)
# .venv\Scripts\activate

# Bağımlılıkları kur
pip install --upgrade pip
pip install -e .
```

İlk çalıştırmada YOLO ve InsightFace modelleri otomatik indirilecektir (~200 MB).

### 4. Backend API Kurulumu (Opsiyonel)

Backend'i sadece veritabanı ile çalışmak istiyorsanız kurun:

```bash
cd ../../backend
pnpm install

# Veritabanı oluştur
createdb observai

# .env dosyası oluştur
cat > .env << EOF
DATABASE_URL="postgresql://localhost:5432/observai?schema=public"
JWT_SECRET="your-secret-key-change-this"
PORT=3001
EOF

# Migration'ları çalıştır
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 5. İlk Çalıştırma Testi

Kurulumun başarılı olduğunu test edin:

```bash
# Terminal 1: Python Backend
cd packages/camera-analytics
source .venv/bin/activate
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5000

# Terminal 2: Frontend
cd frontend
pnpm dev
```

Tarayıcıda `http://localhost:5173` adresine gidin ve giriş yapın:
- Email: `admin@observai.com`
- Şifre: `demo1234`

---

## 🎮 Mevcut Projeyi Çalıştırma

Projeyi daha önce kurdunuz ve tekrar çalıştırmak istiyorsanız:

### Temel Senaryo: Frontend + Python Backend

Çoğu kullanım için bu yeterlidir:

```bash
# Terminal 1: Python Camera Backend
cd packages/camera-analytics
source .venv/bin/activate  # Her seferinde aktive edin
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5000

# Terminal 2: Frontend
cd frontend
pnpm dev
```

Tarayıcıda: `http://localhost:5173`

### Tam Stack Senaryo: Frontend + Backend API + Python

Veritabanı özellikleri de kullanmak için:

```bash
# Terminal 1: PostgreSQL'in çalıştığından emin olun
brew services list  # macOS
# veya
sudo systemctl status postgresql  # Linux

# Terminal 2: Backend API
cd backend
pnpm dev  # http://localhost:3001

# Terminal 3: Python Camera Backend
cd packages/camera-analytics
source .venv/bin/activate
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5000

# Terminal 4: Frontend
cd frontend
pnpm dev  # http://localhost:5173
```

### Script ile Hızlı Başlatma

```bash
# Python backend'i başlat
./scripts/start-camera-backend.sh

# Veya
./scripts/start_camera_websocket.sh
```

### Headless Mod (Sunucu için)

Görüntü penceresi olmadan çalıştırma:

```bash
python -m camera_analytics.run_with_websocket \
  --source 0 \
  --ws-host 0.0.0.0 \
  --ws-port 5000
  # --display parametresini eklemiyoruz
```

### Production Build

```bash
# Frontend build
cd frontend
pnpm build
# Çıktı: frontend/dist/

# Backend build
cd backend
pnpm build
pnpm start
```

---

## 🧩 Bileşenler ve İşlevleri

### Frontend (React)

#### **Nedir?**
Kullanıcıların etkileşim kurduğu web arayüzü.

#### **Ne İşe Yarar?**
- Kullanıcı girişi
- Kamera görüntülerini gösterme
- Grafikleri çizme (yaş, cinsiyet dağılımı)
- Bölgeleri çizme ve yönetme
- Dashboard'u güncelleme

#### **Nasıl Çalışır?**
1. WebSocket ile Python backend'e bağlanır (port 5000)
2. Her saniye yeni frame ve metrik alır
3. ECharts ile grafikleri günceller
4. Canvas üzerinde bölgeleri render eder

#### **Port:**
- Dev: `http://localhost:5173`
- Build sonrası: Statik dosyalar

---

### Backend API (Node.js/Express)

#### **Nedir?**
REST API sunucusu ve veritabanı yönetimi.

#### **Ne İşe Yarar?**
- Kullanıcı hesaplarını yönetme
- Kamera konfigürasyonlarını kaydetme
- Bölge tanımlarını saklama
- Analitik verileri depolama
- Geçmiş raporlar oluşturma

#### **Nasıl Çalışır?**
1. Express.js ile HTTP endpoint'leri sağlar
2. Prisma ORM ile PostgreSQL'e bağlanır
3. JWT ile kullanıcı oturumlarını yönetir
4. Python backend'den gelen verileri kaydeder

#### **Port:**
- `http://localhost:3001`

#### **Ana Endpoint'ler:**
- `POST /api/analytics` - Analitik veri kaydet
- `GET /api/cameras` - Kameraları listele
- `POST /api/zones` - Bölge oluştur

---

### Camera Analytics (Python)

#### **Nedir?**
Görüntü işleme ve yapay zeka motoru.

#### **Ne İşe Yarar?**
- Webcam veya video'dan görüntü alma
- İnsanları tespit etme (YOLO v8)
- Yaş ve cinsiyet tahmini (InsightFace)
- Giriş/çıkış sayma
- Isı haritası oluşturma
- Bölge analitiği

#### **Nasıl Çalışır?**
1. OpenCV ile kamera görüntüsü yakalar
2. YOLO ile her frame'de insanları bulur
3. InsightFace ile yüzleri analiz eder
4. Takip algoritması ile giriş/çıkış sayar
5. WebSocket ile frame ve metrikleri frontend'e gönderir

#### **Port:**
- WebSocket: `ws://localhost:5000`

#### **Çıktı:**
- JSON formatında metrikler
- Base64 encode edilmiş JPEG frame'ler
- Real-time istatistikler

---

## 🗺 Özellik - Kod Eşleştirmesi

### 1. Canlı Kamera Görüntüsü

**Kullanıcı Görür:** Dashboard'da canlı video akışı

**Kod Nereden Geliyor:**

1. **Python Backend** (packages/camera-analytics/camera_analytics/run_with_websocket.py:45-80)
   - Webcam'den frame okur
   - JPEG'e encode eder
   - WebSocket ile gönderir

2. **Frontend Service** (frontend/src/services/cameraBackendService.ts:15-35)
   - WebSocket bağlantısı kurar
   - Frame'leri alır
   - Base64'ten decode eder

3. **React Component** (frontend/src/components/camera/CameraFeed.tsx:20-45)
   - Frame'i `<img>` tag'inde gösterir
   - Her saniye günceller

---

### 2. Cinsiyet Dağılımı Grafiği

**Kullanıcı Görür:** Donut chart (kadın/erkek oranı)

**Kod Nereden Geliyor:**

1. **Python AI Model** (packages/camera-analytics/camera_analytics/demographics.py:30-60)
   - InsightFace ile yüz analizi
   - Cinsiyet tahmini
   - Sayıları toplar

2. **WebSocket İletimi** (packages/camera-analytics/camera_analytics/websocket_server.py:55-70)
   - JSON metrik gönderir:
     ```json
     {
       "demographics": {
         "gender": {"male": 5, "female": 3}
       }
     }
     ```

3. **React Component** (frontend/src/components/camera/GenderChart.tsx:25-80)
   - ECharts donut chart render eder
   - Real-time güncelleme
   - Yüzdeleri hesaplar

---

### 3. Yaş Dağılımı Grafiği

**Kullanıcı Görür:** Bar chart (çocuk, genç, yetişkin, yaşlı)

**Kod Nereden Geliyor:**

1. **Python AI Model** (packages/camera-analytics/camera_analytics/demographics.py:65-95)
   - InsightFace yaş tahmini
   - Kategorilere ayırma:
     - 0-12: Çocuk
     - 13-25: Genç
     - 26-60: Yetişkin
     - 60+: Yaşlı

2. **React Component** (frontend/src/components/camera/AgeChart.tsx:30-100)
   - ECharts bar chart
   - X axis: Kategoriler
   - Y axis: Sayılar

---

### 4. Ziyaretçi Sayma (Giriş/Çıkış)

**Kullanıcı Görür:** Giren: 15, Çıkan: 8, Mevcut: 7

**Kod Nereden Geliyor:**

1. **Python Tracker** (packages/camera-analytics/camera_analytics/tracker.py:40-120)
   - YOLO tespit sonuçlarını takip eder
   - Her kişiye unique ID verir
   - Giriş/çıkış çizgilerini izler
   - Sayacı günceller

2. **Zone Manager** (packages/camera-analytics/camera_analytics/zone_manager.py:50-80)
   - Bölge koordinatlarını kontrol eder
   - Giriş/çıkış olaylarını tetikler

3. **React Widget** (frontend/src/components/camera/VisitorCountWidget.tsx:15-50)
   - Sayıları gösterir
   - Animasyonlu güncelleme

---

### 5. Bölge Çizimi (Zone Labeling)

**Kullanıcı Görür:** Canvas üzerinde dikdörtgen çizme

**Kod Nereden Geliyor:**

1. **React Canvas Component** (frontend/src/components/camera/ZoneCanvas.tsx:60-250)
   - HTML5 Canvas API
   - Mouse olayları (mousedown, mousemove, mouseup)
   - Dikdörtgen çizim algoritması
   - Koordinat normalleştirme (0-1)

2. **State Management** (frontend/src/components/camera/ZoneCanvas.tsx:25-50)
   - React useState ile bölgeleri saklar
   - `zones` array'i:
     ```typescript
     {
       id: string,
       name: string,
       type: 'entrance' | 'exit',
       coordinates: [{x, y}, {x, y}, {x, y}, {x, y}]
     }
     ```

3. **Backend API Call** (frontend/src/services/cameraBackendService.ts:80-100)
   - `POST /api/zones` ile kaydet
   - JSON body ile gönder

4. **Python Config** (packages/camera-analytics/config/default_zones.yaml)
   - YAML formatında saklanır
   - Python backend başlatılırken yüklenir

---

### 6. Isı Haritası (Heatmap)

**Kullanıcı Görür:** Kamera görüntüsü üzerinde renkli overlay

**Kod Nereden Geliyor:**

1. **Python Heatmap Generator** (packages/camera-analytics/camera_analytics/metrics.py:100-150)
   - NumPy array'i (H x W)
   - Her tespitin konumunu toplar
   - Gaussian blur uygular
   - 0-255 arası değerler

2. **OpenCV Colormap** (packages/camera-analytics/camera_analytics/run.py:120-135)
   - `cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)`
   - Mavi (düşük) -> Kırmızı (yüksek)

3. **Frame Overlay** (packages/camera-analytics/camera_analytics/run.py:140-150)
   - Alpha blending
   - `cv2.addWeighted(frame, 0.7, heatmap, 0.3)`

4. **Frontend Display** (frontend/src/components/camera/CameraFeed.tsx:35-40)
   - Overlay'li frame'i gösterir

---

## 🎭 Kullanım Senaryoları

### Senaryo 1: Sadece Frontend Testi (Demo Modu)

**Ne zaman:** Python backend olmadan UI test etmek

```bash
cd frontend
pnpm dev
```

Frontend mock data ile çalışır.

---

### Senaryo 2: Tam Sistem (Webcam ile)

**Ne zaman:** Gerçek kamera ile test

```bash
# Terminal 1
cd packages/camera-analytics
source .venv/bin/activate
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5000

# Terminal 2
cd frontend
pnpm dev
```

Tarayıcı: `http://localhost:5173`

---

### Senaryo 3: Video Dosyası ile Test

**Ne zaman:** Kaydedilmiş video analiz etmek

```bash
python -m camera_analytics.run_with_websocket \
  --source path/to/video.mp4 \
  --ws-port 5000
```

---

### Senaryo 4: Veritabanı ile Kayıt

**Ne zaman:** Analitikleri saklamak

```bash
# Terminal 1: Backend
cd backend
pnpm dev

# Terminal 2: Python
cd packages/camera-analytics
source .venv/bin/activate
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5000

# Terminal 3: Frontend
cd frontend
pnpm dev
```

Python backend, verileri `http://localhost:3001/api/analytics`'e POST eder.

---

## 🔧 Sorun Giderme

### Kamera Açılmıyor

**Hata:** `Cannot open camera 0`

**Çözüm:**
```bash
# Farklı kamera index'i dene
python -m camera_analytics.run_with_websocket --source 1

# macOS'ta kamera izinlerini kontrol et
# System Preferences > Security & Privacy > Camera
```

---

### WebSocket Bağlantı Hatası

**Hata:** `WebSocket connection failed`

**Çözüm:**
```bash
# Python backend'in çalıştığından emin ol
lsof -i :5000

# Port kullanımda ise process'i öldür
kill -9 <PID>

# Yeniden başlat
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5000
```

---

### Frontend Build Hatası

**Hata:** `Module not found` veya `Type error`

**Çözüm:**
```bash
# Node modules'ı temizle
cd frontend
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Cache temizle
pnpm run build --force
```

---

### Python Bağımlılık Hatası

**Hata:** `ModuleNotFoundError: No module named 'cv2'`

**Çözüm:**
```bash
cd packages/camera-analytics

# Virtual environment aktif mi kontrol et
which python  # .venv içindeki python'u göstermeli

# Değilse aktive et
source .venv/bin/activate

# Bağımlılıkları yeniden kur
pip install -e .
```

---

### Veritabanı Bağlantı Hatası

**Hata:** `Can't reach database server`

**Çözüm:**
```bash
# PostgreSQL çalışıyor mu?
brew services list  # macOS
sudo systemctl status postgresql  # Linux

# Başlat
brew services start postgresql@15  # macOS
sudo systemctl start postgresql  # Linux

# Veritabanı var mı kontrol et
psql -l | grep observai

# Yoksa oluştur
createdb observai
```

---

### Model İndirme Hatası

**Hata:** `Failed to download YOLO model`

**Çözüm:**
```bash
# Manuel model indirme
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# İnternet bağlantınızı kontrol edin
# Güvenlik duvarı YOLO model sunucusunu engelliyor olabilir
```

---

### Düşük FPS / Performans

**Çözüm:**
```bash
# GPU kullan (CUDA varsa)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# Veya frame boyutunu küçült
# packages/camera-analytics/camera_analytics/run.py içinde
# frame = cv2.resize(frame, (640, 480))

# Veya confidence threshold'u artır
# YOLO(conf=0.7)  # Daha az tespit, daha hızlı
```

---

## 📝 Geliştirme Notları

### Proje Statüsü

- **%20 Tamamlandı**: Production-ready, tam çalışan özellikler
- **%80 Devam Ediyor**: UI mockup'ları ve placeholder'lar

Bu yapı akademik incrementa-based geliştirme yaklaşımı içindir.

### Önemli Dosyalar

- `Team12_InitialPlan_v2 .pdf` - İlk proje planı
- `Team12_Prototype_V1 .pdf` - Prototip dokümantasyonu
- `Team12_SRS_V1 .pdf` - Yazılım gereksinim belgesi

### Demo Hesabı

```
Email: admin@observai.com
Şifre: demo1234
```

### Portlar

- Frontend: `5173`
- Backend API: `3001`
- Python WebSocket: `5000`
- Prisma Studio: `5555`

### Faydalı Komutlar

```bash
# Tüm servislerin portlarını kontrol et
lsof -i :5173 && lsof -i :3001 && lsof -i :5000

# Git status
git status

# Logları görüntüle
# Python
tail -f packages/camera-analytics/logs/camera.log

# Frontend
# Browser console (F12)

# Backend
# Terminal çıktısı
```

### Klasör README'leri

Her klasörün detaylı açıklaması için:
- `frontend/README.md` - React uygulaması
- `backend/README.md` - API sunucusu
- `packages/camera-analytics/README.md` - Python backend
- `scripts/README.md` - Yardımcı scriptler
- `docs/README.md` - Teknik dokümanlar

---

## 📄 Lisans

MIT License - ObservAI Platform

---

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing`)
5. Pull Request açın

---

## 📞 Destek

Sorunlar için:
- GitHub Issues
- Dokümantasyon: `docs/` klasörü
- Her klasördeki README.md dosyaları

---

**ObservAI ile akıllı kamera analitiği! 🎥📊**
