# ObservAI - Belge vs Gerçek Proje Karşılaştırma Raporu

## Amaç
4 belge (SRS, Prototype, SDD, SPMP) ile projenin şu anki durumu karşılaştırılarak, farklılıklar ve bunların mantıklı gerekçeleri sunulacak.

---

## 1. VERİTABANI (TÜM BELGELER)

| Belgede Yazan | Gerçek Durum |
|---|---|
| PostgreSQL + TimescaleDB (ana DB) + SQLite (edge cache) | SQLite (Prisma ORM ile, `file:./dev.db`) |

**Neden Değişti:** Proje akademik bir geliştirme ortamında çalışıyor. PostgreSQL + TimescaleDB kurulumu ve yönetimi gereksiz karmaşıklık yaratacaktı. SQLite sıfır konfigürasyon gerektirir, tek dosyada çalışır ve Prisma ORM ile sorunsuz entegre olur. Bir kafe/restoran ölçeğindeki veri hacmi için SQLite fazlasıyla yeterlidir. Production'a geçişte Prisma sayesinde PostgreSQL'e geçiş minimal değişiklik gerektirir.

---

## 2. AI MODELİ (YOLO VERSİYONU)

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: YOLOv8-nano | YOLO11L (yolo11l.pt, ~50MB) |
| SPMP: YOLOv12 Nano | YOLO11L (Large model, FP16) |

**Neden Değişti:** 
- YOLOv8-nano (SRS yazıldığında planlanan) ve YOLOv12 Nano (SPMP'de güncellenen) yerine **YOLO11 Large** modeli kullanılıyor.
- "Nano" modellerden "Large" modele geçilme sebebi: RTX 5070 GPU'nun 12GB VRAM kapasitesi, daha büyük ve doğru bir modeli rahatlıkla çalıştırabilmesidir. Nano modeller düşük güçlü cihazlar içindir; güçlü bir GPU varken Large model çok daha yüksek tespit doğruluğu sağlar.
- YOLO11, YOLOv8'den daha güncel bir sürümdür ve daha iyi performans/doğruluk dengesine sahiptir. Ultralytics'in en son stable release'i olduğu için tercih edilmiştir.

---

## 3. DEMOGRAFİ (YAŞ/CİNSİYET) PIPELINE

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: YOLOv8 + OpenCV ile demografik tahmin | InsightFace (buffalo_l) + MiVOLO + ONNX Runtime |
| Prototype: 4 yaş grubu (2-17, 18-34, 35-54, 55+) | 7 yaş grubu (0-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+) |

**Neden Değişti:**
- YOLO nesne tespiti yapar, yüz analizi yapmaz. Gerçek implementasyonda **InsightFace** kütüphanesi yüz tespiti ve yaş/cinsiyet tahmini için kullanılıyor. Bu, endüstri standardı bir yaklaşımdır.
- 4 yaş grubu yerine 7 yaş grubu kullanılmasının sebebi, kafe/restoran yöneticilerine daha detaylı demografik bilgi sunmaktır. Örneğin 18-34 aralığı çok geniştir; 18-24 (üniversite öğrencileri) ile 25-34 (çalışanlar) farklı müşteri profilleridir.
- Temporal smoothing (EMA + weighted median), gender consensus voting gibi gelişmiş teknikler eklenerek tahmin kalitesi büyük ölçüde artırılmıştır.

---

## 4. FRONTEND UI FRAMEWORK

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS/SDD: React + Material UI + Tailwind CSS | React 18 + Vite + Tailwind CSS 3.4 + custom components |

**Neden Değişti:** Material UI kullanılmıyor. Tailwind CSS tek başına tüm UI ihtiyaçlarını karşılıyor. Material UI ekstra bundle boyutu ve opinionated tasarım kısıtlamaları getirir. Tailwind CSS ile tamamen özelleştirilmiş, hafif ve tutarlı bir UI oluşturuldu. Chart'lar için ECharts ve Recharts kullanılıyor.

---

## 5. BİLDİRİM SİSTEMİ (NOTIFICATION)

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: Firebase Cloud Messaging (FCM) + Web Push API | ntfy.sh + in-app notification center + Socket.IO |

**Neden Değişti:** FCM entegrasyonu Google hesabı bağımlılığı ve ek yapılandırma gerektirir. Bunun yerine:
- **ntfy.sh**: Açık kaynak, self-hosted push notification servisi kullanılıyor.
- **In-app bildirimler**: Dashboard içinde tam teşekküllü bir notification sayfası var (severity filtreleme, okundu/okunmadı, ses/masaüstü bildirim ayarları).
- **Socket.IO**: Gerçek zamanlı bildirim iletimi WebSocket üzerinden yapılıyor.
- Sonuç olarak FCM'den daha esnek ve bağımsız bir çözüm uygulandı.

---

## 6. LLM ENTEGRASYONU

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS/SPMP: Gemini 2.0 Flash (tek LLM) | Gemini 2.5 Flash (birincil) + Ollama (yerel fallback) |

**Neden Değişti:**
- Gemini 2.0 Flash yerine **2.5 Flash** kullanılıyor çünkü Google daha yeni ve yetenekli modeli çıkardı.
- **Ollama** eklendi: İnternet bağlantısı olmayan ortamlarda veya Gemini API'sine erişim sorunu yaşandığında yerel AI modelleri (llama3.1, mistral, phi3) ile çalışabilme yeteneği sağlar. Bu, sistemin daha dayanıklı olmasını garanti eder.
- Varsayılan sağlayıcı Ollama olarak ayarlanmış, Gemini fallback olarak devreye giriyor.

---

## 7. DOCKER KULLANIMI

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: "All services shall run inside Docker containers" | Docker kullanılmıyor |

**Neden Değişti:** Proje tek bir Windows makinesinde (RTX 5070) yerel olarak çalışıyor. Docker, GPU passthrough (özellikle CUDA) gibi ekstra karmaşıklık getirir. Geliştirme ve demo aşamasında batch dosyaları (start-all.bat, stop-all.bat) ile tüm servisler kolayca başlatılıyor/durdurulabiliyor. Production deployment planlandığında Docker entegrasyonu eklenebilir.

---

## 8. CLOUD HOSTING

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS/SPMP: AWS, Render, veya Vercel | Tamamen self-hosted (yerel makine) |

**Neden Değişti:** Proje GPU-yoğun bir AI sistemidir. Cloud GPU maliyetleri (AWS, GCP) akademik bütçe için çok yüksektir. RTX 5070 ile yerel çalıştırma hem ücretsiz hem de düşük gecikme süresi sağlar. Sunumlar için yerel demo yeterlidir.

---

## 9. CI/CD (GITHUB ACTIONS)

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS/SPMP: GitHub Actions ile CI/CD | GitHub Actions workflow'ları yok |

**Neden Değişti:** Proje 5 kişilik küçük bir ekip tarafından geliştirilmektedir. Manuel code review ve pull request süreci kullanılmaktadır. GitHub Actions'ın eklenmesi, test altyapısının kurulması ve bakımı ek zaman gerektirir. Akademik proje kapsamında öncelik çalışan ürün teslim etmektir. Ancak PR template'i (.github/) mevcut olup code review süreci uygulanmaktadır.

---

## 10. KİMLİK DOĞRULAMA (AUTH)

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: Session token + redirect | Session-based + HTTP-only cookies + bcrypt |
| SDD: AuthController, SessionRepository | Prisma-based session storage, authMiddleware |

**Neden Değişti:** Temel mimari aynı (session-based auth). Implementasyon detaylarında:
- Session token'lar veritabanında saklanıyor (Prisma ile)
- HTTP-only cookie kullanımı XSS saldırılarına karşı daha güvenli
- bcrypt ile şifre hashleme
- 7 gün session süresi (Remember me: 30 gün)
- SRS'te bahsedilmeyen ek özellikler: **Register**, **Forgot/Reset Password**, **Demo Login** (/demo route'u)
- Hesap tipleri: TRIAL (14 gün), PAID, DEMO
- Bu, SRS'deki temel gereksinimin üstünde ek güvenlik ve kullanılabilirlik sağlar.

---

## 11. KULLANICI ROLLERİ

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: Tek kullanıcı grubu - "Manager" | 4 rol: ADMIN, MANAGER, ANALYST, VIEWER |
| | 3 hesap tipi: TRIAL, PAID, DEMO |

**Neden Değişti:** Gerçek dünya senaryosunda bir kafede birden fazla kullanıcı tipi olabilir (patron, müdür, analist, sadece izleyen personel). RBAC (Role-Based Access Control) ile her rolün erişim yetkisi farklılaştırılmıştır. Demo hesap tipi, sistemi tanıtım amacıyla kullanmak isteyenler için eklenmiştir. TRIAL hesap tipi ise yeni kayıt olan kullanıcılara 14 günlük deneme süresi sunar.

---

## 12. SAYFALAR VE ÖZELLİKLER

| SRS'te Planlanan | Gerçek Durum | Durum |
|---|---|---|
| Landing Page | `/` ve `/home` - tam implementasyon | ✅ VAR |
| Login Page | `/login` - tam implementasyon | ✅ VAR |
| Dashboard Home | `/dashboard` - tam implementasyon | ✅ VAR |
| Camera/Layering Page | `/dashboard/camera-selection` - 8 kaynak tipi | ✅ VAR (genişletildi) |
| AI Suggestion | `/dashboard/ai-insights` - tam implementasyon | ✅ VAR |
| Settings Page | `/dashboard/settings` - tam implementasyon | ✅ VAR |
| Help Page | HelpCenter modal + OnboardingTour | ✅ VAR |
| Notification Page | `/dashboard/notifications` - tam implementasyon | ✅ VAR |
| **Ek (SRS'te yok):** | | |
| Register Page | `/register` - tam implementasyon | ➕ EK |
| Forgot/Reset Password | `/forgot-password`, `/reset-password` | ➕ EK |
| Demo Redirect | `/demo` - otomatik demo login | ➕ EK |
| Historical Analytics | `/dashboard/historical` - CSV/PDF export | ➕ EK |
| Zone Labeling (ayrı sayfa) | `/dashboard/zone-labeling` - detaylı editör | ➕ EK |

**Neden Ek Sayfalar:** SRS minimum viable product'ı tanımlar. Gerçek kullanımda kayıt, şifre sıfırlama, tarihsel analiz gibi özellikler zorunludur.

---

## 13. YERELLEŞTIRME (LOCALIZATION)

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS (NFReq5): TR/EN dil değiştirme | UI'da dil seçici var ama çeviri sistemi BAĞLI DEĞİL |

**Durum:** Settings sayfasında EN, TR, DE, FR, ES dil seçenekleri gösteriliyor ancak i18n kütüphanesi entegre edilmemiş. Arayüz İngilizce. AI chatbot iki dilde yanıt verebiliyor (kullanıcının diline göre).

**Neden:** Localization teknik olarak ertelenmiş bir özelliktir. Çekirdek analytics fonksiyonelliği önceliklendirilmiştir. UI stub'ı hazır, gelecekte i18next ile tamamlanabilir.

---

## 14. GÖRSELLEŞTİRME MODU DEĞİŞTİRME

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS (FReq2): "Interactively switch between visualization modes" | 4 chart tipi var (Bar, Line, Heatmap, Donut) ama sayfa bazlı |
| UC-03: Switch Visualization Mode | Aynı sayfa içinde chart tipi değiştirme toggle'ı YOK |

**Neden:** Chart'lar ilgili sayfalarına yerleştirilmiş durumda. Dashboard'da cinsiyet/yaş chart'ları, Historical'da trend chart'ları var. Kullanıcı ihtiyacına göre farklı sayfalarda farklı görselleştirmeler sunuluyor. Tek sayfa içinde toggle ihtiyacı pratik kullanımda ortaya çıkmadı.

---

## 15. ZONE TİPLERİ

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS/Prototype: entrance, exit | entrance, exit, queue, TABLE, CUSTOM |

**Neden Genişletildi:** 
- **Queue zone**: Kafe/restoranlarda kuyruk takibi kritik bir ihtiyaçtır. Bekleme süresi, kuyruk uzunluğu gibi metrikler yöneticiler için değerlidir.
- **TABLE zone**: Masa doluluk takibi için.
- **CUSTOM zone**: Kullanıcı tanımlı özel bölgeler için esneklik sağlar.

---

## 16. KAMERA KAYNAKLARI

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: IP Camera (RTSP) + MP4 test dosyaları | WEBCAM, FILE, RTSP, RTMP, HTTP, YOUTUBE, SCREEN_CAPTURE, PHONE |

**Neden Genişletildi:** Gerçek kullanım senaryoları çok çeşitlidir. Bir kafe sahibi IP kamerasını bağlayabileceği gibi, demo için YouTube live stream'i veya dizüstü bilgisayar webcam'ini kullanabilir. 8 farklı kaynak tipi, sistemi çok daha esnek yapar.

---

## 17. GPU/DONANIM

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: NVIDIA T4 veya GTX 1660 | NVIDIA RTX 5070 (12GB VRAM, CUDA) |
| SRS: Min 8GB RAM, önerilen 16GB | Gerçek donanıma göre çalışıyor |
| SRS: Min 4GB VRAM | 12GB VRAM |

**Neden Değişti:** SRS yazıldığında ekip hangi donanımı kullanacağını tam bilmiyordu. RTX 5070, projenin geliştirme sürecinde ana geliştirici tarafından kullanılan GPU'dur. Daha güçlü GPU, YOLO11 Large ve InsightFace modellerini FP16 precision ile sorunsuz çalıştırır.

---

## 18. TRACKER (BoT-SORT)

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS/SDD: Bahsedilmemiş | BoT-SORT tracker (with ReID) |

**Neden Eklendi:** YOLO sadece her frame'de kişileri tespit eder, ama frame'ler arası aynı kişiyi takip edemez. BoT-SORT:
- Kişilerin frame'ler arası takibini yapar (ID ataması)
- ReID (Re-Identification) ile kişiler kaybolup tekrar göründüğünde tanıma
- Zone giriş/çıkış sayımı için zorunlu bir bileşendir

---

## 19. VERİ SAKLAMA POLİTİKASI

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: 7 gün kısa vadeli, 3 ay insight | Explicit retention policy implemente EDİLMEMİŞ |

**Durum:** Veritabanında `expiresAt` alanı var (altyapı hazır) ama otomatik veri temizleme mekanizması henüz çalışmıyor. Veriler süresiz saklanıyor.

**Neden:** Geliştirme aşamasında veri kaybı istenmiyor. Retention policy production deployment öncesinde aktifleştirilecek.

---

## 20. EXPORT/RAPOR

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: Açıkça belirtilmemiş (NFReq1'de "export report" bahsediliyor) | CSV ve PDF export TAM İMPLEMENTE |

**Neden:** Historical Analytics sayfasında tarih aralığına göre filtrelenmiş verileri CSV/PDF olarak dışa aktarma, yöneticiler için pratik bir ihtiyaçtır. Backend'de PDFKit ve json2csv kullanılıyor.

---

## 21. BRANCH/ŞUBE YÖNETİMİ

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS/SDD: "Sites" entity (site_id, name, address) | "Branches" sistemi (lat/lon, timezone, city, isDefault) |

**Neden Değişti:** "Sites" konsepti "Branches" (Şubeler) olarak evrildi. Ek olarak:
- Koordinat bazlı hava durumu entegrasyonu (Open-Meteo API)
- Saat dilimi desteği
- Varsayılan şube seçimi
- TopNavbar'da şube seçici dropdown

---

## 22. HAVA DURUMU ENTEGRASYONU

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: Bahsedilmemiş | Open-Meteo API ile hava durumu entegrasyonu |

**Neden Eklendi:** AI chatbot'a "Bugünkü hava müşteri trafiğini nasıl etkiliyor?" gibi sorular sorulabilmesi için şube koordinatlarına göre hava durumu verisi çekiliyor. Bu, yöneticilere ek bağlam sağlar.

---

## 23. PRIVACY BLUR

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: "anonymized data handling", KVKK/GDPR uyumu | Tam privacy blur implementasyonu (Gaussian blur) |

**Durum:** SRS'te prensip olarak bahsedilen gizlilik, gerçek kodda somut olarak uygulanmış. `privacy_mode` flag'i ile kişi bbox'larına Gaussian blur uygulanabiliyor. Bu KVKK/GDPR uyumluluğunu somutlaştırıyor.

---

## 24. DWELL TIME (BEKLEME SÜRESİ)

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: "dwell time" vaguely mentioned in analytics | Tam implementasyon: per-person ve per-zone dwell time |

**Neden:** Kafe/restoran için müşterilerin ne kadar süre kaldığı kritik bir metriktir. Her kişinin `first_seen` zamanı takip ediliyor ve gerçek zamanlı olarak raporlanıyor.

---

## 25. SDD - GITHUB URL

| Belgede Yazan | Gerçek Durum |
|---|---|
| SDD: https://github.com/observaianeye/ObservAI | https://github.com/partalemre/ObservAI |

**Neden:** Repository, takım organizasyon hesabından kişisel hesaba taşınmış olabilir.

---

## 26. SDD - DATABASE TASARIMI (EER)

| SDD'de Tanımlanan Entity | Gerçekte Prisma Schema'da |
|---|---|
| Users | User (+ accountType, trialEndsAt, role) |
| Sites | Branch (name, city, lat, lng, timezone) |
| Cameras | Camera (+ sourceType, sourceConfig, isActive) |
| Zones | Zone (+ 5 zone tipi: ENTRANCE, EXIT, QUEUE, TABLE, CUSTOM) |
| AnalyticsRecords | AnalyticsLog (+ detaylı JSON data) |
| Heatmap_Data | Heatmap verisi AnalyticsLog içinde JSON olarak |
| ❌ | Session (yeni) |
| ❌ | Insight (yeni - AI insights + alerts) |
| ❌ | AnalyticsSummary (yeni - günlük özetler) |

**Neden:** SDD yazıldığında (Ocak 2026) ilk increment içindi. Geliştirme ilerledikçe ihtiyaçlar netleşti. Session tablosu auth için, Insight tablosu AI ve alert sistemi için, AnalyticsSummary ise historical analytics için gerekli oldu.

---

## 27. SPMP - YAZILIM GELİŞTİRME ORTAMI

| SPMP'de Listelenen | Gerçek Kullanım | Durum |
|---|---|---|
| JavaScript ES2022 | TypeScript (strict mode) | ✅ Geliştirildi |
| Python 3.10+ | Python 3.10+ | ✅ Aynı |
| React 18.x | React 18.3.1 | ✅ Aynı |
| Material UI | Kullanılmıyor | ❌ Çıkarıldı |
| Tailwind CSS 3.x | Tailwind CSS 3.4.1 | ✅ Aynı |
| Node.js 20.x | Node.js | ✅ Aynı |
| Express.js 4.x | Express | ✅ Aynı |
| PostgreSQL 15.x | SQLite (Prisma) | 🔄 Değişti |
| TimescaleDB 2.x | Kullanılmıyor | ❌ Çıkarıldı |
| SQLite 3.x (cache) | SQLite (ana DB) | 🔄 Rol değişti |
| YOLOv12-nano | YOLO11L | 🔄 Değişti |
| OpenCV 4.x | OpenCV | ✅ Aynı |
| PyTorch 2.x | PyTorch 2.x | ✅ Aynı |
| Gemini 2.0 Flash | Gemini 2.5 Flash + Ollama | 🔄 Güncellendi |
| FCM | ntfy.sh | 🔄 Değişti |
| Web Push API | Socket.IO + in-app | 🔄 Değişti |
| Docker 24.x | Kullanılmıyor | ❌ Çıkarıldı |
| AWS | Kullanılmıyor | ❌ Çıkarıldı |
| Render | Kullanılmıyor | ❌ Çıkarıldı |
| Vercel | Kullanılmıyor | ❌ Çıkarıldı |
| GitHub Actions | Yok (sadece PR template) | ❌ Çıkarıldı |
| Discord, Notion, Zoom, WhatsApp | Muhtemelen kullanılıyor | ✅ |
| Postman | Muhtemelen kullanılıyor | ✅ |
| VS Code | VS Code + Claude Code AI | ✅ Genişletildi |
| PyCharm | Bilinmiyor | ❓ |

---

## 28. SPMP - WORK PACKAGE TIMELINE DEĞİŞİKLİKLERİ

| WP | SPMP'de Planlanan | Gerçek Durum |
|---|---|---|
| WP11 | "Camera AI Integration (YOLOv12 Nano)" | YOLO11L + InsightFace + BoT-SORT |
| WP12 | "Demographic Estimation & Heatmaps" | InsightFace + temporal smoothing + heatmap |
| WP14 | "AI Insight Engine Development" | Ollama + Gemini dual-provider insight engine |
| WP15 | "Alert & Notification System" | Threshold-based alerts + ntfy.sh + in-app |

---

## 29. ALERT SİSTEMİ

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS (FReq3): Threshold-based alerts, overcrowding, queue | Tam implementasyon: occupancy_alert, wait_time_alert, crowd_surge |
| SRS: Notification page ile real-time display | Dedicated notifications page + severity filtering + quiet hours |

**Durum:** SRS'teki gereksinim tam olarak karşılanmış ve üstüne ek özellikler eklenmiştir (severity seviyeleri: low/medium/high/critical, okundu/okunmadı takibi, ses/masaüstü bildirim ayarları).

---

## 30. WEBSOCKET / REAL-TIME İLETİŞİM

| Belgede Yazan | Gerçek Durum |
|---|---|
| SRS: WebSocket ile real-time dashboard update | Socket.IO (WebSocket tabanlı) |

**Durum:** Birebir uyumlu. Socket.IO, WebSocket'in üzerine kurulu bir kütüphanedir ve otomatik reconnection, room support gibi ek özellikler sağlar.

---

## ÖZET: SUNUMDA SÖYLENECEKLER

### Belgelere UYGUN olan temel noktalar:
1. 3-katmanlı mimari (Frontend + Backend API + AI Processing) ✅
2. React frontend + Node.js/Express backend ✅
3. Real-time WebSocket iletişimi ✅
4. YOLO bazlı kişi tespiti ✅
5. Demografik analiz (yaş/cinsiyet) ✅
6. Heatmap görselleştirme ✅
7. Zone labeling (giriş/çıkış bölgeleri) ✅
8. Manager authentication ✅
9. Dashboard ile real-time analytics ✅
10. AI-generated insights (LLM) ✅
11. Alert/notification sistemi ✅
12. Tailwind CSS styling ✅
13. Privacy/KVKK uyumu ✅

### Geliştirme sürecinde EVRİLEN noktalar:
1. **DB**: PostgreSQL → SQLite (pratiklik + Prisma ile kolay geçiş)
2. **Model**: YOLOv8-nano → YOLO11L (güçlü GPU + daha iyi doğruluk)
3. **Demografi**: Genel CV → InsightFace (uzmanlaşmış çözüm)
4. **LLM**: Gemini tek → Gemini + Ollama (offline destek)
5. **Bildirim**: FCM → ntfy.sh + in-app (bağımsızlık)
6. **UI**: Material UI çıkarıldı (Tailwind yeterli)
7. **Hosting**: Cloud → self-hosted (GPU maliyet)
8. **Docker/CI**: Ertelendi (akademik öncelik: çalışan ürün)
9. **Localization**: UI hazır, çeviri sistemi henüz bağlanmamış
10. **Zone tipleri**: 2 → 5 (iş ihtiyaçları)
11. **Kamera kaynakları**: 2 → 8 (esneklik)
12. **Yaş grupları**: 4 → 7 (daha detaylı analiz)
