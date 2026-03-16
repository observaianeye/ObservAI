#!/usr/bin/env python3
"""
ObservAI - AI Handoff Sistemi
==============================
Bu script, bir AI (Claude, Gemini, Copilot, Cursor) limit'e yaklaşınca veya
durması gerekince, bir sonraki AI'nın kaldığı yerden devam edebilmesi için
eksiksiz bir handoff belgesi oluşturur.

Kullanim:
    python ai_handoff.py                    # Handoff belgesi oluştur
    python ai_handoff.py --watch            # Sürekli izleme modu (token yaklaşınca otomatik oluştur)
    python ai_handoff.py --show             # Son handoff belgesini göster
    python ai_handoff.py --ai gemini        # Gemini için özel format

Handoff belgesi konumu: ObservAI/HANDOFF.md
"""

import json
import os
import sys
import datetime
import subprocess
from pathlib import Path

# Renkler
class C:
    GREEN  = '\033[92m'
    YELLOW = '\033[93m'
    RED    = '\033[91m'
    BLUE   = '\033[94m'
    CYAN   = '\033[96m'
    BOLD   = '\033[1m'
    RESET  = '\033[0m'

PROJECT_ROOT = Path(__file__).parent.resolve()
PROGRESS_FILE = PROJECT_ROOT / "auto_dev_progress.json"
HANDOFF_FILE  = PROJECT_ROOT / "HANDOFF.md"

# ============================================================
# PROJE BAĞLAMI - Burası elle güncellenir veya AI tarafından
# ============================================================

PROJECT_CONTEXT = """
## ObservAI Nedir?
ObservAI, gerçek zamanlı müşteri analitiği için AI tabanlı bir platformdur.
Kamera görüntüsü üzerinden:
- Kişi sayımı (giriş/çıkış)
- Demografik analiz (yaş, cinsiyet)
- Zone (bölge) bazlı takip
- Ziyaretçi ısı haritası
- AI destekli içgörüler

## Teknoloji Stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend (Node):** Express + TypeScript + Supabase
- **Backend (Python):** FastAPI + WebSocket + YOLO11 + InsightFace
- **DB:** Supabase (PostgreSQL)
- **Deployment:** Windows + local network

## Proje Klasör Yapısı
```
ObservAI/
├── frontend/           # React frontend (Vite)
│   └── src/
│       ├── components/camera/    # CameraFeed.tsx - Ana kamera bileşeni
│       ├── services/             # cameraBackendService.ts - Socket.IO + Health
│       ├── pages/dashboard/      # Dashboard sayfaları
│       └── contexts/             # DataModeContext (live/demo)
├── backend/            # Node.js/Express backend
│   └── src/
│       ├── routes/               # API routes (python-backend.ts, cameras.ts, vb.)
│       └── lib/                  # pythonBackendManager.ts - Python process manager
├── packages/
│   └── camera-analytics/         # Python kamera analitik modülü
│       └── camera_analytics/
│           ├── run_with_websocket.py  # Ana Python entry point
│           └── ... (YOLO, InsightFace, tracker)
├── auto_dev_progress.json         # Görev takip dosyası
├── observai_auto_dev.py           # Otomatik geliştirme scripti (Windows'ta çalışır)
├── ai_handoff.py                  # Bu dosya - AI handoff sistemi
└── HANDOFF.md                     # Üretilen handoff belgesi
```

## Önemli Port Numaraları
- Frontend: 5173 (Vite dev server)
- Backend (Node): 3001
- Backend (Python WebSocket): 5001
- MJPEG stream: http://localhost:5001/mjpeg

## Notlar
- ntfy.sh bildirimleri: observai_auto_dev.py üzerinden gönderilir (Windows'ta)
- VM Sandbox'tan internet erişimi YOK - status dosyası üzerinden iletişim
- GitHub Actions: Bilkent mail özeti için ayrı workflow mevcut
"""

# ============================================================
# GELİŞTİRME PLANI DURUMLARI
# ============================================================

PHASE_NAMES = {
    1: "Kamera Stabilite ve Bağlantı Sorunları",
    2: "Performans Optimizasyonu",
    3: "AI Insight Sistemi",
    4: "Raporlama ve Export",
    5: "Kullanıcı Deneyimi İyileştirmeleri",
}

TASK_DESCRIPTIONS = {
    "1.1.1": "Backend Health-Check Endpoint (/api/python-backend/health) - Node.js backend'den Python'ın hazır olup olmadığını sorgulama",
    "1.1.2": "Frontend Bağlantı State Machine - CameraFeed.tsx'e retry+exponential backoff ile robust bağlantı yönetimi",
    "1.1.3": "Python Backend Ready Event - Python WebSocket server'dan 'ready' eventi yayınlama",
    "1.2.1": "Model Preloading - Python başlangıçta modelleri önceden yükleme + durum bildirimi",
    "1.2.2": "Entegrasyon Testi - Kamera başlatma stabilitesi için otomatik test",
    "2.1.1": "Asenkron Processing Pipeline - Multi-thread frame capture/inference/demographics ayrımı",
    "2.1.2": "YOLO Model Optimizasyonu - NMS threshold, confidence, input size ayarları",
    "2.2.1": "Demografik Tahmin İyileştirme - Temporal smoothing + confidence-weighted averaging",
    "2.2.2": "Performans Entegrasyon Testi",
    "3.1.1": "Insight Engine Backend Servisi",
    "3.1.2": "Insight API Endpoints",
    "3.2.1": "AI Insights Frontend - AIInsightsPage.tsx tam fonksiyonel",
    "3.2.2": "Gemini API Entegrasyonu",
    "4.1.1": "PDF/Excel Export",
    "4.2.1": "Raporlama Entegrasyon Testi",
}

def load_progress():
    """Progress dosyasını yükle."""
    if not PROGRESS_FILE.exists():
        return {"tasks": [], "session": {}, "current_phase": 1}
    with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def get_git_status():
    """Son git değişikliklerini al."""
    try:
        result = subprocess.run(
            ["git", "log", "--oneline", "-10"],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        return result.stdout.strip() if result.returncode == 0 else "Git bilgisi alınamadı"
    except:
        return "Git erişim hatası"

def get_recent_changes():
    """Son değiştirilen dosyaları al."""
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD"],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        changed = result.stdout.strip()

        result2 = subprocess.run(
            ["git", "status", "--short"],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        status = result2.stdout.strip()
        return status if status else "Değişiklik yok (tümü commit edilmiş)"
    except:
        return "Git status alınamadı"

def generate_handoff_document(ai_name: str = "Claude", reason: str = "Token/Rate limiti"):
    """Handoff belgesi oluştur."""
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    progress = load_progress()
    tasks = progress.get("tasks", [])

    # Task durumlarını kategorize et
    completed = [t for t in tasks if t.get("status") == "completed"]
    in_progress = [t for t in tasks if t.get("status") == "in_progress"]
    pending = [t for t in tasks if t.get("status") == "pending"]
    failed = [t for t in tasks if t.get("status") == "failed"]

    # Sonraki task'ı bul
    next_task = None
    if in_progress:
        next_task = in_progress[0]
    elif pending:
        next_task = pending[0]

    git_changes = get_recent_changes()
    git_log = get_git_status()

    # ============================================================
    # HANDOFF BELGESİ
    # ============================================================
    doc = f"""# 🤖 ObservAI — AI Handoff Belgesi
> **Oluşturan AI:** {ai_name}
> **Tarih:** {now}
> **Neden:** {reason}
> **Hedef AI:** [Buraya devam eden AI yaz: Claude / Gemini / Cursor / Copilot]

---

## 🚨 DEVAM EDEN AI İÇİN — HEMEN BURADAN BAŞLA

### ▶ Şu An Yapılıyor (In Progress)
"""

    if in_progress:
        for t in in_progress:
            desc = TASK_DESCRIPTIONS.get(t['id'], t['name'])
            doc += f"""
**Task {t['id']}: {t['name']}**
- Açıklama: {desc}
- Başlandı: {t.get('started_at', 'Bilinmiyor')}
- Denemeler: {t.get('retries', 0)}
- Son hata: {t.get('last_error', 'Yok')}
"""
    else:
        doc += "\n*Aktif görev yok.*\n"

    doc += f"""
### ⏭ Sıradaki Görev (Hemen Başla)
"""
    if next_task:
        desc = TASK_DESCRIPTIONS.get(next_task['id'], next_task['name'])
        doc += f"""
**Task {next_task['id']}: {next_task['name']}**
- Açıklama: {desc}
"""
        # Göreve özel talimatlar
        if next_task['id'] == "1.1.2":
            doc += """
**Yapılacaklar:**
1. `frontend/src/components/camera/CameraFeed.tsx` içindeki health polling'i tam state machine'e dönüştür
2. States: `idle | starting | connecting | ready | error | retrying`
3. Exponential backoff: 1s → 2s → 4s → 8s → max 30s
4. UI'da bağlantı durumunu göster (spinner, hata mesajı, retry sayısı)
5. Kamera değiştirirken graceful cleanup (eski stream'i kapat, state'i sıfırla)

**Kritik dosya:** `frontend/src/components/camera/CameraFeed.tsx` (1172 satır)
- Health polling: satır ~165-210
- startPythonBackend fonksiyonu: satır ~104-128
- `backendHealth` state: satır ~85
"""
        elif next_task['id'] == "1.2.1":
            doc += """
**Yapılacaklar:**
1. `packages/camera-analytics/camera_analytics/run_with_websocket.py` içine model preload ekle
2. Startup sırasında YOLO ve InsightFace modellerini yükle
3. `/health` endpoint'ine `model_loaded: true/false` bilgisi ekle
4. Yükleme ilerlemesini Socket.IO event olarak yayınla: `model_loading_progress`
5. Frontend'de model yükleme durumu göster (CameraFeed.tsx)
"""
    else:
        doc += "\n*Tüm görevler tamamlandı veya plan güncellenmeli.*\n"

    doc += f"""

---

## 📊 Görev Durumu Özeti

| Durum | Sayı |
|-------|------|
| ✅ Tamamlandı | {len(completed)} |
| 🔄 Devam Ediyor | {len(in_progress)} |
| ⏳ Bekliyor | {len(pending)} |
| ❌ Başarısız | {len(failed)} |
| **Toplam** | **{len(tasks)}** |

### ✅ Tamamlanan Görevler
"""
    if completed:
        for t in completed:
            doc += f"- **{t['id']}** {t['name']} *(tamamlandı: {t.get('completed_at', '?')})*\n"
    else:
        doc += "- Henüz tamamlanan görev yok\n"

    doc += f"""
### ⏳ Bekleyen Görevler (Öncelik Sırasıyla)
"""
    for t in pending[:8]:
        desc = TASK_DESCRIPTIONS.get(t['id'], t['name'])
        doc += f"- **{t['id']}** {t['name']}: {desc}\n"

    doc += f"""

---

## 📁 Son Kod Değişiklikleri

```
{git_changes}
```

### Son Git Commit'leri
```
{git_log}
```

---

## 🏗 Proje Bağlamı
{PROJECT_CONTEXT}

---

## 🔧 Geliştirme Ortamı Kurulumu

### Windows'ta Projeyi Başlatma
```bat
# Backend (Node.js)
cd ObservAI
npm run dev:backend       # ya da: start-backend.bat

# Frontend (React)
npm run dev               # ya da: start-frontend.bat

# Python Backend (kamera analitik)
cd packages/camera-analytics
.\\venv\\Scripts\\python -m camera_analytics.run_with_websocket --source 0 --ws-port 5001
```

### Önemli Env Değişkenleri
```
VITE_API_URL=http://localhost:3001
VITE_BACKEND_URL=http://localhost:5001
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

---

## 💡 Geliştirme Kuralları

1. **Progress güncellemesi:** Her görev tamamlandığında `auto_dev_progress.json` güncelle
2. **Dosya boyutu:** 1000+ satır dosyalara dikkat — kısmi update yap, tümünü yeniden yazma
3. **Test:** Her değişiklikten sonra TypeScript hataları kontrol et: `npx tsc --noEmit`
4. **ntfy bildirim:** VM'den direkt gönderilemiyor — `auto_dev_progress.json`'a durum yaz, Windows scripti okuyup gönderiyor
5. **Handoff:** Token limiti yaklaşınca `python ai_handoff.py` çalıştır

---

## 🤖 Bu AI'a Verilen Otorite

Kullanıcı (Emre/Partal) tüm dosyalara tam erişim ve değişiklik yetkisi vermiştir.
- Doğrudan kod değişikliği yap, onay bekleme
- Hata çıkarsa düzelt ve devam et
- progress.json'u güncelle
- Büyük değişikliklerde ntfy'a durum yaz (auto_dev_progress.json üzerinden)

---

## 📞 Handoff Öncesi Son Durum Notu

{progress.get('session', {}).get('last_note', 'Not bulunamadı.')}

---
*Bu belge `ai_handoff.py` tarafından otomatik oluşturulmuştur.*
*Proje: ObservAI | Kullanıcı: Emre (Partal)*
"""

    return doc

def sync_ai_configs():
    """
    .cursorrules ve AGENTS.md dosyalarını güncel progress ile senkronize et.
    HANDOFF.md her güncellendiğinde otomatik çağrılır.
    """
    progress = load_progress()
    tasks = progress.get("tasks", [])
    completed = [t for t in tasks if t.get("status") == "completed"]
    pending   = [t for t in tasks if t.get("status") == "pending"]
    in_prog   = [t for t in tasks if t.get("status") == "in_progress"]

    next_task = in_prog[0] if in_prog else (pending[0] if pending else None)
    next_task_line = f"**{next_task['id']}** — {next_task['name']}" if next_task else "Tüm görevler tamamlandı! 🎉"
    done_pct = int(len(completed) / len(tasks) * 100) if tasks else 0
    session_note = progress.get("session", {}).get("last_note", "")[:200]
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

    # ── .cursorrules güncelle (dinamik progress bölümü) ──────────────────────
    cursor_rules_path = PROJECT_ROOT / ".cursorrules"
    dynamic_section = f"""
## 📊 Güncel İlerleme ({now})
- **Tamamlanan:** {len(completed)}/{len(tasks)} görev (%{done_pct})
- **Sıradaki Görev:** {next_task_line}
- **Son Not:** {session_note}

## ⚡ Hemen Şimdi Yap
1. `HANDOFF.md` dosyasını oku (tüm bağlam burada)
2. `auto_dev_progress.json` içindeki ilk `pending` görevi seç
3. Görevi uygula
4. `auto_dev_progress.json` içinde status'ü `"completed"` yap ve `completed_at` ekle
5. `python ai_handoff.py` çalıştır (handoff belgesini güncelle)
"""
    try:
        existing = cursor_rules_path.read_text(encoding="utf-8")
        # Dinamik bölümü değiştir veya sona ekle
        marker_start = "## 📊 Güncel İlerleme"
        if marker_start in existing:
            # Önceki dinamik bölümü değiştir
            idx = existing.index(marker_start)
            existing = existing[:idx] + dynamic_section.lstrip("\n")
        else:
            existing = existing.rstrip() + "\n" + dynamic_section
        cursor_rules_path.write_text(existing, encoding="utf-8")
        print(f"{C.CYAN}  ↺ .cursorrules güncellendi{C.RESET}")
    except Exception as e:
        print(f"{C.YELLOW}  ⚠ .cursorrules güncelleme hatası: {e}{C.RESET}")

    # ── .cursor/rules/observai-context.mdc güncelle ──────────────────────────
    cursor_mdc_path = PROJECT_ROOT / ".cursor" / "rules" / "observai-context.mdc"
    try:
        cursor_mdc_path.parent.mkdir(parents=True, exist_ok=True)
        existing_mdc = cursor_mdc_path.read_text(encoding="utf-8") if cursor_mdc_path.exists() else ""
        marker = "## ⚡ İlk Yapman Gereken"
        new_section = f"""## ⚡ İlk Yapman Gereken
1. `HANDOFF.md` dosyasını oku
2. Sıradaki görev: {next_task_line}
3. Görevi uygula → `auto_dev_progress.json` güncelle
4. `python ai_handoff.py` çalıştır

## 📊 İlerleme ({now})
- {len(completed)}/{len(tasks)} görev tamamlandı (%{done_pct})
"""
        if marker in existing_mdc:
            idx = existing_mdc.index(marker)
            # Find end of section (next ## or end of file)
            rest = existing_mdc[idx + len(marker):]
            next_h2 = rest.find("\n## ")
            if next_h2 >= 0:
                after = rest[next_h2:]
            else:
                after = ""
            existing_mdc = existing_mdc[:idx] + new_section + after
        else:
            existing_mdc = existing_mdc.rstrip() + "\n\n" + new_section
        cursor_mdc_path.write_text(existing_mdc, encoding="utf-8")
        print(f"{C.CYAN}  ↺ .cursor/rules/observai-context.mdc güncellendi{C.RESET}")
    except Exception as e:
        print(f"{C.YELLOW}  ⚠ .cursor/rules güncelleme hatası: {e}{C.RESET}")

    # ── AGENTS.md güncelle (minimal — sadece ilerleme satırını değiştir) ─────
    agents_path = PROJECT_ROOT / "AGENTS.md"
    try:
        if agents_path.exists():
            agents_txt = agents_path.read_text(encoding="utf-8")
            old_marker = "Yeni bir AI agent olarak bu projeye başladıysan:"
            if old_marker in agents_txt:
                # progress satırını bul ve güncelle
                progress_line_old = [l for l in agents_txt.splitlines() if "# pending" in l or "tamamlandı" in l]
                # Sadece başa bir banner ekle
                banner = f"> 🟢 **{now}** — {len(completed)}/{len(tasks)} görev tamamlandı | Sıradaki: {next_task_line}\n\n"
                if agents_txt.startswith("# 🤖"):
                    agents_txt = agents_txt[:agents_txt.index("\n") + 1] + banner + agents_txt[agents_txt.index("\n") + 1:]
                    # Keep only the latest banner (remove old ones)
                    lines = agents_txt.splitlines(keepends=True)
                    new_lines = [lines[0]]
                    for line in lines[1:]:
                        if line.startswith("> 🟢") and new_lines[-1].startswith("> 🟢"):
                            new_lines[-1] = line  # replace old banner
                        else:
                            new_lines.append(line)
                    agents_txt = "".join(new_lines)
                agents_path.write_text(agents_txt, encoding="utf-8")
                print(f"{C.CYAN}  ↺ AGENTS.md güncellendi{C.RESET}")
    except Exception as e:
        print(f"{C.YELLOW}  ⚠ AGENTS.md güncelleme hatası: {e}{C.RESET}")


def update_handoff_file(ai_name="Claude", reason="Periyodik güncelleme"):
    """HANDOFF.md dosyasını güncelle ve tüm AI config dosyalarını senkronize et."""
    doc = generate_handoff_document(ai_name, reason)
    with open(HANDOFF_FILE, "w", encoding="utf-8") as f:
        f.write(doc)
    print(f"{C.GREEN}✅ Handoff belgesi güncellendi: HANDOFF.md{C.RESET}")
    # Cursor, Gemini ve diğer AI config dosyalarını senkronize et
    sync_ai_configs()
    return doc

def update_progress_task(task_id: str, status: str, note: str = ""):
    """Görev durumunu güncelle."""
    progress = load_progress()
    now = datetime.datetime.now().isoformat()

    for task in progress.get("tasks", []):
        if task["id"] == task_id:
            task["status"] = status
            if status == "in_progress":
                task["started_at"] = now
            elif status == "completed":
                task["completed_at"] = now
            if note:
                task["last_error"] = note
            break

    # Son notu güncelle
    if "session" not in progress:
        progress["session"] = {}
    progress["session"]["last_note"] = note or f"Task {task_id} -> {status}"
    progress["session"]["updated_at"] = now

    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)
    print(f"{C.CYAN}📝 Progress güncellendi: {task_id} -> {status}{C.RESET}")

def show_status():
    """Mevcut durumu göster."""
    progress = load_progress()
    tasks = progress.get("tasks", [])
    completed = [t for t in tasks if t.get("status") == "completed"]
    in_progress = [t for t in tasks if t.get("status") == "in_progress"]
    pending = [t for t in tasks if t.get("status") == "pending"]

    print(f"\n{C.BOLD}{'='*60}{C.RESET}")
    print(f"{C.BOLD}ObservAI - Proje Durumu{C.RESET}")
    print(f"{'='*60}")
    print(f"✅ Tamamlandı:    {len(completed)}")
    print(f"🔄 Devam Ediyor: {len(in_progress)}")
    print(f"⏳ Bekliyor:      {len(pending)}")
    print(f"{'='*60}\n")

    if in_progress:
        print(f"{C.YELLOW}🔄 Devam Edenler:{C.RESET}")
        for t in in_progress:
            print(f"  [{t['id']}] {t['name']}")

    if pending:
        print(f"\n{C.BLUE}⏳ Sıradaki Görevler:{C.RESET}")
        for t in pending[:5]:
            print(f"  [{t['id']}] {t['name']}")

    if HANDOFF_FILE.exists():
        mtime = datetime.datetime.fromtimestamp(HANDOFF_FILE.stat().st_mtime)
        print(f"\n{C.CYAN}📄 Son handoff: {mtime.strftime('%Y-%m-%d %H:%M')}{C.RESET}")
    print()

# ============================================================
# ANA PROGRAM
# ============================================================

if __name__ == "__main__":
    args = sys.argv[1:]

    if "--show" in args:
        if HANDOFF_FILE.exists():
            print(HANDOFF_FILE.read_text(encoding="utf-8"))
        else:
            print("Handoff belgesi bulunamadı. Önce: python ai_handoff.py")

    elif "--status" in args:
        show_status()

    elif "--update-task" in args:
        # Kullanim: python ai_handoff.py --update-task 1.1.1 completed "Tamamlandı"
        idx = args.index("--update-task")
        if len(args) > idx + 2:
            task_id = args[idx + 1]
            status = args[idx + 2]
            note = args[idx + 3] if len(args) > idx + 3 else ""
            update_progress_task(task_id, status, note)
            update_handoff_file()
        else:
            print("Kullanim: python ai_handoff.py --update-task <id> <status> [not]")

    elif "--watch" in args:
        print(f"{C.YELLOW}👁 İzleme modu başlatıldı (Ctrl+C ile durdur){C.RESET}")
        import time
        while True:
            update_handoff_file("Claude", "Periyodik otomatik güncelleme")
            time.sleep(300)  # Her 5 dakikada bir güncelle

    elif "--ai" in args:
        idx = args.index("--ai")
        ai_name = args[idx + 1] if len(args) > idx + 1 else "Gemini"
        doc = update_handoff_file(ai_name, f"{ai_name}'e handoff")
        print(f"\n{C.GREEN}Handoff belgesi {ai_name} için oluşturuldu.{C.RESET}")
        print(f"{C.YELLOW}HANDOFF.md dosyasını {ai_name}'ye ver veya kopyala.{C.RESET}")

    else:
        # Varsayılan: handoff belgesi oluştur
        show_status()
        print(f"{C.BOLD}Handoff belgesi oluşturuluyor...{C.RESET}")
        doc = update_handoff_file("Claude", "Manuel handoff talebi")
        print(f"\n{C.GREEN}✅ HANDOFF.md hazır!{C.RESET}")
        print(f"{C.CYAN}Bu dosyayı diğer AI'ya ver ve 'HANDOFF.md içeriğini oku, kaldığın yerden devam et' de.{C.RESET}")
        print(f"\n{C.YELLOW}Hızlı komutlar:{C.RESET}")
        print("  python ai_handoff.py --ai gemini     # Gemini'ye geçiş")
        print("  python ai_handoff.py --ai cursor     # Cursor'a geçiş")
        print("  python ai_handoff.py --status        # Durum özeti")
        print("  python ai_handoff.py --show          # Belgeyi göster")
