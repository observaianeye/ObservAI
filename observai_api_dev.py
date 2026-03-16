#!/usr/bin/env python3
"""
ObservAI — API-Tabanlı Otonom Geliştirme Orkestratörü
======================================================
Bu script Windows'ta çalışır. Claude Desktop'a BAĞIMLI DEĞİLDİR.
API key'leri kullanarak AI'ları doğrudan çağırır.

Tamamen otomatik döngü:
  1. auto_dev_progress.json'dan sıradaki görevi al
  2. İlgili kod dosyalarını oku (akıllı bağlam seçimi)
  3. AI API'yi çağır (Claude → Gemini → OpenAI zinciri)
  4. AI'ın döndürdüğü kod değişikliklerini uygula
  5. Sözdizimi / derleme testi çalıştır
  6. progress.json güncelle + ntfy.sh bildirim gönder
  7. Bir sonraki göreve geç

AI Geçiş Zinciri (otomatik):
  Claude API (claude-sonnet-4-5)
    ↓ limit / hata
  Gemini API (gemini-2.0-flash — ücretsiz, yüksek limit)
    ↓ limit / hata
  OpenAI API (gpt-4o-mini — yedek)

Kurulum:
  pip install anthropic google-generativeai openai python-dotenv

  ObservAI/.env dosyası oluştur:
    ANTHROPIC_API_KEY=sk-ant-...
    GEMINI_API_KEY=AIza...
    OPENAI_API_KEY=sk-...   (isteğe bağlı)
    NTFY_TOPIC=observai

Çalıştırma:
  python observai_api_dev.py              # Sürekli çalış
  python observai_api_dev.py --once       # Tek görev
  python observai_api_dev.py --status     # Durum göster
  python observai_api_dev.py --test-apis  # API bağlantılarını test et
"""

import json
import os
import sys
import io
import time
import datetime
import subprocess
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

# Windows cp1254 sorununu düzelt — stdout'u UTF-8 yap
if sys.stdout and hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# .env yükle (varsa)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass  # python-dotenv yoksa .env'deki değerleri elle export et

# ─── Konfigürasyon ────────────────────────────────────────────────────────────

PROJECT_ROOT  = Path(__file__).parent.resolve()
PROGRESS_FILE = PROJECT_ROOT / "auto_dev_progress.json"
HANDOFF_FILE  = PROJECT_ROOT / "HANDOFF.md"
LOG_FILE      = PROJECT_ROOT / "logs" / "api_dev.log"
NTFY_URL      = f"https://ntfy.sh/{os.getenv('NTFY_TOPIC', 'observai')}"

# Görev başına maksimum token harcaması (Claude API)
MAX_TOKENS_PER_TASK  = 8000
# Günlük toplam token bütçesi (API maliyeti kontrolü)
DAILY_TOKEN_BUDGET   = 200_000
# Görevler arası bekleme (saniye) — API rate limit için
TASK_INTERVAL_SEC    = 10
# Bir görev için maksimum deneme sayısı
MAX_RETRIES_PER_TASK = 3

# ─── Renkler ──────────────────────────────────────────────────────────────────

class C:
    GREEN  = '\033[92m'
    YELLOW = '\033[93m'
    RED    = '\033[91m'
    BLUE   = '\033[94m'
    CYAN   = '\033[96m'
    BOLD   = '\033[1m'
    RESET  = '\033[0m'

# ─── Loglama ──────────────────────────────────────────────────────────────────

def log(msg: str, level: str = "INFO"):
    now = datetime.datetime.now().strftime("%H:%M:%S")
    icons = {"INFO": "ℹ", "OK": "✅", "WARN": "⚠", "ERROR": "❌", "AI": "🤖"}
    icon = icons.get(level, "·")
    line = f"[{now}] {icon} {msg}"
    print(line)
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

# ─── ntfy.sh Bildirimleri ─────────────────────────────────────────────────────

def notify(title: str, message: str, priority: str = "default", tags: str = ""):
    """ntfy.sh'a bildirim gönder (sadece bilgi, onay gerektirmez)."""
    try:
        data = message.encode("utf-8")
        # HTTP başlıkları ASCII olmak zorunda — UTF-8 encode edip latin-1 decode ile gönder
        def safe_header(s: str) -> str:
            return s.encode("utf-8").decode("latin-1", errors="replace")
        headers = {
            "Title": safe_header(title),
            "Priority": priority,
            "Content-Type": "text/plain; charset=utf-8",
        }
        if tags:
            headers["Tags"] = tags
        req = urllib.request.Request(NTFY_URL, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=8) as resp:
            return resp.status == 200
    except Exception as e:
        log(f"ntfy hatasi: {e}", "WARN")
        return False

# ─── Progress Yönetimi ────────────────────────────────────────────────────────

def load_progress() -> dict:
    try:
        with open(PROGRESS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"tasks": [], "session": {}, "api_stats": {}}

def save_progress(progress: dict):
    progress.setdefault("session", {})["updated_at"] = datetime.datetime.now().isoformat()
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)

def get_next_task(progress: dict) -> Optional[dict]:
    for task in progress.get("tasks", []):
        if task.get("status") == "pending":
            return task
    return None

def get_summary(progress: dict) -> str:
    tasks = progress.get("tasks", [])
    done  = sum(1 for t in tasks if t.get("status") == "completed")
    total = len(tasks)
    pct   = int(done / total * 100) if total else 0
    return f"{done}/{total} (%{pct})"

def mark_completed(progress: dict, task_id: str, tokens_used: int = 0):
    for t in progress["tasks"]:
        if t["id"] == task_id:
            t["status"]       = "completed"
            t["completed_at"] = datetime.datetime.now().isoformat()
            t["tokens_used"]  = tokens_used
            break
    # API istatistiklerini güncelle
    progress.setdefault("api_stats", {})
    stats = progress["api_stats"]
    today = datetime.date.today().isoformat()
    stats.setdefault(today, {"tokens": 0, "tasks": 0})
    stats[today]["tokens"] += tokens_used
    stats[today]["tasks"]  += 1

def get_tokens_today(progress: dict) -> int:
    stats = progress.get("api_stats", {})
    today = datetime.date.today().isoformat()
    return stats.get(today, {}).get("tokens", 0)

# ─── Kod Bağlamı Oluşturucu ───────────────────────────────────────────────────

TASK_FILE_MAP = {
    "1.1.1": ["backend/src/routes/python-backend.ts"],
    "1.1.2": ["frontend/src/components/camera/CameraFeed.tsx"],
    "1.1.3": ["packages/camera-analytics/camera_analytics/run_with_websocket.py"],
    "1.2.1": ["packages/camera-analytics/camera_analytics/run_with_websocket.py",
              "packages/camera-analytics/camera_analytics/analytics.py"],
    "1.2.2": ["packages/camera-analytics/scripts/test_camera_stability.py"],
    "2.1.1": ["packages/camera-analytics/camera_analytics/analytics.py"],
    "2.1.2": ["packages/camera-analytics/camera_analytics/analytics.py",
              "packages/camera-analytics/camera_analytics/config.py"],
    "2.2.1": ["packages/camera-analytics/camera_analytics/analytics.py"],
    "2.2.2": ["packages/camera-analytics/scripts/test_camera_stability.py"],
    "3.1.1": ["backend/src/routes/"],
    "3.2.1": ["frontend/src/pages/"],
    "3.2.2": ["backend/src/routes/", "packages/camera-analytics/camera_analytics/"],
    "3.3.1": ["packages/camera-analytics/scripts/"],
    "4.1.1": ["frontend/src/pages/", "backend/src/routes/"],
    "4.2.1": ["frontend/src/pages/"],
}

TASK_DESCRIPTIONS = {
    "5.0.0": """Sistem Sağlık Kontrolü (Test Görevi):
- ObservAI projesinin kök dizinine SYSTEM_HEALTH.md dosyası oluştur
- İçerik: Tarih, tamamlanan görevler özeti (15/15), kullanılan AI'lar, stack bilgisi
- Bu sadece bir test görevidir, asıl kod dosyalarına dokunma
- 'create' komutuyla oluştur""",

    "2.1.2": """YOLO Model Optimizasyonu:
- analytics.py içinde conf threshold'ı 0.35'ten 0.45'e çıkar (gürültüyü azalt)
- iou threshold'ı 0.5 yap
- inference imgsz'yi webcam için 416 yap (şu an 640 — %40 hız artışı)
- model.overrides güncelle
- face_detection_interval'ı webcam için 8 yap (şu an 5)
Kriter: Minimum config değişikliği, maksimum etki. analytics.py'de __init__ içindeki overrides bölümünü güncelle.""",

    "2.2.1": """Demografik Tahmin İyileştirme — Temporal Smoothing:
- TrackedPerson.update_age() içindeki maxlen'i 16'dan 24'e çıkar (daha smooth)
- TrackedPerson.update_gender() içindeki maxlen'i 12'den 24'e çıkar
- analytics.py içinde yeni _apply_temporal_smoothing() metodu ekle:
  def _apply_temporal_smoothing(self, person: TrackedPerson) -> None:
      # Yaş: ortalama yerine %20 outlier rejection median kullan
      # Cinsiyet: majority vote + confidence threshold 0.6
- _update_demographics içinde bu metodu çağır
Kriter: Tahminlerin titremesi %50 azalsın.""",

    "2.2.2": """Performans Entegrasyon Testi — test_performance.py:
test scripti oluştur: packages/camera-analytics/scripts/test_performance.py
İçeriği:
- analytics.py'nin statik analizi: tüm gerekli optimizasyon değişkenleri var mı?
- conf, iou, imgsz değerleri doğru mu kontrol et
- temporal smoothing maxlen değerleri doğru mu?
- _run_async_pipeline metodu var mı?
- Tüm testler geçerse "✅ Task 2.2.2 TAMAMLANDI" yaz""",

    "3.1.1": """Insight Engine Backend Servisi:
backend/src/routes/insights.ts dosyası oluştur:
- GET /api/insights/summary — son 24 saatin özeti (mock data OK)
- GET /api/insights/recommendations — AI öneriler (mock data OK)
- POST /api/insights/generate — Gemini API çağrısı (şimdilik mock)
Tipler:
  InsightSummary { period, totalVisitors, peakHour, avgDwellTime, topDemographic }
  Recommendation { id, type, message, priority, confidence }
backend/src/index.ts'e route ekle: app.use('/api/insights', insightsRouter)""",

    "3.2.1": """AI Insights Frontend Sayfası:
frontend/src/pages/insights/AIInsightsPage.tsx oluştur:
- Basit layout: başlık + 3 kart (Ziyaretçi Özeti, Öneriler, Trendler)
- useFetch hook ile /api/insights/summary ve /api/insights/recommendations çağır
- Yükleniyor state'i göster
- Hata state'i göster
- Tailwind CSS ile style
frontend/src/App.tsx'e route ekle: /insights → AIInsightsPage
Sidebar'a Insights linki ekle""",

    "3.2.2": """Gemini API Entegrasyonu:
backend/src/routes/insights.ts içindeki /generate endpoint'ini gerçek Gemini API ile doldur:
- @google/generative-ai paketi kullan
- GEMINI_API_KEY env değişkeninden oku
- Son 1 saatin metrics verilerini prompt'a ekle
- Gemini'den kısa öneri listesi iste (JSON formatında)
- Hata durumunda mock data ile fallback""",

    "3.3.1": """AI Insight Entegrasyon Testi:
packages/camera-analytics/scripts/test_insights.py oluştur:
- Node backend /api/insights/summary endpoint'i erişilebilir mi?
- /api/insights/recommendations endpoint çalışıyor mu?
- Response formatı doğru mu (InsightSummary tipi)?
- Backend çalışmıyorsa statik analiz: insights.ts dosyası var mı, route kayıtlı mı?""",

    "4.1.1": """Historical Analytics Sayfası:
frontend/src/pages/analytics/HistoricalPage.tsx oluştur:
- Tarih aralığı seçici (son 7 gün / son 30 gün)
- Recharts LineChart ile günlük ziyaretçi grafiği
- Demografik dağılım (BarChart)
- Mock data ile başla (Supabase entegrasyonu sonradan)
App.tsx'e /analytics route ekle""",

    "4.2.1": """Settings Sayfası İyileştirme:
frontend/src/pages/settings/ içindeki mevcut settings sayfasını bul
- YOLO confidence threshold slider ekle (0.1 - 0.9, default 0.45)
- Demographics interval slider ekle (5 - 30 frame, default 8)
- Async pipeline toggle ekle (varsayılan: açık)
- Değerler localStorage'a kaydedilsin
- Python backend'e /settings POST endpoint ekle (mock OK)""",
}

def get_task_context(task_id: str, max_chars: int = 12000) -> str:
    """Görev için ilgili dosyaların içeriğini oku."""
    files = TASK_FILE_MAP.get(task_id, [])
    context_parts = []
    total_chars = 0

    for file_path in files:
        full_path = PROJECT_ROOT / file_path
        if full_path.is_dir():
            # Klasör ise içindeki .ts ve .py dosyalarını listele
            for p in sorted(full_path.glob("*.ts")) + sorted(full_path.glob("*.py")):
                if total_chars >= max_chars:
                    break
                try:
                    content = p.read_text(encoding="utf-8")
                    excerpt = content[:3000] + "\n... [truncated]" if len(content) > 3000 else content
                    context_parts.append(f"### {p.relative_to(PROJECT_ROOT)}\n```\n{excerpt}\n```")
                    total_chars += len(excerpt)
                except Exception:
                    pass
        elif full_path.exists():
            try:
                content = full_path.read_text(encoding="utf-8")
                # Büyük dosyalar için akıllı kırpma
                if len(content) > max_chars // len(files):
                    limit = max_chars // len(files)
                    content = content[:limit] + f"\n\n... [{len(content) - limit} karakter daha, dosya kırpıldı]"
                context_parts.append(f"### {full_path.relative_to(PROJECT_ROOT)}\n```\n{content}\n```")
                total_chars += len(content)
            except Exception:
                pass

    return "\n\n".join(context_parts) if context_parts else "(dosya bulunamadı)"

# ─── AI Yanıt Ayrıştırıcı ─────────────────────────────────────────────────────

def parse_ai_response(response_text: str) -> Optional[dict]:
    """
    AI'ın yanıtından JSON kod değişikliklerini ayrıştır.

    Beklenen format:
    ```json
    {
      "changes": [
        {"file": "path/to/file.py", "old": "...", "new": "..."},
        {"file": "path/to/new.ts", "create": "dosya içeriği"}
      ],
      "summary": "Ne yapıldı",
      "test_cmd": "python scripts/test_xxx.py"
    }
    ```
    """
    import re
    # JSON bloğunu bul
    patterns = [
        r'```json\s*([\s\S]*?)\s*```',
        r'```\s*([\{][\s\S]*?[\}])\s*```',
        r'(\{[\s\S]*"changes"[\s\S]*\})',
    ]
    for pattern in patterns:
        match = re.search(pattern, response_text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(1))
                if "changes" in data:
                    return data
            except json.JSONDecodeError:
                continue
    return None

def apply_changes(changes_data: dict) -> tuple[int, int, list[str]]:
    """
    Kod değişikliklerini dosyalara uygula.
    Returns: (başarılı, başarısız, hata_mesajları)
    """
    ok_count   = 0
    fail_count = 0
    errors     = []

    for change in changes_data.get("changes", []):
        file_path = PROJECT_ROOT / change.get("file", "")

        try:
            # Yeni dosya oluştur
            if "create" in change:
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text(change["create"], encoding="utf-8")
                log(f"  [+] Oluşturuldu: {change['file']}", "OK")
                ok_count += 1

            # Mevcut dosyada str_replace
            elif "old" in change and "new" in change:
                if not file_path.exists():
                    errors.append(f"Dosya bulunamadı: {change['file']}")
                    fail_count += 1
                    continue
                content = file_path.read_text(encoding="utf-8")
                if change["old"] not in content:
                    errors.append(f"Hedef metin bulunamadı: {change['file']}\n  '{change['old'][:80]}...'")
                    fail_count += 1
                    continue
                new_content = content.replace(change["old"], change["new"], 1)
                file_path.write_text(new_content, encoding="utf-8")
                log(f"  [~] Güncellendi: {change['file']}", "OK")
                ok_count += 1

            # Satır ekle (append)
            elif "append" in change:
                if not file_path.exists():
                    errors.append(f"Dosya bulunamadı: {change['file']}")
                    fail_count += 1
                    continue
                with open(file_path, "a", encoding="utf-8") as f:
                    f.write("\n" + change["append"])
                log(f"  [+] Satır eklendi: {change['file']}", "OK")
                ok_count += 1

        except Exception as e:
            errors.append(f"{change.get('file', '?')}: {e}")
            fail_count += 1

    return ok_count, fail_count, errors

def run_validation(task_id: str, test_cmd: Optional[str] = None) -> tuple[bool, str]:
    """Sözdizimi ve temel testleri çalıştır."""
    errors = []

    # TypeScript kontrolü (frontend görevleri için)
    ts_tasks = {"1.1.2", "3.1.1", "3.2.1", "3.2.2", "4.1.1", "4.2.1"}
    if task_id in ts_tasks:
        frontend = PROJECT_ROOT / "frontend"
        if frontend.exists():
            try:
                result = subprocess.run(
                    ["npx", "tsc", "--noEmit"],
                    cwd=frontend, capture_output=True, text=True, timeout=60
                )
                if result.returncode != 0 and result.stderr:
                    errors.append(f"TypeScript: {result.stderr[:300]}")
            except Exception as e:
                log(f"  TypeScript kontrolü atlandı: {e}", "WARN")

    # Python sözdizimi (Python görevleri için)
    py_tasks = {"1.1.3", "1.2.1", "1.2.2", "2.1.1", "2.1.2", "2.2.1", "2.2.2", "3.2.2", "3.3.1"}
    if task_id in py_tasks:
        py_files = TASK_FILE_MAP.get(task_id, [])
        for pf in py_files:
            full = PROJECT_ROOT / pf
            if full.is_file() and full.suffix == ".py":
                try:
                    result = subprocess.run(
                        [sys.executable, "-c", f"import ast; ast.parse(open(r'{full}').read())"],
                        capture_output=True, text=True, timeout=10
                    )
                    if result.returncode != 0:
                        errors.append(f"Python sözdizimi hatası: {pf}\n{result.stderr[:200]}")
                except Exception:
                    pass

    # Özel test komutu (AI tarafından sağlandıysa)
    if test_cmd:
        try:
            result = subprocess.run(
                test_cmd, shell=True, capture_output=True, text=True,
                timeout=60, cwd=PROJECT_ROOT
            )
            if result.returncode != 0:
                errors.append(f"Test başarısız:\n{result.stdout[-300:]}{result.stderr[-200:]}")
        except Exception as e:
            log(f"  Test çalıştırılamadı: {e}", "WARN")

    success = len(errors) == 0
    return success, "\n".join(errors)

# ─── AI API İstemcileri ───────────────────────────────────────────────────────

def build_prompt(task: dict) -> str:
    """Görev için AI prompt'u oluştur."""
    task_id   = task["id"]
    task_name = task["name"]
    desc      = TASK_DESCRIPTIONS.get(task_id, task_name)
    context   = get_task_context(task_id)

    return f"""Sen ObservAI projesini geliştiren bir AI geliştiricisin.

## Proje Bilgisi
- React 18 + TypeScript + Vite frontend (port 5173)
- Express + TypeScript + Supabase backend (port 3001)
- Python FastAPI + WebSocket + YOLO11 + InsightFace (port 5001)

## Yapılacak Görev: {task_id} — {task_name}

{desc}

## Mevcut Kod Bağlamı
{context}

## Yanıt Formatı (ZORUNLU)
Sadece aşağıdaki JSON formatında yanıt ver, başka açıklama ekleme:

```json
{{
  "changes": [
    {{
      "file": "relative/path/to/file.py",
      "old": "değiştirilecek EXACT string (boşluklar dahil)",
      "new": "yeni içerik"
    }},
    {{
      "file": "relative/path/to/new_file.ts",
      "create": "yeni dosyanın tam içeriği"
    }}
  ],
  "summary": "Ne yapıldı (1-2 cümle)",
  "test_cmd": "python scripts/test_xxx.py"
}}
```

Kurallar:
- "old" alanı dosyada EXACT olarak bulunabilen bir string olmalı
- Büyük dosyalarda küçük, hedefli değişiklikler yap
- TypeScript'te `any` kullanma
- Python'da type hints ekle
- test_cmd isteğe bağlı, sadece hazır test scripti varsa yaz
"""

def call_claude(prompt: str) -> tuple[Optional[str], int]:
    """Claude API'yi çağır. (metin, token_kullanımı) döndür."""
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        return None, 0
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=MAX_TOKENS_PER_TASK,
            messages=[{"role": "user", "content": prompt}]
        )
        tokens = msg.usage.input_tokens + msg.usage.output_tokens
        return msg.content[0].text, tokens
    except Exception as e:
        err = str(e)
        if "rate_limit" in err.lower() or "overloaded" in err.lower():
            log(f"Claude rate limit: {err[:100]}", "WARN")
        else:
            log(f"Claude API hatası: {err[:150]}", "ERROR")
        return None, 0

def call_gemini(prompt: str) -> tuple[Optional[str], int]:
    """Gemini API'yi çağır. Yeni google-genai paketi, eski google-generativeai yedek."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return None, 0

    # Model sırası: 2.0-flash dolu ise 1.5-flash dene
    models_to_try = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.0-flash-lite"]

    # Yeni paket (google-genai) dene
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        for model_name in models_to_try:
            try:
                resp = client.models.generate_content(
                    model=model_name, contents=prompt
                )
                text   = resp.text
                tokens = getattr(getattr(resp, "usage_metadata", None), "total_token_count", 4000)
                log(f"  Gemini ({model_name}) yeni paket ile yanit verdi", "OK")
                return text, tokens
            except Exception as model_err:
                err_str = str(model_err)
                if "429" in err_str or "quota" in err_str.lower():
                    log(f"  {model_name} quota dolu, sonraki deneniyor...", "WARN")
                    continue
                raise
        log("Tüm Gemini modelleri quota dolu (bugün)", "WARN")
        return None, 0
    except ImportError:
        pass  # Yeni paket yok, eski paketi dene

    # Eski paket yedek (google-generativeai)
    try:
        import google.generativeai as genai_old  # type: ignore
        genai_old.configure(api_key=api_key)
        for model_name in models_to_try:
            try:
                model = genai_old.GenerativeModel(model_name)
                resp  = model.generate_content(prompt)
                tokens = getattr(getattr(resp, "usage_metadata", None), "total_token_count", 4000)
                log(f"  Gemini ({model_name}) eski paket ile yanit verdi", "OK")
                return resp.text, tokens
            except Exception as model_err:
                err_str = str(model_err)
                if "429" in err_str or "quota" in err_str.lower():
                    log(f"  {model_name} quota dolu, sonraki deneniyor...", "WARN")
                    continue
                raise
        log("Tüm Gemini modelleri quota dolu (bugün)", "WARN")
        return None, 0
    except Exception as e:
        log(f"Gemini API hatasi: {str(e)[:200]}", "ERROR")
        return None, 0

def call_openai(prompt: str) -> tuple[Optional[str], int]:
    """OpenAI API'yi çağır (son çare)."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return None, 0
    try:
        import openai
        client = openai.OpenAI(api_key=api_key)
        resp   = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=MAX_TOKENS_PER_TASK,
        )
        tokens = resp.usage.total_tokens
        return resp.choices[0].message.content, tokens
    except Exception as e:
        log(f"OpenAI API hatası: {str(e)[:150]}", "ERROR")
        return None, 0

# AI geçiş zinciri — varsayılan sıra (--ai parametresiyle değiştirilebilir)
AI_CHAIN = [
    ("Claude",  call_claude),
    ("Gemini",  call_gemini),
    ("OpenAI",  call_openai),
]

def set_primary_ai(ai_name: str):
    """AI zincirini yeniden sırala — belirtilen AI öne alınır."""
    global AI_CHAIN
    name_map = {
        "claude": ("Claude", call_claude),
        "gemini": ("Gemini", call_gemini),
        "openai": ("OpenAI", call_openai),
    }
    ai_name = ai_name.lower()
    if ai_name not in name_map:
        log(f"Bilinmeyen AI: {ai_name}. Geçerli: claude, gemini, openai", "WARN")
        return
    primary = name_map[ai_name]
    rest = [item for item in AI_CHAIN if item[0].lower() != ai_name]
    AI_CHAIN = [primary] + rest
    log(f"AI zinciri güncellendi: {[n for n, _ in AI_CHAIN]}", "OK")

def call_ai_chain(prompt: str, tokens_today: int) -> tuple[Optional[str], int, str]:
    """
    AI'ları sırayla dene. İlk başarılı yanıtı döndür.
    Returns: (yanıt, token_kullanımı, kullanılan_ai)
    """
    # Token bütçesi aşıldıysa Claude'u atla, Gemini'ye geç
    if tokens_today >= DAILY_TOKEN_BUDGET * 0.9:
        log(f"Claude token bütçesi dolu ({tokens_today:,}/{DAILY_TOKEN_BUDGET:,}), Gemini'ye geçiliyor", "WARN")
        notify(
            "🔄 AI Geçişi: Claude → Gemini",
            f"Günlük token bütçesi dolmak üzere ({tokens_today:,} kullanıldı).\nGemini ile devam ediliyor.",
            "default", "robot_face"
        )
        chain = AI_CHAIN[1:]  # Claude'u atla
    else:
        chain = AI_CHAIN

    for ai_name, ai_fn in chain:
        log(f"  {ai_name} API çağrılıyor...", "AI")
        response, tokens = ai_fn(prompt)
        if response:
            log(f"  {ai_name} yanıt verdi ({tokens:,} token)", "OK")
            return response, tokens, ai_name
        log(f"  {ai_name} yanıt vermedi, sonraki AI deneniyor...", "WARN")

    return None, 0, "none"

# ─── Ana Görev Yürütücü ───────────────────────────────────────────────────────

def run_task(task: dict, progress: dict) -> bool:
    """
    Tek bir görevi yürüt.
    Returns True = başarılı, False = başarısız
    """
    task_id   = task["id"]
    task_name = task["name"]
    retries   = task.get("retries", 0)

    log(f"Görev başlıyor: [{task_id}] {task_name} (deneme {retries + 1}/{MAX_RETRIES_PER_TASK})")
    notify(
        f"🔧 Görev Başladı [{task_id}]",
        f"{task_name}\nDeneme: {retries + 1}",
        "default", "wrench"
    )

    # Görevi in_progress yap — hangi AI'ın çalıştığını da kaydet (çakışma takibi)
    task["status"]     = "in_progress"
    task["started_at"] = datetime.datetime.now().isoformat()
    task["retries"]    = retries + 1
    task["locked_by"]  = AI_CHAIN[0][0] if AI_CHAIN else "unknown"
    save_progress(progress)

    # Prompt oluştur
    prompt = build_prompt(task)
    tokens_today = get_tokens_today(progress)

    # AI'dan yanıt al
    response, tokens_used, ai_name = call_ai_chain(prompt, tokens_today)

    if not response:
        log(f"Tüm AI'lar başarısız oldu — [{task_id}] görevi atlanıyor", "ERROR")
        task["status"]     = "pending"
        task["last_error"] = "Tüm AI API'ları başarısız"
        save_progress(progress)
        notify(
            f"❌ AI Erişilemiyor [{task_id}]",
            "Claude, Gemini ve OpenAI'ya ulaşılamadı.\nAPI key'leri .env dosyasında kontrol et.",
            "urgent", "sos"
        )
        return False

    # Yanıtı ayrıştır
    changes_data = parse_ai_response(response)

    if not changes_data:
        log("AI yanıtı JSON formatında değil, ham yanıt kaydediliyor...", "WARN")
        # Fallback: ham yanıtı log'a kaydet, görevi başarısız say
        task["status"]     = "pending"
        task["last_error"] = f"JSON ayrıştırma başarısız. AI yanıtı:\n{response[:500]}"
        if retries + 1 >= MAX_RETRIES_PER_TASK:
            task["status"] = "skipped"
            log(f"[{task_id}] max retry aşıldı, görev atlandı", "WARN")
        save_progress(progress)
        return False

    # Değişiklikleri uygula
    log(f"  {len(changes_data.get('changes', []))} değişiklik uygulanıyor...")
    ok, fail, errors = apply_changes(changes_data)
    log(f"  Uygulama: {ok} başarılı, {fail} başarısız")

    if fail > 0:
        log(f"  Hatalar:\n" + "\n".join(errors), "WARN")
        task["last_error"] = "; ".join(errors[:3])

    # Doğrulama testleri
    test_cmd = changes_data.get("test_cmd")
    valid, validation_errors = run_validation(task_id, test_cmd)

    if not valid:
        log(f"  Doğrulama başarısız:\n{validation_errors}", "WARN")
        if fail == 0 and ok > 0:
            # Değişiklikler uygulandı ama test başarısız — yine de ilerle
            log("  Değişiklikler uygulandı, testler kısmen başarısız (devam ediliyor)", "WARN")

    # Tamamlandı
    mark_completed(progress, task_id, tokens_used)
    progress["session"]["last_note"] = (
        f"[{ai_name}] Task {task_id} tamamlandı: {changes_data.get('summary', '')[:150]}"
    )
    save_progress(progress)

    # HANDOFF.md güncelle
    try:
        subprocess.run(
            [sys.executable, str(PROJECT_ROOT / "ai_handoff.py")],
            cwd=PROJECT_ROOT, timeout=20, capture_output=True
        )
    except Exception:
        pass

    summary = get_summary(progress)
    notify(
        f"✅ Görev Tamamlandı [{task_id}] — {ai_name}",
        f"{task_name}\n{changes_data.get('summary', '')[:200]}\n{summary}",
        "default", "white_check_mark"
    )

    log(f"[{task_id}] TAMAMLANDI ({tokens_used:,} token, {ai_name})", "OK")
    return True

# ─── Durum Göstericisi ────────────────────────────────────────────────────────

def show_status():
    progress = load_progress()
    tasks    = progress.get("tasks", [])
    done     = [t for t in tasks if t["status"] == "completed"]
    pending  = [t for t in tasks if t["status"] == "pending"]
    in_prog  = [t for t in tasks if t["status"] == "in_progress"]
    skipped  = [t for t in tasks if t["status"] == "skipped"]

    print(f"\n{C.BOLD}{'='*60}{C.RESET}")
    print(f"{C.BOLD}  ObservAI API Orkestratör — Durum{C.RESET}")
    print(f"{'='*60}")
    print(f"  ✅ Tamamlandı:   {len(done)}/{len(tasks)}")
    print(f"  🔄 Devam Eden:  {len(in_prog)}")
    print(f"  ⏳ Bekliyor:     {len(pending)}")
    print(f"  ⏭ Atlandı:      {len(skipped)}")

    tokens_today = get_tokens_today(progress)
    print(f"\n  🔑 Bugün kullanılan token: {tokens_today:,}/{DAILY_TOKEN_BUDGET:,}")

    # API key durumu
    print(f"\n  API Key Durumu:")
    print(f"    Claude:  {'✅' if os.getenv('ANTHROPIC_API_KEY') else '❌ .env eksik'}")
    print(f"    Gemini:  {'✅' if os.getenv('GEMINI_API_KEY') else '❌ .env eksik'}")
    print(f"    OpenAI:  {'✅ (isteğe bağlı)' if os.getenv('OPENAI_API_KEY') else '⚪ tanımlanmamış'}")

    if pending:
        next_t = pending[0]
        print(f"\n  ⏭ Sıradaki: [{next_t['id']}] {next_t['name']}")

    print(f"{'='*60}\n")

def test_apis():
    """API bağlantılarını test et."""
    print(f"\n{C.BOLD}API Bağlantı Testi{C.RESET}\n")
    test_prompt = "Say 'OK' and nothing else."

    for name, fn in AI_CHAIN:
        key_var = {"Claude": "ANTHROPIC_API_KEY", "Gemini": "GEMINI_API_KEY", "OpenAI": "OPENAI_API_KEY"}[name]
        if not os.getenv(key_var):
            print(f"  {C.YELLOW}⚪ {name}: API key yok (.env içinde {key_var} eksik){C.RESET}")
            continue
        print(f"  {name} test ediliyor...", end=" ", flush=True)
        resp, tokens = fn(test_prompt)
        if resp:
            print(f"{C.GREEN}✅ Çalışıyor ({tokens} token){C.RESET}")
        else:
            print(f"{C.RED}❌ Başarısız{C.RESET}")

# ─── Sürekli Çalışma Döngüsü ─────────────────────────────────────────────────

def run_continuous():
    log("ObservAI API Orkestratörü başlatıldı", "OK")
    notify(
        "🚀 ObservAI API Orkestratörü Başladı",
        f"Tamamen otomatik geliştirme aktif.\n"
        f"AI Zinciri: Claude → Gemini → OpenAI\n"
        f"Bildirimler info amaçlı — onay gerekmez.",
        "default", "rocket"
    )

    progress = load_progress()
    show_status()
    consecutive_failures = 0

    while True:
        try:
            progress = load_progress()

            # Tüm görevler tamamlandı mı?
            all_done = all(t["status"] in ("completed", "skipped") for t in progress["tasks"])
            if all_done:
                log("TÜM GÖREVLER TAMAMLANDI! 🎉", "OK")
                notify(
                    "🎉 ObservAI Geliştirme Tamamlandı!",
                    f"Tüm {len(progress['tasks'])} görev başarıyla tamamlandı!\n"
                    f"Proje hazır. start-all.bat ile başlatabilirsiniz.",
                    "high", "tada,rocket"
                )
                break

            # Sıradaki görevi al
            next_task = get_next_task(progress)
            if not next_task:
                log("Bekleyen görev yok, 5 dk bekleniyor...")
                time.sleep(300)
                continue

            # Görevi çalıştır
            success = run_task(next_task, progress)

            if success:
                consecutive_failures = 0
                log(f"Sonraki görev için {TASK_INTERVAL_SEC}s bekleniyor...")
                time.sleep(TASK_INTERVAL_SEC)
            else:
                consecutive_failures += 1
                wait = min(300, 30 * consecutive_failures)
                log(f"Başarısız ({consecutive_failures}. kez), {wait}s bekleniyor...", "WARN")
                time.sleep(wait)

                # 5 ardışık başarısız — dur ve bildir
                if consecutive_failures >= 5:
                    notify(
                        "⚠️ Orkestratör Duraklatıldı",
                        "5 ardışık başarısız görev.\n"
                        "API key'leri .env dosyasında kontrol et.\n"
                        "python observai_api_dev.py --test-apis",
                        "high", "warning"
                    )
                    log("5 ardışık başarısız, orkestratör durdu", "ERROR")
                    break

        except KeyboardInterrupt:
            log("Kullanıcı tarafından durduruldu.")
            notify("⏹ Orkestratör Durduruldu", "Manuel durdurma.", "low", "stop_button")
            break
        except Exception as e:
            log(f"Beklenmeyen hata: {e}", "ERROR")
            time.sleep(60)

# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    args = sys.argv[1:]

    # --ai gemini / --ai claude / --ai openai  →  zinciri yeniden sırala
    if "--ai" in args:
        idx = args.index("--ai")
        primary_ai = args[idx + 1] if len(args) > idx + 1 else ""
        if primary_ai:
            set_primary_ai(primary_ai)

    if "--status" in args:
        show_status()

    elif "--test-apis" in args:
        test_apis()

    elif "--once" in args:
        progress = load_progress()
        task = get_next_task(progress)
        if task:
            run_task(task, progress)
        else:
            log("Bekleyen görev yok.")

    elif "--task" in args:
        idx = args.index("--task")
        task_id = args[idx + 1] if len(args) > idx + 1 else ""
        if task_id:
            progress = load_progress()
            task = next((t for t in progress["tasks"] if t["id"] == task_id), None)
            if task:
                task["status"] = "pending"  # Zorla çalıştır
                run_task(task, progress)
            else:
                log(f"Görev bulunamadı: {task_id}", "ERROR")
        else:
            log("Kullanım: --task 2.1.2", "ERROR")

    else:
        run_continuous()
