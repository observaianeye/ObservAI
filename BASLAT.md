# ObservAI Kamera Başlatma Kılavuzu (Türkçe)

## ✅ Kurulum Tamamlandı!

Shapely başarıyla kuruldu. Artık iPhone kamerasını başlatabilirsiniz.

---

## 📱 iPhone Kamerası İçin Backend Başlatma

### Adım 1: Mevcut Kamerayı Durdur
```bash
lsof -ti:5000 | xargs kill -9
```

### Adım 2: iPhone Kamerasını Başlat
```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
python3 run_websocket.py --source 1
```

Başarılı olursa şunu görmelisiniz:
```
✓ WebSocket server started on 0.0.0.0:5000
[INFO] Using camera index: 1
```

### Adım 3: Frontend'i Başlat (Yeni Terminal)
```bash
cd /Users/partalle/Projects/ObservAI/frontend
npm run dev
```

### Adım 4: Tarayıcıyı Aç
```
http://localhost:5173
```

---

## 💻 MacBook Kamerası İçin Backend Başlatma

### Adım 1: Mevcut Kamerayı Durdur
```bash
lsof -ti:5000 | xargs kill -9
```

### Adım 2: MacBook Kamerasını Başlat
```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
python3 run_websocket.py --source 0
```

---

## 🔄 Kamera Değiştirme

iPhone'dan MacBook'a veya tersi yöne geçmek için:

1. **Backend'i Durdur**:
   ```bash
   lsof -ti:5000 | xargs kill -9
   ```

2. **Yeni Kamerayı Başlat**:
   ```bash
   # iPhone için
   python3 run_websocket.py --source 1

   # VEYA MacBook için
   python3 run_websocket.py --source 0
   ```

3. **Tarayıcıyı Yenile**: `Cmd + R`

---

## 🎥 Diğer Kaynak Türleri

### YouTube Canlı Yayın
```bash
python3 run_websocket.py --source "https://www.youtube.com/watch?v=VIDEO_ID"
```

### RTSP Kamera
```bash
python3 run_websocket.py --source "rtsp://192.168.1.100:554/stream"
```

### Ekran Kaydı
```bash
python3 run_websocket.py --source screen
```

---

## ⚠️ Sık Karşılaşılan Hatalar

### Hata: "Address already in use"
**Çözüm**: Mevcut kamerayı durdur
```bash
lsof -ti:5000 | xargs kill -9
```

### Hata: "ModuleNotFoundError"
**Çözüm**: Eksik paketi kur
```bash
pip3 install --break-system-packages PAKET_ADI
```

Yaygın paketler:
- pyyaml
- opencv-python
- ultralytics
- shapely (✅ Kuruldu)

### Hata: "Camera not found"
**Olası Sebepler**:
- Kamera indeksi yanlış → Farklı numara dene (0, 1, 2)
- Kamera izni verilmemiş → Sistem Tercihleri > Gizlilik > Kamera

---

## 📝 Komut Özeti

### Kamerayı Kontrol Et
```bash
lsof -ti:5000  # Çalışıyorsa process ID gösterir
```

### Kamerayı Durdur
```bash
lsof -ti:5000 | xargs kill -9
```

### iPhone Kamerasını Başlat
```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
python3 run_websocket.py --source 1
```

### MacBook Kamerasını Başlat
```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
python3 run_websocket.py --source 0
```

### Frontend'i Başlat
```bash
cd /Users/partalle/Projects/ObservAI/frontend
npm run dev
```

---

## 🎯 Şu Anda Neler Çalışıyor

✅ MacBook kamerası (indeks 0)
✅ iPhone kamerası (indeks 1)
✅ Kişi sayma
✅ Cinsiyet tespiti
✅ Yaş tahmini
✅ Zone (bölge) çizme
✅ Uzun süre bölgede kalma alarmları
✅ Isı haritası
✅ Demografik grafikler

---

## 🚨 Önemli Notlar

1. **Tek Seferde Sadece BIR Kamera**: Port 5000'de sadece bir backend çalışabilir
2. **Kamera Değiştirmek İçin**: Backend'i durdur → Yeni kamera başlat → Tarayıcıyı yenile
3. **Frontend Her Zaman Port 5000'e Bağlanır**: Hangi kamera çalışıyorsa onun analizini gösterir

---

## 📞 Yardım

Sorun yaşıyorsanız:

1. Backend'in çalıştığını kontrol et: `lsof -ti:5000`
2. Terminal çıktısını oku (hata mesajları için)
3. Tarayıcı konsolunu kontrol et (F12 > Console)

---

## ✨ İlk Kullanım

```bash
# 1. Port'u temizle
lsof -ti:5000 | xargs kill -9

# 2. iPhone kamerasını başlat
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
python3 run_websocket.py --source 1

# 3. Yeni terminal aç ve frontend'i başlat
cd /Users/partalle/Projects/ObservAI/frontend
npm run dev

# 4. Tarayıcıda aç
# http://localhost:5173
```

Başarılar! 🎉
