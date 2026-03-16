#!/usr/bin/env python3
"""
ObservAI — ntfy.sh Windows Notification Bridge
================================================
Bu script Windows'ta arka planda çalışır.
auto_dev_progress.json dosyasını izler ve değişiklik olduğunda
ntfy.sh üzerinden telefona bildirim gönderir.

VM Sandbox'tan internet erişimi olmadığı için bu bridge gereklidir:
  VM Claude → auto_dev_progress.json'a yazar → Bu script okur → ntfy.sh'a gönderir

Kurulum (Windows):
  python ntfy_bridge.py               # Tek çalıştır, arka planda izle
  python ntfy_bridge.py --test        # Test bildirimi gönder
  python ntfy_bridge.py --service     # Autostart için (bkz. kurulum talimatları)

Autostart için:
  Windows Task Scheduler'a ekle veya:
  pythonw ntfy_bridge.py   (arka planda çalışır, konsol gösterme)
"""

import json
import time
import sys
import os
import hashlib
import urllib.request
import urllib.error
import datetime
from pathlib import Path

# ─── Konfigürasyon ──────────────────────────────────────────────────────────

NTFY_URL         = "https://ntfy.sh/observai"
NTFY_APPROVE_URL = "https://ntfy.sh/observai-approve"  # Onay yanıtları buraya gelir
PROGRESS_FILE    = Path(__file__).parent / "auto_dev_progress.json"
CHECK_INTERVAL   = 5       # saniye — kaç saniyede bir dosyayı kontrol et
LOG_FILE         = Path(__file__).parent / "logs" / "ntfy_bridge.log"
APPROVE_POLL_FILE = Path(__file__).parent / "logs" / "approve_last_id.txt"  # Son onay msg ID'si

# ─── Bildirim Tanımları ──────────────────────────────────────────────────────

def send_ntfy(title: str, message: str, priority: str = "default",
              tags: str = "", click: str = "", actions: str = ""):
    """ntfy.sh'a bildirim gönder."""
    try:
        data = message.encode("utf-8")
        headers = {
            "Title": title.encode("utf-8"),
            "Priority": priority,
            "Content-Type": "text/plain; charset=utf-8",
        }
        if tags:
            headers["Tags"] = tags
        if click:
            headers["Click"] = click
        if actions:
            headers["Actions"] = actions

        req = urllib.request.Request(NTFY_URL, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        log(f"[ntfy ERROR] {e}")
        return False


def send_ntfy_with_approval(title: str, message: str, approval_key: str,
                             priority: str = "high", tags: str = "question"):
    """
    Onay butonu olan ntfy bildirimi gönder.

    Kullanıcı telefonda 'Onayla' tuşuna basınca ntfy.sh/observai-approve
    topic'ine mesaj yayınlar. Bridge bu topic'i dinleyip progress.json'a yazar.

    approval_key: 'auto_dev_proceed' | 'approve_task_X.Y.Z' | vb.
    """
    approve_msg = f"approved:{approval_key}"
    reject_msg  = f"rejected:{approval_key}"

    # ntfy action format:
    # publish, <button_label>, <ntfy_url>, body=<message>
    actions = (
        f"publish, ✅ Onayla, {NTFY_APPROVE_URL}, body={approve_msg}; "
        f"publish, ❌ Reddet, {NTFY_APPROVE_URL}, body={reject_msg}"
    )

    return send_ntfy(title=title, message=message, priority=priority,
                     tags=tags, actions=actions)


def poll_approvals() -> list[str]:
    """
    ntfy.sh/observai-approve topic'ini polling ile kontrol et.
    Yeni mesaj varsa geri döndür ve son ID'yi kaydet.

    ntfy.sh polling: GET https://ntfy.sh/observai-approve/json?since=<id>&poll=1
    """
    try:
        last_id = "all"
        if APPROVE_POLL_FILE.exists():
            saved = APPROVE_POLL_FILE.read_text().strip()
            if saved:
                last_id = saved

        url = f"{NTFY_APPROVE_URL}/json?since={last_id}&poll=1"
        req = urllib.request.Request(url, method="GET")
        req.add_header("Accept", "application/json")

        messages = []
        new_last_id = last_id

        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            # ntfy returns newline-delimited JSON
            for line in raw.strip().splitlines():
                if not line.strip():
                    continue
                try:
                    msg = json.loads(line)
                    msg_id = msg.get("id", "")
                    body = msg.get("message", "")
                    if body:
                        messages.append(body)
                    if msg_id:
                        new_last_id = msg_id
                except Exception:
                    continue

        if new_last_id != last_id:
            APPROVE_POLL_FILE.parent.mkdir(parents=True, exist_ok=True)
            APPROVE_POLL_FILE.write_text(new_last_id)

        return messages

    except Exception as e:
        log(f"[approval poll ERROR] {e}")
        return []


def process_approvals(messages: list[str]):
    """
    Onay mesajlarını işle ve progress.json'a yaz.

    Mesaj formatları:
      approved:auto_dev_proceed  → otomatik geliştirmeye devam
      approved:approve_task_1.2.2 → belirli görev onayı
      rejected:...               → reddetme (görevi atla)
    """
    if not messages:
        return

    try:
        with open(PROGRESS_FILE, encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return

    changed = False
    for msg in messages:
        msg = msg.strip()
        if msg.startswith("approved:"):
            key = msg[len("approved:"):]
            log(f"  [✓] ONAYLANDI: {key}")

            # Onayı progress.json'a yaz
            data.setdefault("approvals", {})[key] = {
                "status": "approved",
                "at": datetime.datetime.now().isoformat(),
            }

            # Eğer genel "auto_dev_proceed" onayıysa bekleyen task'ı in_progress'e al
            if key == "auto_dev_proceed":
                for task in data.get("tasks", []):
                    if task.get("status") == "pending":
                        task["status"] = "pending"  # script kendi yönetir
                        break
                data.setdefault("session", {})["user_approved_auto_dev"] = True

            send_ntfy(
                title=f"✅ Onay Alındı",
                message=f"'{key}' onaylandı. Geliştirme devam ediyor...",
                priority="low", tags="thumbsup"
            )
            changed = True

        elif msg.startswith("rejected:"):
            key = msg[len("rejected:"):]
            log(f"  [✗] REDDEDİLDİ: {key}")
            data.setdefault("approvals", {})[key] = {
                "status": "rejected",
                "at": datetime.datetime.now().isoformat(),
            }
            changed = True

    if changed:
        with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)


def log(msg: str):
    """Hem konsola hem log dosyasına yaz."""
    now = datetime.datetime.now().strftime("%H:%M:%S")
    line = f"[{now}] {msg}"
    print(line)
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


# ─── Progress Değişiklik Tespiti ─────────────────────────────────────────────

def get_file_hash(path: Path) -> str:
    """Dosya içeriğinin hash'ini döndür."""
    try:
        return hashlib.md5(path.read_bytes()).hexdigest()
    except Exception:
        return ""


def load_progress() -> dict:
    """Progress JSON'u yükle."""
    try:
        with open(PROGRESS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def notify_change(old_progress: dict, new_progress: dict):
    """Progress değişikliğine göre bildirim gönder."""
    old_tasks = {t["id"]: t for t in old_progress.get("tasks", [])}
    new_tasks = {t["id"]: t for t in new_progress.get("tasks", [])}

    notifications = []

    for task_id, new_task in new_tasks.items():
        old_task = old_tasks.get(task_id, {})
        old_status = old_task.get("status", "pending")
        new_status = new_task.get("status", "pending")

        if old_status == new_status:
            continue  # Değişmemiş

        name = new_task.get("name", task_id)

        if new_status == "in_progress" and old_status == "pending":
            notifications.append({
                "title": f"🔧 Görev Başladı [{task_id}]",
                "message": name,
                "priority": "default",
                "tags": "wrench",
            })
        elif new_status == "completed":
            notifications.append({
                "title": f"✅ Görev Tamamlandı [{task_id}]",
                "message": f"{name}\nBitiş: {new_task.get('completed_at', '?')}",
                "priority": "default",
                "tags": "white_check_mark",
            })
        elif new_status == "failed":
            error = new_task.get("last_error", "Bilinmiyor")
            notifications.append({
                "title": f"❌ Görev Başarısız [{task_id}]",
                "message": f"{name}\nHata: {error[:100]}",
                "priority": "high",
                "tags": "x",
            })

    # Session not değişikliği
    old_note = old_progress.get("session", {}).get("last_note", "")
    new_note = new_progress.get("session", {}).get("last_note", "")
    if new_note and new_note != old_note:
        # Sadece uzun notları göster (kısa olanlar rutin güncelleme)
        if len(new_note) > 50:
            notifications.append({
                "title": "📋 ObservAI Durum Güncellemesi",
                "message": new_note[:200],
                "priority": "low",
                "tags": "memo",
            })

    # Faz tamamlanması
    old_completed = sum(1 for t in old_progress.get("tasks", []) if t.get("status") == "completed")
    new_completed = sum(1 for t in new_progress.get("tasks", []) if t.get("status") == "completed")
    total = len(new_progress.get("tasks", []))

    if new_completed > old_completed and new_completed % 5 == 0:  # Her 5 görevde bir
        notifications.append({
            "title": f"🏆 İlerleme: {new_completed}/{total} Görev",
            "message": f"{new_completed} görev tamamlandı — {total - new_completed} kaldı",
            "priority": "default",
            "tags": "chart_increasing",
        })

    # Bildirimleri gönder
    for notif in notifications:
        success = send_ntfy(**notif)
        status = "✓" if success else "✗"
        log(f"  [{status}] ntfy → {notif['title']}: {notif['message'][:60]}")

    return len(notifications)


# ─── HANDOFF.md Değişiklik Bildirimi ─────────────────────────────────────────

def check_handoff_update(old_hash: str, new_hash: str) -> str:
    """HANDOFF.md değiştiyse bildirim gönder."""
    if old_hash and old_hash != new_hash:
        send_ntfy(
            title="🤖 AI Handoff Belgesi Güncellendi",
            message="HANDOFF.md güncellendi. Yeni AI'ya geçmek için hazır.",
            priority="low",
            tags="robot_face",
        )
        log("  [✓] HANDOFF.md değişikliği bildirimi gönderildi")
    return new_hash


# ─── Ana İzleme Döngüsü ──────────────────────────────────────────────────────


def _send_pending_notifications():
    """auto_dev_progress.json içindeki pending_notifications kuyruğunu işle."""
    try:
        if not PROGRESS_FILE.exists():
            return
        with open(PROGRESS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        
        pending = data.get("pending_notifications", [])
        if not pending:
            return
        
        sent = []
        for notif in pending:
            # actions alanı varsa approval bildirimi gönder
            actions_str = notif.get("actions", "")
            success = send_ntfy(
                title=notif.get("title", "ObservAI"),
                message=notif.get("message", ""),
                priority=notif.get("priority", "default"),
                tags=notif.get("tags", ""),
                actions=actions_str,
            )
            if success:
                sent.append(notif)
                log(f"  [✓] Kuyruk bildirimi gönderildi: {notif.get('title', '')[:50]}")
        
        if sent:
            # Başarıyla gönderilenleri kuyruktan kaldır
            data["pending_notifications"] = [n for n in pending if n not in sent]
            with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
                import json as _json
                _json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


def run_bridge():
    log("=" * 60)
    log("ObservAI ntfy Bridge başlatıldı")
    log(f"İzlenen dosya: {PROGRESS_FILE}")
    log(f"ntfy topic: {NTFY_URL}")
    log(f"Kontrol aralığı: {CHECK_INTERVAL}s")
    log("=" * 60)

    # Başlangıç bildirimi — bilgi amaçlı, onay gerektirmez
    send_ntfy(
        title="🚀 ObservAI Bridge Aktif",
        message=(
            "ntfy.sh Windows Bridge çalışıyor.\n"
            "Otomatik geliştirme devam ediyor.\n"
            "Görev tamamlandıkça bildirim gelecek."
        ),
        priority="default",
        tags="rocket",
    )

    last_progress_hash = get_file_hash(PROGRESS_FILE)
    last_progress = load_progress()

    handoff_file = PROGRESS_FILE.parent / "HANDOFF.md"
    last_handoff_hash = get_file_hash(handoff_file)

    log(f"İzleme başladı. Çıkmak için Ctrl+C.")

    try:
        while True:
            time.sleep(CHECK_INTERVAL)

            # Bekleyen bildirimleri (VM'den kuyruklanmış) gönder
            _send_pending_notifications()

            # Progress dosyasını kontrol et
            new_hash = get_file_hash(PROGRESS_FILE)
            if new_hash and new_hash != last_progress_hash:
                log(f"[DEĞIŞIKLIK] auto_dev_progress.json güncellendi")
                new_progress = load_progress()
                count = notify_change(last_progress, new_progress)
                if count == 0:
                    log("  (bildirim gerektiren değişiklik yok)")
                last_progress_hash = new_hash
                last_progress = new_progress

            # HANDOFF.md değişikliğini kontrol et
            new_handoff_hash = get_file_hash(handoff_file)
            if new_handoff_hash != last_handoff_hash:
                last_handoff_hash = check_handoff_update(last_handoff_hash, new_handoff_hash)

    except KeyboardInterrupt:
        log("\nBridge durduruldu.")
        send_ntfy(
            title="⏹ ObservAI Bridge Durdu",
            message="ntfy.sh Windows Bridge durduruldu.",
            priority="low",
            tags="stop_button",
        )


# ─── Komut Satırı ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    args = sys.argv[1:]

    if "--test" in args:
        print("Test bildirimi gönderiliyor...")
        success = send_ntfy(
            title="🧪 ObservAI Test",
            message="ntfy.sh bağlantısı çalışıyor! ObservAI bildirim sistemi hazır.",
            priority="high",
            tags="test_tube",
        )
        print("✓ Başarılı!" if success else "✗ Başarısız — internet bağlantısını kontrol et")

    elif "--once" in args:
        # Sadece bir kez kontrol et, döngüye girme
        progress = load_progress()
        completed = sum(1 for t in progress.get("tasks", []) if t.get("status") == "completed")
        total = len(progress.get("tasks", []))
        in_progress = [t for t in progress.get("tasks", []) if t.get("status") == "in_progress"]

        msg = f"{completed}/{total} görev tamamlandı"
        if in_progress:
            msg += f"\n🔄 Devam eden: {in_progress[0]['name']}"

        send_ntfy(title="📊 ObservAI Durum", message=msg, priority="low", tags="bar_chart")
        print(f"Bildirim gönderildi: {msg}")

    else:
        run_bridge()
