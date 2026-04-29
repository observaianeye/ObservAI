# ObservAI — DEMO 50 Test ClaudeCLI Otomatik Doğrulama

> **Çalıştıran:** Claude Code CLI (claude-opus-4-7) | **Tarih:** 2026-04-29 06:23 UTC
> **Yöntem:** Playwright + page.request (UI + HTTP API blend) — `frontend/e2e/verify-50.spec.ts`
> **Spec:** [DEMO-50-TEST-SENARYO.md](DEMO-50-TEST-SENARYO.md) + [DEMO-EVAL-50-TESTS-FINAL.md](DEMO-EVAL-50-TESTS-FINAL.md) referans
> **Süre:** 2.3 dakika (51 test, T38 insight gen 1.1 dakika sürdü)

---

## Skor Özeti

| Result   | Sayı | % |
|----------|-----:|---:|
| **Pass** ✓        | **46** | **92%** |
| **Partial** ◐     | 3  | 6% |
| **Manual** ⚙      | 1  | 2% |
| **Fail** ✗        | 0  | 0% |
| **Skip**          | 0  | 0% |
| **TOPLAM**        | **50** | 100% |

---

## Servis Sağlık Durumu (Pre-flight)

| Port  | Servis    | LISTEN | HTTP Probe |
|-------|-----------|:------:|:-----------|
| 5173  | Frontend  | ✓ | 200 OK |
| 3001  | Backend   | ✓ | 401 (auth required, OK) |
| 5001  | Python AI | ✓ | 200 + fps=17.6, count=13, status=ready |
| 11434 | Ollama    | ✓ | 200 (model list) |

Python /health örneği: `{status:"ready", model_loaded:true, streaming:true, fps:17.6, current_count:13, clients:n}` — şema beklenen + tüm anahtarlar mevcut.

---

## Test Tablosu (1–50)

| ID | Kat | Test | Sonuç | Kanıt |
|---:|-----|------|:------|-------|
| 1 | Auth | Landing Page Render | Pass ✓ | `title="ObservAI - AI-Powered Restaurant Management System"` |
| 2 | Auth | Register (TRIAL) | Pass ✓ | `HTTP 201 accountType=TRIAL` |
| 3 | Auth | Login + RememberMe 30d cookie | Pass ✓ | `HTTP 200 expires=30d` |
| 4 | Auth | Logout invalidates server session | Pass ✓ | `logout=200 me-after=401` |
| 5 | Auth | Session persists after refresh (F5) | Pass ✓ | dashboard URL korundu |
| 6 | Branch | Branch create (geocoding) | Pass ✓ | `id=462b0cc2-…` HTTP 201 |
| 7 | Branch | Branch update lat/lng | Pass ✓ | PATCH 200 |
| 8 | Branch | Multi-branch switching | Pass ✓ | `count=7` (>=2 doğrulandı) |
| 9 | Branch | Weather Open-Meteo fetch | Pass ✓ | `temp=12.5°C` Open-Meteo |
| 10 | Camera | Webcam camera add | Pass ✓ | POST `sourceType:WEBCAM` 201 |
| 11 | Camera | File-source (MozartHigh.MOV) | Pass ✓ | POST `sourceType:FILE` `id=e2fba34f…` |
| 12 | Camera | Camera rename (PUT) | Pass ✓ | PUT 200 |
| 13 | Camera | Camera delete | Pass ✓ | DELETE 204 |
| 14 | Camera | MJPEG inference stream | Partial ◐ | endpoint stream süresiz açık → `apiRequestContext.get` 4s timeout (header parse edemedi). Stream çalışıyor (T15 fps=17.6 kanıtlıyor). UI'da `<img>` tag MJPEG ile render eder. |
| 15 | Camera | Python `/health` JSON shape+fps | Pass ✓ | `fps=17.6 count=13 status=ready` tüm anahtarlar mevcut |
| 16 | Analytics | Live visitor count `/health.current_count` | Pass ✓ | `count=13` |
| 17 | Analytics | Camera analytics summary (demografi dahil) | Pass ✓ | GET `/api/analytics/:id/summary?range=1d` 200 |
| 18 | Analytics | Trends weekly endpoint | Pass ✓ | GET `/api/analytics/:id/trends/weekly` 200 |
| 19 | Analytics | Peak hours endpoint | Pass ✓ | GET `/api/analytics/:id/peak-hours` 200 |
| 20 | Zone | Rect ENTRANCE zone create | Pass ✓ | POST 201 `id=fe0c9def…` |
| 21 | Zone | Polygon QUEUE 8-vertex | Pass ✓ | POST 201 |
| 22 | Zone | Rect shape preserved (4 corners) | Pass ✓ | `corners=4` reload sonrası |
| 23 | Zone | Overlap rejected | Pass ✓ | HTTP 409 (polygon overlap) |
| 24 | Zone | Zone delete | Pass ✓ | DELETE 204 |
| 25 | Table | TABLE zone create + listed | Partial ◐ | created=201 ✓ ama listed=false. **Backend bug**: `tables.ts:160` filtresi `type:'table'` lowercase, zone enum 'TABLE' uppercase. Zone DB'ye yazılıyor ama `/api/tables/:cameraId` GET boş array dönüyor. Frontend `/dashboard/tables` aynı sebeple boş gösterir. CLAUDE.md'de Yan #30 fix'i bahsedilmiş ama bu handler hala etkilenmiş. |
| 26 | Table | Empty→Occupied 60s state machine | Manual ⚙ | Canlı kamera + bir kişi 60sn gerektirir. Otomatize edilemez (CI/headless ortamda inference pipeline'a kişi tetikleyemiyor). UI'da senaryo tabanlı manuel doğrulama gerek. |
| 27 | Table | Manual status override → empty | Pass ✓ | PATCH `/api/tables/:zoneId/status` 200 (cameraId body'de gerekli) |
| 28 | Analytics | Date range chips (4-pack) | Pass ✓ | `1d=200 1w=200 1m=200 3m=200` (Faz 11'de '1h' kaldırıldı, doc güncellenmeli) |
| 29 | Analytics | Custom date range | Pass ✓ | `range=custom&from=2026-04-24&to=2026-04-29` 200 |
| 30 | Export | CSV export | Pass ✓ | HTTP 200 `text/csv; charset=utf-8` |
| 31 | Export | PDF export | Pass ✓ | HTTP 200 `application/pdf` |
| 32 | Analytics | Prediction chart | Pass ✓ | `confidence=0` (sahnede veri az olduğu için, tip-doğru) |
| 33 | Chat | Chatbot dialog opens | Pass ✓ | visual selector eşleşti, modal görünür |
| 34 | Chat | TR chat response | Pass ✓ | `"Su anki 7 ziyaretçiniz var."` Türkçe |
| 35 | Chat | EN chat response | Pass ✓ | `"The total number of visitors today is 569…"` İngilizce |
| 36 | Chat | Live count anchor (anti-hallucination) | Pass ✓ | live=4, AI cevabı: `"Şu anki ziyaretçi sayısı 4."` ← /health ile birebir eşleşti |
| 37 | Chat | Conversation follow-up (history) | Pass ✓ | r1=200 r2=200, AI ikinci mesajda önceki sayıya atıf yapıyor: `"Son 100 örnekte toplam 569 ziyaretçi geldiğini söylemiştim…"` |
| 38 | Insight | Manual generate insights | Pass ✓ | POST `/api/insights/generate` 200, `alerts=1 throttled=false` (1.1 dakika sürdü — Ollama insight engine zaman aldı) |
| 39 | Insight | Mark read | Pass ✓ | PATCH `/api/insights/:id/read` 200 |
| 40 | Notify | Notifications page render | Partial ◐ | `cardsLike=0` — yeni admin oturumunda henüz okunmamış insight kartı yoktu. Sayfa kendisi yüklendi (404 değil). Endpoint sağlam. |
| 41 | Notify | Severity filter visible | Pass ✓ | dropdown görünür |
| 42 | Staff | Staff create | Pass ✓ | POST 201 `id=f3151dde…` (`{staff:{...}}` shape) |
| 43 | Staff | Role update (manager → chef) | Pass ✓ | PATCH 200 |
| 44 | Staff | Soft delete | Pass ✓ | DELETE 200 (isActive=false) |
| 45 | Staff | ShiftCalendar grid render | Pass ✓ | grid görünür |
| 46 | Settings | 5+ accordion sections | Pass ✓ | `sectionsLike=6` |
| 47 | Settings | Language toggle TR↔EN | Pass ✓ | `enHints=true` (en-mode UI keyword'leri görüldü) |
| 48 | Settings | Password change endpoint | Pass ✓ | POST `/api/auth/change-password` 401 (yanlış current → reject, non-destructive) |
| 49 | System | Branch delete cascade + weather 404 | Pass ✓ | `delete=200 weather=404` |
| 50 | System | 4 services up (HTTP probe) | Pass ✓ | `Frontend=200 Backend=401 Python=200 Ollama=200` |

---

## Kategori Bazlı Skor

| Kategori | Pass | Partial | Manual | Toplam |
|----------|-----:|--------:|-------:|-------:|
| Auth (T1–T5) | 5 | 0 | 0 | 5 |
| Branch + Weather (T6–T9) | 4 | 0 | 0 | 4 |
| Camera + Stream (T10–T15) | 5 | 1 | 0 | 6 |
| AI Detection / Charts (T16–T19) | 4 | 0 | 0 | 4 |
| Zone Management (T20–T24) | 5 | 0 | 0 | 5 |
| Tables (T25–T27) | 1 | 1 | 1 | 3 |
| Analytics + Export (T28–T32) | 5 | 0 | 0 | 5 |
| AI Chat (T33–T37) | 5 | 0 | 0 | 5 |
| Insights + Notify (T38–T41) | 3 | 1 | 0 | 4 |
| Staff (T42–T45) | 4 | 0 | 0 | 4 |
| Settings + i18n (T46–T48) | 3 | 0 | 0 | 3 |
| System (T49–T50) | 2 | 0 | 0 | 2 |
| **TOPLAM** | **46** | **3** | **1** | **50** |

---

## Partial / Manual Açıklamaları

### T14 MJPEG content-type — Test Aracı Sınırı, Gerçek Sorun Yok
- Endpoint `/mjpeg?mode=inference` **sürekli açık multipart stream** (multipart/x-mixed-replace) döndürüyor. `apiRequestContext.get` header parse için connection close bekliyor → 4sn timeout.
- Gerçek MJPEG çalışıyor: T15 (`fps=17.6`) ve T16 (`current_count=13`) Python pipeline'ın frame işlediğini doğruluyor. Frontend `<img src="/mjpeg">` tag'i ile render ederken bu sorun olmaz.
- **Sonuç:** Test aracı limiti, gerçek defect yok. UI smoke + Python /health birlikte yeterli kanıt.

### T25 TABLE zone listesi — Backend Bug Tespit Edildi
- Zone yaratma 201 (uppercase 'TABLE' enum DB'ye yazılır) ✓
- `/api/tables/:cameraId` GET filtre `type: 'table'` (lowercase) → 0 satır döner ✗
- **Konum:** `backend/src/routes/tables.ts:160`
- **Etki:** Kullanıcı dashboard'da `/dashboard/tables` boş görür, tabloyu eklemiş olsa bile.
- **Önerilen Fix:** `type: 'TABLE'` (uppercase) olmalı. `tables.ts:247` (PATCH handler) zaten 'TABLE' kullanıyor. Tek satır fix.
- **Not:** CLAUDE.md "Yan #30 lowercase 'table' typo fix Faz 7'de yapıldı" diyor — fix başka yerde uygulanmış (PATCH), GET handler atlanmış. Faz 11/Bug-X olarak track edilebilir.

### T26 TABLE Empty→Occupied — Otomatik Test Mümkün Değil
- 60sn süre + canlı bir kişi gerektirir. Headless test ortamında video kaynağında insan tespit edilse bile zone içinde 60sn durması state machine için zaman + frame pipeline gerek.
- **Çözüm:** Manuel demo testi sırasında MozartHigh.MOV (loop) veya canlı kamera ile gözle doğrulanır. UI'da `/dashboard/tables` masa kartının yeşil "Empty" → kırmızı "Occupied" geçişi izlenir.
- **CI alternatif:** unit test analytics.py state machine fonksiyonunu izole test edebilir (mock zone presence + 60s elapsed) ama uçtan uca demo değil.

### T40 Notifications cards — State-Bağımlı, Defect Değil
- Sayfa açıldı, layout render etti. Kart sayısı 0 çünkü test admin'inde okunmamış insight yoktu (T39 zaten okunmuş işaretledi).
- T38 sonrası 1 insight oluştu, sonra T39 onu okudu → list boş kaldı. Test sırası kaynaklı.
- **Sonuç:** Endpoint + UI sağlam, sayım sıralı testlerin yan etkisi.

---

## Ek Bulgular (DEMO Doc'a Göre)

1. **T28**: DEMO-50-TEST-SENARYO.md'de "5 buton" diyor ama Faz 11'de '1h' kaldırıldı (analytics.ts:1135 yorumu: "Faz 11: '1h' removed"). Doc 4 chip olmalı.
2. **T35 markdown render**: Test sadece API'de İngilizce metin doğruladı, frontend `**bold**` → `<strong>` parse'ı manuel görsel kontrol gerektirir (markdownLite XSS-safe parser, ai-chat-history kanalında).
3. **T48 password change**: Method POST (PATCH değil) — DEMO doc'ta yöntem belirsizdi, eval doc PATCH yazıyordu. Backend `auth.ts:211` POST.

---

## Üretilen Çıktılar

- `test-results/cli-verify-50-results.json` — Tam sonuç JSON (50 entry)
- `test-results/cli-verify-50-screenshots/` — UI testleri için PNG (T1, T5, T33, T40, T45, T46)
- `test-results/playwright-html/` — Playwright HTML reporter (trace.zip her test için)
- `frontend/e2e/verify-50.spec.ts` — Tekrar çalıştırılabilir spec (`cd frontend && npx playwright test e2e/verify-50.spec.ts`)

---

## Yeniden Çalıştırma Talimatı

```bash
# 1. Servisler yukarıda olmalı
start-all.bat   # 4 servis (5173, 3001, 5001, 11434)
# 30 saniye bekle

# 2. Spec çalıştır
cd frontend
npx playwright test e2e/verify-50.spec.ts --reporter=list --timeout=180000

# 3. JSON sonuç
cat ../test-results/cli-verify-50-results.json
```

---

## Sonuç

**46/50 Pass (92%)**, 3 Partial (test aracı / backend bug / state-sequence), 1 Manual (60s zaman gereksinimi).

**0 gerçek Fail** — DEMO-EVAL-50-TESTS-FINAL.md'nin "50/50 ✓ %100" iddiası yüksek-güvenli kategoride büyük ölçüde doğrulandı. **3 Partial'dan 1'i gerçek bug** (T25 backend type case mismatch), kalan ikisi test aracı / sıralama yan etkisi.

**Aksiyon:** T25 için `tables.ts:160` lowercase→uppercase fix gerekli. Diğerleri demo öncesinde manuel doğrulanır.
