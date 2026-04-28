# Faz 3 — AI Model Doğruluk Derin Dalış

Tarih: 2026-04-28
Branch: refactor-partal
Önceki: 00-discovery.md, 01-auth-branch-settings.md, 01b-auth-branch-settings-retry.md, 02-camera-streaming.md
Live source aktif (Faz 2'den miras): MozartHigh.MOV (3840x2160 4K), 3 MJPEG client, /health: `status=ready, model_loaded=true, fps=15.8`

## Önceki rapor özetleri (kısa tekrar)

- **00-discovery.md:** RTX 5070 + tensorrt-cu12 10.16 + insightface 0.7.3 + ultralytics 8.4.18; yolo11l.engine derlenmiş; trt_engine_cache var; 51 pytest collected (sadece unit: config/geometry/interpolation/metrics).
- **01-auth-branch-settings.md:** auth+branch+weather API-PASS (8/16); demo login MISSING; UTF-8 input bug (yan); MiroFish anomalisi.
- **01b-retry.md:** UI snapshot ile 1.1f/1.2c/1.3b/1.4 PASS; Cape Town timezone hatası `Asia/Dubai` (yan, Faz 6 etki); BranchSection 13+ hardcoded TR; e-posta TR-only.
- **02-camera-streaming.md:** Camera CRUD + MJPEG 13/20 PASS, FPS/latency/bandwidth FAIL (kök: 4K kaynak); MiroFish-Offline gizemi KULLANICI tarafından çözüldü → DOCKER_CONTAINER_COLLISION (ayrı Docker container :5001'i tutmuş, kapatılınca düzeldi); pythonBackendManager resolution arg yok; "not reachable" UI bug (whitelist `status==='ready'` katı).

## Pre-flight özeti

| Kontrol | Sonuç |
|---|---|
| Servisler 5173/3001/5001/11434 | hepsi 200 ✓ |
| `/health`: status=ready, model_loaded=true, fps=15.8, clients=3 | ✓ |
| `pytest --collect-only` | 51 test ✓ — ama hepsi unit (config/geometry/interpolation/metrics buckets) |
| `pytest -q --tb=no` | **51/51 PASS in 5.50s** ✓ |
| `tests/fixtures/` | **YOK** — ground_truth.json yok, mozart_cafe_*_short.mp4 yok |
| `python -m camera_analytics.run --benchmark-mode` | **FLAG MEVCUT DEĞİL** — sadece `--source --config --output --model --interval --display` |
| `python -m camera_analytics.run_with_websocket --help` | sadece `--source --config --model --display --ws-host --ws-port` (benchmark flag yok) |
| `pip list grep insightface mivolo` | insightface 0.7.3 ✓; mivolo pip paketi YOK; ama `packages/camera-analytics/mivolo_repo/` klasörü tam MiVOLO repo klonu + `models/mivolo_d1_imdb.pth.tar` weight + `models/mivolo_v2/` |
| analytics_summaries (DB) | 22.756 satır, 21846 hourly + 910 daily |
| analytics_logs (DB) | 24.692 satır; **son satır 2026-04-25T20:55** = 67 saat eski; canlı stream çalışıyor ama persiste edilmiyor |

**KRİTİK BULGU:** CLAUDE.md `## Test Altyapısı` bölümü **aspirasyonel**. Listelenen `tests/fixtures/mozart_cafe_{1,2}_short.mp4` + `ground_truth.json` + `harness --benchmark-mode --duration-s 30` — **hiçbiri repoda mevcut değil**. 51 test toplandı (CLAUDE.md ile sayı uyumlu) ama içerik unit-only; `id_churn_rate`, `gender F1`, `age MAE` test'leri yok.

## Birleşik Test Tablosu (21 alt-test)

| ID | Test | Sonuç | Kanıt | Süre |
|---|---|---|---|---|
| 3.1a | Python harness benchmark mode | **MISSING** | flag mevcut değil — `run.py --help` çıktısı | n/a |
| 3.1b | Modeller yüklendi mi (TRT EP active) | **PASS** | yolo11l.engine 50.8MB + trt_engine_cache 5 InsightFace subgraph + /health model_loaded=true | n/a |
| 3.1c | Cold-start vs warm latency | **PASS** | data/03/3.1c_cold_vs_warm.txt — 1.27x ratio < 1.5x | log parse |
| 3.2a | Per-frame detection F1 | **MISSING** | ground_truth.json yok | n/a |
| 3.2b | False positive analiz | **MISSING** | ground_truth.json yok | n/a |
| 3.2c | False negative analiz | **MISSING** | ground_truth.json yok | n/a |
| 3.2d | Confidence threshold sweep | **MISSING** | harness benchmark flag yok + truth yok | n/a |
| 3.3a | id_churn_rate | **MISSING** | benchmark output yok | n/a |
| 3.3b | ID switches per real person | **MISSING** | truth yok | n/a |
| 3.3c | Re-identification after occlusion | **MISSING** | truth yok | n/a |
| 3.4a | Zone enter precision/recall | **MISSING** | truth yok | n/a |
| 3.4b | Zone exit precision/recall | **MISSING** | truth yok | n/a |
| 3.4c | Net flow consistency (enter-exit) | **MISSING** | truth yok | n/a |
| 3.5a | Per-detection gender F1 | **MISSING** | truth yok |  n/a |
| 3.5b | Gender lock + hysteresis davranışı | **PASS-CODE+LOG** | analytics.py:218,297-298,2989; data/03/3.5_gender_stats_from_log.txt — None rate 5.2%, gc<0.35 30.9%, ambiguous 51.3%, gc≥0.65 17.8% | log parse |
| 3.6a | Age MAE | **MISSING** | truth yok | n/a |
| 3.6b | Age lock kararlılığı | **PASS-CODE** | analytics.py:75,78,97,178-190 lock_stability=0.95+lock_min_samples=30 | static |
| 3.7a | Anlık sayı: Python /metrics vs Frontend | **FAIL** | data/03/3.7a_persistence_freshness.txt — Mozart/Cmd cam'leri DB'ye 0 satır | sql query |
| 3.7b | Saatlik agregasyon vs ground-truth | **PARTIAL** | data/03/3.7b_hourly_coverage.txt — seed verisi tutarlı (24h kapsam), canlı veri yok | sql |
| 3.7c | Günlük rollup (daily=sum(hourly)?) | **FAIL (3/10 cam)** | data/03/3.7c_rollup_match.txt — 1102a0c8 daily 269≠hourly 587, 586a323e 5≠337, sample-camera-1 31289≠22021 | sql |
| 3.8 | InsightFace vs MiVOLO kesin tanı | **PASS-DIAGNOSIS** | grep + age_gender.py:171,223,300-345 — **HER İKİSİ DE KULLANILIYOR** | static |

**Hesaplama:**
- PASS (her tür): 5 (3.1b, 3.1c, 3.5b, 3.6b, 3.8)
- FAIL: 2 (3.7a, 3.7c)
- PARTIAL: 1 (3.7b)
- MISSING (fixture/ground-truth yok): 13 (3.1a, 3.2*, 3.3*, 3.4*, 3.5a, 3.6a)

**Pass oranı (testable-only, MISSING hariç):** 5/8 = **62.5%** — hedef ≥80% **ALTINDA**.
**Pass oranı (strict, 21'lik):** 5/21 = 23.8%.

Hedefin altında kalmasının ana sebebi: **CLAUDE.md test altyapısının aspirasyonel olması**. Fixture+ground-truth setup edilmedikçe Faz 3'ün yarısı doğrulanamıyor.

## Detay

### 3.1a Python harness benchmark mode — MISSING

**Adım:** `python -m camera_analytics.run --benchmark-mode --duration-s 30 --source tests/fixtures/mozart_cafe_1_short.mp4 --output /tmp/bench_1.json`

**Beklenen:** JSON çıktı: `fps_mean`, `fps_p95`, `id_churn_rate`, `zone_count_delta`, gender F1, age MAE alanları dolu.

**Gerçekleşen:**
- `--benchmark-mode` argümanı `argparse` definitionunda yok. `run.py --help` ve `run_with_websocket.py --help` çıktıları yukarıda pre-flight tablosunda.
- `tests/fixtures/` klasörü mevcut değil.
- Bu fonksiyonalite CLAUDE.md'de tanımlı ama implement edilmemiş.

**Sonuç:** MISSING. Faz 9'da implement edilmesi önerilir (yeni kod, mevcut iş değil).

**Reproduksiyon:**
```bash
cd packages/camera-analytics && source venv/Scripts/activate
python -m camera_analytics.run --benchmark-mode --duration-s 30 --source dummy.mp4
# argparse: error: unrecognized arguments: --benchmark-mode --duration-s 30
```

### 3.1b Modeller yüklendi (TRT EP active) — PASS

**Kanıt zinciri:**
- Faz 0: `yolo11l.engine` 53,323,226 byte mevcut, mtime 2026-04-07 (derlenmiş).
- Faz 0: `trt_engine_cache/` klasörü 5 InsightFace ONNX subgraph engine + profile (sm120 = RTX 5070).
- pip: `tensorrt-cu12=10.16.0.72`, `tensorrt_cu12_bindings`, `tensorrt_cu12_libs` ✓
- Live `/health`: `model_loaded=true, source_connected=true, streaming=true, fps=15.8`.
- `logs/camera-ai.log` aktif: `[DEMO] MiVOLO: ...` üretiyor (model çalışıyor).
- Note (kod review 3.8'de): InsightFace **CUDA EP** kullanır (TensorRT EP gender accuracy düşürüyor diye bilerek atlandı), YOLO **TensorRT engine** kullanır.

**Sonuç:** PASS — TRT YOLO için aktif, InsightFace için bilinçli atlandı (CUDA FP32 = daha doğru).

### 3.1c Cold-start vs warm latency — PASS

**Adım:** `logs/camera-ai.log` içinden 42.110 latency satırı parse → ilk 10 (cold) vs son 10 (warm) karşılaştır.

**Olcum:**
| Stage | Cold mean | Warm mean | Cold/Warm |
|---|---|---|---|
| YOLO | 31.6ms | 30.6ms | 1.03x |
| Face | 14.8ms | 13.8ms | 1.07x |
| MiVOLO | 67.8ms | 45.4ms | 1.49x |
| **TOTAL** | **114.2ms** | **89.8ms** | **1.27x** |

**Beklenen:** warm < 1.5x cold (TRT JIT compile sonrası stabil).
**Sonuç:** PASS — 1.27x oranı hedefin altında. MiVOLO stage'inde en büyük cold/warm farkı (TRT engine warmup sebebi muhtemel).

**Kanıt:** `data/03/3.1c_cold_vs_warm.txt`

### 3.2a-d Detection F1 / FP / FN / Threshold sweep — MISSING

**Engelleyen:** `tests/fixtures/ground_truth.json` mevcut değil. Manuel ground-truth üretmek 4K MozartHigh.MOV için 1+ saat etiketleme gerektirir, prompt sonu kuralı: "Ground-truth'u senin uretmen GEREKMEZ — ... PARTIAL bayrak".

**Yan veri (kanıt-zorunlu olmayan, log-only):**
- 3.5 satır: 5000 mivolo log line, mean 3 results/satır → ~3 person/frame ortalama (pipeline çalışıyor).
- Son sample: `MiVOLO: 2 faces, 2 matched, 4 results | YOLO=33ms Face=17ms MiVOLO=58ms` → 4 detection track ID + 2 face matched.
- Mismatch (4 results, 2 faces): YOLO 4 person tespit etti, sadece 2 yüz görüldü. **Gözlem:** detection layer çalışıyor, occlusion durumlarında kayıp yüz beklendiği gibi.

**Sonuç:** MISSING — Faz 9'da fixture+ground-truth setup öncelikli iş.

### 3.3a-c Tracking ID stability — MISSING

**Engelleyen:** truth yok. CLAUDE.md'de `id_churn_rate` benchmark çıktısı bekleniyor ama harness implement edilmemiş.

**Yan veri:** logda son 10 dakika boyunca `tid=21158` ve `tid=21204` ısrarlı görünüyor → **track buffer 150 frame (5sn) uzun süre re-id sağlıyor**. Track ID'nin frame-frame patlamadığını gözlemledim (10 sample'da farklı tid sayısı 5-7 arası).

### 3.4a-c Zone Events Accuracy — MISSING

**Engelleyen:** ground_truth zone enter/exit listesi yok. Live MozartHigh.MOV için zone'lar manuel çizilebilir (Phase 0: 30 zone DB'de var) ama bu kameraya hangi zone'ların atandığı bilinmiyor.

**Yan veri (DB):**
- 30 zone toplam: ENTRANCE=6, EXIT=1, QUEUE=6, TABLE=16, CUSTOM=1.
- Mozart Cam 2 (1102a0c8) için saatlik agregasyon mevcut: 8-22 saatleri arası 587 in / 544 out → net flow consistent (delta 43, peak 65 kişi).

### 3.5a Per-detection gender F1 — MISSING

**Engelleyen:** ground-truth gender label yok.

### 3.5b Gender lock + hysteresis band — PASS-CODE+LOG

**Statik kod kanıtı (`packages/camera-analytics/camera_analytics/analytics.py`):**
- `:77` `gender_locked: bool = False`
- `:218-224` lock state korunuyor + reset
- `:298` lock atama: `self.gender_locked = True`
- `:1700` `existing.gender_locked or existing._demo_update_count >= 8` (CLAUDE.md "8 ardışık ayni cinsiyet" kuralı)
- `:2989-3036` "Gender: hysteresis band — values in the ambiguous middle zone are..." → CLAUDE.md band 0.35/0.65 implementasyonu mevcut
- `:3076` `gender_lock_threshold = cfg.demo_gender_lock_threshold` (default 6, CLAUDE.md Stage 3 kalibrasyonu)

**Live log kanıtı (`data/03/3.5_gender_stats_from_log.txt`):**
- 13.000 tid output (5000 satır × ortalama 2.6 person/satır)
- Gender output dağılımı: male=7889 (60.7%), female=4435 (34.1%), None=676 (5.2%)
- gc_score (gender confidence) dağılımı:
  - `gc < 0.35` (hysteresis lower band): **30.9%** → female yönünde rahat sinyal
  - `0.35 ≤ gc < 0.65` (ambiguous middle): **51.3%** → bu bölgede gender None geçmesi bekleniyor
  - `gc ≥ 0.65` (hysteresis upper): **17.8%** → male yönünde rahat sinyal

**Beklenen:** ambiguous band'da None rate yüksek olmalı.
**Gerçekleşen:** None rate sadece %5.2, ama ambiguous band %51.3. Bu **uyumsuzluk** olabilir; muhtemelen `_demo_update_count >= 8` lock devreye girince kilitli gender geliyor (None gönderilmiyor). Kod tutarlı.

**Sonuç:** PASS-CODE+LOG. Lock + hysteresis logic var ve çalışıyor.

### 3.6a Age MAE — MISSING

**Engelleyen:** truth yok.

### 3.6b Age lock kararlılığı — PASS-CODE

**Statik kod kanıtı (`analytics.py`):**
- `:75-78` `age_stability: float`, `gender_stability: float`, `age_locked: bool`
- `:97` `lock_stability: float = 0.95, lock_min_samples: int = 30` — **CLAUDE.md Stage 3 default'ları** (config override: 0.92 / 20)
- `:178-185` `age_stability` skoru `(1.0 - std_dev / 10.0) * sample_factor` → düşük varyans = yüksek stabilite
- `:188-190` lock atama: `if not self.age_locked and self.age_stability > lock_stability and len(samples) >= lock_min_samples`
- `:115-135` `age_locked` True iken `update_age()` reset edilmiyor (frame-frame snap engelli)
- `:2492-2495` track devam ettirme'de lock state korunuyor

**Sonuç:** PASS-CODE. 30 sample + stability ≥ 0.95 lock kuralı kod'da CLAUDE.md ile uyumlu.

### 3.7a Anlık sayı: Python vs Frontend — FAIL

**Adım:**
- Python `/metrics` endpoint denendi → **404** (endpoint yok). Sadece `/health` ve `/mjpeg` mevcut (websocket_server.py:264-265).
- Frontend dashboard count bilgisi WebSocket Socket.IO emit ile geliyor (cameraBackendService.ts).
- Persistence yolu: Python → Socket.IO → frontend → POST `/api/analytics` (cameraBackendService.ts:181 `persistAnalytics()` throttled).
- DB kontrolü: aktif kameraların kaç logu var?

**Olcum (data/03/3.7a_persistence_freshness.txt):**
| Aktif Kamera | DB log sayısı | Son timestamp |
|---|---|---|
| Test Cam Zone (04ac241f) | 4033 | 2026-04-25 20:55 (67 saat eski) |
| Test Hist Cam (1788a315) | 4033 | 2026-04-25 20:55 (67 saat eski) |
| Hist Cam (d94a2f0c) | 4033 | 2026-04-23 (5 gün eski) |
| **MozartHigh (f1fd68f7) — şu anda 4K stream live** | **0** | **null** |
| Cmd Webcam (2618a065) | 0 | null |
| Cmd File (69810440) | 0 | null |
| Cmd RTSP (5151d5c1) | 0 | null |
| Cmd YT (a1b58d9f) | 0 | null |

**Beklenen:** Python /metrics ↔ Frontend gösterimi fark = 0 (gerçek-zaman aynı veri).

**Gerçekleşen:**
- Python live `/health.fps=15.8` (Phase 2 confirmed MJPEG 4K stream var).
- DB analytics_logs **MozartHigh için 0 satır**.
- Demek ki: Python işliyor + Socket.IO emit yapıyor + ama hiçbir frontend client `/api/analytics` POST'unu sürmüyor (dashboard kapalı veya throttle penceresi içinde değil).

**5-Whys (systematic-debugging skill):**
1. **Neden** MozartHigh DB'de 0 satır? — Frontend `persistAnalytics()` çağrılmıyor.
2. **Neden** çağrılmıyor? — `cameraBackendService.persistAnalytics()` sadece dashboard açık iken Socket.IO `analytics:update` event aldığında trigger oluyor (10s throttle).
3. **Neden** dashboard açık değildi? — Faz 0/2 testleri sırasında geçici Playwright session'lar açıldı, ama 4K MozartHigh stream'i Faz 2'den beri (3 gündür) kesintisiz çalışıyor. Dashboard manuel kapanmış olabilir.
4. **Neden** Python kendi başına persiste etmiyor? — Mimari olarak Python ↔ Node arasında doğrudan bağlantı yok; Python REST/WS sadece frontend client'a yayın yapıyor; Node `analytics.ts:100` POST endpoint frontend tarafından beslenmek üzere tasarlanmış.
5. **Kök sorun:** Persistence pipeline **frontend-bağımlı**. Dashboard açık olmadan tarihsel veri kayıt edilmez. Bu **kullanici sorun #4'ün** ana sebebi: "analytics gerçek model verisi mi gösteriyor?" → mevcut Analytics page'de görünen veri **eski seed + son Playwright session ölçümleri**, canlı 4K stream'in 3 günlük sürüş datası kayıp.

**Sonuç:** FAIL — kayıp data persistence pipeline mimari hatası.

**Önergeler (Faz 7/9 yapılacak — bu fazda DOKUNMA):**
- A) Python ↔ Node doğrudan WebSocket/HTTP push: Python her N saniyede `/api/analytics` POST etsin (frontend bağımsız).
- B) Backend Socket.IO subscriber: Node, Python `:5001` Socket.IO'ya bağlansın ve emit'leri direkt persiste etsin.
- C) `pythonBackendManager` startup'ta opsiyonel `--persist-to-node` flag.

### 3.7b Saatlik agregasyon vs ground-truth — PARTIAL

**Adım:** DB'deki saatlik agregasyon coverage incelendi (data/03/3.7b_hourly_coverage.txt). sample-camera-1 için son 10 günün saat coverage'ı:
| date | hours_covered | min..max |
|---|---|---|
| 1777323600000 | 15 | 0..14 (kısmi gün) |
| 1777237200000 | 24 | 0..23 (tam gün) |
| ... 8 gün daha | 24 | 0..23 (tam gün) |

**Beklenen:** seed verisinde agregasyon doğru çalışmalı (24h kapsam tam günler için).
**Gerçekleşen:** ✓ tam günler için saat coverage 24/24. Kısmi gün (mevcut) için 15/24 (saat 14 = test anı).

**Engelleyen (ground-truth):** canlı veri yok (3.7a FAIL), seed-only data ile gerçek doğruluk kıyaslaması yapılamıyor.

**Sonuç:** PARTIAL — agregasyon altyapısı (analyticsAggregator.ts) ÇALIŞIYOR (saat coverage tam, hourly+daily için ayrı `runHourlyAggregationFor()` ve `runDailyAggregationFor()` 5 dk tick), ama **gerçek doğruluk** sadece live data ile test edilebilir (3.7a engellediği için).

### 3.7c Günlük/haftalık rollup match — FAIL (3/10 kamera)

**Adım:** `daily.totalEntries == sum(hourly.totalEntries)` kontrolü 10 kamera için.

**Olcum (data/03/3.7c_rollup_match.txt):**

| Kamera | Date | Daily(in,out) | HourlySum(in,out) | Match? |
|---|---|---|---|---|
| 04ac241f Test Cam Zone | 2026-04-25 | 412, 388 | 412, 388 | ✓ MATCH |
| **1102a0c8 Mozart Cam 2** | 2026-04-25 | **269, 223** | **587, 544** | ✗ **MISMATCH** (daily ≈ %46 of hourly) |
| 1788a315 Test Hist Cam | 2026-04-25 | 602, 567 | 602, 567 | ✓ MATCH |
| **586a323e Ekheya Cape Town** | 2026-04-25 | **5, 4** | **337, 326** | ✗ **MISMATCH** (daily ≈ %1.5 of hourly) |
| d14ed993 Mozart | 2026-04-25 | 494, 463 | 494, 463 | ✓ MATCH |
| d94a2f0c Hist Cam | 2026-04-25 | 541, 508 | 541, 508 | ✓ MATCH |
| dbe7e545 MozartLow | 2026-04-25 | 626, 592 | 626, 592 | ✓ MATCH |
| e01a8c50 (unnamed) | 2026-04-25 | 669, 622 | 669, 622 | ✓ MATCH |
| f1fd68f7 MozartHigh | 2026-04-25 | 480, 445 | 480, 445 | ✓ MATCH |
| **sample-camera-1** | 2026-04-25 | **31289, 30493** | **22021, 21865** | ✗ **MISMATCH** (daily ≈ %142 of hourly) |

**Hesap:** 7/10 kamera tutarlı, 3/10 mismatch.

**5-Whys (Cape Town 1.5% sapma):**
1. **Neden** Cape Town daily=5 ama hourly toplam=337? — Daily window'a sadece 1-2 saat dahil olmuş.
2. **Neden** sadece 1-2 saat? — Daily window timezone-aware başlatma kullanıyor; UTC günü vs sube timezone günü kayma.
3. **Neden** kayma? — Cape Town subesi DB'de `Asia/Dubai` (UTC+4) tagli, doğrusu `Africa/Johannesburg` (UTC+2). 2 saat sapma yetmez bu kadar büyük gap'e — başka bir bug var.
4. **Hipotez:** `analyticsAggregator.ts` `startOfDay(d)` kullanıyor (Date objesi local TZ kullanır). Backend Windows host'u Europe/Istanbul (UTC+3). Cape Town subesi timezone parametresi field'lı ama agregator branch tz'ı dikkate ALMIYOR.
5. **Kök sorun:** **Multi-branch timezone-aware aggregation kayıp** — agregator host TZ'da çalışıyor, branch TZ'ı yok sayılıyor.

**5-Whys (Mozart Cam 2 — 46%):**
1. Daily 269 vs hourly 587 — daily aggregate hourly'lerin yarısı kadar.
2. Hourlies h08-h22 doluyor (15 saat aktif) → 587/544 toplam.
3. Daily field 269/223 → muhtemelen daily aggregate hourly'lerden ÖNCE çalıştırıldı, sonra hourlies eklendi ama daily refresh edilmedi.
4. **Kök sorun:** `runDailyAggregationFor()` idempotent değil veya hourlies tamamlanmadan çalıştı.

**5-Whys (sample-camera-1 — 142%):**
1. Daily 31289 vs hourly 22021 — daily hourly'den BÜYÜK.
2. Bu seed verisi (`backfill-analytics-summary.ts`) — synthetic data farklı yöntemlerle daily ve hourly yarattı muhtemelen.
3. **Kök sorun:** seed scripti hourly+daily ayrı RNG path'lerle dolduruyor (idempotent agregator değil), tutarsızlık beklenen.

**Sonuç:** FAIL — agregator multi-branch timezone-aware DEĞİL ve seed verisi idempotency violate ediyor. Bu bug **kullanici sorun #2** "anlık/saatlik/günlük sayım hatası" ile DOĞRUDAN örtüşüyor.

**Önergeler (Faz 7 implementasyon — bu fazda DOKUNMA):**
- A) `analyticsAggregator.ts` `runDailyAggregationFor(branchId, date)` her sube için ayrı tetiklensin, branch timezone alınsın.
- B) Seed scripti `backfill-analytics-summary.ts` daily totalEntries = SUM(hourly.totalEntries) hesaplasın (direct compute, RNG yerine).
- C) Daily idempotency: `runDailyAggregationFor` her tick'te running re-aggregate etsin (mevcut hourlies'den).

### 3.8 InsightFace vs MiVOLO kesin tanı — PASS-DIAGNOSIS

**Statik kanıt (grep + age_gender.py inceleme):**

**Aktif provider:** **HER İKİSİ DE KULLANILIYOR**, farklı görevler için.

**Pipeline (CLAUDE.md'nin söylemediği detay):**
1. **YOLO11L** — person detection (TensorRT engine, FP16)
2. **InsightFace buffalo_l** — **face DETECTION only** (CUDA EP FP32, NOT TensorRT)
3. **MiVOLO** — **age + gender ESTIMATION** (Torch, mivolo_repo'dan import)

**Nerede import:**
- `camera_analytics/age_gender.py:45-46` — `import insightface`, `from insightface.app import FaceAnalysis`
- `camera_analytics/age_gender.py:171` — `from mivolo.model.mivolo_model import MiVOLOModel`
- `camera_analytics/age_gender.py:223` — `from mivolo.data.misc import prepare_classification_images`
- `camera_analytics/analytics.py:30` — `from insightface.app import FaceAnalysis`

**Sınıf tanımları:**
- `MiVOLOEstimator(AgeGenderEstimator)` line 71-298 — yaş/cinsiyet
- `InsightFaceEstimator(AgeGenderEstimator)` line 300-400+ — yüz tespiti (genderage modülü yüklü ama "we use MiVOLO for age/gender, InsightFace only for detection" yorumu line 343)

**Yorum (line 322-324, kritik):**
```python
# CUDA EP for InsightFace — TensorRT EP FP16 damages gender accuracy
# on the small genderage model (96x96) and adds overhead for dynamic
# shape models (det_10g). YOLO uses TRT engine separately.
```

**MiVOLO weight:**
- `packages/camera-analytics/models/mivolo_d1_imdb.pth.tar` (mivolo_v1)
- `packages/camera-analytics/models/mivolo_v2/` (HuggingFace safetensors format)
- `packages/camera-analytics/mivolo_repo/` — full MiVOLO github repo klon (timm submonkey patch için)

**Ne logluyor:**
```
[DEMO] MiVOLO: 1 faces, 1 matched, 3 results | YOLO=44ms Face=14ms MiVOLO=46ms |
       tid=21204:male(gc=0.89), tid=21158:male(gc=0.40), tid=21201:None(gc=0.00)
```
- "Face" stage = InsightFace detection ms
- "MiVOLO" stage = MiVOLO age/gender ms
- `gc=` = gender confidence (MiVOLO output)
- `None` = hysteresis ambiguous band (kod yorumu line 2989)

**CLAUDE.md uyumsuzluk listesi (Faz 9'da güncellenecek):**

| Satır | Mevcut metin | Düzeltme |
|---|---|---|
| `## Servisler` Python Analytics | `YOLO11L + InsightFace + WebSocket` | `YOLO11L + InsightFace (face detection) + MiVOLO (age/gender) + WebSocket` |
| `## Donanım` Model | `InsightFace: buffalo_l (TensorRT EP FP16, genderage + detection + recognition)` | `InsightFace: buffalo_l (CUDA EP FP32, detection + genderage; recognition skipped); MiVOLO: mivolo_d1_imdb.pth.tar veya mivolo_v2 (Torch, age/gender)` |
| `## Demografi Pipeline` step 1 | `InsightFace full-frame face detection` | DOĞRU — face detection InsightFace ile |
| `## Demografi Pipeline` step 4 | `AYRI age/gender confidence` | EKSİK — MiVOLO output olduğu belirtilmeli; InsightFace genderage modülü yüklü ama aktif kullanılmıyor |
| `## Python Analytics Önemli Dosyalar` `age_gender.py` | `InsightFace buffalo_l wrapper (CUDA EP)` | `MiVOLO + InsightFace dual estimator (MiVOLO age/gender, InsightFace face detection)` |

**DEĞİŞİKLİK YAPILMADI** — sadece raporlandı (prompt kuralı).

**Sonuç:** PASS-DIAGNOSIS — InsightFace + MiVOLO eş zamanlı kullanım kesin doğrulandı. CLAUDE.md güncellemesi Faz 9'da uygulanacak.

## Doğruluk Özet Tablosu (kullaniciya gostermek icin)

| Metrik | Hedef | Gerçek | Sonuç |
|---|---|---|---|
| Detection F1 | ≥ 0.85 | ground-truth yok | MISSING |
| Tracking id_churn | ≤ 0.3 | benchmark harness yok | MISSING |
| Gender F1 | ≥ 0.92 | ground-truth yok (live log: lock+hysteresis çalışıyor) | MISSING (PASS-CODE 3.5b) |
| Age MAE | ≤ 7 yıl | ground-truth yok (kod review: lock 30samples+0.95 stability) | MISSING (PASS-CODE 3.6b) |
| Zone enter P/R | ≥ 0.90 / 0.85 | ground-truth yok | MISSING |
| Saatlik count rel error | ≤ 5% | seed-only veri, agregator çalışıyor | PARTIAL |
| Günlük rollup match | tam | 7/10 kamera ✓, 3/10 BUG | **FAIL** |
| Live persistence | sürekli | aktif kameraların 5/8'i 0 satır | **FAIL** |
| Cold/warm latency | warm < 1.5x cold | 1.27x | PASS |
| TRT model loaded | aktif | YOLO TRT FP16 ✓, InsightFace CUDA FP32 (bilinçli) | PASS |
| Provider tutarlılığı (CLAUDE.md) | uyumlu | InsightFace+MiVOLO dual, CLAUDE.md eksik | DİAGNOZ (Faz 9 update) |

## CLAUDE.md vs Runtime Tutarlılık (3.8 özet)

- **Aktif provider:** InsightFace 0.7.3 (face detection, CUDA EP FP32) + MiVOLO (mivolo_repo klon, age/gender, Torch CUDA)
- **Import lokasyonu:** `packages/camera-analytics/camera_analytics/age_gender.py:45,46,171,223` + `analytics.py:30`
- **CLAUDE.md güncellemesi gerekli mi:** **EVET** — yukarıda 5 satır listesi (Faz 9'da uygulanacak)

## Yan Bulgular (kullanıcı listesine ek — 02.md sonu 19'da bitti)

20. **MiroFish-Offline gizem ÇÖZÜLDÜ → DOCKER_CONTAINER_COLLISION** — kullanıcı tarafından çözüldü: ayrı bir Docker container port 5001'e bağlanmıştı, Docker kapatıldı → düzeldi. Faz 0/2'deki transient `{service:"MiroFish-Offline Backend"}` cevabı bu Docker container'dan geliyordu. **Önerge:** ObservAI development docs'a "Docker Desktop running ile çakışan port ihtimali" notu eklenebilir.

21. **Test fixture infrastructure CLAUDE.md'de aspirasyonel** — `tests/fixtures/{mozart_cafe_1,2}_short.mp4`, `ground_truth.json`, `python -m camera_analytics.run --benchmark-mode --duration-s 30 --output bench.json` — repoda **MEVCUT DEĞİL**. CLAUDE.md `## Test Altyapısı` bölümünde dokümante edilmiş ama implement edilmemiş. **Etki:** Faz 3'ün 13/21 alt-testi MISSING. **Önerge:** Faz 9 sonu öncelikli iş — pytest accuracy fixture seti + harness `--benchmark-mode --duration-s` flag'ları.

22. **Live data persistence pipeline frontend-bağımlı** (3.7a) — Python işliyor ama dashboard açık olmadan analytics_logs'a yazım yok. 4K MozartHigh stream'i 3 gündür live çalışıyor, DB'ye 0 satır persiste edilmiş. Sebep: `cameraBackendService.persistAnalytics()` Socket.IO listener içinde, dashboard kapalı = listener pasif. **Önerge:** Python tarafında doğrudan Node `/api/analytics` POST eden zamanlayıcı, ya da Node'un Python Socket.IO'ya subscriber olması.

23. **Daily rollup multi-branch timezone-aware DEĞİL** (3.7c) — `analyticsAggregator.ts` `startOfDay()` host TZ'da (Europe/Istanbul) çalışıyor. Cape Town subesi (DB'de yanlış olarak `Asia/Dubai`, doğrusu `Africa/Johannesburg`) için günlük rollup pencereleri kayar → daily 5 vs hourly 337 mismatch. **Etki:** kullanıcı sorun #2 (anlık/saatlik/günlük sayım hatası) ana sebep adayı.

24. **Daily idempotency violation** (3.7c Mozart Cam 2 case) — `runDailyAggregationFor()` hourlies tamamlanmadan çalışırsa eksik daily üretiyor ve sonradan refresh etmiyor. Daily 269 vs hourlySum 587. **Önerge:** her tick'te daily-of-today re-aggregate.

25. **Seed scripti idempotent değil** (3.7c sample-camera-1 case) — `backfill-analytics-summary.ts` daily ve hourly'yi ayrı RNG yollarıyla dolduruyor, daily 31289 vs hourly 22021 (1.42x). **Önerge:** daily = SUM(hourly) doğrudan compute.

26. **`packages/camera-analytics/mivolo_repo/` git submodule değil, klon kopyası** — bunun nedeni timm monkey patch'i (line 17 yorum `MONKEY PATCH FOR TIMM / MiVOLO COMPATIBILITY`). pip ile `mivolo` paketi kurulmamış, ama mivolo_repo'dan `from mivolo.model.mivolo_model import` çalışıyor (sys.path'e ekleniyor). **Önerge:** README.md'ye MiVOLO setup adımı eklenmeli (klon nasıl yapıldı, hangi commit, monkey patch nedeni).

27. **InsightFace `genderage` modülü YÜKLÜ ama AKTİF KULLANILMIYOR** (age_gender.py:343 yorumu: "we use MiVOLO for age/gender, InsightFace only for detection") — 250MB memory + 5ms/frame fazlalık. **Önerge:** `_allowed = ['detection']` (genderage çıkar) — küçük perf iyileşmesi.

## Yeni Test Vakaları (Faz 9 EN dokumana)

- **3.1.NEW-1** — Harness benchmark mode implement
  - Adım: `python -m camera_analytics.run --benchmark-mode --duration-s 30 --output bench.json`
  - Beklenen: JSON çıktıda `fps_mean`, `fps_p95`, `id_churn_rate`, `zone_count_delta`, `latency_per_stage_ms`, `frames_processed`
  - Risk: yüksek (Faz 3'ün ana ihtiyacı)

- **3.2.NEW-1** — Ground-truth fixture seti
  - Adım: `tests/fixtures/mozart_cafe_1_short.mp4` (60s clip from MozartHigh.MOV) + `ground_truth.json` ({frame_id, [{bbox, person_id, age, gender, zone}]})
  - Beklenen: pytest accuracy testleri (`@pytest.mark.gpu`, `@pytest.mark.slow`) tutarlı oran döndürür
  - Risk: orta — manuel etiketleme 1-2h iş

- **3.7.NEW-1** — Live persistence verification
  - Adım: Python live stream + dashboard kapalı → 5 dk bekle → DB analytics_logs MozartHigh için 0 satır olmamalı
  - Beklenen: Python tarafından doğrudan persiste edilir (dashboard bağımsız)
  - Risk: yüksek (kullanıcı sorun #4)

- **3.7.NEW-2** — Multi-branch timezone-aware rollup
  - Adım: 3 sube farklı TZ (Istanbul, Cape Town, Dubai) → 24h log → her sube için daily.totalEntries == sum(hourly_in_branch_tz)
  - Beklenen: ✓ tam match
  - Risk: yüksek (kullanıcı sorun #2)

- **3.8.NEW-1** — CLAUDE.md vs runtime tutarlılık CI check
  - Adım: pytest test'i `test_claude_md_alignment.py` — README/CLAUDE.md'de geçen "InsightFace", "MiVOLO", "yolo11l.pt" gibi anahtarların kod içinde gerçekten bulunduğunu doğrula
  - Beklenen: 0 stale claim
  - Risk: düşük (dokümantasyon CI gate)

## Kolay Eklenebilecek Özellikler (EN)

### Feature 5: Direct Python→Node analytics persistence

> "Add a `--persist-to-node http://localhost:3001` flag to `run_with_websocket.py`. When set, the Python pipeline POSTs each analytics tick (~1s) directly to `/api/analytics` instead of relying on a frontend client to relay it. This guarantees historical data capture even when no dashboard is open. Configurable batch size (default 5 ticks per request) and retry-on-failure with exponential backoff."

### Feature 6: Branch-timezone-aware aggregator

> "`analyticsAggregator.ts` should query `branch.timezone` for each cameraId and compute `startOfDay()` / `endOfDay()` in branch-local time instead of host time. Idempotent re-aggregation on every 5-minute tick prevents stale daily rows. Add a `/api/analytics/reaggregate?branchId=...&date=...` admin endpoint to manually rebuild a window from raw logs."

### Feature 7: Documentation drift CI gate

> "Add a `test_claude_md_alignment.py` pytest case that parses CLAUDE.md, extracts technical claims (model names, file paths, env vars, port numbers), and verifies each is present in the actual codebase. Fails CI if a stale claim is found. Whitelist via `# CLAUDE.md-skip` inline comment for genuinely-aspirational sections."

### Feature 8: Benchmark mode harness

> "Implement `python -m camera_analytics.run --benchmark-mode --duration-s 30 --source <fixture> --output bench.json`. Mode runs pipeline for fixed duration, accumulates per-frame timings + tracking deltas + zone events + demographic outputs into a structured JSON: `{fps_mean, fps_p95, fps_p99, id_churn_rate, ids_per_real_person, zone_count_delta_per_zone, gender_distribution, age_mean, latency_per_stage_ms_p50_p95}`. Used by pytest accuracy markers."

## Faz 4 önünde blocker

**Yok (test perspektifinden).** Faz 4 Zones+Dashboard+Tables kapsamı ayrı. Faz 0'da zaten tabit edilen blocker `tables-ai-summary.test.ts` 6/6 fail durumu mevcut (Faz 4'te ele alınacak).

**Bilgi:** Faz 3 test infrastructure eksiklikleri (fixture, harness) Faz 4'ü engellemiyor; Faz 4 zone/dashboard/table testleri kendi seti ile yürütülecek.

## Bittiğinde

Faz 3 tamam. test-results/03-ai-model-accuracy.md hazir. PASS: 5/21 (strict) — 5/8 (testable-only, MISSING hariç) = 62.5% — hedefin (≥80%) altında. **Ana sebep: CLAUDE.md test infrastructure aspirasyonel (fixtures+harness flag yok), 13 alt-test MISSING durumda.** Faz 4 promptunu kullanıcıya gönderebilirsiniz.

**Kritik bulgular (kullanıcı kararı gereken):**
1. **Yan #20: MiroFish-Offline çözüldü** (Docker container collision).
2. **Yan #21: Test fixture infrastructure aspirasyonel** — Faz 9 öncelikli iş.
3. **Yan #22: Live persistence frontend-bağımlı** — kullanıcı sorun #4 ana sebep, Faz 7/9.
4. **Yan #23: Daily rollup multi-branch TZ-unaware** — kullanıcı sorun #2 ana sebep, Faz 7.
5. **3.8 PASS-DIAGNOSIS:** InsightFace + MiVOLO **eş zamanlı** kullanılıyor (CLAUDE.md eksik), Faz 9 doc update list 5 satır.
