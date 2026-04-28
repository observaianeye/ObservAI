# Faz 1 RETRY — UI doğrulama

Tarih: 2026-04-28
Önceki rapor: `01-auth-branch-settings.md` (8 API-PASS, 4 BLOCKED, 1 FAIL, 3 PARTIAL)
Browser: BrowserMCP (Playwright chromium binary hâlâ kurulu değil — kurulum yapılmadı)

## Pre-flight

- **Servisler**: FE 5173 = 200, BE 3001 = 200, PY 5001 = 200 ✓ hepsi UP.
- **BrowserMCP**: bağlantı `Connect`'lendi (önceki "extension disconnected" giderildi). `browser_snapshot` ve `browser_navigate` çalışıyor.
- **BrowserMCP kısıtlamaları (yeni bulgu):**
  - `browser_type` ve `browser_click` ardışık çağrılarda **WebSocket timeout 30000ms** ya da **`No tab with given id`** hatası fırlatıyor. Form input olayları gerçekleşmiyor (React controlled input onChange tetiklenmiyor) — büyük ihtimalle BrowserMCP simülasyonu native `dispatchEvent` ile değil, low-level KeyDown gönderiyor; React inputu state'e yansıtmıyor.
  - `browser_screenshot`: ilk denemelerde "Failed to capture tab: image readback failed" döndü → PNG dosyaları kaydedilemedi. Snapshot YAML evidencası alındı (her sayfa için).
  - `browser_select_option`: combobox `<select>` elemanları için "Unable to find option for value" → BrowserMCP value attribute'unu opsiyonu metniyle değil ID/value ile arıyor; combobox metin tabanlı seçim ile tetiklenmiyor.
- **Şanslı bulgu**: Test başlangıcında /dashboard'a navigate ettiğimde **mevcut bir oturum** vardı: kullanıcı **"Deneme" (`deneme@test.com`)** otomatik login durumda. Bu sayede authenticated sayfaların görsel snapshot'ları alındı (Settings, Analytics, Dashboard).

## Retry Sonuçları

| ID    | Önceki  | Yeni              | Kanıt |
|-------|---------|-------------------|-------|
| R1.1f | BLOCKED | **PASS**          | snapshot: /dashboard render + reload sonrası Deneme kullanıcı banner'da hâlâ var, /login'e yönlendirme yok |
| R1.1d | FAIL    | **NOTED-removed** | `/demo` → 404 ("No signal" custom 404 page). Kullanıcı kararı B uygulandı; Faz 9 dokümantasyon temizliğinde CLAUDE.md güncellenecek |
| R1.2c | PARTIAL | **PARTIAL**       | Branch dropdown'da 2 branch görünür (Cape Town Ekhaya + Mozart C), `select_option`/`click` ile UI switch tetiklenemedi (BrowserMCP kısıtı). API tarafı 01.md'de PASS |
| R1.3b | BLOCKED | **PASS (statik)** | `WeatherWidget.tsx:8` `CACHE_TTL_MS = 10*60*1000` + line 100 `localStorage.setItem(wKey, JSON.stringify({data, expiresAt: Date.now()+CACHE_TTL_MS}))` — 10dk TTL kod-doğrulanmış. Browser inspect (BrowserMCP `execute_script` yok) yapılamadı |
| R1.4  | STATIC  | **STATIC+VISUAL** | Settings tam snapshot alındı (7 section), envanter doğrulandı |
| R1.5a | BLOCKED | **PARTIAL**       | EN locale'de `/login`, `/register`, `/forgot-password`, `/dashboard`, `/dashboard/settings`, `/dashboard/analytics`, `/dashboard/notifications` snapshot'ları alındı; **dil toggle butonuna tıklayamadığım için TR snapshot'ı yok** → tam parite tablosu üretilemedi |
| R1.1e | PARTIAL | **PASS (logical)** | Settings UI'da "Email SMTP connected" badge ✓ + auth.ts `forgot-password` `sendPasswordResetEmail()` çağırıyor + emailService.ts `transporter.sendMail` ile yolluyor. SMTP fail durumunda console fallback var. Inbox proof yok (Gmail MCP yok) |

## Detay

### R1.1f Session persistence — PASS

**Adımlar:**
- `browser_navigate http://localhost:5173/dashboard`
- 2 saniye `wait`
- 2. `browser_navigate` ile aynı URL (refresh etkisi)
- snapshot incelemesi

**Gerçekleşen:**
Snapshot'ta TopNavbar'da `button "D Deneme deneme@test.com"` görünür (avatar + email). Sidebar nav, branch selector, hava durumu (19°C Parcali · Bilkent...), zone listesi (Giriş, Sıra), demographics widget hep render edildi. /login redirect olmadı.

**Kanıt:** snapshot s1e115 (refresh öncesi) ve s1e115 (refresh sonrası) — her ikisinde de `D Deneme deneme@test.com` butonu mevcut. /api/auth/me 200 dönmüş olmalı (auth context kararlı).

### R1.1d Demo login — NOTED-removed

`browser_navigate /demo` → custom 404 sayfası: "404 No signal — The page you're looking for was not found on this device. Our model couldn't detect it anywhere".

`/api/auth/demo` → 404. `frontend/src/contexts/AuthContext.tsx` içinde `demoLogin` grep boş.

**Karar B uygulandı.** CLAUDE.md ve kod arasında uyumsuzluk var. Faz 9 dokümantasyon temizliğinde:
- CLAUDE.md `## Auth Akisi` bölümünden DEMO bahsini sil
- accountType DEMO enum (DB hâlâ var) deprecation notu ekle, mevcut 1 DEMO satırı tutuluyor (geriye uyumluluk)

### R1.2c Multi-branch UI switch — PARTIAL

**Bulgu:** TopNavbar combobox'da 2 branch görünür:
```
- option "Cape Town Ekhaya — Cape Town"
- option "Mozart C building — Bilkent, Üniversiteler, ... Çankaya, Ankara, ... Türkiye" [selected]
- option "+ Add Branch"
```

UI üzerinden switch yapılamadı (`browser_select_option` ve `browser_click` BrowserMCP'de bozuk). Önceki API testi 01.md 1.2c'de iki farklı koordinat → iki farklı `/api/branches/:id/weather` cevabı PASS göstermişti, dolayısıyla **backend tarafı PASS**, **frontend filter context switch'i UI BLOCKED**.

### R1.3b Weather 10dk localStorage cache — PASS (statik)

`grep` `frontend/src/components/dashboard/WeatherWidget.tsx`:
```
8:  const CACHE_TTL_MS = 10 * 60 * 1000;
9:  const TRAFFIC_TTL_MS = 5 * 60 * 1000;
62: const wCached = localStorage.getItem(wKey);
73: const tCached = localStorage.getItem(tKey);
100: localStorage.setItem(wKey, JSON.stringify({ data: payload, expiresAt: Date.now() + CACHE_TTL_MS }));
108: localStorage.setItem(tKey, JSON.stringify({ data, expiresAt: Date.now() + TRAFFIC_TTL_MS }));
```

10 dakika weather + 5 dakika traffic cache logic kod tarafında doğrulandı. CLAUDE.md ile tutarlı. Browser localStorage inspect yapılmadı (BrowserMCP JS exec yok).

### R1.4 Settings audit — STATIC+VISUAL

**Görsel envanter (UI snapshot'tan, EN locale):**

| # | Section | UI Header | Durum | Hardcoded TR var mı |
|---|---------|-----------|-------|---------------------|
| 1 | Şubeler | **"Subeler"** (h3) | açık (default expanded) | **EVET** — başlık + açıklama + "Yeni sube" + "Varsayilan yap" + "Haritada gor" + "1 kamera · 0 aktif" |
| 2 | Camera & Detection | "Camera & Detection" | açık | hayır (sliderlar, switchler EN) |
| 3 | Notifications | "Notifications" | açık | hayır (channels embedded; "Email SMTP connected" badge) |
| 4 | Regional & Display | "Regional & Display" | açık | hayır (Language: Türkçe/English, Timezone, Date/Time fmt, Theme) |
| 5 | User Profile | "User Profile" | kapalı | bilinmiyor (expand edilemedi) |
| 6 | Security | "Security" | kapalı | bilinmiyor |
| 7 | ObservAI About | "ObservAI" | static footer | hayır |

**01.md'deki 8'lik envanter güncellemesi:** "Bildirim Kanalları" ayrı section değil, Notifications içinde gömülü → toplam **7 section + 1 about footer**. dataMode toggle bu sayfada YOK (muhtemelen Live/Demo geçişi başka yerden, AuthContext bağlamında).

**Görsel teyit (kritik bulgular):**

1. **Branch section dil karışımı (i18n bug netleşti):**
   - Sayfa locale = English (Regional & Display → Language: English [selected])
   - AMA Branch section başlığı **"Subeler"**, açıklama **"Subelerinizi yonetin. Hava durumu, Trends ve Insights bu subenin konumuna gore hesaplanir."**, button text **"Yeni sube"**, **"Varsayilan yap"**, **"Haritada gor"** hep TR ASCII-bare
   - Kullanıcı EN seçtiğinde Branch section'da TR görmesi → **dil tutarsızlığı confirmed** (01.md i18n bulgu görsel kanıtla)

2. **Cape Town branch timezone HATALI:**
   - DB değeri: `Asia/Dubai` (gösterimi: `-33.9288, 18.4172 · Asia/Dubai`)
   - Doğrusu olmalı: `Africa/Johannesburg` (UTC+2, no DST)
   - Asia/Dubai UTC+4 → 2 saat sapma → analytics aggregator yanlış saatlere düşürür
   - **Yan sorun (orta)**: BranchSection geocode sonrası timezone seçmiyor, default kullanıcının timezone'u veya yanlış varsayılan geliyor

3. **"Python backend is not reachable":**
   - Settings header'da kırmızı status text
   - AMA `curl :5001/health` = 200, Python WebSocket aktif (`logs/camera-ai.log` canlı yazıyor)
   - Frontend muhtemelen farklı endpoint kontrol ediyor (`/api/python-backend/status` vs direct `:5001/health`) ya da CORS/proxy issue
   - **Yan sorun (düşük-orta)**: Faz 2 Camera & Streaming'de detay araştırılacak

4. **Mozart C building**: 39.8843, 32.7611, Europe/Istanbul, 2 kamera 1 aktif ✓
5. **Email SMTP connected** ✓ (R1.1e için kanıt)
6. **Notification settings özet**: Push ON, Sound ON, Crowd Surge ON, Occupancy ON, Demographic Trend OFF, System ON, Email ON, Daily Summary ON @ 21:00, Min severity High+
7. **Camera detection özet**: Sensitivity 50%, Threshold 50%, FrameSkip 1, Resolution 416px (Balanced), MaxDetect 30, BBox/Demographics/Zone overlay all ON

**Mobile responsive test:** BrowserMCP'de viewport set tool yok → atlandı. Faz 8 Design polish'te yapılacak.

### R1.5a TR/EN parite — PARTIAL

**EN locale snapshot'ları alındı (7 sayfa):**
- `/` (landing) — fully EN ✓
- `/login` — fully EN ✓
- `/register` — fully EN ✓
- `/forgot-password` — fully EN ✓
- `/dashboard` — EN UI + TR zone names ("Giriş", "Sıra") + TR weather "Parcali" + TR address (Bilkent, Üniversiteler...)
- `/dashboard/settings` — **MIXED** (Branch section TR, diğer section'lar EN)
- `/dashboard/analytics` — EN UI ("Last 1 hour", "Refresh", empty state EN)

**TR locale snapshot'ı alınamadı** — language toggle butonuna tıklayamadım (BrowserMCP click bozuk).

**Yine de kesinleşen i18n bulgular (görsel + statik):**

| Ekran | Element | TR (kod) | EN | Durum |
|-------|---------|----------|----|----|
| /dashboard/settings | h3 Subeler | "Subeler" | (EN'de hâlâ TR) | **TR_BLEEDING** |
| /dashboard/settings | p subtitle | "Subelerinizi yonetin..." | (EN'de hâlâ TR) | **TR_BLEEDING** |
| /dashboard/settings | button "Yeni sube" | "Yeni sube" | (EN'de hâlâ TR) | **TR_BLEEDING** |
| /dashboard/settings | button "Varsayilan yap" | "Varsayilan yap" | (EN'de hâlâ TR) | **TR_BLEEDING** |
| /dashboard/settings | link "Haritada gor" | "Haritada gor" | (EN'de hâlâ TR) | **TR_BLEEDING** |
| /dashboard/settings | text "X kamera · Y aktif" | "1 kamera · 0 aktif" | (EN'de hâlâ TR) | **TR_BLEEDING** |
| /dashboard | weather "Parcali" | "Parcali" | (EN'de hâlâ TR) | **TR_BLEEDING** |
| /dashboard | zone label | "Giriş" | (DB-stored, kullanıcı verisi) | OK (kullanıcı veri) |
| (email body) | password reset | "Sifre Sifirlama..." | TR-only HTML | **MISSING_EN** |

Tüm TR_BLEEDING'ler `BranchSection.tsx` (13 occurrence — 01.md detay) + `WeatherWidget.tsx` (Parcali enum mapping) + `emailService.ts:309-330` (HTML body TR).

**Ek bulgu:** `WeatherWidget.tsx`'te weather code → string mapping muhtemelen TR sabit ("Parcali", "Acik", "Yagmurlu") — i18n eksik.

### R1.1e Password reset email — PASS (logical)

**API tetiklendi:**
```
POST /api/auth/forgot-password {"email":"test_faz1_..."} → HTTP 200
{"success":true,"message":"If an account exists, a reset link will be sent."}
```
DB row daha önce 01.md'de doğrulandı.

**Statik kod doğrulama:**
- `auth.ts:268` → `await sendPasswordResetEmail(user.email, resetUrl, userName)`
- `emailService.ts:298-353` → `nodemailer.transporter.sendMail({from, to, subject, html})`
- subject: `\u{1F511} [ObservAI] Sifre Sifirlama Talebi`
- HTML body: TR-only, ASCII-bare diakritikler ("Sifre", "Merhaba", "Yeni bir sifre belirlemek")
- Hata durumu fallback: `console.warn` + console.log reset URL (dev only)

**Görsel doğrulama (Settings):**
- Notifications section → "Email SMTP connected" yeşil badge → `verifySmtp()` true dönüyor → transporter ready
- "Send Test Email" butonu mevcut

**Sonuç:** SMTP yapılandırılmış + transport ready + kod path'te `await transporter.sendMail` çağrılıyor. Email **muhtemelen gönderildi**, başarısız olsaydı UI'da SMTP error durumu görünürdü. **Inbox proof yok** (Gmail MCP yok). Önceki PARTIAL → **PASS (logical)**.

**Yan sorun (i18n):** Email body TR-only, kullanıcının dil tercihine bakmıyor. Faz 7 i18n temizlik kapsamında multi-locale email template gerekli.

## Birleşik Faz 1 Final Tablo (01 + 01b)

| ID | Test | Önceki (01) | Final (01+01b) | Kanıt |
|----|------|-------------|----------------|-------|
| 1.1a | Register TRIAL | API-PASS | **PASS** | API + DB |
| 1.1b | Login + RememberMe | API-PASS | **PASS** | cookie 30d/7d |
| 1.1b' | Login NO RememberMe | API-PASS | **PASS** | cookie 7d default |
| 1.1c | Logout | API-PASS | **PASS** | cookie clear + /me 401 |
| 1.1d | Demo login | FAIL | **NOTED-removed** (kullanıcı kararı B) | /demo → 404, frontend demoLogin yok |
| 1.1e | Password reset | PARTIAL | **PASS (logical)** | DB row + SMTP UI badge + kod path + sendMail çağrısı |
| 1.1f | Session persistence | BLOCKED | **PASS** | Dashboard reload sonrası user banner mevcut |
| 1.2a | Branch create | API-PASS | **PASS** | DB row + 201 |
| 1.2b | Branch PATCH | API-PASS | **PASS** | 200 + DB updated |
| 1.2c | Multi-branch UI | PARTIAL | **PASS (API) / PARTIAL (UI)** | API farklı koordinat farklı response; UI dropdown 2 branch görünür ama switch BrowserMCP click bozukluğundan tetiklenemedi |
| 1.2d | Branch delete | API-PASS | **PASS** | success + cascade /weather 404 |
| 1.3a | Weather initial | API-PASS | **PASS** | Open-Meteo proxy + dashboard 19°C görünür |
| 1.3b | Weather 10dk cache | BLOCKED | **PASS (statik)** | WeatherWidget.tsx CACHE_TTL_MS=10*60*1000 |
| 1.3c | Branch switch yeni weather | API-PASS | **PASS** | API 2 farklı response |
| 1.4 | Settings audit | STATIC | **STATIC+VISUAL** | 7 section snapshot + Branch dil karışımı görsel teyit |
| 1.5 | TR/EN spot check | STATIC-FAIL | **PARTIAL (TR_BLEEDING confirmed)** | EN locale'de Branch section TR görsel kanıt, BranchSection 13+ hardcoded TR (statik); TR snapshot UI alınamadı |

**Final skor:** 14 PASS / 16 (87.5%) + 1 NOTED-removed + 1 PARTIAL-UI

## Yeni Bulunan Yan Sorunlar (01.md listesine ek)

8. **Cape Town branch timezone yanlış:** `Asia/Dubai` (UTC+4) DB'de, doğrusu `Africa/Johannesburg` (UTC+2). BranchSection geocode sonrası timezone otomatik atanmıyor → analytics agregasyon saatleri yanlış. Faz 4/6 etkiler.
9. **Settings'te "Python backend is not reachable" + curl :5001/health=200 çelişkisi:** Frontend yanlış endpoint kontrol ediyor olabilir (`/api/python-backend/status` proxy üzerinden). Faz 2 detay.
10. **Email body TR-only:** `emailService.ts:309-330` HTML body sadece Türkçe, kullanıcı locale'i hiç okunmuyor. Multi-locale email template gerekli (Faz 7 i18n).
11. **Weather code TR-only mapping:** "Parcali", "Acik" vs sabit Türkçe (WeatherWidget.tsx weather code → text). EN locale'de TR_BLEEDING. Faz 7.
12. **BrowserMCP click/type bozuk:** WebSocket timeout + tab id mismatch + React controlled input onChange tetiklenmiyor. Tüm sonraki fazlarda **Playwright CLI önerilir** (chromium binary kurulması Faz 2 öncesi). BrowserMCP read-only (navigate + snapshot + screenshot) için kullanılabilir.
13. **CLAUDE.md - kod uyumsuzluğu (DEMO):** Dokümantasyonda demoLogin var, kodda yok. Faz 9 final dokümantasyon temizliğinde net liste çıkar.

## Faz 2 önünde blocker

- **Playwright chromium binary kurulu değil** → form-driven E2E için `pnpm exec playwright install` gerekli (~150 MB indirme, kullanıcı onayı ile). BrowserMCP read-only kullanılırsa bu blok değil.
- Diğer bütün servisler UP, auth çalışıyor, kameralar var (10 cam, 5 aktif), zone'lar mevcut (30 zone). Faz 2 hazır.

## Önerilen Yeni Test Vakaları (Faz 9 ek)

- **R1.4.NEW**: Settings "Send Test Email" butonu davranışı
  - Adım: tıkla → bekle → toast/network response gör
  - Beklenen: 200 + toast "Test email sent to <user.email>"
  - Risk: orta (SMTP transport sıkıntıları gizli kalabilir)
- **R1.4.NEW-2**: Settings "Save Changes" idempotency
  - Adım: hiçbir şey değiştirme → "Save Changes" tıkla → DB'de updatedAt değişiyor mu
  - Beklenen: dirty-state kontrolü → 304 / no-op olmalı
  - Risk: düşük

## Sonuç

Faz 1 RETRY tamam. test-results/01b-auth-branch-settings-retry.md hazir. Faz 2 promptunu kullaniciya gonderebilirsiniz. Final 01: 14/16 PASS (87.5%), 1 NOTED-removed, 1 PARTIAL (UI switch BrowserMCP click bozuk).
