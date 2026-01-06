# ObservAI - Kapsamlı Sistem Dokümantasyonu

## İçindekiler
1. [Proje Genel Bakış](#proje-genel-bakış)
2. [Use Case Implementasyonu](#use-case-implementasyonu)
3. [Sistem Mimarisi](#sistem-mimarisi)
4. [Adım Adım Çalışma Akışı](#adım-adım-çalışma-akışı)
5. [AI Modelleri ve Kullanımı](#ai-modelleri-ve-kullanımı)
6. [WebSocket vs Webhook](#websocket-vs-webhook)
7. [Kod Blokları ve Lokasyonlar](#kod-blokları-ve-lokasyonlar)
8. [PDF Doküman Karşılaştırması](#pdf-doküman-karşılaştırması)

---

## Proje Genel Bakış

ObservAI, gerçek zamanlı kamera analitikleri ile ziyaretçi davranışlarını analiz eden kurumsal bir platformdur. Sistem üç ana bileşenden oluşur:

1. **Frontend (React + TypeScript)** - Kullanıcı arayüzü
2. **Backend API (Node.js + Express)** - REST API ve veritabanı
3. **Camera Analytics (Python)** - AI destekli görüntü işleme

**Teknoloji Stack:**
- Frontend: React 18, TypeScript, Vite, Socket.IO Client
- Backend: Node.js 18, Express, Prisma, SQLite/PostgreSQL
- AI: YOLOv11n (insan tespiti), MiVOLO (yaş/cinsiyet), OpenCV (görüntü işleme)

---

## Use Case Implementasyonu

### UC-01: Authenticate Manager

**PDF Dokümanındaki Tanım:**
> Manager, email ve password ile sisteme giriş yapar. "Remember me" seçeneği ile 30 günlük oturum açılabilir. Demo account: admin@observai.com / demo1234

**Proje Implementasyonu:**

**Frontend:** `frontend/src/pages/LoginPage.tsx`
- Satır 76-97: `handleLogin()` - Login form submit
- Satır 99-111: `handleDemoLogin()` - Demo account login
- Satır 10-18: Email/password state ve localStorage

**Backend:** `backend/src/routes/auth.ts`
- Satır 112-153: `POST /api/auth/login` endpoint
- Satır 35-56: `createSession()` - Session token oluşturma
- Satır 19-23: `LoginSchema` - Zod validation

**Akış:**
```
1. Kullanıcı email/password girer (LoginPage.tsx)
2. "Sign in" butonuna tıklar
3. AuthContext.login() çağrılır (frontend/src/contexts/AuthContext.tsx:49-69)
4. POST /api/auth/login (backend/src/routes/auth.ts:112)
5. Email lookup (Prisma User.findUnique)
6. Password hash kontrolü (bcrypt.compare)
7. Session token oluşturulur (crypto.randomBytes)
8. Cookie set edilir (httpOnly, secure)
9. Response: { id, email, firstName, lastName, role }
10. navigate('/dashboard') → Dashboard'a yönlendirilir
```

**Session Yönetimi:**
- Token: 32 byte random hex string
- Expiry: 30 gün (rememberMe=true) veya 7 gün
- Cookie: `session_token` (httpOnly, secure, sameSite: 'lax')
- Database: `backend/prisma/schema.prisma` - Session model

**Middleware:** `backend/src/middleware/authMiddleware.ts`
- Satır 14-47: `authenticate()` - Session token doğrulama
- Her protected route'da kullanılır

### UC-02: View Operations Dashboard

**PDF Dokümanındaki Tanım:**
> Manager, gerçek zamanlı analitik dashboard'u görüntüler. Cinsiyet dağılımı (doughnut chart), yaş dağılımı (bar chart) ve ziyaretçi sayıları gösterilir.

**Proje Implementasyonu:**

**Frontend Dashboard:** `frontend/src/pages/DashboardPage.tsx`
- GenderChart component: `frontend/src/components/camera/GenderChart.tsx`
- AgeChart component: `frontend/src/components/camera/AgeChart.tsx`
- VisitorCountWidget: `frontend/src/components/camera/VisitorCountWidget.tsx`

**GenderChart (Cinsiyet Dağılımı):**
- **Dosya:** `frontend/src/components/camera/GenderChart.tsx`
- **Grafik:** ECharts donut chart
- **Veri Kaynağı:** `analyticsDataService.getData().gender`
- **Real-time:** Socket.IO event `'global'` → `analyticsDataService.startRealtimeUpdates()`
- **Kod:** Satır 12-35 - useEffect ile subscription

**AgeChart (Yaş Dağılımı):**
- **Dosya:** `frontend/src/components/camera/AgeChart.tsx`
- **Grafik:** ECharts bar chart
- **Yaş Kategorileri:** 0-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+
- **Veri Kaynağı:** `analyticsDataService.getData().age`
- **Kod:** Satır 12-35 - useEffect ile subscription

**Veri Akışı:**
```
Python Backend (analytics.py)
    ↓ YOLOv11n tespit + MiVOLO yaş/cinsiyet
    ↓ WebSocket emit('global', metrics)
Frontend (cameraBackendService.ts)
    ↓ Socket.IO on('global')
    ↓ analyticsDataService.transformBackendData()
    ↓ React components re-render
```

**Backend API:** `backend/src/routes/analytics.ts`
- `GET /api/analytics/:cameraId` - Son 24 saat verileri
- Veri kaynağı: Prisma `AnalyticsLog` model

### UC-08: Zone Labeling

**PDF Dokümanındaki Tanım:**
> Manager, kamera görüntüsü üzerinde giriş/çıkış bölgelerini çizer. Rectangle şeklinde bölgeler tanımlanır ve kaydedilir.

**Proje Implementasyonu:**

**Frontend:** `frontend/src/components/camera/ZoneCanvas.tsx`
- Satır 82-118: `handleMouseDown()` - Çizim başlatma
- Satır 147-195: `handleMouseMove()` - Çizim güncelleme
- Satır 197-217: `handleMouseUp()` - Çizim tamamlama
- Satır 235-253: `saveZones()` - Backend'e kaydetme

**Zone Format:**
```typescript
{
  id: string
  name: string
  type: 'entrance' | 'exit'
  x: number (0-1 normalized)
  y: number (0-1 normalized)
  width: number (0-1 normalized)
  height: number (0-1 normalized)
  color: string (hex)
}
```

**Backend:** `backend/src/routes/zones.ts`
- `GET /api/zones/:cameraId` - Bölgeleri getir
- `POST /api/zones` - Bölge oluştur (RBAC: MANAGER+)
- `PUT /api/zones/:id` - Bölge güncelle
- `DELETE /api/zones/:id` - Bölge sil

**Python Backend:** `packages/camera-analytics/camera_analytics/analytics.py`
- Satır 348-386: `update_zones()` - Frontend'den gelen bölgeleri güncelle
- Satır 360-370: Rectangle → Polygon dönüşümü
- Bölge kontrolü: `point_in_polygon()` - Kişi bölge içinde mi?

**Akış:**
```
1. Frontend: "Add Zone" butonuna tıkla
2. Canvas üzerinde mouse drag → Rectangle çiz
3. Zone tipi seç (entrance/exit)
4. "Save All" butonuna tıkla
5. cameraBackendService.saveZones() → WebSocket emit('update_zones')
6. Python: websocket_server.py → on_update_zones callback
7. analytics.py: update_zones() → Zone definitions güncellenir
8. Backend API: POST /api/zones → Prisma'ya kaydedilir
```

---

## Sistem Mimarisi

### 3-Tier Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (React)                │
│  - LoginPage (UC-01)                    │
│  - DashboardPage (UC-02)                │
│  - ZoneLabelingPage (UC-08)             │
│  - Socket.IO Client                     │
└──────────────┬──────────────────────────┘
               │ HTTP (REST API)
               │ WebSocket (Socket.IO)
┌──────────────▼──────────────────────────┐
│      Backend API (Node.js)              │
│  - Express REST API                     │
│  - Prisma ORM (SQLite/PostgreSQL)      │
│  - Session Management                  │
│  - RBAC Middleware                     │
└──────────────┬──────────────────────────┘
               │ Process Management
┌──────────────▼──────────────────────────┐
│   Camera Analytics (Python)             │
│  - YOLOv11n (insan tespiti)            │
│  - MiVOLO (yaş/cinsiyet)               │
│  - OpenCV (görüntü işleme)             │
│  - WebSocket Server (Socket.IO)       │
└─────────────────────────────────────────┘
```

### Veri Akışı

**Authentication (UC-01):**
```
Browser → Frontend (LoginPage.tsx)
    → POST /api/auth/login
    → Backend (auth.ts)
    → Prisma (User lookup)
    → Session token
    → Cookie set
    → Redirect to Dashboard
```

**Dashboard (UC-02):**
```
Python Backend (analytics.py)
    → YOLOv11n detection
    → MiVOLO age/gender
    → WebSocket emit('global', metrics)
    → Frontend (cameraBackendService.ts)
    → analyticsDataService.transformBackendData()
    → React components (GenderChart, AgeChart)
    → ECharts render
```

**Zone Labeling (UC-08):**
```
Frontend (ZoneCanvas.tsx)
    → Mouse drag → Rectangle
    → WebSocket emit('update_zones')
    → Python (analytics.py:update_zones)
    → Zone definitions güncellenir
    → POST /api/zones
    → Prisma (Zone.create)
```

---

## Adım Adım Çalışma Akışı

### Senaryo 1: Manager Login ve Dashboard Görüntüleme

**Adım 1: Login Sayfası Açılır**
- **Dosya:** `frontend/src/pages/LoginPage.tsx`
- **Kod:** Component render (Satır 113-250)
- **UI:** Email/password input, "Sign in" butonu, "Use Demo Account" butonu

**Adım 2: Kullanıcı Email/Password Girer**
- **Kod:** `handleLogin()` - Satır 76-97
- **State:** `email`, `password`, `rememberMe`

**Adım 3: Login Request Gönderilir**
- **Kod:** `AuthContext.login()` - `frontend/src/contexts/AuthContext.tsx:49-69`
- **API:** `POST /api/auth/login`
- **Backend:** `backend/src/routes/auth.ts:112-153`

**Adım 4: Backend Doğrulama**
- **Kod:** `backend/src/routes/auth.ts:116-128`
- **İşlemler:**
  1. Zod validation (LoginSchema)
  2. User lookup (Prisma: `User.findUnique({ email })`)
  3. Password hash check (bcrypt.compare)
  4. Session token oluştur (crypto.randomBytes)
  5. Cookie set (httpOnly, secure)

**Adım 5: Dashboard'a Yönlendirme**
- **Kod:** `navigate('/dashboard')` - LoginPage.tsx:92
- **Sayfa:** `frontend/src/pages/DashboardPage.tsx`

**Adım 6: Dashboard Bileşenleri Yüklenir**
- **GenderChart:** `frontend/src/components/camera/GenderChart.tsx`
- **AgeChart:** `frontend/src/components/camera/AgeChart.tsx`
- **VisitorCountWidget:** `frontend/src/components/camera/VisitorCountWidget.tsx`

**Adım 7: WebSocket Bağlantısı**
- **Kod:** `cameraBackendService.connect()` - `frontend/src/services/cameraBackendService.ts:119-176`
- **URL:** `http://localhost:5001` (Python WebSocket server)
- **Event:** `socket.on('global')` - Analytics verileri

**Adım 8: Real-time Veri Güncellemeleri**
- **Kod:** `analyticsDataService.startRealtimeUpdates()` - `frontend/src/services/analyticsDataService.ts:221-241`
- **Akış:** Socket.IO event → transform → React state update → ECharts re-render

### Senaryo 2: Zone Labeling

**Adım 1: Zone Labeling Sayfası Açılır**
- **Sayfa:** `frontend/src/pages/dashboard/ZoneLabelingPage.tsx`
- **Component:** `ZoneCanvas` - `frontend/src/components/camera/ZoneCanvas.tsx`

**Adım 2: "Add Zone" Butonuna Tıklanır**
- **Kod:** `setIsDrawing(true)` - ZoneCanvas.tsx:289
- **State:** `isDrawing = true`

**Adım 3: Canvas Üzerinde Mouse Drag**
- **Kod:** `handleMouseDown()` - Satır 82-118
- **Kod:** `handleMouseMove()` - Satır 147-195
- **İşlem:** Normalized coordinates (0-1) ile rectangle çizilir

**Adım 4: Zone Tipi Seçilir**
- **Kod:** `updateZoneType()` - Satır 230-233
- **Tip:** 'entrance' (mavi) veya 'exit' (kırmızı)

**Adım 5: "Save All" Butonuna Tıklanır**
- **Kod:** `saveZones()` - Satır 235-253
- **İşlem:** `cameraBackendService.saveZones(zones)`

**Adım 6: WebSocket ile Backend'e Gönderilir**
- **Kod:** `cameraBackendService.saveZones()` - `frontend/src/services/cameraBackendService.ts`
- **Event:** `socket.emit('update_zones', zones)`

**Adım 7: Python Backend Zone'ları Günceller**
- **Kod:** `websocket_server.py` - `on_update_zones` callback
- **Kod:** `analytics.py:update_zones()` - Satır 348-386
- **İşlem:** Rectangle → Polygon dönüşümü, zone definitions güncellenir

**Adım 8: Backend API'ye Kaydedilir**
- **API:** `POST /api/zones` - `backend/src/routes/zones.ts:63-120`
- **Database:** Prisma `Zone.create()`

---

## AI Modelleri ve Kullanımı

### YOLOv11n (İnsan Tespiti)

**PDF Dokümanında:** YOLOv8n kullanılıyor
**Projede:** YOLOv11n kullanılıyor (daha yeni versiyon)

**Dosya:** `packages/camera-analytics/camera_analytics/analytics.py`
**Model Dosyası:** `packages/camera-analytics/yolo11n.pt` (otomatik indirilir)

**Kullanım:**
```python
# Satır 219: Model yükleme
self.model = YOLO('yolo11n.pt')

# Satır 672-683: Frame işleme
results = self.model.track(
    source=frame,
    persist=True,
    classes=[0],  # Sadece person class
    tracker="camera_analytics/bytetrack.yaml",
    device=self.device,  # mps/cuda/cpu
    conf=self.conf,  # Confidence threshold
    iou=0.45
)
```

**Ne Zaman Çağrılır:**
- Her frame'de (30 FPS)
- `_run_continuous()` → `_process_result()` → YOLO track

**Çıktı:**
- Bounding boxes (x1, y1, x2, y2)
- Track IDs (persistent tracking)
- Confidence scores

### MiVOLO (Yaş ve Cinsiyet Tahmini)

**PDF Dokümanında:** InsightFace kullanılıyor
**Projede:** MiVOLO kullanılıyor (daha doğru)

**Dosya:** `packages/camera-analytics/camera_analytics/age_gender.py`
**Model Dosyası:** `packages/camera-analytics/models/mivolo_model.pth`

**Kullanım:**
```python
# Satır 102-112: MiVOLO hazırlama
self.predictor = MiVOLO(
    ckpt_path=self.model_path,
    device=self.device,
    half=True,
    use_persons=True,
    disable_faces=False
)

# Satır 121-194: Tahmin
age, gender, confidence = self.predictor.predict(face_img)
```

**Ne Zaman Çağrılır:**
- Her 3 frame'de bir (async processing)
- `analytics.py` Satır 1047-1100: `_process_demographics()`
- ThreadPoolExecutor ile paralel işleme

**Çıktı:**
- Age: Float (0-100)
- Gender: "male" | "female"
- Confidence: Float (0-1)

### OpenCV (Görüntü İşleme)

**Kullanım:**
- Video capture: `cv2.VideoCapture()`
- Frame işleme: `cv2.imencode()`, `cv2.cvtColor()`
- Overlay çizimi: `cv2.rectangle()`, `cv2.putText()`

**Dosyalar:**
- `packages/camera-analytics/camera_analytics/sources.py` - Video kaynak yönetimi
- `packages/camera-analytics/camera_analytics/analytics.py` - Frame işleme

**Backend Seçimi:**
- macOS: `cv2.CAP_AVFOUNDATION` (AVFoundation)
- Windows: `cv2.CAP_DSHOW` (DirectShow)
- Linux: `cv2.CAP_V4L2` (Video4Linux2)

**Kod:** `sources.py` Satır 23-38: `_get_camera_backend()`

---

## WebSocket vs Webhook

### WebSocket Kullanımı

**Projede:** WebSocket (Socket.IO) kullanılıyor

**Neden WebSocket?**
- Gerçek zamanlı iki yönlü iletişim
- Düşük latency
- Persistent connection
- Event-based communication

**Kullanım:**
```python
# Python Backend (websocket_server.py)
socketio.AsyncServer()  # Socket.IO server
socket.emit('global', metrics)  # Analytics yayını
socket.emit('tracks', detections)  # Person tracks
```

```typescript
// Frontend (cameraBackendService.ts)
socket.on('global', (data) => { /* analytics */ });
socket.on('tracks', (tracks) => { /* detections */ });
```

**Event'ler:**
- `'global'` - Analytics metrikleri (her 1 saniyede bir)
- `'tracks'` - Person detections (her frame)
- `'zone_insights'` - Zone alerts (uzun süre kalma)
- `'update_zones'` - Zone güncelleme (frontend → backend)

**Dosyalar:**
- Python: `packages/camera-analytics/camera_analytics/websocket_server.py`
- Frontend: `frontend/src/services/cameraBackendService.ts`

### Webhook Kullanılmıyor

**Neden?**
- Webhook tek yönlü (server → client)
- HTTP request/response modeli (yüksek overhead)
- Gerçek zamanlı için uygun değil

**Alternatif:** Kafka (opsiyonel, production için)
- `packages/camera-analytics/camera_analytics/kafka_producer.py`
- `backend/src/lib/kafkaConsumer.ts`

---

## Kod Blokları ve Lokasyonlar

### UC-01: Authentication

| İşlem | Dosya | Satır | Açıklama |
|-------|-------|-------|----------|
| Login UI | `frontend/src/pages/LoginPage.tsx` | 113-250 | Login form render |
| Login handler | `frontend/src/pages/LoginPage.tsx` | 76-97 | Form submit |
| Auth service | `frontend/src/contexts/AuthContext.tsx` | 49-69 | API çağrısı |
| Login endpoint | `backend/src/routes/auth.ts` | 112-153 | POST /api/auth/login |
| Session create | `backend/src/routes/auth.ts` | 35-56 | Token oluşturma |
| Auth middleware | `backend/src/middleware/authMiddleware.ts` | 14-47 | Token doğrulama |

### UC-02: Dashboard

| İşlem | Dosya | Satır | Açıklama |
|-------|-------|-------|----------|
| Dashboard page | `frontend/src/pages/DashboardPage.tsx` | - | Ana sayfa |
| Gender chart | `frontend/src/components/camera/GenderChart.tsx` | 1-120 | Donut chart |
| Age chart | `frontend/src/components/camera/AgeChart.tsx` | 1-156 | Bar chart |
| WebSocket connect | `frontend/src/services/cameraBackendService.ts` | 119-176 | Socket.IO bağlantısı |
| Analytics service | `frontend/src/services/analyticsDataService.ts` | 221-241 | Veri subscription |
| Python analytics | `packages/camera-analytics/camera_analytics/analytics.py` | 527-1772 | YOLOv11n işleme |
| WebSocket server | `packages/camera-analytics/camera_analytics/websocket_server.py` | 75-151 | Event handlers |

### UC-08: Zone Labeling

| İşlem | Dosya | Satır | Açıklama |
|-------|-------|-------|----------|
| Zone canvas | `frontend/src/components/camera/ZoneCanvas.tsx` | 1-479 | Çizim UI |
| Mouse handlers | `frontend/src/components/camera/ZoneCanvas.tsx` | 82-217 | Drag & drop |
| Save zones | `frontend/src/components/camera/ZoneCanvas.tsx` | 235-253 | Backend'e kaydet |
| WebSocket emit | `frontend/src/services/cameraBackendService.ts` | - | update_zones event |
| Python update | `packages/camera-analytics/camera_analytics/analytics.py` | 348-386 | Zone güncelleme |
| Backend API | `backend/src/routes/zones.ts` | 63-120 | POST /api/zones |

### AI Modelleri

| Model | Dosya | Satır | Açıklama |
|-------|-------|-------|----------|
| YOLOv11n load | `packages/camera-analytics/camera_analytics/analytics.py` | 219 | Model yükleme |
| YOLOv11n track | `packages/camera-analytics/camera_analytics/analytics.py` | 672-683 | Frame işleme |
| MiVOLO init | `packages/camera-analytics/camera_analytics/age_gender.py` | 102-112 | Model hazırlama |
| MiVOLO predict | `packages/camera-analytics/camera_analytics/age_gender.py` | 121-194 | Yaş/cinsiyet |
| OpenCV capture | `packages/camera-analytics/camera_analytics/sources.py` | 23-38 | Video backend |

---

## PDF Doküman Karşılaştırması

### Farklılıklar

| Özellik | PDF Dokümanı | Proje |
|---------|--------------|-------|
| YOLO Model | YOLOv8n | **YOLOv11n** (daha yeni) |
| Age/Gender | InsightFace | **MiVOLO** (daha doğru) |
| Communication | WebSocket | **WebSocket (Socket.IO)** ✅ |
| Database | PostgreSQL | **SQLite (dev) / PostgreSQL (prod)** |
| Session | JWT | **Session tokens (cookies)** |

### Uyumluluk

**UC-01: Authenticate Manager** ✅
- Email/password login: ✅
- Remember me (30 gün): ✅
- Demo account: ✅
- Session management: ✅

**UC-02: View Operations Dashboard** ✅
- Gender distribution chart: ✅
- Age distribution chart: ✅
- Real-time updates: ✅
- Visitor counts: ✅

**UC-08: Zone Labeling** ✅
- Rectangle drawing: ✅
- Entrance/exit zones: ✅
- Save functionality: ✅
- Backend integration: ✅

### Ek Özellikler (PDF'de Yok)

- **RBAC (Role-Based Access Control)** - ADMIN, MANAGER, ANALYST, VIEWER
- **Privacy Mode** - Yüz bulanıklaştırma (GDPR uyumlu)
- **Anonymous Re-ID** - SHA-256 hash ile anonim takip
- **Gemini LLM Q&A** - Doğal dil ile analitik sorgulama
- **PDF/CSV Export** - Raporlama
- **Kafka Integration** - Yatay ölçeklenebilirlik (opsiyonel)
- **Hardware Optimization** - MPS/CUDA/CPU auto-detect

---

## Sorular ve Cevaplar

### 1. YOLOv11n nerede kullanılıyor?

**Cevap:** `packages/camera-analytics/camera_analytics/analytics.py`
- Satır 219: Model yükleme (`YOLO('yolo11n.pt')`)
- Satır 672-683: Frame işleme (`model.track()`)
- Her frame'de çağrılır (30 FPS)

### 2. MiVOLO nerede kullanılıyor?

**Cevap:** `packages/camera-analytics/camera_analytics/age_gender.py`
- Satır 102-112: Model hazırlama (`MiVOLO()`)
- Satır 121-194: Tahmin (`predict()`)
- Her 3 frame'de bir çağrılır (async)

### 3. OpenCV nerede kullanılıyor?

**Cevap:**
- `packages/camera-analytics/camera_analytics/sources.py` - Video capture
- `packages/camera-analytics/camera_analytics/analytics.py` - Frame işleme
- Platform-specific backend: AVFoundation (macOS), DirectShow (Windows), V4L2 (Linux)

### 4. WebSocket mi Webhook mu?

**Cevap:** **WebSocket (Socket.IO)** kullanılıyor
- Python: `packages/camera-analytics/camera_analytics/websocket_server.py`
- Frontend: `frontend/src/services/cameraBackendService.ts`
- Event'ler: `'global'`, `'tracks'`, `'zone_insights'`

### 5. Authentication nasıl çalışıyor?

**Cevap:**
1. Frontend: `LoginPage.tsx` → `AuthContext.login()`
2. Backend: `POST /api/auth/login` → Session token oluştur
3. Cookie: `session_token` (httpOnly, secure)
4. Middleware: `authMiddleware.ts` → Her request'te doğrula

### 6. Dashboard verileri nasıl geliyor?

**Cevap:**
1. Python: YOLOv11n + MiVOLO işleme
2. WebSocket: `emit('global', metrics)`
3. Frontend: `socket.on('global')` → `analyticsDataService`
4. React: State update → ECharts re-render

### 7. Zone labeling nasıl çalışıyor?

**Cevap:**
1. Frontend: `ZoneCanvas.tsx` → Mouse drag → Rectangle
2. WebSocket: `emit('update_zones', zones)`
3. Python: `analytics.py:update_zones()` → Zone definitions güncelle
4. Backend API: `POST /api/zones` → Prisma'ya kaydet

---

## Sonuç

ObservAI projesi, Team12_Prototype_V2.pdf dokümanındaki tüm gereksinimleri karşılamaktadır:

✅ **UC-01:** Authenticate Manager - Tam implementasyon
✅ **UC-02:** View Operations Dashboard - Real-time analytics
✅ **UC-08:** Zone Labeling - Interactive canvas

**Ek Özellikler:**
- YOLOv11n (PDF'de YOLOv8n)
- MiVOLO (PDF'de InsightFace)
- Privacy Mode (GDPR uyumlu)
- RBAC (Rol tabanlı erişim)
- Gemini LLM Q&A
- PDF/CSV Export

**Teknik Detaylar:**
- WebSocket (Socket.IO) kullanılıyor
- Session-based authentication (cookies)
- SQLite (dev) / PostgreSQL (prod)
- Hardware optimization (MPS/CUDA/CPU)

---

**Son Güncelleme:** 2025-01-07
**Versiyon:** 2.0.0

