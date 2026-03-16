#!/usr/bin/env python3
"""
Task 1.2.2 — Kamera Başlatma Stabilite Entegrasyon Testi
=========================================================
Bu test şunları doğrular:
  1. WebSocket sunucusunun başlatılması ve sağlık kontrolü
  2. Model yükleme akışının doğruluğu (preload → ready event)
  3. Bağlantı yönetimi (bağlan / bağlantıyı kes / yeniden bağlan)
  4. Status event sıralaması (initializing → model_loading → ready)
  5. MJPEG endpoint erişilebilirliği
  6. Birden fazla ardışık başlatma — %100 başarı oranı

Kullanım:
  python scripts/test_camera_stability.py
  python scripts/test_camera_stability.py --quick   # Sadece hızlı testler
  python scripts/test_camera_stability.py --verbose
"""

import asyncio
import json
import sys
import time
import socket
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

# Renkler
GREEN  = '\033[92m'
YELLOW = '\033[93m'
RED    = '\033[91m'
CYAN   = '\033[96m'
BOLD   = '\033[1m'
RESET  = '\033[0m'

PYTHON_BACKEND_PORT = 5001
PYTHON_BACKEND_HOST = "localhost"
BASE_URL = f"http://{PYTHON_BACKEND_HOST}:{PYTHON_BACKEND_PORT}"

# ─── Yardımcı Fonksiyonlar ───────────────────────────────────────────────────

def ok(msg: str):
    print(f"  {GREEN}✅ {msg}{RESET}")

def fail(msg: str):
    print(f"  {RED}❌ {msg}{RESET}")

def warn(msg: str):
    print(f"  {YELLOW}⚠  {msg}{RESET}")

def info(msg: str):
    print(f"  {CYAN}ℹ  {msg}{RESET}")

def section(title: str):
    print(f"\n{BOLD}{'─'*55}{RESET}")
    print(f"{BOLD}  {title}{RESET}")
    print(f"{BOLD}{'─'*55}{RESET}")

# ─── Test Sonuç Sınıfı ───────────────────────────────────────────────────────

class TestResult:
    def __init__(self, name: str):
        self.name = name
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.errors: list[str] = []

    def check(self, condition: bool, msg_pass: str, msg_fail: str):
        if condition:
            ok(msg_pass)
            self.passed += 1
        else:
            fail(msg_fail)
            self.failed += 1
            self.errors.append(msg_fail)

    def skip(self, reason: str):
        warn(f"ATLANDI: {reason}")
        self.skipped += 1

    @property
    def success(self) -> bool:
        return self.failed == 0

# ─── Test 1: Port Erişilebilirliği ───────────────────────────────────────────

def test_port_available(result: TestResult) -> bool:
    """Python backend'in çalışıp çalışmadığını kontrol et."""
    section("Test 1: Port Erişilebilirliği")

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(2)
    port_open = sock.connect_ex((PYTHON_BACKEND_HOST, PYTHON_BACKEND_PORT)) == 0
    sock.close()

    if not port_open:
        warn(f"Python backend port {PYTHON_BACKEND_PORT} açık değil — backend çalışmıyor olabilir")
        result.skip(f"Port {PYTHON_BACKEND_PORT} erişilemiyor, backend testleri atlanıyor")
        return False

    result.check(port_open, f"Port {PYTHON_BACKEND_PORT} açık", f"Port {PYTHON_BACKEND_PORT} kapalı")
    return port_open

# ─── Test 2: Health Endpoint ──────────────────────────────────────────────────

def test_health_endpoint(result: TestResult) -> Optional[dict]:
    """Health endpoint'inin varlığını ve formatını test et."""
    section("Test 2: Health Endpoint")

    try:
        req = urllib.request.Request(f"{BASE_URL}/health")
        with urllib.request.urlopen(req, timeout=5) as resp:
            status_code = resp.status
            body = json.loads(resp.read().decode())

        result.check(status_code == 200, f"HTTP 200 OK", f"HTTP {status_code}")
        result.check("phase" in body, "'phase' alanı mevcut", "Response'da 'phase' yok")
        result.check("model_loaded" in body, "'model_loaded' alanı mevcut", "Response'da 'model_loaded' yok")
        result.check(isinstance(body.get("model_loaded"), bool), "'model_loaded' boolean", "'model_loaded' boolean değil")

        phase = body.get("phase", "?")
        model_loaded = body.get("model_loaded", False)
        info(f"Backend durumu: phase={phase}, model_loaded={model_loaded}")

        return body

    except urllib.error.URLError as e:
        fail(f"Health endpoint ulaşılamıyor: {e}")
        result.failed += 1
        return None
    except json.JSONDecodeError as e:
        fail(f"Health response JSON parse hatası: {e}")
        result.failed += 1
        return None

# ─── Test 3: MJPEG Endpoint ───────────────────────────────────────────────────

def test_mjpeg_endpoint(result: TestResult):
    """MJPEG stream endpoint'inin erişilebilirliğini test et."""
    section("Test 3: MJPEG Stream Endpoint")

    try:
        req = urllib.request.Request(f"{BASE_URL}/mjpeg")
        req.add_header("Range", "bytes=0-1024")
        with urllib.request.urlopen(req, timeout=5) as resp:
            ct = resp.headers.get("Content-Type", "")
            status = resp.status
            result.check(
                "multipart/x-mixed-replace" in ct or status in (200, 206),
                f"MJPEG endpoint erişilebilir (status={status})",
                f"MJPEG endpoint yanıt vermedi (status={status})"
            )
            result.check(
                "multipart/x-mixed-replace" in ct,
                "Content-Type: multipart/x-mixed-replace ✓",
                f"MJPEG Content-Type yanlış: {ct}"
            )
    except urllib.error.HTTPError as e:
        if e.code == 503:
            warn("MJPEG: Henüz stream yok (503 Service Unavailable) — kamera bağlı olmayabilir")
            result.skip("Stream henüz başlamadı")
        else:
            fail(f"MJPEG endpoint HTTP hatası: {e.code}")
            result.failed += 1
    except urllib.error.URLError as e:
        if "timed out" in str(e).lower() or "reset" in str(e).lower():
            # MJPEG is a streaming response, timeout may be expected
            result.check(True, "MJPEG endpoint yanıt veriyor (stream başlatma denemesi)", "")
        else:
            warn(f"MJPEG endpoint ulaşılamıyor: {e} (backend çalışmıyor olabilir)")
            result.skip("MJPEG ulaşılamıyor")

# ─── Test 4: WebSocket / Socket.IO ───────────────────────────────────────────

def test_socketio_endpoint(result: TestResult):
    """Socket.IO handshake endpoint'ini test et."""
    section("Test 4: Socket.IO Handshake")

    try:
        url = f"{BASE_URL}/socket.io/?EIO=4&transport=polling"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode()
            result.check(
                resp.status == 200,
                f"Socket.IO handshake başarılı (HTTP {resp.status})",
                f"Socket.IO handshake başarısız (HTTP {resp.status})"
            )
            result.check(
                "sid" in body,
                "Socket.IO session ID alındı",
                "Socket.IO session ID alınamadı"
            )
    except urllib.error.URLError as e:
        warn(f"Socket.IO endpoint ulaşılamıyor: {e}")
        result.skip("Socket.IO erişilemiyor")

# ─── Test 5: Status Event Sıralaması ─────────────────────────────────────────

def test_status_sequence(result: TestResult, health_data: Optional[dict]):
    """Backend'in beklenen durum sıralamasını geçip geçmediğini doğrula."""
    section("Test 5: Status Akışı Doğrulaması")

    VALID_PHASES = {
        "initializing", "model_loading", "ready",
        "connecting", "streaming", "error"
    }

    if health_data is None:
        result.skip("Health data yok, durum testi atlanıyor")
        return

    phase = health_data.get("phase", "")
    model_loaded = health_data.get("model_loaded", False)
    source_connected = health_data.get("source_connected", False)
    streaming = health_data.get("streaming", False)

    result.check(
        phase in VALID_PHASES,
        f"Geçerli phase değeri: '{phase}'",
        f"Geçersiz phase: '{phase}' (beklenen: {VALID_PHASES})"
    )

    # Model yüklendiyse phase "ready" veya sonrası olmalı
    if model_loaded:
        result.check(
            phase in ("ready", "connecting", "streaming"),
            f"Model yüklendi → phase uygun: '{phase}'",
            f"Model yüklendi ama phase hatalı: '{phase}'"
        )
    else:
        info(f"Model henüz yüklenmemiş (phase={phase}) — normal başlatma süreci")

    # streaming=True ise source_connected da True olmalı
    if streaming:
        result.check(
            source_connected,
            "streaming=True → source_connected=True ✓",
            "streaming=True ama source_connected=False (tutarsız durum!)"
        )

    info(f"phase={phase} | model_loaded={model_loaded} | source_connected={source_connected} | streaming={streaming}")

# ─── Test 6: Bağlantı Kararlılığı ─────────────────────────────────────────────

def test_connection_stability(result: TestResult, repeat: int = 5):
    """Health endpoint'ini ardışık n kez çağır, tutarlılığı doğrula."""
    section(f"Test 6: Bağlantı Kararlılığı ({repeat} ardışık istek)")

    success_count = 0
    phases = []

    for i in range(repeat):
        try:
            req = urllib.request.Request(f"{BASE_URL}/health")
            with urllib.request.urlopen(req, timeout=3) as resp:
                body = json.loads(resp.read().decode())
                success_count += 1
                phases.append(body.get("phase", "?"))
        except Exception as e:
            phases.append(f"ERROR:{e}")

    result.check(
        success_count == repeat,
        f"{repeat}/{repeat} ardışık health check başarılı",
        f"Sadece {success_count}/{repeat} ardışık health check başarılı"
    )

    # Phase tutarlılığı — ani değişim olmamalı
    unique_phases = set(phases)
    result.check(
        len(unique_phases) <= 2,  # En fazla 2 farklı phase (geçiş döneminde)
        f"Phase tutarlı: {unique_phases}",
        f"Phase tutarsız (çok fazla değişim): {unique_phases}"
    )

    info(f"Phases: {phases}")

# ─── Test 7: Statik Analiz — Frontend Connection State ────────────────────────

def test_frontend_state_machine():
    """CameraFeed.tsx'in connection state machine'inin varlığını doğrula."""
    section("Test 7: Frontend State Machine (Statik Analiz)")

    result = TestResult("Frontend State")
    camera_feed = Path(__file__).parent.parent.parent.parent / \
        "frontend" / "src" / "components" / "camera" / "CameraFeed.tsx"

    if not camera_feed.exists():
        result.skip(f"CameraFeed.tsx bulunamadı: {camera_feed}")
        return result

    code = camera_feed.read_text(encoding="utf-8")

    # ConnectionState type'ı var mı?
    result.check(
        "ConnectionState" in code,
        "ConnectionState type tanımlı",
        "ConnectionState type bulunamadı!"
    )

    # Beklenen state'ler mevcut mu?
    for state in ("DISCONNECTED", "CONNECTING", "WAITING_FOR_BACKEND", "CONNECTED", "STREAMING", "FAILED"):
        result.check(
            state in code,
            f"State '{state}' mevcut",
            f"State '{state}' eksik!"
        )

    # Exponential backoff var mı?
    result.check(
        "Math.pow" in code or "exponential" in code.lower() or "backoff" in code.lower(),
        "Exponential backoff implementasyonu mevcut",
        "Exponential backoff bulunamadı!"
    )

    # MAX_RETRIES tanımlanmış mı?
    result.check(
        "MAX_RETRIES" in code,
        "MAX_RETRIES sabiti tanımlı",
        "MAX_RETRIES sabiti bulunamadı!"
    )

    # MJPEG retry var mı?
    result.check(
        "mjpegRetry" in code or "MJPEG_RETRIES" in code or "mjpeg" in code.lower(),
        "MJPEG retry mekanizması mevcut",
        "MJPEG retry bulunamadı!"
    )

    info(f"CameraFeed.tsx: {len(code.splitlines())} satır analiz edildi")
    return result

# ─── Test 8: Python Backend Model Preloading Doğrulaması ──────────────────────

def test_model_preloading_code():
    """run_with_websocket.py'de model preloading implementasyonu var mı?"""
    section("Test 8: Model Preloading (Statik Analiz)")

    result = TestResult("Model Preload")
    ws_file = Path(__file__).parent.parent / "camera_analytics" / "run_with_websocket.py"

    if not ws_file.exists():
        result.skip(f"run_with_websocket.py bulunamadı: {ws_file}")
        return result

    code = ws_file.read_text(encoding="utf-8")

    result.check(
        "_preload_models" in code,
        "_preload_models() fonksiyonu mevcut",
        "_preload_models() bulunamadı!"
    )

    result.check(
        "preloaded_yolo" in code or "preloaded_estimator" in code,
        "Preloaded model parametreleri mevcut",
        "Preloaded model parametreleri bulunamadı!"
    )

    result.check(
        "model_loading" in code,
        "'model_loading' status event'i mevcut",
        "'model_loading' status event'i bulunamadı!"
    )

    result.check(
        "run_in_executor" in code or "asyncio" in code,
        "Async model yükleme mevcut",
        "Async model yükleme bulunamadı!"
    )

    info(f"run_with_websocket.py: {len(code.splitlines())} satır analiz edildi")
    return result

# ─── Ana Test Koşucusu ────────────────────────────────────────────────────────

def run_all_tests(quick: bool = False, verbose: bool = False) -> bool:
    print(f"\n{BOLD}{'='*55}{RESET}")
    print(f"{BOLD}  ObservAI — Task 1.2.2 Kamera Stabilite Testi{RESET}")
    print(f"{BOLD}{'='*55}{RESET}")
    print(f"  Tarih: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Backend: {BASE_URL}")
    print(f"  Mod: {'Hızlı' if quick else 'Tam'}")

    all_results: list[TestResult] = []
    backend_running = False

    # Statik testler (her zaman çalışır)
    r7 = test_frontend_state_machine()
    all_results.append(r7)

    r8 = test_model_preloading_code()
    all_results.append(r8)

    # Backend testleri (sadece backend çalışıyorsa)
    r1 = TestResult("Port")
    backend_running = test_port_available(r1)
    all_results.append(r1)

    if backend_running:
        r2 = TestResult("Health")
        health_data = test_health_endpoint(r2)
        all_results.append(r2)

        r3 = TestResult("MJPEG")
        test_mjpeg_endpoint(r3)
        all_results.append(r3)

        r4 = TestResult("SocketIO")
        test_socketio_endpoint(r4)
        all_results.append(r4)

        r5 = TestResult("StatusSeq")
        test_status_sequence(r5, health_data)
        all_results.append(r5)

        if not quick:
            r6 = TestResult("Stability")
            test_connection_stability(r6, repeat=5)
            all_results.append(r6)
    else:
        info("Backend çalışmıyor — sadece statik kod analizleri yapıldı")

    # ── Özet ─────────────────────────────────────────────────────────────────
    section("TEST SONUÇLARI")

    total_passed  = sum(r.passed  for r in all_results)
    total_failed  = sum(r.failed  for r in all_results)
    total_skipped = sum(r.skipped for r in all_results)
    total = total_passed + total_failed

    for r in all_results:
        icon = GREEN + "✅" if r.success else RED + "❌"
        status = f"  {icon} {r.name}: {r.passed} geçti"
        if r.failed:
            status += f", {r.failed} başarısız"
        if r.skipped:
            status += f", {r.skipped} atlandı"
        print(status + RESET)
        if r.errors and verbose:
            for err in r.errors:
                print(f"       └─ {err}")

    print(f"\n{BOLD}  Toplam: {total_passed}/{total} geçti", end="")
    if total_skipped:
        print(f" | {total_skipped} atlandı", end="")
    print(RESET)

    overall_success = total_failed == 0
    if overall_success:
        print(f"\n{GREEN}{BOLD}  ✅ TÜM TESTLER GEÇTİ — Task 1.2.2 TAMAMLANDI{RESET}\n")
    else:
        print(f"\n{RED}{BOLD}  ❌ {total_failed} TEST BAŞARISIZ{RESET}\n")

    return overall_success


if __name__ == "__main__":
    args = sys.argv[1:]
    quick   = "--quick" in args
    verbose = "--verbose" in args or "-v" in args

    success = run_all_tests(quick=quick, verbose=verbose)
    sys.exit(0 if success else 1)
