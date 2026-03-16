#!/usr/bin/env python3
"""
ObservAI — Tam Otomatik Orkestrasyon Sistemi
=============================================
Bu script ObservAI geliştirme döngüsünü tam otomatik yönetir:

  1. Scheduled task'ları Claude API üzerinden çalıştırır
  2. Her görev tamamlandığında HANDOFF.md + Cursor/Gemini config günceller
  3. ntfy.sh üzerinden telefona bildirim gönderir (Windows köprüsü ile)
  4. AI oturumu bitince (limit/timeout) bir sonraki AI için handoff hazırlar
  5. Birden fazla AI oturumunu sırayla yönetir

Kullanım:
  python observai_orchestrator.py              # Normal mod
  python observai_orchestrator.py --status     # Durum göster
  python observai_orchestrator.py --handoff    # Manuel handoff oluştur
  python observai_orchestrator.py --next-ai gemini   # Gemini'ye geçiş için hazırla

Mimari:
  Claude (VM) → auto_dev_progress.json → Windows ntfy_bridge.py → Telefon
  Claude (VM) → HANDOFF.md → Cursor / Gemini / Codex (bir sonraki oturum)
"""

import json
import os
import sys
import time
import datetime
import subprocess
import hashlib
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.resolve()
PROGRESS_FILE = PROJECT_ROOT / "auto_dev_progress.json"
HANDOFF_FILE  = PROJECT_ROOT / "HANDOFF.md"
LOG_FILE      = PROJECT_ROOT / "logs" / "orchestrator.log"

# ─── Renkler ─────────────────────────────────────────────────────────────────

class C:
    GREEN  = '\033[92m'
    YELLOW = '\033[93m'
    RED    = '\033[91m'
    BLUE   = '\033[94m'
    CYAN   = '\033[96m'
    BOLD   = '\033[1m'
    RESET  = '\033[0m'

# ─── Log ─────────────────────────────────────────────────────────────────────

def log(msg: str, level: str = "INFO"):
    now = datetime.datetime.now().strftime("%H:%M:%S")
    prefix = {"INFO": "ℹ", "OK": "✅", "WARN": "⚠", "ERROR": "❌"}.get(level, "·")
    line = f"[{now}] {prefix} {msg}"
    print(line)
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

# ─── Progress ────────────────────────────────────────────────────────────────

def load_progress() -> dict:
    try:
        with open(PROGRESS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"tasks": [], "session": {}}

def get_summary(progress: dict) -> str:
    tasks = progress.get("tasks", [])
    completed = sum(1 for t in tasks if t.get("status") == "completed")
    total = len(tasks)
    pct = int(completed / total * 100) if total else 0
    return f"{completed}/{total} görev tamamlandı (%{pct})"

def get_next_pending(progress: dict) -> dict | None:
    for t in progress.get("tasks", []):
        if t.get("status") == "pending":
            return t
    return None

# ─── Handoff ─────────────────────────────────────────────────────────────────

def generate_handoff(ai_name: str = "Claude", reason: str = "Periyodik güncelleme") -> bool:
    """ai_handoff.py çalıştırarak HANDOFF.md ve tüm AI config dosyalarını güncelle."""
    try:
        result = subprocess.run(
            [sys.executable, str(PROJECT_ROOT / "ai_handoff.py"),
             "--ai", ai_name],
            cwd=PROJECT_ROOT, timeout=30, capture_output=True, text=True
        )
        if result.returncode == 0:
            log(f"Handoff belgesi güncellendi ({ai_name})", "OK")
            return True
        else:
            log(f"Handoff güncelleme hatası: {result.stderr[:200]}", "WARN")
            return False
    except Exception as e:
        log(f"Handoff çalıştırma hatası: {e}", "ERROR")
        return False

# ─── AI Oturumu Yönetimi ─────────────────────────────────────────────────────

AI_ROTATION = ["Claude", "Cursor", "Gemini", "Codex"]

def get_current_ai(progress: dict) -> str:
    return progress.get("session", {}).get("current_ai", "Claude")

def get_next_ai(current: str) -> str:
    try:
        idx = AI_ROTATION.index(current)
        return AI_ROTATION[(idx + 1) % len(AI_ROTATION)]
    except ValueError:
        return "Claude"

def prepare_next_ai_session(current_ai: str, progress: dict) -> str:
    """Bir sonraki AI için handoff hazırla ve ntfy bildirimi gönder."""
    next_ai = get_next_ai(current_ai)
    next_task = get_next_pending(progress)

    # Handoff belgesini oluştur
    generate_handoff(current_ai, f"AI oturumu bitti - {next_ai}'e geçiş")

    summary = get_summary(progress)
    next_task_name = f"{next_task['id']}: {next_task['name']}" if next_task else "Tüm görevler tamamlandı!"

    message = (
        f"{current_ai} oturumu tamamlandı.\n"
        f"{summary}\n"
        f"Sıradaki: {next_task_name}\n\n"
        f"HANDOFF.md hazır — {next_ai} ile devam et:\n"
        f"• Cursor: HANDOFF.md otomatik yüklendi\n"
        f"• Gemini: HANDOFF.md içeriğini yapıştır\n"
        f"• Claude: Yeni sohbet başlat, HANDOFF.md yapıştır"
    )

    # ntfy notification (Windows bridge üzerinden)
    queue_notification(
        title=f"🔄 AI Değişimi: {current_ai} → {next_ai}",
        message=message,
        priority="high",
        tags="robot_face"
    )

    log(f"Sonraki AI: {next_ai} | HANDOFF.md hazır", "OK")
    return next_ai

def queue_notification(title: str, message: str, priority: str = "default", tags: str = ""):
    """Windows ntfy_bridge.py'nin okuması için kuyruğa bildirim ekle."""
    try:
        with open(PROGRESS_FILE, encoding="utf-8") as f:
            data = json.load(f)

        data.setdefault("pending_notifications", []).append({
            "title": title,
            "message": message,
            "priority": priority,
            "tags": tags,
            "queued_at": datetime.datetime.now().isoformat(),
        })

        with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        log(f"Bildirim kuyruğa eklenemedi: {e}", "WARN")

# ─── Orchestrator Ana Döngüsü ─────────────────────────────────────────────────

def show_status():
    progress = load_progress()
    tasks = progress.get("tasks", [])

    completed = [t for t in tasks if t.get("status") == "completed"]
    in_progress = [t for t in tasks if t.get("status") == "in_progress"]
    pending = [t for t in tasks if t.get("status") == "pending"]

    print(f"\n{C.BOLD}{'='*60}{C.RESET}")
    print(f"{C.BOLD}ObservAI Orchestrator — Proje Durumu{C.RESET}")
    print(f"{'='*60}")
    print(f"  ✅ Tamamlandı:    {len(completed)}/{len(tasks)}")
    print(f"  🔄 Devam Ediyor: {len(in_progress)}")
    print(f"  ⏳ Bekliyor:      {len(pending)}")
    print(f"{'='*60}")

    current_ai = get_current_ai(progress)
    next_ai = get_next_ai(current_ai)
    print(f"\n  🤖 Aktif AI:   {current_ai}")
    print(f"  ➡ Sonraki AI: {next_ai}")

    if in_progress:
        print(f"\n  {C.YELLOW}🔄 Devam Edenler:{C.RESET}")
        for t in in_progress:
            print(f"    [{t['id']}] {t['name']}")

    if pending:
        print(f"\n  {C.BLUE}⏳ Sıradaki:{C.RESET}")
        for t in pending[:3]:
            print(f"    [{t['id']}] {t['name']}")

    if HANDOFF_FILE.exists():
        mtime = datetime.datetime.fromtimestamp(HANDOFF_FILE.stat().st_mtime)
        age_min = int((datetime.datetime.now() - mtime).total_seconds() / 60)
        print(f"\n  📄 HANDOFF.md: {mtime.strftime('%H:%M')} ({age_min} dakika önce)")

    session_note = progress.get("session", {}).get("last_note", "")
    if session_note:
        print(f"\n  📋 Son Not: {session_note[:100]}...")
    print()


def run_monitor(interval_sec: int = 60):
    """
    Sürekli izleme modu:
    - progress.json değişikliklerini izle
    - Görev tamamlanınca handoff güncelle
    - AI oturumu bitince sonraki AI'a geçiş için bildirim gönder
    """
    log("ObservAI Orchestrator başlatıldı (izleme modu)", "OK")
    log(f"İzleme aralığı: {interval_sec}s | HANDOFF otomatik güncelleme aktif")

    last_hash = ""
    last_completed_count = -1

    # Başlangıç bildirimi
    queue_notification(
        title="🚀 ObservAI Orchestrator Başladı",
        message="Otomatik geliştirme izleme aktif. Görev tamamlandığında bildirim alacaksınız.",
        priority="low",
        tags="eyes"
    )

    try:
        while True:
            time.sleep(interval_sec)

            # Progress değişti mi?
            try:
                current_bytes = PROGRESS_FILE.read_bytes()
                current_hash = hashlib.md5(current_bytes).hexdigest()
            except Exception:
                continue

            if current_hash == last_hash:
                continue

            last_hash = current_hash
            progress = load_progress()
            tasks = progress.get("tasks", [])
            completed_count = sum(1 for t in tasks if t.get("status") == "completed")

            if completed_count > last_completed_count and last_completed_count >= 0:
                # Yeni görev tamamlandı
                newly_done = completed_count - last_completed_count
                log(f"Yeni görev tamamlandı (+{newly_done}) → HANDOFF güncelleniyor", "OK")
                current_ai = get_current_ai(progress)
                generate_handoff(current_ai, f"Görev tamamlandı ({completed_count}/{len(tasks)})")

                # Her 5 görevde bir özel bildirim
                if completed_count % 5 == 0:
                    queue_notification(
                        title=f"🏆 {completed_count}/{len(tasks)} Görev Tamamlandı!",
                        message=f"{get_summary(progress)}\nHandoff belgesi güncellendi.",
                        priority="default",
                        tags="chart_increasing"
                    )

            last_completed_count = completed_count

            # Tüm görevler bitti mi?
            if all(t.get("status") in ("completed", "skipped") for t in tasks) and tasks:
                log("TÜM GÖREVLER TAMAMLANDI! 🎉", "OK")
                queue_notification(
                    title="🎉 ObservAI Geliştirme Tamamlandı!",
                    message=f"Tüm {len(tasks)} görev başarıyla tamamlandı!\nProje hazır.",
                    priority="high",
                    tags="tada,rocket"
                )
                break

    except KeyboardInterrupt:
        log("Orchestrator durduruldu.")


# ─── CLI ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    args = sys.argv[1:]

    if "--status" in args:
        show_status()

    elif "--handoff" in args:
        progress = load_progress()
        current_ai = get_current_ai(progress)
        ai_override = None
        if "--ai" in args:
            idx = args.index("--ai")
            ai_override = args[idx + 1] if len(args) > idx + 1 else None
        ai = ai_override or current_ai
        generate_handoff(ai, "Manuel handoff talebi")
        log(f"HANDOFF.md ve AI config dosyaları güncellendi ({ai})", "OK")

    elif "--next-ai" in args:
        idx = args.index("--next-ai")
        next_ai_override = args[idx + 1] if len(args) > idx + 1 else None
        progress = load_progress()
        current_ai = get_current_ai(progress)
        target = next_ai_override or get_next_ai(current_ai)
        new_ai = prepare_next_ai_session(current_ai, progress)
        print(f"\n{C.GREEN}✅ {current_ai} → {target} geçiş hazırlığı tamamlandı{C.RESET}")
        print(f"{C.CYAN}HANDOFF.md hazır. {target} için talimatlar ntfy'a gönderildi.{C.RESET}\n")

    elif "--monitor" in args:
        interval = 60
        if "--interval" in args:
            idx = args.index("--interval")
            try:
                interval = int(args[idx + 1])
            except (IndexError, ValueError):
                pass
        run_monitor(interval_sec=interval)

    else:
        # Varsayılan: durum göster + handoff güncelle
        show_status()
        progress = load_progress()
        current_ai = get_current_ai(progress)
        generate_handoff(current_ai, "Periyodik orchestrator güncellemesi")
        print(f"\n{C.GREEN}Kullanım:{C.RESET}")
        print("  python observai_orchestrator.py --status         # Durum")
        print("  python observai_orchestrator.py --handoff        # HANDOFF.md güncelle")
        print("  python observai_orchestrator.py --next-ai gemini # Gemini'ye geç")
        print("  python observai_orchestrator.py --monitor        # Sürekli izle (60s)")
        print("  python observai_orchestrator.py --monitor --interval 30")
