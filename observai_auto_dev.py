"""
ObservAI Otomatik Gelistirme Scripti v2
========================================
Bu script, ObservAI projesinin otomatik ve surekli gelistirilmesini yonetir.
PC acikken ve oyun calismiyorken, plana uygun sekilde projeyi gelistirir.
ntfy.sh uzerinden telefona bildirim gonderir.

Kullanim:
    python observai_auto_dev.py              # Durum goster + yardim
    python observai_auto_dev.py --status     # Mevcut durumu goster
    python observai_auto_dev.py --reset      # Ilerlemeyi sifirla
    python observai_auto_dev.py --skip       # Mevcut task'i atla
    python observai_auto_dev.py --dry-run    # Sadece kontrol yap
    python observai_auto_dev.py --once       # Tek task calistir
    python observai_auto_dev.py --continuous # Surekli mod (arka plan)
    python observai_auto_dev.py --test-ntfy  # ntfy bildirim testi

Gereksinimler:
    pip install psutil requests
"""

import json
import os
import sys
import time
import subprocess
import logging
import datetime
import hashlib
import urllib.request
import urllib.error
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Tuple
from enum import Enum

# ==============================================================================
# CONFIGURATION
# ==============================================================================

PROJECT_ROOT = Path(__file__).parent.resolve()
PROGRESS_FILE = PROJECT_ROOT / "auto_dev_progress.json"
LOG_DIR = PROJECT_ROOT / "logs"
LOG_FILE = LOG_DIR / "auto_dev.log"

# Token Limitleri
DAILY_TOKEN_LIMIT = 500_000
PER_TASK_TOKEN_LIMIT = 80_000
TOKEN_WARNING_THRESHOLD = 0.80  # %80'e ulasinca uyar

# Zamanlama
MAX_RETRIES_PER_TASK = 3
CHECK_INTERVAL_SECONDS = 1800    # 30 dakika
GAME_CHECK_INTERVAL = 60         # 1 dakika

# ==============================================================================
# NTFY CONFIGURATION
# ==============================================================================

NTFY_TOPIC = "ntfy.sh/observai"
NTFY_URL = "https://ntfy.sh/observai"
NTFY_ENABLED = True

# Bildirim oncelik seviyeleri (ntfy standardi)
class NotifyPriority:
    MIN = "1"       # Bilgi - sessiz
    LOW = "2"       # Dusuk
    DEFAULT = "3"   # Normal
    HIGH = "4"      # Yuksek
    URGENT = "5"    # Acil - telefon titresim

# Bildirim kategorileri ve emoji'leri
class NotifyCategory:
    TASK_START = ("wrench", "Gorev Basladi")
    TASK_COMPLETE = ("white_check_mark", "Gorev Tamamlandi")
    TASK_FAILED = ("x", "Gorev Basarisiz")
    TASK_RETRY = ("arrows_counterclockwise", "Tekrar Deneniyor")
    TASK_SKIPPED = ("fast_forward", "Gorev Atlandi")
    TEST_START = ("test_tube", "Test Basladi")
    TEST_PASS = ("check_mark", "Test Basarili")
    TEST_FAIL = ("warning", "Test Basarisiz")
    APPROVAL_NEEDED = ("raised_hand", "Onay Gerekli")
    SYSTEM_READY = ("rocket", "Sistem Hazir")
    SYSTEM_PAUSED = ("pause_button", "Sistem Durakladi")
    SYSTEM_GAME = ("video_game", "Oyun Tespit Edildi")
    SYSTEM_OFFLINE = ("cloud_with_lightning", "PC Kapali/Erisim Yok")
    TOKEN_WARNING = ("hourglass", "Token Uyarisi")
    TOKEN_LIMIT = ("stop_sign", "Token Limiti")
    PROGRESS_UPDATE = ("chart_increasing", "Ilerleme Raporu")
    SESSION_START = ("star", "Oturum Basladi")
    SESSION_END = ("moon", "Oturum Bitti")
    PHASE_COMPLETE = ("trophy", "Faz Tamamlandi")
    ERROR = ("rotating_light", "Hata")


# ==============================================================================
# NTFY NOTIFICATION SYSTEM
# ==============================================================================


def _queue_notification_fallback(title: str, message: str, priority: str = "3", tags: str = ""):
    """VM'den ntfy gönderilemediğinde, bildirimi progress dosyasına kuyruğa al.
    
    Windows ntfy_bridge.py bu kuyruğu okuyarak ntfy.sh'a iletir.
    """
    try:
        import datetime
        if not PROGRESS_FILE.exists():
            return
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        if "pending_notifications" not in data:
            data["pending_notifications"] = []
        
        data["pending_notifications"].append({
            "title": title,
            "message": message,
            "priority": priority,
            "tags": tags,
            "queued_at": datetime.datetime.now().isoformat(),
        })
        
        # Keep max 20 pending notifications to avoid file bloat
        data["pending_notifications"] = data["pending_notifications"][-20:]
        
        with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception:
        pass  # Silently fail — don't let logging errors break the main flow


def send_ntfy(
    title: str,
    message: str,
    priority: str = NotifyPriority.DEFAULT,
    tags: str = "",
    click_url: str = "",
    actions: str = ""
) -> bool:
    """ntfy.sh uzerinden bildirim gonder."""
    if not NTFY_ENABLED:
        return False

    try:
        data = message.encode("utf-8")
        req = urllib.request.Request(NTFY_URL, data=data, method="POST")
        req.add_header("Title", title)
        req.add_header("Priority", priority)

        if tags:
            req.add_header("Tags", tags)
        if click_url:
            req.add_header("Click", click_url)
        if actions:
            req.add_header("Actions", actions)

        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                logger.debug(f"ntfy bildirim gonderildi: {title}")
                return True
            else:
                logger.warning(f"ntfy yanit kodu: {resp.status}")
                return False

    except urllib.error.URLError as e:
        logger.warning(f"ntfy gonderilemedi (ag hatasi - VM kısıtlaması olabilir): {e}")
        # Fallback: Write to pending_notifications in progress file
        # Windows ntfy_bridge.py will pick this up and send
        _queue_notification_fallback(title, message, priority, tags)
        return False
    except Exception as e:
        logger.warning(f"ntfy gonderilemedi: {e}")
        _queue_notification_fallback(title, message, priority, tags)
        return False
    except Exception as e:
        logger.warning(f"ntfy hatasi: {e}")
        return False


def notify_task_start(task_id: str, task_name: str, phase: int, retry: int, estimated_tokens: int):
    """Gorev basladiginda bildirim."""
    tag, _ = NotifyCategory.TASK_START
    retry_text = f" (Deneme {retry}/{MAX_RETRIES_PER_TASK})" if retry > 1 else ""
    send_ntfy(
        title=f"Gorev Basladi: {task_id}{retry_text}",
        message=(
            f"Faz {phase} | {task_name}\n"
            f"Tahmini token: ~{estimated_tokens:,}\n"
            f"Prompt hazirlaniyor ve AI'a gonderiliyor..."
        ),
        priority=NotifyPriority.DEFAULT,
        tags=tag
    )


def notify_task_complete(task_id: str, task_name: str, tokens_used: int, total_progress: str):
    """Gorev tamamlandiginda bildirim."""
    tag, _ = NotifyCategory.TASK_COMPLETE
    send_ntfy(
        title=f"Gorev Tamamlandi: {task_id}",
        message=(
            f"{task_name}\n"
            f"Harcanan token: ~{tokens_used:,}\n"
            f"Genel ilerleme: {total_progress}"
        ),
        priority=NotifyPriority.DEFAULT,
        tags=tag
    )


def notify_task_failed(task_id: str, task_name: str, error: str, retry: int):
    """Gorev basarisiz olduguinda bildirim."""
    tag, _ = NotifyCategory.TASK_FAILED
    remaining = MAX_RETRIES_PER_TASK - retry
    send_ntfy(
        title=f"Gorev Basarisiz: {task_id} ({remaining} deneme kaldi)",
        message=(
            f"{task_name}\n"
            f"Hata: {error[:200]}\n"
            f"{'Sonraki denemede farkli yaklasim denenecek.' if remaining > 0 else 'Max deneme asildi, gorev atlaniyor!'}"
        ),
        priority=NotifyPriority.HIGH if remaining == 0 else NotifyPriority.DEFAULT,
        tags=tag
    )


def notify_task_retry(task_id: str, task_name: str, retry: int, approach: str):
    """Gorev tekrar denendiginde bildirim."""
    tag, _ = NotifyCategory.TASK_RETRY
    send_ntfy(
        title=f"Tekrar Deneniyor: {task_id} (Deneme {retry}/{MAX_RETRIES_PER_TASK})",
        message=f"{task_name}\nYeni yaklasim: {approach}",
        priority=NotifyPriority.LOW,
        tags=tag
    )


def notify_task_skipped(task_id: str, task_name: str, reason: str):
    """Gorev atlandiginda bildirim."""
    tag, _ = NotifyCategory.TASK_SKIPPED
    send_ntfy(
        title=f"Gorev Atlandi: {task_id}",
        message=f"{task_name}\nSebep: {reason}",
        priority=NotifyPriority.HIGH,
        tags=tag
    )


def notify_test_start(task_id: str, test_type: str):
    """Test basladiginda bildirim."""
    tag, _ = NotifyCategory.TEST_START
    send_ntfy(
        title=f"Test Basladi: {task_id}",
        message=f"Test turu: {test_type}\nSonuclar bekleniyor...",
        priority=NotifyPriority.LOW,
        tags=tag
    )


def notify_test_result(task_id: str, passed: bool, details: str):
    """Test sonucu bildirimi."""
    if passed:
        tag, _ = NotifyCategory.TEST_PASS
        send_ntfy(
            title=f"Test Basarili: {task_id}",
            message=details,
            priority=NotifyPriority.LOW,
            tags=tag
        )
    else:
        tag, _ = NotifyCategory.TEST_FAIL
        send_ntfy(
            title=f"Test Basarisiz: {task_id}",
            message=f"{details}\nGorev tekrar denenecek.",
            priority=NotifyPriority.HIGH,
            tags=tag
        )


def notify_approval_needed(task_id: str, task_name: str, reason: str):
    """Kullanici onayi gerektiginde bildirim."""
    tag, _ = NotifyCategory.APPROVAL_NEEDED
    send_ntfy(
        title=f"ONAY GEREKLI: {task_id}",
        message=(
            f"{task_name}\n"
            f"Sebep: {reason}\n"
            f"Lutfen Claude Cowork'e girin ve onayi verin."
        ),
        priority=NotifyPriority.URGENT,
        tags=tag
    )


def notify_system_status(status: str, detail: str):
    """Sistem durumu bildirimi."""
    category_map = {
        "ready": NotifyCategory.SYSTEM_READY,
        "paused": NotifyCategory.SYSTEM_PAUSED,
        "game": NotifyCategory.SYSTEM_GAME,
        "offline": NotifyCategory.SYSTEM_OFFLINE,
        "error": NotifyCategory.ERROR,
    }
    tag, label = category_map.get(status, NotifyCategory.ERROR)
    priority = NotifyPriority.HIGH if status in ("error", "offline") else NotifyPriority.LOW
    send_ntfy(
        title=f"Sistem: {label}",
        message=detail,
        priority=priority,
        tags=tag
    )


def notify_token_status(tokens_today: int, daily_limit: int, task_tokens: int = 0):
    """Token durumu bildirimi."""
    ratio = tokens_today / daily_limit
    if ratio >= 1.0:
        tag, _ = NotifyCategory.TOKEN_LIMIT
        send_ntfy(
            title="TOKEN LIMITI ASILDI",
            message=(
                f"Bugunun tokeni: {tokens_today:,}/{daily_limit:,}\n"
                f"Yarin devam edilecek.\n"
                f"Limit artirmak icin scriptteki DAILY_TOKEN_LIMIT degerini degistirin."
            ),
            priority=NotifyPriority.URGENT,
            tags=tag
        )
    elif ratio >= TOKEN_WARNING_THRESHOLD:
        tag, _ = NotifyCategory.TOKEN_WARNING
        remaining = daily_limit - tokens_today
        send_ntfy(
            title=f"Token Uyarisi: %{int(ratio*100)} kullanildi",
            message=(
                f"Kullanilan: {tokens_today:,}/{daily_limit:,}\n"
                f"Kalan: {remaining:,} token\n"
                f"Son islem: {task_tokens:,} token"
            ),
            priority=NotifyPriority.HIGH,
            tags=tag
        )


def notify_progress_report(progress: Dict):
    """Ilerleme raporu bildirimi."""
    tag, _ = NotifyCategory.PROGRESS_UPDATE
    tasks = progress.get("tasks", [])
    total = len(tasks)
    completed = sum(1 for t in tasks if t["status"] == "completed")
    skipped = sum(1 for t in tasks if t["status"] == "skipped")
    failed = sum(1 for t in tasks if t["status"] == "failed")
    pending = total - completed - skipped - failed
    total_tokens = sum(t.get("tokens_used", 0) for t in tasks)

    # Mevcut fazi bul
    current_phase = 0
    for t in tasks:
        if t["status"] in ("pending", "in_progress"):
            task_def = next((d for d in DEVELOPMENT_TASKS if d.id == t["id"]), None)
            if task_def:
                current_phase = task_def.phase
                break

    phase_names = {1: "Kamera Stabilite", 2: "Performans", 3: "AI Insight", 4: "Ek Ozellikler"}

    send_ntfy(
        title=f"Ilerleme: {completed}/{total} gorev (%{int(completed/total*100) if total > 0 else 0})",
        message=(
            f"Tamamlanan: {completed} | Bekleyen: {pending} | Atlanan: {skipped}\n"
            f"Toplam token: {total_tokens:,}\n"
            f"Mevcut faz: {current_phase} - {phase_names.get(current_phase, '?')}\n"
            f"Bugunun tokeni: {progress.get('total_tokens_today', 0):,}/{DAILY_TOKEN_LIMIT:,}"
        ),
        priority=NotifyPriority.DEFAULT,
        tags=tag
    )


def notify_session(event: str, detail: str = ""):
    """Oturum baslangic/bitis bildirimi."""
    if event == "start":
        tag, _ = NotifyCategory.SESSION_START
        send_ntfy(
            title="ObservAI Gelistirme Basladi",
            message=detail or "Sistem kontrolleri yapiliyor, siradaki gorev seciliyor...",
            priority=NotifyPriority.DEFAULT,
            tags=tag
        )
    elif event == "end":
        tag, _ = NotifyCategory.SESSION_END
        send_ntfy(
            title="ObservAI Gelistirme Durakladi",
            message=detail or "Oturum tamamlandi. Sonraki kontrolde devam edilecek.",
            priority=NotifyPriority.LOW,
            tags=tag
        )


def notify_phase_complete(phase: int, phase_name: str):
    """Faz tamamlandiginda bildirim."""
    tag, _ = NotifyCategory.PHASE_COMPLETE
    send_ntfy(
        title=f"FAZ {phase} TAMAMLANDI!",
        message=f"{phase_name}\nTebrikler! Sonraki faza geciliyor.",
        priority=NotifyPriority.HIGH,
        tags=tag
    )


# ==============================================================================
# STEAM/EPIC GAME DETECTION
# ==============================================================================

LAUNCHER_ONLY_PROCESSES = {
    "steam.exe", "steamwebhelper.exe", "steamservice.exe",
    "EpicGamesLauncher.exe", "EpicWebHelper.exe",
    "EpicOnlineServices.exe"
}

KNOWN_GAME_PROCESSES: set = set()


# ==============================================================================
# LOGGING SETUP
# ==============================================================================

LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("ObservAI-AutoDev")


# ==============================================================================
# DATA MODELS
# ==============================================================================

class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    FAILED = "failed"


@dataclass
class DevTask:
    id: str
    phase: int
    name: str
    description: str
    estimated_tokens: int
    priority: str
    status: TaskStatus = TaskStatus.PENDING
    retries: int = 0
    tokens_used: int = 0
    last_error: str = ""
    completed_at: str = ""
    prompt_template: str = ""
    test_criteria: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)


# ==============================================================================
# TASK DEFINITIONS
# ==============================================================================

DEVELOPMENT_TASKS = [
    # ==================== FAZ 1: Kamera Stabilite ====================
    DevTask(
        id="1.1.1", phase=1, name="Backend Health-Check Endpoint",
        description="Python backend hazir olup olmadigini kontrol eden endpoint",
        estimated_tokens=20000, priority="critical",
        prompt_template="""
ObservAI projesinde Python camera analytics backend'inin hazir olup olmadigini
kontrol eden bir health-check mekanizmasi ekle.

Yapilacaklar:
1. Python WebSocket server'a (websocket_server.py) bir /health endpoint ekle
   - Model yuklu mu kontrol et
   - Video source bagli mi kontrol et
   - JSON dondur: {{"status": "ready"|"loading"|"error", "model_loaded": bool, "source_connected": bool}}
2. Node.js backend'e (routes/python-backend.ts) proxy endpoint ekle
   - GET /api/python-backend/health -> Python /health'e yonlendir
3. Frontend'den cagrilabilir olmali

Mevcut dosyalar:
- packages/camera-analytics/camera_analytics/websocket_server.py
- backend/src/routes/python-backend.ts
- backend/src/lib/pythonBackendManager.ts
""",
        test_criteria=[
            "GET /api/python-backend/health 200 dondurur",
            "Python backend kapaliyken 503 dondurur",
            "Model yukleme durumu dogru raporlanir"
        ]
    ),
    DevTask(
        id="1.1.2", phase=1, name="Frontend Baglanti State Machine",
        description="CameraFeed'de guvenilir baglanti yonetimi",
        estimated_tokens=40000, priority="critical",
        dependencies=["1.1.1"],
        prompt_template="""
ObservAI projesinde CameraFeed.tsx bilesen indeki baglanti yonetimini iyilestir.

Sorun: Kamera secildiginde goruntu gelmiyor, birkac yeniden baslatma gerekiyor.

Yapilacaklar:
1. Baglanti State Machine:
   - DISCONNECTED -> CONNECTING -> WAITING_FOR_BACKEND -> CONNECTED -> STREAMING
   - Her state'te kullaniciya uygun mesaj goster

2. Exponential Backoff Retry:
   - Ilk deneme: 1 sn, 2. deneme: 2 sn, 3. deneme: 4 sn
   - Max 5 deneme, sonra kullaniciya hata goster

3. Backend Readiness Check:
   - /api/python-backend/health endpoint'ini kullan
   - Backend hazir olana kadar video baglantisi baslatma
   - Polling interval: 2 saniye

4. Socket.IO baglanti iyilestirmesi:
   - reconnection: true, reconnectionDelay: 1000
   - reconnectionAttempts: 10, timeout: 20000

5. UI Gosterimi:
   - Yukleniyor animasyonu
   - Durum mesajlari
   - Hata durumunda "Tekrar Dene" butonu

Mevcut dosyalar:
- frontend/src/components/camera/CameraFeed.tsx
- frontend/src/services/cameraBackendService.ts
""",
        test_criteria=[
            "Ilk acilista 5 saniye icinde goruntu baslar",
            "Backend kapaliyken uygun hata mesaji gosterir",
            "Otomatik yeniden baglanma calisir"
        ]
    ),
    DevTask(
        id="1.1.3", phase=1, name="Python Backend Ready Event",
        description="Python WebSocket server'da hazirlik durumu event'i",
        estimated_tokens=20000, priority="critical",
        prompt_template="""
ObservAI Python camera analytics backend'inde hazirlik durumunu Socket.IO ile yayinla.

Yapilacaklar:
1. websocket_server.py'de startup sequence:
   - emit("status", {{"phase": "loading_model"}})
   - emit("status", {{"phase": "model_ready"}})
   - emit("status", {{"phase": "source_connected"}})
   - emit("status", {{"phase": "streaming"}})
2. analytics.py'de model yukleme callback'leri
3. sources.py'de baglanti durumu callback'leri
4. Hata: emit("status", {{"phase": "error", "message": "..."}})

Mevcut dosyalar:
- packages/camera-analytics/camera_analytics/websocket_server.py
- packages/camera-analytics/camera_analytics/analytics.py
- packages/camera-analytics/camera_analytics/sources.py
""",
        test_criteria=[
            "Status event'leri dogru sirada yayinlanir",
            "Frontend status event'lerini alir",
            "Hata durumunda error mesaji"
        ]
    ),
    DevTask(
        id="1.2.1", phase=1, name="Model Preloading Mekanizmasi",
        description="YOLO ve InsightFace modellerini startup'ta yukle",
        estimated_tokens=25000, priority="critical",
        prompt_template="""
ObservAI'da AI modellerinin startup sirasinda onceden yuklenmesini sagla.

Yapilacaklar:
1. analytics.py'de model yuklemeyi __init__'te yap
2. YOLO: startup'ta dummy inference (warm-up)
3. InsightFace: startup'ta initialize, dummy face ile test
4. Model yukleme suresini logla
5. GPU varsa GPU'ya yukle, yoksa CPU fallback
6. InsightFace yuklenemezse YOLO-only mod

Mevcut dosyalar:
- packages/camera-analytics/camera_analytics/analytics.py
- packages/camera-analytics/camera_analytics/age_gender.py
""",
        test_criteria=[
            "Startup'ta modeller 10 sn icinde yuklenir",
            "Ilk frame'de detection calisir",
            "InsightFace hatasi durumunda YOLO devam eder"
        ]
    ),
    DevTask(
        id="1.2.2", phase=1, name="Entegrasyon Testi - Kamera Stabilite",
        description="Faz 1 end-to-end test",
        estimated_tokens=30000, priority="critical",
        dependencies=["1.1.1", "1.1.2", "1.1.3", "1.2.1"],
        prompt_template="""
ObservAI kamera stabilite iyilestirmelerini test et.

Test Senaryolari:
1. Temiz baslatma: 5 sn icinde goruntu + detection
2. Yeniden baglanma: Python backend kapanip acilinca otomatik baglan
3. Kamera degistirme: 3 sn icinde gecis
4. Chrome DevTools Network kontrolu
5. 10 ardisik baslatma testi
""",
        test_criteria=["10/10 basarili baslatma", "Yeniden baglanma 5 sn icinde", "Kamera degisimi sorunsuz"]
    ),

    # ==================== FAZ 2: Performans ====================
    DevTask(
        id="2.1.1", phase=2, name="Asenkron Processing Pipeline",
        description="Frame capture, inference, demographics icin ayri thread'ler",
        estimated_tokens=40000, priority="high", dependencies=["1.2.2"],
        prompt_template="""
ObservAI'da performans icin asenkron processing pipeline kur.

3-Thread Pipeline:
- CaptureThread: Surekli frame yakala (30 FPS)
- InferenceThread: YOLO detection (10-15 FPS)
- DemographicsThread: Yas/cinsiyet (5 FPS)

Thread-safe veri paylasimi, frame skip stratejisi, resolution optimization.

Mevcut dosyalar:
- packages/camera-analytics/camera_analytics/analytics.py
- packages/camera-analytics/camera_analytics/run_with_websocket.py
""",
        test_criteria=["FPS >= 15 (720p)", "Detection latency < 200ms", "Thread senkronizasyonu sorunsuz"]
    ),
    DevTask(
        id="2.1.2", phase=2, name="YOLO Model Optimizasyonu",
        description="Model konfigurasyon ve inference optimizasyonu",
        estimated_tokens=30000, priority="high",
        prompt_template="""
ObservAI'da YOLO model performansini optimize et.

1. Input size: 640 -> 416 veya 320 (benchmark)
2. NMS threshold ayarla: conf=0.35, iou=0.5
3. Sadece person class: classes=[0]
4. FP16 half precision (GPU varsa)
5. Benchmark scripti yaz

Mevcut dosyalar:
- packages/camera-analytics/camera_analytics/analytics.py
""",
        test_criteria=["FPS %30+ artis", "Detection dogrulugu > %90", "Benchmark loglari"]
    ),
    DevTask(
        id="2.2.1", phase=2, name="Demografik Tahmin Iyilestirme",
        description="Temporal smoothing, cache ve kalite filtresi",
        estimated_tokens=40000, priority="high",
        prompt_template="""
ObservAI'da yas/cinsiyet tahmin dogrulugunu artir.

1. Temporal Smoothing: Son 10 tahmin, confidence-weighted average, median filtre
2. Yuz Kalite Filtresi: Min 48x48 px, blur detection, yuz acisi kontrolu
3. Kisi Bazli Cache: Tracking ID ile eslestirilmis, 5 frame sonra kilitle
4. InsightFace model secimi: buffalo_l vs buffalo_sc benchmark

Mevcut dosyalar:
- packages/camera-analytics/camera_analytics/age_gender.py
- packages/camera-analytics/camera_analytics/analytics.py
""",
        test_criteria=["Frame-to-frame varyans < %10", "Cinsiyet dogrulugu > %85", "Yas grubu dogrulugu > %70"]
    ),
    DevTask(
        id="2.2.2", phase=2, name="Performans Entegrasyon Testi",
        description="Faz 2 performans testleri",
        estimated_tokens=30000, priority="high", dependencies=["2.1.1", "2.1.2", "2.2.1"],
        prompt_template="""
ObservAI performans optimizasyonlarini test et.

1. FPS Benchmark: 720p webcam >= 15 FPS, YouTube >= 10 FPS, 5 dk surekli
2. Demografik dogruluk: Tutarlilik kontrolu
3. Kaynak kullanimi: CPU < %70, RAM < 2GB
4. Chrome DevTools Performance, Memory tab
5. 30 dk stres testi
""",
        test_criteria=["15+ FPS 720p", "5 dk stabil calisma", "Memory leak yok"]
    ),

    # ==================== FAZ 3: AI Insight ====================
    DevTask(
        id="3.1.1", phase=3, name="Insight Engine Backend Servisi",
        description="Kural tabanli insight motoru",
        estimated_tokens=50000, priority="medium", dependencies=["2.2.2"],
        prompt_template="""
ObservAI'da AI Insight engine backend servisi olustur.

1. backend/src/services/insightEngine.ts
2. Gercek zamanli kurallar: CROWDING, LONG_STAY, RAPID_INCREASE, LOW_TRAFFIC
3. Donemsel icgoruler: PEAK_HOURS, DEMOGRAPHIC_TREND, ZONE_COMPARISON
4. Gemini onerileri: Analytics context + NL prompt
5. API: GET /api/insights/realtime, /periodic, /recommendations, POST /ask
6. WebSocket push: "new_insight" event

Mevcut dosyalar:
- backend/src/routes/ai.ts
- backend/src/routes/analytics.ts
""",
        test_criteria=["Uyarilar dogru tetiklenir", "Donemsel icgoruler hesaplanir", "Gemini onerileri anlamli"]
    ),
    DevTask(
        id="3.2.1", phase=3, name="AI Insights Frontend Sayfasi",
        description="AI Insights sayfasini tam fonksiyonel yap",
        estimated_tokens=50000, priority="medium", dependencies=["3.1.1"],
        prompt_template="""
ObservAI AIInsightsPage.tsx'i tam fonksiyonel hale getir.

1. Insight kartlari: kategori ikonu, oncelik rengi, zaman, aciklama
2. Gercek zamanli uyarilar: WebSocket ile otomatik guncelleme
3. Trend grafikleri: ECharts ile ziyaretci, demografik, zone
4. AI Soru-Cevap: Metin girisi + Gemini yaniti
5. Responsive: 3 sutun desktop, 2 tablet, 1 mobil

Mevcut dosyalar:
- frontend/src/pages/dashboard/AIInsightsPage.tsx
""",
        test_criteria=["Insight kartlari dogru gosterilir", "WebSocket guncellemeleri calisir", "Soru-cevap calisir"]
    ),
    DevTask(
        id="3.2.2", phase=3, name="Bildirim Sistemi",
        description="Gercek zamanli bildirim sistemi",
        estimated_tokens=35000, priority="medium", dependencies=["3.1.1"],
        prompt_template="""
ObservAI'da bildirim sistemi implementasyonu.

1. Backend: Insight uyarilari -> bildirim, DB kaydi, WebSocket push
2. Frontend: TopNavbar'da ikon + badge, dropdown liste
3. Notifications sayfasi: Filtre, sayfalama, toplu okundu isaretleme

Mevcut dosyalar:
- frontend/src/pages/dashboard/NotificationsPage.tsx
- frontend/src/components/layout/TopNavbar.tsx
""",
        test_criteria=["Badge dogru sayi gosterir", "WebSocket bildirimi aninda gelir", "Okundu isaretleme calisir"]
    ),
    DevTask(
        id="3.3.1", phase=3, name="AI Insight Entegrasyon Testi",
        description="Faz 3 entegrasyon testi",
        estimated_tokens=30000, priority="medium", dependencies=["3.2.1", "3.2.2"],
        prompt_template="""
ObservAI AI Insight ozelliklerini test et.

1. Gercek zamanli uyari: Kalabalik -> CROWDING_ALERT
2. AI Soru-Cevap: "Su an kac kisi var?", "En yogun zone?"
3. Insight sayfasi gorsel test: Kartlar, grafikler, responsive
4. Bildirim testi: Badge, okundu, dropdown
""",
        test_criteria=["Uyarilar tetiklenir", "Soru-cevap calisir", "UI sorunsuz"]
    ),

    # ==================== FAZ 4: Ek Ozellikler ====================
    DevTask(
        id="4.1.1", phase=4, name="Historical Analytics Sayfasi",
        description="Tarihsel veri analizi sayfasi",
        estimated_tokens=45000, priority="low", dependencies=["3.3.1"],
        prompt_template="""
ObservAI Historical Analytics sayfasini gelistir.

1. Tarih secici + hazir araliklar
2. Karsilastirmali grafikler
3. Zone bazli analiz
4. PDF/CSV export

Mevcut dosyalar:
- frontend/src/pages/dashboard/HistoricalAnalyticsPage.tsx
- backend/src/routes/analytics.ts, export.ts
""",
        test_criteria=["Tarih secimi calisir", "Grafikler veri gosterir", "Export fonksiyonel"]
    ),
    DevTask(
        id="4.2.1", phase=4, name="Settings Sayfasi Iyilestirme",
        description="Ayarlar sayfasini fonksiyonel yap",
        estimated_tokens=35000, priority="low", dependencies=["3.3.1"],
        prompt_template="""
ObservAI Settings sayfasini gelistir.

1. Kamera ayarlari: ekleme/duzenleme/silme
2. Bildirim tercihleri
3. Kullanici profili: isim, email, sifre
4. Sistem: dil secimi, tema toggle

Mevcut dosyalar:
- frontend/src/pages/dashboard/SettingsPage.tsx
- backend/src/routes/cameras.ts, users.ts
""",
        test_criteria=["Kamera ekleme/silme calisir", "Ayarlar kaydedilir", "Profil guncelleme calisir"]
    ),
]


# ==============================================================================
# SYSTEM CHECKS
# ==============================================================================

def is_game_running() -> bool:
    """Steam/Epic Games oyun kontrol et."""
    try:
        import psutil
    except ImportError:
        logger.warning("psutil yuklu degil, oyun kontrolu atlaniyor")
        return False

    try:
        for proc in psutil.process_iter(['name', 'exe']):
            try:
                proc_name = proc.info['name'] or ""
                proc_exe = proc.info['exe'] or ""

                if proc_name in LAUNCHER_ONLY_PROCESSES:
                    continue

                if proc_name.lower() in {g.lower() for g in KNOWN_GAME_PROCESSES}:
                    logger.info(f"Oyun tespit edildi: {proc_name}")
                    return True

                if proc_exe and ("steamapps" in proc_exe.lower() or "epic games" in proc_exe.lower()):
                    if proc_name not in LAUNCHER_ONLY_PROCESSES:
                        logger.info(f"Oyun tespit edildi: {proc_name} - {proc_exe}")
                        return True

            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
    except Exception as e:
        logger.error(f"Oyun kontrolu hatasi: {e}")

    return False


def is_internet_available() -> bool:
    """Internet baglanti kontrolu."""
    for url in ["https://ntfy.sh", "https://www.google.com"]:
        try:
            urllib.request.urlopen(url, timeout=5)
            return True
        except Exception:
            continue
    return False


def check_system_ready() -> Tuple[bool, str]:
    """Sistem hazirlik kontrolu."""
    if not is_internet_available():
        return False, "Internet baglantisi yok"

    if is_game_running():
        return False, "Steam/Epic Games uzerinde oyun calisiyor"

    return True, "Sistem hazir"


# ==============================================================================
# PROGRESS MANAGEMENT
# ==============================================================================

def load_progress() -> Dict:
    """Ilerleme dosyasini yukle veya yeni olustur."""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

    progress = {
        "tasks": [],
        "total_tokens_today": 0,
        "last_run_date": "",
        "last_task_id": "",
        "session_count": 0,
        "created_at": datetime.datetime.now().isoformat(),
        "updated_at": datetime.datetime.now().isoformat(),
        "completed_phases": [],
        "notification_log": []
    }

    for task in DEVELOPMENT_TASKS:
        progress["tasks"].append({
            "id": task.id,
            "phase": task.phase,
            "name": task.name,
            "status": TaskStatus.PENDING.value,
            "retries": 0,
            "tokens_used": 0,
            "last_error": "",
            "completed_at": "",
            "started_at": ""
        })

    save_progress(progress)
    return progress


def save_progress(progress: Dict):
    """Ilerlemeyi kaydet."""
    progress["updated_at"] = datetime.datetime.now().isoformat()
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)


def get_progress_summary(progress: Dict) -> str:
    """Ilerleme ozeti string."""
    tasks = progress.get("tasks", [])
    total = len(tasks)
    completed = sum(1 for t in tasks if t["status"] == "completed")
    return f"{completed}/{total} (%{int(completed/total*100) if total > 0 else 0})"


def check_phase_completion(progress: Dict, phase: int) -> bool:
    """Faz tamamlandi mi kontrol et."""
    phase_tasks = [t for t in progress["tasks"]
                   if any(d.phase == phase and d.id == t["id"] for d in DEVELOPMENT_TASKS)]
    return all(t["status"] in ("completed", "skipped") for t in phase_tasks)


def get_next_task(progress: Dict) -> Optional[Dict]:
    """Siradaki task'i bul."""
    today = datetime.date.today().isoformat()

    # Gunluk token limiti
    if progress.get("last_run_date") == today:
        if progress.get("total_tokens_today", 0) >= DAILY_TOKEN_LIMIT:
            notify_token_status(progress["total_tokens_today"], DAILY_TOKEN_LIMIT)
            logger.warning(f"Gunluk token limiti asildi: {progress['total_tokens_today']}/{DAILY_TOKEN_LIMIT}")
            return None
    else:
        progress["total_tokens_today"] = 0
        progress["last_run_date"] = today
        save_progress(progress)

    task_map = {t["id"]: t for t in progress["tasks"]}

    for dev_task in DEVELOPMENT_TASKS:
        task_progress = task_map.get(dev_task.id)
        if not task_progress:
            continue

        status = task_progress["status"]

        if status in (TaskStatus.COMPLETED.value, TaskStatus.SKIPPED.value):
            continue

        if status == TaskStatus.FAILED.value and task_progress["retries"] >= MAX_RETRIES_PER_TASK:
            continue

        deps_met = True
        for dep_id in dev_task.dependencies:
            dep_progress = task_map.get(dep_id)
            if dep_progress and dep_progress["status"] != TaskStatus.COMPLETED.value:
                deps_met = False
                break

        if not deps_met:
            continue

        return {"task": dev_task, "progress": task_progress}

    return None


# ==============================================================================
# TASK EXECUTION
# ==============================================================================

def generate_prompt_for_task(task: DevTask) -> str:
    """Task icin AI promptunu hazirla."""
    prompt = f"""# ObservAI Gelistirme: {task.name}
## Faz {task.phase} - {task.priority.upper()} Oncelik | Task ID: {task.id}

{task.prompt_template}

## Test Kriterleri:
"""
    for i, criteria in enumerate(task.test_criteria, 1):
        prompt += f"{i}. {criteria}\n"

    prompt += """
## Kurallar:
- Mevcut calisan kodu bozmadan degisiklik yap
- Her degisikligi test et
- Hata durumunda geri al ve farkli yaklasim dene
- Loop'a dusme - max 3 farkli yaklasim dene
- Kucuk, test edilebilir parcalar halinde calis
"""
    return prompt


def execute_task_with_ai(task: DevTask, progress_entry: Dict) -> Optional[bool]:
    """Task'i AI ile calistir."""
    prompt = generate_prompt_for_task(task)

    # Prompt'u dosyaya yaz
    prompt_file = PROJECT_ROOT / "auto_dev_current_prompt.md"
    with open(prompt_file, "w", encoding="utf-8") as f:
        f.write(prompt)

    logger.info(f"Task prompt'u kaydedildi: {prompt_file}")

    # Yontem 1: Claude CLI
    claude_path = _find_executable("claude")
    if claude_path:
        logger.info("Claude CLI tespit edildi, otomatik calistiriliyor...")
        notify_system_status("ready", f"Claude CLI ile task {task.id} baslatiliyor...")

        try:
            result = subprocess.run(
                [claude_path, "--print", "-p", prompt],
                capture_output=True, text=True,
                timeout=600,  # 10 dk timeout
                cwd=str(PROJECT_ROOT)
            )
            if result.returncode == 0:
                logger.info("Claude CLI basariyla tamamlandi")
                # Sonucu logla
                result_file = PROJECT_ROOT / "logs" / f"task_{task.id}_result.log"
                with open(result_file, "w", encoding="utf-8") as f:
                    f.write(result.stdout)
                return True
            else:
                logger.error(f"Claude CLI hatasi: {result.stderr[:500]}")
                progress_entry["last_error"] = result.stderr[:200]
                return False
        except subprocess.TimeoutExpired:
            logger.error("Claude CLI timeout (10 dk)")
            progress_entry["last_error"] = "Timeout: 10 dakika icinde tamamlanamadi"
            return False
        except Exception as e:
            logger.error(f"Claude CLI hatasi: {e}")
            progress_entry["last_error"] = str(e)[:200]
            return False

    # Yontem 2: Cursor CLI
    cursor_path = _find_executable("cursor")
    if cursor_path:
        logger.info("Cursor CLI tespit edildi, prompt dosyasi aciliyor...")
        try:
            subprocess.Popen([cursor_path, str(prompt_file)], cwd=str(PROJECT_ROOT))
            notify_approval_needed(task.id, task.name,
                "Cursor'da prompt dosyasi acildi. Agent'a gonderin ve tamamlayin.")
            return None  # Manuel mudahale
        except Exception as e:
            logger.error(f"Cursor hatasi: {e}")

    # Yontem 3: Manuel mod
    notify_approval_needed(task.id, task.name,
        f"Otomatik AI bulunamadi. Prompt dosyasi: auto_dev_current_prompt.md\n"
        f"Claude Cowork veya Cursor'a yapistirin.")

    logger.info("=" * 60)
    logger.info("MANUEL MUDAHALE GEREKLI")
    logger.info(f"Prompt: {prompt_file}")
    logger.info("Claude Cowork / Cursor Agent'a yapistirin")
    logger.info("=" * 60)

    return None


def _find_executable(name: str) -> Optional[str]:
    """PATH'te executable ara."""
    import shutil
    return shutil.which(name)


# ==============================================================================
# STATUS DISPLAY
# ==============================================================================

def display_status(progress: Dict):
    """Ilerleme durumunu goster."""
    print("\n" + "=" * 70)
    print("  ObservAI Otomatik Gelistirme - Durum Raporu")
    print("=" * 70)

    phase_names = {
        1: "Kamera Stabilite", 2: "Performans Optimizasyonu",
        3: "AI Insight Sistemi", 4: "Ek Ozellikler"
    }
    status_icons = {
        "pending": "[ ]", "in_progress": "[~]", "completed": "[+]",
        "skipped": "[>]", "failed": "[X]"
    }

    tasks = progress["tasks"]
    total = len(tasks)
    completed = sum(1 for t in tasks if t["status"] == "completed")
    total_tokens = sum(t.get("tokens_used", 0) for t in tasks)

    print(f"\n  Ilerleme: {completed}/{total} task tamamlandi")
    print(f"  Toplam Token: {total_tokens:,}")
    print(f"  Bugunun Tokeni: {progress.get('total_tokens_today', 0):,}/{DAILY_TOKEN_LIMIT:,}")
    print(f"  Oturum Sayisi: {progress.get('session_count', 0)}")
    print(f"  ntfy Bildirimleri: {'AKTIF' if NTFY_ENABLED else 'KAPALI'} ({NTFY_TOPIC})")

    current_phase = 0
    for task_progress in tasks:
        task_def = next((t for t in DEVELOPMENT_TASKS if t.id == task_progress["id"]), None)
        if not task_def:
            continue

        if task_def.phase != current_phase:
            current_phase = task_def.phase
            phase_complete = check_phase_completion(progress, current_phase)
            marker = "[+]" if phase_complete else "[ ]"
            print(f"\n  {marker} Faz {current_phase}: {phase_names.get(current_phase, '?')}")

        icon = status_icons.get(task_progress["status"], "[?]")
        retry_info = f" (deneme {task_progress['retries']}/{MAX_RETRIES_PER_TASK})" if task_progress["retries"] > 0 else ""
        token_info = f" [{task_progress.get('tokens_used', 0):,} tkn]" if task_progress.get("tokens_used") else f" [~{task_def.estimated_tokens:,} tkn]"

        print(f"    {icon} {task_progress['id']} {task_def.name}{retry_info}{token_info}")

        if task_progress.get("last_error"):
            print(f"        Hata: {task_progress['last_error'][:80]}")

    print("\n" + "=" * 70)


# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

def is_user_approved(progress: Dict) -> bool:
    """
    Kullanıcının otomatik çalıştırmayı onaylayıp onaylamadığını kontrol et.
    Onay kaynakları:
      1. progress.json["session"]["user_approved_auto_dev"] = True  (ntfy butonu veya manuel)
      2. progress.json["approvals"]["auto_dev_proceed"]["status"] = "approved"
    """
    session = progress.get("session", {})
    if session.get("user_approved_auto_dev"):
        return True
    approvals = progress.get("approvals", {})
    ap = approvals.get("auto_dev_proceed", {})
    if ap.get("status") == "approved":
        return True
    return False


def run_once(progress: Dict, dry_run: bool = False) -> bool:
    """Tek calisma dongusu."""

    # 1. Sistem kontrolu
    ready, reason = check_system_ready()
    if not ready:
        logger.info(f"Sistem hazir degil: {reason}")
        if "oyun" in reason.lower():
            notify_system_status("game", reason)
        elif "internet" in reason.lower():
            notify_system_status("offline", reason)
        else:
            notify_system_status("paused", reason)
        return False

    # 2. Siradaki task
    next_item = get_next_task(progress)
    if next_item is None:
        all_done = all(t["status"] in ("completed", "skipped") for t in progress["tasks"])
        if all_done:
            notify_progress_report(progress)
            logger.info("TUM GOREVLER TAMAMLANDI!")
        else:
            logger.info("Yapilacak task yok veya gunluk limit asildi.")
        return False

    task: DevTask = next_item["task"]
    task_progress: Dict = next_item["progress"]

    logger.info(f"Siradaki task: [{task.id}] {task.name}")

    if dry_run:
        logger.info("[DRY RUN] Task calistirilmadi.")
        return True

    # 3. Faz tamamlanma kontrolu (onceki faz bittiyse bildir)
    if task.phase > 1:
        prev_phase = task.phase - 1
        if (check_phase_completion(progress, prev_phase) and
                prev_phase not in progress.get("completed_phases", [])):
            phase_names = {1: "Kamera Stabilite", 2: "Performans", 3: "AI Insight", 4: "Ek Ozellikler"}
            notify_phase_complete(prev_phase, phase_names.get(prev_phase, "?"))
            progress.setdefault("completed_phases", []).append(prev_phase)
            save_progress(progress)

    # 4. Task basla
    task_progress["status"] = TaskStatus.IN_PROGRESS.value
    task_progress["retries"] += 1
    task_progress["started_at"] = datetime.datetime.now().isoformat()
    save_progress(progress)

    notify_task_start(task.id, task.name, task.phase, task_progress["retries"], task.estimated_tokens)

    # 5. Calistir
    logger.info(f"Task calistiriliyor... (deneme {task_progress['retries']}/{MAX_RETRIES_PER_TASK})")
    result = execute_task_with_ai(task, task_progress)

    # 6. Sonuc isle
    if result is True:
        # Basarili
        task_progress["status"] = TaskStatus.COMPLETED.value
        task_progress["completed_at"] = datetime.datetime.now().isoformat()
        task_progress["tokens_used"] = task.estimated_tokens
        progress["total_tokens_today"] = progress.get("total_tokens_today", 0) + task.estimated_tokens
        save_progress(progress)

        summary = get_progress_summary(progress)
        notify_task_complete(task.id, task.name, task.estimated_tokens, summary)
        notify_token_status(progress["total_tokens_today"], DAILY_TOKEN_LIMIT, task.estimated_tokens)

        # Son faz kontrolu
        if check_phase_completion(progress, task.phase):
            phase_names = {1: "Kamera Stabilite", 2: "Performans", 3: "AI Insight", 4: "Ek Ozellikler"}
            if task.phase not in progress.get("completed_phases", []):
                notify_phase_complete(task.phase, phase_names.get(task.phase, "?"))
                progress.setdefault("completed_phases", []).append(task.phase)
                save_progress(progress)

        logger.info(f"Task tamamlandi: [{task.id}] {task.name}")

        # Handoff belgesi ve Cursor/Gemini config dosyalarını otomatik güncelle
        try:
            import subprocess as _sp
            _sp.run(
                [sys.executable, str(PROJECT_ROOT / "ai_handoff.py")],
                cwd=PROJECT_ROOT, timeout=30, capture_output=True
            )
            logger.info("  HANDOFF.md + AI config dosyaları güncellendi")
        except Exception as _he:
            logger.warning(f"  Handoff güncelleme hatası (kritik değil): {_he}")

    elif result is False:
        # Basarisiz
        if task_progress["retries"] >= MAX_RETRIES_PER_TASK:
            task_progress["status"] = TaskStatus.SKIPPED.value
            task_progress["last_error"] = "Max retry asildi"
            notify_task_skipped(task.id, task.name, "3 denemede de basarisiz, gorev atlandi")
            logger.warning(f"Task atlandi (max retry): [{task.id}]")
        else:
            task_progress["status"] = TaskStatus.PENDING.value
            notify_task_failed(task.id, task.name, task_progress.get("last_error", "Bilinmeyen hata"), task_progress["retries"])
            logger.warning(f"Task basarisiz, tekrar denenecek: [{task.id}]")

        save_progress(progress)

    else:
        # Manuel mudahale gerekli (result is None)
        task_progress["status"] = TaskStatus.IN_PROGRESS.value
        save_progress(progress)
        logger.info("Manuel mudahale gerekli.")

    progress["session_count"] = progress.get("session_count", 0) + 1
    save_progress(progress)

    return True


def run_continuous():
    """Surekli calisma modu."""
    logger.info("ObservAI Otomatik Gelistirme baslatiliyor (surekli mod)...")
    logger.info(f"Kontrol araligi: {CHECK_INTERVAL_SECONDS} sn | Token limit: {DAILY_TOKEN_LIMIT:,}")

    progress = load_progress()
    display_status(progress)

    notify_session("start", f"Surekli mod baslatildi. {get_progress_summary(progress)} ilerleme.")

    # Her 2 saatte bir ilerleme raporu gonder
    last_report_time = time.time()
    REPORT_INTERVAL = 7200  # 2 saat

    while True:
        try:
            progress = load_progress()

            # Periyodik ilerleme raporu
            if time.time() - last_report_time >= REPORT_INTERVAL:
                notify_progress_report(progress)
                last_report_time = time.time()

            success = run_once(progress)

            if not success:
                logger.info(f"{CHECK_INTERVAL_SECONDS} sn bekleniyor...")

                waited = 0
                while waited < CHECK_INTERVAL_SECONDS:
                    time.sleep(min(GAME_CHECK_INTERVAL, CHECK_INTERVAL_SECONDS - waited))
                    waited += GAME_CHECK_INTERVAL

                    if is_game_running():
                        logger.info("Oyun basladi, beklemeye devam...")
                        notify_system_status("game", "Oyun tespit edildi, gelistirme durakladi.")
                        waited = 0

        except KeyboardInterrupt:
            logger.info("Kullanici tarafindan durduruldu.")
            notify_session("end", "Kullanici tarafindan durduruldu.")
            break
        except Exception as e:
            logger.error(f"Beklenmeyen hata: {e}")
            notify_system_status("error", f"Beklenmeyen hata: {str(e)[:200]}")
            time.sleep(60)


def mark_task_done(task_id: str):
    """Bir task'i manuel olarak tamamlandi isaretle."""
    progress = load_progress()
    for t in progress["tasks"]:
        if t["id"] == task_id:
            t["status"] = TaskStatus.COMPLETED.value
            t["completed_at"] = datetime.datetime.now().isoformat()
            task_def = next((d for d in DEVELOPMENT_TASKS if d.id == task_id), None)
            if task_def:
                t["tokens_used"] = task_def.estimated_tokens
            save_progress(progress)
            logger.info(f"Task tamamlandi olarak isaretlendi: {task_id}")
            notify_task_complete(task_id, t["name"], t.get("tokens_used", 0), get_progress_summary(progress))
            return True
    logger.error(f"Task bulunamadi: {task_id}")
    return False


# ==============================================================================
# CLI INTERFACE
# ==============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="ObservAI Otomatik Gelistirme v2")
    parser.add_argument("--status", action="store_true", help="Mevcut durumu goster")
    parser.add_argument("--reset", action="store_true", help="Ilerlemeyi sifirla")
    parser.add_argument("--skip", action="store_true", help="Mevcut task'i atla")
    parser.add_argument("--dry-run", action="store_true", help="Sadece kontrol yap")
    parser.add_argument("--once", action="store_true", help="Tek task calistir")
    parser.add_argument("--continuous", action="store_true", help="Surekli calisma modu")
    parser.add_argument("--test-ntfy", action="store_true", help="ntfy bildirim testi")
    parser.add_argument("--done", type=str, metavar="TASK_ID", help="Task'i tamamlandi isaretle (ornek: --done 1.1.1)")
    parser.add_argument("--no-ntfy", action="store_true", help="ntfy bildirimlerini kapat")

    args = parser.parse_args()

    global NTFY_ENABLED
    if args.no_ntfy:
        NTFY_ENABLED = False

    if args.test_ntfy:
        print("ntfy.sh bildirim testi gonderiliyor...")
        success = send_ntfy(
            title="ObservAI Test Bildirimi",
            message=(
                "Bu bir test bildirimidir.\n"
                "Otomasyon sistemi dogru calisiyor.\n"
                f"Tarih: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            ),
            priority=NotifyPriority.DEFAULT,
            tags="test_tube"
        )
        if success:
            print("Bildirim basariyla gonderildi! Telefonunuzu kontrol edin.")
        else:
            print("Bildirim gonderilemedi. Internet baglantinizi kontrol edin.")
        return

    if args.reset:
        if PROGRESS_FILE.exists():
            PROGRESS_FILE.unlink()
        logger.info("Ilerleme sifirlandi.")
        progress = load_progress()
        display_status(progress)
        send_ntfy("Ilerleme Sifirlandi", "Tum gorevler sifirlandi, bastan baslanacak.", tags="arrows_counterclockwise")
        return

    progress = load_progress()

    if args.status:
        display_status(progress)
        return

    if args.done:
        mark_task_done(args.done)
        display_status(load_progress())
        return

    if args.skip:
        next_item = get_next_task(progress)
        if next_item:
            task = next_item["task"]
            tp = next_item["progress"]
            tp["status"] = TaskStatus.SKIPPED.value
            save_progress(progress)
            logger.info(f"Task atlandi: [{task.id}] {task.name}")
            notify_task_skipped(task.id, task.name, "Kullanici tarafindan atlandi")
        else:
            logger.info("Atlanacak task yok.")
        return

    if args.dry_run:
        display_status(progress)
        run_once(progress, dry_run=True)
        return

    if args.once:
        run_once(progress)
        display_status(progress)
        return

    if args.continuous:
        run_continuous()
        return

    # Varsayilan: durum + yardim
    display_status(progress)
    print("\nKullanim:")
    print("  python observai_auto_dev.py --once          # Tek task calistir")
    print("  python observai_auto_dev.py --continuous     # Surekli calistir (arka plan)")
    print("  python observai_auto_dev.py --status         # Durum goster")
    print("  python observai_auto_dev.py --skip           # Mevcut task'i atla")
    print("  python observai_auto_dev.py --done 1.1.1     # Task'i tamamlandi isaretle")
    print("  python observai_auto_dev.py --reset          # Sifirla")
    print("  python observai_auto_dev.py --test-ntfy      # Bildirim testi")
    print("  python observai_auto_dev.py --dry-run        # Test modu")
    print("  python observai_auto_dev.py --no-ntfy --once # Bildirimsiz calistir")


if __name__ == "__main__":
    main()
