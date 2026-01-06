# Frontend React Application

## Genel Bakış

ObservAI Frontend, React 18 + TypeScript + Vite ile geliştirilmiş modern web uygulamasıdır. Socket.IO ile Python backend'e bağlanır, gerçek zamanlı analitik verileri gösterir.

## Klasör Yapısı

```
frontend/
├── src/
│   ├── pages/
│   │   ├── LoginPage.tsx          # UC-01: Login ekranı
│   │   ├── DashboardPage.tsx      # UC-02: Operations Dashboard
│   │   └── ZoneLabelingPage.tsx    # UC-08: Zone labeling
│   ├── components/
│   │   ├── camera/
│   │   │   ├── CameraFeed.tsx      # Canlı video akışı
│   │   │   ├── GenderChart.tsx     # Cinsiyet dağılımı (UC-02)
│   │   │   ├── AgeChart.tsx        # Yaş dağılımı (UC-02)
│   │   │   ├── ZoneCanvas.tsx      # Zone çizimi (UC-08)
│   │   │   └── VisitorCountWidget.tsx
│   │   └── ui/
│   ├── services/
│   │   ├── cameraBackendService.ts # WebSocket bağlantısı
│   │   └── analyticsDataService.ts # Veri yönetimi
│   ├── contexts/
│   │   ├── AuthContext.tsx         # Authentication state
│   │   ├── DataModeContext.tsx     # Demo/Live mode
│   │   └── ToastContext.tsx        # Bildirimler
│   └── App.tsx
└── package.json
```

## Nasıl Çalışır?

### 1. Authentication (UC-01) - `src/pages/LoginPage.tsx`

**Login Akışı:**
```
1. Kullanıcı email/password girer
2. "Sign in" butonuna tıklar
3. AuthContext.login() çağrılır
4. POST /api/auth/login (backend)
5. Session cookie set edilir
6. navigate('/dashboard') → Dashboard'a yönlendirilir
```

**Kod Blokları:**
- `handleLogin()` - Satır 76-97
- `handleDemoLogin()` - Satır 99-111
- `useAuth()` hook - AuthContext'ten

**Demo Account:**
- Email: `admin@observai.com`
- Password: `demo1234`

### 2. Operations Dashboard (UC-02) - `src/pages/DashboardPage.tsx`

**Dashboard Bileşenleri:**
1. **GenderChart** (`src/components/camera/GenderChart.tsx`)
   - ECharts donut chart
   - Real-time güncelleme (Socket.IO)
   - Veri: `analyticsDataService.getData().gender`

2. **AgeChart** (`src/components/camera/AgeChart.tsx`)
   - ECharts bar chart
   - 7 yaş kategorisi: 0-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+
   - Veri: `analyticsDataService.getData().age`

3. **VisitorCountWidget**
   - Anlık ziyaretçi sayısı
   - Giriş/çıkış sayıları
   - Trend göstergesi

**Veri Akışı:**
```
Python Backend (WebSocket:5001)
    ↓
cameraBackendService.connect()
    ↓
Socket.IO event: 'global'
    ↓
analyticsDataService.transformBackendData()
    ↓
React components re-render
```

**Kod Blokları:**
- `analyticsDataService.startRealtimeUpdates()` - Satır 27-34 (GenderChart.tsx)
- `cameraBackendService.onAnalytics()` - WebSocket subscription

### 3. Zone Labeling (UC-08) - `src/components/camera/ZoneCanvas.tsx`

**Zone Çizim Akışı:**
```
1. "Add Zone" butonuna tıkla
2. Canvas üzerinde mouse drag
3. Rectangle oluştur (normalized coordinates: 0-1)
4. Zone tipi seç (entrance/exit)
5. "Save All" butonuna tıkla
6. cameraBackendService.saveZones() → WebSocket
7. Backend'e gönderilir (config/zones.json)
```

**Kod Blokları:**
- `handleMouseDown()` - Satır 82-118 (çizim başlatma)
- `handleMouseMove()` - Satır 147-195 (çizim güncelleme)
- `saveZones()` - Satır 235-253 (kaydetme)

**Zone Format:**
```typescript
{
  id: string
  name: string
  type: 'entrance' | 'exit'
  x: number (0-1)
  y: number (0-1)
  width: number (0-1)
  height: number (0-1)
  color: string (hex)
}
```

## WebSocket Bağlantısı

**Service:** `src/services/cameraBackendService.ts`

**Bağlantı:**
```typescript
cameraBackendService.connect('http://localhost:5001');

// Events:
socket.on('global', (data) => { /* analytics */ });
socket.on('tracks', (tracks) => { /* detections */ });
socket.on('zone_insights', (insights) => { /* alerts */ });
```

**Connection Status:**
- `connected` - Bağlı
- `disconnected` - Bağlantı kesildi
- `reconnecting` - Yeniden bağlanıyor
- `failed` - Bağlantı başarısız

## Çalıştırma

```bash
cd frontend
pnpm install
pnpm dev  # Port 5173
```

## Environment Variables

```env
VITE_BACKEND_URL=http://localhost:5001  # Python WebSocket
VITE_API_URL=http://localhost:3001     # Node.js API
```

## Build

```bash
pnpm build  # dist/ klasörüne build eder
pnpm preview  # Production build'i test et
```
