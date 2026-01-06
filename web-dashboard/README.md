# Web Dashboard - Basit HTML Demo Dashboard

Bu klasör, ObservAI için basit bir HTML/JavaScript demo dashboard'u içerir.

## İçerik

Bu klasörde şunlar bulunur:
- **index.html** - Ana HTML sayfası
- **style.css** - Dashboard stilleri
- **app.js** - JavaScript mantığı
- **server.pid** - Node.js server process ID

## Ne İçin Kullanılır?

Bu basit dashboard şunlar için kullanılır:
- **Hızlı Prototipleme** - React olmadan hızlı test
- **Backend Test** - API endpoint'lerini test etme
- **Demo Amaçlı** - Basit gösterimler için
- **Eğitim** - Vanilla JavaScript örnekleri

## Özellikler

- Basit HTML/CSS/JavaScript yapısı
- Gerçek zamanlı veri görüntüleme
- Grafik entegrasyonu
- Responsive tasarım

## Kullanım

### Basit HTTP Sunucu ile

```bash
cd web-dashboard

# Python 3
python3 -m http.server 8000

# Veya Node.js
npx serve .
```

Tarayıcıda açın: `http://localhost:8000`

### Node.js Express Sunucu ile

```bash
cd web-dashboard
npm install express
node server.js
```

## Ana Frontend vs Web Dashboard

| Özellik | Ana Frontend (React) | Web Dashboard (HTML) |
|---------|---------------------|---------------------|
| Teknoloji | React + TypeScript | Vanilla JS |
| Karmaşıklık | Yüksek | Düşük |
| Özellikler | Tam özellikli | Basit demo |
| Kullanım | Production | Test/Demo |
| Build Gerekli | Evet | Hayır |

## Ne Zaman Kullanılır?

**Web Dashboard kullanın:**
- Hızlı backend testi yapmak istiyorsanız
- React build sürecini beklemek istemiyorsanız
- Basit bir demo göstermek için
- Vanilla JavaScript öğrenmek için

**Ana Frontend kullanın:**
- Production ortamı için
- Tam özellikli uygulama için
- Modern UI/UX için
- TypeScript tip güvenliği için

## Dosya Yapısı

```
web-dashboard/
├── index.html       # Ana sayfa
├── style.css        # Stiller
├── app.js          # JavaScript kodu
├── package.json    # NPM bağımlılıkları (opsiyonel)
└── server.pid      # Server process ID
```

## Geliştirme

HTML/CSS/JavaScript dosyalarını doğrudan düzenleyebilirsiniz:

1. Bir dosyayı düzenleyin
2. Tarayıcıda sayfayı yenileyin (F5)
3. Değişiklikleri görün

Build süreci gerekmez!

## API Bağlantısı

Backend API'ye bağlanmak için `app.js` içinde:

```javascript
const API_URL = 'http://localhost:3001/api';

// Veri çek
fetch(`${API_URL}/analytics/camera-id`)
  .then(res => res.json())
  .then(data => {
    // Veriyi işle
    updateDashboard(data);
  });
```

## Notlar

- Bu dashboard temel bir prototiptir
- Production kullanımı için ana React frontend'i kullanın
- CORS ayarları backend'de yapılmalıdır
- Server.pid dosyası otomatik oluşturulur, silmek sorun olmaz
