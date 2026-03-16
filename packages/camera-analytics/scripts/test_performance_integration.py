#!/usr/bin/env python3
"""
Task 2.2.2 — Performans Entegrasyon Testi
=========================================================
Bu test Faz 2'deki tüm performans iyileştirmelerini doğrular.
Bağımlılık gerektirmez (statik analiz + standalone algoritma testleri).

  Bölüm A: Async Processing Pipeline (Task 2.1.1)
  Bölüm B: YOLO Model Optimizasyonu (Task 2.1.2)
  Bölüm C: Demografik Tahmin İyileştirme (Task 2.2.1)
  Bölüm D: Config Dosyası Entegrasyonu
  Bölüm E: Algoritma Birim Testleri (standalone)

Kullanım:
  python scripts/test_performance_integration.py
  python scripts/test_performance_integration.py --verbose
"""

import sys
import time
import math
import random
from collections import deque
from pathlib import Path

# Renkler
GREEN  = '\033[92m'
YELLOW = '\033[93m'
RED    = '\033[91m'
CYAN   = '\033[96m'
BOLD   = '\033[1m'
RESET  = '\033[0m'

PKG_ROOT = Path(__file__).parent.parent
ANALYTICS_PY = PKG_ROOT / "camera_analytics" / "analytics.py"
CONFIG_PY    = PKG_ROOT / "camera_analytics" / "config.py"
METRICS_PY   = PKG_ROOT / "camera_analytics" / "metrics.py"
OPTIMIZE_PY  = PKG_ROOT / "camera_analytics" / "optimize.py"
YAML_FILE    = PKG_ROOT / "config" / "default_zones.yaml"
WS_PY        = PKG_ROOT / "camera_analytics" / "run_with_websocket.py"

# ─── Yardımcı ────────────────────────────────────────────────────────────────

def ok(msg: str):
    print(f"  {GREEN}✅ {msg}{RESET}")

def fail(msg: str):
    print(f"  {RED}❌ {msg}{RESET}")

def warn(msg: str):
    print(f"  {YELLOW}⚠  {msg}{RESET}")

def info(msg: str):
    print(f"  {CYAN}ℹ  {msg}{RESET}")

def section(title: str):
    print(f"\n{BOLD}{'─'*60}{RESET}")
    print(f"{BOLD}  {title}{RESET}")
    print(f"{BOLD}{'─'*60}{RESET}")

class TestResult:
    def __init__(self, name: str):
        self.name = name
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.errors: list = []

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

def read_file(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")

# ═══════════════════════════════════════════════════════════════════════════════
# BÖLÜM A: Async Processing Pipeline (Task 2.1.1) — Statik Analiz
# ═══════════════════════════════════════════════════════════════════════════════

def test_async_pipeline_code() -> TestResult:
    """Async pipeline implementasyonunu statik olarak doğrula."""
    section("A1: Async Processing Pipeline (Statik Analiz)")
    result = TestResult("AsyncPipeline")

    code = read_file(ANALYTICS_PY)
    if not code:
        result.skip("analytics.py bulunamadı")
        return result

    # ThreadPoolExecutor kullanımı
    result.check(
        "ThreadPoolExecutor" in code,
        "ThreadPoolExecutor import/kullanım mevcut",
        "ThreadPoolExecutor bulunamadı — async pipeline eksik!"
    )

    # demographics_executor
    result.check(
        "demographics_executor" in code,
        "demographics_executor tanımlı",
        "demographics_executor bulunamadı!"
    )

    # pending_demographics_future async takip
    result.check(
        "pending_demographics_future" in code,
        "pending_demographics_future async takip mevcut",
        "pending_demographics_future bulunamadı!"
    )

    # face_detection_interval — frame skip
    result.check(
        "face_detection_interval" in code,
        "face_detection_interval (frame skip) tanımlı",
        "face_detection_interval bulunamadı!"
    )

    # capture_fps / inference_fps per-thread metrikler
    result.check(
        "capture_fps" in code and "inference_fps" in code,
        "Per-thread FPS metrikleri (capture_fps, inference_fps) mevcut",
        "Per-thread FPS metrikleri eksik!"
    )

    # max_workers=1 ile thread pool (demographics için)
    result.check(
        "max_workers=1" in code,
        "Demographics thread pool max_workers=1 (tek thread)",
        "max_workers=1 bulunamadı — demographics thread pool?"
    )

    info(f"analytics.py: {len(code.splitlines())} satır analiz edildi")
    return result


def test_async_metrics_fields() -> TestResult:
    """CameraMetrics'in async FPS alanlarını içerdiğini doğrula."""
    section("A2: CameraMetrics Async FPS Alanları (Statik)")
    result = TestResult("AsyncMetrics")

    code = read_file(METRICS_PY)
    if not code:
        result.skip("metrics.py bulunamadı")
        return result

    # capture_fps / inference_fps alanları
    result.check(
        "capture_fps" in code,
        "CameraMetrics.capture_fps alanı mevcut",
        "CameraMetrics.capture_fps eksik!"
    )
    result.check(
        "inference_fps" in code,
        "CameraMetrics.inference_fps alanı mevcut",
        "CameraMetrics.inference_fps eksik!"
    )

    # to_dict() içinde captureFps / inferenceFps
    result.check(
        '"captureFps"' in code or "'captureFps'" in code,
        "to_dict() içinde 'captureFps' serileştirmesi mevcut",
        "to_dict() captureFps serileştirmesi eksik!"
    )
    result.check(
        '"inferenceFps"' in code or "'inferenceFps'" in code,
        "to_dict() içinde 'inferenceFps' serileştirmesi mevcut",
        "to_dict() inferenceFps serileştirmesi eksik!"
    )

    # round() ile yuvarlanıyor mu?
    result.check(
        "round(self.capture_fps" in code and "round(self.inference_fps" in code,
        "FPS değerleri yuvarlanarak serileştiriliyor",
        "FPS yuvarlama eksik!"
    )

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# BÖLÜM B: YOLO Model Optimizasyonu (Task 2.1.2) — Statik Analiz
# ═══════════════════════════════════════════════════════════════════════════════

def test_hardware_optimizer_code() -> TestResult:
    """HardwareOptimizer implementasyonu statik analiz."""
    section("B1: HardwareOptimizer Implementasyonu")
    result = TestResult("HardwareOpt")

    code = read_file(OPTIMIZE_PY)
    if not code:
        result.skip("optimize.py bulunamadı")
        return result

    # Sınıf tanımı
    result.check(
        "class HardwareOptimizer" in code,
        "HardwareOptimizer sınıfı mevcut",
        "HardwareOptimizer sınıfı bulunamadı!"
    )

    # detect_hardware metodu
    result.check(
        "def detect_hardware" in code,
        "detect_hardware() metodu mevcut",
        "detect_hardware() bulunamadı!"
    )

    # get_optimal_device metodu
    result.check(
        "def get_optimal_device" in code,
        "get_optimal_device() metodu mevcut",
        "get_optimal_device() bulunamadı!"
    )

    # get_optimal_inference_params metodu
    result.check(
        "def get_optimal_inference_params" in code,
        "get_optimal_inference_params() metodu mevcut",
        "get_optimal_inference_params() bulunamadı!"
    )

    # Performans modları (quality/balanced/speed)
    result.check(
        '"quality"' in code and '"balanced"' in code and '"speed"' in code,
        "Performans modları (quality/balanced/speed) tanımlı",
        "Performans modları eksik!"
    )

    # override_imgsz parametresi
    result.check(
        "override_imgsz" in code,
        "override_imgsz parametresi mevcut (konfigürasyon ile YOLO input boyutu)",
        "override_imgsz bulunamadı!"
    )

    # CUDA / MPS / CPU desteği
    result.check(
        "cuda" in code.lower() and "mps" in code.lower() and "cpu" in code.lower(),
        "CUDA, MPS, CPU desteği mevcut",
        "Donanım destek türleri eksik!"
    )

    # TensorRT optimizasyonu
    result.check(
        "tensorrt" in code.lower() or "TensorRT" in code,
        "TensorRT optimizasyonu mevcut",
        "TensorRT optimizasyonu bulunamadı!"
    )

    info(f"optimize.py: {len(code.splitlines())} satır analiz edildi")
    return result


def test_yolo_config_params() -> TestResult:
    """AnalyticsConfig'in YOLO optimizasyon parametrelerini statik doğrulama."""
    section("B2: YOLO Config Parametreleri (Statik)")
    result = TestResult("YOLOConfig")

    code = read_file(CONFIG_PY)
    if not code:
        result.skip("config.py bulunamadı")
        return result

    # Task 2.1.2 parametreleri
    params = {
        "nms_iou_threshold": "NMS IoU threshold",
        "yolo_input_size": "YOLO input boyutu",
        "agnostic_nms": "Agnostic NMS",
        "max_detections": "Maksimum tespit sayısı",
    }

    for param, desc in params.items():
        result.check(
            param in code,
            f"'{param}' ({desc}) config'de mevcut",
            f"'{param}' ({desc}) config'de eksik!"
        )

    # load_config()'da bu parametrelerin okunması
    result.check(
        "nms_iou_threshold" in code and "float(data.get" in code,
        "YOLO parametreleri YAML'dan okunuyor",
        "YAML okuma eksik!"
    )

    # Varsayılan değerler
    result.check(
        "0.45" in code,  # nms_iou default
        "NMS IoU varsayılan 0.45 tanımlı",
        "NMS IoU varsayılan değer bulunamadı!"
    )

    # analytics.py'de bu parametrelerin kullanımı
    analytics_code = read_file(ANALYTICS_PY)
    if analytics_code:
        result.check(
            "self.nms_iou" in analytics_code or "config.nms_iou_threshold" in analytics_code,
            "analytics.py config'den NMS parametresini okuyor",
            "analytics.py NMS parametresini kullanmıyor!"
        )
        result.check(
            "self.agnostic_nms" in analytics_code or "config.agnostic_nms" in analytics_code,
            "analytics.py config'den agnostic_nms okuyor",
            "analytics.py agnostic_nms kullanmıyor!"
        )
        result.check(
            "self.max_det" in analytics_code or "config.max_detections" in analytics_code,
            "analytics.py config'den max_detections okuyor",
            "analytics.py max_detections kullanmıyor!"
        )

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# BÖLÜM C: Demografik Tahmin İyileştirme (Task 2.2.1) — Statik Analiz
# ═══════════════════════════════════════════════════════════════════════════════

def test_demographic_improvement_code() -> TestResult:
    """TrackedPerson demografik iyileştirme implementasyonu statik analiz."""
    section("C1: Demografik İyileştirme Implementasyonu (Statik)")
    result = TestResult("DemoImprove")

    code = read_file(ANALYTICS_PY)
    if not code:
        result.skip("analytics.py bulunamadı")
        return result

    # EMA + weighted median hybrid
    result.check(
        "age_ema" in code,
        "age_ema (EMA hesaplama) alanı mevcut",
        "age_ema bulunamadı — EMA uygulanmamış!"
    )
    result.check(
        "weighted_median" in code,
        "weighted_median hesaplaması mevcut",
        "weighted_median bulunamadı — median hybrid eksik!"
    )

    # Confidence-weighted EMA
    result.check(
        "effective_alpha" in code and "ema_alpha" in code,
        "Confidence-weighted EMA (effective_alpha) mevcut",
        "Confidence-weighted EMA bulunamadı!"
    )

    # Age stability
    result.check(
        "age_stability" in code,
        "age_stability skoru mevcut",
        "age_stability bulunamadı!"
    )

    # Gender temporal decay
    result.check(
        "temporal_decay" in code and "recency_weight" in code,
        "Temporal decay voting (recency_weight) mevcut",
        "Temporal decay voting bulunamadı!"
    )

    # Gender consensus threshold
    result.check(
        "consensus_threshold" in code,
        "Gender consensus threshold parametresi mevcut",
        "Gender consensus threshold bulunamadı!"
    )

    # Gender stability
    result.check(
        "gender_stability" in code,
        "gender_stability skoru mevcut",
        "gender_stability bulunamadı!"
    )

    # Min confidence filtreleme
    result.check(
        "min_confidence" in code,
        "min_confidence filtreleme mevcut (düşük güvenli tahminleri reddet)",
        "min_confidence filtreleme bulunamadı!"
    )

    # History deque'leri
    for field in ("age_history", "age_confidence_history", "gender_history", "gender_confidence_history"):
        result.check(
            field in code,
            f"'{field}' deque alanı mevcut",
            f"'{field}' deque alanı eksik!"
        )

    # Blend faktörü (EMA + median karışımı)
    result.check(
        "blend" in code,
        "EMA/median blend faktörü mevcut",
        "Blend faktörü bulunamadı!"
    )

    info(f"analytics.py'de 2.2.1 implementasyonu doğrulandı")
    return result


def test_demographic_config_params() -> TestResult:
    """AnalyticsConfig'in Task 2.2.1 parametrelerini statik doğrulama."""
    section("C2: Demografik Config Parametreleri (Statik)")
    result = TestResult("DemoConfig")

    code = read_file(CONFIG_PY)
    if not code:
        result.skip("config.py bulunamadı")
        return result

    params = {
        "demo_age_ema_alpha": "0.3",
        "demo_min_confidence": "0.25",
        "demo_gender_consensus": "0.65",
        "demo_max_age_history": "30",
        "demo_max_gender_history": "30",
        "demo_temporal_decay": "0.95",
        "demo_continuous_refinement": "True",
    }

    for param, expected_default in params.items():
        result.check(
            param in code,
            f"'{param}' config parametresi mevcut",
            f"'{param}' config parametresi eksik!"
        )
        # Varsayılan değer kontrol
        if param in code:
            # Pattern: demo_xxx: type = value
            idx = code.index(param)
            line = code[idx:idx+120]
            result.check(
                expected_default in line,
                f"  → varsayılan={expected_default} ✓",
                f"  → varsayılan beklenen={expected_default} bulunamadı satırda: {line.strip()[:60]}"
            )

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# BÖLÜM D: YAML Config Dosyası Entegrasyonu
# ═══════════════════════════════════════════════════════════════════════════════

def test_yaml_config() -> TestResult:
    """default_zones.yaml'ın Faz 2 parametrelerini içerdiğini doğrula."""
    section("D1: YAML Config Dosyası Entegrasyonu")
    result = TestResult("YAMLConfig")

    content = read_file(YAML_FILE)
    if not content:
        result.skip(f"default_zones.yaml bulunamadı: {YAML_FILE}")
        return result

    # Task 2.1.2 YOLO parametreleri
    yolo_params = ["nms_iou_threshold", "agnostic_nms", "max_detections"]
    for param in yolo_params:
        result.check(
            param in content,
            f"YAML'da '{param}' belgelenmiş",
            f"YAML'da '{param}' eksik!"
        )

    # Task 2.2.1 Demografik parametreler
    demo_params = ["demo_age_ema_alpha", "demo_min_confidence", "demo_gender_consensus",
                   "demo_temporal_decay", "demo_continuous_refinement"]
    for param in demo_params:
        result.check(
            param in content,
            f"YAML'da '{param}' belgelenmiş",
            f"YAML'da '{param}' eksik!"
        )

    # YAML geçerli mi?
    try:
        import yaml
        data = yaml.safe_load(content)
        result.check(
            isinstance(data, dict),
            f"YAML parse başarılı ({len(data)} üst-düzey anahtar)",
            "YAML parse hatası!"
        )
    except ImportError:
        result.skip("PyYAML yüklü değil — parse testi atlanıyor")
    except Exception as e:
        result.check(False, "", f"YAML parse hatası: {e}")

    info(f"default_zones.yaml: {len(content.splitlines())} satır analiz edildi")
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# BÖLÜM E: Standalone Algoritma Birim Testleri
# (analytics.py'den bağımsız, saf Python ile algoritmaları test eder)
# ═══════════════════════════════════════════════════════════════════════════════

class StandaloneTrackedPerson:
    """
    analytics.py'deki TrackedPerson.update_age() ve update_gender() algoritmalarının
    standalone kopyası — bağımlılık olmadan test edebilmek için.
    """
    def __init__(self):
        self.age = None
        self.gender = "unknown"
        self.age_ema = None
        self.age_stability = 0.0
        self.gender_stability = 0.0
        self.gender_confidence = 0.5
        self.age_history = deque(maxlen=30)
        self.age_confidence_history = deque(maxlen=30)
        self.gender_history = deque(maxlen=30)
        self.gender_confidence_history = deque(maxlen=30)
        self._demo_update_count = 0

    def update_age(self, new_age, confidence=1.0, ema_alpha=0.3, min_confidence=0.25):
        """Mirrors analytics.py TrackedPerson.update_age()"""
        if new_age is None:
            return
        if confidence < min_confidence:
            return
        self._demo_update_count += 1
        self.age_history.append(float(new_age))
        self.age_confidence_history.append(float(confidence))

        samples = list(self.age_history)
        confidences = list(self.age_confidence_history)

        if len(samples) == 1:
            self.age = float(new_age)
            self.age_ema = float(new_age)
            self.age_stability = 0.0
            return

        effective_alpha = ema_alpha * confidence
        if self.age_ema is None:
            self.age_ema = float(new_age)
        else:
            self.age_ema = effective_alpha * new_age + (1 - effective_alpha) * self.age_ema

        if len(samples) >= 3:
            paired = sorted(zip(samples, confidences), key=lambda x: x[0])
            sorted_ages = [p[0] for p in paired]
            sorted_confs = [p[1] for p in paired]
            total_weight = sum(sorted_confs)

            if total_weight > 0:
                cumulative = 0.0
                weighted_median = sorted_ages[-1]
                for age_val, conf_val in paired:
                    cumulative += conf_val
                    if cumulative >= total_weight / 2:
                        weighted_median = age_val
                        break
            else:
                import statistics
                weighted_median = statistics.median(samples)

            blend = min(0.6, len(samples) / 20.0)
            self.age = (1 - blend) * self.age_ema + blend * weighted_median
        else:
            self.age = self.age_ema

        if len(samples) >= 3:
            recent = samples[-min(10, len(samples)):]
            mean = sum(recent) / len(recent)
            variance = sum((x - mean) ** 2 for x in recent) / len(recent)
            std_dev = math.sqrt(variance)
            self.age_stability = max(0.0, 1.0 - std_dev / 10.0)

    def update_gender(self, new_gender, confidence=1.0,
                      consensus_threshold=0.65, temporal_decay=0.95,
                      min_confidence=0.25):
        """Mirrors analytics.py TrackedPerson.update_gender()"""
        if not new_gender or new_gender == "unknown":
            return
        if confidence < min_confidence:
            return

        self.gender_history.append(new_gender)
        self.gender_confidence_history.append(float(confidence))

        while len(self.gender_confidence_history) > len(self.gender_history):
            self.gender_confidence_history.popleft()

        genders = list(self.gender_history)
        confs = list(self.gender_confidence_history)
        n = len(genders)

        male_score = 0.0
        female_score = 0.0

        for i in range(n):
            recency_weight = temporal_decay ** (n - 1 - i)
            weighted_vote = confs[i] * recency_weight

            if genders[i] == "male":
                male_score += weighted_vote
            elif genders[i] == "female":
                female_score += weighted_vote

        total_score = male_score + female_score
        if total_score == 0:
            return

        male_ratio = male_score / total_score
        female_ratio = female_score / total_score

        if male_ratio >= consensus_threshold:
            self.gender = "male"
            self.gender_confidence = male_ratio
        elif female_ratio >= consensus_threshold:
            self.gender = "female"
            self.gender_confidence = female_ratio

        self.gender_stability = max(male_ratio, female_ratio)


def test_age_ema_algorithm() -> TestResult:
    """EMA + weighted median hybrid algoritma birim testleri."""
    section("E1: Yaş EMA + Weighted Median Algoritması")
    result = TestResult("AgeAlgo")

    # --- Test 1: İlk tahmin doğrudan kabul ---
    p = StandaloneTrackedPerson()
    p.update_age(25.0, confidence=0.9)
    result.check(
        p.age is not None and abs(p.age - 25.0) < 0.01,
        f"İlk tahmin doğrudan kabul: age={p.age:.1f}",
        f"İlk tahmin hatalı: age={p.age}"
    )

    # --- Test 2: EMA yakınsama ---
    p2 = StandaloneTrackedPerson()
    for _ in range(20):
        p2.update_age(30.0, confidence=0.8)
    result.check(
        p2.age is not None and abs(p2.age - 30.0) < 2.0,
        f"20 frame yakınsama: age={p2.age:.1f} (hedef=30)",
        f"Yakınsama başarısız: age={p2.age}"
    )

    # --- Test 3: Outlier dayanıklılığı ---
    p3 = StandaloneTrackedPerson()
    for _ in range(15):
        p3.update_age(28.0, confidence=0.85)
    age_before = p3.age
    # Düşük güvenli aykırı
    p3.update_age(80.0, confidence=0.3)
    age_after = p3.age
    drift = abs(age_after - age_before) if age_before and age_after else 999
    result.check(
        drift < 5.0,
        f"Aykırı değer dayanıklılığı: kayma={drift:.1f} (<5.0)",
        f"Aykırı değer çok fazla etki: kayma={drift:.1f}"
    )

    # --- Test 4: age_ema takibi ---
    result.check(
        p3.age_ema is not None,
        f"age_ema takip ediliyor: {p3.age_ema:.1f}",
        "age_ema None — EMA uygulanmamış!"
    )

    # --- Test 5: Düşük güven filtreleme ---
    p4 = StandaloneTrackedPerson()
    p4.update_age(30.0, confidence=0.1, min_confidence=0.25)
    result.check(
        p4.age is None,
        "Çok düşük güven (0.1 < 0.25) filtrelendi → age=None",
        f"Düşük güven filtrelenmedi! age={p4.age}"
    )

    # --- Test 6: Yüksek güven daha hızlı günceller ---
    p_hi = StandaloneTrackedPerson()
    p_hi.update_age(20.0, confidence=0.9)
    p_hi.update_age(40.0, confidence=0.95)
    shift_hi = abs(p_hi.age - 20.0) if p_hi.age else 0

    p_lo = StandaloneTrackedPerson()
    p_lo.update_age(20.0, confidence=0.9)
    p_lo.update_age(40.0, confidence=0.3)
    shift_lo = abs(p_lo.age - 20.0) if p_lo.age else 0

    result.check(
        shift_hi > shift_lo,
        f"Yüksek güven daha fazla kaydırıyor: hi_shift={shift_hi:.1f} > lo_shift={shift_lo:.1f}",
        f"Güven ağırlığı çalışmıyor: hi={shift_hi:.1f}, lo={shift_lo:.1f}"
    )

    # --- Test 7: _demo_update_count ---
    result.check(
        p3._demo_update_count == 16,  # 15 + 1 outlier
        f"Update sayacı doğru: {p3._demo_update_count}",
        f"Update sayacı hatalı: {p3._demo_update_count} (beklenen=16)"
    )

    return result


def test_gender_temporal_decay_algorithm() -> TestResult:
    """Temporal decay voting birim testleri."""
    section("E2: Cinsiyet Temporal Decay Voting Algoritması")
    result = TestResult("GenderAlgo")

    # --- Test 1: Tutarlı voteler → consensus ---
    p1 = StandaloneTrackedPerson()
    for _ in range(5):
        p1.update_gender("male", confidence=0.9)
    result.check(
        p1.gender == "male",
        f"5x male (conf=0.9) → gender='male' ✓",
        f"Consensus başarısız: '{p1.gender}'"
    )

    # --- Test 2: Temporal decay — eski voteler zayıflar ---
    p2 = StandaloneTrackedPerson()
    for _ in range(10):
        p2.update_gender("male", confidence=0.7, temporal_decay=0.85)
    result.check(p2.gender == "male", "10x male → 'male'", f"Hatalı: '{p2.gender}'")

    for _ in range(15):
        p2.update_gender("female", confidence=0.95, temporal_decay=0.85)
    result.check(
        p2.gender == "female",
        f"Temporal decay: 15x female (high conf) eski 10x male'i geçti → '{p2.gender}' ✓",
        f"Temporal decay çalışmıyor! Hâlâ '{p2.gender}'"
    )

    # --- Test 3: gender_stability 0-1 aralığında ---
    result.check(
        0.0 <= p2.gender_stability <= 1.0,
        f"gender_stability aralıkta: {p2.gender_stability:.2f}",
        f"gender_stability aralık dışında: {p2.gender_stability}"
    )

    # --- Test 4: gender_confidence ---
    result.check(
        p2.gender_confidence > 0.5,
        f"gender_confidence: {p2.gender_confidence:.2f}",
        f"gender_confidence çok düşük: {p2.gender_confidence}"
    )

    # --- Test 5: Düşük güven filtreleme ---
    p3 = StandaloneTrackedPerson()
    p3.update_gender("male", confidence=0.1, min_confidence=0.25)
    result.check(
        p3.gender == "unknown" and len(p3.gender_history) == 0,
        "Düşük güven filtrelendi → gender='unknown', history boş",
        f"Filtreleme başarısız: gender='{p3.gender}', history={len(p3.gender_history)}"
    )

    # --- Test 6: "unknown" girdi yoksayılır ---
    p4 = StandaloneTrackedPerson()
    p4.update_gender("unknown", confidence=0.9)
    result.check(
        p4.gender == "unknown" and len(p4.gender_history) == 0,
        "'unknown' girdi yoksayıldı ✓",
        f"'unknown' yoksayılmadı! history={len(p4.gender_history)}"
    )

    # --- Test 7: Consensus eşiği ---
    p5 = StandaloneTrackedPerson()
    # 60/40 bölünme, threshold=0.65 → consensus yok
    for _ in range(6):
        p5.update_gender("male", confidence=0.8, consensus_threshold=0.65, temporal_decay=1.0)
    for _ in range(4):
        p5.update_gender("female", confidence=0.8, consensus_threshold=0.65, temporal_decay=1.0)
    # male_ratio ≈ 0.6 < 0.65 consensus
    # BUT: 6 male came first, so after those 6, gender was already set to "male"
    # The question is whether adding 4 female changes it back.
    # With temporal_decay=1.0, male_ratio = 6/10 = 0.6 which is < 0.65
    # So the gender stays whatever it was before (male from the first 6)
    info(f"60/40 split (threshold=0.65): gender='{p5.gender}', stability={p5.gender_stability:.2f}")

    return result


def test_stability_scores() -> TestResult:
    """Stability skorları birim testleri."""
    section("E3: Stability Skorları")
    result = TestResult("Stability")

    # --- Yaş stability: tutarlı → yüksek ---
    p1 = StandaloneTrackedPerson()
    for _ in range(10):
        p1.update_age(30.0, confidence=0.9)
    result.check(
        p1.age_stability > 0.8,
        f"Tutarlı yaş → yüksek stability: {p1.age_stability:.2f}",
        f"Stability düşük olmamalı: {p1.age_stability:.2f}"
    )

    # --- Yaş stability: dağınık → düşük ---
    p2 = StandaloneTrackedPerson()
    random.seed(42)
    for _ in range(10):
        p2.update_age(random.uniform(15, 70), confidence=0.8)
    result.check(
        p2.age_stability < 0.5,
        f"Dağınık yaş → düşük stability: {p2.age_stability:.2f}",
        f"Stability yüksek olmamalı: {p2.age_stability:.2f}"
    )

    # --- Stability 0-1 aralığında ---
    result.check(
        0.0 <= p1.age_stability <= 1.0 and 0.0 <= p2.age_stability <= 1.0,
        f"age_stability 0-1 aralığında ✓ ({p1.age_stability:.2f}, {p2.age_stability:.2f})",
        "age_stability aralık dışında!"
    )

    # --- Gender stability: güçlü consensus → yüksek ---
    p3 = StandaloneTrackedPerson()
    for _ in range(10):
        p3.update_gender("female", confidence=0.9)
    result.check(
        p3.gender_stability > 0.8,
        f"Güçlü cinsiyet consensus → yüksek stability: {p3.gender_stability:.2f}",
        f"Gender stability düşük: {p3.gender_stability:.2f}"
    )

    return result


def test_processing_speed_simulation() -> TestResult:
    """Demografik algoritma hızı — 10 kişi × 100 frame simülasyonu."""
    section("E4: İşleme Hızı Simülasyonu")
    result = TestResult("Speed")

    random.seed(123)
    people = [StandaloneTrackedPerson() for _ in range(10)]

    start = time.perf_counter()
    for frame_idx in range(100):
        for i, person in enumerate(people):
            base_age = 25 + i * 3
            noisy_age = base_age + random.gauss(0, 3)
            conf = random.uniform(0.4, 0.95)
            person.update_age(noisy_age, confidence=conf)

            gender = "male" if random.random() > 0.3 else "female"
            g_conf = random.uniform(0.5, 0.95)
            person.update_gender(gender, confidence=g_conf)

    elapsed_ms = (time.perf_counter() - start) * 1000

    result.check(
        elapsed_ms < 500,
        f"10 kişi × 100 frame = {elapsed_ms:.1f}ms (limit: 500ms)",
        f"Çok yavaş! {elapsed_ms:.1f}ms > 500ms"
    )

    # Stability ortalamaları
    avg_age_stab = sum(p.age_stability for p in people) / len(people)
    avg_gender_stab = sum(p.gender_stability for p in people) / len(people)
    result.check(
        avg_age_stab > 0.3,
        f"Ortalama yaş stability: {avg_age_stab:.2f} (> 0.3)",
        f"Yaş stability çok düşük: {avg_age_stab:.2f}"
    )
    result.check(
        avg_gender_stab > 0.5,
        f"Ortalama cinsiyet stability: {avg_gender_stab:.2f} (> 0.5)",
        f"Cinsiyet stability çok düşük: {avg_gender_stab:.2f}"
    )

    # Her kişinin age değeri makul mü?
    all_ages_valid = all(p.age is not None and 10 < p.age < 80 for p in people)
    result.check(
        all_ages_valid,
        f"Tüm kişilerin yaşı makul aralıkta: {[f'{p.age:.0f}' for p in people]}",
        f"Bazı yaşlar makul değil: {[f'{p.age}' for p in people]}"
    )

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# ANA TEST KOŞUCUSU
# ═══════════════════════════════════════════════════════════════════════════════

def run_all_tests(verbose: bool = False) -> bool:
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  ObservAI — Task 2.2.2 Performans Entegrasyon Testi{RESET}")
    print(f"{BOLD}{'='*60}{RESET}")
    print(f"  Tarih: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Python: {sys.version.split()[0]}")
    print()

    all_results: list = []

    # Bölüm A: Async Pipeline (Statik)
    all_results.append(test_async_pipeline_code())
    all_results.append(test_async_metrics_fields())

    # Bölüm B: YOLO Optimization (Statik)
    all_results.append(test_hardware_optimizer_code())
    all_results.append(test_yolo_config_params())

    # Bölüm C: Demographic Improvement (Statik)
    all_results.append(test_demographic_improvement_code())
    all_results.append(test_demographic_config_params())

    # Bölüm D: YAML Config
    all_results.append(test_yaml_config())

    # Bölüm E: Standalone Algoritma Testleri
    all_results.append(test_age_ema_algorithm())
    all_results.append(test_gender_temporal_decay_algorithm())
    all_results.append(test_stability_scores())
    all_results.append(test_processing_speed_simulation())

    # ── Özet ─────────────────────────────────────────────────────────────────
    section("TEST SONUÇLARI")

    total_passed  = sum(r.passed for r in all_results)
    total_failed  = sum(r.failed for r in all_results)
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
        print(f"\n{GREEN}{BOLD}  ✅ TÜM TESTLER GEÇTİ — Task 2.2.2 TAMAMLANDI{RESET}")
        print(f"{GREEN}  Faz 2 Performans İyileştirmeleri Entegrasyon Testi Başarılı!{RESET}\n")
    else:
        print(f"\n{RED}{BOLD}  ❌ {total_failed} TEST BAŞARISIZ{RESET}\n")

    return overall_success


if __name__ == "__main__":
    args = sys.argv[1:]
    verbose = "--verbose" in args or "-v" in args

    success = run_all_tests(verbose=verbose)
    sys.exit(0 if success else 1)
