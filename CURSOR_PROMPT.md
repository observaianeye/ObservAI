# ObservAI — Cursor & Codex için Hazır Promptlar

Bu dosyadaki promptları kopyalayıp Cursor Composer'a (veya Agent moduna) yapıştır.
Her seferinde aynı promptu kullanabilirsin — sistem otomatik olarak kaldığı yerden devam eder.

---

## 🤖 CURSOR COMPOSER / AGENT MODU İÇİN PROMPT

Cursor'da: `Ctrl+Shift+I` → Composer sekmesi → Agent modu → aşağıdaki metni yapıştır → Enter

```
ObservAI projesini geliştirmem gerekiyor. Lütfen aşağıdaki adımları sırayla takip et:

1. HANDOFF.md dosyasını oku ve projenin mevcut durumunu anla
2. auto_dev_progress.json dosyasını oku ve sıradaki "pending" görevin ID'sini bul
3. Eğer bir görev "in_progress" ise (başka bir AI çalışıyor olabilir) bir sonraki "pending" görevi al
4. Seçilen görevi uygula:
   - DEVELOPMENT_AUTOMATION_PLAN.md'de o görevin açıklamasını oku
   - İlgili dosyaları düzenle/oluştur
   - TypeScript dosyaları için `cd frontend && npx tsc --noEmit` ile kontrol et
   - Python dosyaları için syntax kontrolü yap
5. auto_dev_progress.json dosyasını güncelle:
   - Görevin status'unu "completed" yap
   - completed_at alanını şimdiki zaman ile doldur
   - session.last_note alanına ne yaptığını yaz
6. HANDOFF.md dosyasını güncelle (ai_handoff.py'yi çalıştırabilirsin: `python ai_handoff.py`)
7. ntfy bildirimi gönder (opsiyonel):
   `python -c "import urllib.request; urllib.request.urlopen(urllib.request.Request('https://ntfy.sh/observai', b'Gorev tamamlandi [Cursor]', {'Title': 'ObservAI Cursor', 'Tags': 'white_check_mark'}, 'POST'))"`

Proje dizini: ObservAI/
Stack: React 18 + TypeScript + Vite (5173) | Express + Supabase (3001) | Python FastAPI + YOLO11 (5001)

Şimdi başla.
```

---

## 🧠 CURSOR CODEX (OpenAI) İÇİN PROMPT

Cursor'da model olarak `gpt-4o` veya `o1` seçtikten sonra aynı Composer'a yapıştır:

```
You are working on the ObservAI project — an AI-powered real-time customer analytics platform.

Tech stack:
- Frontend: React 18 + TypeScript + Vite (port 5173)
- Backend: Express + TypeScript + Supabase (port 3001)
- AI Engine: Python FastAPI + WebSocket + YOLO11 + InsightFace (port 5001)

Your task:
1. Read HANDOFF.md to understand current project state
2. Read auto_dev_progress.json to find the next task with status "pending"
3. Skip any task with status "in_progress" (another AI may be working on it)
4. Implement the selected task by reading its description in DEVELOPMENT_AUTOMATION_PLAN.md
5. Update auto_dev_progress.json: set status to "completed", fill completed_at with current ISO timestamp
6. Run: python ai_handoff.py
7. Send ntfy notification: python -c "import urllib.request; urllib.request.urlopen(urllib.request.Request('https://ntfy.sh/observai', b'Task completed [Codex]', {'Title': 'ObservAI Codex', 'Tags': 'robot_face'}, 'POST'))"

Start by reading HANDOFF.md now.
```

---

## ⚡ HIZLI YENIDEN BAŞLATMA PROMPTU (Cursor zaten açıkken)

Cursor'da önceki Composer oturumu kapandıysa veya devam etmesi için:

```
ObservAI projesine devam et. HANDOFF.md ve auto_dev_progress.json'u oku, sıradaki pending görevi tamamla, progress dosyasını güncelle.
```

---

## 📋 NOTLAR

- **Çakışma olmaz:** `auto_dev_progress.json`'daki `in_progress` kilidi sayesinde iki AI aynı görevi almaz
- **Gemini API** arka planda otomatik çalışıyor (Windows Task Scheduler ile)
- **Claude** her 30 dakikada bir `observai_auto_dev.py` üzerinden çalışıyor
- **Cursor** sen ne zaman istersen başlatırsın — sistem kaldığı yerden devam eder
- **Tüm bildirimler** ntfy.sh/observai topic'ine gider → iPhone'una gelir
