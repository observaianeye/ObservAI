# Faz 1 — Auth, Session, Branch, Weather, Settings, TR/EN

Tarih: 2026-04-28
Branch: refactor-partal
Test user: `test_faz1_1777370441@observai.test` (id `202f8b60-7eb6-4423-9f00-28b92f9ba05a`)

## ⚠ KRİTİK ORTAM SINIRLAMASI

**UI screenshot kanıtları toplanamadı.** İki yol da kapalıydı:

1. **BrowserMCP**: extension `Connect` butonu **disconnected** (`No connection to browser extension`).
2. **Playwright CLI**: Chromium binary kurulu değil (`Executable doesn't exist at .../chrome-headless-shell.exe`); kullanıcı kuralı gereği `pnpm exec playwright install` çalıştırılmadı.

Sonuç: Snapshot/screenshot/console-log gerektiren testler **BLOCKED**. Yerine API + DB + statik kod analizi ile doğrulanan testler **API-PASS** etiketlendi (gerçek kullanıcı akışı testi değil, kontrat testi). Tarayıcıda görsel doğrulama Faz 1 kapanışına eklenmeli — kullanıcı `Connect` tıklarsa veya Playwright yüklemesine izin verirse aynı oturumda devam edilebilir.

## Pre-flight

### P0 — Backend duplicate listener

- `netstat -ano | findstr :3001` → **tek PID 25704** dinliyor (IPv4+IPv6 aynı PID). TIME_WAIT bağlantılar normal client kuyruk.
- `curl /health` iki defa ardarda: ikisi de `{"status":"healthy","database":"connected","timestamp":...}` (timestamp farklı, içerik tutarlı).
- Faz 0'daki `MiroFish-Offline Backend` cevabı **tekrar üretilemedi** → muhtemelen başka bir test/process geçici cevap vermiş ya da ilk taramada unlucky cache. **Anomali resolved**, restart gereksiz.

### P1 — Ollama

- `qwen3:14b` (9.3 GB), `qwen2.5:14b` (9.0 GB), `llama3.1:8b` (4.9 GB), `nomic-embed-text` (274 MB) **hepsi yüklü**.
- `backend/.env` okuma reddedildi (sandbox permission). `.env.local` oluşturma adımı atlandı; primary `qwen3:14b` zaten mevcut → çalışıyor olmalı.
- Donanım aşımı yok (en büyük model 9.3 GB, RTX 5070 12 GB VRAM yeter).
- Kullanıcı eylemi: **Faz 5/6 öncesi `OLLAMA_MODEL` env değerini doğrula**.

### P2 — tables-ai-summary 6/6 FAIL (Faz 4'e taşınıyor, fix yok)

```
src/__tests__/tables-ai-summary.test.ts
  POST /api/tables/ai-summary
    × returns OK summary path        — expected 200, got 500
    × cached summary on repeat hit   — first.body.cached undefined
    × graceful fallback when Ollama throws — 500
    × English prompt when lang=en    — 500
    × ... (6/6 fail)
Test Files: 1 failed, Tests: 6 failed, Duration 593ms
```

**Muhtemel sebep:** route `tables.ts` POST handler'ı 500 fırlatıyor — Ollama servisi mock'lanmış ama dependency injection veya `aiConfig` import sırasında crash; `cached` field response'da yok → response shape değişmiş olabilir, test eski kontrata göre yazılmış. Faz 4 blocker.

## Özet Tablo


| ID    | Test                          | Sonuç                   | Kanıt                                           | Süre |
| ----- | ----------------------------- | ----------------------- | ----------------------------------------------- | ---- |
| 1.1a  | Register TRIAL                | **API-PASS**            | logs/01/1.1a_register.json + DB                 | <1s  |
| 1.1b  | Login + RememberMe            | **API-PASS**            | cookies_remember.txt + 1.1b_login_remember.json | <1s  |
| 1.1b' | Login NO RememberMe           | **API-PASS**            | header inspection                               | <1s  |
| 1.1c  | Logout                        | **API-PASS**            | 1.1c_logout.txt + /me 401                       | <1s  |
| 1.1d  | Demo login                    | **FAIL (MISSING)**      | endpoint 404, frontend demoLogin grep boş       | —    |
| 1.1e  | Password reset                | **PARTIAL**             | DB row OK; notification log'da email yok        | <1s  |
| 1.1f  | Session persistence (refresh) | **BLOCKED**             | UI gerekli                                      | —    |
| 1.2a  | Branch create                 | **API-PASS**            | 1.2a_branch_create.txt + DB                     | <1s  |
| 1.2b  | Branch PATCH lat/lng          | **API-PASS**            | 1.2b_branch_patch.txt                           | <1s  |
| 1.2c  | 2nd branch + multi-branch     | **API-PARTIAL**         | branch yaratıldı; navbar switch UI BLOCKED      | <1s  |
| 1.2d  | Branch delete + 404           | **API-PASS**            | 1.2d_delete.txt + /weather 404                  | <1s  |
| 1.3a  | Weather initial fetch         | **API-PASS**            | 1.3a_weather.json (Open-Meteo proxy)            | <1s  |
| 1.3b  | 10dk localStorage cache       | **BLOCKED**             | frontend-only test                              | —    |
| 1.3c  | Branch switch yeni weather    | **API-PASS**            | 2 farklı koordinat = 2 farklı response          | <1s  |
| 1.4   | Settings audit                | **STATIC**              | code reading (1044 sat. SettingsPage)           | —    |
| 1.5   | TR/EN spot check              | **STATIC-FAIL bulundu** | grep i18n                                       | —    |


## Detay

### 1.1a Register (API-PASS)

**Beklenen:** HTTP 201, accountType=TRIAL, trialExpiresAt = now+14d, otomatik dashboard.

**API Cevabı:**

```json
{"id":"202f8b60-7eb6-4423-9f00-28b92f9ba05a","email":"test_faz1_1777370441@observai.test",
 "firstName":"","lastName":"","role":"MANAGER","accountType":"TRIAL",
 "trialExpiresAt":"2026-05-12T10:00:41.384Z"}  → HTTP 201 ✓
```

**DB doğrulama:**

```
SELECT id, email, accountType, trialExpiresAt, firstName, lastName, companyName, role
FROM users WHERE email LIKE 'test_faz1_%' ORDER BY createdAt DESC LIMIT 1;
→ ('202f8b60-...', 'test_faz1_1777370441@observai.test', 'TRIAL',
   1778580041384, '', '', None, 'MANAGER')
```

trialExpiresAt 1778580041384 ms → 2026-05-12 (today + 14d) ✓
role=MANAGER (yeni TRIAL kullanıcısının rol default'u — beklenmedikse Faz 7'de RBAC notu).

**🐛 BUG (yan):** Register payload'unda `firstName="Faz1"`, `lastName="Test"`, `companyName="FazOne"` gönderildi ama DB boş/null döndü. **Backend register handler bu alanları drop ediyor** (zod schema dar?). Frontend RegisterPage'in name alanlarını dolduruyorsa kullanıcı hayal kırıklığı yaşar. Faz 7 RBAC + profile tamamlama notuna ekle.

**Sonuç:** API-PASS (kontrat). UI redirect doğrulaması BLOCKED.

### 1.1b Login + RememberMe (API-PASS)

**RememberMe=true cookie:**

```
Set-Cookie: session_token=ce8d1258...; Path=/;
            Expires=Thu, 28 May 2026 10:01:06 GMT;
            HttpOnly; SameSite=Lax
```

→ exp = now + ~30 gün → **>= 7d kuralı sağlandı** ✓

**RememberMe=false cookie:**

```
Set-Cookie: session_token=058db738...; Expires=Tue, 05 May 2026 10:01:34 GMT
```

→ exp = now + ~7 gün (default short).

**Not:** sessions tablosu kolonları `[id, userId, token, expiresAt, createdAt]` — `revokedAt` yok. Logout sonrası satırın silinip silinmediği veya token=null yapılıp yapılmadığı doğrulanmadı (tablo cleanup mantığı PARTIAL).

**Playwright auth-persistence.spec.ts:** chromium binary olmadığı için **çalıştırılamadı** (2/2 launch error).

### 1.1c Logout (API-PASS)

```
POST /api/auth/logout (cookie ile) → HTTP 200 {"success":true}
Set-Cookie: session_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT  ✓
```

Sonra ayni cookie ile:

```
GET /api/auth/me → HTTP 401 {"error":"Unauthorized: Invalid session"}  ✓
```

Server-side session invalidation çalışıyor.

### 1.1d Demo login (FAIL — MISSING)

**Beklenen:** `/api/auth/demo` veya benzeri endpoint, accountType=DEMO kullanıcı, role=VIEWER, 2 saat session, Live mode kilitli.

**Bulgular:**

- `POST /api/auth/demo` → **404 Not found**
- `backend/src/routes/auth.ts` rotaları: `register, login, logout, /me, change-password, forgot-password, reset-password` — **demo yok**.
- `grep -r "demoLogin\|/demo" backend/src` → tek match `analytics-validator.test.ts` içinde (`/demographics/`). **Demo akışı backend'de implementli değil**.
- `grep -r "demoLogin\|DEMO" frontend/src` → sadece `cameraFeed.demoMode` i18n stringleri ve LandingPage yorumu. **AuthContext'te demoLogin metodu yok**.
- DB'de tek `accountType='DEMO'` kullanıcı var (eski seed) ama yeni demo flow yok.

**Hipotez (5-Whys):**

1. Prompt + CLAUDE.md "demoLogin (2 saat session)" diyor — neden frontend'te yok?
2. CLAUDE.md güncellenmemiş (stale). Refactor sırasında demo akışı kaldırıldı.
3. Neden kaldırıldı? Muhtemelen TRIAL ile birleştirildi (yeni register zaten 14d trial veriyor → demo gereksiz görüldü).
4. Eski DEMO satırı DB'de izole, kullanılmıyor.
5. Dokümantasyon-kod uyumsuzluğu Faz 9'da temizlenmeli.

**Önerge (kod değişikliği YAPILMADI):**

- A) Demo akışı geri getir (`POST /auth/demo` → kısa-ömürlü VIEWER user) → kullanıcı tarafında satış sunumu için değerli.
- B) CLAUDE.md + ROADMAP güncelle: "DEMO accountType deprecated, register TRIAL'la değiştirildi".

**Karar gereken:** Kullanıcı seçimi.

### 1.1e Password reset (PARTIAL)

```
POST /api/auth/forgot-password {"email":"test_faz1_..."} → HTTP 200
{"success":true,"message":"If an account exists, a reset link will be sent."}
```

**DB doğrulama:**

```
SELECT * FROM password_resets ORDER BY createdAt DESC LIMIT 1;
→ ('ed6cea3c-f201-488b-9286-2c9304674fb1',
    '202f8b60-7eb6-4423-9f00-28b92f9ba05a',
    '2b72138b...', 1777374150951, 1777370550952, 0)  ✓
expiresAt - createdAt = 3.599.999 ms ≈ 1 saat ✓
used=0 ✓
```

**Email log:**

```
tail -5 backend/logs/notification-dispatch.log
```

Son 3 satır 2026-04-27 tarihli `staff_shift` event'leri. **Password reset email entry yok.**

**Hipotez:** `notification-dispatch.log` sadece `event:staff_shift` için yazıyor olabilir; password reset farklı kanaldan gönderiliyordur (veya `console.log`). Email gerçekten gönderilip gönderilmediği doğrulanmadı. Gmail MCP yok → inbox kontrolü mümkün değil.

**Sonuç:** Token üretimi PASS, email gönderim doğrulaması PARTIAL. Faz 6 Notifications kapsamına detaylı geçecek.

### 1.1f Session persistence (BLOCKED)

UI üzerinden refresh ve "1 saat sonra hâlâ giriş" testi browser olmadan yapılamaz. Cookie expiry header'dan teorik olarak doğrulanmış (1.1b).

### 1.2a Branch CRUD — Create (API-PASS)

**Backend schema:** `name`, `city`, `latitude`, `longitude`, `timezone`, `isDefault`. `**address` alanı YOK.** Geocoding `BranchSection.tsx`'in frontend tarafında — backend lat/lng direkt bekliyor.

```
POST /api/branches {"name":"Faz1 Test Branch","city":"Ankara",
                    "latitude":39.866,"longitude":32.749,"timezone":"Europe/Istanbul",
                    "isDefault":true}
→ HTTP 201, branch id 101cc5f1-3a87-495e-9e94-3c3c040189ff  ✓
```

### 1.2b PATCH (API-PASS) + 🐛 UTF-8 BUG

```
PATCH /api/branches/{id} {"city":"Çankaya","latitude":39.911,"longitude":32.862}
→ HTTP 200
```

**🐛 UTF-8 BUG (orta):** DB'de city değeri `**efbfbd 61 6e 6b 61 79 61` hex** = `U+FFFD + "ankaya"`. Curl Windows shell `Ç`'yi cp1254 olarak encode etmiş, server invalid UTF-8 byte sequence'i kabul edip `U+FFFD` REPLACEMENT character olarak depolamış.

**Risk:** Frontend doğru UTF-8 gönderir → bu bug curl-only. Ama **server-side input sanitization yok**: bozuk byte gelirse 400 yerine sessizce kayıt oluyor. Faz 7 Security/Validation notu.

**Reproduksiyon (öneri):** Backend `BranchSchema` zod'una `.refine(s => isValidUtf8(s))` veya `validator.isUTF8` ekle.

### 1.2c Multi-branch (API-PARTIAL)

1. branch yaratıldı (id `8a98444f`, "Faz1 Branch B", Istanbul). Topnavbar selector ve `DashboardFilterContext.branchId` switch davranışı **UI BLOCKED**. `/api/analytics/summary?branchId=X` filtresi network testi yapılmadı.

### 1.2d Delete (API-PASS)

```
DELETE /api/branches/{B} → HTTP 200 {"success":true}
GET /api/branches/{B}/weather → HTTP 404 {"error":"Branch not found"}  ✓
```

Cascade davranışı: bu test user'ında bağlı camera/zone yoktu → cascade yolu test edilmedi (PARTIAL).

### 1.3a-c Weather (Open-Meteo)

**1.3a Initial fetch** — backend proxy `/api/branches/:id/weather`:

```
HTTP 200, current_weather.temperature=18.8°C, weathercode=2,
windspeed=8 km/h, winddirection=275°, hourly precipitation_probability dizisi
Open-Meteo grid: 39.9375, 32.875 (input 39.911, 32.862 'e en yakın)
```

**1.3b Backend cache** — yok. Aynı branch için 2 ardışık call: `generationtime_ms=0.1124` vs `0.0954` → Open-Meteo'ya **her seferinde gidiyor**. Frontend localStorage 10dk cache CLAUDE.md'de yazıyor ama backend proxy katmanında cache yok.

**Karar:** Backend cache eklensin mi (Faz 5/9)? Şu an frontend cache yeterli olabilir; ama farklı sekmelerden ısrarla istek gelirse 3rd-party rate limit'e maruz kalır.

**1.3c Branch switch** — silinen Istanbul branch'in koordinatı (41.04, 28.99) ile Bilkent/Çankaya (39.91, 32.86) farklı response döndürdü → **proxy koordinata bağlı çalışıyor** ✓

## 1.4 Settings Audit (STATIC — 1044 satır)

### Envanter

`SettingsPage.tsx` tek-sayfa, 8 collapsable `<Section>` (accordion):


| Bölüm                  | Başlık (TR/EN)                   | Ne yapıyor                                                                                | Backend                     | Sıklık |
| ---------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------- | ------ |
| 1. Veri Modu           | Data Mode                        | Live/Demo toggle (DataModeContext)                                                        | `frontend-only`             | setup  |
| 2. Şubeler             | Branches *(hardcoded "Subeler")* | Branch CRUD + geocode + Google Maps link                                                  | `/api/branches`             | setup  |
| 3. Kamera ve Tespit    | Camera & Detection               | sensitivity, threshold, frameSkip, resolution, maxDetect, bbox toggle, demographics, zone | `/api/cameras/config` (?)   | setup  |
| 4. Bildirimler         | Notifications                    | push, sound, alert types (surge, occupancy, demoTrend, system)                            | `/api/notifications/prefs`  | setup  |
| 5. Bildirim Kanalları  | Notification Channels            | Telegram chatId, email                                                                    | user.telegramChatId         | setup  |
| 6. Bölgesel ve Görünüm | Regional & Display               | timeFormat 12/24h, theme light/dark/system                                                | `localStorage`              | nadir  |
| 7. Kullanıcı Profili   | User Profile                     | display name + avatar (?)                                                                 | `/api/auth/me` PATCH        | nadir  |
| 8. Güvenlik            | Security                         | sifre değiştir                                                                            | `/api/auth/change-password` | nadir  |
| 9. ObservAI            | About                            | versiyon + about                                                                          | static                      | nadir  |


### Karmaşıklık Tespiti (web-design-guidelines)

- **Tüm bölümler tek sayfada accordion** → uzun scroll. Tab ya da kategori (Account/System/Notifications) ile 3 grup'a bölünebilir.
- "Bildirimler" + "Bildirim Kanalları" iki ayrı bölüm — birbirine yakın, **MERGE adayı**.
- Camera section'da sensitivity/threshold/frameSkip dev-leveldedir; **VIEWER/MANAGER rolu için MOVE→advanced** veya tamamen developer-only.
- Veri Modu basit toggle ama **demo kullanıcıya kilitli** (DataModeContext) → yardımcı text/uyarı görünür mü kontrol gerek.
- Tema sistem/light/dark 3 buton yan yana (line 843-870) — mobile'da tasıyabilir.

### Önerge Tablosu (NO change made)


| Bölüm               | Karar                             | Gerekçe                                       | Risk                            |
| ------------------- | --------------------------------- | --------------------------------------------- | ------------------------------- |
| Veri Modu           | KEEP                              | Live↔Demo geçiş kullanıcı için kritik         | düşük                           |
| Şubeler             | KEEP                              | Multi-branch SaaS gereği                      | düşük                           |
| Kamera ve Tespit    | **MOVE → "Gelişmiş" alt-sayfası** | dev-level, günlük kullanıcı görmemeli         | orta — yanlış değer FPS düşürür |
| Bildirimler         | **MERGE with Bildirim Kanalları** | Aynı domain, 2 bölüm gereksiz                 | düşük                           |
| Bildirim Kanalları  | MERGE → Bildirimler altı          | aynı                                          | düşük                           |
| Bölgesel ve Görünüm | KEEP                              | tema + saat formatı yaygın talep              | düşük                           |
| Kullanıcı Profili   | **MOVE → TopNavbar dropdown**     | Settings'te yer kaplıyor; dropdown daha hızlı | düşük                           |
| Güvenlik            | KEEP                              | sifre değiştir merkezi                        | düşük                           |
| ObservAI About      | KEEP (sayfa altına küçült)        | versiyon bilgisi                              | düşük                           |


**Karar gereken:** kullanıcı bu önergeyi onaylar mı? Hiçbir kod değişikliği yapılmadı.

## 1.5 TR/EN Spot Check

### 1.5a Sayfa Bazında Parite (statik)

LoginPage.tsx + RegisterPage.tsx + SettingsPage.tsx için TR/EN paralel anahtarlar `frontend/src/i18n/strings.ts` içinde mevcut (settings.* için 8 başlık 2 dilde de tanımlı). UI tarafından doğrulama BLOCKED.

### 1.5b Hardcoded Turkish String Bulguları (KRİTİK)

`grep` ile bu fazın komponentlerinde t() kullanmayan string ler:

#### `frontend/src/components/settings/BranchSection.tsx` — **13+ HARDCODED TR**


| Satır | Metin                                            | Bağlam           |
| ----- | ------------------------------------------------ | ---------------- |
| 51    | `'Sube silindi'`                                 | toast success    |
| 62    | `'Varsayilan sube guncellendi'`                  | toast success    |
| 80    | `'Kaydetme basarisiz'`                           | error throw      |
| 82    | `'Sube guncellendi'` / `'Sube eklendi'`          | toast            |
| 108   | `"Yeni sube" butonu ile baslayin.`               | empty state hint |
| 134   | `title="Varsayilan yap"`                         | tooltip          |
| 293   | `'Geocoding servisi ulasilamaz'`                 | error throw      |
| 299   | `'Geocoding gecersiz koordinat dondurdu'`        | error throw      |
| 305   | `'Once sehir girin'`                             | form validation  |
| 314   | `'Geocoding hatasi'`                             | catch fallback   |
| 322   | `'Ad ve sehir zorunlu'`                          | form validation  |
| 376   | `'Sube duzenle'` / `'Yeni sube'`                 | modal title      |
| 410   | `title="Koordinat otomatik bul"`                 | tooltip          |
| 478   | `'Kaydediliyor...'` / `'Guncelle'` / `'Olustur'` | submit buton     |


t() çağrısı: **3** (484 satır içinde) → ~%5 i18n kapsama.

**Ek sorun:** stringler ASCII-bare ("Sube" yerine "Şube" değil, "guncellendi" yerine "güncellendi" değil). EN locale'de Türkçe ASCII metni göstermek olur **double-broken**: hem dil yanlış hem diakritik yok.

#### `frontend/src/pages/dashboard/SettingsPage.tsx`


| Satır | Metin                               | Sorun                                             |
| ----- | ----------------------------------- | ------------------------------------------------- |
| 520   | `title="Subeler"`                   | hardcoded TR (i18n outside, ayrıca diakritik yok) |
| 61    | `{ value: 'tr', label: 'Türkçe' }`  | OK (locale label kendi dilinde olmalı)            |
| 62    | `{ value: 'en', label: 'English' }` | OK                                                |


#### `frontend/src/pages/LoginPage.tsx`

- 16 t() çağrısı, hardcoded match yok (sadece comment satır 12'de "Welcome back" — kod-dışı).

#### `frontend/src/pages/RegisterPage.tsx`

- 32 t() çağrısı, hardcoded user-facing string yok.

### Toplam i18n Skoru (Faz 1 kapsamı)


| Dosya             | t()  | Hardcoded    | Kapsama |
| ----------------- | ---- | ------------ | ------- |
| LoginPage.tsx     | 16   | 0            | ✓       |
| RegisterPage.tsx  | 32   | 0            | ✓       |
| SettingsPage.tsx  | ~50+ | 1 (line 520) | ~%99    |
| BranchSection.tsx | 3    | 13+          | ~%5 ❌   |


**BranchSection.tsx Faz 4/7 i18n temizliğinin baş hedefi olmalı.** ASCII-bare TR + tooltipler + toast'lar + form errors → kapsamlı refactor.

## Bulunan Yan Sorunlar (kullanıcı bilgi listesine)

1. **Demo login sistemi backend+frontend'den kaldırılmış** ama CLAUDE.md hâlâ bahsediyor → dokümantasyon stale.
2. **Register handler firstName/lastName/companyName drop ediyor** → frontend boşa veri gönderiyor olabilir, profile boş başlıyor.
3. **Sessions tablosu revokedAt kolonu yok** → server-side logout cookie clear'la çalışıyor ama eski token DB'den temizlenmiyor olabilir (orphan satır birikimi).
4. **Backend UTF-8 input sanitization yok** → `BranchSchema` zod'una `validator.isUTF8` veya equivalent gerekli.
5. **Backend weather proxy cache yok** → frontend localStorage cache kapalı kalırsa Open-Meteo'ya rate-limit riski.
6. `**backend/logs/notification-dispatch.log` sadece staff_shift event'i logluyor** → password-reset/diğer email gönderimleri görünmez. Audit trail eksik.
7. `**role=MANAGER` yeni TRIAL register default** → kullanıcı sözleşmesinde belirtilmediyse RBAC ihlali olabilir (Faz 7 Security audit).

## Önerilen YENİ Test Vakaları (Faz 9 dokümana)

- **1.1.NEW-1**: Token expiry sonrası otomatik refresh
  - Nasıl: cookie Expires'ı 30s'ye değiştir, 35s bekle → /api/auth/me hâlâ 200 mi (refresh) yoksa 401 mi (forced logout)?
  - Beklenen: silent refresh OR clean redirect to /login
  - Risk: orta — kullanıcı kaybetme
- **1.1.NEW-2**: Concurrent login farklı tarayıcılarda
  - Nasıl: 2 cihazdan aynı user login → her ikisinde de session_token aktif mi?
  - Beklenen: ikisi de aktif (multi-device support) VEYA eskisi invalidate
  - Risk: yüksek (security)
- **1.1.NEW-3**: Brute-force rate limit
  - Nasıl: 10x yanlış password → /login 429 dönmeli
  - Beklenen: rate limit aktif
  - Risk: yüksek (Faz 7 Security)
- **1.2.NEW-1**: Branch sayısı limiti
  - Nasıl: 100 branch yarat
  - Beklenen: TRIAL hesap için ≤5 branch (subscription limit)
- **1.2.NEW-2**: Branch silinince bağlı camera+zone+staff ne olur?
  - Nasıl: 1 branch + 1 camera + 1 zone + 1 staff yarat → branch sil
  - Beklenen: DELETE engelle veya cascade transaction
- **1.3.NEW-1**: Open-Meteo down (network mock)
  - Nasıl: api.open-meteo.com'u DNS bloğa al → /api/branches/:id/weather
  - Beklenen: 503 + "weather unavailable", widget graceful degradation
- **1.4.NEW-1**: Settings reset doğrulama
  - Nasıl: 30 ayar değiştir → "Reset to defaults" → tüm değerler default mi
  - Beklenen: tüm alan default
- **1.5.NEW-1**: TR/EN dil değiştirince mid-form veri kaybı
  - Nasıl: register formunu yarı doldur → dil değiştir
  - Beklenen: form değerleri korunur

## Kolay Eklenebilecek Özellikler (Faz 9 EN dokümana)

### Feature 1: Multi-device session management

- **Niye değerli:** kullanıcı kaç cihazdan giriş yaptığını görsün, uzaktan logout yapabilsin
- **Nasıl eklenir:** sessions tablosuna `userAgent`, `ipAddress`, `lastActiveAt` kolonları + `/api/auth/sessions` GET/DELETE
- **Nasıl test edilir:** 2 farklı UA ile login → Settings → "Active sessions" listele → birini revoke et
- **Beklenen davranış (EN):**
  > "Settings → Security → Active sessions should list every device with cookie-based sessions, including UA, IP, last activity time, and a 'Revoke' button that immediately invalidates the cookie."

### Feature 2: Branch import via CSV

- **Niye değerli:** çok şubesi olan zincir (5+) tek tek yaratmasın
- **Nasıl eklenir:** `POST /api/branches/import` multipart CSV, server-side geocoding batch
- **Nasıl test edilir:** 10 satırlık CSV upload → response'ta yaratılan id'ler + başarısız satırlar
- **Beklenen davranış (EN):**
  > "Bulk import accepts a CSV with name,city,address columns; server geocodes each row via OSM Nominatim and creates branches transactionally. Partial failures return per-row error report."

### Feature 3: Settings search bar

- **Niye değerli:** 8 bölüm + 30+ ayar → kullanıcı "tema" aradığında doğrudan zıplasın
- **Nasıl eklenir:** Fuse.js fuzzy search üzerinde i18n key→label map; match'leyen Section'ı auto-expand
- **Nasıl test edilir:** "tema" yaz → Bölgesel ve Görünüm açılır + theme buton row'u highlight
- **Beklenen davranış (EN):**
  > "Typing in the Settings search box filters and auto-scrolls to the matching section, expanding it if collapsed. Highlight fades after 2s."

### Feature 4: Demo "test drive" user with sandbox data

- **Niye değerli:** satış sunumunda "register without committing" → conversion +
- **Nasıl eklenir:** `POST /api/auth/demo` → 2h TTL VIEWER user + clone of demo dataset; özel header `X-Demo-Mode: true` ile DELETE/POST yazma'lar 403
- **Nasıl test edilir:** demo create → dashboard görüntülenir, settings save 403, 2h sonra session expire
- **Beklenen davranış (EN):**
  > "Demo accounts grant read-only access for 2 hours with seeded sample data. Any mutating endpoint returns 403 with a clear 'Demo mode is read-only' message in the user's locale."

## Faz 1 SONUÇ

- **API-PASS:** 8/16 testçik (1.1a, 1.1b, 1.1b', 1.1c, 1.2a, 1.2b, 1.2d, 1.3a, 1.3c)
- **PARTIAL:** 3 (1.1e password reset email evidence yok, 1.2c multi-branch UI test yok, 1.2d cascade test yok)
- **BLOCKED (browser/UI):** 4 (1.1f session refresh, 1.3b localStorage cache, 1.4 visual audit, 1.5a UI parite)
- **FAIL:** 1 (1.1d demo login MISSING)
- **STATIC bulgular:** 7 yan sorun, 13+ hardcoded TR string BranchSection'da

### Faz 2 önünde blocker

- **YOK** — Faz 2 (Camera & Streaming) kameraların durumuna bağlı, auth zaten çalışıyor.
- Faz 4 (Tables) için **var**: tables-ai-summary 6/6 fail.

### Faz 1'e geri dönmek için (kullanıcı kararına bağlı)

1. BrowserMCP extension `Connect` → snapshot+screenshot kanıtları toplanır.
  VEYA `pnpm exec playwright install` → headless E2E.
2. Demo login: geri getir mi yoksa CLAUDE.md güncelle mi?
3. BranchSection.tsx i18n refactor — Faz 7 i18n temizliğinde tek seferde.
4. Backend UTF-8 input validation — Faz 7 Security'de.

