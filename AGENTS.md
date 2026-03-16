# 🤖 ObservAI — AI Agents Kılavuzu
> 🟢 **2026-03-08 15:33** — 15/16 görev tamamlandı | Sıradaki: **5.0.0** — Sistem Saglık Kontrolü (Test)

> 🟢 **2026-03-04 03:05** — 15/15 görev tamamlandı | Sıradaki: Tüm görevler tamamlandı! 🎉

> 🟢 **2026-03-04 00:35** — 14/15 görev tamamlandı | Sıradaki: **4.2.1** — Settings Sayfasi Iyilestirme

> 🟢 **2026-03-03 23:05** — 13/15 görev tamamlandı | Sıradaki: **4.1.1** — Historical Analytics Sayfasi

> 🟢 **2026-03-03 22:36** — 12/15 görev tamamlandı | Sıradaki: **3.3.1** — AI Insight Entegrasyon Testi

> 🟢 **2026-03-03 22:04** — 11/15 görev tamamlandı | Sıradaki: **3.2.2** — Bildirim Sistemi

> 🟢 **2026-03-03 21:39** — 10/15 görev tamamlandı | Sıradaki: **3.2.1** — AI Insights Frontend Sayfasi

> 🟢 **2026-03-03 19:13** — 9/15 görev tamamlandı | Sıradaki: **3.1.1** — Insight Engine Backend Servisi

> 🟢 **2026-03-03 18:05** — 8/15 görev tamamlandı | Sıradaki: **2.2.2** — Performans Entegrasyon Testi

> 🟢 **2026-03-03 17:37** — 7/15 görev tamamlandı | Sıradaki: **2.2.1** — Demografik Tahmin Iyilestirme

> 🟢 **2026-03-03 16:44** — 6/15 görev tamamlandı | Sıradaki: **2.1.2** — YOLO Model Optimizasyonu

> 🟢 **2026-03-03 16:32** — 5/15 görev tamamlandı | Sıradaki: **2.1.1** — Asenkron Processing Pipeline

> 🟢 **2026-03-03 15:59** — 4/15 görev tamamlandı | Sıradaki: **1.2.2** — Entegrasyon Testi - Kamera Stabilite

> Bu dosya: OpenAI Codex, GitHub Copilot Workspace, Gemini CLI, ve diğer AI agent'lar için

---

## ⚡ Hızlı Başlangıç

Yeni bir AI agent olarak bu projeye başladıysan:

```bash
# 1. Handoff belgesini oku
cat HANDOFF.md

# 2. Görev durumunu kontrol et
python ai_handoff.py --status

# 3. Sıradaki görevi bul
python -c "
import json
d = json.load(open('auto_dev_progress.json'))
pending = [t for t in d['tasks'] if t['status']=='pending']
print('Sıradaki:', pending[0]['id'], pending[0]['name'] if pending else 'Tüm görevler tamamlandı!')
"

# 4. Handoff belgesini güncelle (görevi tamamlayınca)
python ai_handoff.py
```

---

## 🎯 Proje Amacı
ObservAI, mağaza/ortam kameralarından gerçek zamanlı müşteri analizi yapar:
- **Kişi tespiti**: YOLO11s ile bounding box
- **Demografik analiz**: InsightFace/MiVOLO ile yaş/cinsiyet tahmini
- **Dashboard**: React ile canlı analytics görselleştirme
- **AI Insights**: Gemini API ile doğal dil önerileri

---

## 📋 Görev Sistemi

Tüm görevler `auto_dev_progress.json` dosyasında takip edilir.

### Görev Tamamlama Protokolü
```python
import json, datetime

# Görevi tamamlandı olarak işaretle
with open('auto_dev_progress.json', 'r+') as f:
    data = json.load(f)
    for task in data['tasks']:
        if task['id'] == 'X.Y.Z':  # <-- görev ID'si
            task['status'] = 'completed'
            task['completed_at'] = datetime.datetime.now().isoformat()
    f.seek(0)
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.truncate()
```

---

## 🏗️ Mimari

```
ObservAI/
├── frontend/          React 18 + TypeScript (port 5173)
├── backend/           Express + TypeScript (port 3001)
└── packages/
    └── camera-analytics/
        └── camera_analytics/
            ├── run_with_websocket.py   ← Python WebSocket server (port 5001)
            └── analytics.py           ← YOLO + InsightFace motoru
```

### Kritik Dosyalar
| Dosya | Açıklama |
|-------|----------|
| `frontend/src/components/camera/CameraFeed.tsx` | Kamera UI (1350+ satır) |
| `packages/camera-analytics/camera_analytics/analytics.py` | AI analiz motoru |
| `packages/camera-analytics/camera_analytics/run_with_websocket.py` | WebSocket bootstrap |
| `backend/src/routes/python-backend.ts` | Python proxy routes |
| `auto_dev_progress.json` | Görev durumları |
| `HANDOFF.md` | Handoff belgesi |

---

## 🔧 Geliştirme Ortamı

```bash
# Kurulum
pnpm install
pip install -r packages/camera-analytics/requirements.txt

# Başlatma (tek komut)
./start-all.sh  # Linux/Mac
start-all.bat   # Windows

# TypeScript kontrol
cd frontend && npx tsc --noEmit

# Python test
cd packages/camera-analytics && python -m pytest
```

---

## 📡 Otomatik Bildirim Sistemi
- VM içinden ntfy.sh'a doğrudan erişim yok (sandbox kısıtlaması)
- Çözüm: `ntfy_bridge.py` Windows'ta çalışır, `auto_dev_progress.json["pending_notifications"]` kuyruğunu izler
- Topic: `ntfy.sh/observai`

---

## 🔄 AI Handoff Komutları

```bash
# Handoff belgesi oluştur/güncelle
python ai_handoff.py

# Belirli bir AI için oluştur
python ai_handoff.py --ai gemini
python ai_handoff.py --ai cursor
python ai_handoff.py --ai codex

# Görev durumu göster
python ai_handoff.py --status

# Belgeyi göster
python ai_handoff.py --show

# Değişiklikleri izle ve otomatik güncelle
python ai_handoff.py --watch
```
