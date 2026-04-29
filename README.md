# ObservAI - Gelişmiş Kamera Analitik Platformu 🚀

**2025 SOTA (State-of-the-Art) Standardına Modernize Edilmiş**

ObservAI, gerçek zamanlı kamera görüntülerinden ziyaretçi analitiği, demografik bilgiler ve akıllı bölge takibi sağlayan kurumsal düzeyde bir kamera analitik platformudur.

## 🎉 2025 Modernizasyon Tamamlandı

Platform, en son teknolojiler ve en iyi uygulamalarla tamamen yenilendi:
- ✅ **YOLO11** (yolo11s.pt, yolo11n.mlpackage) - Gerçek zamanlı insan tespiti
- ✅ **Gemini 2.5 Flash** - Doğal dil ile analitik sorgulama (fallback: gemini-2.0-flash-001)
- ✅ **Apache Kafka** - Yatay ölçeklenebilirlik
- ✅ **Rol Tabanlı Erişim** - Kurumsal güvenlik
- ✅ **Gizlilik Modu** - GDPR uyumlu yüz bulanıklaştırma
- ✅ **Gelişmiş Raporlama** - PDF/CSV export, geçmiş karşılaştırma

---

## 📋 İçindekiler

- [Proje Hakkında](#-proje-hakkında)
- [Özellikler](#-özellikler)
- [Teknoloji Stack](#-teknoloji-stack)
- [Proje Yapısı](#-proje-yapısı)
- [İlk Kurulum](#-ilk-kurulum)
- [Mevcut Projeyi Çalıştırma](#-mevcut-projeyi-çalıştırma)
- [Yeni Özellikler (2025)](#-yeni-özellikler-2025)
- [Kullanım Senaryoları](#-kullanım-senaryoları)
- [API Dokümantasyonu](#-api-dokümantasyonu)
- [Sorun Giderme](#-sorun-giderme)
- [Performans](#-performans)

---

## 🎯 Proje Hakkında

ObservAI, yapay zeka destekli kamera analitikleri ile işletmelerin ziyaretçi davranışlarını anlamalarına yardımcı olan kurumsal bir platformdur. Sistem üç ana bileşenden oluşur:

1. **Frontend (React + TypeScript)** - Kullanıcı arayüzü ve dashboard
2. **Backend (Node.js + Express + Prisma)** - REST API ve veritabanı yönetimi
3. **Camera Analytics (Python + YOLO11)** - Görüntü işleme ve AI motoru

### Neden ObservAI?

- 🎯 **Gerçek Zamanlı** - Anlık metrikler ve canlı görüntü
- 🧠 **Akıllı** - YOLO11 + InsightFace ile hassas tespit
- 🔒 **Güvenli** - JWT tabanlı auth, gizlilik modu ve anonim takip
- 📊 **Kurumsal** - Rol tabanlı erişim, raporlama, export
- ⚡ **Hızlı** - Donanıma bağlı: CPU'da 10-25 FPS, GPU'da >30 FPS
- 📈 **Ölçeklenebilir** - İsteğe bağlı Apache Kafka desteği ile yatay ölçekleme

---

## ✨ Özellikler

### 🚀 Çekirdek Özellikler (Production Ready)

#### 1. Kimlik Doğrulama ve Kullanıcı Yönetimi
- JWT token tabanlı kimlik doğrulama ve oturum yönetimi
- Rol tabanlı erişim kontrolü (RBAC)
  - **ADMIN** - Tam yetki (tüm işlemler)
  - **MANAGER** - Kamera ve bölge yönetimi
  - **ANALYST** - Sadece okuma yetkisi
  - **VIEWER** - Görüntüleme yetkisi

#### 2. Gerçek Zamanlı Kamera Analitikleri
- **Canlı Video Akışı**: WebSocket üzerinden gerçek zamanlı
- **İnsan Tespiti**: YOLO11 ile hassas insan tespiti (doğruluk donanıma bağlı)
- **Demografik Analiz**:
  - Yaş tahmini (7 kategori: 0-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+)
  - Cinsiyet dağılımı (erkek/kadın/belirsiz)
- **Ziyaretçi Sayımı**: Otomatik giriş/çıkış takibi
- **Isı Haritası**: Yoğunluk analizi ve görselleştirme
- **Bekleme Süresi**: Kişi başına dwell time metrikleri

#### 3. Akıllı Bölge Yönetimi
- İnteraktif canvas ile bölge çizimi
- Giriş/çıkış noktaları tanımlama
- Özel bölge tipleri (kuyruk, masa, özel)
- Real-time bölge analitiği
- Uzun süre kalma uyarıları

#### 4. Görselleştirme ve Dashboard
- **ECharts** ile interaktif grafikler
- Donut chart (cinsiyet dağılımı)
- Bar chart (yaş dağılımı)
- Line chart (zaman serisi)
- Real-time güncellemeler
- Responsive tasarım

---

### 🆕 Yeni Özellikler (2025 Modernizasyonu)

#### 🤖 Faz 1: Bilgisayar Görüsü Pipeline Yükseltmesi

**1.1: YOLO11 Model Entegrasyonu** ✅
- YOLO11 (yolo11s.pt, yolo11n.mlpackage) modelleri kullanılıyor
- Hafif ve hızlı insan tespiti
- Donanıma bağlı performans:
  - GPU'da >30 FPS, <5ms latency
  - CPU'da 10-25 FPS
- Gerçek zamanlı insan tespiti

**1.2: Donanım Özelleştirmesi** ✅
- **Apple Silicon (MPS)**: Metal Performance Shaders ile ~3x hızlanma
- **NVIDIA CUDA**: TensorRT optimizasyonu ile ~5x hızlanma
- **CPU Fallback**: Uyumluluk için otomatik geri dönüş
- Otomatik donanım algılama ve seçimi

**1.3: Async Demographics İşleme** ✅
- ThreadPoolExecutor ile paralel işleme
- Her 5 frame'de 1 işleme (yapılandırılabilir)
- %40 FPS artışı
- %60 latency azalması
- Non-blocking pipeline

#### 🔒 Faz 2: Gizlilik ve Güvenlik

**2.1: Gizlilik Modu (Privacy Mode)** ✅
- Gaussian blur ile yüz bulanıklaştırma
- Yapılandırılabilir blur gücü
- Gerçek zamanlı işleme
- Demografik analiz korunur
- GDPR uyumlu

**2.2: Anonim Re-Identification** ✅
- SHA-256 ile kişi ID'lerini hash'leme
- Deterministik: Aynı kişi → Aynı hash
- Anonim: Hash'ten kimliğe geri dönülemez
- Oturum arası takip desteği
- PII saklanmaz

#### 🧠 Faz 3: Gelişmiş Zeka ve Raporlama

**3.1: LLM Q&A (Gemini 2.5 Flash)** ✅
- Doğal dilde analitik sorgulama (gemini-2.5-flash, fallback: gemini-2.0-flash-001)
- Geniş context window ile analiz
- Son 24 saat veri analizi
- Akıllı içgörüler ve öneriler
- API Endpoint: `POST /api/ai/chat`

**Örnek Sorgular:**
```
"Bugünün en yoğun saatleri nelerdi?"
"Dün ile bugünü karşılaştır"
"Hangi yaş grubu en fazla ziyaret ediyor?"
"Ortalama bekleme süresi nedir?"
```

**3.2: PDF/CSV Export** ✅
- Profesyonel PDF raporları (PDFKit)
- CSV veri export'u
- Zaman aralığı filtreleme
- Kamera bazında veya global
- API Endpoints:
  - `GET /api/export/pdf`
  - `GET /api/export/csv`

**PDF Özellikleri:**
- Özet istatistikler (giriş, çıkış, zirve)
- Saatlik dökümler tablosu
- Tarih aralığı ve oluşturma tarihi
- Profesyonel formatla

**3.3: Geçmiş Karşılaştırma** ✅
- Gün-üzeri-gün karşılaştırma
- Hafta-üzeri-hafta karşılaştırma
- Özel tarih aralığı karşılaştırma
- Yüzdelik değişim hesaplamaları
- Doğal dil özetleri
- API Endpoint: `GET /api/analytics/compare`

#### 🏗️ Faz 4: Mimari ve Ölçeklenebilirlik

**4.1: Apache Kafka Entegrasyonu (İsteğe Bağlı)** ✅
- **Python Producer**: Confluent Kafka
- **Node.js Consumer**: KafkaJS
- **3 Topic**:
  - `observai.analytics` - Gerçek zamanlı metrikler
  - `observai.detections` - Tespit olayları
  - `observai.insights` - Bölge içgörüleri
- Yatay ölçekleme desteği (Kafka etkinleştirildiğinde)
- Message buffering ve consumer group load balancing
- Varsayılan: Devre dışı (KAFKA_ENABLED=false). Etkinleştirmek için .env dosyasında ayarlanmalıdır.

**4.2: Frontend Fallback Görünümü** ✅
- Bağlantı durumu takibi
- Veri cache'leme (son analitikler, tespitler, içgörüler)
- Durum değişimi callbacks
- Graceful degradation
- Otomatik yeniden bağlanma (10 deneme)
- Kullanıcı bildirimleri

**4.3: Rol Tabanlı Erişim Kontrolü** ✅
- **ADMIN** - Tam yetki (silme dahil)
- **MANAGER** - Kamera ve bölge yönetimi (silme hariç)
- **ANALYST** - Sadece okuma (GET istekleri)
- **VIEWER** - Görüntüleme
- Middleware tabanlı yetkilendirme
- Backend'de zorunlu kontrol
- Frontend'te UI kısıtlamaları

---

## 🛠 Teknoloji Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Tip güvenliği
- **Vite** - Build tool ve dev server
- **Tailwind CSS** - Modern styling
- **ECharts** - Gelişmiş görselleştirme
- **React Router** - Client-side routing
- **Socket.io-client** - WebSocket bağlantısı

### Backend API
- **Node.js 18+** - JavaScript runtime
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Prisma** - Next-gen ORM
- **SQLite (geliştirme) / PostgreSQL (üretim)** - Database (geliştirmede `prisma/dev.db`, üretimde PostgreSQL önerilir)
- **JWT** - Token authentication
- **KafkaJS** - Kafka client (opsiyonel)
- **PDFKit** - PDF generation
- **@google/generative-ai** - Gemini 2.5 Flash integration

### Camera Analytics (Python)
- **Python 3.9+** - Core language
- **YOLO11** (yolo11s.pt, yolo11n.mlpackage) - Gerçek zamanlı insan tespiti
- **InsightFace** - Yaş/cinsiyet analizi
- **OpenCV** - Görüntü işleme
- **PyTorch** - Deep learning framework
- **WebSocket** - Real-time streaming
- **NumPy** - Numerical computing
- **Confluent Kafka** - Kafka producer (opsiyonel)
- **Hardware Acceleration**:
  - MPS (Apple Silicon) - ~3x hızlanma
  - CUDA (NVIDIA) - ~5x hızlanma
  - CPU fallback

---

## 📁 Proje Yapısı

```
ObservAI/
├── frontend/                     # React web uygulaması
│   ├── src/
│   │   ├── components/
│   │   │   ├── camera/           # Kamera widget'ları
│   │   │   │   ├── CameraFeed.tsx
│   │   │   │   ├── GenderChart.tsx
│   │   │   │   ├── AgeChart.tsx
│   │   │   │   ├── VisitorCountWidget.tsx
│   │   │   │   ├── DwellTimeWidget.tsx
│   │   │   │   └── ZoneCanvas.tsx
│   │   │   └── layout/           # Sayfa düzeni
│   │   ├── pages/                # Sayfa bileşenleri
│   │   ├── services/
│   │   │   ├── cameraBackendService.ts  # WebSocket + Fallback
│   │   │   └── analyticsDataService.ts
│   │   └── App.tsx
│   └── README.md
│
├── backend/                       # Node.js API sunucusu
│   ├── src/
│   │   ├── routes/
│   │   │   ├── cameras.ts        # Kamera yönetimi
│   │   │   ├── zones.ts          # Bölge yönetimi
│   │   │   ├── analytics.ts      # Analitik + Karşılaştırma
│   │   │   ├── export.ts         # PDF/CSV export
│   │   │   ├── ai.ts             # Gemini Q&A
│   │   │   ├── users.ts          # Kullanıcı yönetimi
│   │   │   └── python-backend.ts # Python backend kontrolü
│   │   ├── middleware/
│   │   │   └── roleCheck.ts      # RBAC middleware
│   │   ├── lib/
│   │   │   ├── kafkaConsumer.ts  # Kafka consumer
│   │   │   └── db.ts             # Prisma client
│   │   └── index.ts              # Ana sunucu
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   └── README.md
│
├── packages/
│   └── camera-analytics/          # Python görüntü işleme
│       ├── camera_analytics/
│       │   ├── analytics.py       # Ana engine (YOLO11)
│       │   ├── run_with_websocket.py  # WebSocket server
│       │   ├── demographics.py    # Yaş/cinsiyet
│       │   ├── tracker.py         # Object tracking
│       │   ├── metrics.py         # Metrik hesaplama
│       │   ├── sources.py         # Video kaynakları
│       │   ├── websocket_server.py # Socket.IO server
│       │   ├── kafka_producer.py  # Kafka producer
│       │   └── config.py          # Konfigürasyon
│       ├── config/
│       │   └── default_zones.yaml
│       ├── PERFORMANCE_GUIDE.md   # Performans optimizasyonu
│       └── README.md
│
├── docs/                          # Teknik dokümantasyon
│   ├── CAMERA_SOURCES_GUIDE.md
│   ├── ECHARTS_USAGE_GUIDE.md
│   ├── PROJECT_SUMMARY.md
│   └── README.md
│
├── scripts/                       # Yardımcı betikler
│   ├── start-camera-backend.sh
│   └── README.md
│
└── README.md                      # Bu dosya
```

---

## 🚀 İlk Kurulum

### Ön Gereksinimler

#### Sistem Gereksinimleri
- **Node.js** 18 veya üstü
- **Python** 3.9 veya üstü
- **PostgreSQL** 15 veya üstü (üretim için önerilir; geliştirmede SQLite otomatik kullanılır)
- **pnpm** (NPM package manager)
- **Git**

#### Önerilen Donanım
- **Minimum**: 8GB RAM, 4 CPU cores, integrated GPU
- **Önerilen**: 16GB RAM, 8 CPU cores, NVIDIA GPU (CUDA) veya Apple Silicon (MPS)

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
- Python: [python.org](https://www.python.org/) (Kurulum sırasında "Add Python to PATH" seçeneğini işaretleyin)
- PostgreSQL: [postgresql.org](https://www.postgresql.org/) (Opsiyonel - SQLite varsayılan)
- pnpm: `npm install -g pnpm`
- **📖 Detaylı Windows kurulum rehberi için:** [WINDOWS_SETUP.md](WINDOWS_SETUP.md)

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

**Ortam Değişkenleri (Opsiyonel):**

Frontend geliştirmesi sırasında opsiyonel ortam değişkenleri yapılandırabilirsiniz. Örnek `frontend/.env` dosyası:

### 3. Python Camera Analytics Kurulumu

**macOS/Linux:**
```bash
cd ../packages/camera-analytics

# Virtual environment oluştur
python3 -m venv venv

# Aktive et
source venv/bin/activate

# Bağımlılıkları kur
pip install --upgrade pip
pip install -e .
```

**Windows:**
```cmd
cd ..\packages\camera-analytics

REM Virtual environment oluştur
python -m venv venv

REM Aktive et
venv\Scripts\activate.bat

REM Bağımlılıkları kur
pip install --upgrade pip
pip install -e .
```

**Not:** Windows kullanıcıları için detaylı kurulum: [WINDOWS_SETUP.md](WINDOWS_SETUP.md)

İlk çalıştırmada **YOLO11** ve **InsightFace** modelleri otomatik indirilecektir (~200 MB).

### 4. Backend API Kurulumu

```bash
cd ../../backend
pnpm install

# Geliştirme (SQLite otomatik kullanılır):
# .env dosyası oluştur (opsiyonel)
cat > .env << EOF
JWT_SECRET="your-secret-key-change-in-production"
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Gemini AI (opsiyonel - LLM Q&A için)
GEMINI_API_KEY=your-gemini-api-key

# Kafka (opsiyonel - yatay ölçekleme için)
KAFKA_ENABLED=false
KAFKA_BROKERS=localhost:9092
EOF

# Prisma client generate
npx prisma generate

# Migration'ları çalıştır (geliştirmede otomatik SQLite oluşturulur)
npx prisma migrate dev
```

**Üretim için PostgreSQL Kurulumu:**
```bash
# PostgreSQL veritabanı oluştur
createdb observai

# .env dosyasında
DATABASE_URL="postgresql://user:password@localhost:5432/observai?schema=public"
```

### 5. İlk Çalıştırma Testi

**macOS/Linux:**
```bash
# Tüm servisleri başlat (önerilen)
./start-all.sh

# Veya manuel olarak:
# Terminal 1: Python Backend
cd packages/camera-analytics
source venv/bin/activate
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5001

# Terminal 2: Backend API (opsiyonel)
cd backend
npm run start:node

# Terminal 3: Frontend
cd frontend
pnpm dev
```

**Windows:**
```cmd
REM Tüm servisleri başlat (önerilen)
start-all.bat

REM Servisleri durdurmak için:
REM stop-all.bat

REM Veya manuel olarak:
REM Terminal 1: Python Backend
cd packages\camera-analytics
venv\Scripts\activate.bat
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5001

REM Terminal 2: Backend API
cd ..\..\backend
npm run start:node

REM Terminal 3: Frontend
cd ..\frontend
pnpm dev
```

Tarayıcıda `http://localhost:5173` adresine gidin.

**Windows kullanıcıları için:** Detaylı kurulum ve sorun giderme rehberi: [WINDOWS_SETUP.md](WINDOWS_SETUP.md)

---

## 🎮 Mevcut Projeyi Çalıştırma

### Hızlı Başlangıç (Frontend + Python)

En yaygın kullanım senaryosu:

```bash
# Terminal 1: Python Camera Backend
cd packages/camera-analytics
source .venv/bin/activate
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5001

# Terminal 2: Frontend
cd frontend
pnpm dev
```

Tarayıcı: `http://localhost:5173`

### Tam Stack (Frontend + Backend + Python)

Veritabanı ve tüm özellikler için:

```bash
# Terminal 1: Backend API
cd backend
pnpm dev

# Terminal 2: Python Camera Backend
cd packages/camera-analytics
source .venv/bin/activate
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5001

# Terminal 3: Frontend
cd frontend
pnpm dev
```

### Özel Konfigürasyonlar

**Video dosyası ile:**
```bash
python -m camera_analytics.run_with_websocket \
  --source path/to/video.mp4 \
  --ws-port 5001
```

**Gizlilik modu aktif:**
```bash
python -m camera_analytics.run_with_websocket \
  --source 0 \
  --ws-port 5001 \
  --privacy-mode
```

**Farklı kamera index:**
```bash
python -m camera_analytics.run_with_websocket \
  --source 1 \
  --ws-port 5001
```

---

## 🆕 Yeni Özellikler (2025)

### 1. Doğal Dil ile Analitik Sorgulama (Gemini 2.5 Flash)

```bash
# API çağrısı
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Bugünün en yoğun saatleri nelerdi?",
    "cameraId": "optional-camera-id"
  }'
```

**Örnek Yanıt:**
```json
{
  "answer": "Bugün en yoğun saatler:\n1. 12:00-13:00 (124 ziyaretçi)\n2. 18:00-19:00 (118 ziyaretçi)\n3. 14:00-15:00 (98 ziyaretçi)\n\nZirve yoğunluk 12:30'da 45 kişi ile gerçekleşti.",
  "timestamp": "2025-12-04T12:00:00Z"
}
```

### 2. PDF/CSV Export

```bash
# PDF raporu oluştur
curl "http://localhost:3001/api/export/pdf?cameraId=cam-123&startDate=2025-12-01&endDate=2025-12-04" \
  --output report.pdf

# CSV data export
curl "http://localhost:3001/api/export/csv?cameraId=cam-123&startDate=2025-12-01&endDate=2025-12-04" \
  --output data.csv
```

### 3. Geçmiş Karşılaştırma

```bash
# Gün-üzeri-gün karşılaştırma
curl "http://localhost:3001/api/analytics/compare?period1Start=2025-12-04T00:00:00Z&period1End=2025-12-04T23:59:59Z&period2Start=2025-12-03T00:00:00Z&period2End=2025-12-03T23:59:59Z&comparisonType=day-over-day"
```

**Örnek Yanıt:**
```json
{
  "period1": {
    "totalPeopleIn": 124,
    "avgCurrentCount": 31,
    "peakHour": "12:00"
  },
  "period2": {
    "totalPeopleIn": 128,
    "avgCurrentCount": 30,
    "peakHour": "13:00"
  },
  "changes": {
    "totalPeopleIn": -3.13,
    "avgCurrentCount": 3.33
  },
  "summary": "Periyot 1'de %3.13 daha az ziyaretçi var ancak %3.33 daha yüksek ortalama doluluk mevcut."
}
```

### 4. Apache Kafka Entegrasyonu (İsteğe Bağlı)

**Kafka'yı Aktifleştirme:**

Kafka opsiyonel bir bileşendir. Yatay ölçekleme için etkinleştirmek istiyorsanız:

```bash
# .env dosyasında
KAFKA_ENABLED=true
KAFKA_BROKERS=localhost:9092

# Kafka cluster başlatma (Docker ile)
docker-compose up -d kafka zookeeper
```

**Ölçekleme Senaryosu:**
```
Python Backend 1 ──┐
Python Backend 2 ──┼──> Kafka ──> Consumer Group ──┬──> Node Backend 1
Python Backend 3 ──┘                                 └──> Node Backend 2
```

### 5. Rol Tabanlı Erişim Kontrolü

**Kullanıcı Oluşturma:**

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "analyst@company.com",
    "password": "secure-password",
    "firstName": "John",
    "lastName": "Doe",
    "role": "ANALYST"
  }'
```

**Yetki Matrisi:**

| İşlem | VIEWER | ANALYST | MANAGER | ADMIN |
|-------|--------|---------|---------|-------|
| GET (okuma) | ✅ | ✅ | ✅ | ✅ |
| POST (oluşturma) | ❌ | ❌ | ✅ | ✅ |
| PUT (güncelleme) | ❌ | ❌ | ✅ | ✅ |
| DELETE (silme) | ❌ | ❌ | ❌ | ✅ |

---

## 📊 API Dokümantasyonu

### Analytics Endpoints

```
GET    /api/analytics/:cameraId          # Analitik verileri getir
POST   /api/analytics                     # Analitik veri kaydet
GET    /api/analytics/compare             # Geçmiş karşılaştırma
```

### Camera Endpoints

```
GET    /api/cameras                       # Kamera listesi
GET    /api/cameras/:id                   # Tek kamera
POST   /api/cameras                       # Kamera oluştur (MANAGER+)
PUT    /api/cameras/:id                   # Kamera güncelle (MANAGER+)
DELETE /api/cameras/:id                   # Kamera sil (ADMIN)
```

### Zone Endpoints

```
GET    /api/zones/:cameraId               # Bölgeleri getir
POST   /api/zones                         # Bölge oluştur (MANAGER+)
PUT    /api/zones/:id                     # Bölge güncelle (MANAGER+)
DELETE /api/zones/:id                     # Bölge sil (MANAGER+)
POST   /api/zones/batch                   # Toplu bölge işlemi (MANAGER+)
```

### Export Endpoints

```
GET    /api/export/pdf                    # PDF raporu oluştur
GET    /api/export/csv                    # CSV export
```

### AI Endpoints

```
POST   /api/ai/chat                       # Gemini Q&A
```

### Python Backend Control

```
GET    /api/python-backend/status         # Durum sorgula
POST   /api/python-backend/start          # Başlat (MANAGER+)
POST   /api/python-backend/stop           # Durdur (MANAGER+)
POST   /api/python-backend/restart        # Yeniden başlat (MANAGER+)
```

---

## 🔧 Sorun Giderme

### Performans Sorunları

**Düşük FPS:**
```bash
# GPU kullanımını kontrol et
python -c "import torch; print(torch.backends.mps.is_available())"  # macOS
python -c "import torch; print(torch.cuda.is_available())"  # Linux/Windows

# Frame boyutunu küçült (config.py)
image_size: 640  # 1280'den 640'a düşür
```

**Yüksek CPU kullanımı:**
```python
# Demografik işleme frame skip artır
demo_skip_frames: 10  # 5'ten 10'a çıkar
```

### WebSocket Bağlantı Sorunları

```bash
# Port kontrolü
lsof -i :5001

# Process öldür
kill -9 <PID>

# Python backend yeniden başlat
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5001
```

### Veritabanı Bağlantı Hatası

```bash
# PostgreSQL durumunu kontrol et
brew services list | grep postgresql  # macOS
sudo systemctl status postgresql      # Linux

# Veritabanı oluştur
createdb observai

# Migration çalıştır
cd backend
npx prisma migrate dev
```

### Model İndirme Hatası

```bash
# Manuel model indirme
python -c "from ultralytics import YOLO; YOLO('yolo12n.pt')"

# InsightFace model
python -c "import insightface; insightface.model_zoo.get_model('buffalo_l')"
```

---

## ⚡ Performans

### Benchmark Sonuçları

**Apple M1 Pro (MPS):**
- FPS: 35-40
- Latency: ~3ms
- GPU Kullanımı: %60-70

**NVIDIA RTX 3080 (CUDA):**
- FPS: 50-60
- Latency: ~2ms
- GPU Kullanımı: %40-50

**CPU Only (Intel i7):**
- FPS: 10-15
- Latency: ~15ms
- CPU Kullanımı: %80-90

**Not:** Gerçek performans video kaynağı, model seçimi, donanım ve donanım hızlandırması (MPS/CUDA) kullanıp kullanmadığına bağlıdır.

### Optimizasyon İpuçları

1. **Donanım Hızlandırma**: MPS/CUDA kullanın
2. **Frame Skip**: Demografik işlemede skip_frames artırın
3. **Image Size**: 640px yerine 320px kullanın (düşük doğruluk)
4. **Batch Processing**: Kafka ile yük dağıtın
5. **Async Processing**: ThreadPoolExecutor zaten aktif

Detaylı performans kılavuzu: `packages/camera-analytics/PERFORMANCE_GUIDE.md`

---

## 📚 Dokümantasyon

### Klasör README'leri
- `frontend/README.md` - React uygulaması
- `backend/README.md` - API sunucusu
- `packages/camera-analytics/README.md` - Python backend
- `scripts/README.md` - Yardımcı scriptler
- `docs/README.md` - Teknik dokümanlar

### Teknik Kılavuzlar
- `docs/CAMERA_SOURCES_GUIDE.md` - Video kaynak konfigürasyonu
- `docs/ECHARTS_USAGE_GUIDE.md` - Grafik kullanımı
- `packages/camera-analytics/PERFORMANCE_GUIDE.md` - Performans optimizasyonu

### Modernizasyon Dökümanları (2025)
- `/tmp/phase4_kafka_test_results.md` - Kafka entegrasyonu
- `/tmp/phase4_2_completion_summary.md` - Frontend fallback
- `/tmp/phase4_3_role_based_access_complete.md` - RBAC implementasyonu
- `/tmp/observai_modernization_2025_complete.md` - Tam modernizasyon özeti

---

## 🎯 Kullanım Senaryoları

### 1. Perakende Mağaza
- Müşteri sayımı ve yoğunluk analizi
- Demografik profilleme
- Kuyruktaki bekleme süresi
- Isı haritası ile ürün ilgisi

### 2. Restoran/Cafe
- Masa doluluk oranı
- Ortalama oturma süresi
- Zirve saatleri belirleme
- Müşteri demografisi

### 3. Etkinlik Yönetimi
- Katılımcı sayımı
- Bölge yoğunluk analizi
- Giriş/çıkış akışı
- Güvenlik monitörleme

### 4. Ofis/Kurumsal
- Toplantı odası kullanım oranı
- Ortak alan yoğunluğu
- Sosyal mesafe monitörleme
- Erişim kontrolü

---

## 🚀 Production Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: observai
      POSTGRES_PASSWORD: secure-password

  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on:
      - zookeeper

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://postgres:secure-password@postgres:5432/observai
      KAFKA_ENABLED: "true"
      KAFKA_BROKERS: kafka:9092

  camera-analytics:
    build: ./packages/camera-analytics
    command: python -m camera_analytics.run_with_websocket --source 0 --ws-port 5001

  frontend:
    build: ./frontend
    ports:
      - "80:80"
```

### Güvenlik Kontrol Listesi

- [ ] JWT_SECRET değiştir
- [ ] HTTPS aktif
- [ ] CORS origin kısıtla
- [ ] Rate limiting ekle
- [ ] Firewall kuralları
- [ ] Database backup
- [ ] API key rotation
- [ ] Log monitoring

### v1.0.0 Production Notları (Faz 9 release)

**Zorunlu Environment Variables:**
- `JWT_SECRET` — uzun random hex (en az 32 byte)
- `DATABASE_URL` — production Postgres connection string
- `OBSERVAI_INGEST_KEY` — Python→Node analytics ingest paylasilan secret (Yan #22 NodePersister)
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` — email dispatch (Telegram pasif: Yan #58)
- `OLLAMA_URL` (default `http://localhost:11434`) ve `OLLAMA_MODEL` (Yan #36 exact match — varyant suffix'lerini secmez)
- `GEMINI_API_KEY` — Ollama yoksa fallback

**Opt-in:**
- `INSIGHT_CRON_ENABLED=true` — 6h insights cron (Yan #44, idempotent dateKey upsert)
- `OBSERVAI_MJPEG_MODE=smooth` — 60 FPS interpolated overlay default (Stage 2 / ADIM 14)

**Deployment hazirlik:**
1. `npm run db:migrate` — Faz 7 + 8'den 4 migration var (yan #59 acceptToken, #44 insight idempotency, #57 dismiss, #3 revokedAt)
2. `pnpm build` (frontend) + `npm run build` (backend)
3. Production CSP + cookie `Secure` flag aktif (auth flow demokrasi-mode degil)
4. Yan #37 chat tenant leak rejection production'da CLOSED — 7 ardisik leak probe sifir; herhangi bir AI chat regression release oncesi `LEAK_COUNT=0` ile dogrulanmasi gerek

**Bilinen kalintilar (Faz 10 backlog):**
- Yan #4.4 tables-ai-summary 6/6 expected FAIL (mock fixture, prod davranisi etkilemiyor)
- 4K kaynak performans optimizasyonu (1080p prod-ready; 4K perf opt sirada)
- Staff.telegramChatId legacy kolon migration drop (Yan #58 followup)
- Test fixture infrastructure (Yan #21 — mozart_cafe_short.mp4 + ground_truth.json hic landed degil)

Detayli changelog: `CHANGELOG.md`. Master rapor: `test-results/_MASTER-final-report.md`.

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

**ObservAI 2025 - Akıllı Kamera Analitiği ile Geleceğe! 🚀📊**

*2025 SOTA standardına modernize edilmiş, production-ready, enterprise-grade platform.*
