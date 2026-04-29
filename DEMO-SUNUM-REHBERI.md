# ObservAI — Demo Sunum Rehberi (v1.0.0)

**Sunum süresi:** 10–15 dk · **Hedef kitle:** Cafe/restoran sahipleri, operasyon yöneticileri, jüri / yatırımcı
**Amaç:** Projeyi 6 başlık altında, akıcı ve teknik detaya boğmadan anlatmak.

> **Genel kural:** Her başlıkta önce SORU sor (gerçek bir problem), sonra ObservAI’nin verdiği YANITI göster. Slogan: **"Tahminle yönetilen mekan, veriyle yönetilene dönüşür."**

---

## 0. Açılış (30 saniye) — Sahneye giriş

Konuşma:

> "Merhaba. Ben **[Adınız]**, ekibimle birlikte **ObservAI** adında, cafe ve restoranlar için **gerçek zamanlı kamera analitik platformu** geliştirdik. Bugün size 10 dakikada şunu göstereceğim: bir mekan sahibinin gözüyle baktığımızda, var olan güvenlik kamerasından ne kadar değerli bir veri çekebiliyoruz ve bu veriyi nasıl iş kararına çeviriyoruz."

Ekranda: ObservAI logosu + canlı dashboard ekranı (TopNavbar’da sube secili, sag ust kosede hava durumu widget’i goruntude).

---

## 1. NEDEN bu projeyi düşündük? (1.5 dk) — Problem

Konuşma kurgusu:

> "Bir cafe sahibi şu üç soruyu her gün soruyor ama net bir cevap alamıyor:
> 1. **‘Bugün kaç kişi geldi, hangi saatte yoğunum?’** — Yazar kasa fişlerine bakıyor, ama fişe dönüşmeyen ziyaretçiyi göremiyor.
> 2. **‘Müşterilerim kim — hangi yaş, hangi cinsiyet?’** — Hissi konuşuyor: ‘Sanırım öğleden sonra genç kadınlar geliyor.’
> 3. **‘Hangi masa boş, hangisi temizlenmeli, kuyruğum şişti mi?’** — Garsonun gözüne bakıyor, kaçırırsa müşteri kapıdan dönüyor."

Vurgu cümlesi:

> "Mekanın **zaten kamerası var**. Biz dedik ki: bu kamera sadece güvenlik için değil, **operasyon ve büyüme kararı** için de çalışsın."

---

## 2. Projemizin AMACI ne? (1 dk) — Vizyon

Tek cümlelik manifesto:

> "ObservAI, **mevcut güvenlik kamerasını** üç şeye dönüştürür: ziyaretçi sayacına, demografi ölçerine ve operasyon asistanına — hem de **yerel olarak**, mekanın bilgisayarında, **bulut göndermeden**, GDPR uyumlu."

Üç temel hedef (slayt veya konuşmada say):

1. **Gerçek zamanlı görünürlük** — anlık doluluk, kuyruk uzunluğu, masa durumu
2. **Veri tabanlı karar** — saat saat, gün gün, demografiye göre personel ve menü kararı
3. **Gizlilik öncelikli** — yüz tanıma yok, kimlik yok, sadece anonim sayım + yaş/cinsiyet aralığı; istenirse yüz blur

---

## 3. Neleri SAĞLIYOR? (3 dk) — Özellik turu

> Demo akışı: **Login → Dashboard → Live Camera → Zones → Tables → Staffing → AI Chat → Insights → Historical**
> Her ekranda 15-30 saniye kal; tüm tıklamaları önceden prova et.

### 3.1 Login & Multi-Branch (15 sn)
- "Tek hesapla **birden fazla şube** yönetilebilir. Üstteki şube seçici ile şube değiştirildiğinde tüm dashboard, hava durumu, AI yanıtları o şubenin verisine göre güncellenir."
- Trial / Paid / Demo hesap tipleri var; demo hesap 2 saat süreli, sadece sentetik veri.

### 3.2 Dashboard (30 sn)
- "Sol üstte **anlık ziyaretçi sayısı**, yanında **bugünkü toplam**. Şube koordinatına bağlı **hava durumu widget'i** Open-Meteo'dan 10 dakikada bir güncellenir — çünkü hava müşteri sayısını etkiler, AI bunu öneri yaparken kullanır."
- Yaş dağılımı donut, cinsiyet dağılımı bar, saatlik trend line — hepsi ECharts ile interaktif.

### 3.3 Canlı Kamera (45 sn)
- "Bu, **gerçek bir kamera akışı**. YOLO11L modeli her kişiyi tespit ediyor, BoT-SORT ile takip ediyor, InsightFace yüzü buluyor, MiVOLO yaş ve cinsiyeti veriyor."
- "Smooth mode'da **60 FPS** akıcı görüntü, inference mode'da bbox + ID + yaş/cinsiyet etiketi gösteriliyor."
- "Kamera kaynağı esnek: **webcam, iVCam ile telefon, RTSP IP kamera, YouTube canlı yayın, video dosyası** — hepsi destekleniyor."

### 3.4 Zone (Bölge) Çizimi (30 sn)
- "Mekanın krokisini canlı görüntü üzerine çiziyorsunuz: **dikdörtgen, çokgen, serbest çizim**. Her bölgeye tip atanıyor: **giriş** (mavi), **çıkış** (kırmızı), **kuyruk** (amber), **masa** (yeşil), **özel**."
- "Bölgeler iç içe giremiyor (overlap engelleniyor) — frontend ve backend çift kontrol."

### 3.5 Masa Takibi (30 sn) — **göze en çarpan özellik**
- "Sistem her masanın 4 durumunu otomatik takip eder: **boş → dolu → boşaldı → temizlenmesi gerek**. Sandalye kayması (transit grace 10sn), occlusion (kişi geçici görünmez), 2 dakika boşaltıldıktan sonra ‘temizlik’ uyarısı, 15 dk’da otomatik ‘boş’a dönüş."
- "AI brifi 30 saniyede bir Ollama’dan gelir: ‘Masa 4 üst üste 25 dakikadır dolu, anchor müşteri.’"

### 3.6 Personel Planlama / Staffing (30 sn)
- "Geçmiş ziyaretçi yoğunluğuna ve demografiye bakarak **saat saat (7-23)** kaç personele ihtiyacın olduğunu öneriyor: 10 müşteri / 1 personel hedefi."
- "Vardiya atadığında **e-posta** ile bildirim gider; personel linke tıklayıp **kabul / red** edebilir."

### 3.7 AI Sohbet (45 sn) — **en interaktif kısım**
- "Sağ panelde sohbet kutusu. Türkçe veya İngilizce sor:"
- Örnek sorular (canlı yaz):
  - "Bugün şu ana kadar kaç kişi geldi?"
  - "Geçen haftaya göre cuma akşamı yoğunluğum nasıl?"
  - "Önümüzdeki 2 saat için kaç personel önerirsin?"
- "Yerel **Ollama qwen2.5:14b-8k** modeli yanıtlar. **Bulut yok, kart numarası yok, faturalandırma yok.** Hatta internet kesilse bile çalışır. Cloud fallback olarak Gemini opsiyonel."

### 3.8 AI Insights (Akıllı İçgörüler) (15 sn)
- "Cron her saat çalışır, geçmiş veriyi inceler ve **tahmin** üretir: ‘Yarın saat 14’te %30 yoğunluk artışı bekleniyor (geçen hafta + bu hafta hava durumu kombinasyonu).’"

### 3.9 Geçmiş & Trend & Export (15 sn)
- "Custom date range picker. Saat / gün / hafta / ay agregasyonu. **PDF + CSV** export, vergi memuruna ya da iç toplantıya hazır."

---

## 4. NASIL çalışıyor? (2 dk) — Mimari (sade anlatım)

> Slayt: 3 katmanlı diyagram (Frontend / Backend / Python AI)

Konuşma:

> "Üç servis tek bilgisayarda paralel çalışır:
>
> 1. **Frontend (React + Vite, port 5173)** — kullanıcı arayüzü; sadece tarayıcıda render eder.
> 2. **Backend (Node + Express + Prisma, port 3001)** — kullanıcı, şube, bölge, personel verisini SQLite'e yazar; AI proxy görevi görür.
> 3. **Python Camera Analytics (port 5001)** — asıl beyni; YOLO11L + InsightFace + MiVOLO + BoT-SORT pipeline’ı."

**Veri akışı (10 saniyede özetle):**

> Kamera → YOLO kişi tespiti → InsightFace yüz bulma → MiVOLO yaş/cinsiyet → BoT-SORT ID takibi → bölge geçişi tespit → WebSocket → Dashboard + SQLite

**Performans rakamları:**
- NVIDIA RTX 5070, TensorRT FP16, 23-26 FPS canlı inference
- Smooth mode (interpolated bbox) 60 FPS akıcı görüntü
- Gender lock 6 örnekte, age lock 20 örnek + 0.92 stability

**3 katmanlı pipeline (paralel thread):**
> Capture Thread → Inference Thread → Render/Emit Thread — birbirini tıkamıyor.

> "Önemli not: model dosyaları **lokalde**. Yüz fotoğrafı dışarı gitmiyor, müşteri verisi dışarı gitmiyor — KVKK ve GDPR’a doğal uyum."

---

## 5. Neyi NEDEN yapıyoruz? (1.5 dk) — Tasarım kararları

> Bu kısım jüri / yatırımcı için "biz teknolojiyi anlıyoruz" diyen bölüm. 4 karar yeterli.

### 5.1 Neden YOLO11**L** (büyük model) seçtik?
> "**L = Large.** Daha küçük versiyonu (n, s, m) %2-3 daha hızlı ama uzak yüzü kaçırıyor. RTX 5070’imiz var, hız problemi yok — doğruluk öncelikli."

### 5.2 Neden InsightFace **+ MiVOLO** birlikte (tek değil)?
> "InsightFace yüz **tespitinde** çok iyi ama yaş/cinsiyetinde değişken. MiVOLO ise **multi-input VOLO mimarisi** ile yaşta MAE çok düşük. Görev paylaşımı: InsightFace = ‘yüzü bul’, MiVOLO = ‘yaşı/cinsiyeti söyle’. İki modelin de iyi yaptığı işi yapmasını istedik."

### 5.3 Neden lokal Ollama, neden bulut LLM değil?
> "Üç sebep:
> 1. **Mahremiyet** — müşterimizin verisi mekanı terk etmesin.
> 2. **Maliyet** — token başı OpenAI/Gemini fiyatı aylık binlerce sorguda saçmalar.
> 3. **Hata toleransı** — internet kesilse de çalışsın. Gemini sadece fallback."

### 5.4 Neden masa state machine'i 4 state + 3 buffer?
> "Gerçek mekanda sandalye kayar (10 sn transit grace), birisi tuvalete gider (occlusion grace 3 sn), masa boşaltılır ama temizliği unutulur (2 dk buffer → temizlik uyarısı), uzun boş kalırsa otomatik unutulur (15 dk auto_empty). Kafede 1 hafta gözlem yaptık, parametreler **gerçek davranışa kalibre edildi**, masa üstünden geçen sinekten ID üretmeyecek şekilde."

---

## 6. NE HEDEFLİYORUZ? (1 dk) — Roadmap & Vizyon

> Slayt: "Bugün → 6 ay → 1 yıl"

**Bugün (v1.0.0 — release):**
- Tek mekan, tek/birkaç kamera, lokal kurulum
- Türkçe + İngilizce arayüz
- Email bildirimleri (Telegram product kararıyla pasifleştirildi — Yan #58)
- 157 PASS test, 0 TS hatası, 10 production-blocker bug kapatıldı

**6 ay sonrası (Faz 11+ backlog):**
- 4K kaynak performans optimizasyonu
- Test fixture infrastructure (mozart_cafe ground truth)
- Kullanıcı profili TopNavbar dropdown'a taşıma
- BranchSection card grid + accordion UX

**1 yıl vizyonu:**
- Çoklu lokasyon zincir mod (5+ şube karşılaştırma)
- POS entegrasyonu — ziyaretçi sayısı × ortalama sepet
- Self-service onboarding (kurulum sihirbazı, model otomatik indirme)
- Sektörel sürümler: market, perakende, eczane

> "Hedefimiz net: **Türkiye'nin küçük ve orta ölçekli mekanlarının kullandığı, açık ve şeffaf, yerel çalışan, bulutsuz yapay zeka asistanı.**"

---

## 7. Kapanış (30 sn) + Soru-Cevap

Kapanış:

> "ObservAI'da hiçbir veri mekanı terk etmiyor, hiçbir aylık abonelik yok, hiçbir API token bedeli yok. Mevcut kameranızla başlıyor, sadece bir GPU'lu mini PC ekliyorsunuz, ve bir hafta sonra mekanınızı saat saat tanımaya başlıyorsunuz. **Tahminle yönetmeyi bırakın, veriyle yönetin.**"

Anahtar tek cümle (jüri aklında kalsın):

> "Güvenlik kameranızı satış asistanına çeviriyoruz."

CTA:
- "GitHub: github.com/observaianeye/ObservAI"
- "Demo hesap: /demo route — 2 saat ücretsiz, kayıt gerektirmez"
- "Sorularınız?"

---

## Sunum Öncesi Checklist (5 dk önce)

- [ ] `start-all.bat` çalıştır — frontend (5173) + backend (3001) + camera-ai (5001) yeşil mi?
- [ ] Ollama servisi açık mı (qwen2.5:14b-8k yüklü)?
- [ ] Test kamerası bağlı (webcam veya iVCam)?
- [ ] Bir şube koordinatı + 1-2 kamera + 3-4 zone önceden hazır
- [ ] AI Chat sorularını test ettin mi (cevaplar geliyor mu)?
- [ ] Demo hesap login bilgileri elinde mi?
- [ ] Internet bağlantısı (hava durumu API + opsiyonel Gemini fallback)
- [ ] Ekran çözünürlüğü 1920x1080 (dashboard tam görünür)
- [ ] Tarayıcı temiz pencere, gereksiz tab kapalı
- [ ] Slack/email/discord bildirimleri sustur

## Süre Yönetimi (toplam 10 dk hedef)

| Bölüm | Süre | Toplam |
|---|---|---|
| 0. Açılış | 0:30 | 0:30 |
| 1. Neden | 1:30 | 2:00 |
| 2. Amaç | 1:00 | 3:00 |
| 3. Neleri sağlıyor | 3:00 | 6:00 |
| 4. Nasıl çalışıyor | 2:00 | 8:00 |
| 5. Neyi neden | 1:30 | 9:30 |
| 6. Hedef | 1:00 | 10:30 |
| 7. Kapanış | 0:30 | 11:00 |
| Q&A | 4:00 | 15:00 |

---

**Notlar:**
- Demo sırasında bir şey patlarsa **panik yok**: "Bu canlı bir sistem, hemen geçmiş veriyle devam edelim" diyip Historical sayfasına geç.
- Teknik soruda "yerel Ollama" + "lokal pipeline" + "GDPR uyumlu" cevapları çoğu endişeyi karşılar.
- Fiyat sorusu gelirse: "Lokal kurulum, lisans tek seferlik; bulut sürümü Faz 11 sonrası gündemde."
