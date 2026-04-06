# ObservAI - Gelistirme Yol Haritasi (ROADMAP)

## Amac
Bu dosya, proje ekibinin (5 kisi) Claude Code kullanarak takip edecegi adim adim gelistirme planidir. Her adim bir Claude oturumunda calisan kisi tarafindan yurutulur. Bitirilen adimlar `DONE`, uzerinde calisilanlar `IN PROGRESS`, bekleyenler `TODO`, kullanici karari gerekenler `ASK USER` olarak etiketlenir.

## Kurallar
- Her adim baslangicinda bu dosyayi oku ve durumu guncelle
- Bir adimi bitirdiginde status'u `DONE` yap ve tarihi yaz
- Bir adima basladiginda `IN PROGRESS` yap ve ismini yaz
- Adimlar arasi bagimliliklar `Bagimlilik:` ile belirtilmis; bagimli adim bitmeden baslanmaz
- Kullanici karari gereken adimlar `ASK USER` olarak isaretli; kullaniciya sorular sorup netlestirilecek
- Her adim sonunda ilgili degisiklikler test edilmeli
- CLAUDE.md dosyasini her zaman oku, proje bilgisi orada

## Takim Arkadaslari Icin Talimatlar

> **ONCELIKLI:** Asagidaki adimlari sirasıyla takip edin. Branch olusturmadan hicbir ise baslamayin!

### Ilk Kurulum (Bir kez yapilir)
1. `git clone https://github.com/observaianeye/ObservAI.git` ile repoyu klonlayin
2. **Kendi isminizle branch olusturun:**
   ```bash
   git checkout -b <isminiz>   # ornek: git checkout -b ahmet
   git push origin <isminiz>   # remote'a push edin
   ```
3. Bagimliliklari yukleyin:
   - `cd frontend && pnpm install`
   - `cd backend && npm install`
   - `cd packages/camera-analytics && pip install -e ".[demographics]"`
4. `.env.example` dosyalarini kopyalayin: `cp .env.example .env` (root, backend/, frontend/)

### Her Oturumda
1. Claude Code'a: **"ROADMAP.md'yi oku ve uygun adimi sec"** deyin
2. Kendi adiniza atanmis veya `TODO` olan bir adimi secin
3. `IN PROGRESS` olan baska birinin adimina **dokunmayin**
4. Calismalarinizi kendi branch'inizde yapin, commit + push edin
5. Adim tamamlaninca `main`'e merge edin (bkz. CLAUDE.md → Git Calisma Akisi)
6. ROADMAP'te adimin durumunu `DONE` yapin, tarih ve isminizi yazin

### Onemli Uyarilar
- `.env` dosyalari repoda yoktur — `.env.example` dosyalarini kopyalayip doldurun
- YOLO model dosyasi (`yolo11l.pt`) git'te degildir — ilk calistirmada otomatik indirilir
- Her zaman kendi branch'inizde calisin, dogrudan `main`'e commit yapmayin

---

## ADIM 1: GitHub Kurulumu ve Repo Esleme
**Durum:** IN PROGRESS
**Atanan:** Emre (2026-04-06)
**Bagimlilik:** Yok (ilk adim)

### Amac
`partalemre/ObservAI` reposundaki `windows-rtx5070` branch'ini `observaianeye/ObservAI` reposuna main olarak yansitmak. Tum ekip bundan sonra `observaianeye/ObservAI` uzerinden calisacak.

### Yapilacaklar

1. **Remote ekleme:**
   ```bash
   cd C:\Users\Gaming\Desktop\Project\ObservAI
   git remote add team https://github.com/observaianeye/ObservAI.git
   git fetch team
   ```

2. **Mevcut kodu team/main'e push etme:**
   ```bash
   git push team windows-rtx5070:main --force
   ```
   > NOT: Bu `observaianeye/ObservAI` reposunun main branch'ini tamamen mevcut kodla degistirir. Geri donusu olmayan bir islemdir. Kullanicidan onay alinmali.

3. **GitHub branch koruma kurallari (opsiyonel):**
   ```bash
   # gh CLI ile main branch korumasini aktif et
   gh api repos/observaianeye/ObservAI/branches/main/protection \
     --method PUT \
     --field required_pull_request_reviews='{"required_approving_review_count":1}' \
     --field enforce_admins=false
   ```
   > Ekip GitHub bilmediginden, herkes dogrudan main'e push yapabilir. Ama PR sureci onerilir.

4. **Ekip icin basit calisma akisi dokumantasyonu:**
   - CLAUDE.md'ye su bolumu ekle:
   ```
   ## Git Calisma Akisi (Ekip icin)
   - Ana repo: https://github.com/observaianeye/ObservAI
   - Her gelistirici kendi branch'inde calisir (ornek: feature/notification-system)
   - Claude Code ile commit ve push yapilir
   - Bitirilen ozellikler main'e merge edilir
   - Komutlar:
     git checkout -b feature/ozellik-adi    # Yeni branch
     git add . && git commit -m "aciklama"  # Commit
     git push origin feature/ozellik-adi    # Push
     git checkout main && git pull          # Main'i guncelle
     git merge feature/ozellik-adi          # Merge
   ```

5. **`.gitignore` kontrolu:**
   - `node_modules/`, `venv/`, `.env`, `dev.db`, `__pycache__/`, `logs/`, `*.pt` gibi dosyalarin gitignore'da oldugundan emin ol

6. **GitHub Actions CI (temel):**
   - `.github/workflows/ci.yml` olustur:
     - Push/PR'da: frontend `pnpm typecheck` + backend `npm run build` calistir
     - Python testleri (varsa) calistir
   - Bu minimal CI, hocalarin SRS'te yazan "GitHub Actions" gereksinimini karsilar

### Test
- `git remote -v` ile `team` remote'unun gorundugundan emin ol
- `observaianeye/ObservAI` GitHub sayfasinda kodun guncel oldugunu dogrula
- CI workflow'un basarili calistigini dogrula

---

## ADIM 2: Tracker ve Privacy Blur Inceleme
**Durum:** ASK USER
**Atanan:** -
**Bagimlilik:** Yok

### Amac
BoT-SORT tracker'in ID atama ve bbox uretme sorunlarini arastirmak. Privacy blur'un tracker/demografi uzerindeki etkisini incelemek.

### Mevcut Durum Analizi
- **Privacy blur**: `privacy_mode` flag'i ile kontrol ediliyor. Blur **sadece output frame'e** uygulanir, tracking hesaplamalarini **etkilemez**. Yani blur acik/kapali olmasi tracker'i degistirmez.
- **Bbox sorunu**: Muhtemel sebepler:
  1. BoT-SORT `new_track_thresh: 0.60` cok dusuk olabilir → ayni kisi icin yeni track olusturuyor
  2. `track_buffer: 120` (120 frame = ~4 saniye) sonra track kaybolup yeniden olusturuluyor
  3. Ic ice duran kisiler icin IoU match basarisiz → yeni ID ataniyor
  4. `appearance_thresh: 0.25` cok dusuk → re-ID basarisiz
  5. Demografik esleme (aspect ratio + gender + age) yetersiz kalabiliyor

### Kullaniciya Sorulacak Sorular
Bu adima gelindiginde kullaniciya sor:
1. "Privacy blur su anda acik mi kapali mi? Default config'te `privacy_mode: false` gorunuyor."
2. "Bbox sorunu en cok hangi durumda oluyor? (a) Kisi hareket etmiyorken, (b) Kisiler birbirine yaklasinca, (c) Kisi kameradan cikip girince, (d) Surekli her zaman"
3. "Cinsiyet/yas tahminleri hangi durumda kotu? (a) Yuz gorunmuyorken, (b) Uzaktan, (c) Isik kotu, (d) Genel olarak yanlis"
4. "Demo sirasinda privacy blur acik mi olmali? KVKK/GDPR gereksinimi sunumda sorulur mu?"

### Potansiyel Duzeltmeler (kullanici cevabina gore uygulanacak)

**Tracker stabilizasyonu:**
- `botsort.yaml` parametreleri ayarlama:
  - `new_track_thresh`: 0.60 → 0.70 (daha secici yeni track olusturma)
  - `match_thresh`: 0.75 → 0.80 (daha siki eslestirme)
  - `appearance_thresh`: 0.25 → 0.40 (daha guclu re-ID)
  - `track_buffer`: 120 → 180 (daha uzun sure track tutma)
- `analytics.py` icerisinde:
  - `_drop_stale_tracks()` TTL: 5.0s → 8.0s (daha gec birakma)
  - Dedup eslesme penceresi: 60s → 120s

**Demografi iyilestirme:**
- `face_detection_interval`: 3 → 2 (daha sik yuz tespiti)
- `demo_min_confidence`: 0.30 → 0.25 (daha dusuk esik)
- `demo_gender_consensus`: 0.60 → 0.55
- InsightFace `det_size` artirma (640x640 → 960x960) → GPU'ya bagli

**Dosyalar:**
- `packages/camera-analytics/camera_analytics/botsort.yaml`
- `packages/camera-analytics/camera_analytics/analytics.py` (satirlar: 1659-1705, 1842-1870)
- `packages/camera-analytics/config/default_zones.yaml`

### Test
- Kamera onunde 2-3 kisi ile test: her kisiye tek ID atandigini dogrula
- Kisi gidip geri geldiginde ayni ID'yi aldigini dogrula (re-ID)
- Cinsiyet/yas tahminlerinin tutarliligini gozlemle
- Zone giris/cikis sayilarinin dogru oldugunu dogrula

---

## ADIM 3: LLM Entegrasyonu (Ollama - Llama 3.1 8B)
**Durum:** TODO
**Atanan:** -
**Bagimlilik:** Yok

### Amac
Ollama uzerinde Llama 3.1 8B modelini tam verimle calistirmak. AI chat ve insight engine'in dogru, hizli ve Turkce/Ingilizce calismasini saglamak.

### Yapilacaklar

1. **Ollama kurulumu ve model indirme:**
   ```bash
   # Ollama zaten kurulu olmali, degilse: https://ollama.ai
   ollama pull llama3.1:8b
   ollama list  # Modelin indigini dogrula
   ```

2. **Backend AI route iyilestirme** (`backend/src/routes/ai.ts`):
   - Ollama'yi birincil saglayici yap (zaten default)
   - Model oncelik sirasini guncelle: `llama3.1:8b` (tek model, basit tut)
   - Ollama `num_predict` degerini 512 → 1024 yap (daha detayli cevaplar)
   - `temperature`: 0.7 → 0.5 (daha tutarli cevaplar, analytics icin)
   - Context prompt'u iyilestir:
     - Turkce soru gelirse Turkce, Ingilizce gelirse Ingilizce cevapla (mevcut davranis)
     - Analytics verilerini daha yapisal olarak sun (tablo formati)
     - Hava durumu verisini her zaman ekle

3. **Insight Engine iyilestirme** (`backend/src/services/insightEngine.ts`):
   - `getAIRecommendations()` fonksiyonunu Ollama ile de calisacak sekilde guncelle
   - Gemini'ye bagimli kisimlari Ollama fallback'i ile destekle
   - Recommendation prompt'unu Turkce/Ingilizce dual olarak yaz
   - Demo recommendations yerine gercek Ollama cevaplari kullan

4. **Ollama baglanti kontrolu:**
   - Backend baslarken Ollama'nin calistigini kontrol et
   - Calismiyorsa log'a uyari yaz, Gemini fallback'e gec
   - Frontend'te AI durumunu goster (connected/disconnected badge)

5. **GPU optimizasyonu:**
   - Ollama varsayilan olarak GPU kullanir (CUDA)
   - `OLLAMA_NUM_GPU=999` env degiskeni ile tum katmanlari GPU'ya yukle
   - YOLO + InsightFace + Ollama ayni anda calisacak: ~5GB (Llama) + ~3GB (YOLO+InsightFace) = ~8GB, 12GB VRAM'e sigar

6. **`.env` dosyalarini guncelle:**
   ```
   AI_PROVIDER=ollama
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.1:8b
   ```

### Dosyalar
- `backend/src/routes/ai.ts` — Chat endpoint ve context building
- `backend/src/services/insightEngine.ts` — Insight generation ve recommendations
- `backend/.env` — AI konfigurasyonu
- `frontend/src/components/GlobalChatbot.tsx` — Chat UI

### Test
- `ollama run llama3.1:8b "Merhaba, kafe analitigim hakkinda bilgi ver"` ile Turkce cevap dogrula
- Frontend chatbot'ta soru sor, cevap geldigini dogrula
- AI Insights sayfasinda "Generate" butonu ile insight uretildigini dogrula
- Ollama kapali iken Gemini fallback'in calistigini dogrula (GEMINI_API_KEY varsa)

---

## ADIM 4: Bildirim Sistemi (Telegram + Email + In-App)
**Durum:** TODO
**Atanan:** -
**Bagimlilik:** ADIM 2 (tracker duzeltmesi, dogru alert verisi icin)

### Amac
Profesyonel bildirim sistemi kurmak: Anlik kritik bildirimler Telegram Bot ile, gunluk ozet raporlar Email ile, dashboard ici bildirimler In-App ile.

### Yapilacaklar

#### A. Telegram Bot Entegrasyonu

1. **Telegram Bot olusturma:**
   - Telegram'da @BotFather'a `/newbot` komutu gonder
   - Bot adi: `ObservAI Alert Bot` (veya benzeri)
   - Token'i al ve `.env`'ye ekle: `TELEGRAM_BOT_TOKEN=xxx`

2. **Backend Telegram servisi** (yeni dosya: `backend/src/services/telegramService.ts`):
   ```typescript
   // Telegram Bot API wrapper
   // - sendMessage(chatId, text, options)
   // - Severity'ye gore emoji: CRITICAL=🔴, HIGH=🟠, MEDIUM=🟡, LOW=🔵
   // - Formatted message: title, message, timestamp, camera name
   // - Rate limiting: max 30 mesaj/saniye (Telegram limiti)
   ```

3. **Kullanici Telegram baglantisi:**
   - Settings sayfasinda "Telegram Bildirim" bolumu ekle
   - Kullanici bot'a `/start` gonderdikten sonra chat_id'sini ayarlardan girer
   - Veya: backend bir deep link olusturur (`t.me/ObservAIBot?start=USER_ID`), kullanici tiklar, bot otomatik baglar
   - `User` tablosuna `telegramChatId` alani ekle (Prisma schema)

4. **Bildirim tetikleme kurallari:**
   - **CRITICAL**: Aninda Telegram + In-App + Ses (crowd_surge 2x+, occupancy 100%+)
   - **HIGH**: Aninda Telegram + In-App (crowd_surge 1.5x+, occupancy 80%+, wait_time 10min+)
   - **MEDIUM**: Sadece In-App (wait_time 5min+, trend, peak approaching)
   - **LOW**: Sadece In-App (demographic_trend, recommendation)

5. **Bildirim gonderme mantigi** (`backend/src/services/notificationDispatcher.ts`):
   ```
   generateInsight() → saveToDatabase() → dispatch():
     if severity >= HIGH:
       telegramService.send(user.telegramChatId, formattedMessage)
     if emailEnabled && (dailySummaryTime || severity == CRITICAL):
       emailService.send(user.email, formattedMessage)
     socketIO.emit('new_notification', insight)  // her zaman in-app
   ```

#### B. Email Bildirimi (SMTP)

1. **Backend Email servisi** (yeni dosya: `backend/src/services/emailService.ts`):
   - Nodemailer kullan (zaten npm'de mevcut olabilir, yoksa ekle)
   - Gmail SMTP ile ucretsiz gonderim (gunluk 500 mail limiti yeterli)
   - HTML template ile profesyonel gorunumlu email

2. **Email turleri:**
   - **Kritik Alert**: Aninda gonderilir (CRITICAL severity)
   - **Gunluk Ozet**: Her gun saat 09:00'da onceki gunun ozeti
     - Toplam ziyaretci, ortalama doluluk, peak saat
     - Demografik dagılım ozeti
     - AI onerileri (Ollama'dan)
     - Gelen alert sayisi (severity bazli)

3. **Konfigürasyon** (`.env`):
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=observai.alerts@gmail.com
   SMTP_PASS=app-specific-password
   EMAIL_FROM=ObservAI <observai.alerts@gmail.com>
   ```

4. **Kullanici ayarlari** (Settings sayfasi):
   - Email bildirim acik/kapali
   - Gunluk ozet saati secimi
   - Hangi severity'lerde email gelmeli

#### C. In-App Bildirim Iyilestirme

1. **Mevcut NotificationsPage.tsx'i iyilestir:**
   - Real-time Socket.IO ile yeni bildirim gelince sayfa otomatik guncellenir (mevcut)
   - Notification badge TopNavbar'da gorunur (unread count)
   - Desktop notification (browser) izni isteme

2. **Notification sound:**
   - Mevcut Web Audio API implementasyonunu koru
   - Quiet hours ozelligi (mevcut) calisir durumda olmali

### Dosyalar (yeni ve degisecek)
- `backend/src/services/telegramService.ts` — YENI
- `backend/src/services/emailService.ts` — YENI
- `backend/src/services/notificationDispatcher.ts` — YENI
- `backend/src/services/insightEngine.ts` — DEGISECEK (dispatch entegrasyonu)
- `backend/prisma/schema.prisma` — DEGISECEK (telegramChatId, email prefs)
- `frontend/src/pages/dashboard/SettingsPage.tsx` — DEGISECEK (Telegram + Email ayarlari)
- `backend/.env` — DEGISECEK (TELEGRAM_BOT_TOKEN, SMTP_*)

### Demo Senaryosu (sunumda gosterilecek)
1. Kamera acik, 3-4 kisi girer → occupancy alert tetiklenir
2. Telegram'dan aninda mesaj gelir (telefon ekraninda gosterilir)
3. Dashboard'da bildirim badge'i artar
4. NotificationsPage'de detay gorunur

### Test
- Telegram bot'a `/start` gonder, chat_id kaydedildigini dogrula
- Bir CRITICAL alert tetikle (kamera onune 5+ kisi gir), Telegram mesaji geldigini dogrula
- Email gunluk ozet'in gonderildigini dogrula (test icin saati simdi olarak ayarla)
- In-App bildirim badge'inin dogru sayiyi gosterdigini dogrula

---

## ADIM 5: Lokalizasyon (TR/EN)
**Durum:** TODO
**Atanan:** -
**Bagimlilik:** Yok

### Amac
Tum UI metinlerini Turkce ve Ingilizce arasinda gecis yapabilecek sekilde i18next entegrasyonu kurmak.

### Yapilacaklar

1. **i18next kurulumu:**
   ```bash
   cd frontend
   pnpm add i18next react-i18next i18next-browser-languagedetector
   ```

2. **Dil dosyalari olustur:**
   - `frontend/src/locales/en.json` — Ingilizce ceviri
   - `frontend/src/locales/tr.json` — Turkce ceviri
   - Tum sayfalardaki tum metinler bu dosyalarda olmali

3. **i18n konfigurasyonu** (`frontend/src/i18n.ts`):
   ```typescript
   import i18n from 'i18next';
   import { initReactI18next } from 'react-i18next';
   import LanguageDetector from 'i18next-browser-languagedetector';
   import en from './locales/en.json';
   import tr from './locales/tr.json';

   i18n.use(LanguageDetector).use(initReactI18next).init({
     resources: { en: { translation: en }, tr: { translation: tr } },
     fallbackLng: 'en',
     interpolation: { escapeValue: false }
   });
   ```

4. **Dil degistirme butonu:**
   - TopNavbar'da (sube secicinin yaninda) kucuk bir TR/EN toggle butonu
   - Tiklaninca dil aninda degisir
   - Secim localStorage'da saklanir (`observai_language`)
   - Settings sayfasindaki mevcut language dropdown'u da bu sisteme baglanir

5. **Tum sayfalari ceviriye gecir:**
   - Her sayfada hardcoded string'leri `t('key')` ile degistir
   - Sayfalar: Login, Register, Dashboard, Camera Selection, AI Insights, Notifications, Settings, Zone Labeling, Historical, Help Center
   - Tarih/saat formatlari da dile gore degismeli (TR: GG.AA.YYYY, EN: MM/DD/YYYY)

6. **AI Chatbot dil destegi:**
   - Kullanicinin secili diline gore chatbot prompt'unu ayarla
   - Mevcut "respond in same language" mantigi korunur, ek olarak UI dili de gonderilir

### Cevirilecek Sayfalar ve Tahmini Anahtar Sayisi
| Sayfa | Tahmini Anahtar |
|-------|----------------|
| Login/Register | ~30 |
| Dashboard | ~50 |
| Camera Selection | ~40 |
| AI Insights | ~35 |
| Notifications | ~25 |
| Settings | ~45 |
| Zone Labeling | ~20 |
| Historical | ~25 |
| TopNavbar/Sidebar | ~20 |
| Genel (butonlar, mesajlar) | ~30 |
| **TOPLAM** | **~320 anahtar** |

### Dosyalar
- `frontend/src/i18n.ts` — YENI
- `frontend/src/locales/en.json` — YENI
- `frontend/src/locales/tr.json` — YENI
- `frontend/src/main.tsx` — DEGISECEK (i18n import)
- `frontend/src/components/TopNavbar.tsx` — DEGISECEK (dil butonu)
- Tum sayfa dosyalari — DEGISECEK (t() fonksiyonu)

### Test
- TR secildiginde tum sayfalardaki metinlerin Turkce oldugunu dogrula
- EN secildiginde Ingilizce'ye dondugunnu dogrula
- Sayfa yenilendiginde dil seciminin korundugunnu dogrula
- Tarih/saat formatlarinin dile gore degistigini dogrula

---

## ADIM 6: Sube/Branch Yonetimi ve Hava Durumu
**Durum:** TODO
**Atanan:** -
**Bagimlilik:** Yok

### Amac
Sube yonetimini kullanilir ve efektif hale getirmek. Hava durumu entegrasyonunu net ve gorsel olarak sunmak.

### Yapilacaklar

1. **Settings → Sube Yonetimi iyilestirme:**
   - Sube ekleme/duzenleme/silme formu daha kullanici dostu olmali
   - Harita uzerinde konum secme (Leaflet.js ile basit harita) — opsiyonel, koordinat girisi de yeterli
   - Sube listesinde: ad, sehir, kamera sayisi, varsayilan badge

2. **TopNavbar sube secici iyilestirme:**
   - Secili subenin hava durumu ikonu ve sicaklik gosterimi
   - Ornek: `☀️ 22°C | Ankara Sube` seklinde kompakt gorunum

3. **Hava durumu entegrasyonu netlestirme:**
   - `backend/src/routes/branches.ts` icerisindeki weather endpoint'i kontrol et
   - Open-Meteo API'den su verileri cek:
     - Anlik sicaklik, hava durumu kodu (WMO), ruzgar hizi
     - Gunluk tahmin (sonraki 3 gun)
   - Dashboard'da hava durumu widget'i ekle (kucuk kart)
   - AI chatbot'a hava durumu verisi zaten gidiyor → korunsun

4. **Dashboard'da sube bazli filtreleme:**
   - Secili subeye ait kameralarin verileri gosterilmeli
   - Mevcut `DashboardFilterContext` kullanilarak filtreleme

5. **Sube bazli analytics:**
   - Her subenin kendi ziyaretci sayisi, demografi, heatmap verisi
   - Subeler arasi karsilastirma (opsiyonel, ADIM 9'da genisletilir)

### Dosyalar
- `backend/src/routes/branches.ts` — DEGISECEK (weather endpoint iyilestirme)
- `frontend/src/contexts/DashboardFilterContext.tsx` — DEGISECEK
- `frontend/src/components/TopNavbar.tsx` — DEGISECEK (hava durumu gosterimi)
- `frontend/src/pages/dashboard/SettingsPage.tsx` — DEGISECEK (sube yonetimi UI)

### Test
- Yeni sube ekle (Istanbul, Ankara vb.), koordinatlarla
- TopNavbar'da sube secince hava durumunun dogru gosterildigini dogrula
- Dashboard verilerinin secili subeye gore filtrelendigini dogrula

---

## ADIM 7: Zone Sistemi Iyilestirme
**Durum:** ASK USER
**Atanan:** -
**Bagimlilik:** ADIM 2 (tracker duzeltmesi)

### Amac
Zone cizim sistemini gelistirmek (cokgen destek), masa doluluk goruntuleme, minimap/layout olusturma. Bu adim baslamadan once kullaniciya sorular sorulacak.

### Kullaniciya Sorulacak Sorular
1. "Zone seklini dikdortgen disinda cokgen (polygon) olarak da cizebilmek istiyor musun? Ornegin L-seklinde bir alan veya ucgen masa grubu?"
2. "Minimap/layout gorunumu nasil olmali? (a) Kullanicinin cizecegi sembolik bir layout, (b) Kamera goruntusu uzerinde zone overlay, (c) Otomatik olusturulan sematik gorunum?"
3. "Masa layout'unda neler gosterilsin? (a) Sadece dolu/bos durumu, (b) Kisi sayisi + cinsiyet, (c) Kisi sayisi + cinsiyet + oturma suresi, (d) Hepsi + heatmap"
4. "Kac masa/zone tipik bir kafede olur? Yaklasik sayi nedir? (UI tasarimi icin)"

### Potansiyel Yapilacaklar (kullanici cevabina gore)

#### A. Cokgen Zone Destegi
- `ZoneCanvas.tsx`: Dikdortgen cizime ek olarak polygon cizim modu
  - Kullanici nokta nokta tiklar, son noktayi ilk noktaya baglar
  - Polygon overlay render
- `analytics.py`: Zaten Shapely polygon destegi var, sadece frontend'den 4+ nokta gelmesi yeterli
- Backend zone validation guncelleme

#### B. Masa Doluluk Gorunumu
- Dashboard'da yeni bir kart/bolum: "Masa Durumu"
- Her TABLE tipindeki zone icin: masa adi, kisi sayisi, ortalama oturma suresi
- Renk kodlamasi: Bos (yesil), Dolu (kirmizi), Yarim dolu (sari)
- Gercek zamanli guncelleme (WebSocket)

#### C. Minimap / Layout Gorunumu
- Dashboard'da interaktif layout goruntuleme
- Zone'larin konumlarini sematik olarak gosterir
- Heatmap overlay secenegi
- Tiklanabilir zone'lar (detay popup)

### Dosyalar (muhtemel)
- `frontend/src/components/camera/ZoneCanvas.tsx` — DEGISECEK
- `frontend/src/pages/dashboard/ZoneLabelingPage.tsx` — DEGISECEK
- `frontend/src/components/dashboard/TableLayout.tsx` — YENI
- `frontend/src/components/dashboard/FloorplanMinimap.tsx` — YENI
- `backend/src/routes/zones.ts` — DEGISECEK (polygon validation)
- `packages/camera-analytics/camera_analytics/analytics.py` — DEGISECEK (zone data enrichment)

### Test
- Cokgen zone cizilip kaydedilebilmeli
- Masa doluluk gosterimi gercek zamanli guncellenmenli
- Minimap'te zone'lar tiklanabilir olmali

---

## ADIM 8: Dwell Time ve Metrikler
**Durum:** ASK USER
**Atanan:** -
**Bagimlilik:** ADIM 2 (tracker), ADIM 7 (zone sistemi)

### Amac
Dwell time metriklerini zenginlestirmek ve dashboard'da gorsel olarak sunmak. Bu adim baslamadan once kullaniciya sorular sorulacak.

### Kullaniciya Sorulacak Sorular
1. "Hangi dwell time metrikleri dashboard'da gosterilsin? (a) Masada gecirilen ortalama sure, (b) Queue'da bekleme suresi, (c) Toplam kafede kalma suresi, (d) Hepsi"
2. "Cinsiyete/yasa gore dwell time karsilastirmasi istiyor musun? Ornegin 'Erkekler ortalama 45dk, kadinlar 62dk kaliyor' gibi?"
3. "Dwell time alert'leri nasil olmali? (a) Masa X'te 2 saatten fazla oturan var, (b) Queue'da 10dk'dan fazla bekleyen var, (c) Ikisi de, (d) Baska bir esik"
4. "Bu veriler hangi grafik tipinde gosterilsin? (a) Bar chart, (b) Line chart (zaman icinde trend), (c) Heatmap (saat bazli), (d) Hepsi"

### Potansiyel Yapilacaklar

#### A. Dwell Time Zenginlestirme (Python)
- `analytics.py` mevcut dwell time'i hesapliyor
- Ek metrikler:
  - Zone bazli ortalama dwell time
  - Cinsiyet bazli dwell time
  - Yas grubu bazli dwell time
  - Peak dwell time saatleri

#### B. Dashboard Goruntuleme
- "Zaman Metrikleri" karti:
  - Ortalama masa suresi (TABLE zone'lar)
  - Ortalama kuyruk bekleme (QUEUE zone'lar)
  - Toplam ortalama kalma suresi
- Grafik: Saat bazli dwell time distribution

#### C. Dwell Time Alert'leri
- Uzun oturma alert'i (configurable esik, default: 120dk)
- Uzun kuyruk bekleme alert'i (configurable esik, default: 10dk)
- Bu alert'ler ADIM 4'teki bildirim sistemine entegre edilir

### Dosyalar (muhtemel)
- `packages/camera-analytics/camera_analytics/analytics.py` — DEGISECEK
- `packages/camera-analytics/camera_analytics/metrics.py` — DEGISECEK
- `backend/src/services/insightEngine.ts` — DEGISECEK (dwell alerts)
- `frontend/src/pages/dashboard/DashboardPage.tsx` — DEGISECEK (yeni kartlar)

### Test
- Kamera onunde 5dk bekle, dwell time'in dogru hesaplandigini dogrula
- Dashboard'da dwell time grafiginin gosterildigini dogrula
- Uzun bekleme alert'inin tetiklendigini dogrula

---

## ADIM 9: Dashboard Gorsellesitirme Iyilestirme
**Durum:** ASK USER
**Atanan:** -
**Bagimlilik:** ADIM 7 (zone), ADIM 8 (dwell time), ADIM 6 (branch)

### Amac
Dashboard'u modern, sik ve bilgi dolu hale getirmek. Bu adim baslamadan once kullaniciya sorulacak.

### Kullaniciya Sorulacak Sorular
1. "Dashboard'un genel gorunumu icin bir renk temasi/stil tercihin var mi? (a) Koyu tema (dark mode), (b) Acik tema, (c) Her ikisi de secenekli"
2. "Hangi ek grafikler istiyorsun? (a) Gercek zamanli ziyaretci sayisi line chart, (b) Saat bazli heatmap, (c) Cinsiyet/yas pasta grafigi, (d) Zone bazli bar chart, (e) Hepsi"
3. "Ana dashboard'da kac kart/widget gosterilsin? Cok fazla olursa karisik, az olursa eksik hissettirir."
4. "Mevcut grafiklerin hangisini begeniyorsun, hangisini degistirmek istiyorsun?"

### Potansiyel Yapilacaklar

#### A. Dashboard Layout Yenileme
- Card-based responsive grid layout
- Drag & drop ile kart siralamasini degistirme (react-grid-layout)
- Her kart: baslik + chart + alt bilgi
- Anlik veri guncelleme animasyonlari

#### B. Yeni Grafikler
- Gercek zamanli ziyaretci akisi (line chart, son 1 saat)
- Saat bazli yogunluk heatmap (7 gun x 24 saat)
- Zone doluluk bar chart
- Cinsiyet/yas karsilastirma pie/donut chart
- Dwell time trend chart

#### C. Gorsellesitirme Modu Degistirme
- SRS gereksinimi: "interactively switch between visualization modes"
- Her grafik kartinda dropdown/toggle ile chart tipini degistir (bar ↔ line ↔ pie)
- Bu, SRS'teki UC-03 gereksinimini karsilar

### Dosyalar (muhtemel)
- `frontend/src/pages/dashboard/DashboardPage.tsx` — DEGISECEK
- `frontend/src/components/dashboard/` — YENI bilesenler
- `frontend/tailwind.config.js` — DEGISECEK (tema ayarlari)

### Test
- Dashboard'un responsive oldugunu dogrula (farkli ekran boyutlari)
- Grafiklerin gercek zamanli guncellendigini dogrula
- Chart tipi degistirmenin calistigini dogrula

---

## ADIM 10: Export Ozelligi Iyilestirme
**Durum:** TODO
**Atanan:** -
**Bagimlilik:** ADIM 3 (LLM), ADIM 6 (branch), ADIM 8 (dwell time)

### Amac
CSV ve PDF export'unu tam dogru ve mantikli calisir hale getirmek. Raporlarda AI onerileri de olmali.

### Yapilacaklar

1. **Export endpoint inceleme ve duzeltme** (`backend/src/routes/export.ts`):
   - Tarih araligi filtresi dogru calismali
   - Sube (branch) filtresi eklenmeli
   - Birden fazla sube secilip birlesitirilmis rapor olusturulabilmeli

2. **CSV Export iyilestirme:**
   - Kolonlar: Tarih, Saat, Sube, Kamera, Ziyaretci_Giris, Ziyaretci_Cikis, Mevcut_Doluluk, Ort_Bekleme, Erkek%, Kadin%, Yas_Dagilimi
   - Turkce/Ingilizce kolon basliklari (ADIM 5 dil secimi ile uyumlu)

3. **PDF Export iyilestirme:**
   - Profesyonel rapor sablonu:
     - Kapak: ObservAI logosu, rapor basligi, tarih araligi, sube adi
     - Ozet: Toplam ziyaretci, ort doluluk, peak saat, demografik profil
     - Grafikler: Gunluk ziyaretci trendi, cinsiyet/yas dagilimi
     - AI Onerileri: Ollama'dan uretilmis 5 oneri (ADIM 3 ile entegre)
     - Detay tablosu: Saatlik kirilim
   - PDFKit ile olusturma (mevcut kutuphane)

4. **Frontend export UI:**
   - Historical Analytics sayfasinda:
     - Tarih araligi secici
     - Sube secici (coklu secim)
     - Format secimi (CSV / PDF)
     - "Raporu Olustur" butonu
     - Yukleme animasyonu
     - Indirme linki

### Dosyalar
- `backend/src/routes/export.ts` — DEGISECEK
- `frontend/src/pages/dashboard/HistoricalPage.tsx` — DEGISECEK
- `backend/src/services/reportGenerator.ts` — YENI (opsiyonel, PDF sablon mantigi)

### Test
- 1 haftalik tarih araligi icin CSV indir, verinin dogru oldugunu dogrula
- PDF raporu indir, gorunumunun profesyonel oldugunu dogrula
- AI onerilerinin raporda yer aldigini dogrula
- Birden fazla sube secip birlesitirilmis rapor olustur

---

## Adim Sirasi ve Bagimlilik Haritasi

```
ADIM 1: GitHub Kurulumu ──────────────────────────┐
                                                    │
ADIM 2: Tracker/Privacy Blur ─────┐                │
                                   │                │
ADIM 3: LLM (Ollama) ────────────┤                │
                                   │                │
ADIM 5: Lokalizasyon ─────────────┤  (paralel)     │
                                   │                │
ADIM 6: Sube Yonetimi ───────────┤                │
                                   │                │
ADIM 4: Bildirim Sistemi ←── ADIM 2               │
                                   │                │
ADIM 7: Zone Sistemi ←── ADIM 2  │                │
                                   │                │
ADIM 8: Dwell Time ←── ADIM 2, 7 │                │
                                   │                │
ADIM 9: Dashboard ←── ADIM 7, 8, 6               │
                                   │                │
ADIM 10: Export ←── ADIM 3, 6, 8 ┘                │
                                                    │
Tum adimlar ←── ADIM 1 (GitHub once yapilmali) ───┘
```

### Paralel Calisma Onerileri (5 kisi icin)
- **Kisi 1 (Emre):** ADIM 1 (GitHub) → ADIM 2 (Tracker) → ADIM 7 (Zone)
- **Kisi 2:** ADIM 3 (LLM) → ADIM 10 (Export)
- **Kisi 3:** ADIM 5 (Lokalizasyon) → ADIM 9 (Dashboard)
- **Kisi 4:** ADIM 4 (Bildirim) → ADIM 8 (Dwell Time)
- **Kisi 5:** ADIM 6 (Sube) → Diger adimlara yardim

> NOT: Bu dagitim onerdir. Gercek dagitim kullanicinin kararina baglidir.
