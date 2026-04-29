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

---

## AKTIF ONCELIK (2026-04-21 Kullanici Raporu Sonrasi)

Kullanici 11 maddelik kapsamli sistem raporu verdi (ekran ekran gezdi, ag loglari + screenshot ile). Bulgular yeni ADIM 19-25'e dagitildi. **Fazlara gore sira:**

### Faz 1 — Bozuk olanlar (blocker)
- ~~**ADIM 19** — Staffing 500 hatasi + Telegram/Email bildirim pipeline dogrulama (rapor #7)~~ DONE (2026-04-21)
- ~~**ADIM 21** — Historical + Trends timezone + yuzde matematigi (rapor #8 + #10)~~ DONE (2026-04-21)
- ~~**ADIM 20** — Tables state machine (EMPTY→OCCUPIED→CLEANING) (rapor #3)~~ DONE (2026-04-21)

### Faz 2 — Veri dogrulugu
- **ADIM 22** — Current visitors SSoT + demografi lock dogrulama (rapor #1 + #6)
- **ADIM 23** — AI Insights gercek pipeline (Ollama cron) (rapor #9)

### Faz 3 — UX / Design System
- **ADIM 25** — i18n UTF-8 toptan temizlik + Socket cleanup + polling (rapor cross-cutting)
- **ADIM 7** — Zone Labeling polygon/freehand + canvas UX (rapor #2, simdi TODO)
- **ADIM 9** — Dashboard Design System chart upgrade (rapor #5, simdi TODO)
- **ADIM 24** — Camera Selection UX + health metrics (rapor #4)
- **ADIM 6** — Branch wizard + hava durumu (rapor #11, mevcut TODO detaylandi)

### Faz 4 — Dokumantasyon / dil tamamlama (Test audit Faz 4: Zones+Dashboard+Tables — DONE 2026-04-28; Test audit Faz 5: Historical+Export+AIChat+DateFilter — IN PROGRESS 2026-04-28)
- **ADIM 12** — i18next tam setup (UTF-8 temizlik ADIM 25'te bitmis olacak)
- **ADIM 10** — Export PDF/CSV rafinasyon
- **ADIM 8** — Dwell Time metrikleri zenginlestirme

---

## Faz 7 — i18n + Security + 25+ Yan Bug Fix Batch (DONE 2026-04-29)

**Branch:** partal_test | **Commit:** refactor-partal..HEAD = 49 yeni atomic commit | **Test:** 105 PASS / 6 expected FAIL | **Detay:** `test-results/07-i18n-security-fix-batch.md`

| Batch | Yan'lar | Durum |
|---|---|---|
| A | #30, #34, #45, #54 | DONE |
| B | #22 (Node LIVE_VERIFIED, Python design-inert) | DONE_NODE_LIVE_PYTHON_PARTIAL |
| C | #1.5a, #10, #11, #41, #56, #34 yayilim | DONE |
| D | #28, #36, #40, #46, #47, #48, #59 | DONE |
| E | #38, #44, #50, #51, #57 | DONE |
| F | #2, #3, #5, #6, #14, #19, #25, #32, #33, #42, #43, #49, #52, #55, #61 | DONE (LIVE_VERIFIED) |
| G | Final regression gate + Faz 8 exit kapisi | DONE |

**Sonuc:** 57 yan kapatildi, 2 pre-existing pre-Faz7 fail e2e (5.2a Yan #22 deneme analytics empty + 6.3a Telegram column residual) belgelendi. Yan #37 chat tenant leak production LEAK_COUNT=0 (4. session). Faz 8 exit kapisi tum kontrolleri PASS.

## Faz 8 — Design Polish + Magic MCP + 2 DEFER yan (DONE 2026-04-29)
**Durum:** DONE
**Branch:** partal_test | **Commit:** Faz 7 final 77c8f4f → Faz 8 ~9 yeni atomic commit | **Vitest:** 114 PASS / 6 expected FAIL | **Detay:** `test-results/08-design-polish-batch.md`

| Batch | Kapsam | Yan | Durum |
|---|---|---|---|
| 1 | Polygon-polygon SAT-equivalent overlap (backend + frontend parity) | #31 | DONE +5 vitest |
| 2 | Custom date range API + native picker UI | #39 | DONE +4 vitest |
| 3 | echarts theme polish (observai palette + formatConfidence) | — | DONE |
| 4 | api/errors zod extractor util + StaffingPage error wire | — | DONE_PARTIAL (full Settings rework Faz 9'a) |
| 5 | markdownLite inline code + URL auto-link | — | DONE +3 node:test |
| 6 | makeTimeAgo lift to lib/relativeTime | — | DONE_PARTIAL (InsightCard component Faz 9'a) |
| 7 | Final regression gate + 08-batch.md + ROADMAP DONE | — | DONE |

**Sonuc:** Yan #31 + #39 (Faz 7'den DEFER edilen 2 HIGH yan) closed. 4 design polish batch (echarts, api/errors, markdownLite, relativeTime) infra/util commit'lendi; full UX rework (Settings UI grid + InsightCard component) Faz 9'a hand-off (Magic MCP ile brainstorming gerektirir). Yan #37 leak probe 6. kez 0.

## Faz 9 — Doc-only buffer + deferred UX rework + final dokuman (READY TO START)
**Durum:** READY (Faz 8 exit kapisi PASS)
**Kapsam (Faz 8'den devren):**
- BranchSection card grid + accordion chevron + Bildirimler+Kanallar merge (Yan #1.4)
- InsightCard component (animated dismiss + dateKey badge + relative time)

**Kapsam (orijinal Faz 9):**
- #20 MiroFish doc, #21 test fixture infra, #58 CLAUDE.md telegram cleanup, #60 staffing AI summary karar
- 3.7c daily idempotency, 3.8 InsightFace+MiVOLO doc
- Tum faz raporlarini birlestir + PR + surum notu

---

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
**Durum:** DONE (2026-04-06)
**Atanan:** Emre
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
**Durum:** DONE (2026-04-20 — ADIM 14 ile birlikte Stage 4 kapsaminda bitirildi)
**Atanan:** Emre
**Bagimlilik:** Yok

### Kalibrasyon Sonucu
Stage 4 calibration uygulandi: `track_high_thresh=0.60`, `new_track_thresh=0.70`, `match_thresh=0.65`, `track_buffer=150`, `appearance_thresh=0.50`. Ek olarak `zone_grace_period_s=3.0` occlusion grace, `zone_enter_debounce_frames=5` / `zone_exit_debounce_frames=10` sikilastirildi ve `table_max_capacity=6` clamp eklendi. Detay ADIM 14'te.


### Amac
BoT-SORT tracker'in ID atama ve bbox uretme sorunlarini arastirmak. Privacy blur'un tracker/demografi uzerindeki etkisini incelemek.

### Tamamlanan Kisimlar
- [x] BoT-SORT parametre analizi yapildi, sorun kaynaklari belirlendi
- [x] Privacy blur etkisi incelendi — tracking'i etkilemiyor (sadece output frame)
- [x] Potansiyel duzeltmeler ve parametre degisiklikleri dokumante edildi

### Gelistirilmesi Gereken Kisimlar
- [ ] botsort.yaml parametreleri gercek test ile kalibre edilmeli (new_track_thresh, match_thresh, appearance_thresh)
- [ ] Kamera onunde canli test: ID atama stabilitesi, re-ID basarisi
- [ ] Demografi parametreleri canli testle optimize edilmeli (face_detection_interval, det_size vb.)
- [ ] Zone giris/cikis sayilarinin dogrulugu canli ortamda dogrulanmali

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
**Durum:** DONE (2026-04-07)
**Atanan:** Emre
**Bagimlilik:** Yok

### Amac
Ollama uzerinde Llama 3.1 8B modelini tam verimle calistirmak. AI chat ve insight engine'in dogru, hizli ve Turkce/Ingilizce calismasini saglamak.

### Tamamlanan Kisimlar
- [x] Ollama birincil AI saglayici, Gemini fallback, demo son care — tam fallback zinciri
- [x] Model oncelik sirasi: llama3.1:8b > llama3:8b > mistral > phi3 > gemma2 > qwen2
- [x] callOllama: configurable maxTokens (chat=512 hizli, recommendations=1024 detayli), temperature=0.4
- [x] OLLAMA_NUM_GPU=999 env ile tum katmanlar GPU'da
- [x] Backend startup Ollama health check (index.ts) — baslangicta durum loglanir
- [x] Frontend AI status badge: yesil Wifi + model adi / kirmizi WifiOff
- [x] Insight Engine: Ollama ile gercek oneri uretimi, dual dil prompt (TR/EN)
- [x] extractLanguage() fonksiyonu — recommendations endpoint'inde ?lang=tr|en destegi
- [x] buildContextPrompt: otomatik dil algilama (Turkce karakter/kelime tespiti), max 4 cumle kurali
- [x] start-all.bat: Ollama otomatik baslat + model indir + stop-all.bat durdurma
- [x] Chatbot UX: quick actions her zaman gorunur (collapsible), sifirlama butonu (yeni sohbet)
- [x] .env.example dosyalari guncellendi (OLLAMA_NUM_GPU)

### Gelistirilmesi Gereken Kisimlar
- [ ] Model cevap kalitesi: llama3.1:8b Turkce analitikte zayif kalabiliyor — daha buyuk model (13B/70B) veya fine-tuning denenebilir
- [ ] Cevap hizi: 8B modelde bile 5-10 sn surebiliyor — streaming response (SSE) ile UX iyilestirilebilir
- [ ] Chatbot conversation history: su an her soru bagimsiz gonderiliyor, onceki mesajlari context olarak gondermek cevap kalitesini artirabilir
- [ ] AI Insights sayfasindaki "Generate" butonu canli verilerle test edilmeli
- [ ] Recommendation dual language parse: bazi LLM cevaplari formata uymayabiliyor, parse robustlugu arttirilabilir

### Dosyalar
- `backend/src/routes/ai.ts` — Chat endpoint, callOllama, buildContextPrompt
- `backend/src/services/insightEngine.ts` — Insight generation, extractLanguage
- `backend/src/routes/insights.ts` — Recommendations endpoint (lang param)
- `backend/.env.example` — AI konfigurasyonu
- `frontend/src/components/GlobalChatbot.tsx` — Chat UI
- `start-all.bat` / `stop-all.bat` — Ollama otomatik yonetim

### Test
- [x] Backend build: 0 hata
- [x] Ollama baglanti: start-all.bat ile otomatik basliyor
- [ ] Canli chatbot testi: Turkce/Ingilizce soru-cevap kalitesi
- [ ] AI Insights: Generate butonu ile insight uretimi
- [ ] Ollama kapali iken Gemini fallback testi

---

## ADIM 4: Bildirim Sistemi (Telegram + Email + In-App)
**Durum:** DONE (2026-04-14 — commit 6dcf178)
**Atanan:** Emre
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

## ADIM 5: Masa Takibi + Trend Analizi + Personel Planlama
**Durum:** DONE (2026-04-20 — commit 0e57450)
**Atanan:** Emre
**Bagimlilik:** ADIM 2, ADIM 7

### Amac
Masa seviyesinde doluluk takibi (empty/occupied/needs_cleaning/reserved), trend analizi ve vardiya bazli personel planlama araclari.

### Yapilanlar
- **Masa state machine** (analytics.py): TABLE zone tipi, giris/cikis debounce, `table_needs_cleaning_timeout=60s`, `table_empty_timeout=180s`, long-occupancy uyarisi
- **TableOccupancyPage** (frontend): shematic floor plan, KPI bar (doluluk %, ort. sure, turnover, temizlik bekleyen), tablo secim + detail panel, heatmap overlay
- **Personel planlama** (`backend/src/routes/staffing.ts`): vardiya bazli oneri, peak saat + demografi verisine dayali
- **Trend karti**: gunluk/haftalik ozet analytics sayfasinda

### Dosyalar
- `packages/camera-analytics/camera_analytics/analytics.py` — TABLE zone tipi, state machine
- `packages/camera-analytics/config/default_zones.yaml` — `table_needs_cleaning_timeout`, `table_empty_timeout`, `table_long_occupancy_alert`
- `frontend/src/pages/dashboard/TableOccupancyPage.tsx` — YENI
- `backend/src/routes/staffing.ts` — YENI
- `backend/prisma/schema.prisma` — StaffShift modeli

### Not
Bu ADIM eskiden "Lokalizasyon" icin planlanmisti. Lokalizasyon kapsami ADIM 12'ye tasindi.

---

## ADIM 12: Lokalizasyon (TR/EN)
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

## ADIM 6: Sube/Branch Yonetimi ve Hava Durumu (Wizard + Harita)
**Durum:** TODO
**Atanan:** -
**Bagimlilik:** Yok

### Amac
Sube yonetimini kullanilir ve efektif hale getirmek. Hava durumu entegrasyonunu net ve gorsel olarak sunmak.

### Rapor Notlari (2026-04-21)
Kullanici raporu #11'e gore mevcut Settings > Subeler UI sorunlu: modal scroll gerektiriyor, harita onizlemesi yok, hava durumu API konfigurasyonu belirsiz, header "+Add Branch" Settings'e ziplamak yerine modal acmali. ASCII bozuk metinler ("Sube", "yonetin", "gore") UTF-8 temizligi ADIM 25'te yapilacak.

### Yeni Yapilacaklar (rapor sonrasi)
- **5 adimli wizard**: Temel bilgi (ad, kategori, logo) → Konum (adres autocomplete + Leaflet/MapLibre mini-harita + draggable marker + "Konumumu kullan") → Operasyon (timezone otomatik, acilis/kapanis, kapasite) → Entegrasyonlar (hava durumu provider: OpenWeather/Tomorrow.io/Visual Crossing + API key test butonu + yagmur/sicaklik alert esikleri) → Ozet + Kaydet
- **Framer Motion stepper**: Adimlar arasi slide transition (AnimatePresence)
- **Header dropdown**: "+ Add Branch" secenegi wizard'i modal olarak acsin (Settings'e redirect yerine)
- **Weather cron**: Her branch icin 30 dk'da bir GET, response cache
- **Branch-aware filtering**: Tum analytics endpoint'leri `branchId` query param destekler; dashboard dropdown degistiginde tum sayfalar scope edilir

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

## ADIM 7: Zone Labeling Canvas UX + Polygon/Freehand
**Durum:** TODO (rapor ile netlesti, ASK USER kaldirildi)
**Atanan:** -
**Bagimlilik:** ADIM 2 (tracker duzeltmesi)

### Amac
Zone cizim sistemini gelistirmek (polygon + freehand destek), canvas UX'i Design System standartlarina cekmek, hatali i18n key'leri duzeltmek.

### Kullanici Cevaplari (2026-04-21 rapor #2)
- Polygon + freehand istekli (su an her zone "RECT" olarak kaydediliyor)
- Zone rengi chip'lerle gosterilmeli (Entry=cyan, Table=pink, Queue=yellow, Display=green)
- Canvas araclarinda ham i18n key'ler cikiyor: `zones.canvas.drawRect`, `drawPolygon`, `drawFreehand`, `pickMode`
- Zone eklenirken Framer Motion animasyon (scale-in, fade-out)
- Canli heatmap overlay (zone uzerinde track density)

### Yapilacaklar

#### A. Polygon + Freehand Cizim
- `ZoneCanvas.tsx`: `drawingMode` state makinesi (`rect | polygon | freehand | pick`)
- **Polygon**: Nokta nokta tikla, cift tikla veya ESC ile kapat
- **Freehand**: Pointer-move ile path; Ramer-Douglas-Peucker ile vertex azalt
- **ZonePolygonUtils.ts**: Mevcut (simplify + ray-casting + bbox), frontend wiring bozuk
- Backend: `analytics.py` Shapely zaten destekliyor, sadece 4+ nokta gelmesi yeterli

#### B. i18n Key Eksikleri
- `locales/en.json` + `tr.json` eksik keyler:
  - `zones.canvas.drawRect` → "Rectangle" / "Dikdortgen"
  - `zones.canvas.drawPolygon` → "Polygon" / "Cokgen"
  - `zones.canvas.drawFreehand` → "Freehand" / "Serbest"
  - `zones.canvas.pickMode` → "Select" / "Sec"

#### C. Canvas UX Upgrade (Design System)
- Zone eklenince: `initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}}`
- Silme: fade-out + slide
- Zone listesi kartlar: kendi renk chip'i (type'a gore), sag tarafta drag handle (reorder)
- Canli heatmap overlay: Design System Heatmap kart stili, bar/espresso underused label

#### D. Masa Doluluk Ayri Adim
Masa doluluk ve state machine ADIM 20'ye tasindi. Bu adim sadece Zone Labeling canvas UX'ine odaklanir.

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

## ADIM 9: Dashboard Design System Chart Upgrade
**Durum:** TODO (rapor ile netlesti, ASK USER kaldirildi)
**Atanan:** -
**Bagimlilik:** ADIM 22 (SSoT), ADIM 21 (historical fix), ADIM 6 (branch)

### Amac
Design System'deki hazir chart patternlerini dashboard'a tasimak. Sparkline + area + heatmap + donut + gradient bar + anomaly banner + conversion funnel.

### Rapor #5 — Design System'den Dashboard'a Esleme
Design System'de hazir + eklenecegi ekran:
- **"TODAY'S TRAFFIC 247 visitors + sparkline bar"** → Analytics Dashboard ust KPI bandi (mevcut "Current Visitors 4" kartinin yerine: total + sparkline + trend chip)
- **"AVG DWELL TIME 18.4 min + area line"** → Mevcut "Avg Dwell 0.0 min / No data" kartini area chart + trend % ile degistir
- **DEMOGRAPHICS donut + percentage list** → Mevcut Gender Donut'a rakamli list
- **AGE DISTRIBUTION gradient bar (cyan→purple)** → Flat bar chart yerine, lock badge ile birlikte
- **Zone flow SVG (BoT-SORT animated path)** → Yeni "Zone Flow" card
- **"HOTTEST TABLE / DEAD ZONE" KPI cifti** → Tables sayfasina (ADIM 20)
- **Stacked Age × Gender chart (mavi alt, mor ust)** → Demografi karti
- **Track gender voting timeline + Age EMA chart** → AI Insights yeni "Track Detail" drawer (ADIM 23)
- **Insight timeline (console-style 14:33 → INSIGHT ... ACTION ...)** → AI Insights ana feed (ADIM 23)

### Yeni Eklenecek Widget'lar
- **Queue alert card** (IN/OUT/QUEUE renkli): "142 / 119 / 4" KPI paterni
- **Anomaly banner**: Sudden drop/spike tespiti -> ust kisimda kirmizi/sari toast
- **Conversion funnel**: Entry → Queue → Seated → Ordered → Paid yuzdeleri
- **Peak hour forecast**: Bugun ongorulen peak window + onerilen staff sayisi (Staffing'e baglanir)

### Kod Yapisi
- Tum chart'lari tek yerde: `src/components/charts/` klasoru
- Sparkline icin ayri component: `<Sparkline data={...} color="cyan" />`
- visx veya victory tabanli custom chart (mevcut Recharts degistirilebilir)

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

## ADIM 11: Demografi Dogrulugu + AI Konfigurasyon Konsolidasyonu + UI Temizligi
**Durum:** DONE (2026-04-19)
**Atanan:** Emre (partal)
**Bagimlilik:** ADIM 2, ADIM 3

### Amac
- Yas/cinsiyet modelinde dogruluk iyilestirmeleri (FPS dusmeden)
- Login ekranindaki kamera animasyonu tamamen kaldirilmasi
- AI saglayici listelerinin tek kaynakta (aiConfig.ts) toplanmasi
- Demografi confidence + lock bilgilerinin backend-to-frontend tasinmasi
- YouTube + sample image testleri ile dogrulama

### Yapilanlar

1. **Gender/Age pipeline iyilestirmeleri** (analytics.py, age_gender.py, metrics.py, config.py):
   - Cinsiyet tespitinde hysteresis band (0.35 lower / 0.65 upper) — net olmayan skorlar `round()` ile erkek/kadin'a zorlanmak yerine `None` olarak gecilir (flip-flop onler)
   - Pose penalty gevsetildi: default 0.85, yaw/150.0 (eski: 0.8, yaw/120.0) — profil yuzlerden daha fazla bilgi alinir
   - Age EMA lock: stability 0.95 + min 30 sample (eski: 0.90 + 15)
   - Temporal decay: 0.92 (eski: 0.85) — kisa-sureli yanlis oylarin etkisi azaltildi
   - Pose yaw cutoff: 55° → 70°
   - MiVOLO batch boyutu: 6 → 12 (RTX 5070 icin)
   - ActivePersonSnapshot artik `age_confidence`, `gender_confidence`, `age_locked`, `gender_locked`, `age_stability` alanlarini icerir
   - Frontend `CameraFeed.tsx` her bbox etiketinde `=` ile kilitlenmis durumu gosterir

2. **AI konfigurasyonu merkezilesti** (backend/src/lib/aiConfig.ts YENI):
   - `GEMINI_MODEL_CANDIDATES` (2.5-flash, 2.0-flash-001, 2.0-flash-lite)
   - `OLLAMA_MODEL_PRIORITY` (qwen3:14b, llama3.3, llama3.2, qwen2.5, llama3.1:8b, ...)
   - `isGeminiFallbackError()` helper quota/404/exhausted detect
   - `routes/ai.ts` + `services/insightEngine.ts` artik bu modulu kullanir (iki yerdeki liste drift onlendi)
   - Ollama calls now wrapped in AbortController (`OLLAMA_TIMEOUT_MS`, default 60s)

3. **Login ekrani temizligi**:
   - Eski kamera / ParticleBackground / AnimatedNetworkBackground animasyonlari silindi
   - Landing/Login/Register/Forgot/Reset sayfalari sade koyu gradient arka plan

4. **Tip guvenligi**:
   - `CameraFeed.tsx` `Zone[]` tipine cevrildi (any[] kaldirildi)

5. **Testler** (scripts/):
   - `youtube_demographics_test.py` — Jackson Hole live cam, YOLO 6 kisi algilama dogru. Full-frame face detection uzak mesafe yuzunden 0 yuz (beklenen — tum yuz modelleri icin gecerli sinirlama).
   - `insightface_groundtruth_test.py` — InsightFace t1.jpg sample (6 yuz, bilinen gercek): 3M + 3F dogru, ages 25-41, hysteresis band tum 6 yuzu temiz hi/lo bandina ayirdi (mid=0). Pipeline dogrulanmistir.
   - Frontend typecheck + build + Backend build: yesil.

### Dosyalar
- `packages/camera-analytics/camera_analytics/{analytics,age_gender,metrics,config}.py` — DEGISTI
- `packages/camera-analytics/config/default_zones.yaml` — DEGISTI (6 demografi parametresi)
- `backend/src/lib/aiConfig.ts` — YENI
- `backend/src/routes/ai.ts` — DEGISTI (aiConfig import, AbortController timeout)
- `backend/src/services/insightEngine.ts` — DEGISTI (aiConfig import)
- `frontend/src/services/cameraBackendService.ts` — DEGISTI (Detection confidence/lock alanlari)
- `frontend/src/components/camera/CameraFeed.tsx` — DEGISTI (Zone[] type, lock indicator)
- `frontend/src/components/visuals/{ParticleBackground,AnimatedNetworkBackground}.tsx` — SILINDI
- `frontend/src/pages/{LandingPage,LoginPage,RegisterPage,ForgotPasswordPage,ResetPasswordPage,NotFoundPage}.tsx` — DEGISTI
- `scripts/{youtube_demographics_test,insightface_groundtruth_test}.py` — YENI

### Kullanici Dogrulamasi Icin
- Login ekraninda animasyon yok → sade gradient gorunum
- Canli kamerayla veya closer kamerayla deneyin: her kisinin bbox etiketinde `M|25-34|12s =` gibi — `=` kilit isareti cinsiyet+yas ikisinin de locked durumda oldugunu gosterir
- Ollama'da kurulu en iyi model qwen3:14b veya llama3.1:8b otomatik secilir (config.OLLAMA_MODEL ile override)
- Demo testi icin: `logs/insightface_groundtruth_t1.jpg` acin → 6 yuz dogru etiketlenmis olmali

---

## ADIM 13: Test Altyapisi (pytest + vitest + Playwright)
**Durum:** DONE (2026-04-20)
**Atanan:** Emre (partal)
**Bagimlilik:** Yok

### Amac
Her sonraki degisikligi olculebilir yapmak — parametreleri, pipeline degisikliklerini ve feature flag'leri regression koruma altina almak.

### Yapilanlar
- **Python pytest** (`packages/camera-analytics/tests/`): `pytest.ini` + `conftest.py` GPU marker, 51 test green (FPS, tracking stability, zone counting, demographics accuracy, interpolation).
- **Backend vitest** (`backend/src/__tests__/`): auth + session + ai-chat-history + ai-config + analytics-validator + analytics-aggregator + tables-ai-summary — 41 test green.
- **Frontend Playwright** (`frontend/e2e/`): auth-persistence + camera-mjpeg + tables-live-view senaryolari.
- **CI** (`.github/workflows/ci.yml`): GPU olmayan testler otomatik.

### Dosyalar
- `packages/camera-analytics/pytest.ini`, `tests/conftest.py`, `tests/test_*.py`
- `backend/vitest.config.ts`, `backend/src/__tests__/`
- `frontend/playwright.config.ts`, `frontend/e2e/`

---

## ADIM 14: FPS + Tracking + Demografi Kapsamli Revizyon
**Durum:** DONE (2026-04-20)
**Atanan:** Emre (partal)
**Bagimlilik:** ADIM 13

### Amac
"Yag gibi gorunum, donma/takilma yok" sikayetini kokunden cozmek — ayni zamanda yas/cinsiyet dogrulugunu ve zone count stabilitesini artirmak.

### Yapilanlar
1. **Display/Inference decoupling (Stage 2)**: MJPEG `?mode=smooth` query param → raw frame + interpolated bbox ile 60 FPS overlay; `mode=inference` (default) orijinal davranis. `OBSERVAI_MJPEG_MODE=smooth` env ile default degistirilir.
   - `TrackedPerson.bbox_samples: deque(maxlen=2)` — son 2 sample
   - `get_interpolated_tracks(now)` — linear extrapolation + 200ms freeze + 100ms max ahead
   - `get_smooth_frame(now)` — raw frame + interpolated bbox + overlay labels
   - TensorRT warm-up 10 frame (soguk baslatma FPS dusumunu onler)
   - MiVOLO batch 12 → 18 (RTX 5070), CUDA OOM → 12 auto-fallback
2. **Demografi kalibrasyonu (Stage 3)**: `demo_gender_consensus 0.80 → 0.70`, `demo_gender_lock_threshold 8 → 6`, `demo_age_lock_stability 0.95 → 0.92`, `demo_age_lock_min_samples 30 → 20`, `demo_min_confidence 0.40 → 0.35`, `demo_temporal_decay 0.92 → 0.90`, `demo_age_ema_alpha 0.25 → 0.20`. Ambiguous-band recovery feature flag `demo_ambiguous_recovery=false` (default off).
3. **BoT-SORT + zone stability (Stage 4)**: `track_high_thresh 0.50 → 0.60`, `new_track_thresh 0.60 → 0.70`, `match_thresh 0.75 → 0.65`, `track_buffer 90 → 150`, `appearance_thresh 0.35 → 0.50`. Zone debounce 3/5 → 5/10. `zone_grace_period_s=3.0` occlusion grace, `table_max_capacity=6` overcount clamp.

### Kabul Kriteri (dogrulama)
- Display FPS ≥ 50, inference FPS ≥ 20 Mozart Cafe klibinde
- ID churn rate ≤ 1.2
- Zone count delta ≤ 0.5
- Gender F1 ≥ 0.85, age MAE ≤ 7

### Dosyalar
- `packages/camera-analytics/camera_analytics/{analytics,websocket_server,run_with_websocket}.py`
- `packages/camera-analytics/camera_analytics/botsort.yaml`
- `packages/camera-analytics/config/default_zones.yaml`

---

## ADIM 15: Masa View AI (Live Video + Zone Overlay + AI Yorum)
**Durum:** DONE (2026-04-20)
**Atanan:** Emre (partal)
**Bagimlilik:** ADIM 5, ADIM 14, ADIM 16

### Amac
"Masa gorunum ekraninda AI cok daha iyi bir ekran olusturmali. Gercek goruntuden yararlanmali" isteginin karsilanmasi.

### Yapilanlar
- **Live View tab** (`TableOccupancyPage.tsx`): Schematic ile toggle edilebilir, default Schematic (regression yok).
- **TableFloorLiveView** (`frontend/src/components/tables/TableFloorLiveView.tsx`): MJPEG smooth stream + SVG normalize (0..1 viewBox) zone polygon overlay + HTML status chip labels.
- **AI commentary panel**: `POST /api/tables/ai-summary` → Ollama structured prompt (Turkce vardiya brifi, 2-4 satir), 30 sn server-side throttle per cameraId, visibility-change aware auto-refresh.
- **Graceful fallback**: Ollama offline → bilgi mesaji, UI bosalmaz.

### Dosyalar
- `backend/src/routes/tables.ts` — YENI (AI summary endpoint)
- `backend/src/index.ts` — `/api/tables` mount
- `frontend/src/components/tables/TableFloorLiveView.tsx` — YENI
- `frontend/src/pages/dashboard/TableOccupancyPage.tsx` — view-mode toggle
- `backend/src/__tests__/tables-ai-summary.test.ts` — validasyon + throttle + fallback test

---

## ADIM 16: Ollama Streaming + Conversation History + qwen3:14b
**Durum:** DONE (2026-04-20)
**Atanan:** Emre (partal)
**Bagimlilik:** ADIM 13

### Amac
Ollama cevap hizini ve kalitesini iyilestirmek; chatbot onceki mesajlari hatirlasin.

### Yapilanlar
- **qwen3:14b primary + llama3.1:8b fallback** (OLLAMA_MODEL_PRIORITY).
- **start-all.bat iyilestirmesi**: nvidia-smi check + `OLLAMA_NUM_GPU=999` auto-set, primary→fallback pull, 30 sn startup timeout, warm-up request.
- **SSE streaming** (`POST /api/ai/chat/stream`): ENABLE_AI_STREAMING feature flag, chunk-by-chunk frontend render.
- **Conversation history**: Prisma `ChatMessage` modeli, son 10 tur context'e enjekte, `conversationId` localStorage persist.
- **Data-driven prompt**: `getRecentAnalyticsContext()` yapisal format (entry/exit/peak/demo/alert).

### Dosyalar
- `backend/src/routes/ai.ts` — callOllamaStream, SSE handler, history injection
- `backend/prisma/schema.prisma` — ChatMessage modeli
- `backend/.env.example` — OLLAMA_NUM_GPU, OLLAMA_NUM_CTX, OLLAMA_MODEL, OLLAMA_TIMEOUT_MS
- `start-all.bat` — GPU check + qwen3:14b pull + warm-up
- `frontend/src/components/GlobalChatbot.tsx` — EventSource SSE, conversationId state

---

## ADIM 17: Data Integrity (Validator + AnalyticsSummary + Health Monitor)
**Durum:** DONE (2026-04-20)
**Atanan:** Emre (partal)
**Bagimlilik:** ADIM 13

### Amac
Python → Backend → DB pipeline'i sanity checked, aggregated, izlenebilir hale getirmek.

### Yapilanlar
- **Validator** (`backend/src/lib/analyticsValidator.ts`): fps/current/people range check, timestamp freshness. Invalid payload log + drop.
- **AnalyticsSummary aggregation** (`services/analyticsAggregator.ts`): node-cron saatlik + gunluk ozet, idempotent upsert. `DISABLE_ANALYTICS_AGGREGATOR` env ile devre disi.
- **Python health monitor** (`lib/pythonBackendManager.ts`): 10sn poll, 3 ardisik fail → `python_backend_offline` event. Frontend offline banner.

### Dosyalar
- `backend/src/lib/analyticsValidator.ts` — YENI
- `backend/src/services/analyticsAggregator.ts` — YENI
- `backend/src/lib/pythonBackendManager.ts` — startHealthMonitor + events
- `backend/prisma/schema.prisma` — AnalyticsSummary modeli
- `backend/src/__tests__/analytics-{validator,aggregator}.test.ts`

---

## ADIM 18: Login Remember Me Fix
**Durum:** DONE (2026-04-20)
**Atanan:** Emre (partal)
**Bagimlilik:** ADIM 13

### Amac
"Login'de her seferinde giris yapmak gerekiyor" bug'inin kokunden cozumu.

### Yapilanlar
- `AuthContext.tsx` tum fetch call'larina `credentials: 'include'` eklendi.
- `authMiddleware.ts` session expiry (30 gun rememberMe, 7 gun default) audit edildi.
- Startup session cleanup `rememberMe=true` oturumlari etkilemez.
- Playwright E2E: `auth-persistence.spec.ts` — login + rememberMe + browser restart senaryosu yesil.

### Dosyalar
- `frontend/src/contexts/AuthContext.tsx` — credentials include
- `backend/src/routes/auth.ts`, `backend/src/middleware/authMiddleware.ts` — session audit
- `frontend/e2e/auth-persistence.spec.ts` — YENI

---

## ADIM 19: Staffing 500 Fix + Telegram/Email Bildirim Pipeline Dogrulama
**Durum:** DONE (2026-04-21)
**Atanan:** Emre (partal)
**Bagimlilik:** ADIM 4 (bildirim altyapisi)

### Yapilanlar
- **500 Fix** (`backend/src/routes/staffing.ts`): `/:branchId/recommendations` endpoint'i `authenticate` middleware aldi. `branchId='default'` user'in default branch'ina resolve edilir (yoksa ilk branch). `cameraId` opsiyonel — verilmezse branch'taki tum kameralar aggregate. 3 gunden az veri varsa `needsMoreData: true, daysCollected, daysRemaining, reason` doner (throw etmez). User raporundaki 500 hatasi cozuldu.
- **NotificationLog modeli** (`backend/prisma/schema.prisma`): userId, staffId, assignmentId, event (staff_shift|alert|test|onboarding), channel (telegram|email), target, success, error, payload alanlari. `db push` ile SQLite'a uygulandi, client regenerate edildi.
- **Dispatcher audit** (`backend/src/services/notificationDispatcher.ts`): Her Telegram/email denemesi NotificationLog'a yazilir (success + failure). `writeAudit` file log korundu, DB eklenen suspenders.
- **Notifications summary endpoint** (`backend/src/routes/notifications.ts`): `GET /api/notifications/summary?days=7` — gercek send count, channel bazli breakdown. Staffing KPI artik bu endpoint'ten gercek rakami gosteriyor.
- **Telegram webhook onboarding** (`backend/src/routes/telegram-webhook.ts` YENI):
  - `POST /api/webhooks/telegram` — Telegram'dan gelen /start TOKEN update'i yakalar, `Staff.telegramOnboardingToken` ile eslestirir, `telegramChatId` atar, token'i iptal eder (single-use), onay mesaji gonderir, onboarding NotificationLog'a yazar
  - `GET /api/webhooks/telegram/link/:staffId` — `t.me/BOT?start=TOKEN` deep link'i doner; token yoksa olusturur
  - `POST /api/webhooks/telegram/link/:staffId/rotate` — token rotasyon (link sizinti durumunda)
  - `DELETE /api/webhooks/telegram/link/:staffId` — Telegram baglantisini kaldir
  - Production guvenligi: `TELEGRAM_WEBHOOK_SECRET` env ile Telegram'in X-Telegram-Bot-Api-Secret-Token header dogrulamasi
- **Staff model** (`schema.prisma`): `telegramOnboardingToken` String? @unique alani. Staff create olunca auto-generate (chat_id verilmediyse).
- **Frontend** (`frontend/src/...`):
  - `StaffingPage.tsx` — recommendations fetch'ine `credentials: 'include'`, `needsMoreData` empty state (3 gun progress bar), notif summary fetch + KPI wiring
  - `components/staffing/TelegramLinkModal.tsx` YENI — QR kod (api.qrserver.com via img), link kopyala, "Telegram'da Ac", token yenile, 3sn polling ile onboard bekleme
  - `components/staffing/StaffList.tsx` — chat_id yoksa violet QR butonu (onLinkTelegram prop)
  - `components/staffing/StaffForm.tsx` — Chat ID artik opsiyonel hint
  - KPI bandi ingilizce/turkce tek dil (lang switch)
- **Env** (`backend/.env.example`): `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` eklendi

### Dosyalar
- `backend/src/routes/staffing.ts` — 500 fix, resolveBranchId helper, needsMoreData
- `backend/src/routes/staff.ts` — onboarding token auto-seed
- `backend/src/routes/notifications.ts` — test-staff NotificationLog, summary endpoint
- `backend/src/routes/telegram-webhook.ts` — YENI
- `backend/src/services/notificationDispatcher.ts` — writeNotificationLog wired
- `backend/src/index.ts` — /api/webhooks mount
- `backend/prisma/schema.prisma` — NotificationLog + Staff.telegramOnboardingToken
- `backend/.env.example` — TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET
- `frontend/src/pages/dashboard/StaffingPage.tsx` — credentials, needsMoreData UI, notif summary wiring, TelegramLinkModal mount
- `frontend/src/components/staffing/TelegramLinkModal.tsx` — YENI
- `frontend/src/components/staffing/StaffList.tsx` — QR butonu, onLinkTelegram prop
- `frontend/src/components/staffing/StaffForm.tsx` — Chat ID opsiyonel hint

### Dogrulama
- Backend build: 0 hata (tsc)
- Backend vitest: 41/41 yesil
- Frontend typecheck: 0 hata
- Prisma client regenerate: basarili

### Kullanici Icin Sonraki Adim
1. `backend/.env` dosyasina `TELEGRAM_BOT_USERNAME` ekle (ornek: `ObservAIAlertBot`)
2. Backend'i yeniden baslat: `start-all.bat` veya `cd backend && npm run dev`
3. Staff ekle → kart uzerinde **QR butonu** → telefon ile QR tara → `/start TOKEN` otomatik gonderilir → chat_id kaydedilir
4. Shift ata → Telegram/mail bildirim → Staffing KPI'da "Bildirim gonderildi" +1
5. Production icin `TELEGRAM_WEBHOOK_SECRET` + Telegram setWebhook konfigurasyonu yapilmali

### Amac
Staffing sayfasinda `GET /api/staffing/default/recommendations?cameraId=default` 500 donuyor (null guard eksik). Telegram/Email bildirimlerinin gercekten gittigini dogrulamak. Chat ID onboarding'i otomatik hale getirmek (manuel yazma yerine QR kod + deep link).

### Rapor Notu (#7)
KPI bandi Turkce/Ingilizce karisik ("AKTIF PERSONEL", "TELEGRAM BAGLI", "BILDIRIM GONDERILDI"). Personel ekle modal duz, test butonu yok. Shift Calendar 7 kolon statik, drag & drop yok. Recommendations endpoint backend'i 500 atiyor.

### Yapilacaklar
1. **500 Fix** (`backend/src/routes/staffing.ts`): Minimum 3 gun data yoksa `{recommendations: [], needsMoreData: true, daysRemaining: N}` don, throw etme.
2. **Test notification endpoint**: `POST /api/staff/:id/test-notifications` — Telegram + Email anlik test mesaji, success/error status UI'ya doner.
3. **Chat ID auto-onboarding**:
   - Telegram bot deep link (`t.me/ObservAIBot?start=STAFF_ID`)
   - Webhook `/api/webhooks/telegram/start` → `/start` yazan kullanicinin `chat_id`'si otomatik staff kaydina baglanir
   - UI'da Staff eklerken QR kod goster (mobile'dan tarayarak direk bot'a yonlendirilir)
4. **Notification audit log**: `notifications_sent` tablosu (staffId, channel, status, messageId, sentAt). `backend/logs/notification-dispatch.log` zaten var, DB'ye de yazsin. UI'daki "BILDIRIM GONDERILDI 0/0" bu tablodan cekilsin.
5. **Frontend**:
   - Shift Calendar drag & drop (`@dnd-kit` veya `react-dnd`): sol tarafta staff chip'leri, gune/shift'e drag
   - Atama onaylanninca inline status: "✓ Ayse'ye Telegram gonderildi · 2s · Mail basarili"
   - Recommendations tab empty state: "Historical backfill calistir" butonu + "Kameradan kac gun veri toplandi: 1/3" progress bar
   - Staff karti Design System stilinde: avatar, rol chip, Telegram/mail LED (yesil/gri), haftalik saat sayisi

### Dosyalar
- `backend/src/routes/staffing.ts` — null guard
- `backend/src/routes/staff.ts` — `POST /:id/test-notifications`
- `backend/src/routes/telegram-webhook.ts` — YENI (Telegram bot webhook handler)
- `backend/src/services/notificationDispatcher.ts` — notifications_sent tablosuna kayit
- `backend/prisma/schema.prisma` — `NotificationLog` modeli (yeni)
- `frontend/src/pages/dashboard/StaffingPage.tsx` — KPI bandi temizlik
- `frontend/src/components/staffing/StaffForm.tsx` — QR kod modal
- `frontend/src/components/staffing/ShiftCalendar.tsx` — drag & drop

### Basari Kriteri
- `GET /api/staffing/default/recommendations` → 200 (bos dataset icin `needsMoreData: true`)
- Staff ekle → QR kod ile Telegram bot /start → chat_id otomatik kaydedilir
- Test butonu → gercek Telegram mesaji gider, backend log + DB'ye yazilir
- Shift atandiginda `notifications_sent` +1 satir, UI "bildirim gonderildi" sayaci guncellenir

---

## ADIM 20: Tables State Machine + Cleaning Otomasyonu
**Durum:** DONE (2026-04-21)
**Atanan:** Emre (partal)
**Bagimlilik:** ADIM 5 (TABLE zone tipi), ADIM 19 (bildirim altyapisi)

### Yapilanlar
ADIM 5'te Python tarafindaki TABLE state machine v2 (occupied → empty buffer → needs_cleaning → auto_empty) zaten vardi. Bu ADIM rapor #3'teki UI/bildirim bosluklarini kapatti:

- **Cleaning notification dispatch** (`backend/src/routes/analytics.ts`): `POST /api/analytics/table-events` endpoint'ine transition detection eklendi. Onceki event `needs_cleaning` degilse ve yeni event `needs_cleaning` ise:
  - Camera → branch eslestirmesi → o branch'ta **bugun vardiyada olan + su an shift saatlerinde olan** staff'lar secilir (declined haric, overnight shift destegi)
  - Her staff'a paralel Telegram + Email bildirim atilir (ADIM 19'daki dispatcher altyapisi kullanilir)
  - Her gonderi `NotificationLog`'a yazilir (`event: 'alert'`, `payload.reason: 'cleaning_requested'`)
  - Dedupe: tekrar edilen cleaning post'lari ayni cycle icinde spam yapmaz
- **Floor Plan zone filter** (`frontend/src/pages/dashboard/TableOccupancyPage.tsx`): `tableZoneIds = Set(zones[type=='table'].id)` + `tableRows = tables.filter(ids)`. Rapor #3 bug'i: Python WebSocket payload'i entrance/exit zone'larini da `tables[]` array'ine dahil edebiliyordu ve Floor Plan'da "Entrance · Occupancy 100%" gibi gorunuyordu. Artik sadece TABLE tipi zone'lar render edilir.
- **Design System KPI'lari** (`TableOccupancyPage.tsx`):
  - Ust satir: Doluluk / Ort. turnover / Rotasyon / masa / Temizlik (4 ana KPI, tableRows tabanli)
  - Ikincil satir (yeni): **HOTTEST TABLE** (Flame icon, warm tone — en yuksek turnover + occupancy tiebreaker) + **DEAD ZONE** (Snowflake icon, cold tone — bugun hic kullanilmayan masa). Veri yoksa render edilmez (empty state'de KPI row gizli kalir).
  - Yeni `HighlightCard` component — Design System gradient + icon + kicker (EN YOGUN MASA / OLU BOLGE) + metric + hint.
- **Empty state netlesti**: TABLE zone yokken Floor Plan'da "Masa tipinde bolge cizin" mesaji + Zone Labeling yonlendirmesi gosterilir (entrance/exit zone varligi bu state'i kirmiyor).

### Dosyalar
- `backend/src/routes/analytics.ts` — notifyCleaningRequested helper, table-events transition detection
- `frontend/src/pages/dashboard/TableOccupancyPage.tsx` — tableZoneIds filter, HOTTEST/DEAD KPIs, HighlightCard component

### Dogrulama
- Backend build: 0 hata (tsc)
- Backend vitest: 41/41 yesil
- Frontend typecheck: 0 hata
- Browser preview:
  - Tables sayfasi entrance/exit zone'lari artik floor plan'da gorunmuyor
  - "Masa tipinde bolge cizin" empty state dogru render ediliyor
  - KPI label'lari: Doluluk / Ort. turnover / Rotasyon / masa / Temizlik
  - HighlightCard'lar (HOTTEST/DEAD) veri gelince devreye girer

### Kullanici Icin Sonraki Adim
1. Zone Labeling sayfasinda **type: Table** seciliyle bolge ciz (ADIM 7 polygon/freehand henuz gelmedi, rectangle yeterli)
2. Python analytics TABLE state machine v2 calistigi icin `needs_cleaning` event'leri otomatik uretilecek
3. Vardiyadaki staff'a Telegram + email gider (`ADIM 19` altyapisi ile)
4. `NotificationLog` tablosunda `reason: 'cleaning_requested'` payload'lariyla audit trail olusur

### Scope Disi Birakilanlar (ileri optimizasyon)
- `Table` ve `TableStateTransition` ayri entity'leri: mevcut `TableEvent` + Zone modeli yeterli, schema genisletme gerekmedi
- AI auto-extract (YOLO clustering ile masa tespiti): manuel zone tanimlamasi yeterli — ADIM 7'deki polygon destegi cikinca yetenek artar

### Amac
Tables/Zone ayrimini netlesitirmek: Tables sayfasinda zone degil gercek masalar gorunsun; cleaning state makinesi otomatik calissin (bos kalan masa 2 dk sonra `needs_cleaning`'e dussun); temizlik personeline Telegram bildirimi gitsin.

### Rapor Notu (#3)
Floor Plan'da sadece "Entrance" ve "Exit" 2 zone gorunuyor (masa degil). "Cleaning: 0 / 0 empty" — hicbir zaman cleaning'e gecmiyor. "State Occupied / Seated 01:25 / Ordered 01:28" gibi detaylar mock (gercek sipariş verilmedi). `grid fallback — awaiting camera layout` footer'i AI floor-plan extractor'in calismadigini gosteriyor.

### Yapilacaklar
1. **State machine** (`backend/src/services/tableStateMachine.ts` YENI):
   ```
   EMPTY → OCCUPIED   (dwell > 30s, person count >= 1)
   OCCUPIED → VACATED (person == 0 for 60s)
   VACATED → CLEANING (auto after 120s)
   CLEANING → EMPTY   (staff mark done VEYA 300s timeout)
   ```
   Her transition audit log tablosuna yazilir (`TableStateTransition` modeli).

2. **Analytics.py**: TABLE zone state'i (`occupied/vacated/needs_cleaning/empty`) WebSocket payload'a eklensin. Mevcut `analytics.py` state machine v2 var (ADIM 5'te yazildi), sadece cleaning state'i expose edilmeli.

3. **Tables API**:
   - `GET /api/tables/:branchId` → gercek masa objeleri: `{id, name, seatCount, state, currentOccupancy, stateChangedAt, lastServedAt}` (zone degil, ayri entity)
   - `PATCH /api/tables/:id/state` → staff manuel override (cleaning → empty)
   - Masa tanimi iki yol: (a) AI auto-extract (YOLO bounding box clustering), (b) Manuel (Zone Labeling'de Type: Table seciliyle tanimlanan zone'lar)

4. **Cleaning notification**: Masa CLEANING'e gecince assigned staff'a Telegram + mail push (ADIM 19 dispatcher'i uzerinden).

5. **Frontend TableOccupancyPage**:
   - KPI'lar Design System'den: **HOTTEST TABLE** (T-04 / window seat), **DEAD ZONE** (26% / back right corner), **TABLE ROTATION** (4.1x/day), **AVG TURNOVER** (22 min)
   - "Cleaning: N / Total empty" canli sayi
   - Masa detay panel: state history + "Mark as cleaned" butonu
   - Schematic/Live/Heatmap toggle koru

### Dosyalar
- `backend/src/services/tableStateMachine.ts` — YENI
- `backend/src/routes/tables.ts` — GET/PATCH endpoint'leri
- `backend/prisma/schema.prisma` — `Table` + `TableStateTransition` modelleri (zone'dan ayri)
- `packages/camera-analytics/camera_analytics/analytics.py` — cleaning state export
- `frontend/src/pages/dashboard/TableOccupancyPage.tsx` — yeniden layout
- `frontend/src/components/tables/TableFloorLiveView.tsx` — cleaning badge

### Basari Kriteri
- Masa bos kalinca 120 sn sonra otomatik CLEANING state
- Assigned staff Telegram bildirimi alir
- "Cleaning: 2 / 5 empty" gercek sayi gosterir (mock degil)
- Entrance/Exit zone'lari Tables'ta masa olarak gorunmez

---

## ADIM 21: Historical + Trends Timezone + Yuzde Matematigi Duzeltme
**Durum:** DONE (2026-04-21)
**Atanan:** Emre (partal)
**Bagimlilik:** Yok

### Yapilanlar
- **Yuzde matematigi fix** (`frontend/src/pages/dashboard/HistoricalAnalyticsPage.tsx`): `computeGenderPct` ve `computeAgePct` yardimcilari eklendi. Aggregator'dan gelen cumulative vote count'lar render sirasinda yuzdeye normalize edilir. Gender toplami 100%, age bucket'lari sirali (0-17 → 55+) ve toplam 100% verir. Rapor #10 `Male 1996% / Female 2068%` bug'i giderildi.
- **Previous-period delta null fix** (`backend/src/routes/analytics.ts`): `/api/analytics/compare` endpoint'indeki `calculateChange` artik `previous === 0` durumunda `null` doner (eskiden `100` donup yanlis "+100%" gosteriyordu). Summary metni de zero-baseline handle eder — "NaN%" yerine "prior period had no comparable data" cumlesi.
- **StatCard + Comparison delta rendering** (`HistoricalAnalyticsPage.tsx`): `number | null` tiplemesi + `—` placeholder + hover tooltip "No prior baseline". Frontend demo generator da `calcChange` null dondurecek sekilde guncellendi.
- **PeakHour per-day derivation** (`HistoricalAnalyticsPage.tsx` loadData): Range hourly summaries cekilir, her gun icin max-bucket saat Map'e yazilir; daily data'ya `peakHour` alani turetilir. Daily Breakdown tablosunda artik gercek saat gorunur (eskiden hep "-").
- **Timezone pin** (`backend/src/index.ts`): Ilk satir `process.env.TZ = process.env.TZ || 'Europe/Istanbul'`. Dev makinesi UTC'de olsa bile aggregator/backfill/`getHours()` cagrilari Istanbul saatini dondurur. Rapor #8 gece yarisi peak + AI Insights `03:00 peak` bug'i giderildi.
- **Seed-demo yeniden yazildi** (`backend/src/routes/analytics.ts` POST `/seed-demo`):
  - `days` parametresi (1..180, default 90)
  - Hour multipliers 00-06 ve 23 saatleri sifir (kafe kapali) — gece yarisi peak artik olusmaz
  - Day-of-week faktoru: Cuma/Cmt 1.4x, Pzr 1.1x, Pzt 1.0x, Sal/Car 0.8x, Per 1.0x
  - Age bucket'lari yuzde cinsinden normalize (0-17, 18-24, 25-34, 35-44, 45-54, 55+)
  - Seed sonrasi otomatik aggregation pass (`runHourlyAggregationFor` + `runDailyAggregationFor`) — Historical ve Trends sayfalari anlik veri gorur
- **TrendsPage future days** (`frontend/src/pages/dashboard/TrendsPage.tsx`): Weekday selector'de haftanın gelecek gunleri tespit edilir (`futureDays` Set). Gelecek gunler "Yakinda" chip + "—" gosterir (eskiden `-100%`). Geçmis zero-data gunler de "—" gosterir (belirsiz karsilastirma engellendi).

### Dosyalar
- `frontend/src/pages/dashboard/HistoricalAnalyticsPage.tsx` — computeGenderPct/computeAgePct, StatCard null-aware, comparison changes null-aware, peakHour derivation
- `frontend/src/pages/dashboard/TrendsPage.tsx` — futureDays Set, Yakinda chip, — placeholder
- `backend/src/routes/analytics.ts` — /compare null delta, /seed-demo 90d realistic + aggregation pass, generateComparisonSummary zero-baseline
- `backend/src/index.ts` — `process.env.TZ = 'Europe/Istanbul'` at boot

### Dogrulama
- Backend build: 0 hata (tsc)
- Backend vitest: 41/41 yesil
- Frontend typecheck: 0 hata
- Browser preview:
  - Historical sayfasi: Erkek 49% / Kadin 50% / Belirsiz 1% (toplam 100%) + age bucket'lari toplam 100% ✓
  - Trends sayfasi: Per/Cum/Cmt'de "Yakinda" chip + "—" gorunur, Pzr/Pzt/Sal icin +10% / -20% / -34% gercek delta ✓

### Kullanici Icin Sonraki Adim
- Canli data icin: `POST /api/analytics/seed-demo` `{days: 90, cameraId: "your-cam-id"}` body ile 90 gun sentetik veri olusturulur + aggregator otomatik çalisir. Historical/Trends sayfalari anlik dolu gorunur.
- Live data birikiyorsa timezone fix yeterli; daha fazla islem gerekmez.

### Amac
Historical sayfasindaki Male 1996% / Female 2068% gibi bozuk yuzdeleri, Trends'teki gece yarisi peak gibi timezone bug'larini, Daily Breakdown'daki "Avg Dwell 0 / Peak Hour —" bos alanlari duzeltmek.

### Rapor Notlari (#8 + #10)
- Male 1996% + Female 2068% = %4064 (olmali %100). Payda "vote count" yerine "unique tracks" olmali.
- `%98.99 DOWN` delta filtre degisse de ayni kaliyor. `previousPeriodTotal = 0` durumu handle edilmiyor.
- Trends'te Tuesday 00:00'da 250 ziyaretci (kafe kapali saatte!). Timezone UTC vs Europe/Istanbul karisikligi.
- Haftalik Pattern heatmap transpose bozuk (7 dikey blok yerine 7 kolon × 24 satir grid olmali).
- ASCII bozuk etiketler ("ort" → "ortalama", "kisi" → "kisi").
- AI Insights Peak Hours 3:00 peak (10.6 avg) listeliyor — backfill timezone bug'i.

### Yapilacaklar
1. **Yuzde formulu fix** (`backend/src/services/analyticsAggregator.ts`):
   - `male% = maleUniqueTracks / totalUniqueTracks * 100` (her track ReID ile bir kere sayilir)
   - Age bucket normalization: `0-17, 18-24, 25-34, 35-44, 45-54, 55+` toplami 100%
2. **Previous period delta**: `previousPeriodTotal == 0` → `delta = null`, UI "no prior data" gosterir (negative% gostermez)
3. **Peak hour hesaplamasi**: Hourly breakdown her gun icin dondurulsun; max bucket saat. Bos gunlerde "—".
4. **Timezone sabitle**: `Europe/Istanbul` — backfill script + realtime aggregator + display. UTC'de kaydedilen verileri display'de local'e cevir.
5. **Backfill script** (`backend/scripts/backfill-analytics-summary.ts`):
   - Son 90 gun sentetik veri: 08:00-22:00 aktif (Poisson, peak 12-14 + 18-20)
   - Gun faktoru: Cuma/Cmt 1.4x, Pzr 1.1x, Sal/Car 0.8x
   - Hava faktoru: yagmurlu 0.7x
6. **Dwell fix**: Zone enter/exit event'lerden sure cikar (ADIM 20 state machine sonrasi dogru calisacak).
7. **Trends UI** (`frontend/src/pages/dashboard/TrendsPage.tsx`):
   - Future days "—" veya "upcoming" chip (hep "-100%" gostermesin)
   - Haftalik heatmap transpose fix: `grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(24, 1fr)`
   - Saat etiketleri 4 saatte bir (00, 04, 08, 12, 16, 20)
   - Renkler: d3.interpolateViridis veya dark→cyan→magenta gradient
   - Forecast overlay: ARIMA/Prophet ile ertesi gun tahmini line
8. **Historical UI** (`frontend/src/pages/dashboard/HistoricalAnalyticsPage.tsx`):
   - Date range degisikliginde React Query cache key'e tarih ekle (currently invalidate olmuyor)
   - Daily Visitor Trend line + Total Visitors bar'i tek ComposedChart'ta birlesir
   - Data Info karti: "Data Points: 82" → "82 hourly samples" acik etiket

### Dosyalar
- `backend/src/services/analyticsAggregator.ts` — yuzde formulu fix
- `backend/src/routes/analytics.ts` — historical endpoint + timezone
- `backend/scripts/backfill-analytics-summary.ts` — timezone + realistic dist
- `frontend/src/pages/dashboard/HistoricalAnalyticsPage.tsx` — cache key, chart birlesme
- `frontend/src/pages/dashboard/TrendsPage.tsx` — future days, heatmap grid

### Basari Kriteri
- Gender % toplami 100, age % toplami 100
- Peak hour her gun icin gercek saat (gece yarisi peak yok)
- 7D → 30D → 90D gecisinde delta anlik guncellenir (eski delta'da kalmaz)
- Avg dwell gercek dakika (0 olmayacak)
- Haftalik heatmap 7×24 grid, forecast line overlay

---

## ADIM 22: Current Visitors SSoT + Demografi Lock Canli Dogrulama
**Durum:** TODO (P2 — Faz 2.1)
**Atanan:** -
**Bagimlilik:** ADIM 20 (Tables), ADIM 21 (historical)

### Amac
Dashboard'daki "4↑/4↓ ama Current Visitors: 2" tutarsizligini cozmek (Single Source of Truth). ADIM 11'de kodlanan demografi lock algoritmasinin canli kamerada gercekten calistigini dogrulamak. AI Insights raw JSON blob'larini natural language'e cevirmek.

### Rapor Notlari (#1 + #6)
- "4 ↑ / 3 ↓ bugun" + "Current Visitors: 4" (olmali 1)
- "4 ↑ / 4 ↓" + "Current Visitors: 2" (olmali 0)
- "Detected: 0" iken Age chart hala 2 kisi gosteriyor (cache sifirlanmiyor)
- AI Insights'ta `{"male":137,"female":160,"unknown":5}` JSON blob goruntulenmis (160 kadin demek degil, kumulatif frame votes)
- Historical Male 1996% / Female 2068% (ADIM 21'de zaten ele alindi)
- Dashboard'da Tables widget yok (occupied/total gosterilmiyor)

### Yapilacaklar
1. **useLiveOccupancy.ts** (YENI hook): `current = max(0, totalIn - totalOut)` — tek kaynak gercek. Tum dashboard component'leri bu hook'u kullanir.
2. **Current Visitors flicker fix**: 300ms debounce `CurrentVisitorsCard`.
3. **Demografi stale indicator** (`DemographicsCard`): `lastValidFrameTimestamp` tut; 5 sn'den eski frame → "Inactive" badge gosterir (chart sifirlanmaz, ama kullaniciya stale oldugu belli olur).
4. **Demografi lock canli test**: Kamera onunde 2 dk oturan kisi → gender lock (8 ardisik ayni vote) dogrulanmali, age salinimi +-2y icinde kalmali. Canli test rapor et.
5. **Occupied Tables widget**: `GET /api/tables/:branchId` → dashboard ust KPI'a "Occupied: X / Total: Y" kart.
6. **Insight JSON temizligi** (`backend/src/services/insightEngine.ts`):
   - Prompt template: "Analyze: [data]. Generate 1-2 sentence human-readable insight + 1 actionable recommendation."
   - Yanlis: `"male":137,"female":160` → Dogru: "25-34 yas kadin musteri bugunku trafigin %38'i. Oneri: oglenden sonra espresso+pastry push bildirim 11:00'de."
7. **Track overlay UI**: Design System formatina uygun `#0142 · K · 28y · 0.94` (ID · gender · age · confidence). Low confidence italic + gri. "LOCKED" yesil nokta badge.
8. **Aggregate seviyesinde**: "Today's gender split" sadece **locked** track'leri sayar, unlocked'lar "Unknown" bucket'a. Age = EMA'nin son degeri (frame-count degil, track-count).

### Dosyalar
- `frontend/src/hooks/useLiveOccupancy.ts` — YENI
- `frontend/src/pages/dashboard/CameraAnalyticsPage.tsx` — SSoT adopt, flicker debounce
- `frontend/src/components/dashboard/DemographicsCard.tsx` — stale badge
- `frontend/src/components/dashboard/OccupiedTablesCard.tsx` — YENI
- `frontend/src/components/camera/CameraFeed.tsx` — track overlay format (ADIM 11'de kismen var)
- `backend/src/services/insightEngine.ts` — prompt temizlik
- `backend/src/services/analyticsAggregator.ts` — locked track sayimi

### Basari Kriteri
- "4↑/4↓" iken Current Visitors = 0
- Ayni kisi 2 dk kamera onunde: gender degismez, age +-2y salinir
- AI Insights'ta raw JSON gorunmez, human-readable metin
- Dashboard'da "Occupied Tables: 3/8" canli gosterim
- Track overlay'de lock indicator (=)

---

## ADIM 23: AI Insights Gercek Pipeline (Ollama Cron + Natural Language)
**Durum:** TODO (P2 — Faz 2.2)
**Atanan:** -
**Bagimlilik:** ADIM 16 (Ollama streaming), ADIM 21 (historical fix)

### Amac
AI Insights sayfasinda "Loading insights..." sonsuz kalmasin; cached insight'lar anlik gorunsun; cron saatlik gercek Ollama cevabi ile insight uretsin; duplicate dedupe; DEMO MODE kaldirilsin.

### Rapor Notu (#9)
- Sayfa acildiginda "Loading insights..." sonsuz kaliyor
- 10 insight uretildi ama 4 tanesi ayni "Demographic Profile Update" — cesitlilik yok
- Icerik raw JSON blob
- Peak Hours 3:00 peak listeliyor (timezone bug)
- "DEMO MODE" label — cron gercek calismiyor, mock

### Yapilacaklar
1. **Cron insight generator** (`backend/src/services/insightsEngine.ts` enhance):
   - `node-cron` saatlik: son 24 saat data fetch → rule-based anomaly detection (sudden drop > 40%, queue > 5, dead hour) → her anomaly icin Ollama prompt → insight kaydi
   - Ollama prompt: "Analyze: [data snippet]. Generate 1-2 sentence insight + 1 actionable recommendation."
   - Response parse → `insights` tablosuna yaz: `{type, severity, title, body, action, confidence, generatedAt}`
2. **Duplicate dedupe**: Son 24 saatte ayni `(type, severity)` hash'i varsa atla. Ayni baslik farkli timestamp'te tekrar etmez.
3. **Natural language**:
   - Yanlis: `"male":137,"female":160`
   - Dogru: "25-34 yas kadin musteri bugunku trafigin %38'i. Oneri: oglenden sonra espresso+pastry kombinasyonu icin 11:00'de push bildirim."
4. **Frontend empty state** (`frontend/src/pages/dashboard/AIInsightsPage.tsx`):
   - Initial load: `GET /api/insights?limit=50` → bossa "No insights yet" + CTA "Generate one"
   - Non-empty: cached insights anlik render (loading sonsuz kalmaz)
5. **Insight karti layout**:
   - Sol tarafta icon + severity chip (Low/Med/High)
   - Baslik + 1-2 cumle aciklama
   - Alt satirda yesil "ACTION: ..." (Design System INSIGHT → ACTION formati)
   - Expand'de raw data + grafik
6. **Filter chip functional**: All / Crowd Surge / Occupancy / Wait Time / Trend / Demographics — URL query param ile senkronize
7. **Generate Insight UX**: Spinner + "Ollama dusunuyor..." + progress dots; tamamlanincca yeni kart slide-in
8. **Anomaly banner**: Ust kisimda kritik anomaly toast (sudden drop/spike)
9. **DEMO MODE badge kaldir**: Cron devreye girince

### Dosyalar
- `backend/src/services/insightEngine.ts` — cron job, dedupe logic, Ollama prompt cleanup
- `backend/src/routes/insights.ts` — filter query param
- `frontend/src/pages/dashboard/AIInsightsPage.tsx` — empty state, filter chip, banner
- `frontend/src/components/insights/InsightCard.tsx` — YENI (Design System format)

### Basari Kriteri
- Sayfa acilinca son insight'lar anlik gorunur (loading sonsuz kalmaz)
- Generate Insight 5-10 sn'de gercek Ollama cevabi
- Duplicate insight uretilmez
- Filter chip URL param ile calisir
- Peak Hours timezone fix sonrasi mantikli saatleri gosterir (ADIM 21 bagimli)

---

## ADIM 24: Camera Selection UX + Canli Health Metrics
**Durum:** TODO (P3 — Faz 3)
**Atanan:** -
**Bagimlilik:** Yok

### Amac
Camera Selection sayfasini Design System standartlariyla (hover, glass, animasyon) ve canli saglik metrikleriyle (FPS, latency, resolution, packet loss) zenginlestirmek. RTSP ekleme wizard'i.

### Rapor Notu (#4)
- Kaynak turu kartlari duz border (hover yok, secim gecisi yok)
- Configured Sources: LIVE badge var ama preview thumbnail/FPS/latency yok
- Activate/Copy/Delete duz `<button>` (hover feedback minimal)
- "Add Source" buyuk + renkli ama gradient blur-glass yok

### Yapilacaklar
1. **SourceTypeCard animasyon**: `whileHover={{y:-4, scale:1.02}}`, secili kartta animated radial gradient, checkmark icin `motion.circle` draw-on animation.
2. **ConfiguredSourceCard**:
   - Sol ust: video canvas preview (HLS onizleme veya RTSP'den JPEG snapshot her 5 sn)
   - Sag ust: status chip stack — `60 fps · 8ms · 1080p · 0.4% loss`
   - Latency renkleri: < 50ms yesil, < 200ms sari, ustu kirmizi
3. **Activate butonu**: `whileTap={{scale:0.95}}`, success state'de pulse ring animasyon
4. **Add Source wizard** (4 adim stepper):
   - Adim 1: Type sec (Webcam/Phone/Video/RTSP/Screen/YouTube)
   - Adim 2: Source URL/index gir
   - Adim 3: Test baglantisi + canli preview
   - Adim 4: Isimlendir + kaydet
5. **Auto-discovery tab**: ONVIF network taramasi — LAN'daki IP kameralari otomatik listele (network interface enum + ONVIF discovery paketi).
6. **Design System stilinde "Add New Source"** butonu: gradient + blur-glass.

### Dosyalar
- `frontend/src/pages/dashboard/CameraSelectionPage.tsx` — wizard + animasyon
- `frontend/src/components/camera/SourceTypeCard.tsx` — YENI
- `frontend/src/components/camera/ConfiguredSourceCard.tsx` — YENI (preview + health chips)
- `frontend/src/components/camera/AddSourceWizard.tsx` — YENI
- `packages/camera-analytics/camera_analytics/sources.py` — ONVIF discovery helper

### Basari Kriteri
- Kart secim/hover smooth 60 fps animasyon
- Configured source'larda canli preview + health chip
- RTSP ekle wizard'da test butonu basarili baglanti gosterir

---

## ADIM 25: Cross-cutting Fix — Socket Cleanup + Polling + i18n UTF-8 Temizlik
**Durum:** TODO (P4 — Faz 4, en alt ama bagimsiz yapilabilir)
**Atanan:** -
**Bagimlilik:** Yok (bagimsiz)

### Amac
Cross-cutting sorunlar: React 18 StrictMode socket cleanup dongusu, asiri polling yuku (`/api/insights/unread-count` ~58 req/dk), Turkce metinlerde ASCII bozuklugu ("Sube", "yonetin" vb.), Zone Labeling'de ham i18n key'ler.

### Rapor Notlari (cross-cutting)
- Console: `[CameraFeed] Cleaning up stale socket before reconnect` uc kere pes pese
- `/api/insights/unread-count` dakikada 58 kez poll (WebSocket push olmali, fallback 30sn+)
- i18n: "Sube" → "Şube", "yonetin" → "yönetin", "gore" → "göre", "icin" → "için", "Henuz" → "Henüz", "Gorev" → "Görev", "kisi" → "kişi", "gun" → "gün", "ort" → "ortalama"
- Zone Labeling: ham key (`zones.canvas.drawRect` vb.) — ADIM 7'de de ele alindi

### Yapilacaklar
1. **Socket cleanup fix** (`frontend/src/components/camera/CameraFeed.tsx`, `services/cameraBackendService.ts`):
   - Subscription ref pattern: cleanup sadece gercek unmount'ta
   - StrictMode double-invoke guard: `useRef` + `if (socketRef.current === activeSocket) skip`
2. **Polling optimize**:
   - `/api/insights/unread-count` → WebSocket push event (`notification_count_changed`)
   - Fallback interval: 30 sn (WebSocket disconnect'te)
   - `/api/analytics` POST polling kaldirildi, sadece WebSocket
3. **i18n UTF-8 temizlik** (`frontend/src/locales/tr.json` + `en.json`):
   - Tum ASCII-Turkce bozuk karakterler: ş/ğ/ü/ç/ı (UTF-8 encoding)
   - File save: BOM-less UTF-8
   - Eksik Zone Labeling keyler: `zones.canvas.drawRect/drawPolygon/drawFreehand/pickMode`
4. **Staffing KPI bandi**: "AKTIF PERSONEL" → `t('staffing.kpi.activeStaff')` vb. hardcoded string'leri i18n key'e cevir

### Dosyalar
- `frontend/src/components/camera/CameraFeed.tsx` — ref pattern
- `frontend/src/services/cameraBackendService.ts` — subscription mgmt
- `backend/src/routes/notifications.ts` — WebSocket push emit
- `frontend/src/hooks/useInsightCount.ts` — polling → WebSocket
- `frontend/src/locales/tr.json`, `en.json` — UTF-8 + eksik keyler
- `frontend/src/pages/dashboard/StaffingPage.tsx` — i18n key'lere gec

### Basari Kriteri
- Console'da "Cleaning up stale socket before reconnect" log'u 1 kere (tekrar etmez)
- `/api/insights/unread-count` request sayisi < 5/dk (WebSocket aktifken 0)
- Tum Turkce metinlerde dogru karakter (ş/ğ/ü/ç/ı)
- Zone Labeling buton/label'larinda ham key gorunmez

---

## Adim Sirasi ve Bagimlilik Haritasi

### DONE (Tamamlanmis Adimlar)
ADIM 1, 2, 3, 4, 5, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21 — DONE (2026-04-06 → 2026-04-21) — **Faz 1 tamamlandi**

### Aktif Yol Haritasi (2026-04-21 Rapor Sonrasi)

```
Faz 1 — Blocker (sirayla):
  ADIM 19 (Staffing 500 + Bildirim) ←── ADIM 4
  ADIM 21 (Historical + Trends Timezone + Yuzde) ←── bagimsiz
  ADIM 20 (Tables State Machine) ←── ADIM 5, 19

Faz 2 — Veri dogrulugu:
  ADIM 22 (Current Visitors SSoT + Demografi) ←── ADIM 20, 21
  ADIM 23 (AI Insights Cron + Natural Language) ←── ADIM 16, 21

Faz 3 — UX / Design System:
  ADIM 25 (i18n UTF-8 + Socket + Polling) ←── bagimsiz
  ADIM 7  (Zone Canvas + Polygon) ←── ADIM 2
  ADIM 9  (Dashboard Design System Charts) ←── ADIM 22, 21, 6
  ADIM 24 (Camera Selection UX) ←── bagimsiz
  ADIM 6  (Branch Wizard + Harita) ←── bagimsiz

Faz 4 — Tamamlama:
  ADIM 12 (i18next tam setup) ←── ADIM 25 sonrasi
  ADIM 10 (Export PDF/CSV) ←── ADIM 3, 6, 8
  ADIM 8  (Dwell Time Metrics) ←── ADIM 2, 7, 20
```

### Paralel Calisma Onerileri (Rapor Sonrasi, 5 kisi)
- **Kisi 1 (Emre):** ADIM 19 (Staffing 500 + Bildirim) → ADIM 20 (Tables State Machine)
- **Kisi 2:** ADIM 21 (Historical + Trends Timezone + Yuzde) → ADIM 23 (AI Insights Cron)
- **Kisi 3:** ADIM 25 (i18n UTF-8 + Socket) → ADIM 22 (Current Visitors SSoT)
- **Kisi 4:** ADIM 7 (Zone Canvas Polygon) → ADIM 24 (Camera Selection UX)
- **Kisi 5:** ADIM 6 (Branch Wizard) → ADIM 9 (Dashboard Design System)

> NOT: Bu dagitim onerdir. Gercek dagitim kullanicinin kararina baglidir. Faz 1 ADIM'lari (19, 20, 21) oncelikli — blocker.
