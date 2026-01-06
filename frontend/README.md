# Frontend - ObservAI Web Arayüzü

Bu klasör, ObservAI kamera analitik platformunun kullanıcı arayüzünü içerir.

## İçerik

Bu klasörde şunlar bulunur:
- **React + TypeScript** ile yazılmış modern web uygulaması
- **Tailwind CSS** ile stillendirilmiş responsive arayüz
- **ECharts** ile canlı veri görselleştirmeleri
- **Supabase** entegrasyonu ile kullanıcı yönetimi
- **WebSocket** desteği ile gerçek zamanlı kamera akışı

## Klasör Yapısı

```
frontend/
├── src/
│   ├── components/      # Yeniden kullanılabilir UI bileşenleri
│   ├── pages/          # Sayfa bileşenleri ve rotalar
│   ├── contexts/       # React Context API providers
│   ├── services/       # API ve backend servisleri
│   ├── hooks/          # Custom React hooks
│   └── App.tsx         # Ana uygulama bileşeni
├── public/             # Statik dosyalar
├── dist/              # Build çıktısı (production)
└── package.json       # NPM bağımlılıkları
```

## Kullanılan Teknolojiler

- **React 18** - UI framework
- **TypeScript** - Tip güvenliği
- **Vite** - Hızlı geliştirme ve build aracı
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Sayfa yönlendirme
- **ECharts** - Grafik ve görselleştirme
- **Lucide Icons** - Modern icon seti
- **Socket.io-client** - WebSocket bağlantıları
- **Supabase** - Kullanıcı kimlik doğrulama

## Kurulum ve Çalıştırma

### İlk Kurulum

```bash
cd frontend
pnpm install
```

### Geliştirme Modu

```bash
pnpm dev
```

Uygulama `http://localhost:5173` adresinde açılır.

### Production Build

```bash
pnpm build
```

Build çıktısı `dist/` klasöründe oluşur.

### Tip Kontrolü

```bash
pnpm typecheck
```

## Ana Özellikler

### 1. Kimlik Doğrulama (LoginPage)
- Demo hesap: `admin@observai.com` / `demo1234`
- Supabase ile güvenli giriş

### 2. Kamera Analitik Dashboard
- Canlı kamera görüntüsü (WebSocket üzerinden)
- Isı haritası overlay
- Cinsiyet dağılımı grafiği (donut chart)
- Yaş dağılımı grafiği (bar chart)
- Ziyaretçi sayacı widget'ı
- Bekleme süresi analizi

### 3. Zone Labeling (Bölge Etiketleme)
- Interaktif canvas üzerinde bölge çizimi
- Giriş/çıkış noktaları tanımlama
- Bölgeleri düzenleme ve silme
- Konfigürasyonları kaydetme

## Kod Yapısı ve Önemli Dosyalar

### Components (Bileşenler)
- `components/camera/` - Kamera ile ilgili tüm bileşenler
  - `CameraFeed.tsx` - Canlı kamera akışı
  - `ZoneCanvas.tsx` - Bölge çizim canvas'ı
  - `AgeChart.tsx` - Yaş dağılımı grafiği
  - `GenderChart.tsx` - Cinsiyet grafiği
  - `VisitorCountWidget.tsx` - Ziyaretçi sayacı
  - `DwellTimeWidget.tsx` - Bekleme süresi widget'ı

- `components/layout/` - Sayfa düzeni bileşenleri
  - `Sidebar.tsx` - Yan menü
  - `Header.tsx` - Üst bar

### Pages (Sayfalar)
- `pages/LoginPage.tsx` - Giriş sayfası
- `pages/dashboard/CameraAnalyticsPage.tsx` - Ana dashboard
- `pages/dashboard/ZoneLabelingPage.tsx` - Bölge etiketleme
- `pages/dashboard/CameraSelectionPage.tsx` - Kamera seçimi
- `pages/dashboard/AIInsightsPage.tsx` - AI öngörüleri

### Services (Servisler)
- `services/cameraBackendService.ts` - Python kamera backend'i ile iletişim
  - WebSocket bağlantısı (port 5000)
  - Gerçek zamanlı frame alma
  - Metrik sorgulama

### Contexts (Bağlamlar)
- `contexts/DataModeContext.tsx` - Canlı/Demo veri modu yönetimi
- Supabase auth context (built-in)

## Ortam Değişkenleri

`.env` dosyası oluşturun:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Notlar

- Kamera akışı için Python backend'in çalışıyor olması gerekir (port 5000)
- Demo modu, gerçek kamera olmadan test için kullanılabilir
- Tüm grafikler ECharts ile oluşturulmuştur
- Responsive tasarım, mobil ve desktop destekler
