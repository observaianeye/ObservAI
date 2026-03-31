"""
ObservAI Sistem Sağlık Kontrolü (Task 5.0.0)
Çalıştır: python scripts/health_check.py
"""
import sys
import os
import urllib.request
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001")
PYTHON_WS_URL = os.getenv("PYTHON_WS_URL", "ws://localhost:5001")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

checks = []

def check(name, fn):
    try:
        result = fn()
        checks.append({"name": name, "status": "OK", "detail": str(result)})
        print(f"  ✅ {name}: OK")
    except Exception as e:
        checks.append({"name": name, "status": "FAIL", "detail": str(e)})
        print(f"  ❌ {name}: FAIL — {e}")

print("=" * 50)
print(" ObservAI Sistem Sağlık Kontrolü")
print("=" * 50)

# 1. backend/.env.example GEMINI_API_KEY check
def check_env_example():
    env_example = ROOT / "backend" / ".env.example"
    content = env_example.read_text()
    assert "GEMINI_API_KEY" in content, ".env.example GEMINI_API_KEY içermiyor"
    return "GEMINI_API_KEY mevcut"

check("backend/.env.example GEMINI_API_KEY", check_env_example)

# 2. Python camera-analytics importable
def check_python_package():
    sys.path.insert(0, str(ROOT / "packages" / "camera-analytics"))
    import camera_analytics
    return f"v{getattr(camera_analytics, '__version__', 'ok')}"

check("camera_analytics paketi import edilebilir", check_python_package)

# 3. YOLO model dosyası
def check_yolo_model():
    models = list((ROOT / "packages" / "camera-analytics").glob("*.pt")) + \
             list((ROOT / "packages" / "camera-analytics").glob("*.onnx"))
    assert models, "YOLO model dosyası bulunamadı (*.pt veya *.onnx)"
    return models[0].name

check("YOLO model dosyası", check_yolo_model)

# 4. Backend health endpoint (çalışıyorsa)
def check_backend_health():
    req = urllib.request.Request(f"{BACKEND_URL}/health", headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as r:
        return f"HTTP {r.status}"

try:
    check("Backend /health endpoint", check_backend_health)
except Exception:
    checks.append({"name": "Backend /health endpoint", "status": "SKIP", "detail": "Servis çalışmıyor (beklenen: başlatılmamış)"})
    print("  ⏭  Backend /health endpoint: SKIP (servis başlatılmamış)")

# 5. auto_dev_progress.json 5.0.0 completed
def check_progress():
    progress = json.loads((ROOT / "auto_dev_progress.json").read_text())
    task = next((t for t in progress.get("tasks", []) if t["id"] == "5.0.0"), None)
    assert task, "5.0.0 görevi bulunamadı"
    assert task["status"] == "completed", f"5.0.0 durumu: {task['status']}"
    return "completed ✓"

check("auto_dev_progress.json 5.0.0 completed", check_progress)

print()
ok = sum(1 for c in checks if c["status"] == "OK")
skip = sum(1 for c in checks if c["status"] == "SKIP")
fail = sum(1 for c in checks if c["status"] == "FAIL")
print(f"Sonuç: {ok} OK, {skip} SKIP, {fail} FAIL / {len(checks)} toplam")
if fail == 0:
    print("🎉 Tüm kritik kontroller geçti!")
    sys.exit(0)
else:
    print("⚠️  Bazı kontroller başarısız. Yukarıdaki hata mesajlarını inceleyin.")
    sys.exit(1)
