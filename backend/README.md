# Backend - ObservAI API Sunucusu

Bu klasör, ObservAI platformunun REST API sunucusunu içerir.

## İçerik

Bu klasörde şunlar bulunur:
- **Express.js** tabanlı REST API
- **PostgreSQL** veritabanı yönetimi
- **Prisma ORM** ile veritabanı işlemleri
- Kullanıcı kimlik doğrulama ve yetkilendirme
- Kamera, bölge ve analitik veri yönetimi

## Klasör Yapısı

```
backend/
├── src/
│   ├── routes/         # API endpoint'leri
│   ├── controllers/    # İş mantığı
│   ├── middleware/     # Express middleware'ler
│   ├── models/         # Veri modelleri
│   └── server.ts       # Ana sunucu dosyası
├── prisma/
│   ├── schema.prisma   # Veritabanı şeması
│   ├── migrations/     # Veritabanı migration'ları
│   └── seed.ts         # Test verisi
└── package.json
```

## Kullanılan Teknolojiler

- **Node.js 18+** - Runtime
- **Express.js** - Web framework
- **TypeScript** - Tip güvenliği
- **Prisma** - Modern ORM
- **PostgreSQL** - İlişkisel veritabanı
- **Zod** - Schema validation
- **bcryptjs** - Şifre hashleme
- **JWT** - Token bazlı kimlik doğrulama

## Kurulum ve Çalıştırma

### 1. Bağımlılıkları Yükle

```bash
cd backend
pnpm install
```

### 2. PostgreSQL Veritabanı Kur

```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Veritabanı oluştur
createdb observai
```

### 3. Ortam Değişkenleri

`.env` dosyası oluşturun:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/observai?schema=public"
JWT_SECRET="your-secret-key"
PORT=3001
```

### 4. Veritabanı Migration'larını Çalıştır

```bash
pnpm db:generate  # Prisma client oluştur
pnpm db:migrate   # Migration'ları uygula
pnpm db:seed      # Test verisi ekle (opsiyonel)
```

### 5. Geliştirme Modu

```bash
pnpm dev
```

API sunucusu `http://localhost:3001` adresinde çalışır.

### Production Build

```bash
pnpm build
pnpm start
```

## Veritabanı Şeması

### Ana Tablolar

1. **users** - Kullanıcı hesapları
   - id, email, password, role, createdAt

2. **sessions** - Oturum yönetimi
   - id, userId, token, expiresAt

3. **cameras** - Kamera konfigürasyonları
   - id, name, sourceType, sourceValue, createdBy

4. **zones** - Bölge tanımları
   - id, cameraId, name, type, coordinates, createdBy

5. **analytics_logs** - Analitik veri kayıtları
   - id, cameraId, peopleIn, peopleOut, currentCount, demographics, timestamp

6. **zone_insights** - Bölge öngörüleri
   - id, zoneId, occupancy, alerts, timestamp

7. **analytics_summaries** - Özet raporlar
   - id, cameraId, dailyVisitors, peakHours, demographics, date

## API Endpoint'leri

### Sağlık Kontrolü
```
GET /health - Sunucu durumu
```

### Kullanıcılar
```
GET    /api/users         - Tüm kullanıcıları listele
POST   /api/users         - Yeni kullanıcı oluştur
GET    /api/users/:id     - Kullanıcı detayı
```

### Kameralar
```
GET    /api/cameras       - Tüm kameraları listele
POST   /api/cameras       - Yeni kamera ekle
GET    /api/cameras/:id   - Kamera detayı
PUT    /api/cameras/:id   - Kamera güncelle
DELETE /api/cameras/:id   - Kamera sil
```

### Bölgeler (Zones)
```
GET    /api/zones/:cameraId     - Kameraya ait bölgeleri getir
POST   /api/zones               - Yeni bölge oluştur
PUT    /api/zones/:id           - Bölge güncelle
DELETE /api/zones/:id           - Bölge sil
POST   /api/zones/batch         - Toplu bölge işlemi
```

### Analitik Veriler
```
POST   /api/analytics                    - Analitik veri kaydet
GET    /api/analytics/:cameraId          - Kamera analitiklerini getir
GET    /api/analytics/:cameraId/summary  - Özet rapor
POST   /api/analytics/insights           - Bölge öngörüsü kaydet
GET    /api/analytics/insights/:zoneId   - Bölge öngörülerini getir
```

## Önemli Komutlar

```bash
# Geliştirme
pnpm dev              # Hot reload ile sunucu başlat

# Veritabanı
pnpm db:generate      # Prisma client oluştur
pnpm db:migrate       # Migration uygula
pnpm db:studio        # Prisma Studio aç (GUI)
pnpm db:seed          # Test verisi ekle
pnpm db:reset         # Veritabanını sıfırla (DİKKAT!)

# Production
pnpm build            # TypeScript derle
pnpm start            # Production sunucu
```

## Prisma Studio

Veritabanını görsel olarak yönetmek için:

```bash
pnpm db:studio
```

`http://localhost:5555` adresinde açılır.

## Python Backend ile Entegrasyon

Python kamera analitik backend'i bu API'ye veri gönderir:

```python
import requests

# Analitik veri gönder
response = requests.post('http://localhost:3001/api/analytics', json={
    'cameraId': 'camera-uuid',
    'peopleIn': 10,
    'peopleOut': 5,
    'currentCount': 5,
    'demographics': {
        'gender': {'male': 3, 'female': 2},
        'ages': {'adult': 4, 'young': 1}
    }
})
```

## Güvenlik

- Tüm şifreler bcryptjs ile hash'lenir
- JWT token'lar kullanıcı oturumları için kullanılır
- Zod ile gelen veri validasyonu yapılır
- SQL injection'a karşı Prisma ORM kullanılır

## Sorun Giderme

### Veritabanı Bağlantı Hatası

```bash
# PostgreSQL çalışıyor mu kontrol et
brew services list

# PostgreSQL'i yeniden başlat
brew services restart postgresql@15

# Bağlantıyı test et
psql -d observai -c "SELECT 1"
```

### Migration Hatası

```bash
# Veritabanını sıfırla ve yeniden kur
pnpm db:reset
pnpm db:migrate
pnpm db:seed
```

## Test Kullanıcıları (Seed Sonrası)

- **Admin**: admin@observai.com / admin123
- **Manager**: manager@observai.com / manager123

## Notlar

- Production'da güçlü bir JWT_SECRET kullanın
- SSL ile güvenli DATABASE_URL kullanın
- Düzenli olarak veritabanı yedeklemesi yapın
