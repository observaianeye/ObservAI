# ObservAI Frontend - Kullanım Kılavuzu

**Güncelleme Tarihi:** 16 Kasım 2025
**Durum:** İlk %20 Prototip Tamamlandı

## 📋 İçindekiler
1. [Kurulum](#kurulum)
2. [Çalıştırma](#çalıştırma)
3. [Demo vs Canlı Mod](#demo-vs-canlı-mod)
4. [Özellikler](#özellikler)
5. [Klasör Yapısı](#klasör-yapısı)
6. [Sorun Giderme](#sorun-giderme)

## 🚀 Kurulum

### Gereksinimler
- Node.js 18 veya üzeri
- npm veya pnpm

### Adımlar

1. **Bağımlılıkları yükleyin:**
```bash
cd frontend
npm install
```

2. **Ortam değişkenlerini ayarlayın:**

`.env` dosyası oluşturun (opsiyonel):
```env
VITE_API_URL=http://localhost:5001
VITE_WS_URL=ws://localhost:5001
VITE_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
VITE_SUPABASE_ANON_KEY=<your-key>
```

**Not:** Backend olmadan da çalışır! Demo modu için `.env` dosyası gerekli değil.

## ▶️ Çalıştırma

### Geliştirme Modunda Çalıştırma
```bash
npm run dev
```

Tarayıcınızda açın: http://localhost:5173

### Production Build
```bash
npm run build
npm run preview
```

### Type Checking
```bash
npm run typecheck
```

## 🎭 Demo vs Canlı Mod

### Demo Modu (Varsayılan)
- **Ne zaman kullanılır:** Backend hazır değilken, demo sunum yaparken
- **Özellikler:**
  - Gerçekçi kafe trafiği simülasyonu
  - Saate göre ziyaretçi sayısı değişir
  - Her 5 saniyede bir otomatik güncelleme
  - Backend bağlantısı gerektirmez

**Örnek Demo Verileri:**
- Sabah 7-9: 15-25 kişi (sabah yoğunluğu)
- Öğle 12-14: 18-30 kişi (öğle yoğunluğu)
- Akşam 17-20: 10-18 kişi
- Gece: 2-7 kişi

### Canlı Mod
- **Ne zaman kullanılır:** Backend API çalışırken, gerçek kamera verileri almak için
- **Özellikler:**
  - `http://localhost:5001` adresindeki backend'e bağlanır
  - WebSocket ile gerçek zamanlı veri alır
  - Backend yoksa "Kamera bağlı değil" mesajı gösterir

**Mod Değiştirme:**
Dashboard üst çubuğunda "Demo" / "Live" butonlarını kullanın.

## ✨ Özellikler

### ✅ Tamamlanmış (%20 Prototip)

#### 1. Giriş Yapma (UC-01)
- Email/şifre ile giriş
- Demo hesap desteği
- "Remember me" özelliği

**Demo Hesap:**
- Email: `admin@observai.com`
- Şifre: `demo1234`

**Dosya:** `src/pages/LoginPage.tsx`

#### 2. Analitik Dashboard (UC-02)
- Cinsiyet dağılımı grafiği (donut chart)
- Yaş dağılımı grafiği (bar chart)
- Ziyaretçi sayacı (anlık, giriş, çıkış)
- Ortalama kalış süresi widget'ı
- Demo/Canlı mod geçişi
- Otomatik yenileme

**Dosyalar:**
- `src/pages/dashboard/CameraAnalyticsPage.tsx`
- `src/components/camera/GenderChart.tsx`
- `src/components/camera/AgeChart.tsx`
- `src/components/camera/VisitorCountWidget.tsx`
- `src/components/camera/DwellTimeWidget.tsx`

#### 3. Bölge Etiketleme (UC-08)
- İnteraktif canvas üzerinde dikdörtgen çizme
- Giriş/çıkış bölgesi tanımlama
- Bölge isimlendirme ve düzenleme
- Görsel bölge overlay'i
- Kaydetme özelliği

**Dosyalar:**
- `src/pages/dashboard/ZoneLabelingPage.tsx`
- `src/components/camera/ZoneCanvas.tsx`

### 🏗️ Altyapı

#### Veri Servisi
**Dosya:** `src/services/analyticsDataService.ts`

Bu servis tüm analitik verileri yönetir:
- Demo veri sağlayıcı (gerçekçi kafe trafiği)
- Canlı veri sağlayıcı (backend API + WebSocket)
- Otomatik mod geçişi
- Hata yönetimi

#### Context Yönetimi
- `AuthContext`: Kimlik doğrulama
- `DataModeContext`: Demo/Canlı mod kontrolü

## 📁 Klasör Yapısı

```
frontend/
├── src/
│   ├── components/          # React bileşenleri
│   │   ├── camera/         # Kamera özellikleri
│   │   │   ├── GenderChart.tsx         # Cinsiyet grafiği
│   │   │   ├── AgeChart.tsx            # Yaş grafiği
│   │   │   ├── VisitorCountWidget.tsx  # Ziyaretçi sayacı
│   │   │   ├── DwellTimeWidget.tsx     # Kalış süresi
│   │   │   ├── ZoneCanvas.tsx          # Bölge çizimi
│   │   │   └── CameraFeed.tsx          # Kamera yayını
│   │   ├── layout/         # Layout bileşenleri
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopNavbar.tsx
│   │   ├── DataModeToggle.tsx  # Demo/Live toggle
│   │   └── ...
│   ├── contexts/           # React Context'leri
│   │   ├── AuthContext.tsx
│   │   └── DataModeContext.tsx
│   ├── services/           # Servisler
│   │   └── analyticsDataService.ts
│   ├── pages/              # Sayfalar
│   │   ├── HomePage.tsx
│   │   ├── LoginPage.tsx
│   │   └── dashboard/
│   │       ├── CameraAnalyticsPage.tsx
│   │       ├── ZoneLabelingPage.tsx
│   │       └── ...
│   ├── App.tsx
│   └── main.tsx
├── public/
├── package.json
└── vite.config.ts
```

## 🔧 Dosya Düzenleme Rehberi

### Grafik Verilerini Değiştirmek İçin
**Dosya:** `src/services/analyticsDataService.ts`

Demo veri üretimini burada bulabilirsiniz:
```typescript
class DemoDataProvider {
  getAnalyticsData(): AnalyticsData {
    // Burada demo verileri üretilir
  }
}
```

### Grafiğin Görünümünü Değiştirmek İçin
**Örnek:** Cinsiyet grafiğinin renklerini değiştirmek
**Dosya:** `src/components/camera/GenderChart.tsx`

```typescript
data: [
  { value: genderData.male, name: 'Male', itemStyle: { color: '#3b82f6' } },  // Mavi
  { value: genderData.female, name: 'Female', itemStyle: { color: '#ec4899' } } // Pembe
]
```

### Yeni Sayfa Eklemek İçin
1. `src/pages/dashboard/` altında yeni dosya oluşturun
2. `src/App.tsx` içine route ekleyin:
```typescript
<Route path="/dashboard/yeni-sayfa" element={
  <ProtectedRoute>
    <DashboardLayout><YeniSayfa /></DashboardLayout>
  </ProtectedRoute>
} />
```
3. `src/components/layout/Sidebar.tsx` içine menü öğesi ekleyin

## 🐛 Sorun Giderme

### Problem: "npm: command not found"
**Çözüm:** Node.js yükleyin: https://nodejs.org/

### Problem: Port 5173 zaten kullanılıyor
**Çözüm:**
```bash
npm run dev -- --port 3000
```

### Problem: Grafiklerde veri gösterilmiyor
**Kontroller:**
1. Demo modda mısınız? (Üst çubukta "Demo" butonu mavi olmalı)
2. Console'da hata var mı? (F12 → Console)
3. `npm run dev` düzgün çalışıyor mu?

### Problem: Canlı modda "No data" görünüyor
**Beklenen davranış:** Backend bağlı değilse bu normal!
**Çözüm:**
- Demo moda geçin, VEYA
- Backend'i başlatın (port 5001)

### Problem: Login çalışmıyor
**Çözüm:** Demo hesabı kullanın:
- Email: `admin@observai.com`
- Şifre: `demo1234`

Veya "Use Demo Account" butonuna tıklayın.

### Problem: TypeScript hataları
**Çözüm:**
```bash
npm run typecheck
```

Hataları göreceksiniz. Çoğu "unused variable" uyarısıdır, çalışmayı engellemez.

## 🎨 Stil Değişiklikleri

### Renk Paletini Değiştirmek
**Dosya:** `tailwind.config.js`

Projedeki ana renkler:
- **Mavi:** `blue-600` (#3b82f6) - Ana butonlar, linkler
- **Cyan:** `cyan-600` (#06b6d4) - Grafikler, vurgular
- **Yeşil:** `green-600` - Başarı mesajları
- **Kırmızı:** `red-600` - Hata mesajları, çıkış bölgeleri

### Font Boyutunu Değiştirmek
Tailwind class'larını kullanın:
- `text-sm`: Küçük (14px)
- `text-base`: Normal (16px)
- `text-lg`: Büyük (18px)
- `text-xl`: Daha büyük (20px)

## 📊 Demo Veri Detayları

### Yaş Dağılımı
- 0-17: %8 (çocuk/genç)
- 18-24: %25 (öğrenci)
- 25-34: %32 (genç profesyonel)
- 35-44: %18
- 45-54: %10
- 55-64: %5
- 65+: %2

### Cinsiyet Dağılımı
- Kadın: %49-55 (kafe ortalaması)
- Erkek: %45-51

### Ziyaretçi Trendi
Saate göre değişir:
- **Sabah rush (7-9):** Yüksek trafik
- **Öğle rush (12-14):** En yüksek trafik
- **Akşam (17-20):** Orta trafik
- **Gece:** Düşük trafik

## 🔗 Yararlı Linkler

- **Vite Dokümantasyonu:** https://vitejs.dev/
- **React Dokümantasyonu:** https://react.dev/
- **Tailwind CSS:** https://tailwindcss.com/
- **ECharts Örnekleri:** https://echarts.apache.org/examples/
- **Lucide Icons:** https://lucide.dev/

## 💡 İpuçları

1. **Hot Reload:** Kod değiştirdiğinizde sayfa otomatik yenilenir
2. **Console Kullanımı:** F12 → Console ile hata ayıklama yapın
3. **Component Değişiklikleri:** Bir component'i değiştirince sadece o component yenilenir
4. **Demo Veri:** Demo modda her 5 saniyede otomatik güncellenir
5. **TypeScript:** Type hatalarını görmek için `npm run typecheck` çalıştırın

## ⚡ Performans

Build boyutu:
- **Total:** ~1.5 MB (minified)
- **Gzipped:** ~400 KB
- **Ana chunk:** ECharts kütüphanesi (~1.1 MB)

**Not:** Bu boyut normal ve beklenendır çünkü ECharts güçlü bir grafik kütüphanesidir.

## 🎯 Sonraki Adımlar

Eğer geliştirme yapmaya devam edecekseniz:

1. **Backend Bağlantısı:** `src/services/analyticsDataService.ts` içindeki API URL'lerini güncelleyin
2. **Yeni Özellikler:** `src/pages/dashboard/` altına yeni sayfalar ekleyin
3. **Stil Değişiklikleri:** Tailwind class'larını kullanarak stilleri düzenleyin
4. **Test:** Her değişiklikten sonra `npm run build` ile test edin

## 📞 Destek

Sorularınız için:
- GitHub Issues açın
- Kod içindeki yorumları okuyun
- TypeScript type tanımlarına bakın (IntelliSense ile)

---

**Hazır mısınız? Hemen başlayın:**

```bash
npm install
npm run dev
```

Ardından http://localhost:5173 adresine gidin ve `admin@observai.com` / `demo1234` ile giriş yapın!

🎉 **Başarılar!**
