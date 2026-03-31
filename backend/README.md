# Backend API Server

## Genel Bakış

ObservAI Backend API, Node.js + Express + TypeScript ile geliştirilmiş REST API sunucusudur. Prisma ORM ile SQLite/PostgreSQL veritabanı yönetimi yapar.

## Klasör Yapısı

```
backend/
├── src/
│   ├── index.ts              # Ana sunucu başlatma
│   ├── routes/               # API endpoint'leri
│   │   ├── auth.ts           # Kimlik doğrulama (UC-01)
│   │   ├── analytics.ts      # Analitik verileri (UC-02)
│   │   ├── zones.ts          # Bölge yönetimi (UC-08)
│   │   ├── cameras.ts        # Kamera yönetimi
│   │   ├── users.ts          # Kullanıcı yönetimi
│   │   ├── ai.ts             # Gemini LLM Q&A
│   │   ├── export.ts         # PDF/CSV export
│   │   └── python-backend.ts # Python backend kontrolü
│   ├── middleware/
│   │   ├── authMiddleware.ts # Session token doğrulama
│   │   └── roleCheck.ts      # RBAC middleware
│   └── lib/
│       ├── db.ts             # Prisma client
│       ├── kafkaConsumer.ts  # Kafka consumer (opsiyonel)
│       └── pythonBackendManager.ts # Python process yönetimi
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # Seed data
└── package.json
```

## Nasıl Çalışır?

### 1. Sunucu Başlatma (`src/index.ts`)

```typescript
// Express app oluşturulur
const app = express();

// Middleware'ler eklenir
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Route'lar bağlanır
app.use('/api/auth', authRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/zones', zonesRouter);
// ...

// Sunucu başlatılır
app.listen(PORT);
```

**Adımlar:**
1. Environment variables yüklenir (`.env`)
2. Database bağlantısı kurulur (Prisma)
3. Kafka consumer başlatılır (opsiyonel)
4. Express server port 3001'de dinlemeye başlar

### 2. Authentication (UC-01) - `src/routes/auth.ts`

**Login Akışı:**
```
1. POST /api/auth/login
   ├── Request: { email, password, rememberMe? }
   ├── Zod validation
   ├── User lookup (Prisma)
   ├── Password hash check (bcrypt)
   ├── Session token oluştur (crypto.randomBytes)
   ├── Cookie set (httpOnly, secure)
   └── Response: { id, email, firstName, lastName, role }
```

**Kod Blokları:**
- `LoginSchema` (Zod validation) - Satır 19-23
- `createSession()` - Satır 35-56
- `router.post('/login')` - Satır 112-153

**Session Yönetimi:**
- Token: 32 byte random hex
- Expiry: 30 gün (rememberMe) veya 7 gün
- Cookie: `session_token` (httpOnly, secure)

### 3. Analytics Dashboard (UC-02) - `src/routes/analytics.ts`

**Veri Akışı:**
```
Python Backend (WebSocket)
    ↓
Kafka Producer (opsiyonel)
    ↓
Kafka Consumer (backend/src/lib/kafkaConsumer.ts)
    ↓
Prisma Database (AnalyticsLog)
    ↓
GET /api/analytics/:cameraId
    ↓
Frontend Dashboard
```

**Endpoint'ler:**
- `GET /api/analytics/:cameraId` - Son 24 saat verileri
- `POST /api/analytics` - Yeni analitik kaydı
- `GET /api/analytics/compare` - Geçmiş karşılaştırma

### 4. Zone Labeling (UC-08) - `src/routes/zones.ts`

**Zone CRUD:**
```
1. GET /api/zones/:cameraId
   └── Prisma: Zone.findMany({ cameraId, isActive: true })

2. POST /api/zones
   ├── Validation (CreateZoneSchema)
   ├── RBAC check (requireManager)
   ├── Prisma: Zone.create()
   └── Response: created zone

3. PUT /api/zones/:id
   └── Prisma: Zone.update()

4. DELETE /api/zones/:id
   └── Prisma: Zone.update({ isActive: false })
```

**Zone Format:**
```typescript
{
  id: string (UUID)
  cameraId: string
  name: string
  type: 'ENTRANCE' | 'EXIT' | 'QUEUE' | 'TABLE' | 'CUSTOM'
  coordinates: [{x: 0-1, y: 0-1}, ...] // Normalized
  color: string (hex)
}
```

## Çalıştırma

```bash
cd backend
pnpm install
pnpm dev  # Port 3001
```

## Environment Variables

```env
DATABASE_URL="file:./prisma/dev.db"  # SQLite
PORT=3001
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=your-secret-key
KAFKA_ENABLED=false
KAFKA_BROKERS=localhost:9092
GEMINI_API_KEY=your-key  # LLM Q&A için
```

### Gemini API Key Kurulumu

`GEMINI_API_KEY` ortam değişkeni backend uygulamasının Gemini LLM modellerini kullanması için gereklidir:

1. **API Key Oluştur:** https://aistudio.google.com/app/apikey adresinden yeni bir API key oluştur
2. **`.env` Dosyası Oluştur:** `backend/` dizininde `.env` dosyası oluştur
3. **Key Ekle:** Aşağıdaki satırı `.env` dosyasına ekle:
   ```env
   GEMINI_API_KEY=your-api-key-buraya-gels
   ```
4. **Kontrol Et:** `debug_gemini.py` scriptini çalıştırarak bağlantıyı test et:
   ```bash
   python debug_gemini.py
   ```

## API Endpoints

| Endpoint | Method | Auth | Açıklama |
|----------|--------|------|----------|
| `/api/auth/login` | POST | - | Login (UC-01) |
| `/api/auth/register` | POST | - | Kayıt |
| `/api/auth/logout` | POST | ✅ | Çıkış |
| `/api/analytics/:cameraId` | GET | ✅ | Dashboard verileri (UC-02) |
| `/api/zones/:cameraId` | GET | ✅ | Bölgeleri getir (UC-08) |
| `/api/zones` | POST | ✅ MANAGER | Bölge oluştur (UC-08) |
| `/api/ai/chat` | POST | ✅ | Gemini Q&A |
| `/api/export/pdf` | GET | ✅ | PDF raporu |

## Database Schema

**User Model:**
- `id`, `email`, `passwordHash`, `role`, `isActive`

**Session Model:**
- `id`, `userId`, `token`, `expiresAt`

**Zone Model:**
- `id`, `cameraId`, `name`, `type`, `coordinates` (JSON), `color`

**AnalyticsLog Model:**
- `id`, `cameraId`, `timestamp`, `peopleIn`, `peopleOut`, `currentCount`, `demographics` (JSON)
