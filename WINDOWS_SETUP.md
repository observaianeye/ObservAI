# ObservAI - Windows Kurulum Rehberi

Bu rehber, ObservAI projesini Windows üzerinde kurmak ve çalıştırmak için adım adım talimatlar içerir.

## 📋 İçindekiler

- [Gereksinimler](#gereksinimler)
- [Kurulum Adımları](#kurulum-adımları)
- [İlk Çalıştırma](#ilk-çalıştırma)
- [Sorun Giderme](#sorun-giderme)
- [Gitignore Sorunları ve Çözümleri](#gitignore-sorunları-ve-çözümleri)

---

## 🔧 Gereksinimler

### Zorunlu Yazılımlar

1. **Node.js 18+**
   - İndirme: [nodejs.org](https://nodejs.org/)
   - Kurulum sırasında "Add to PATH" seçeneğini işaretleyin
   - Kurulumu doğrulamak için: `node --version` (CMD veya PowerShell'de)

2. **Python 3.11+**
   - İndirme: [python.org](https://www.python.org/downloads/)
   - ⚠️ **ÖNEMLİ**: Kurulum sırasında "Add Python to PATH" seçeneğini mutlaka işaretleyin
   - Kurulumu doğrulamak için: `python --version`

3. **Git**
   - İndirme: [git-scm.com](https://git-scm.com/download/win)
   - Kurulum sırasında varsayılan ayarları kullanabilirsiniz

4. **pnpm** (Node.js kurulduktan sonra)
   ```cmd
   npm install -g pnpm
   ```

### Opsiyonel Yazılımlar

- **PostgreSQL** (SQLite varsayılan olarak kullanılır, PostgreSQL opsiyoneldir)
  - İndirme: [postgresql.org](https://www.postgresql.org/download/windows/)

---

## 📦 Kurulum Adımları

### 1. Repository'yi Klonlama

**Git Bash veya CMD kullanarak:**

```cmd
git clone <repository-url>
cd ObservAI
```

**Not:** `.gitignore` dosyası nedeniyle bazı klasörler (venv, node_modules, .env) git'e dahil edilmemiştir. Bu normaldir ve aşağıdaki adımlarda oluşturulacaktır.

### 2. Python Virtual Environment Kurulumu

```cmd
cd packages\camera-analytics

REM Virtual environment oluştur
python -m venv venv

REM Virtual environment'ı aktif et
venv\Scripts\activate.bat

REM pip'i güncelle
python -m pip install --upgrade pip

REM Proje bağımlılıklarını kur
pip install -e .

REM Eksik bağımlılıkları kontrol et ve kur
python -c "import lap" || pip install lap
python -c "import yt_dlp" || pip install yt-dlp
```

**Önemli Notlar:**
- Virtual environment her bilgisayarda ayrı oluşturulmalıdır (gitignore'da)
- `venv` klasörü proje içinde `packages\camera-analytics\venv` konumunda olmalıdır
- İlk çalıştırmada YOLOv12n ve InsightFace modelleri otomatik indirilecektir (~200 MB)

### 3. Frontend Kurulumu

```cmd
cd ..\..\frontend

REM Bağımlılıkları kur
pnpm install
```

**Ortam Değişkenleri:**

`frontend\.env` dosyası oluşturun (`.env.example` dosyasını kopyalayarak):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Not:** Supabase hesabınız yoksa, demo modu ile çalışabilirsiniz (bazı özellikler sınırlı olabilir).

### 4. Backend API Kurulumu

```cmd
cd ..\backend

REM Bağımlılıkları kur
npm install

REM Prisma client oluştur
npx prisma generate

REM Veritabanı migration'larını çalıştır
npx prisma migrate dev
```

**Ortam Değişkenleri:**

`backend\.env` dosyası oluşturun (`.env.example` dosyasını kopyalayarak):

```env
# SQLite (varsayılan - ekstra kurulum gerekmez)
DATABASE_URL="file:./prisma/dev.db"

# Veya PostgreSQL kullanmak isterseniz:
# DATABASE_URL="postgresql://username:password@localhost:5432/observai?schema=public"

JWT_SECRET="your-secret-key-change-in-production"
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Opsiyonel: Gemini AI için
GEMINI_API_KEY=your-gemini-api-key

# Opsiyonel: Kafka için
KAFKA_ENABLED=false
KAFKA_BROKERS=localhost:9092
```

**Not:** SQLite varsayılan olarak kullanılır ve ekstra kurulum gerektirmez. PostgreSQL kullanmak isterseniz, PostgreSQL'i kurmanız ve veritabanını oluşturmanız gerekir.

---

## 🚀 İlk Çalıştırma

### Yöntem 1: Otomatik Script (Önerilen)

Proje kök dizininde:

```cmd
start-all.bat
```

Bu script tüm servisleri otomatik olarak başlatır:
- Frontend (http://localhost:5173)
- Backend API (http://localhost:3001)
- Camera Analytics AI (ws://0.0.0.0:5001)
- Prisma Studio (http://localhost:5555)

Servisleri durdurmak için:

```cmd
stop-all.bat
```

### Yöntem 2: Manuel Başlatma

**Terminal 1 - Camera Analytics:**
```cmd
cd packages\camera-analytics
venv\Scripts\activate.bat
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5001
```

**Terminal 2 - Backend API:**
```cmd
cd backend
npm run start:node
```

**Terminal 3 - Frontend:**
```cmd
cd frontend
pnpm dev
```

**Terminal 4 - Prisma Studio (Opsiyonel):**
```cmd
cd backend
npx prisma studio
```

### Tarayıcıda Açma

Tüm servisler başladıktan sonra:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Prisma Studio: http://localhost:5555

---

## 🐛 Sorun Giderme

### Port Çakışmaları

Eğer bir port zaten kullanılıyorsa:

```cmd
REM Hangi process port'u kullanıyor kontrol et
netstat -ano | findstr :3001

REM Process'i öldür (PID'yi yukarıdaki komuttan alın)
taskkill /F /PID <PID_NUMBER>
```

Veya `stop-all.bat` script'ini çalıştırarak tüm servisleri durdurabilirsiniz.

### Python Virtual Environment Sorunları

**"venv\Scripts\activate.bat bulunamadı" hatası:**
- Virtual environment'ın doğru oluşturulduğundan emin olun
- `packages\camera-analytics\venv` klasörünün var olduğunu kontrol edin
- Yeniden oluşturun: `python -m venv venv`

**"python komutu bulunamadı" hatası:**
- Python'un PATH'e eklendiğinden emin olun
- `python --version` komutu çalışmalı
- Windows'ta PATH'e eklemek için: Sistem Ayarları > Ortam Değişkenleri

### Node.js/pnpm Sorunları

**"pnpm komutu bulunamadı" hatası:**
```cmd
npm install -g pnpm
```

**"node_modules bulunamadı" hatası:**
```cmd
cd frontend
pnpm install

cd ..\backend
npm install
```

### Kamera Erişim Sorunları

Windows'ta kamera erişimi için:
- Kamera izinlerinin verildiğinden emin olun (Windows Ayarlar > Gizlilik > Kamera)
- DirectShow uyumlu bir kamera kullanın
- Webcam index'i genellikle `0`'dır
- Farklı bir kamera denemek için `--source 1` veya `--source 2` kullanın

### Veritabanı Sorunları

**SQLite kullanıyorsanız:**
- `backend\prisma\dev.db` dosyası otomatik oluşturulur
- Migration'ları çalıştırdığınızdan emin olun: `npx prisma migrate dev`

**PostgreSQL kullanıyorsanız:**
- PostgreSQL servisinin çalıştığından emin olun
- Veritabanının oluşturulduğundan emin olun
- `DATABASE_URL` formatını kontrol edin

---

## 📁 Gitignore Sorunları ve Çözümleri

Proje `.gitignore` dosyası nedeniyle bazı önemli klasör ve dosyaları git'e dahil etmez. Bu normaldir ve her bilgisayarda yeniden oluşturulmalıdır.

### Eksik Klasörler ve Dosyalar

#### 1. `venv/` Klasörü (Python Virtual Environment)

**Durum:** Gitignore'da, her bilgisayarda ayrı oluşturulmalı

**Çözüm:**
```cmd
cd packages\camera-analytics
python -m venv venv
venv\Scripts\activate.bat
pip install -e .
```

#### 2. `node_modules/` Klasörleri

**Durum:** Gitignore'da, her bilgisayarda ayrı kurulmalı

**Çözüm:**
```cmd
REM Frontend
cd frontend
pnpm install

REM Backend
cd ..\backend
npm install
```

#### 3. `.env` Dosyaları

**Durum:** Gitignore'da, güvenlik için

**Çözüm:**
- `backend\.env.example` dosyasını kopyalayarak `backend\.env` oluşturun
- `frontend\.env.example` dosyasını kopyalayarak `frontend\.env` oluşturun
- Değerleri kendi ayarlarınıza göre düzenleyin

#### 4. Model Dosyaları (`*.pt`, `*.pth`)

**Durum:** Gitignore'da, boyut nedeniyle

**Çözüm:**
- İlk çalıştırmada otomatik indirilir
- YOLOv12n ve InsightFace modelleri ~200 MB
- İndirme işlemi otomatik olarak gerçekleşir

#### 5. `logs/` Klasörü

**Durum:** Gitignore'da, log dosyaları

**Çözüm:**
- `start-all.bat` çalıştırıldığında otomatik oluşturulur
- Manuel oluşturmak için: `mkdir logs`

### Kurulum Checklist

Yeni bir Windows bilgisayara projeyi aldığınızda:

- [ ] Git repository'yi klonlayın
- [ ] Node.js 18+ kurulu olduğundan emin olun
- [ ] Python 3.11+ kurulu ve PATH'te olduğundan emin olun
- [ ] pnpm global olarak kurulu olduğundan emin olun
- [ ] `packages\camera-analytics\venv` klasörünü oluşturun
- [ ] Python bağımlılıklarını kurun (`pip install -e .`)
- [ ] Frontend bağımlılıklarını kurun (`pnpm install`)
- [ ] Backend bağımlılıklarını kurun (`npm install`)
- [ ] Prisma client'ı oluşturun (`npx prisma generate`)
- [ ] Migration'ları çalıştırın (`npx prisma migrate dev`)
- [ ] `backend\.env` dosyasını oluşturun
- [ ] `frontend\.env` dosyasını oluşturun
- [ ] `start-all.bat` ile test edin

---

## 💡 İpuçları

1. **Virtual Environment Unutmayın:** Python komutlarını çalıştırmadan önce `venv\Scripts\activate.bat` ile aktif edin

2. **Port Kontrolü:** Servisleri başlatmadan önce portların boş olduğundan emin olun (3001, 5001, 5173, 5555)

3. **Log Dosyaları:** Sorun yaşarsanız `logs\` klasöründeki log dosyalarını kontrol edin

4. **PowerShell vs CMD:** Batch script'ler CMD'de çalışır. PowerShell'de çalıştırmak isterseniz, `cmd /c start-all.bat` kullanın

5. **Kamera Testi:** İlk çalıştırmada webcam index 0'ı deneyin. Çalışmazsa 1, 2, vb. deneyin

---

## 📞 Destek

Sorun yaşarsanız:
1. Log dosyalarını kontrol edin (`logs\` klasörü)
2. Port çakışmalarını kontrol edin
3. Tüm bağımlılıkların kurulu olduğundan emin olun
4. Virtual environment'ın aktif olduğundan emin olun

---

**Son Güncelleme:** 2025

