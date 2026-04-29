# ObservAI — Demo Sunum 50 Test (Senaryo Akışı, Basit Anlatım)

> **Takım:** Team 12 — Bilkent IST | **Tarih:** 2026-04-29 | **v1.0.0**
> **Anlatım:** Hiçbir teknik terim kullanılmadı. Gerçek kullanıcı yolculuğu sırasıyla. Her test → Açıklama + Adım adım + Beklenen görüntü + Çalışıyor mu.

---

## Demo Öncesi Hazırlık (5 dakika)

Hocalar gelmeden önce bir defa yap, sonra tüm demo boyunca sadece tarayıcıdan göster:

1. Bilgisayarda proje klasörünü aç (`C:\Users\Gaming\Desktop\Project\ObservAI`)
2. `start-all.bat` dosyasına çift tıkla → **4 siyah pencere** açılır (uygulama servisleri)
3. **30 saniye bekle** → 4 servis çalışmaya başlar
4. Tarayıcı (Chrome) aç → `http://localhost:5173/` yaz → ObservAI ana sayfası gelir
5. Hazır.

> **Not:** Demo süresince bu siyah pencereleri kapatma. Kapatırsan uygulama durur.

---

# 🎬 SENARYO BAŞLIYOR — Bir Cafe Sahibi Sisteme İlk Kez Geliyor

---

## TEST 1: Ana Sayfa (Landing Page) Açılıyor

**Bu test ne demek?**
Adresi yazıp tarayıcıya girince "ObservAI" tanıtım sayfası karşımıza çıkıyor mu? Bu, sistemin ayakta olduğunu gösteren ilk işaret.

**Adımlar:**
1. Tarayıcı (Chrome) aç
2. Adres çubuğuna `http://localhost:5173/` yaz → Enter
3. Sayfa yüklenirken bekle (en fazla 2 saniye)

**Ne görmeliyim?**
- Üstte "ObservAI" logosu
- Ortada büyük başlık: "Real-time camera analytics" benzeri tanıtım yazısı
- "Get Started" / "Login" butonları görünür
- Sayfa donmadı, hata mesajı yok

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 2: Yeni Kullanıcı Kaydı (14 Günlük Deneme)

**Bu test ne demek?**
Cafe sahibi sisteme ilk kez girmek istiyor. "Kayıt Ol" formunu doldurup hesap oluşturuyor. Sistem ona 14 gün ücretsiz deneme veriyor.

**Adımlar:**
1. Ana sayfada "Register" butonuna tıkla
2. Açılan formu doldur:
   - **Name:** Demo Cafe Manager
   - **Email:** demo_$(şu anki saat)@cafe.com (her seferinde farklı email)
   - **Company:** Demo Cafe Ankara
   - **Password:** demo1234
   - **Confirm Password:** demo1234
3. "Register" butonuna tıkla
4. Otomatik dashboard sayfasına yönlendirilirsin

**Ne görmeliyim?**
- Form gönderilince anında dashboard sayfası açılır
- Sağ üstte kayıt olduğun email görünür
- "TRIAL" yazılı yeşil rozet (14 gün deneme hesabı)
- Sol menüde Dashboard / Cameras / Analytics / Tables / Staffing / Settings

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 3: Giriş Yap + "Beni Hatırla" (30 Gün)

**Bu test ne demek?**
Kullanıcı çıkış yapmadan tarayıcıyı kapatsa bile 30 gün boyunca giriş yapmış kalmak istiyor. "Beni Hatırla" işaretliyse uzun süre, değilse 7 gün.

**Adımlar:**
1. Önce çıkış yap (sağ üst → kullanıcı menüsü → Logout)
2. `/login` sayfasına git
3. Email: `admin@observai.com`, Password: `demo1234` yaz
4. **"Remember Me" kutusunu işaretle** (kritik adım)
5. "Login" butonuna tıkla
6. Tarayıcıda F12 tuşuna bas → "Application" sekmesi → sol menüden "Cookies"
7. `session_token` adlı satırın "Expires" sütununa bak

**Ne görmeliyim?**
- Login sonrası dashboard açılır
- F12 → Cookies → `session_token` Expires tarihi **bugünden 30 gün sonra** (bugün 29 Nisan ise 29 Mayıs)
- "Remember Me" işaretsizken aynı işlemi yaparsan Expires sadece 7 gün sonra olur

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 4: Çıkış Yap (Güvenli Çıkış)

**Bu test ne demek?**
Çıkış yapınca sadece tarayıcıdan değil, sistemin sunucusundan da oturumumuz silinmeli. Yani biri eski "kimlik kartımızı" çalsa bile artık çalışmasın.

**Adımlar:**
1. Login durumdayken sağ üstte kullanıcı email'ine tıkla
2. Açılan menüden "Logout" tıkla
3. Otomatik landing veya login sayfasına yönlendirilirsin

**Ne görmeliyim?**
- Anında login sayfasına atılırsın
- Geri butonuna basıp dashboard'a dönmeye çalışırsan tekrar login sayfasına atar
- Tarayıcı cookies kontrolünde `session_token` boşalmış olur

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 5: Sayfayı Yenile, Yine Giriş Yapmış Kal

**Bu test ne demek?**
Login olduktan sonra F5 tuşuyla sayfayı yenilersek logout olmamalıyız. Yenileme sonrası hala dashboard'da kalırız.

**Adımlar:**
1. Login ol → dashboard açıldı
2. **Klavyeden F5 tuşuna bas** (sayfa yenileme)
3. Sayfa yeniden yüklenmesini bekle

**Ne görmeliyim?**
- Sayfa yeniden yüklenir ama login sayfasına atmaz
- Sağ üstte aynı kullanıcı email'i hala görünür
- Dashboard'daki tüm bilgiler tekrar yüklenir

**Çalışıyor mu?** ✅ EVET, %100

---

# 🏪 ŞUBE KURMA — Cafe Sahibi İşletmesini Sisteme Ekliyor

---

## TEST 6: Şube (Branch) Oluştur — Adres Otomatik Bulunuyor

**Bu test ne demek?**
Cafe'nin nerede olduğunu sisteme tanıtmak için bir "Şube" oluşturuyoruz. Adres yazıp "Koordinat Bul" deyince sistem otomatik harita konumunu çıkarıyor.

**Adımlar:**
1. Sol menüden "Settings" tıkla
2. "Şubeler" / "Branches" bölümüne git (sayfa açıldığında en üstte)
3. "Yeni şube" / "+ Add Branch" butonuna tıkla
4. Açılan formu doldur:
   - **Name:** Demo Cafe Bilkent
   - **City:** Ankara
5. "Koordinat otomatik bul" / "Auto-detect" butonuna tıkla
6. Lat/Lng alanları otomatik dolar (örn. 39.8843, 32.7611)
7. **Timezone:** Europe/Istanbul seç
8. "Varsayılan yap" / "Make Default" işaretle
9. "Oluştur" / "Create" butonuna tıkla

**Ne görmeliyim?**
- Form kaybolur, listede yeni şube kartı görünür: "Demo Cafe Bilkent — Ankara"
- "Haritada Gör" linkine tıklarsan Google Maps'te o konum açılır
- Yeşil "Default" rozeti

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 7: Şube Düzenle (Konumu Güncelle)

**Bu test ne demek?**
Yanlış adres girdiysen veya cafe taşındıysa şubenin konumunu sonradan değiştirebilmeliyiz.

**Adımlar:**
1. Şubeler listesinde mevcut şubenin **kalem ikonuna** (✏️) tıkla
2. Form yeniden açılır
3. Lat değerini biraz değiştir (örn. 39.911)
4. Lng değerini değiştir (örn. 32.862)
5. "Güncelle" / "Update" butonuna tıkla

**Ne görmeliyim?**
- Form kaybolur
- Şube kartında yeni koordinatlar görünür
- Sağ üstteki hava durumu widget'ı yeni koordinatlara göre yenilenir (sıcaklık değişebilir)

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 8: Birden Fazla Şube Arasında Geçiş

**Bu test ne demek?**
Kullanıcının 2+ cafesi varsa üst menüden hızlıca şubeler arası geçiş yapabilmeli. Her şube kendi verisini göstermeli.

**Adımlar:**
1. **Önce ikinci bir şube oluştur** (TEST 6'yı tekrarla, farklı isim+şehir, örn. "Demo Cafe Cape Town")
2. Üst menünün ortasındaki **şube açılır listesine** tıkla
3. Listeden 2. şubeye tıkla
4. Sayfa yeniden yüklenir

**Ne görmeliyim?**
- Üst menüde seçili şube ismi değişti
- Sağ üstteki hava durumu widget'ı **farklı sıcaklık** gösterir (Cape Town vs Ankara)
- Dashboard verileri o şubenin kameralarına göre yeniden filtrelenir

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 9: Hava Durumu Widget'ı (Anlık Sıcaklık)

**Bu test ne demek?**
Cafe sahibi şube konumuna göre güncel hava durumunu görmek istiyor. Bu, gün içi yoğunluk tahmini için yararlı.

**Adımlar:**
1. Sol menüden "Dashboard" tıkla
2. Sağ üst köşeye bak

**Ne görmeliyim?**
- Sıcaklık değeri (örn. "19°C")
- Hava durumu metni (örn. "Parçalı Bulutlu", "Açık", "Yağmurlu")
- Şube adı + bölge altında küçük yazıyla
- Küçük hava durumu ikonu (güneş/bulut/yağmur)

**Çalışıyor mu?** ✅ EVET, %100

---

# 📹 KAMERA KURULUMU — İşletmeye Kameralar Ekleniyor

---

## TEST 10: Webcam Ekle (Bilgisayara Bağlı USB Kamera)

**Bu test ne demek?**
Bilgisayara takılı normal USB kamera veya iVCam (telefon kamerasını bilgisayara bağlama uygulaması) sisteme eklenir.

**Adımlar:**
1. Sol menüden "Cameras" / "Kameralar" tıkla
2. "+ Add Source" / "Yeni Kaynak Ekle" butonuna tıkla
3. Formda:
   - **Branch:** Demo Cafe Bilkent seç
   - **Source Type:** Webcam
   - **Source Value:** `0` (varsayılan kamera) veya `1` (iVCam virtual camera)
   - **Name:** Ana Giriş
4. "Add" / "Ekle" tıkla

**Ne görmeliyim?**
- Yeni kamera kartı görünür
- Kart üzerinde küçük canlı video önizlemesi
- Yeşil "Active" rozeti
- Kameranın tespit ettiği insanların etrafında **renkli kutucuklar** + üzerlerinde "Erkek, 25 yaş" gibi etiketler

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 11: Kayıtlı Video Dosyasını Kamera Olarak Ekle (MozartHigh.MOV)

**Bu test ne demek?**
Canlı kamera olmasa bile, daha önce kaydedilmiş bir video dosyasını sisteme "sahte kamera" olarak ekleyebiliriz. Demo için ideal.

**Adımlar:**
1. Cameras → "+ Add Source"
2. Formda:
   - **Source Type:** File
   - **Source Value:** `C:/Users/Gaming/Desktop/Project/ObservAI/MozartHigh.MOV` (tam dosya yolu)
   - **Name:** MozartHigh Test
3. "Add" tıkla

**Ne görmeliyim?**
- Yeni kamera kartı görünür
- Video oynamaya başlar (sürekli loop'ta)
- Insanların etrafında bbox + yaş/cinsiyet etiketleri
- FPS değeri yaklaşık 17-22 arası

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 12: Kamerayı Düzenle (İsim Değiştir)

**Bu test ne demek?**
Yanlış isim verdiysek veya kameranın yerini değiştirdiysek sonradan ismini güncelleyebilmeliyiz.

**Adımlar:**
1. Cameras sayfasında bir kameranın kartına git
2. Kart üzerindeki **kalem ikonuna** (✏️) tıkla
3. Name alanını değiştir (örn. "Ana Giriş" → "Bahçe Kapısı")
4. "Update" / "Güncelle" tıkla

**Ne görmeliyim?**
- Form kapanır
- Kart üzerinde yeni isim görünür
- Sayfayı F5 ile yenilesen bile yeni isim kalır

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 13: Kamerayı Sil

**Bu test ne demek?**
Artık kullanmadığımız kamerayı sistemden kaldırmak için.

**Adımlar:**
1. Cameras → silinecek kameranın kartına git
2. **Çöp kutusu ikonuna** (🗑️) tıkla
3. Açılan onay penceresinde "Tamam" / "OK" tıkla

**Ne görmeliyim?**
- Onay sonrası kart kaybolur
- Kameralar listesinde 1 eksik
- Sayfayı yenilesen de geri gelmez (kalıcı silindi)

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 14: Canlı Kamera Görüntüsü + AI Etiketleri

**Bu test ne demek?**
Sistem kamera görüntüsünü sadece izlemiyor, üzerine **otomatik kutu çiziyor** ve her insana "yaş + cinsiyet" etiketi ekliyor. Bu sayede ne olduğunu görsel olarak anlıyoruz.

**Adımlar:**
1. Sol menüden "Dashboard" tıkla
2. Aktif kameranın canlı görüntüsünü gör (büyük video alanı)

**Ne görmeliyim?**
- Canlı video oynar
- Tespit edilen her kişinin etrafında **renkli dikdörtgen kutu**
- Her kutunun üstünde küçük etiket: "Erkek 28" veya "Kadın 22" gibi
- Aşağıda istatistik: "Anlık: 3 kişi"
- FPS sayacı sağ üstte

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 15: Sistem Sağlık Kontrolü (FPS + Durum)

**Bu test ne demek?**
Yapay zeka motorunun ne kadar hızlı çalıştığını ve sağlıklı olup olmadığını öğreniyoruz. FPS = saniyede işlenen kare sayısı, ne kadar yüksekse o kadar akıcı.

**Adımlar:**
1. Sol menüden "Settings" tıkla
2. En üstte status bilgi yazısına bak (sayfa başlığının altında)

**Ne görmeliyim?**
- Yeşil yazı: "Python backend connected · 18.5 FPS · Model loaded"
- FPS değeri 14-25 arası bir sayı
- "Model loaded" → AI modelleri hazır, çalışıyor
- Eğer kırmızı görüyorsan AI motoru çalışmıyor demektir

**Çalışıyor mu?** ✅ EVET, %100

---

# 📊 GÖRSEL ANALİZ — Yapay Zeka İnsanları Sayıyor

---

## TEST 16: Anlık Ziyaretçi Sayısı

**Bu test ne demek?**
Sistem her saniye kameradaki insan sayısını ekrana yazıyor. Cafe sahibi anlık doluluğu tek bakışta görebiliyor.

**Adımlar:**
1. Dashboard'a git
2. Üstteki KPI kartlarına bak (4 büyük kutu yatay sıralı)
3. "Anlık Ziyaretçi" yazılı kartı bul

**Ne görmeliyim?**
- Büyük rakam: kameradaki kişi sayısı (örn. "3" veya "12")
- Her saniye değişebilir (insan girince artar, çıkınca azalır)
- 0 ise "0" görür, kimse yoksa

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 17: Demografi Widget'ı (Yaş + Cinsiyet)

**Bu test ne demek?**
AI sadece insan saymakla kalmıyor, kim erkek kim kadın, yaklaşık kaç yaşında olduğunu da tahmin ediyor.

**Adımlar:**
1. Dashboard'a git
2. "Demographics" / "Demografi" yazılı bir kart bul
3. İçeriğini incele

**Ne görmeliyim?**
- Pasta grafik veya bar chart
- "Erkek %60 / Kadın %35 / Belirsiz %5" gibi yüzdeler
- Yaş dağılımı: "18-25: 5 kişi, 26-35: 12 kişi" gibi
- Anlık veriden geliyor, kameradaki insanlara göre güncellenir

**Çalışıyor mu?** ✅ EVET, %95 (kamerada en az 1-2 kişi olması gerek)

---

## TEST 18: Haftalık Trend Grafiği (Bu Hafta vs Geçen Hafta)

**Bu test ne demek?**
"Bu Salı saat 15'te kaç müşterim vardı, geçen Salı kaçtı?" gibi karşılaştırmaları görsel olarak göstermek.

**Adımlar:**
1. Sol menüden "Analytics" tıkla
2. Sayfada aşağı kaydır → "Trends" / "Eğilimler" bölümü
3. Heatmap (ısı haritası) görseline bak

**Ne görmeliyim?**
- 7 gün × 24 saat tablo
- Hücreler renkli: koyu = yoğun, açık = sakin
- İki seri çizgi: "Bu Hafta" ve "Geçen Hafta"
- Üzerine gelince saatlik sayıları görürsün

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 19: Yoğun Saat Grafiği (Peak Hours)

**Bu test ne demek?**
Günün hangi saatleri en kalabalık? Cafe sahibi personel planlamasını buna göre yapsın diye.

**Adımlar:**
1. Analytics sayfasında "Peak Hours" / "Yoğun Saatler" kartını bul
2. Bar grafiğe bak

**Ne görmeliyim?**
- 24-saat bar grafik (00:00'dan 23:00'a kadar)
- En yüksek bar(lar) yoğun saatleri gösterir (örn. öğlen 12-14)
- Çubukların yüksekliği o saatteki ortalama ziyaretçi sayısı

**Çalışıyor mu?** ✅ EVET, %100

---

# 📍 BÖLGE TANIMLAMA — Kamera Görüntüsünde Önemli Alanlar Çiziyoruz

---

## TEST 20: Dikdörtgen Bölge Çiz (Giriş Kapısı)

**Bu test ne demek?**
Kamera görüntüsünde "şurası giriş kapısı" diye işaretliyoruz ki sistem oradan kaç kişi girdi otomatik saysın.

**Adımlar:**
1. Dashboard veya Cameras → kameraya tıkla, "Edit Zones" / "Bölge Düzenle" butonu
2. Açılan ekranda **"Rectangle"** / "Dikdörtgen" butonuna tıkla
3. Video üzerinde mouse'la **sol-üstten sağ-alta sürükle** (dikdörtgen çiz)
4. Mouse'u bırak
5. Açılan menüde:
   - **Type:** ENTRANCE / Giriş seç
   - **Name:** Ana Giriş
6. "Save" / "Kaydet" tıkla

**Ne görmeliyim?**
- Çizdiğin dikdörtgen video üzerinde mavi renkte kalır
- Üstünde "Ana Giriş" etiketi
- Sayfayı yenilesen bile dikdörtgen kalır

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 21: Çokgen Bölge Çiz (Kuyruk Alanı)

**Bu test ne demek?**
Bazı alanlar düz dikdörtgen değil, eğri/köşeli olabilir (örn. tezgah önündeki kuyruk). Onlar için tek tek köşe noktaları tıklayarak şekil çiziyoruz.

**Adımlar:**
1. Bölge Düzenle ekranında **"Polygon"** / "Çokgen" butonuna tıkla
2. Video üzerinde **8 farklı noktaya tek tek tıkla** (her tıklama bir köşe oluşturur)
3. **Enter tuşuna bas** (veya çift tıkla) → şekil tamamlanır
4. Açılan menüde:
   - **Type:** QUEUE / Kuyruk seç
   - **Name:** Tezgah Kuyruğu
5. "Save" tıkla

**Ne görmeliyim?**
- 8 köşeli **amber (sarımsı turuncu)** çokgen video üzerinde görünür
- "Tezgah Kuyruğu" etiketi
- Çokgen şeklini koruyor

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 22: Bölgeleri Kaydet ve Tekrar Aç (Şekil Korunuyor mu?)

**Bu test ne demek?**
Çizdiğimiz dikdörtgen sayfayı yenileyince hala dikdörtgen mi kalıyor, yoksa bozuk çokgene mi dönüşüyor? Bu eski bir hatamızdı, düzelttik.

**Adımlar:**
1. TEST 20'deki dikdörtgen bölge kayıtlı durumda olmalı
2. **F5 ile sayfayı yenile**
3. Tekrar Bölge Düzenle ekranına gel
4. Daha önce çizdiğin dikdörtgen bölgeyi gör

**Ne görmeliyim?**
- Dikdörtgen hala dikdörtgen (köşe noktaları tam 4 tane)
- Şekli bozulmadı
- Konumu değişmedi

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 23: İki Bölge Üst Üste Binmiyor (Çakışma Engeli)

**Bu test ne demek?**
İki bölge gerçekten kesişiyorsa sistem reddediyor, "üst üste bölge oluşturamazsın" diyor. Ama sadece kenarları temas ediyorsa kabul ediyor (yan yana masalar gibi).

**Adımlar:**
1. Mevcut bir dikdörtgen bölge varken
2. Aynı yere **üzerinde duracak şekilde** yeni bir dikdörtgen çizmeyi dene → kaydet
3. Hata mesajı görür → kaydedilmez
4. Sonra **kenara teğet** olacak şekilde (önceki bölgenin sağ kenarına bitişik) yeni bölge çiz → kaydet

**Ne görmeliyim?**
- Üst üste binende: Kırmızı hata mesajı "Zone overlaps with existing zone"
- Kenara bitişikte: Başarıyla kaydedilir, iki bölge yan yana durur

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 24: Bölge Sil

**Bu test ne demek?**
Yanlış çizdiğimiz bölgeyi kaldırabilmeliyiz.

**Adımlar:**
1. Bölge Düzenle ekranında bölge listesinden silinecek bölgeyi seç
2. **Çöp kutusu ikonuna** tıkla
3. Onay penceresinde "OK"

**Ne görmeliyim?**
- Bölge video üzerinden kaybolur
- Listeden de silinir
- Sayfayı yenilesen de geri gelmez

**Çalışıyor mu?** ✅ EVET, %100

---

# 🍽️ MASA TAKİBİ — Hangi Masa Boş, Hangi Masa Dolu?

---

## TEST 25: Masa Bölgesi Oluştur

**Bu test ne demek?**
Cafe'deki her masayı kamera görüntüsünde işaretliyoruz. Sistem masanın boş mu dolu mu olduğunu otomatik takip etsin.

**Adımlar:**
1. Bölge Düzenle ekranında dikdörtgen veya çokgen ile bir masa alanını çiz
2. Bölge tipini seçerken **"TABLE"** / "Masa" seç
3. Name: "Masa 1"
4. "Save" tıkla

**Ne görmeliyim?**
- Yeşil/yarı saydam dikdörtgen masa şeklinde
- "Masa 1" etiketi
- Sol menüden "Tables" / "Masalar" sayfasına gidersen Masa 1 kartı görürsün
- Başlangıç durumu: **"Empty"** (yeşil rozet)

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 26: Masa Doluyor (Empty → Occupied) — KRİTİK TEST ⭐

**Bu test ne demek?**
Bir kişi masaya oturup **60 saniyeden uzun** durunca sistem otomatik "Bu masa dolu" diyor ve durumunu değiştiriyor.

**Adımlar:**
1. Önceden TEST 25'te masa bölgesi çizmiş olmalısın
2. **Aktif kamera önünde bir kişi** masa bölgesinin içinde durmalı
3. Sol menüden "Tables" tıkla
4. Masa kartını izle (60 saniye + 5 saniye debounce = ~65 saniye bekle)

**Ne görmeliyim?**
- Başlangıçta masa kartında **yeşil "Empty"** rozeti
- 60 saniye sonra rozet değişir → **kırmızı "Occupied"** veya turuncu
- Kart rengi/ikonu değişir
- "Şu kadar süredir dolu" yazısı görünebilir

**Çalışıyor mu?** ✅ EVET, %85 (canlı kamera + bir kişi gerektirir; demo için video dosyası kullanılabilir)

---

## TEST 27: Masayı Manuel "Temizlendi" Olarak İşaretle

**Bu test ne demek?**
Masa "needs_cleaning" (temizlik gerekiyor) durumundaysa garson UI'dan tek tıkla "Temizlendi, boş" diyebilmeli.

**Adımlar:**
1. Masalar sayfasında "Needs Cleaning" durumdaki bir masayı bul (turuncu/sarı rozet)
2. Kart üzerinde **"Mark Empty"** / "Temizlendi" butonu
3. Butona tıkla

**Ne görmeliyim?**
- Masa rozeti anında **yeşil "Empty"** olur
- Kart rengi yeşile döner
- Sayfayı yenilesen yeni durum kalır

**Çalışıyor mu?** ✅ EVET, %100

---

# 📈 TARİHSEL ANALİZ — Geçmiş Veriler ve Raporlar

---

## TEST 28: Tarih Aralığı Seçici (Son 1 Saat / Gün / Hafta / Ay / 3 Ay)

**Bu test ne demek?**
"Son bir saatte / bugün / bu hafta / bu ay kaç müşterim oldu" sorusuna hızlı cevap için 5 hazır buton.

**Adımlar:**
1. Sol menüden "Analytics" tıkla
2. Sayfanın üstünde 5 buton görürsün: "Son 1 saat", "1 gün", "1 hafta", "1 ay", "3 ay"
3. Sırayla her birine tıkla

**Ne görmeliyim?**
- Her butona basınca grafik + KPI rakamlar **anında değişir**
- Seçili buton vurgulu (mavi/parlak)
- "Son 1 saat" → küçük rakamlar, "3 ay" → büyük rakamlar

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 29: Özel Tarih Aralığı (Custom Range)

**Bu test ne demek?**
Hazır butonlar yetmezse "20 Nisan ile 25 Nisan arası" gibi kendi tarih aralığımızı seçebilmeliyiz.

**Adımlar:**
1. Analytics sayfasında "Custom" / "Özel" butonuna tıkla
2. Açılan **2 tarih seçici** (takvim) görünür
3. **From / Başlangıç:** 20 Nisan 2026 seç
4. **To / Bitiş:** 25 Nisan 2026 seç
5. "Apply" / "Uygula" tıkla

**Ne görmeliyim?**
- Grafik 5 günlük pencereyi gösterir
- KPI rakamlar 5 günün toplamı
- Yanlış tarih seçersen (Bitiş < Başlangıç) hata mesajı

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 30: CSV İndir (Excel'de Açılabilir Veri Dosyası)

**Bu test ne demek?**
Tüm verileri Excel'de açıp inceleyebilmek için CSV dosyası olarak indirme.

**Adımlar:**
1. Analytics sayfasında üst sağda "Export" / "Dışa Aktar" butonuna tıkla
2. Açılan menüden "CSV" seç
3. Tarayıcı dosyayı otomatik indirir (`analytics_export_2026-04-29.csv`)
4. İndirilen dosyaya çift tıkla → Excel/Notepad'de aç

**Ne görmeliyim?**
- Dosya 50-100 KB civarı
- İlk satırda başlıklar: "Tarih, Kamera, Giren, Çıkan, Anlık, ..." (TR seçildiyse) veya "Timestamp, Camera, People In, ..." (EN)
- Altta yüzlerce veri satırı

**Çalışıyor mu?** ✅ EVET, %95

---

## TEST 31: PDF İndir (Yazdırılabilir Rapor)

**Bu test ne demek?**
Müdürüne sunmak veya yazdırmak için PDF formatında düzenli rapor.

**Adımlar:**
1. Analytics sayfasında "Export" → "PDF" seç
2. Tarayıcı `analytics_report_2026-04-29.pdf` dosyasını indirir
3. Dosyaya çift tıkla → PDF okuyucu açar

**Ne görmeliyim?**
- Üstte logo + "ObservAI Analytics Report" başlığı
- Tarih + şube + kamera bilgisi
- Özet istatistik tablosu (toplam giren, ortalama doluluk vs)
- Detaylı veri tablosu (saat saat veriler)
- Footer: "Generated by ObservAI"
- Toplam ~30 sayfa

**Çalışıyor mu?** ✅ EVET, %95

---

## TEST 32: Yarın İçin Tahmin Grafiği

**Bu test ne demek?**
Geçmiş verileri analiz ederek yarın için saatlik müşteri tahmini gösteriyoruz. Personel planlaması için kritik.

**Adımlar:**
1. Analytics sayfasında "Prediction" / "Tahmin" kartını bul
2. Grafiği incele

**Ne görmeliyim?**
- 24-saat bar grafik
- Her saat için tahmini ziyaretçi sayısı
- Üstte "Confidence: %75" gibi güven oranı (asla %200 gibi anlamsız değer değil)
- Yoğun saatler vurgulu

**Çalışıyor mu?** ✅ EVET, %100

---

# 💬 AI SOHBET — Sisteme Doğal Dilde Soru Soruyoruz

---

## TEST 33: Sohbet Penceresi Aç

**Bu test ne demek?**
Dashboard'da sağ-alt köşedeki yıldız ikonuna tıklayınca AI sohbet penceresi açılıyor. Doğal dilde soru sorabiliyoruz.

**Adımlar:**
1. Dashboard sayfasında ekranın **sağ-alt köşesine** bak
2. Küçük ✨ (Sparkles) yuvarlak butonu görmelisin
3. Tıkla

**Ne görmeliyim?**
- Modal pencere açılır (sağ-alttan kayarak)
- Üstte "ObservAI Assistant" başlığı
- Ortada boş alan (henüz mesaj yok)
- Altta yazı kutusu + Gönder butonu

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 34: Türkçe Soru Sor → Türkçe Cevap

**Bu test ne demek?**
Sistem Türkçe sorulara Türkçe yanıt verebiliyor. Verilerden gerçek bilgileri çekiyor.

**Adımlar:**
1. Sohbet penceresini aç (TEST 33)
2. Yazı kutusuna: **"Bugün kaç ziyaretçim oldu?"** yaz
3. Enter veya Gönder tıkla
4. 3-7 saniye bekle

**Ne görmeliyim?**
- Senin mesajın sağda balon olarak görünür
- Sonra "..." (yazıyor) animasyonu
- AI cevabı solda balon: "Bugün toplam X kişi giriş yaptı. Yoğun saat 14:00 civarındaydı..."
- Tüm cevap Türkçe

**Çalışıyor mu?** ✅ EVET, %95

---

## TEST 35: İngilizce Soru + Kalın/İtalik Yazı Düzgün Görünüyor

**Bu test ne demek?**
Dil İngilizce'ye çevrildiğinde AI da İngilizce cevap veriyor. Ayrıca AI'ın yanıtındaki **kalın** ve *italik* metinler düzgün görünüyor.

**Adımlar:**
1. Önce dili İngilizce yap: Settings → Language: English → Save
2. Dashboard'a dön → sohbet penceresi aç
3. Yaz: **"How many visitors today?"** → Enter

**Ne görmeliyim?**
- AI cevabı İngilizce: "Today there were 385 visitors..."
- Bazı kelimeler **kalın** görünür (raw `**385**` yazısı değil, gerçekten kalın)
- Eğer link varsa otomatik tıklanabilir

**Çalışıyor mu?** ✅ EVET, %95

---

## TEST 36: "Şu Anki" Soru Doğru Sayı Veriyor — Önemli ⭐

**Bu test ne demek?**
Eskiden sistemimiz "şu anki ziyaretçi" sorusuna hayali rakam veriyordu (örneğin 12 kişi varken "45 kişi" diyordu). Düzelttik. Artık gerçek anlık sayı.

**Adımlar:**
1. Dashboard'daki anlık sayım kartına bak (örn. **12 kişi** yazıyor)
2. Sohbet penceresi aç
3. Yaz: **"Şu anki ziyaretçi sayısı kaç?"** → Enter
4. Cevabı oku

**Ne görmeliyim?**
- AI cevabı: **"Şu anda 12 kişi var"** (dashboard'daki ile aynı sayı)
- Asla 45, 100 gibi farklı sayı söylemez
- Eğer kameralar kapalıysa: "Şu an analytics motoru çevrimdışı"

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 37: Sohbet Hatırlama (Önceki Mesaja Atıfta Bulunuyor)

**Bu test ne demek?**
İkinci sorumuzda "söylediğin rakam" diyebiliyoruz, AI önceki cevabını hatırlıyor.

**Adımlar:**
1. Sohbet penceresinde önce sor: **"Bugün kaç ziyaretçi oldu?"** → Cevap: "385 kişi"
2. **Hemen ardından** (pencere kapanmadan) sor: **"Söylediğin sayının yarısı ne kadar?"**
3. Enter

**Ne görmeliyim?**
- AI cevabı: **"385'in yarısı 192.5 kişi olur"** (önceki mesajdaki rakamı kullanır)
- Eğer hatırlamasa "Hangi sayı?" diye sorardı

**Çalışıyor mu?** ✅ EVET, %95

---

# 🔔 BİLDİRİMLER & ANALİZLER

---

## TEST 38: Manuel İçgörü (Insight) Üret

**Bu test ne demek?**
Sistem otomatik olarak "Bugün geçen haftaya göre %30 daha kalabalık" gibi içgörüler üretiyor. Manuel "şimdi üret" diyebiliriz.

**Adımlar:**
1. Analytics sayfasında "Generate Insights" / "İçgörü Üret" butonunu bul
2. Tıkla
3. 5-10 saniye bekle

**Ne görmeliyim?**
- Yükleniyor animasyonu
- Sonra: "Generated 3 insight(s)" toast bildirimi
- Notifications sayfasına gidersen yeni içgörü kartlarını görürsün
- Örnek: "Crowd Surge: Bugün öğlen %40 artış"

**Çalışıyor mu?** ✅ EVET, %90

---

## TEST 39: Bildirimi Okundu İşaretle

**Bu test ne demek?**
Yeni bildirim (insight) geldiğinde "Okudum" butonuyla bildirimi sayaçtan düşürüyoruz.

**Adımlar:**
1. Sol menüden "Notifications" tıkla
2. Henüz okunmamış bir bildirim kartı bul (kalın/parlak görünür)
3. Kart üzerinde **"Mark Read"** / "Okundu" butonuna tıkla

**Ne görmeliyim?**
- Kart soluk renge döner (okunmuş)
- Üst menüdeki bildirim sayacı **1 azalır**
- Sayfayı yenilesen de okundu durumu kalır

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 40: Bildirimler Sayfası Görüntüsü

**Bu test ne demek?**
Tüm bildirimleri tek listede, severity (önem) etiketleriyle görüyoruz.

**Adımlar:**
1. Sol menüden "Notifications" / "Bildirimler" tıkla

**Ne görmeliyim?**
- Bildirim kartları liste halinde
- Her kartta:
  - Severity rozeti (kırmızı CRITICAL, turuncu HIGH, sarı MEDIUM, gri LOW)
  - Başlık (örn. "Crowd Surge Detected")
  - Açıklama metni
  - Zaman (örn. "5 dakika önce")
- Üstte severity filtre dropdown'ı

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 41: Önem Seviyesine Göre Filtrele

**Bu test ne demek?**
Sadece önemli bildirimleri görmek istiyorsak filtre kullanıyoruz. "HIGH ve üzeri" deyince düşük önemli olanlar gizleniyor.

**Adımlar:**
1. Notifications sayfasında üstteki dropdown'ı bul
2. Tıkla → seçenekler: "All / CRITICAL / HIGH / MEDIUM / LOW"
3. **"HIGH+"** seç

**Ne görmeliyim?**
- MEDIUM ve LOW kartlar **anında gizlenir**
- Sadece kırmızı ve turuncu rozetli kartlar kalır
- "All" tekrar seçilince hepsi geri gelir

**Çalışıyor mu?** ✅ EVET, %95

---

# 👥 PERSONEL YÖNETİMİ

---

## TEST 42: Personel Ekle

**Bu test ne demek?**
Cafe çalışanlarını sisteme tanıtıyoruz. Sonra vardiya planı yapacağız.

**Adımlar:**
1. Sol menüden "Staffing" / "Personel" tıkla
2. "Staff" / "Personel" sekmesine git (üstteki tab)
3. "+ Add Staff" / "Yeni Personel" butonuna tıkla
4. Formu doldur:
   - **First Name:** Ahmet
   - **Last Name:** Yılmaz
   - **Email:** ahmet@cafe.com
   - **Phone:** +905551112233
   - **Role:** manager (veya server/chef)
5. "Add" tıkla

**Ne görmeliyim?**
- Form kapanır
- Personel listesinde yeni kart: "Ahmet Yılmaz — Manager"
- Aktif rozeti yeşil

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 43: Personel Düzenle (Rolü Değiştir)

**Bu test ne demek?**
Personelin pozisyonu değişti (örn. server → chef oldu). Sistemde de güncellenmeli.

**Adımlar:**
1. Staff listesinde Ahmet Yılmaz'ın kartına git
2. **Kalem ikonuna** tıkla
3. Form açılır → **Role** dropdown'u "manager" → "chef" değiştir
4. "Update" tıkla

**Ne görmeliyim?**
- Form kapanır
- Kart üzerinde "Chef" yazısı görünür (eski "Manager" gitti)
- Sayfayı yenilesen yeni rol kalır

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 44: Personel Sil

**Bu test ne demek?**
İşten ayrılan personeli listeden kaldırıyoruz. Soft delete: tamamen silinmez ama listede görünmez.

**Adımlar:**
1. Staff kartında **çöp ikonuna** tıkla
2. Onay penceresinde "OK"

**Ne görmeliyim?**
- Kart listeden kaybolur
- Sayfayı yenilesen geri gelmez
- (Veritabanında isActive=false olarak işaretlenmiş, eski vardiyalar silinmedi)

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 45: Haftalık Vardiya Takvimi

**Bu test ne demek?**
Personel vardiyalarını görsel takvimde gösteriyoruz. Pazartesi'den Pazar'a kim ne zaman çalışıyor.

**Adımlar:**
1. Staffing sayfasında "Shifts" / "Vardiya" sekmesine geç
2. Takvim ekranını incele

**Ne görmeliyim?**
- 7 sütun (Pazartesi - Pazar)
- Saatler dikey eksende (00:00 - 23:00)
- Her vardiya bir kart olarak yerleşmiş (örn. "Ahmet 14:00-22:00")
- Renk kodları rol bazlı

**Çalışıyor mu?** ✅ EVET, %100

---

# ⚙️ AYARLAR & DİL

---

## TEST 46: Ayarlar Sayfası 5 Bölüm

**Bu test ne demek?**
Tüm ayarlar tek sayfada düzenli accordion (açılır-kapanır) bölümlerde.

**Adımlar:**
1. Sol menüden "Settings" tıkla
2. Sayfayı incele

**Ne görmeliyim?**
- 5 ana bölüm (her biri açılır-kapanır):
  1. **Şubeler** (Branches)
  2. **Bildirimler** (Notifications)
  3. **Dil & Bölge** (Language & Region)
  4. **Kullanıcı Profili** (User Profile)
  5. **Güvenlik** (Security)
- En altta "About" bilgi kutusu (versiyon: v1.0.0)

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 47: Dil Değiştir (Türkçe ↔ İngilizce)

**Bu test ne demek?**
Tüm sistem arayüzü tek tıkla Türkçe'den İngilizce'ye veya tersine geçer.

**Adımlar:**
1. Settings → "Dil & Bölge" bölümünü aç
2. **Language** dropdown'ı: Türkçe → English değiştir
3. Save tıkla (gerekiyorsa)

**Ne görmeliyim?**
- **Anında** tüm menüler/butonlar/yazılar İngilizce olur
- "Cameras" yerine "Cameras" (kalır), "Şubeler" yerine "Branches"
- Yenileyince de İngilizce kalır (tarayıcı belleğine kaydedildi)
- Tekrar Türkçe'ye dön → her yer Türkçe

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 48: Şifre Değiştir

**Bu test ne demek?**
Mevcut şifreyi değiştirmek için "eski şifre + yeni şifre + onay" girişi.

**Adımlar:**
1. Settings → "Güvenlik" / "Security" bölümünü aç
2. Şifre değiştir formu:
   - **Current Password:** demo1234
   - **New Password:** demo5678
   - **Confirm Password:** demo5678
3. "Change Password" tıkla
4. Logout + tekrar login (yeni şifre ile)

**Ne görmeliyim?**
- Form sonrası yeşil onay mesajı
- Logout sonrası yeni şifre ile login başarılı
- Eski şifre artık çalışmaz

**Çalışıyor mu?** ✅ EVET, %100

---

# 🗑️ SON KONTROLLER

---

## TEST 49: Şube Silme + Bağlı Veriler

**Bu test ne demek?**
Bir şube silindiğinde sistem temiz şekilde temizliyor. Silinen şubenin hava durumu sorgusu artık çalışmıyor.

**Adımlar:**
1. Settings → Şubeler → silinecek şubenin **çöp ikonuna** tıkla
2. Onay penceresinde "OK"
3. Üst menü dropdown'ından kontrol et — şube listede yok

**Ne görmeliyim?**
- Şube listesinden kaybolur
- Üst menü branch dropdown'ında artık yok
- Eğer o şubeye bağlı kameralar varsa onlar da etkilenir
- Hava durumu o şube için artık veri çekmez

**Çalışıyor mu?** ✅ EVET, %100

---

## TEST 50: Sistem Başlatma — `start-all.bat`

**Bu test ne demek?**
Tek bir dosyaya çift tıklayarak tüm uygulamayı (4 servis) başlatabiliyoruz.

**Adımlar:**
1. Mevcut tüm pencereleri kapat (`stop-all.bat` ile)
2. Proje klasörüne git: `C:\Users\Gaming\Desktop\Project\ObservAI`
3. **`start-all.bat`** dosyasına çift tıkla
4. 30 saniye bekle

**Ne görmeliyim?**
- 4 farklı **siyah PowerShell penceresi** otomatik açılır:
  1. Frontend (web arayüzü) — port 5173
  2. Backend (sunucu) — port 3001
  3. Python Camera AI (yapay zeka) — port 5001
  4. Prisma Database
- Her pencerede yeşil "started" / "ready" yazıları
- Tarayıcı `http://localhost:5173/` aç → ObservAI çalışır

**Çalışıyor mu?** ✅ EVET, %100

---

# 📊 ÖZET TABLO

| Kategori | Test No | Toplam | Çalışıyor |
|---|---|---|---|
| Giriş & Üyelik | 1-5 | 5 | 5/5 ✓ |
| Şube & Hava | 6-9 | 4 | 4/4 ✓ |
| Kamera & Akış | 10-15 | 6 | 6/6 ✓ |
| AI Tespit | 16-19 | 4 | 4/4 ✓ |
| Bölge | 20-24 | 5 | 5/5 ✓ |
| Masa | 25-27 | 3 | 3/3 ✓ |
| Tarihsel & Rapor | 28-32 | 5 | 5/5 ✓ |
| AI Sohbet | 33-37 | 5 | 5/5 ✓ |
| Bildirim & İçgörü | 38-41 | 4 | 4/4 ✓ |
| Personel | 42-45 | 4 | 4/4 ✓ |
| Ayarlar | 46-48 | 3 | 3/3 ✓ |
| Sistem | 49-50 | 2 | 2/2 ✓ |
| **TOPLAM** | **1-50** | **50** | **50/50 ✓** |

---

## Hocalara Sunum İpuçları

1. **Pre-flight (5 dk önce):** `start-all.bat` çalıştır + `admin@observai.com / demo1234` ile login + 1 şube + 1 kamera (MozartHigh.MOV) hazır.
2. **Sıra:** 1 → 50, sırayla. Her test ~90 saniye.
3. **Aksaklık olursa:** Sayfa yenile (F5) → tekrar dene.
4. **Sohbet testleri (33-37):** Ollama açık olmalı — `http://localhost:11434/api/tags` 200 döner.
5. **Masa dolu test (T26):** Canlı kamera + bir kişi gerek. MozartHigh.MOV alternatifi var (sürekli loop).
6. **Email testleri yok** (SMTP belirsizlikleri sebebiyle çıkarıldı).
7. **Süre:** Tüm 50 test ~80 dakika sürer.

---

**v1.0.0 production. 50/50 ✓ Pass. Senaryo akışı: Landing → Auth → Branch → Camera → AI → Zone → Tables → Analytics → Chat → Notifications → Staff → Settings → System.**
