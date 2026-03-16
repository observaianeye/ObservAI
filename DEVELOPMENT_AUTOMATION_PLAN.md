# ObservAI - Otomatik Geliştirme Planı
**Oluşturulma Tarihi:** 3 Mart 2026

## 📊 Tamamlanan Görevler — Son Güncelleme: 2026-03-03 16:43

| Görev | Açıklama | Durum |
|-------|----------|-------|
| **1.1.1** | Backend Health-Check Endpoint | ✅ Tamamlandı |
| **1.1.2** | Frontend Bağlantı State Machine | ✅ Tamamlandı |
| **1.1.3** | Python Backend Ready Event | ✅ Tamamlandı |
| **1.2.1** | Model Preloading Mekanizması | ✅ Tamamlandı |
| **1.2.2** | Entegrasyon Testi — Kamera Stabilite | ✅ Tamamlandı |
| **2.1.1** | Asenkron Processing Pipeline | ✅ Tamamlandı |
| **2.1.2** | YOLO Model Optimizasyonu | ✅ Tamamlandı |
| **2.2.1** | Demografik Tahmin İyileştirme | ⏳ Sırada |
| **2.2.2** | Performans Entegrasyon Testi | ⏳ Sırada |
| **3.1.1** | Insight Engine Backend Servisi | ⏳ Sırada |
| **3.2.1** | AI Insights Frontend Sayfası | ⏳ Sırada |
| **3.2.2** | Gemini API Entegrasyonu | ⏳ Sırada |
| **3.3.1** | AI Insight Entegrasyon Testi | ⏳ Sırada |
| **4.1.1** | Historical Analytics Sayfası | ⏳ Sırada |
| **4.2.1** | Settings Sayfası İyileştirme | ⏳ Sırada |

> **Devam eden AI için:** `HANDOFF.md` dosyasını oku, `auto_dev_progress.json` içindeki ilk `pending` görevi seç.

---


**Proje:** ObservAI - AI-Powered Real-Time Customer Analytics Platform

---

## Plan Özeti

Bu plan, ObservAI projesinin otomatik ve sürekli geliştirilmesi için tasarlanmıştır. Bir Python otomasyon scripti, bilgisayar açıkken ve oyun çalışmıyorken projeyi adım adım geliştirir.

---

## Faz 1: Kamera Stabilite ve Bağlantı Sorunları (Öncelik: KRİTİK)

### 1.1 Video Feed Başlatma Güvenilirliği
**Sorun:** Kamera seçildiğinde görüntü gelmiyor, birkaç yeniden başlatma gerekiyor.
**Kök Neden Analizi:**
- Socket.IO bağlantı yarış durumu (race condition)
- Python backend hazır olmadan frontend bağlanmaya çalışıyor
- MJPEG stream başlatma gecikmesi

**Yapılacaklar:**
1. Backend health-check endpoint ekle (`/api/python-backend/ready`)
2. Frontend'de bağlantı durumu yönetimini iyileştir (retry logic with exponential backoff)
3. Python WebSocket server'da "ready" event yayınla
4. CameraFeed.tsx'de bağlantı state machine implementasyonu
5. Video source değiştirme sırasında graceful cleanup

**Test Kriterleri:**
- [ ] İlk açılışta 5 saniye içinde görüntü gelmesi
- [ ] 10 ardışık başlatmada %100 başarı oranı
- [ ] Kamera değiştirmede 3 saniye içinde geçiş

### 1.2 AI Detection Başlatma Sorunu
**Sorun:** Görüntü gelse bile AI (bounding box, demografik analiz) çalışmıyor.
**Kök Neden Analizi:**
- YOLO model yükleme gecikmesi
- InsightFace model initialization hatası
- Analytics engine state management

**Yapılacaklar:**
1. Model preloading mekanizması (startup sırasında yükle)
2. Analytics engine state'ini frontend'e yayınla
3. Hata mesajlarını kullanıcıya göster (model yükleniyor, hazır, hata)
4. Fallback modu: YOLO çalışsın, demografik opsiyonel

**Test Kriterleri:**
- [ ] Model yükleme durumu UI'da görünür
- [ ] YOLO tespiti video başladıktan sonra max 3 saniye
- [ ] InsightFace hatası durumunda YOLO tek başına çalışmaya devam eder

---

## Faz 2: Performans Optimizasyonu (Öncelik: YÜKSEK)

### 2.1 FPS İyileştirmesi
**Sorun:** Düşük kaliteli görüntüde bile FPS çok düşük.

**Yapılacaklar:**
1. Frame skip stratejisi: Her frame analiz etme, her 2-3 frame'de bir
2. Asenkron processing pipeline:
   - Thread 1: Frame capture (30 FPS)
   - Thread 2: YOLO inference (10-15 FPS)
   - Thread 3: Demographics (5 FPS - her kişi için yeterli)
3. Resolution scaling: Capture yüksek, inference düşük çözünürlükte
4. YOLO model optimizasyonu:
   - YOLOv11s → NMS threshold ayarlama
   - Confidence threshold optimizasyonu
   - Input size ayarlama (640→416 veya 320)
5. ONNX Runtime GPU optimizasyonu
6. Batch processing for demographics

**Test Kriterleri:**
- [ ] Minimum 15 FPS (webcam 720p)
- [ ] CPU kullanımı < %70
- [ ] GPU kullanımı varsa < %80
- [ ] Latency < 200ms (capture to display)

### 2.2 AI Doğruluğu İyileştirme
**Sorun:** Yaş ve cinsiyet tahminleri yanlış çıkıyor.

**Yapılacaklar:**
1. InsightFace model değerlendirmesi ve en iyi model seçimi
2. Temporal smoothing iyileştirmesi:
   - Kayan pencere (rolling window) ile tahmin ortalaması
   - Confidence-weighted averaging
   - Outlier rejection (ani değişimleri filtrele)
3. Yüz tespiti kalitesi kontrolü:
   - Minimum yüz boyutu filtresi
   - Yüz açısı kontrolü (profil yüzleri atla)
   - Blur detection (bulanık yüzleri atla)
4. Kişi başına demografik cache:
   - Tracking ID ile eşleştir
   - İlk 5 frame'in ortalamasını al, sonra kilitle
5. Custom model fine-tuning değerlendirmesi

**Test Kriterleri:**
- [ ] Cinsiyet doğruluğu > %85
- [ ] Yaş grubu doğruluğu > %70
- [ ] Aynı kişi için tutarlı sonuç (frame-to-frame varyans < %10)

---

## Faz 3: AI Insight Sistemi (Öncelik: ORTA-YÜKSEK)

### 3.1 AI Insight Mantığı Tanımlama

**Insight Kategorileri:**
1. **Gerçek Zamanlı Uyarılar:**
   - Yoğunluk uyarısı (zone kapasitesinin %80'i aşıldığında)
   - Uzun bekleme süresi (bir kişi >X dakika aynı zone'da)
   - Anormal kalabalık artışı (son 5 dk vs önceki saat ortalaması)

2. **Dönemsel İçgörüler:**
   - Günün en yoğun saatleri
   - Demografik trendler (sabah vs akşam profili)
   - Zone bazlı doluluk karşılaştırması
   - Haftalık/aylık karşılaştırma

3. **Öneri Motoru:**
   - Personel önerisi (yoğun saatlere göre)
   - Düzen önerisi (en az kullanılan zone'lar)
   - Pazarlama önerisi (demografik profile göre)

### 3.2 AI Insight Backend Implementasyonu

**Yapılacaklar:**
1. Insight engine modülü oluştur (`/backend/src/services/insightEngine.ts`)
2. Kural tabanlı gerçek zamanlı uyarılar
3. İstatistiksel trend analizi
4. Gemini API entegrasyonu (doğal dil önerileri)
5. Insight API endpoints (`/api/insights`)
6. Bildirim sistemi (WebSocket push)

### 3.3 AI Insight Frontend

**Yapılacaklar:**
1. AIInsightsPage.tsx'i tam fonksiyonel yap
2. Insight kartları (kategori, öncelik, zaman)
3. Trend grafikleri
4. Öneri listesi
5. Gerçek zamanlı uyarı bildirimleri

**Test Kriterleri:**
- [ ] Gerçek zamanlı uyarılar 5 saniye içinde görünür
- [ ] Insight sayfasında en az 3 farklı insight türü
- [ ] Gemini doğal dil sorgusu çalışır

---

## Faz 4: Ek Ekranlar ve Özellikler (Öncelik: DÜŞÜK)

### 4.1 Historical Analytics
- Tarih aralığı seçimi
- Karşılaştırmalı grafikler
- PDF/CSV export iyileştirmesi

### 4.2 Settings Sayfası
- Kamera ayarları
- Zone ayarları
- Bildirim tercihleri
- Kullanıcı profili

### 4.3 Notifications Sayfası
- Bildirim listesi
- Okundu/okunmadı durumu
- Filtre ve arama

### 4.4 Multi-Camera Dashboard
- Tüm kameraların özet görünümü
- Kamera karşılaştırması

---

## Otomasyon Stratejisi

### Çalışma Koşulları
- Windows PC açık olmalı
- Steam veya Epic Games üzerinden oyun çalışmıyor olmalı
- Internet bağlantısı aktif olmalı

### Task Execution Flow
```
1. Sistem Kontrol → PC açık mı? Oyun var mı?
2. Proje Durum Tespiti → Son yapılan iş, sıradaki task
3. Task Seçimi → Plandan sıradaki task'ı al
4. Geliştirme → Claude/Cursor/Gemini ile kodu yaz
5. Kod Testi → Otomatik test çalıştır
6. Görsel Test → Chrome'da UI kontrol
7. Sonuç Kayıt → Başarılı ise ilerle, değilse tekrar dene (max 3)
8. Loop Koruması → Aynı task'ta 3 başarısız → atla, raporla
```

### Anti-Loop Mekanizması
- Her task için maksimum 3 deneme
- Her deneme için token limiti (50K token)
- Toplam session başına token limiti (500K token)
- Aynı hatayı 2 kere alırsa farklı yaklaşım dene
- 3. denemede de başarısızsa: SKIP + log + sonraki task'a geç

---

## Token Maliyet Tahmini

### Faz 1: Kamera Stabilite (~150K-250K token)
| Task | Tahmini Token | Açıklama |
|------|---------------|----------|
| 1.1 Backend health-check | 15K-25K | Basit endpoint + test |
| 1.1 Frontend retry logic | 30K-50K | State machine + Socket.IO |
| 1.1 Python ready event | 15K-25K | WebSocket event ekleme |
| 1.1 Görsel test | 20K-30K | Chrome test + debug |
| 1.2 Model preloading | 20K-30K | Python startup optimization |
| 1.2 State broadcasting | 15K-25K | Frontend durum gösterimi |
| 1.2 Fallback modu | 20K-30K | Hata yönetimi |
| 1.2 Entegrasyon testi | 15K-25K | End-to-end test |

### Faz 2: Performans (~200K-350K token)
| Task | Tahmini Token | Açıklama |
|------|---------------|----------|
| 2.1 Frame skip stratejisi | 25K-40K | Threading + async pipeline |
| 2.1 Resolution scaling | 20K-30K | Capture vs inference ayrımı |
| 2.1 YOLO optimizasyonu | 30K-50K | Model config + benchmark |
| 2.1 ONNX optimizasyonu | 20K-30K | GPU acceleration |
| 2.1 Performans testi | 25K-40K | FPS ölçüm + tuning |
| 2.2 Temporal smoothing | 25K-40K | Algoritma + test |
| 2.2 Yüz kalite kontrolü | 20K-30K | Filter implementasyonu |
| 2.2 Demografik cache | 25K-40K | Tracking + cache sistemi |
| 2.2 Doğruluk testi | 20K-30K | Benchmark + karşılaştırma |

### Faz 3: AI Insight (~200K-300K token)
| Task | Tahmini Token | Açıklama |
|------|---------------|----------|
| 3.1 Insight engine backend | 40K-60K | Servis + kurallar |
| 3.2 API endpoints | 25K-40K | REST API + WebSocket |
| 3.2 Gemini entegrasyonu | 30K-45K | NL query + context |
| 3.3 Frontend sayfası | 40K-60K | UI components + charts |
| 3.3 Bildirim sistemi | 25K-35K | Push notifications |
| 3.3 Entegrasyon testi | 25K-40K | End-to-end test |

### Faz 4: Ek Özellikler (~150K-250K token)
| Task | Tahmini Token | Açıklama |
|------|---------------|----------|
| Historical analytics | 40K-60K | Tarih seçimi + grafikler |
| Settings sayfası | 30K-50K | Form + API |
| Notifications sayfası | 25K-40K | Liste + filtre |
| Multi-camera | 40K-60K | Dashboard + karşılaştırma |

### TOPLAM TAHMİN
| Faz | Min Token | Max Token | Tahmini Claude Oturumu |
|-----|-----------|-----------|----------------------|
| Faz 1 | 150K | 250K | 2-4 oturum |
| Faz 2 | 200K | 350K | 3-5 oturum |
| Faz 3 | 200K | 300K | 3-5 oturum |
| Faz 4 | 150K | 250K | 2-4 oturum |
| **TOPLAM** | **700K** | **1.15M** | **10-18 oturum** |

> **Not:** 1 Claude oturum ≈ 100K-200K token kapasiteye sahiptir.
> Cursor Pro aylık ~500 fast request + unlimited slow request.
> Gemini API free tier günlük limit var.

### AI Kullanım Dağılımı Önerisi
- **Claude (Cowork):** Plan yönetimi, karmaşık mimari kararlar, test senaryoları
- **Cursor Agent:** Kod yazımı, refactoring, hata düzeltme
- **Gemini:** Code review, alternatif çözüm önerileri
- **Codex:** Basit kod tamamlama, boilerplate

---

## Günlük Çalışma Programı (Otomasyon)

```
Her 30 dakikada bir kontrol:
├── PC açık mı? → Hayır → Bekle
├── Oyun çalışıyor mu? → Evet → Bekle
├── Internet var mı? → Hayır → Bekle
├── Token limiti aşıldı mı? → Evet → Bugün dur
└── Herhangi bir hata loop'u var mı? → Evet → Atla + raporla

Task seçimi:
├── progress.json'dan son durumu oku
├── Sıradaki incomplete task'ı al
├── Task'ın gereksinimlerini kontrol et
└── Geliştirme başlat

Geliştirme döngüsü:
├── Prompt hazırla (task tanımı + mevcut kod bağlamı)
├── AI'a gönder (Claude/Cursor/Gemini)
├── Gelen kodu uygula
├── Otomatik test çalıştır
├── Görsel test (opsiyonel - Chrome kontrolü)
├── Başarılı → ilerle, kaydet
└── Başarısız → max 3 deneme, sonra SKIP
```
