from __future__ import annotations

import hashlib
import json
import logging
import os
import time
import warnings
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Tuple

# ── Debug logging ────────────────────────────────────────────────────────────
# Set env var OBSERVAI_DEBUG=1 to enable verbose per-frame / per-person logs.
# Example (Windows CMD):  set OBSERVAI_DEBUG=1
# Example (PowerShell):   $env:OBSERVAI_DEBUG="1"
_DEBUG = os.environ.get("OBSERVAI_DEBUG", "0") == "1"
_log = logging.getLogger(__name__)
# ─────────────────────────────────────────────────────────────────────────────

import cv2
import numpy as np

# Suppress FutureWarning from InsightFace (deprecated scikit-image estimate function)
warnings.filterwarnings('ignore', category=FutureWarning, module='insightface')

try:
  from insightface.app import FaceAnalysis
except Exception:  # pragma: no cover - handled at runtime
  FaceAnalysis = None

from ultralytics import YOLO

from .config import AnalyticsConfig, EntranceLine, Zone
from .geometry import heatmap_bin, line_side, point_in_polygon
from .metrics import (
  ActivePersonSnapshot,
  CameraMetrics,
  QueueSnapshot,
  TableSnapshot,
  ZoneSnapshot,
  bucket_for_age,
  default_age_buckets,
)
from .optimize import HardwareOptimizer
from .age_gender import EstimatorFactory, AgeGenderEstimator


@dataclass
class TrackedPerson:
  track_id: int
  first_seen: float
  last_seen: float
  bbox_norm: Tuple[float, float, float, float]
  prev_center_norm: Optional[Tuple[float, float]] = None
  center_norm: Tuple[float, float] = (0.0, 0.0)
  counted_in: bool = False
  counted_out: bool = False
  inside: bool = False
  age: Optional[float] = None
  gender: str = "unknown"
  state: str = "entering"
  active_zones: Dict[str, float] = field(default_factory=dict)
  anonymous_id: Optional[str] = None  # Privacy-preserving ID for cross-zone tracking

  # Task 2.2.1: Improved temporal smoothing for demographics
  age_history: deque = field(default_factory=lambda: deque(maxlen=80))
  age_confidence_history: deque = field(default_factory=lambda: deque(maxlen=80))
  gender_history: deque = field(default_factory=lambda: deque(maxlen=80))
  gender_confidence_history: deque = field(default_factory=lambda: deque(maxlen=80))
  gender_confidence: float = 0.5
  age_ema: Optional[float] = None     # Exponential moving average for age
  age_stability: float = 0.0          # How stable the age prediction is (0-1)
  gender_stability: float = 0.0       # How stable the gender prediction is (0-1)
  gender_locked: bool = False          # Once locked, gender no longer changes
  age_locked: bool = False             # Once locked, age no longer changes
  demographics_frozen: bool = False    # Both age+gender locked → skip all face processing
  _gender_consecutive_same: int = 0    # Consecutive same-gender high-confidence votes
  _gender_consecutive_opposite: int = 0  # Consecutive opposite-gender votes (for unlock)
  _gender_last_vote: str = ""          # Last voted gender for consecutive tracking
  _demo_update_count: int = 0         # Total demographic update count
  smoothed_bbox_norm: Optional[Tuple[float, float, float, float]] = None
  zone_consecutive_inside: Dict[str, int] = field(default_factory=dict)
  zone_consecutive_outside: Dict[str, int] = field(default_factory=dict)
  # Stage 2: last 2 bbox samples (timestamp, bbox_norm) for display-side interpolation
  # so the smooth-mode MJPEG can render bboxes between inference ticks.
  bbox_samples: deque = field(default_factory=lambda: deque(maxlen=2))

  def contains_pixel(self, px: float, py: float) -> bool:
    x1, y1, x2, y2 = self.bbox_norm
    return x1 <= px <= x2 and y1 <= py <= y2

  def update_age(self, new_age: float, confidence: float = 1.0,
                 ema_alpha: float = 0.15, min_confidence: float = 0.25,
                 lock_stability: float = 0.95, lock_min_samples: int = 30) -> None:
    """
    Confidence-weighted EMA + median hybrid for age estimation.

    Uses exponential moving average weighted by confidence for responsive updates,
    combined with median filtering for outlier robustness. Once stable, age changes
    are heavily dampened to prevent display jitter.

    Args:
        new_age: Raw age prediction from model
        confidence: Detection/prediction confidence (0-1)
        ema_alpha: EMA smoothing factor (higher = more responsive, from config)
        min_confidence: Minimum confidence to accept (from config)
    """
    if new_age is None:
      return

    # Age locked — no further updates
    if self.age_locked:
      return

    # Filter very low confidence to prevent noise injection
    if confidence < min_confidence:
      return

    self._demo_update_count += 1

    # Store with confidence for weighted calculations
    self.age_history.append(float(new_age))
    self.age_confidence_history.append(float(confidence))

    samples = list(self.age_history)
    confidences = list(self.age_confidence_history)

    if len(samples) == 1:
      # First sample: accept directly
      self.age = float(new_age)
      self.age_ema = float(new_age)
      self.age_stability = 0.0
      return

    # --- Confidence-weighted EMA ---
    # Alpha scales with confidence: high-confidence updates shift the EMA more
    effective_alpha = ema_alpha * confidence
    # Once stable, dampen alpha with soft transition to prevent display jitter
    if self.age_stability > 0.5 and len(samples) >= 10:
      effective_alpha *= max(0.3, 1.0 - self.age_stability)
    if self.age_ema is None:
      self.age_ema = float(new_age)
    else:
      self.age_ema = effective_alpha * new_age + (1 - effective_alpha) * self.age_ema

    # --- Confidence-weighted median (outlier-robust) ---
    if len(samples) >= 3:
      # Sort samples by value, compute weighted median
      paired = sorted(zip(samples, confidences), key=lambda x: x[0])
      sorted_ages = [p[0] for p in paired]
      sorted_confs = [p[1] for p in paired]
      total_weight = sum(sorted_confs)

      if total_weight > 0:
        cumulative = 0.0
        weighted_median = sorted_ages[-1]  # fallback
        for age_val, conf_val in paired:
          cumulative += conf_val
          if cumulative >= total_weight / 2:
            weighted_median = age_val
            break
      else:
        weighted_median = float(np.median(samples))

      # Blend EMA (responsive) with weighted median (robust)
      # More samples = trust median more; fewer = trust EMA more
      # Higher cap (0.75) so median dominates once we have enough data
      blend = min(0.75, len(samples) / 15.0)
      self.age = (1 - blend) * self.age_ema + blend * weighted_median
    else:
      # Few samples: use EMA directly
      self.age = self.age_ema

    # --- Stability score ---
    # Low variance in recent predictions = high stability
    if len(samples) >= 3:
      window = min(30, len(samples))
      recent = samples[-window:]
      std_dev = float(np.std(recent))
      # Wider window + sample_factor: prevents premature freezing with few samples
      sample_factor = min(1.0, len(samples) / 20.0)
      self.age_stability = max(0.0, (1.0 - std_dev / 10.0) * sample_factor)

    # Lock age once highly stable with enough evidence.
    # Thresholds come from config (demo_age_lock_stability, demo_age_lock_min_samples).
    if not self.age_locked and self.age_stability > lock_stability and len(samples) >= lock_min_samples:
      self.age_locked = True

  def update_gender(self, new_gender: str, confidence: float = 1.0,
                    consensus_threshold: float = 0.70,
                    temporal_decay: float = 0.85,
                    min_confidence: float = 0.25,
                    lock_threshold: int = 8) -> None:
    """
    Confidence-weighted gender voting with temporal decay and locking.

    Once gender accumulates lock_threshold consecutive same-gender high-confidence
    votes, it locks permanently for this track to prevent flip-flopping.

    Args:
        new_gender: Predicted gender ("male"/"female")
        confidence: Prediction confidence (0-1)
        consensus_threshold: Required vote fraction for gender assignment (from config)
        temporal_decay: Decay multiplier for older votes (from config)
        min_confidence: Minimum confidence to accept (from config)
        lock_threshold: Consecutive same-gender votes to lock (from config)
    """
    if not new_gender or new_gender == "unknown":
      return

    if confidence < min_confidence:
      return

    # If gender is locked, check for unlock condition
    if self.gender_locked:
      # Track consecutive high-confidence opposite-gender votes
      if new_gender != self.gender and confidence >= 0.35:
        self._gender_consecutive_opposite += 1
        if self._gender_consecutive_opposite >= lock_threshold + 2:
          # Strong evidence of misclassification — unlock and reset
          self.gender_locked = False
          self.gender_history.clear()
          self.gender_confidence_history.clear()
          self._gender_consecutive_same = 0
          self._gender_consecutive_opposite = 0
          self._gender_last_vote = ""
          self.gender = "unknown"
          self.gender_stability = 0.0
          # Fall through to process this vote normally
        else:
          return
      else:
        self._gender_consecutive_opposite = 0
        return

    # Track consecutive same-gender votes for locking
    if new_gender == self._gender_last_vote and confidence >= 0.35:
      self._gender_consecutive_same += 1
    else:
      self._gender_consecutive_same = 1 if confidence >= 0.35 else 0
    self._gender_last_vote = new_gender

    # Store gender + confidence pair
    self.gender_history.append(new_gender)
    self.gender_confidence_history.append(float(confidence))

    # Trim to max history size (deque handles this, but keep confidence in sync)
    while len(self.gender_confidence_history) > len(self.gender_history):
      self.gender_confidence_history.popleft()

    # --- Temporal-decay confidence-weighted voting ---
    genders = list(self.gender_history)
    confs = list(self.gender_confidence_history)
    n = len(genders)

    male_score = 0.0
    female_score = 0.0

    for i in range(n):
      # Temporal decay: most recent sample (index n-1) has weight 1.0
      # Older samples decay by temporal_decay^(distance from newest)
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

    # Apply consensus threshold
    if male_ratio >= consensus_threshold:
      self.gender = "male"
      self.gender_confidence = male_ratio
    elif female_ratio >= consensus_threshold:
      self.gender = "female"
      self.gender_confidence = female_ratio
    # If neither reaches consensus, keep previous assignment (unknown > wrong)

    # --- Gender stability score ---
    self.gender_stability = max(male_ratio, female_ratio)

    # --- Gender lock: prevent flip-flopping ---
    # Lock once we have enough consecutive same-gender high-confidence votes
    # AND the consensus threshold is met
    if (self._gender_consecutive_same >= lock_threshold and
        self.gender != "unknown" and
        self.gender_stability >= consensus_threshold):
      self.gender_locked = True


class CameraAnalyticsEngine:
  """
  Real-time camera analytics engine using SOTA YOLOv12n for person detection.

  YOLOv12n provides improved accuracy and speed over YOLOv8n:
  - Better small object detection
  - Enhanced tracking stability
  - Optimized for real-time inference (<5ms latency target)

  Privacy Features:
  - Anonymous Re-ID: Uses non-biometric features (appearance, not facial embeddings)
  - GDPR/KVKK compliant: Optional privacy mode blurs faces/bodies
  - No PII storage: Anonymous IDs are one-way hashed, cannot be reversed
  """

  @staticmethod
  def _generate_anonymous_id(track_id: int, session_salt: str) -> str:
    """
    Generate privacy-preserving anonymous ID for cross-zone tracking.

    Uses one-way hash (SHA256) with session salt to ensure:
    - IDs cannot be reversed to reveal track_id
    - IDs are consistent within session for analytics
    - IDs change between sessions for privacy

    Args:
        track_id: Internal tracking ID
        session_salt: Random salt generated per session

    Returns:
        8-character anonymous ID (e.g., "A3F9C2E1")
    """
    hash_input = f"{session_salt}:{track_id}".encode()
    hash_output = hashlib.sha256(hash_input).hexdigest()
    return hash_output[:8].upper()

  def __init__(
    self,
    config: AnalyticsConfig,
    source: str | int,
    output_path: Path,
    model_path: str = "yolo11l.pt",
    sample_interval: float = 1.0,
    display: bool = False,
    show_zones: bool = False,
    on_metrics: Optional[Callable[[Dict[str, object]], None]] = None,
    on_tracks: Optional[Callable[[List[Dict[str, object]]], None]] = None,
    on_zone_insights: Optional[Callable[[List[Dict[str, object]]], None]] = None,
    preloaded_yolo=None,
    preloaded_estimator=None,
  ) -> None:
    self.config = config
    self.source = source
    self.output_path = output_path
    self.sample_interval = sample_interval
    self.display = display
    self.show_zones = show_zones
    self.on_metrics = on_metrics
    self.on_tracks = on_tracks
    self.on_zone_insights = on_zone_insights

    self.conf = config.confidence_threshold
    self.snapshot_interval = config.snapshot_interval
    self.last_metrics_write = 0.0
    self.privacy_mode = config.privacy_mode
    if self.privacy_mode:
      print("[INFO] Privacy Mode ENABLED: Faces and bodies will be blurred (GDPR/KVKK compliant)")

    # Generate session salt for anonymous Re-ID
    import secrets
    self.session_salt = secrets.token_hex(16)
    print("[INFO] Anonymous Re-ID enabled: Using non-biometric tracking (privacy-preserving)")

    # Thread-safe frame cache for MJPEG streaming
    import threading
    self._frame_lock = threading.Lock()
    self._latest_frame = None
    self._latest_raw_frame = None  # Raw capture frame (no overlay) for smooth MJPEG
    self._latest_frame_time = 0.0       # Timestamp of last annotated frame
    self._latest_raw_frame_time = 0.0   # Timestamp of last raw capture frame

    # Persistent overlay preferences (survive metric cycles)
    self._user_overlay_prefs = {
        'heatmap_visible': False
    }

    # Video capture tracking for explicit cleanup
    self._video_capture = None

    # Task 2.1.2: YOLO optimization parameters from config
    self.nms_iou = config.nms_iou_threshold
    self.agnostic_nms = config.agnostic_nms
    self.max_det = config.max_detections

    # Hardware-specific optimization (MPS for M3 Pro, TensorRT for RTX, ONNX for CPU)
    print("[INFO] Initializing hardware-optimized YOLOv12n...")
    self.device = HardwareOptimizer.get_optimal_device()
    self.inference_params = HardwareOptimizer.get_optimal_inference_params(
        override_imgsz=config.yolo_input_size,
    )

    # Load base model (use preloaded if available for faster startup)
    if preloaded_yolo is not None:
      print("[INFO] Using preloaded YOLO model (no reload needed)")
      self.model = preloaded_yolo
    else:
      self.model = YOLO(model_path)

      # Attempt hardware-specific optimization
      try:
        optimized_path = HardwareOptimizer.optimize_model(
          self.model,
          model_path,
          target_format=None  # Auto-detect best format
        )
        # Reload if optimized version was created
        if optimized_path != model_path and Path(optimized_path).exists():
          self.model = YOLO(optimized_path)
      except Exception as e:
        print(f"[WARN] Hardware optimization failed: {e}")
        print("[INFO] Continuing with standard PyTorch model")

    # Configure YOLO runtime with optimal settings (Task 2.1.2: configurable NMS/IoU/input)
    try:
      self.model.overrides['verbose'] = False
      self.model.overrides['conf'] = self.conf
      self.model.overrides['iou'] = self.nms_iou
      self.model.overrides['max_det'] = self.max_det
      self.model.overrides['half'] = self.inference_params.get('half', False)
      self.model.overrides['device'] = self.device
      self.model.overrides['agnostic_nms'] = self.agnostic_nms
      print(f"[INFO] YOLO configured: device={self.device.upper()}, "
            f"imgsz={self.inference_params['imgsz']}, conf={self.conf}, "
            f"iou={self.nms_iou}, agnostic_nms={self.agnostic_nms}, "
            f"max_det={self.max_det}")
    except Exception:  # pragma: no cover - safety guard
      pass

    # Frame skipping for face analysis (async processing)
    # RTX 5070 "Balanced Profile": higher intervals reduce GPU contention between
    # YOLO tracking and demographics, resulting in better overall FPS.
    # Use face_detection_interval from config, or override with env var FACE_DETECTION_INTERVAL
    face_interval_override = os.environ.get("FACE_DETECTION_INTERVAL")
    if face_interval_override:
      self.face_detection_interval = int(face_interval_override)
    else:
      self.face_detection_interval = config.face_detection_interval

    self.frame_count = 0
    self._last_track_emit_time = 0.0  # Throttle track emission to ~10 Hz
    self.demographics_executor = ThreadPoolExecutor(
      max_workers=1, thread_name_prefix="demographics"
    )
    self.pending_demographics_future = None
    self._latest_demo_results = {}
    # Demographics persistence cache: when a track is dropped, save demographics
    # so if the same person re-enters they keep their established gender/age
    self._dropped_demographics: Dict[str, tuple] = {}  # key: appearance_key, value: (person_data, drop_time)
    print(f"[INFO] Demographics processing: Async mode (every {self.face_detection_interval} frames)")

    # Resolve source using Factory
    from .sources import SourceFactory, VideoLinkSource
    
    video_source = SourceFactory.create_source(source)
    self.source = video_source.get_source()
    self.vid_stride = video_source.vid_stride
    
    # Store source metadata for frame rate control
    self.is_live_source = False
    self.source_fps: Optional[float] = None
    self.frame_delay: float = 0.0  # Delay between frames for playback timing
    self.original_url: Optional[str] = None  # Original URL for yt-dlp pipe mode
    
    # Get metadata from VideoLinkSource if available
    if isinstance(video_source, VideoLinkSource):
        source_info = video_source.get_source_info()
        self.is_live_source = source_info.get("is_live", False)
        self.source_fps = source_info.get("source_fps")
        self.original_url = source_info.get("original_url")  # For yt-dlp pipe mode
        
        # Calculate frame delay for non-live videos
        if not self.is_live_source and self.source_fps and self.source_fps > 0:
            self.frame_delay = 1.0 / self.source_fps
            print(f"[INFO] Frame delay for playback timing: {self.frame_delay*1000:.1f}ms ({self.source_fps} FPS)")
        elif self.is_live_source:
            print(f"[INFO] Live stream detected - no frame delay applied")
    
    print(f"[INFO] Source type: {type(video_source).__name__}")
    print(f"[INFO] Video stride: {self.vid_stride}")
    print(f"[INFO] Is live source: {self.is_live_source}")
    if self.source != source:
        print(f"[INFO] Resolved source: {str(self.source)[:50]}...")

    # CRITICAL: Validate source immediately during initialization.
    # This ensures that if the camera cannot be opened (e.g. iPhone not found),
    # the engine fails to initialize and reports the error back to the caller
    # before we return success to the frontend.
    self._validate_source_on_init()

    # Initialize Age/Gender Estimator (InsightFace for face detection)
    if preloaded_estimator is not None:
        print("[INFO] Using preloaded Age/Gender estimator (no reload needed)")
        self.age_gender_estimator = preloaded_estimator
    else:
        try:
            self.age_gender_estimator = EstimatorFactory.create_estimator()
            self.age_gender_estimator.prepare(ctx_id=0, det_size=(640, 640))
            print("[INFO] Age/Gender Estimator initialized (Optimized Mode)")
        except Exception as err:
            print(f"[WARN] Age/Gender Estimator initialization failed: {err}")
            self.age_gender_estimator = None

    # MiVOLO: SOTA age/gender model (face+body dual input)
    # Initialized here, but prepare() runs on inference thread for CUDA compat
    self.mivolo_estimator = EstimatorFactory.create_mivolo(device=str(self.device))
    if self.mivolo_estimator is not None:
        print("[INFO] MiVOLO estimator created (will prepare on inference thread)")
    else:
        print("[INFO] MiVOLO not available, using InsightFace for age/gender")

    self.tracks: Dict[int, TrackedPerson] = {}
    self.people_in = 0
    self.people_out = 0
    self.heatmap = np.zeros(
      (self.config.heatmap.grid_height, self.config.heatmap.grid_width), dtype=np.float32
    )

    # zone stats keyed by zone id
    self.zone_definitions: Dict[str, Zone] = {}
    self.table_ids: Iterable[str] = []
    for table in self.config.tables:
      self.zone_definitions[table.id] = table
    self.table_ids = [table.id for table in self.config.tables]
    if self.config.queue_zone:
      self.zone_definitions[self.config.queue_zone.id] = self.config.queue_zone
      self.queue_id = self.config.queue_zone.id
    else:
      self.queue_id = None

    self.zone_active_members: Dict[str, Dict[int, float]] = defaultdict(dict)
    self.zone_completed_durations: Dict[str, list[float]] = defaultdict(list)

    # Table occupancy state machine (v2 — proper transition tracking)
    self.table_status: Dict[str, str] = {}           # zone_id → "empty"|"occupied"|"needs_cleaning"
    self.table_left_at: Dict[str, float] = {}        # zone_id → timestamp when last person left
    self.table_turnover: Dict[str, int] = {}         # zone_id → occupy→leave cycle count
    self.table_occupy_start: Dict[str, float] = {}   # zone_id → when current occupancy began
    self.table_last_occupied_duration: Dict[str, float] = {}  # zone_id → duration of the last completed occupancy
    self.table_cleaning_since: Dict[str, float] = {} # zone_id → timestamp when status became needs_cleaning
    self.table_transit_empty_since: Dict[str, float] = {}  # zone_id → transient empty during occupancy (chair shuffle)
    for tid in self.table_ids:
      self.table_status[tid] = "empty"
      self.table_turnover[tid] = 0

    # Zone insights tracking (track IDs that have already triggered insights)
    self.zone_insight_triggered: Dict[str, set[int]] = defaultdict(set)
    self.zone_insight_threshold = 600.0  # 10 minutes in seconds

    # Performance metrics
    self.fps_start_time = time.time()
    self.fps_counter = 0
    self.fps = 0.0
    self.running = False
    # Task 2.1.1: Async pipeline per-thread FPS counters
    self.capture_fps   = 0.0   # Thread 1: Frame capture FPS
    self.inference_fps = 0.0   # Thread 2: YOLO inference FPS
    
    # Initialize Glass Visualization Overlay
    from .overlay_viz import GlassOverlay
    # Assuming standard HD frame for init, will resize if needed or handle in render
    self.overlay = GlassOverlay(1280, 720) 

  def update_zones(self, zones_data: List[Dict]) -> None:
    """
    Update zone definitions dynamically from the frontend.
    Thread-safe zone update. Now respects zone type for table/queue semantics.
    """
    print(f"[INFO] Updating {len(zones_data)} zones dynamically...")

    new_zones = {}
    new_table_ids = []
    new_queue_id = None

    for zd in zones_data:
        # Frontend provides rect: x, y, width, height (normalized)
        # Backend needs polygon: [(x,y), (x+w,y), (x+w,y+h), (x,y+h)]
        x, y = float(zd.get('x', 0)), float(zd.get('y', 0))
        w, h = float(zd.get('width', 0)), float(zd.get('height', 0))
        zone_id = str(zd.get('id', 'unknown'))
        name = zd.get('name', f"Zone {zone_id}")
        zone_type = str(zd.get('type', 'entrance')).lower()

        polygon = [
            (x, y),
            (x + w, y),
            (x + w, y + h),
            (x, y + h)
        ]

        new_zones[zone_id] = Zone(
            id=zone_id,
            name=name,
            polygon=polygon
        )

        # Route zone to correct category based on type
        if zone_type == 'table':
            new_table_ids.append(zone_id)
        elif zone_type == 'queue':
            new_queue_id = zone_id

    # Use frame lock to ensure we don't swap zones while processing a frame
    with self._frame_lock:
        self.zone_definitions = new_zones
        self.table_ids = new_table_ids
        if new_queue_id:
            self.queue_id = new_queue_id

        # Initialize state for new tables
        for tid in new_table_ids:
            if tid not in self.table_status:
                self.table_status[tid] = "empty"
                self.table_turnover[tid] = 0
        # Clean up removed tables
        for old_tid in list(self.table_status.keys()):
            if old_tid not in new_table_ids:
                self.table_status.pop(old_tid, None)
                self.table_turnover.pop(old_tid, None)
                self.table_left_at.pop(old_tid, None)
                self.table_occupy_start.pop(old_tid, None)
                self.table_last_occupied_duration.pop(old_tid, None)
                self.table_cleaning_since.pop(old_tid, None)
                self.table_transit_empty_since.pop(old_tid, None)

    table_names = [new_zones[tid].name for tid in new_table_ids if tid in new_zones]
    print(f"[INFO] ✓ Zones updated: {[z.name for z in new_zones.values()]} | Tables: {table_names}")

  def stop(self) -> None:
    """Stop the analytics engine"""
    print("[INFO] Stopping analytics engine...")
    self.running = False
    if hasattr(self, 'demographics_executor'):
      self.demographics_executor.shutdown(wait=False)
      print("[INFO] Demographics executor shut down")

  def _validate_source_on_init(self) -> None:
    """
    Validate that the video source can be opened and read.
    Also detects FPS for non-live sources if not already set.
    Raises ValueError if validation fails (but allows graceful fallback for cameras).
    """
    print(f"[INFO] Validating video source: {self.source}")

    if isinstance(self.source, int):
      from .sources import _get_camera_backend
      import platform as _plat
      cap = cv2.VideoCapture(self.source, _get_camera_backend())

      if self.source >= 1:
        print(f"[INFO] Detected secondary camera (likely iPhone/iVCam), configuring 1080p")
        # MJPG codec: 1080p için zorunlu, tüm platformlarda
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
        cap.set(cv2.CAP_PROP_FPS, 30.0)
        actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        print(f"[INFO] Camera resolution set: {actual_w}x{actual_h}")
      elif _plat.system() == "Windows":
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
    else:
      # Use FFMPEG backend for network streams (HTTP/HTTPS) to avoid CAP_IMAGES fallback issues
      if isinstance(self.source, str) and self.source.startswith(('http://', 'https://')):
        cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
        # Set timeouts for HTTP streams (iVCam, IP cameras) to avoid indefinite hangs
        cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)   # 10s to open connection
        cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 15000)    # 15s per frame read
      else:
        cap = cv2.VideoCapture(self.source)

      # For network streams (live), set buffer size and other options
      if self.is_live_source:
        # Larger buffer for HLS streams — segments arrive in 2-6s bursts
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 30)
        print(f"[INFO] Set buffer size to 30 for live stream")

    if not cap.isOpened():
      error_msg = f"Failed to open video source: {self.source}"
      try:
        backend_name = cap.getBackendName()
        error_msg += f" (Backend: {backend_name})"
      except Exception:
        pass

      print(f"[ERROR] {error_msg}")

      # For cameras: Don't raise error here, let it be caught during actual run
      # This allows frontend to switch cameras without crashing
      if isinstance(self.source, int):
        print(f"[WARN] Camera validation failed, but will retry during stream initialization")
        if cap:
          cap.release()
        return

      # For non-camera sources (YouTube, files, etc): raise error
      raise ValueError(error_msg)

    # Try to get FPS from OpenCV if not already set (fallback for non-live videos)
    if not self.is_live_source and self.source_fps is None:
      opencv_fps = cap.get(cv2.CAP_PROP_FPS)

      # OVERRIDE: If camera index 1 (iPhone) reports low FPS, force 30 FPS
      if isinstance(self.source, int) and self.source == 1 and opencv_fps < 15:
        print(f"[WARN] iPhone camera reported {opencv_fps} FPS, overriding to 30 FPS")
        self.source_fps = 30.0
        self.frame_delay = 1.0 / 30.0
        print(f"[INFO] Forced FPS: {self.source_fps:.1f} (frame delay: {self.frame_delay*1000:.1f}ms)")
      elif opencv_fps and opencv_fps > 0:
        self.source_fps = opencv_fps
        self.frame_delay = 1.0 / self.source_fps
        print(f"[INFO] Detected FPS from OpenCV: {self.source_fps:.1f} (frame delay: {self.frame_delay*1000:.1f}ms)")
      else:
        # Default to 30 FPS for pre-recorded videos without FPS info
        self.source_fps = 30.0
        self.frame_delay = 1.0 / 30.0
        print(f"[INFO] Could not detect FPS, using default: 30 FPS")

    # Test read a frame to ensure camera is actually working
    ret, test_frame = cap.read()
    cap.release()

    if not ret or test_frame is None:
      error_msg = f"Video source {self.source} opened but cannot read frames!"
      print(f"[ERROR] {error_msg}")
      raise ValueError(error_msg)
    
    print(f"[INFO] ✓ Video source validation successful (shape: {test_frame.shape})")

  def get_latest_frame_safe(self) -> Optional[np.ndarray]:
    """Thread-safe access to latest frame for MJPEG streaming.

    Returns the MOST RECENT frame — either raw capture or annotated.
    Raw frames update at capture speed (30 FPS), annotated frames update
    at inference speed (10-15 FPS). Preferring the most recent ensures
    smooth video even when inference can't keep up with capture.
    """
    with self._frame_lock:
      raw = self._latest_raw_frame
      raw_t = self._latest_raw_frame_time
      ann = self._latest_frame
      ann_t = self._latest_frame_time

    # Return whichever frame is most recent
    # If raw is >50ms newer than annotated, inference hasn't caught up — show raw
    if raw is not None and (ann is None or raw_t > ann_t + 0.05):
      return raw.copy()
    if ann is not None:
      return ann.copy()
    if raw is not None:
      return raw.copy()
    return None

  def get_latest_raw_frame_safe(self) -> Optional[np.ndarray]:
    """Return only the latest raw capture frame (no overlay).

    Used by smooth-mode MJPEG to render fresh interpolated bboxes on top of
    the most recent capture without waiting for inference.
    """
    with self._frame_lock:
      if self._latest_raw_frame is None:
        return None
      return self._latest_raw_frame.copy()

  def get_interpolated_tracks(self, now: float) -> List[Dict]:
    """Return track snapshots at `now` with linearly interpolated bboxes.

    Uses the last two (timestamp, bbox_norm) samples per track:
    - Two samples + gap ≤ 200 ms → linear extrapolation toward `now`
    - Otherwise → freeze at the most recent sample (avoids teleporting a bbox
      across the frame when inference has stalled for a while).

    Returns a list of plain dicts (track_id, bbox_norm, gender, age, inside,
    first_seen) so the caller doesn't need a lock while rendering.
    """
    snapshots: List[Dict] = []
    # Short critical section: copy samples + display fields under the lock then
    # release before doing math.
    try:
      items = list(self.tracks.items())
    except RuntimeError:
      # tracks dict mutated concurrently — skip this tick
      return snapshots

    INFER_GAP_FREEZE = 0.200  # seconds — if inference gap > this, stop extrapolating
    MAX_EXTRAPOLATE = 0.100   # seconds — never extrapolate more than 100 ms ahead

    for _tid, person in items:
      samples = list(person.bbox_samples)
      if not samples:
        continue
      latest_t, latest_bbox = samples[-1]
      # Drop tracks that haven't been updated recently to avoid ghosting.
      if now - latest_t > INFER_GAP_FREEZE + 1.0:
        continue
      if len(samples) < 2 or (latest_t - samples[0][0]) <= 0:
        bbox = latest_bbox
      else:
        prev_t, prev_bbox = samples[0]
        dt = latest_t - prev_t
        # Extrapolate slightly ahead of latest sample to follow the motion.
        ahead = max(0.0, min(now - latest_t, MAX_EXTRAPOLATE))
        if now - latest_t > INFER_GAP_FREEZE:
          bbox = latest_bbox
        else:
          t_ratio = (dt + ahead) / dt
          bbox = tuple(
            prev + (latest - prev) * t_ratio
            for prev, latest in zip(prev_bbox, latest_bbox)
          )  # type: ignore[assignment]

      snapshots.append({
        "track_id": person.track_id,
        "bbox_norm": bbox,
        "gender": person.gender,
        "age": person.age,
        "inside": person.inside,
        "first_seen": person.first_seen,
      })
    return snapshots

  def get_smooth_frame(self, now: Optional[float] = None) -> Optional[np.ndarray]:
    """Render the latest raw frame with interpolated bboxes overlaid.

    Called by the MJPEG /smooth handler at display rate (up to 60 FPS) so the
    video stays fluid even when inference runs at 20–25 FPS. Tracks are taken
    from `get_interpolated_tracks`, which frees us from the inference cadence.
    """
    if now is None:
      now = time.time()
    frame = self.get_latest_raw_frame_safe()
    if frame is None:
      return None
    tracks = self.get_interpolated_tracks(now)
    if not tracks:
      return frame
    fh, fw = frame.shape[:2]
    for t in tracks:
      bx1, by1, bx2, by2 = t["bbox_norm"]
      p1 = (int(bx1 * fw), int(by1 * fh))
      p2 = (int(bx2 * fw), int(by2 * fh))
      color = (0, 255, 0) if t["inside"] else (0, 0, 255)
      cv2.rectangle(frame, p1, p2, color, 2)
      label_bits = [f"#{t['track_id']}"]
      if t["gender"] and t["gender"] != "unknown":
        g = "M" if t["gender"] == "male" else "F"
        if t["age"]:
          label_bits.append(f"{g} {int(t['age'])}y")
        else:
          label_bits.append(g)
      elif t["age"]:
        label_bits.append(f"{int(t['age'])}y")
      label = " | ".join(label_bits)
      (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
      ly = max(th + 4, p1[1] - 6)
      cv2.rectangle(frame, (p1[0], ly - th - 4), (p1[0] + tw + 6, ly + 2), (20, 20, 40), -1)
      cv2.putText(frame, label, (p1[0] + 3, ly - 2),
                  cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    return frame

  def get_snapshot(self) -> Optional[str]:
    """Capture a single frame and return as base64 string (thread-safe)"""
    import base64

    frame = None

    # CRITICAL FIX: If engine is running, ALWAYS use the cached frame.
    # NEVER try to open the source again, as it will cause a hardware conflict
    # and massive FPS drops/lag on the capture device.
    if self.running:
        frame = self.get_latest_frame_safe()
        # If running but no frame yet, return None or wait (returning None is safer)
        if frame is None:
            return None

    # If NOT running, we can safely open the source momentarily
    else:
        # If no cached frame (or not running), try to capture fresh
        if isinstance(self.source, str) and self.source.startswith(('http://', 'https://')):
            cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
        else:
            cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            return None

        # Read a few frames to settle auto-exposure
        for _ in range(5):
            cap.grab()

        ret, frame = cap.read()
        cap.release()

        if not ret:
            return None

    # Encode as JPEG — quality 85 for snapshots (good quality, reasonable size)
    encode_params = [cv2.IMWRITE_JPEG_QUALITY, 85]
    _, buffer = cv2.imencode('.jpg', frame, encode_params)
    jpg_as_text = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{jpg_as_text}"

  def run(self) -> None:
    print("[INFO] Starting camera analytics pipeline...")
    print(f"[INFO] Face detection interval: every {self.face_detection_interval} frames")
    print(f"[INFO] Video stride: {self.vid_stride} (source: {self.source})")
    print(f"[INFO] Confidence threshold: {self.conf}")

    self.running = True
    if self.snapshot_interval > 0:
      print(f"[INFO] Snapshot mode enabled: every {self.snapshot_interval}s")
      self._run_snapshots()
    else:
      self._run_continuous()

  def _run_continuous(self) -> None:
    """
    Run continuous tracking with explicit camera cleanup.
    Tüm platformlarda (Windows, macOS, Linux) async 3-thread pipeline kullanır.
    Producer-Consumer modeli: frame capture YOLO inference'ı beklemez.
    """
    import platform as _plat
    from .sources import _get_camera_backend

    if isinstance(self.source, int):
      # Tüm platformlar için async pipeline — Windows ve macOS/Linux
      backend = _get_camera_backend()
      cap = cv2.VideoCapture(self.source, backend)
      cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
      cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
      cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
      cap.set(cv2.CAP_PROP_FPS, 30)
      cap.set(cv2.CAP_PROP_BUFFERSIZE, 30)
      actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
      actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
      # If camera doesn't support 1080p, try 720p
      if actual_w < 1280 or actual_h < 720:
        print(f"[WARN] Camera returned {actual_w}x{actual_h}, trying 1280x720...")
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
      # If 720p also failed (0x0), fall back to camera's native resolution
      if actual_w == 0 or actual_h == 0:
        print(f"[WARN] Resolution {actual_w}x{actual_h} invalid, falling back to 640x480...")
        cap.release()
        cap = cv2.VideoCapture(self.source, backend)
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 30)
        actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        # Last resort: just read whatever the camera gives
        if actual_w == 0 or actual_h == 0:
          ret, test_frame = cap.read()
          if ret and test_frame is not None:
            actual_h, actual_w = test_frame.shape[:2]
            print(f"[INFO] Got actual frame: {actual_w}x{actual_h}")
          else:
            print(f"[ERROR] Cannot read any frame from camera {self.source}")
      print(f"[INFO] Webcam ({_plat.system()}): {actual_w}x{actual_h} MJPG, async 3-thread pipeline")
      self._run_async_pipeline(cap)
    else:
      self._run_with_custom_capture()

  def _create_pipe_capture(self):
    """Create an ffmpeg pipe-based capture for YouTube/HLS live streams.

    Uses yt-dlp ONLY to extract the direct HLS URL, then feeds it to ffmpeg
    which handles HLS segment buffering natively.  This avoids both OpenCV's
    HLS stalls AND the yt-dlp→pipe→ffmpeg bottleneck where yt-dlp's sequential
    segment downloads cause 3-5s gaps in the pipe.

    ffmpeg's native HLS demuxer pre-fetches segments and buffers them, providing
    smooth constant-rate output even across segment boundaries.

    Returns None if setup fails (caller should fall back to OpenCV).
    """
    import subprocess
    import shutil

    url = self.original_url
    if not url:
      return None

    if not shutil.which('ffmpeg'):
      print("[WARN] ffmpeg not found in PATH, cannot use pipe capture")
      return None

    try:
      from .sources import _get_ytdlp_executable
      ytdlp_exe = _get_ytdlp_executable()
    except Exception:
      print("[WARN] yt-dlp not available for pipe capture")
      return None

    width, height = 1280, 720
    YTDLP_FORMAT = 'best[height<=720]/best[height<=1080]/best'

    # ── Step 1: Extract direct HLS URL using yt-dlp (no download) ──
    print(f"[INFO] Extracting direct stream URL for {url[:60]}...")
    try:
      extract_cmd = [
        ytdlp_exe, '--force-ipv4', '-f', YTDLP_FORMAT,
        '-g', '--no-warnings', url
      ]
      result = subprocess.run(
        extract_cmd, capture_output=True, text=True, timeout=20
      )
      if result.returncode != 0:
        print(f"[WARN] yt-dlp URL extraction failed (rc={result.returncode})")
        return None
      direct_url = result.stdout.strip().split('\n')[0]
      if not direct_url:
        print("[WARN] yt-dlp returned empty URL")
        return None
      print(f"[INFO] Direct HLS URL extracted ({len(direct_url)} chars)")
    except subprocess.TimeoutExpired:
      print("[WARN] yt-dlp URL extraction timed out (20s)")
      return None
    except Exception as e:
      print(f"[WARN] yt-dlp URL extraction error: {e}")
      return None

    # ── Step 2: ffmpeg reads HLS directly with buffered reader thread ──
    # ffmpeg's HLS demuxer blocks at segment boundaries (~5s stalls).
    # We wrap it in a reader thread + ring buffer so the capture thread
    # always gets frames instantly (last known frame during stalls).
    print(f"[INFO] Starting ffmpeg HLS capture: {width}x{height}...")
    ffmpeg_cmd = [
      'ffmpeg',
      # HLS reconnection & buffering
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-rw_timeout', '10000000',        # 10s read/write timeout (microseconds)
      # Start 3 segments behind live edge for buffering headroom
      '-live_start_index', '-3',
      # Input format handling
      '-fflags', '+genpts+discardcorrupt',
      '-flags', 'low_delay',
      '-probesize', '5000000',
      '-analyzeduration', '3000000',
      '-i', direct_url,
      # Output: raw BGR frames at constant 30 FPS
      '-vf', f'scale={width}:{height}:flags=bilinear',
      '-f', 'rawvideo', '-pix_fmt', 'bgr24',
      '-vsync', 'cfr', '-r', '30',
      '-an', '-loglevel', 'warning',
      'pipe:1'
    ]

    try:
      ffmpeg_proc = subprocess.Popen(
        ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        bufsize=4 * 1024 * 1024  # 4MB output buffer
      )

      import threading as _th
      import collections as _col

      class _BufferedPipeCapture:
        """Paced, buffered capture: reader thread fills ring from ffmpeg,
        read() drains at ~30 FPS so the ring accumulates a reserve that
        sustains output during HLS segment-boundary stalls."""
        _RING_SIZE = 180  # 6 seconds at 30 FPS — bridges 5s HLS gaps
        _TARGET_FPS = 30.0

        def __init__(self, ff, w, h):
          self._ff = ff
          self._w = w; self._h = h
          self._fsz = w * h * 3
          self._open = True
          self._ring = _col.deque(maxlen=self._RING_SIZE)
          self._last_frame = None
          self._lock = _th.Lock()
          self._stop = _th.Event()
          self._stall_count = 0
          self._total_reads = 0
          self._last_read_t = time.time()
          self._reader = _th.Thread(target=self._read_loop, daemon=True, name='ffmpeg-reader')
          self._reader.start()

        def _read_loop(self):
          """Continuously read frames from ffmpeg stdout into ring buffer."""
          _fill_logged = False
          while not self._stop.is_set() and self._ff.poll() is None:
            raw = self._ff.stdout.read(self._fsz)
            if len(raw) != self._fsz:
              if len(raw) == 0:
                self._open = False
              break
            frm = np.frombuffer(raw, dtype=np.uint8).reshape((self._h, self._w, 3))
            with self._lock:
              self._ring.append(frm)
              self._last_frame = frm
              _rlen = len(self._ring)
            if not _fill_logged and _rlen >= self._RING_SIZE // 2:
              print(f"[HLS-BUF] Ring buffer half-full ({_rlen}/{self._RING_SIZE})", flush=True)
              _fill_logged = True
          self._open = False
          print("[INFO] ffmpeg reader thread exited", flush=True)

        def isOpened(self):
          return self._open or len(self._ring) > 0

        def read(self):
          # Pace reads at ~30 FPS so ring buffer can accumulate
          now = time.time()
          interval = 1.0 / self._TARGET_FPS
          elapsed = now - self._last_read_t
          if elapsed < interval:
            time.sleep(interval - elapsed)
          self._last_read_t = time.time()
          self._total_reads += 1

          with self._lock:
            _rlen = len(self._ring)
            if _rlen > 0:
              frm = self._ring.popleft()
              if self._stall_count > 0:
                print(f"[HLS-BUF] Resumed from ring (was stalled {self._stall_count} reads, ring={_rlen})", flush=True)
                self._stall_count = 0
              return True, frm.copy()
            elif self._last_frame is not None:
              self._stall_count += 1
              if self._stall_count == 1 or self._stall_count % 150 == 0:
                print(f"[HLS-BUF] Ring empty — repeating last frame (stall #{self._stall_count})", flush=True)
              return True, self._last_frame.copy()
          return False, None

        def get(self, prop):
          if prop == cv2.CAP_PROP_FPS: return 30.0
          if prop == cv2.CAP_PROP_FRAME_WIDTH: return float(self._w)
          if prop == cv2.CAP_PROP_FRAME_HEIGHT: return float(self._h)
          return 0.0
        def set(self, prop, val): pass

        def release(self):
          self._stop.set()
          self._open = False
          try: self._ff.terminate(); self._ff.wait(timeout=3)
          except Exception:
            try: self._ff.kill()
            except Exception: pass

      # Wait for first frame (blocks up to 20s for initial HLS segment)
      print("[INFO] Waiting for first frame from ffmpeg HLS pipe...", flush=True)
      frame_size = width * height * 3
      first_raw = ffmpeg_proc.stdout.read(frame_size)
      if len(first_raw) != frame_size:
        try:
          err = ffmpeg_proc.stderr.read(500).decode(errors='replace')
          if err:
            print(f"[WARN] ffmpeg stderr: {err[:200]}")
        except Exception:
          pass
        print("[WARN] ffmpeg HLS capture: first frame failed, falling back to OpenCV")
        try: ffmpeg_proc.terminate()
        except Exception: pass
        return None

      first_frame = np.frombuffer(first_raw, dtype=np.uint8).reshape((height, width, 3))
      self._pipe_first_frame = first_frame.copy()

      # Now create the buffered capture (reader thread starts consuming frames)
      cap = _BufferedPipeCapture(ffmpeg_proc, width, height)
      print(f"[INFO] ffmpeg HLS buffered capture ready: {width}x{height} (ring={_BufferedPipeCapture._RING_SIZE})")
      return cap
    except Exception as e:
      print(f"[WARN] ffmpeg HLS capture failed: {e}, falling back to OpenCV")
      return None

  def _run_with_custom_capture(self) -> None:
    """
    Run tracking with custom OpenCV capture for proper frame rate control.
    This ensures videos play at their native speed regardless of processing speed.
    Works for both live streams and pre-recorded videos.
    """
    source_type = "LIVE stream" if self.is_live_source else "video"
    print(f"[INFO] Using custom capture loop for {source_type} (proper frame rate)")

    # For YouTube live streams: try yt-dlp pipe for smooth HLS delivery.
    # yt-dlp+ffmpeg pipe avoids OpenCV's blocking HLS segment downloads.
    # Falls back to OpenCV if pipe setup fails.
    if self.is_live_source and self.original_url:
      pipe_cap = self._create_pipe_capture()
      if pipe_cap:
        print("[INFO] YouTube live: using yt-dlp pipe capture (smooth, non-blocking)")
        self._run_async_pipeline(pipe_cap)
        return
      print("[INFO] YouTube live: falling back to OpenCV HLS capture")

    # Create VideoCapture with FFMPEG backend for network streams
    if isinstance(self.source, str) and self.source.startswith('http'):
      cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
      # Set timeouts for HTTP streams (iVCam, IP cameras) to avoid indefinite hangs
      cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)   # 10s to open connection
      cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 15000)    # 15s per frame read
    else:
      cap = cv2.VideoCapture(self.source)

    # Larger buffer for HLS burst tolerance (segments arrive in 2-6s bursts)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 30)

    # For HTTP streams (YouTube), set additional OpenCV properties for smoother playback
    if isinstance(self.source, str) and self.source.startswith('http'):
      # Enable hardware acceleration if available
      cap.set(cv2.CAP_PROP_HW_ACCELERATION, cv2.VIDEO_ACCELERATION_ANY)

    if not cap.isOpened():
      print(f"[ERROR] Failed to open {source_type}")
      return

    # Log actual resolution from source
    src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"[INFO] {source_type} resolution: {src_w}x{src_h}")

    # For HTTP streams with low resolution, request higher if possible
    if isinstance(self.source, str) and self.source.startswith('http') and (src_w < 1280 or src_h < 720):
      cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
      cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
      new_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
      new_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
      if new_w != src_w or new_h != src_h:
        print(f"[INFO] Upgraded resolution to {new_w}x{new_h}")

    # Get actual FPS from the video source
    source_fps = cap.get(cv2.CAP_PROP_FPS)

    # CRITICAL FIX: OpenCV often returns incorrect FPS for YouTube streams
    # Check if we have source FPS from yt-dlp metadata (more reliable)
    if hasattr(self, 'source_fps') and self.source_fps and self.source_fps > 0:
      print(f"[INFO] Using FPS from yt-dlp metadata: {self.source_fps:.1f}")
      source_fps = self.source_fps
    elif source_fps <= 0 or source_fps > 120:
      # OpenCV failed to detect FPS or gave unrealistic value
      print(f"[WARN] OpenCV FPS detection failed ({source_fps}), using 30.0 FPS")
      source_fps = 30.0
    else:
      print(f"[INFO] Using OpenCV detected FPS: {source_fps:.1f}")

    frame_interval = 1.0 / source_fps
    print(f"[INFO] {source_type} opened: {source_fps:.1f} FPS, frame interval: {frame_interval*1000:.1f}ms")

    # Always use 3-thread async pipeline for ALL sources (live AND recorded).
    # This ensures demographics (InsightFace) run on the inference thread
    # with proper CUDA session management for both live and recorded video.
    print(f"[INFO] Using 3-thread async pipeline (capture / inference / main)")
    self._run_async_pipeline(cap)


  def _run_async_pipeline(self, cap) -> None:
    """
    Task 2.1.1: 3-Thread Async Processing Pipeline
    ================================================
    Thread 1 (Capture)   : Kameradan frame okur → raw_frame_queue (~30fps)
    Thread 2 (Inference) : YOLO inference çalıştırır → result_queue (~10-15fps)
    Main thread          : Sonuçları işler, demographics, metrics, MJPEG output

    Fayda:
    - Frame capture hiçbir zaman YOLO tarafından bloklanmaz
    - YOLO inference hiçbir zaman capture gecikmeleri yaşamaz
    - FPS tutarlılığı artar, latency azalır
    - Webcam ve IP kamera için optimize edilmiş
    """
    import threading
    import queue as _queue

    raw_frame_q = _queue.Queue(maxsize=30)  # Capture → Inference (large for HLS bursts)
    result_q    = _queue.Queue(maxsize=15)  # Inference → Main (increased for HLS burst smoothing)
    stop_event  = threading.Event()

    # FPS sayaçları (her thread için ayrı)
    self.capture_fps  = 0.0
    self.inference_fps = 0.0
    _cap_cnt  = [0]; _cap_t   = [time.time()]
    _inf_cnt  = [0]; _inf_t   = [time.time()]

    # ── Thread 1: Frame Capture ──────────────────────────────────────────────
    _cap_holder = [cap]  # Mutable holder for reconnection

    def capture_fn():
      _last_capture_t = time.time()
      _consecutive_failures = 0
      _MAX_CONSECUTIVE_FAILURES = 100  # ~0.5s at 5ms sleep

      # If pipe capture pre-read a test frame, inject it first
      if hasattr(self, '_pipe_first_frame') and self._pipe_first_frame is not None:
        _first = self._pipe_first_frame
        self._pipe_first_frame = None
        try: raw_frame_q.put_nowait(_first)
        except _queue.Full: pass
        with self._frame_lock:
          self._latest_raw_frame = _first
          self._latest_raw_frame_time = time.time()

      _slow_read_count = [0]  # Track slow cap.read() calls for diagnostics

      while not stop_event.is_set():
        _read_start = time.time()
        ret, frame = _cap_holder[0].read()
        _read_ms = (time.time() - _read_start) * 1000
        # Log slow reads (>500ms) — indicates HLS segment boundary stalls
        if _read_ms > 500 and self.is_live_source:
          _slow_read_count[0] += 1
          if _slow_read_count[0] <= 10 or _slow_read_count[0] % 50 == 0:
            print(f"[WARN] Slow cap.read(): {_read_ms:.0f}ms (HLS segment stall #{_slow_read_count[0]})", flush=True)
        if not ret or frame is None:
          _consecutive_failures += 1
          # Reconnect HTTP streams after sustained failures
          if (_consecutive_failures >= _MAX_CONSECUTIVE_FAILURES
              and isinstance(self.source, str)
              and self.source.startswith(('http://', 'https://'))):
            print(f"[WARN] {_consecutive_failures} consecutive capture failures, reconnecting to {self.source[:60]}...")
            try:
              _cap_holder[0].release()
            except Exception:
              pass
            time.sleep(1.0)
            try:
              new_cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
              new_cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)
              new_cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 15000)
              if self.is_live_source:
                new_cap.set(cv2.CAP_PROP_BUFFERSIZE, 30)
              _cap_holder[0] = new_cap
              print(f"[INFO] Reconnected to source: opened={new_cap.isOpened()}")
            except Exception as e:
              print(f"[ERROR] Reconnection failed: {e}")
            _consecutive_failures = 0
          else:
            time.sleep(0.005)
          continue
        _consecutive_failures = 0
        # Smooth playback strategy:
        # - Keep only the LATEST frame so inference always works on fresh data
        # - For recorded videos: pace reads to ~2x inference speed (not source FPS)
        #   to avoid overwhelming the queue while staying responsive
        if not self.is_live_source and self.source_fps and self.source_fps > 0:
          target_interval = max(1.0 / 30.0, 1.0 / self.source_fps)
          elapsed = time.time() - _last_capture_t
          if elapsed < target_interval:
            time.sleep(target_interval - elapsed)
          _last_capture_t = time.time()
        if self.is_live_source:
          # Live/HLS streams: keep a small buffer (max 3 frames) so inference
          # thread has frames to process between HLS segment downloads.
          # Only trim excess — never flush entirely (prevents starvation).
          while raw_frame_q.qsize() > 3:
            try: raw_frame_q.get_nowait()
            except _queue.Empty: break
        else:
          # Recorded video: keep only latest frame for responsive playback
          while not raw_frame_q.empty():
            try: raw_frame_q.get_nowait()
            except _queue.Empty: break
        try:
          raw_frame_q.put_nowait(frame)
        except _queue.Full:
          # Queue full — drop oldest to make room
          try: raw_frame_q.get_nowait()
          except _queue.Empty: pass
          try: raw_frame_q.put_nowait(frame)
          except _queue.Full: pass
        # Update raw frame for MJPEG — keeps video smooth even when inference is slow
        with self._frame_lock:
          self._latest_raw_frame = frame
          self._latest_raw_frame_time = time.time()
        # FPS say
        _cap_cnt[0] += 1
        now = time.time()
        if now - _cap_t[0] >= 1.0:
          self.capture_fps = _cap_cnt[0] / (now - _cap_t[0])
          _cap_cnt[0] = 0; _cap_t[0] = now

    # ── Thread 2: YOLO Inference + InsightFace Demographics ────────────────
    # InsightFace MUST run on the same thread as initialization due to
    # ONNX Runtime CUDA session thread-safety constraints.
    # We lazy-initialize InsightFace here on first use.
    _insightface_initialized = [False]
    _mivolo_initialized = [False]
    _demo_frame_counter = [0]

    def inference_fn():
      while not stop_event.is_set():
        try:
          frame = raw_frame_q.get(timeout=1.0)
        except _queue.Empty:
          continue
        inf_start = time.time()
        try:
          # YOLO inference
          _t_yolo = time.time()
          results = self.model.track(
            source=frame,
            persist=True,
            verbose=False,
            classes=[0],
            tracker="camera_analytics/botsort.yaml",
            imgsz=self.inference_params["imgsz"],
            device=self.device,
            conf=self.conf,
            iou=self.nms_iou,
            half=self.inference_params.get("half", False),
            agnostic_nms=self.agnostic_nms,
          )
          _t_yolo = time.time() - _t_yolo

          # InsightFace: lazy-init on this thread for CUDA compatibility
          if not _insightface_initialized[0] and self.age_gender_estimator is not None:
            try:
              print("[INFO] Re-initializing InsightFace on inference thread for CUDA compatibility...", flush=True)
              self.age_gender_estimator.prepare(ctx_id=0, det_size=(640, 640))
              _insightface_initialized[0] = True
              print("[INFO] InsightFace ready on inference thread", flush=True)
            except Exception as e:
              print(f"[WARN] InsightFace re-init failed: {e}", flush=True)

          # MiVOLO: lazy-init on inference thread (CUDA context)
          if not _mivolo_initialized[0] and self.mivolo_estimator is not None:
            try:
              print("[INFO] Preparing MiVOLO on inference thread...", flush=True)
              self.mivolo_estimator.prepare()
              _mivolo_initialized[0] = self.mivolo_estimator.model is not None
              if _mivolo_initialized[0]:
                print("[INFO] MiVOLO ready on inference thread", flush=True)
              else:
                print("[WARN] MiVOLO prepare failed — falling back to InsightFace", flush=True)
            except Exception as e:
              print(f"[WARN] MiVOLO init failed: {e}", flush=True)

          # HYBRID demographics: InsightFace face detection + MiVOLO age/gender
          # Step 1: InsightFace full-frame face detection
          # Step 2: Match faces to YOLO persons
          # Step 3: MiVOLO batch inference (face+body dual input) for all persons
          # Step 4: Fallback to InsightFace age/gender if MiVOLO unavailable
          demo_results = {}  # {track_id: (age, gender, age_conf, gender_conf)}
          _demo_frame_counter[0] += 1
          _use_mivolo = _mivolo_initialized[0] and self.mivolo_estimator is not None
          _t_mivolo = 0  # timing: set by MiVOLO batch if it runs
          if (_insightface_initialized[0] and
              _demo_frame_counter[0] % self.face_detection_interval == 0 and
              results and results[0].boxes is not None and
              results[0].boxes.id is not None):
            try:
              boxes = results[0].boxes
              ids = boxes.id.cpu().numpy().astype(int)
              xyxys = boxes.xyxy.cpu().numpy()
              fh, fw = frame.shape[:2]

              # Step 1: Full-frame face detection (InsightFace)
              _t_face = time.time()
              full_faces = self.age_gender_estimator.detect_and_predict(frame)
              _t_face = time.time() - _t_face
              n_full = len(full_faces) if full_faces else 0

              # Step 2: Match faces to YOLO persons (exclusive greedy assignment)
              matched_faces = {}  # {person_idx: face_obj}
              matched_tids = set()
              if full_faces:
                # Build all candidate (person_idx, face_idx, score) tuples
                candidates = []
                for i in range(len(ids)):
                  x1, y1, x2, y2 = xyxys[i]
                  pw, ph = x2 - x1, y2 - y1
                  tol_x = max(30, pw * 0.3)
                  tol_y = max(30, ph * 0.3)
                  head_y2 = y1 + ph * 0.75

                  for j, face in enumerate(full_faces):
                    fx1, fy1, fx2, fy2 = face.bbox
                    fcx = (fx1 + fx2) / 2
                    fcy = (fy1 + fy2) / 2
                    det_score = float(face.det_score) if hasattr(face, 'det_score') else 0.0
                    if det_score < self.config.demo_min_confidence:
                      continue
                    if (x1 - tol_x <= fcx <= x2 + tol_x and
                        y1 - tol_y <= fcy <= head_y2 + tol_y):
                      overlap_x = max(0, min(fx2, x2) - max(fx1, x1))
                      overlap_y = max(0, min(fy2, y2) - max(fy1, y1))
                      overlap_area = overlap_x * overlap_y
                      face_area = max(1, (fx2 - fx1) * (fy2 - fy1))
                      ratio = overlap_area / face_area
                      if ratio > 0:
                        candidates.append((i, j, ratio))

                # Greedy exclusive assignment: best score first, no face/person reuse
                candidates.sort(key=lambda c: c[2], reverse=True)
                used_persons = set()
                used_faces = set()
                for person_idx, face_idx, _score in candidates:
                  if person_idx in used_persons or face_idx in used_faces:
                    continue
                  matched_faces[person_idx] = full_faces[face_idx]
                  matched_tids.add(int(ids[person_idx]))
                  used_persons.add(person_idx)
                  used_faces.add(face_idx)

              # Step 3: MiVOLO batch inference — face+body dual input
              if _use_mivolo:
                face_crops = []
                body_crops = []
                batch_tids = []
                batch_det_scores = []
                batch_yaws = []

                # Matched persons: face + body crops
                # Stage 2: 12 → 18 on RTX 5070 12GB. If a prior batch triggered
                # CUDA OOM we clamp back to 12 via self._mivolo_batch_limit so
                # crowded scenes don't keep hitting the ceiling.
                _MAX_MIVOLO_BATCH = getattr(self, "_mivolo_batch_limit", 18)
                for i, face in matched_faces.items():
                  if len(batch_tids) >= _MAX_MIVOLO_BATCH:
                    break
                  tid = int(ids[i])
                  # Skip frozen demographics — fully classified, no need to re-process
                  existing = self.tracks.get(tid)
                  if existing and getattr(existing, 'demographics_frozen', False):
                    continue
                  # Face crop from InsightFace bbox (with padding)
                  fx1, fy1, fx2, fy2 = face.bbox
                  fp = max(5, int((fx2 - fx1) * 0.15))  # 15% padding
                  fc = frame[max(0,int(fy1)-fp):min(fh,int(fy2)+fp),
                             max(0,int(fx1)-fp):min(fw,int(fx2)+fp)]
                  if fc.size == 0 or fc.shape[0] < 10 or fc.shape[1] < 10:
                    fc = None
                  # Body crop from YOLO bbox
                  bx1, by1, bx2, by2 = xyxys[i]
                  bc = frame[max(0,int(by1)):min(fh,int(by2)),
                             max(0,int(bx1)):min(fw,int(bx2))]
                  if bc.size == 0 or bc.shape[0] < 20 or bc.shape[1] < 20:
                    bc = None

                  face_crops.append(fc)
                  body_crops.append(bc)
                  batch_tids.append(tid)
                  batch_det_scores.append(float(face.det_score) if hasattr(face, 'det_score') else 0.5)
                  yaw = 30.0
                  if hasattr(face, 'pose') and face.pose is not None:
                    yaw = abs(float(face.pose[1]))
                  batch_yaws.append(yaw)

                # Unmatched persons: body-only (no face visible)
                body_only_count = 0
                _body_only_max = min(3, _MAX_MIVOLO_BATCH - len(batch_tids))
                for i in range(len(ids)):
                  if body_only_count >= _body_only_max:
                    break
                  tid = int(ids[i])
                  if tid in matched_tids:
                    continue
                  existing = self.tracks.get(tid)
                  if existing and getattr(existing, 'demographics_frozen', False):
                    continue
                  bx1, by1, bx2, by2 = xyxys[i]
                  bh, bw = by2 - by1, bx2 - bx1
                  if bh < self.config.demo_min_bbox_height or bw < self.config.demo_min_bbox_width:
                    continue
                  bc = frame[max(0,int(by1)):min(fh,int(by2)),
                             max(0,int(bx1)):min(fw,int(bx2))]
                  if bc.size == 0 or bc.shape[0] < 20 or bc.shape[1] < 20:
                    continue
                  face_crops.append(None)  # No face
                  body_crops.append(bc)
                  batch_tids.append(tid)
                  batch_det_scores.append(0.0)
                  batch_yaws.append(90.0)
                  body_only_count += 1

                # Batch MiVOLO inference (Stage 2: OOM-guarded)
                if batch_tids:
                  _t_mivolo = time.time()
                  try:
                    mivolo_results = self.mivolo_estimator.predict_batch(face_crops, body_crops)
                  except RuntimeError as _oom:
                    # CUDA OOM on larger batches (common at 18 with lots of
                    # demographics pipelines warm). Fall back permanently to 12,
                    # drop this batch, and keep running.
                    if "out of memory" in str(_oom).lower() or "cuda" in str(_oom).lower():
                      print(f"[WARN] MiVOLO OOM at batch={len(batch_tids)}; clamping to 12", flush=True)
                      self._mivolo_batch_limit = 12
                      try:
                        import torch as _torch
                        _torch.cuda.empty_cache()
                      except Exception:
                        pass
                      mivolo_results = []
                    else:
                      raise
                  _t_mivolo = time.time() - _t_mivolo
                  for idx, (age, gender, gender_prob) in enumerate(mivolo_results):
                    if age is None:
                      continue
                    tid = batch_tids[idx]
                    ds = batch_det_scores[idx]
                    yaw = batch_yaws[idx]
                    has_face = face_crops[idx] is not None

                    # Age confidence: high for face+body, moderate for body-only
                    if has_face:
                      age_conf = 0.85 * min(1.0, ds / 0.5) * max(0.3, 1.0 - yaw / 120.0)
                    else:
                      age_conf = 0.50  # Body-only: lower confidence (~5-8yr MAE)

                    # Gender confidence: use MiVOLO's continuous probability
                    # gender_prob is [0.5, 1.0] — map to certainty [0, 1]
                    gender_certainty = (gender_prob - 0.5) * 2.0
                    # Reject uncertain predictions: gprob < 0.65 → certainty < 0.3
                    if gender_certainty < 0.30:
                      gender_conf = 0.0  # Too uncertain — skip this vote entirely
                    elif has_face and yaw <= 55.0:
                      gender_conf = 0.90 * gender_certainty * min(1.0, ds / 0.5)
                    elif has_face:
                      gender_conf = 0.60 * gender_certainty
                    else:
                      # Body-only gender: much weaker vote to prevent wrong classification
                      # before a face is detected. Face votes (0.90) will dominate quickly.
                      gender_conf = 0.40 * gender_certainty

                    age_conf = max(0.10, min(0.95, age_conf))
                    gender_conf = max(0.0, min(0.95, gender_conf))
                    demo_results[tid] = (age, gender, age_conf, gender_conf)

                    if _demo_frame_counter[0] <= 300 and _demo_frame_counter[0] % 10 == 0:
                      print(f"[MIVOLO] tid={tid} age={age:.1f} gender={gender} "
                            f"gprob={gender_prob:.3f} gc={gender_conf:.2f} "
                            f"face={'Y' if has_face else 'N'} yaw={yaw:.0f}°", flush=True)

              else:
                # Step 4: Fallback — InsightFace-only age/gender (no MiVOLO)
                for i, face in matched_faces.items():
                  tid = int(ids[i])
                  if not hasattr(face, 'age') or face.age is None:
                    continue
                  gender = None
                  if hasattr(face, 'gender') and face.gender is not None:
                    gender = "male" if float(face.gender) > 0.5 else "female"
                  if gender is None:
                    continue
                  ds = float(face.det_score) if hasattr(face, 'det_score') else 0.3
                  face_w = face.bbox[2] - face.bbox[0]
                  face_h = face.bbox[3] - face.bbox[1]
                  face_area = face_w * face_h
                  frame_area = fh * fw
                  size_factor = min(1.0, max(0.3, (face_area / max(1, frame_area)) / 0.001))
                  yaw = 30.0
                  if hasattr(face, 'pose') and face.pose is not None:
                    yaw = abs(float(face.pose[1]))
                  age_conf = 0.85 * min(1.0, ds / 0.5) * size_factor * max(0.3, 1.0 - yaw / 120.0)
                  age_conf = max(0.10, min(0.95, age_conf))
                  if yaw > 55.0:
                    gender_conf = 0.0
                  else:
                    gender_conf = 0.85 * min(1.0, ds / 0.5) * size_factor * max(0.1, 1.0 - yaw / 70.0)
                    gender_conf = max(0.0, min(0.95, gender_conf))
                  demo_results[tid] = (float(face.age), gender, age_conf, gender_conf)

                # Crop fallback for unmatched (InsightFace only)
                crop_count = 0
                for i in range(len(ids)):
                  if crop_count >= 2:
                    break
                  tid = int(ids[i])
                  if tid in matched_tids:
                    continue
                  existing = self.tracks.get(tid)
                  if existing and existing.gender != "unknown" and existing.age is not None:
                    if existing.gender_locked or existing._demo_update_count >= 8:
                      continue
                  x1, y1, x2, y2 = xyxys[i]
                  ph, pw = y2 - y1, x2 - x1
                  if ph < self.config.demo_min_bbox_height or pw < self.config.demo_min_bbox_width:
                    continue
                  head_y2_c = y1 + ph * 0.70
                  pad_x, pad_y = pw * 0.35, ph * 0.20
                  cx1 = max(0, int(x1 - pad_x))
                  cy1 = max(0, int(y1 - pad_y))
                  cx2 = min(fw, int(x2 + pad_x))
                  cy2 = min(fh, int(head_y2_c + pad_y))
                  crop = frame[cy1:cy2, cx1:cx2]
                  if crop.size == 0 or crop.shape[0] < 20 or crop.shape[1] < 20:
                    continue
                  age, gender, conf = self.age_gender_estimator.predict(crop)
                  if age is not None and gender is not None:
                    demo_results[tid] = (age, gender, conf, conf)
                    crop_count += 1

              if _demo_frame_counter[0] % 30 == 0:
                n_matched = len(matched_faces)
                model_name = "MiVOLO" if _use_mivolo else "InsightFace"
                gender_debug = []
                for _tid, _res in list(demo_results.items())[:3]:
                  _a, _g, _ac, _gc = _res
                  gender_debug.append(f"tid={_tid}:{_g}(gc={_gc:.2f})")
                gd_str = ", ".join(gender_debug) if gender_debug else "none"
                # Timing breakdown
                _tf = _t_face * 1000
                _tm = _t_mivolo * 1000 if '_t_mivolo' in locals() else 0
                _ty = _t_yolo * 1000
                print(f"[DEMO] {model_name}: {n_full} faces, {n_matched} matched, "
                      f"{len(demo_results)} results | YOLO={_ty:.0f}ms Face={_tf:.0f}ms MiVOLO={_tm:.0f}ms "
                      f"| {gd_str}", flush=True)
            except Exception as e:
              print(f"[WARN] Demographics error: {e}", flush=True)
              import traceback; traceback.print_exc()

          if results:
            if result_q.full():
              try: result_q.get_nowait()
              except _queue.Empty: pass
            try: result_q.put_nowait((frame, results, demo_results))
            except _queue.Full: pass
          # FPS say
          _inf_cnt[0] += 1
          now = time.time()
          if now - _inf_t[0] >= 1.0:
            self.inference_fps = _inf_cnt[0] / (now - _inf_t[0])
            _inf_cnt[0] = 0; _inf_t[0] = now
          # GPU maximization: no sleep in inference thread — process frames as fast as possible
          # FPS pacing for recorded video is handled in the capture thread instead
        except Exception as e:
          print(f"[WARN] Inference thread error: {e}")
          time.sleep(0.01)

    # ── Thread başlat ────────────────────────────────────────────────────────
    cap_thread = threading.Thread(target=capture_fn,   daemon=True, name="obs-capture")
    inf_thread = threading.Thread(target=inference_fn, daemon=True, name="obs-inference")
    cap_thread.start()
    inf_thread.start()
    print("[INFO] Async pipeline started: capture + inference threads running")

    # ── Main thread: sonuçları işle ──────────────────────────────────────────
    try:
      while self.running:
        try:
          item = result_q.get(timeout=1.0)
          if len(item) == 3:
            _frame, results, demo_results = item
          else:
            _frame, results = item
            demo_results = {}
          # Store crop-based demographics for _update_demographics
          self._latest_demo_results = demo_results
        except _queue.Empty:
          continue
        for result in results:
          if not self._process_result(result):
            self.running = False
            break
        if not self.running:
          break
    except Exception as e:
      print(f"[ERROR] Async pipeline main thread error: {e}")
      import traceback; traceback.print_exc()
    finally:
      stop_event.set()
      cap_thread.join(timeout=3.0)
      inf_thread.join(timeout=3.0)
      cap.release()
      print(f"[INFO] Async pipeline stopped. Capture FPS: {self.capture_fps:.1f}, Inference FPS: {self.inference_fps:.1f}")
      if self.display:
        import cv2; cv2.destroyAllWindows()

  def _run_live_with_threaded_reader(self, cap, source_fps: float) -> None:
    """
    Run live stream processing.
    Task 2.1.1: Routes to 3-thread async pipeline for better performance.
    """
    # Task 2.1.1: Async pipeline — daha iyi FPS ve düşük latency
    print(f"[INFO] Using 3-thread async pipeline (capture / inference / main)")
    self._run_async_pipeline(cap)

  def _run_live_with_threaded_reader_legacy(self, cap, source_fps: float) -> None:
    """Legacy single-threaded reader — replaced by _run_async_pipeline."""
    import threading
    import queue
    
    # Shared state for threaded reader
    frame_queue = queue.Queue(maxsize=2)  # Small queue to keep only recent frames
    reader_running = threading.Event()
    reader_running.set()
    
    def frame_reader():
      """Background thread to continuously read frames"""
      consecutive_failures = 0
      while reader_running.is_set():
        ret, frame = cap.read()
        if ret and frame is not None:
          consecutive_failures = 0
          # If queue is full, remove old frame and add new one
          if frame_queue.full():
            try:
              frame_queue.get_nowait()
            except queue.Empty:
              pass
          try:
            frame_queue.put_nowait(frame)
          except queue.Full:
            pass
        else:
          consecutive_failures += 1
          if consecutive_failures > 50:  # ~5 seconds of failures
            print("[WARN] Too many consecutive failures, reconnecting...")
            consecutive_failures = 0
          time.sleep(0.01)
    
    # Start reader thread
    reader_thread = threading.Thread(target=frame_reader, daemon=True)
    reader_thread.start()
    print("[INFO] Live stream reader thread started")
    
    target_interval = 1.0 / 30.0  # Target 30 FPS output
    
    try:
      while self.running:
        frame_start = time.time()
        
        # Get latest frame from queue
        frame = None
        try:
          frame = frame_queue.get(timeout=1.0)
        except queue.Empty:
          print("[WARN] No frame available from live stream")
          continue
        
        if frame is None:
          continue
        
        # Run YOLO tracking on the frame
        results = self.model.track(
          source=frame,
          persist=True,
          verbose=False,
          classes=[0],
          tracker="camera_analytics/botsort.yaml",
          imgsz=self.inference_params['imgsz'],
          device=self.device,
          conf=self.conf,
          iou=self.nms_iou,
          half=self.inference_params.get('half', False),
          agnostic_nms=self.agnostic_nms,
        )
        
        # Process results
        for result in results:
          if not self._process_result(result):
            self.running = False
            break
        
        if not self.running:
          break
        
        # Limit output to ~30 FPS
        processing_time = time.time() - frame_start
        sleep_time = target_interval - processing_time
        if sleep_time > 0:
          time.sleep(sleep_time)
          
    except Exception as e:
      print(f"[ERROR] Live stream error: {e}")
      import traceback
      traceback.print_exc()
    finally:
      reader_running.clear()
      reader_thread.join(timeout=2.0)
      cap.release()
      print("[INFO] Live stream capture released")
      if self.display:
        cv2.destroyAllWindows()

  def _run_live_with_ytdlp_pipe(self) -> None:
    """
    Run live stream using yt-dlp pipe mode for smooth playback.
    This bypasses OpenCV's HLS handling issues by using yt-dlp's native streaming.
    
    Architecture:
    yt-dlp (download) -> stdout | ffmpeg (decode to raw) -> stdout | Python (read frames)
    """
    import subprocess
    import threading
    import struct
    
    url = self.original_url
    if not url:
      print("[ERROR] No original URL available for yt-dlp pipe mode")
      return
    
    print(f"[INFO] Starting yt-dlp pipe mode for live stream: {url[:50]}...")
    
    # Frame dimensions - will be detected from stream
    width, height = 1920, 1080  # Default: assume 1080p; overridden by info command

    # YouTube live için en iyi kalite: önce 1080p dene, 720p fallback
    # "best" = tek parça stream (video+audio combined, DASH değil)
    # YouTube live için combined stream max ~720p-1080p
    YTDLP_FORMAT = 'best[height<=1080]/best[height<=720]/best'

    # First, get video dimensions using yt-dlp
    try:
      print("[INFO] Detecting stream resolution...")
      from .sources import _get_ytdlp_executable
      info_cmd = [
        _get_ytdlp_executable(),
        '--force-ipv4',
        '--print', 'width',
        '--print', 'height',
        '-f', YTDLP_FORMAT,
        '--no-warnings',
        url
      ]
      info_result = subprocess.run(info_cmd, capture_output=True, text=True, timeout=20)
      if info_result.returncode == 0:
        lines = info_result.stdout.strip().split('\n')
        if len(lines) >= 2:
          try:
            w_str, h_str = lines[0].strip(), lines[1].strip()
            if w_str.isdigit() and h_str.isdigit():
              width = int(w_str)
              height = int(h_str)
              print(f"[INFO] Stream resolution: {width}x{height}")
            else:
              print(f"[WARN] Unexpected resolution values: '{w_str}' x '{h_str}', using default")
          except ValueError:
            print(f"[WARN] Could not parse dimensions, using default {width}x{height}")
      else:
        print(f"[WARN] yt-dlp info failed (code {info_result.returncode}), using default {width}x{height}")
    except Exception as e:
      print(f"[WARN] Could not detect resolution: {e}, using default {width}x{height}")

    frame_size = width * height * 3  # BGR format

    from .sources import _get_ytdlp_executable
    ytdlp_cmd = [
      _get_ytdlp_executable(),
      '--force-ipv4',
      '-f', YTDLP_FORMAT,
      '-o', '-',
      '--quiet',
      '--no-warnings',
      url
    ]

    # FFmpeg command: decode video to raw BGR frames
    # NOT: -s flag çıkarıldı, bunun yerine scale filtresi kullanılıyor
    # Bu şekilde ffmpeg kaynak çözünürlüğünü korur ve kalite kaybı olmaz
    ffmpeg_cmd = [
      'ffmpeg',
      '-fflags', 'nobuffer',     # Latency azaltma
      '-flags', 'low_delay',     # Düşük gecikme modu
      '-i', 'pipe:0',            # Stdin'den oku
      '-vf', f'scale={width}:{height}:flags=lanczos',  # Lanczos ile yüksek kaliteli ölçekleme
      '-f', 'rawvideo',          # Ham video çıkışı
      '-pix_fmt', 'bgr24',       # OpenCV formatı
      '-r', '30',                # 30 FPS çıkış
      '-an',                     # Ses yok
      '-loglevel', 'error',      # Minimal log
      'pipe:1'                   # Stdout'a yaz
    ]
    
    ytdlp_proc = None
    ffmpeg_proc = None
    
    try:
      # Start yt-dlp process
      print("[INFO] Starting yt-dlp subprocess...")
      ytdlp_proc = subprocess.Popen(
        ytdlp_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        bufsize=10**8
      )
      
      # Start FFmpeg process, reading from yt-dlp's stdout
      print("[INFO] Starting FFmpeg decoder...")
      ffmpeg_proc = subprocess.Popen(
        ffmpeg_cmd,
        stdin=ytdlp_proc.stdout,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=10**8
      )
      
      # Allow yt-dlp to receive SIGPIPE if ffmpeg exits
      if ytdlp_proc.stdout:
        ytdlp_proc.stdout.close()
      
      print("[INFO] yt-dlp pipe mode initialized — async 3-thread pipeline başlatılıyor...")

      import queue as _queue

      raw_frame_q = _queue.Queue(maxsize=3)   # Pipe reader → Inference
      result_q    = _queue.Queue(maxsize=2)   # Inference → Main thread
      pipe_stop   = threading.Event()

      frame_count = 0
      _pipe_failures = [0]

      # ── Thread 1: FFmpeg pipe'dan frame oku ─────────────────────────────────
      def pipe_reader_fn():
        consecutive_failures = 0
        while not pipe_stop.is_set():
          raw = ffmpeg_proc.stdout.read(frame_size)
          if len(raw) != frame_size:
            if len(raw) == 0:
              print("[INFO] yt-dlp pipe: stream ended")
              pipe_stop.set(); break
            _pipe_failures[0] += 1
            if _pipe_failures[0] > 20:
              print("[ERROR] yt-dlp pipe: too many read failures")
              pipe_stop.set(); break
            continue
          _pipe_failures[0] = 0
          frm = np.frombuffer(raw, dtype=np.uint8).reshape((height, width, 3))
          # Eski frame'i at — her zaman en güncel frame'i tut
          if raw_frame_q.full():
            try: raw_frame_q.get_nowait()
            except _queue.Empty: pass
          try: raw_frame_q.put_nowait(frm.copy())
          except _queue.Full: pass

      # ── Thread 2: YOLO inference ─────────────────────────────────────────────
      def inference_fn():
        while not pipe_stop.is_set():
          try:
            frm = raw_frame_q.get(timeout=1.0)
          except _queue.Empty:
            continue
          try:
            res = self.model.track(
              source=frm,
              persist=True,
              verbose=False,
              classes=[0],
              tracker="camera_analytics/botsort.yaml",
              imgsz=self.inference_params['imgsz'],
              device=self.device,
              conf=self.conf,
              iou=self.nms_iou,
              half=self.inference_params.get('half', False),
              agnostic_nms=self.agnostic_nms,
            )
            if res:
              if result_q.full():
                try: result_q.get_nowait()
                except _queue.Empty: pass
              try: result_q.put_nowait((frm, res))
              except _queue.Full: pass
          except Exception as exc:
            print(f"[WARN] yt-dlp pipe inference error: {exc}")

      pipe_thread = threading.Thread(target=pipe_reader_fn, daemon=True, name="ytdlp-pipe")
      inf_thread  = threading.Thread(target=inference_fn,  daemon=True, name="ytdlp-infer")
      pipe_thread.start()
      inf_thread.start()
      print("[INFO] yt-dlp pipe async threads started")

      # ── Main thread: sonuçları işle ──────────────────────────────────────────
      while self.running and not pipe_stop.is_set():
        try:
          _frm, results = result_q.get(timeout=1.0)
        except _queue.Empty:
          continue
        frame_count += 1
        for result in results:
          if not self._process_result(result):
            self.running = False; break
        if not self.running:
          break
        if frame_count % 300 == 0:
          print(f"[INFO] yt-dlp pipe: processed {frame_count} frames")

      pipe_stop.set()
      pipe_thread.join(timeout=3.0)
      inf_thread.join(timeout=3.0)

    except Exception as e:
      print(f"[ERROR] yt-dlp pipe error: {e}")
      import traceback
      traceback.print_exc()
    finally:
      # Cleanup subprocesses
      print("[INFO] Cleaning up yt-dlp pipe processes...")
      
      if ffmpeg_proc:
        try:
          ffmpeg_proc.terminate()
          ffmpeg_proc.wait(timeout=2)
        except:
          ffmpeg_proc.kill()
      
      if ytdlp_proc:
        try:
          ytdlp_proc.terminate()
          ytdlp_proc.wait(timeout=2)
        except:
          ytdlp_proc.kill()
      
      print(f"[INFO] yt-dlp pipe mode stopped. Total frames: {frame_count if 'frame_count' in dir() else 0}")
      if self.display:
        cv2.destroyAllWindows()

  def _run_video_with_timing(self, cap, frame_interval: float) -> None:
    """
    Run pre-recorded video with proper timing to match source FPS.
    """
    print(f"[INFO] Playing video at {1.0/frame_interval:.1f} FPS")
    
    try:
      while self.running and cap.isOpened():
        frame_start = time.time()
        
        ret, frame = cap.read()
        if not ret or frame is None:
          # End of video file
          print("[INFO] End of video reached")
          break
        
        # Run YOLO tracking on the frame
        results = self.model.track(
          source=frame,
          persist=True,
          verbose=False,
          classes=[0],
          tracker="camera_analytics/botsort.yaml",
          imgsz=self.inference_params['imgsz'],
          device=self.device,
          conf=self.conf,
          iou=self.nms_iou,
          half=self.inference_params.get('half', False),
          agnostic_nms=self.agnostic_nms,
        )
        
        # Process results
        for result in results:
          if not self._process_result(result):
            self.running = False
            break
        
        if not self.running:
          break
        
        # Frame rate control: wait to match source FPS
        processing_time = time.time() - frame_start
        sleep_time = frame_interval - processing_time
        if sleep_time > 0:
          time.sleep(sleep_time)
          
    except Exception as e:
      print(f"[ERROR] Video playback error: {e}")
      import traceback
      traceback.print_exc()
    finally:
      cap.release()
      print("[INFO] Video capture released")
      if self.display:
        cv2.destroyAllWindows()

  def _run_with_yolo_stream(self) -> None:
    """
    Run tracking using YOLO's built-in streaming.
    Best for webcams only - provides optimal camera handling.
    """
    print("[INFO] Using YOLO's built-in streaming (webcam)")
    
    # For macOS cameras, ensure we pass the index with the right backend hint
    # YOLO will use this to create its own VideoCapture with AVFoundation
    yolo_source = self.source

    results = self.model.track(
      source=yolo_source,
      stream=True,
      verbose=False,
      classes=[0],
      tracker="camera_analytics/botsort.yaml",
      persist=True,
      imgsz=self.inference_params['imgsz'],
      device=self.device,
      vid_stride=self.vid_stride,
      conf=self.conf,
      iou=self.nms_iou,
      half=self.inference_params.get('half', False),
      agnostic_nms=self.agnostic_nms,
    )

    try:
      for result in results:
        if not self.running:
          break
        if not self._process_result(result):
          break
    finally:
      # CRITICAL: Explicit camera cleanup for macOS
      # YOLO manages its own VideoCapture, but we still need to ensure cleanup
      self._video_capture = None
      print("[INFO] YOLO tracking stopped, camera released by YOLO")

      if self.display:
        cv2.destroyAllWindows()

  def _run_snapshots(self) -> None:
    cap = cv2.VideoCapture(self.source)
    last_snapshot = 0.0
    
    try:
      while cap.isOpened() and self.running:
        now = time.time()
        if now - last_snapshot < self.snapshot_interval:
          if self.display:
            if cv2.waitKey(100) & 0xFF in (ord('q'), 27):
              break
          else:
            time.sleep(0.1)
          continue
        
        # Clear buffer (read a few frames) to get fresh image
        for _ in range(5):
          cap.grab()
        
        ret, frame = cap.read()
        if not ret:
          break

        # Run object tracking
        # Use custom tracker configuration for better stability
        import os
        import logging
        logger = logging.getLogger(__name__) # Assuming logger is set up

        if not os.path.exists(self.tracker_config_path):
            logger.error(f"Tracker config not found at {self.tracker_config_path}")
        else:
            logger.info(f"Using tracker config at {self.tracker_config_path}")
            with open(self.tracker_config_path, 'r') as f:
                logger.info(f"Tracker config content: {f.read()}")

        results = self.model.track(
          frame,
          persist=True,
          verbose=False,
          classes=[0],
          tracker=self.tracker_config_path,
          imgsz=self.inference_params['imgsz'],
          device=self.device,
          conf=self.confidence_threshold,
          iou=self.nms_iou,
          half=self.inference_params.get('half', False),
          agnostic_nms=self.agnostic_nms,
        )
        
        for result in results:
          if not self._process_result(result):
            return
        
        last_snapshot = now
    finally:
      cap.release()
      if self.display:
        cv2.destroyAllWindows()

  def _process_result(self, result) -> bool:
    frame = result.orig_img
    frame_h, frame_w = frame.shape[:2]
    timestamp = time.time()
    self._update_tracks(result, frame_w, frame_h, timestamp)
    self._update_demographics(frame)
    # Throttle track stream to ~10Hz (every 100ms) — reduces CPU overhead
    if timestamp - self._last_track_emit_time >= 0.100:
      self._emit_track_stream(timestamp)
      self._last_track_emit_time = timestamp

    # Apply privacy blur if enabled (GDPR/KVKK compliance)
    if self.privacy_mode:
      frame = self._apply_privacy_blur(frame, frame_w, frame_h)

    self.fps_counter += 1
    if timestamp - self.fps_start_time >= 1.0:
      self.fps = self.fps_counter / (timestamp - self.fps_start_time)
      self.fps_counter = 0
      self.fps_start_time = timestamp

    annotated = None
    if self.display:
      annotated = self._draw_overlay(frame.copy(), frame_w, frame_h)

    # Check if we should update metrics and overlays
    should_update_metrics = timestamp - self.last_metrics_write >= self.sample_interval

    if should_update_metrics:
      metrics = self._build_metrics()

      # Update overlay with new metrics - respect user preferences
      self.overlay.state.heatmap_visible = self._user_overlay_prefs['heatmap_visible']

      # Update size if changed
      if self.overlay.width != frame_w or self.overlay.height != frame_h:
          self.overlay.width = frame_w
          self.overlay.height = frame_h

      # Store the latest metrics for rendering
      self._latest_metrics = metrics.to_dict() if hasattr(metrics, 'to_dict') else metrics.__dict__

      self._emit_metrics_stream(metrics, int(timestamp * 1000))
      self._emit_zone_insights(timestamp)
      self._write_metrics(metrics)
      self.last_metrics_write = timestamp

    # Render overlay only when heatmap is visible (saves CPU when off)
    if hasattr(self, '_latest_metrics') and self.overlay.state.heatmap_visible:
      frame = self.overlay.render(frame, self._latest_metrics)

    # Update cache with overlay (thread-safe) - every frame
    with self._frame_lock:
      self._latest_frame = frame
      self._latest_frame_time = time.time()

    if self.display and annotated is not None:
      cv2.imshow("ObservAI Camera Analytics", annotated)
      key = cv2.waitKey(1) & 0xFF
      if key in (ord("q"), 27):
        return False
    
    return True

  @staticmethod
  def _filter_overlapping_boxes(boxes, track_ids, confs, containment_thresh=0.70, iou_merge_thresh=0.60):
    """Remove nested/highly-overlapping person detections after YOLO NMS."""
    n = len(boxes)
    if n <= 1:
      return boxes, track_ids, confs

    # Compute areas
    areas = np.empty(n)
    for i in range(n):
      x1, y1, x2, y2 = boxes[i]
      areas[i] = max(0, x2 - x1) * max(0, y2 - y1)

    suppress = set()
    for i in range(n):
      if i in suppress:
        continue
      for j in range(i + 1, n):
        if j in suppress:
          continue
        # Intersection
        ix1 = max(boxes[i][0], boxes[j][0])
        iy1 = max(boxes[i][1], boxes[j][1])
        ix2 = min(boxes[i][2], boxes[j][2])
        iy2 = min(boxes[i][3], boxes[j][3])
        inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
        if inter <= 0:
          continue

        smaller_area = min(areas[i], areas[j])
        containment = inter / max(smaller_area, 1e-6)
        union = areas[i] + areas[j] - inter
        iou = inter / max(union, 1e-6)

        if containment > containment_thresh or iou > iou_merge_thresh:
          # Suppress the smaller box, or lower confidence if sizes are similar
          if confs is not None and abs(areas[i] - areas[j]) / max(areas[i], areas[j], 1e-6) < 0.3:
            # Similar size: suppress lower confidence
            victim = i if confs[i] < confs[j] else j
          else:
            # Different size: suppress smaller (likely nested detection)
            victim = i if areas[i] < areas[j] else j
          suppress.add(victim)

    if not suppress:
      return boxes, track_ids, confs

    keep = [i for i in range(n) if i not in suppress]
    return boxes[keep], track_ids[keep], confs[keep] if confs is not None else None

  def _update_tracks(self, result, frame_w: int, frame_h: int, now: float) -> None:
    active_ids = set()
    if result.boxes.id is None:
      if _DEBUG:
        _log.debug("[TRACK] No detections this frame")
      return

    boxes = result.boxes.xyxy.cpu().numpy()
    track_ids = result.boxes.id.int().cpu().numpy()
    confs = result.boxes.conf.cpu().numpy() if result.boxes.conf is not None else None

    # Post-NMS overlap filtering: remove nested/highly-overlapping detections
    boxes, track_ids, confs = self._filter_overlapping_boxes(
      boxes, track_ids, confs,
      containment_thresh=self.config.post_nms_containment_thresh,
      iou_merge_thresh=self.config.post_nms_iou_merge_thresh,
    )

    if _DEBUG:
      _log.debug(f"[TRACK] Active IDs this frame: {list(track_ids)} (total tracks: {len(self.tracks)})")

    for track_id, box in zip(track_ids, boxes):
      x1, y1, x2, y2 = box.tolist()
      x1_norm, y1_norm = x1 / frame_w, y1 / frame_h
      x2_norm, y2_norm = x2 / frame_w, y2 / frame_h
      center_norm = ((x1_norm + x2_norm) / 2.0, (y1_norm + y2_norm) / 2.0)
      active_ids.add(int(track_id))

      person = self.tracks.get(int(track_id))
      if not person:
        if _DEBUG:
          _log.debug(f"[TRACK] NEW track ID={track_id} at bbox ({x1:.0f},{y1:.0f},{x2:.0f},{y2:.0f})")
        person = TrackedPerson(
          track_id=int(track_id),
          first_seen=now,
          last_seen=now,
          bbox_norm=(x1_norm, y1_norm, x2_norm, y2_norm),
          center_norm=center_norm,
          anonymous_id=self._generate_anonymous_id(int(track_id), self.session_salt),
        )
        person.state = "entering"
        # Restore demographics from recently dropped person (scored matching)
        w = x2_norm - x1_norm
        h = y2_norm - y1_norm
        aspect = w / max(h, 0.001)
        cx, cy = center_norm
        matched_key = None
        best_match_score = 0.0
        for key, (old_person, drop_time, drop_center) in self._dropped_demographics.items():
          if now - drop_time > 120:
            continue
          old_aspect = float(key.split('_')[0])
          # Aspect ratio similarity (0 to 1)
          aspect_sim = max(0.0, 1.0 - abs(aspect - old_aspect) / 0.5)
          # Spatial proximity to where the person was last seen
          if drop_center is not None:
            dist = ((cx - drop_center[0])**2 + (cy - drop_center[1])**2)**0.5
            spatial_sim = max(0.0, 1.0 - dist / 0.3)
          else:
            spatial_sim = 0.5
          # Time recency (prefer recent drops)
          time_factor = max(0.3, 1.0 - (now - drop_time) / 120.0)
          # Combined score
          score = aspect_sim * 0.3 + spatial_sim * 0.5 + time_factor * 0.2
          if score > best_match_score and score > 0.5:
            best_match_score = score
            matched_key = key

        if matched_key:
          old_person = self._dropped_demographics[matched_key][0]
          person.age_history = old_person.age_history.copy()
          person.age_confidence_history = old_person.age_confidence_history.copy()
          person.gender_history = old_person.gender_history.copy()
          person.gender_confidence_history = old_person.gender_confidence_history.copy()
          person.age = old_person.age
          person.gender = old_person.gender
          person.age_ema = old_person.age_ema
          person.gender_confidence = old_person.gender_confidence
          person.age_stability = old_person.age_stability
          person.gender_stability = old_person.gender_stability
          person.gender_locked = old_person.gender_locked
          person.age_locked = getattr(old_person, 'age_locked', False)
          person.demographics_frozen = getattr(old_person, 'demographics_frozen', False)
          person._gender_consecutive_same = old_person._gender_consecutive_same
          person._gender_consecutive_opposite = old_person._gender_consecutive_opposite
          person._gender_last_vote = old_person._gender_last_vote
          person._demo_update_count = old_person._demo_update_count
          # Transfer counting flags to prevent double-counting
          person.counted_in = old_person.counted_in
          person.counted_out = old_person.counted_out
          self._dropped_demographics.pop(matched_key, None)
          # If the old person was counted in but drop incremented people_out, reverse it
          if person.counted_in and not person.counted_out:
            self.people_out = max(0, self.people_out - 1)
        self.tracks[int(track_id)] = person
      else:
        person.prev_center_norm = person.center_norm
        person.center_norm = center_norm

        # Adaptive EMA bbox smoothing
        raw_bbox = (x1_norm, y1_norm, x2_norm, y2_norm)
        if person.smoothed_bbox_norm is not None:
          old = person.smoothed_bbox_norm
          old_cx = (old[0] + old[2]) / 2.0
          old_cy = (old[1] + old[3]) / 2.0
          new_cx = (raw_bbox[0] + raw_bbox[2]) / 2.0
          new_cy = (raw_bbox[1] + raw_bbox[3]) / 2.0
          displacement = ((new_cx - old_cx) ** 2 + (new_cy - old_cy) ** 2) ** 0.5

          alpha_min = getattr(self.config, 'bbox_smoothing_alpha_min', 0.2)
          alpha_max = getattr(self.config, 'bbox_smoothing_alpha_max', 0.9)

          if displacement > 0.15:
            alpha = 1.0  # teleport: accept raw position
          elif displacement > 0.05:
            alpha = alpha_max  # real movement: light smoothing
          elif displacement > 0.015:
            # Interpolate between min and max for moderate movement
            t = (displacement - 0.015) / (0.05 - 0.015)
            alpha = alpha_min + t * (alpha_max - alpha_min)
          else:
            alpha = alpha_min  # jitter: heavy smoothing

          person.smoothed_bbox_norm = tuple(
            alpha * r + (1.0 - alpha) * s for r, s in zip(raw_bbox, old)
          )  # type: ignore[assignment]
        else:
          person.smoothed_bbox_norm = raw_bbox

        person.bbox_norm = person.smoothed_bbox_norm  # type: ignore[assignment]
        person.last_seen = now

      # Stage 2: push a (timestamp, bbox_norm) sample for display-side interpolation.
      # Newly-created persons also get their first sample here so smooth mode can
      # freeze them at the observed position until a second sample lands.
      person.bbox_samples.append((now, person.bbox_norm))

      self._update_inside_state(person, now)
      self._update_zones(person, now)
      self._update_heatmap(person.center_norm)

    self._drop_stale_tracks(active_ids, now)
    # Stage 4: sweep leftover zone memberships after grace expires.
    if getattr(self.config, 'zone_occlusion_grace_enabled', False):
      self._reconcile_zone_members(now)

  def _update_inside_state(self, person: TrackedPerson, now: float) -> None:
    if not self.config.entrance_line:
      person.inside = True
      dwell = now - person.first_seen
      person.state = "entering" if dwell < 2.0 else "present"
      return

    entrance: EntranceLine = self.config.entrance_line
    side = line_side(person.center_norm, entrance.start, entrance.end)

    if entrance.inside_on in {"top", "above"}:
      inside = side < 0
    elif entrance.inside_on in {"bottom", "below"}:
      inside = side > 0
    elif entrance.inside_on == "left":
      inside = side > 0
    elif entrance.inside_on == "right":
      inside = side < 0
    else:
      inside = side < 0

    previously_inside = person.inside
    person.inside = inside
    dwell = now - person.first_seen

    if person.inside:
      person.state = "entering" if dwell < 2.0 else "present"
    else:
      person.state = "exiting" if person.counted_in else "entering"

    if previously_inside != inside and person.prev_center_norm is not None:
      if inside and not person.counted_in:
        self.people_in += 1
        person.counted_in = True
      elif not inside and person.counted_in and not person.counted_out:
        self.people_out += 1
        person.counted_out = True
        person.state = "exiting"
        self._finalize_active_zones(person, now)

  def _update_zones(self, person: TrackedPerson, now: float) -> None:
    enter_frames = getattr(self.config, 'zone_enter_debounce_frames', 3)
    exit_frames = getattr(self.config, 'zone_exit_debounce_frames', 5)

    for zone_id, zone in self.zone_definitions.items():
      inside_zone = point_in_polygon(person.center_norm, zone.polygon)
      is_active = zone_id in person.active_zones

      if inside_zone:
        person.zone_consecutive_inside[zone_id] = person.zone_consecutive_inside.get(zone_id, 0) + 1
        person.zone_consecutive_outside[zone_id] = 0
      else:
        person.zone_consecutive_outside[zone_id] = person.zone_consecutive_outside.get(zone_id, 0) + 1
        person.zone_consecutive_inside[zone_id] = 0

      if not is_active and person.zone_consecutive_inside.get(zone_id, 0) >= enter_frames:
        person.active_zones[zone_id] = now
        self.zone_active_members[zone_id][person.track_id] = now
      elif is_active and person.zone_consecutive_outside.get(zone_id, 0) >= exit_frames:
        started = person.active_zones.pop(zone_id)
        duration = now - started
        self.zone_completed_durations[zone_id].append(duration)
        self.zone_active_members[zone_id].pop(person.track_id, None)

  def _finalize_active_zones(self, person: TrackedPerson, now: float) -> None:
    for zone_id, entered_at in list(person.active_zones.items()):
      duration = now - entered_at
      self.zone_completed_durations[zone_id].append(duration)
      self.zone_active_members[zone_id].pop(person.track_id, None)
      person.active_zones.pop(zone_id, None)

  def _check_zone_insights(self, now: float) -> List[Dict[str, object]]:
    """Check for persons who have been in zones for >10 minutes and generate insights.
    Also generates table-specific alerts (long occupancy, needs cleaning)."""
    insights = []

    for zone_id, active_members in self.zone_active_members.items():
      zone_name = self.zone_definitions.get(zone_id, None)
      if zone_name is None:
        continue

      for track_id, entered_at in active_members.items():
        duration = now - entered_at

        # Check if person has been in zone for more than threshold
        if duration >= self.zone_insight_threshold:
          # Only trigger insight once per person per zone
          if track_id not in self.zone_insight_triggered[zone_id]:
            self.zone_insight_triggered[zone_id].add(track_id)

            person = self.tracks.get(track_id)
            insight = {
              "zoneId": zone_id,
              "zoneName": getattr(zone_name, 'name', zone_id),
              "personId": f"track_{track_id}",
              "duration": duration,
              "timestamp": now,
              "message": f"Person has been in {getattr(zone_name, 'name', zone_id)} for over {int(duration / 60)} minutes"
            }

            # Add demographic info if available
            if person:
              insight["demographics"] = {
                "gender": person.gender,
                "age": int(person.age) if person.age else None
              }

            insights.append(insight)

    # Table-specific alerts
    alert_threshold = self.config.table_long_occupancy_alert
    for table_id in self.table_ids:
      zone = self.zone_definitions.get(table_id)
      if not zone:
        continue
      table_name = getattr(zone, 'name', table_id)

      # Long occupancy alert
      occ_start = self.table_occupy_start.get(table_id)
      if occ_start:
        occ_duration = now - occ_start
        alert_key = f"table_long_{table_id}"
        if occ_duration >= alert_threshold and alert_key not in self.zone_insight_triggered.get("__table_alerts__", set()):
          self.zone_insight_triggered.setdefault("__table_alerts__", set()).add(alert_key)
          insights.append({
            "zoneId": table_id,
            "zoneName": table_name,
            "personId": "table_alert",
            "duration": occ_duration,
            "timestamp": now,
            "type": "table_long_occupancy",
            "message": f"{table_name} {int(occ_duration / 60)} dakikadir dolu — hesap sorulmali"
          })

      # Needs cleaning alert (3+ minutes)
      left_at = self.table_left_at.get(table_id)
      if left_at:
        clean_duration = now - left_at
        clean_key = f"table_clean_{table_id}_{int(left_at)}"
        if clean_duration >= 180 and clean_key not in self.zone_insight_triggered.get("__table_alerts__", set()):
          self.zone_insight_triggered.setdefault("__table_alerts__", set()).add(clean_key)
          insights.append({
            "zoneId": table_id,
            "zoneName": table_name,
            "personId": "table_alert",
            "duration": clean_duration,
            "timestamp": now,
            "type": "table_needs_cleaning",
            "message": f"{table_name} bosaldi, {int(clean_duration / 60)} dakikadir temizlenmedi"
          })

    return insights

  def _update_heatmap(self, center_norm: Tuple[float, float]) -> None:
    row, col = heatmap_bin(
      center_norm, self.config.heatmap.grid_width, self.config.heatmap.grid_height
    )
    self.heatmap[row, col] += 5

  def _drop_stale_tracks(self, active_ids: set[int], now: float, ttl: float = None) -> None:
    if ttl is None:
      ttl = self.config.track_stale_ttl
    grace_on = getattr(self.config, 'zone_occlusion_grace_enabled', False)
    for track_id in list(self.tracks.keys()):
      person = self.tracks[track_id]
      if track_id in active_ids:
        continue
      age_since_seen = now - person.last_seen
      if age_since_seen > ttl:
        if _DEBUG:
          _log.debug(
            f"[TRACK] DROP stale track_id={track_id} "
            f"(unseen for {age_since_seen:.1f}s, gender={person.gender}, age={person.age})"
          )
        # Save demographics for re-entry matching (with spatial info)
        if person.gender != "unknown" or person.age is not None:
          w = person.bbox_norm[2] - person.bbox_norm[0]
          h = person.bbox_norm[3] - person.bbox_norm[1]
          aspect = round(w / max(h, 0.001), 1)
          key = f"{aspect}_{person.gender}_{int(person.age or 0)}_{track_id}"
          self._dropped_demographics[key] = (person, now, person.center_norm)
          # Evict old entries (>120s)
          self._dropped_demographics = {
            k: v for k, v in self._dropped_demographics.items()
            if now - v[1] < 120
          }
        if person.counted_in and not person.counted_out:
          self.people_out += 1
        # Stage 4: when grace is enabled, keep zone_active_members entries alive
        # for up to zone_grace_period_s so a brief occlusion doesn't flip a table
        # from occupied → empty. _reconcile_zone_members() sweeps true leavers.
        if grace_on and person.active_zones:
          for zone_id in list(person.active_zones.keys()):
            # leave zone_active_members[zone_id][track_id] as-is — its value
            # (timestamp of last presence) is what the reconciler tests against
            person.active_zones.pop(zone_id, None)
        else:
          self._finalize_active_zones(person, now)
        self.tracks.pop(track_id, None)

  def _reconcile_zone_members(self, now: float) -> None:
    """Stage 4: evict zone members whose track has been gone for longer than
    the grace period. Without this sweep, a track dropped during an occlusion
    would remain 'present' in the zone forever."""
    grace = getattr(self.config, 'zone_grace_period_s', 3.0)
    if grace <= 0:
      return
    for zone_id in list(self.zone_active_members.keys()):
      members = self.zone_active_members[zone_id]
      for tid in list(members.keys()):
        if tid in self.tracks:
          # Still alive — the normal _update_zones path keeps last_seen fresh
          continue
        last_seen = members[tid]
        if (now - last_seen) > grace:
          members.pop(tid, None)
          if _DEBUG:
            _log.debug(f"[ZONE] grace expired, evicting tid={tid} from zone={zone_id}")

  def _match_faces_to_tracks(self, faces, frame_w: int, frame_h: int) -> List[tuple]:
    """Match InsightFace results to YOLO tracked persons by bbox overlap."""
    cfg = self.config
    continuous_refinement = cfg.demo_continuous_refinement
    results = []
    tracks_snapshot = list(self.tracks.items())

    if not tracks_snapshot or not faces:
      return []

    if self.frame_count < 300:
      print(f"[DEMO] Full-frame: {len(faces)} yuz, {len(tracks_snapshot)} kisi tracked")

    # Build eligible tracks list (skip frozen/stable)
    eligible_tracks = []
    for track_id, person in tracks_snapshot:
      if getattr(person, 'demographics_frozen', False):
        continue
      if not continuous_refinement:
        has_age = person.age is not None and len(person.age_history) >= 3
        has_gender = person.gender != "unknown" and len(person.gender_history) >= 5
        if has_age and has_gender:
          continue
      else:
        if (person.age_stability > 0.85 and person.gender_stability > 0.85
            and person._demo_update_count >= 10):
          if person._demo_update_count % 5 != 0:
            continue
      eligible_tracks.append((track_id, person))

    # Build all candidate (track_idx, face_idx, overlap_score) tuples
    candidates = []
    for ti, (track_id, person) in enumerate(eligible_tracks):
      x1_norm, y1_norm, x2_norm, y2_norm = person.bbox_norm
      px1 = x1_norm * frame_w
      py1 = y1_norm * frame_h
      px2 = x2_norm * frame_w
      py2 = y2_norm * frame_h

      for fi, face in enumerate(faces):
        fx1, fy1, fx2, fy2 = face.bbox
        det_score = float(face.det_score) if hasattr(face, 'det_score') else 0.0
        if det_score < cfg.demo_min_confidence:
          continue

        face_cx = (fx1 + fx2) / 2
        face_cy = (fy1 + fy2) / 2
        person_w = px2 - px1
        person_h = py2 - py1
        tol_x = max(30, person_w * 0.3)
        tol_y = max(30, person_h * 0.3)
        person_head_y2 = py1 + person_h * 0.75

        if (px1 - tol_x <= face_cx <= px2 + tol_x and
            py1 - tol_y <= face_cy <= person_head_y2 + tol_y):
          overlap_x = max(0, min(fx2, px2) - max(fx1, px1))
          overlap_y = max(0, min(fy2, py2) - max(fy1, py1))
          overlap_area = overlap_x * overlap_y
          face_area = max(1, (fx2 - fx1) * (fy2 - fy1))
          overlap_ratio = overlap_area / face_area
          if overlap_ratio > 0:
            candidates.append((ti, fi, overlap_ratio))

    # Greedy exclusive assignment: best score first, no face/person reuse
    candidates.sort(key=lambda c: c[2], reverse=True)
    used_tracks = set()
    used_faces_set = set()
    for ti, fi, _score in candidates:
      if ti in used_tracks or fi in used_faces_set:
        continue
      used_tracks.add(ti)
      used_faces_set.add(fi)

      track_id, person = eligible_tracks[ti]
      best_face = faces[fi]
      age = float(best_face.age) if hasattr(best_face, 'age') and best_face.age is not None else None
      det_score = float(best_face.det_score) if hasattr(best_face, 'det_score') else 0.0
      gender = None
      if hasattr(best_face, "gender") and best_face.gender is not None:
        gender = "male" if round(float(best_face.gender)) == 1 else "female"
      elif hasattr(best_face, "sex"):
        if isinstance(best_face.sex, str):
          gender = "male" if best_face.sex.upper() == 'M' else "female"
        else:
          gender = "male" if float(best_face.sex) > 0.5 else "female"

      if age is not None and gender is not None:
        face_w_px = best_face.bbox[2] - best_face.bbox[0]
        face_h_px = best_face.bbox[3] - best_face.bbox[1]
        f_area = face_w_px * face_h_px
        fr_area = frame_w * frame_h
        sz_f = min(1.0, max(0.3, (f_area / max(1, fr_area)) / 0.001))
        p_f = 0.8
        if hasattr(best_face, 'pose') and best_face.pose is not None:
          yaw = abs(float(best_face.pose[1]))
          p_f = max(0.4, 1.0 - yaw / 120.0)
        confidence = max(0.15, min(0.95, 0.85 * min(1.0, det_score / 0.5) * sz_f * p_f))
        results.append((track_id, age, gender, confidence))

    if self.frame_count < 300:
      print(f"[DEMO] Eslestirme: {len(results)}/{len(tracks_snapshot)} kisi icin yas/cinsiyet bulundu")

    return results

  def _process_demographics_async(self, frame: np.ndarray, frame_w: int, frame_h: int) -> List[tuple]:
    """
    Full-frame face detection approach:
    1. Run InsightFace on the FULL frame to detect all faces with age/gender.
    2. Match detected faces to YOLO-tracked persons by bbox overlap.
    3. Return (track_id, age, gender, confidence) for matched pairs.

    This is much more reliable than crop-based detection because InsightFace's
    face detector works best on full-resolution images, not tiny crops.
    """
    if self.age_gender_estimator is None:
      return []

    cfg = self.config
    continuous_refinement = cfg.demo_continuous_refinement

    try:
      results = []
      tracks_snapshot = list(self.tracks.items())
      if not tracks_snapshot:
        return []

      # Step 1: Run InsightFace on the full frame to find ALL faces
      faces = self.age_gender_estimator.detect_and_predict(frame)
      if not faces:
        if self.frame_count < 300:
          print(f"[DEMO] Full-frame: {len(tracks_snapshot)} kisi tracked, InsightFace 0 yuz buldu (frame={frame_w}x{frame_h})")
        return []

      if self.frame_count < 300:
        print(f"[DEMO] Full-frame: {len(faces)} yuz bulundu, {len(tracks_snapshot)} kisi tracked")

      # Step 2: Match faces to tracked persons (exclusive greedy assignment)
      # Build eligible tracks list (skip frozen/stable)
      eligible_tracks = []
      for track_id, person in tracks_snapshot:
        if getattr(person, 'demographics_frozen', False):
          continue
        if not continuous_refinement:
          has_age = person.age is not None and len(person.age_history) >= 3
          has_gender = person.gender != "unknown" and len(person.gender_history) >= 5
          if has_age and has_gender:
            continue
        else:
          if (person.age_stability > 0.85 and person.gender_stability > 0.85
              and person._demo_update_count >= 10):
            if person._demo_update_count % 5 != 0:
              continue
        eligible_tracks.append((track_id, person))

      # Build all candidate (track_idx, face_idx, overlap_score) tuples
      candidates = []
      for ti, (track_id, person) in enumerate(eligible_tracks):
        x1_norm, y1_norm, x2_norm, y2_norm = person.bbox_norm
        px1 = x1_norm * frame_w
        py1 = y1_norm * frame_h
        px2 = x2_norm * frame_w
        py2 = y2_norm * frame_h

        for fi, face in enumerate(faces):
          fx1, fy1, fx2, fy2 = face.bbox
          det_score = float(face.det_score) if hasattr(face, 'det_score') else 0.0
          if det_score < cfg.demo_min_confidence:
            continue

          face_cx = (fx1 + fx2) / 2
          face_cy = (fy1 + fy2) / 2
          person_w = px2 - px1
          person_h = py2 - py1
          tol_x = max(30, person_w * 0.3)
          tol_y = max(30, person_h * 0.3)
          person_head_y2 = py1 + person_h * 0.75

          if (px1 - tol_x <= face_cx <= px2 + tol_x and
              py1 - tol_y <= face_cy <= person_head_y2 + tol_y):
            overlap_x = max(0, min(fx2, px2) - max(fx1, px1))
            overlap_y = max(0, min(fy2, py2) - max(fy1, py1))
            overlap_area = overlap_x * overlap_y
            face_area = max(1, (fx2 - fx1) * (fy2 - fy1))
            overlap_ratio = overlap_area / face_area
            if overlap_ratio > 0:
              candidates.append((ti, fi, overlap_ratio))

      # Greedy exclusive assignment: best score first, no face/person reuse
      candidates.sort(key=lambda c: c[2], reverse=True)
      used_tracks = set()
      used_faces_set = set()
      for ti, fi, _score in candidates:
        if ti in used_tracks or fi in used_faces_set:
          continue
        used_tracks.add(ti)
        used_faces_set.add(fi)

        track_id, person = eligible_tracks[ti]
        best_face = faces[fi]
        age = float(best_face.age) if hasattr(best_face, 'age') and best_face.age is not None else None
        det_score = float(best_face.det_score) if hasattr(best_face, 'det_score') else 0.0

        # Gender: hysteresis band — values in the ambiguous middle zone are
        # skipped this frame rather than forced into a category. This dramatically
        # reduces flip-flop on uncertain faces (side poses, low-res, occlusion).
        gender = None
        gender_score = None
        if hasattr(best_face, "gender") and best_face.gender is not None:
          gender_score = float(best_face.gender)
        elif hasattr(best_face, "sex"):
          if isinstance(best_face.sex, str):
            gender = "male" if best_face.sex.upper() == 'M' else "female"
          else:
            gender_score = float(best_face.sex)

        gender_recovered = False
        if gender_score is not None:
          lo = getattr(self.config, 'demo_gender_lower_band', 0.35)
          hi = getattr(self.config, 'demo_gender_upper_band', 0.65)
          if gender_score >= hi:
            gender = "male"
          elif gender_score <= lo:
            gender = "female"
          # Inside the band → normally we leave gender=None so it's ignored this
          # frame. Stage 3: optional majority-vote recovery on recent history,
          # emitted at half weight so a confident counter-vote can still win.
          if (gender is None
              and getattr(self.config, 'demo_ambiguous_recovery', False)
              and len(person.gender_history) >= getattr(self.config, 'demo_ambiguous_recent_votes', 3)):
            recent_n = getattr(self.config, 'demo_ambiguous_recent_votes', 3)
            recent = [g for g in list(person.gender_history)[-recent_n:] if g in ("male", "female")]
            if recent:
              m = sum(1 for g in recent if g == 'male')
              f = sum(1 for g in recent if g == 'female')
              if m > f:
                gender = "male"
                gender_recovered = True
              elif f > m:
                gender = "female"
                gender_recovered = True

        if age is not None:
          face_w_px = best_face.bbox[2] - best_face.bbox[0]
          face_h_px = best_face.bbox[3] - best_face.bbox[1]
          f_area = face_w_px * face_h_px
          fr_area = frame_w * frame_h
          sz_f = min(1.0, max(0.3, (f_area / max(1, fr_area)) / 0.001))
          # Relaxed pose penalty: previously yaw/120 floored at 0.4.
          # yaw/150 is softer so moderate side poses don't nuke confidence;
          # final gender is still gated by the hysteresis band above.
          p_f = 0.85
          if hasattr(best_face, 'pose') and best_face.pose is not None:
            yaw = abs(float(best_face.pose[1]))
            p_f = max(0.45, 1.0 - yaw / 150.0)
          confidence = max(0.15, min(0.95, 0.85 * min(1.0, det_score / 0.5) * sz_f * p_f))
          if gender_recovered:
            confidence *= 0.5
          # Emit even if gender ended up None — age can still be learned and
          # a subsequent frame may supply a confident gender vote.
          results.append((track_id, age, gender, confidence))

      if self.frame_count < 300:
        print(f"[DEMO] Eslestirme: {len(results)}/{len(tracks_snapshot)} kisi icin yas/cinsiyet bulundu")
      elif len(results) > 0:
        print(f"[DEMO] Demographics: {len(results)} sonuc")
      return results

    except Exception as e:
      print(f"[WARN] Demographics processing error: {e}")
      import traceback
      traceback.print_exc()
      return []

  def _update_demographics(self, frame: np.ndarray) -> None:
    if self.age_gender_estimator is None:
      return

    # Use crop-based demographics from inference thread (dict: track_id -> (age, gender, conf))
    demo_results = getattr(self, '_latest_demo_results', {})
    if not demo_results:
      return

    # Clear so we don't reprocess
    self._latest_demo_results = {}

    cfg = self.config
    age_ema_alpha = cfg.demo_age_ema_alpha
    gender_consensus = cfg.demo_gender_consensus
    temporal_decay = cfg.demo_temporal_decay
    gender_lock_threshold = cfg.demo_gender_lock_threshold
    # Age voting: accept most predictions (low threshold) since EMA+median handles noise
    age_voting_min_conf = 0.05
    # Gender voting: require reasonable confidence — filters noise but accepts
    # distant/slightly-angled face votes for street cameras.
    gender_voting_min_conf = 0.30

    matched = 0
    for track_id, result_tuple in demo_results.items():
      # Support both 3-tuple (legacy) and 4-tuple (separate age/gender conf)
      if len(result_tuple) == 4:
        age, gender, age_conf, gender_conf = result_tuple
      else:
        age, gender, conf = result_tuple
        age_conf = conf
        gender_conf = conf

      if track_id in self.tracks:
        person = self.tracks[track_id]
        matched += 1
        if age is not None:
          # Age outlier dampening: scale down confidence for large jumps from EMA
          # Graduated: 15-25yr = moderate penalty, >25yr = strong penalty
          if person.age_ema is not None:
            delta = abs(age - person.age_ema)
            if delta > 25.0:
              age_conf *= 0.15  # Very likely misdetection
            elif delta > 15.0:
              age_conf *= max(0.30, 1.0 - (delta - 10.0) / 30.0)  # Graduated penalty
          person.update_age(age, confidence=age_conf,
                            ema_alpha=age_ema_alpha,
                            min_confidence=age_voting_min_conf,
                            lock_stability=cfg.demo_age_lock_stability,
                            lock_min_samples=cfg.demo_age_lock_min_samples)
        if gender is not None and gender_conf > 0:
          person.update_gender(gender, confidence=gender_conf,
                               consensus_threshold=gender_consensus,
                               temporal_decay=temporal_decay,
                               min_confidence=gender_voting_min_conf,
                               lock_threshold=gender_lock_threshold)

        # Freeze demographics once both age and gender are locked
        if (not person.demographics_frozen
            and person.age_locked and person.gender_locked):
          person.demographics_frozen = True

    if self.frame_count % 90 == 0:
      print(f"[DEMO] Applied: {len(demo_results)} detected, {matched} applied to tracks", flush=True)

  def _table_occupant_count(self, table_id: str) -> int:
    """Stage 4: centralised occupant count with capacity clamp.
    Without this clamp, drift in zone_active_members (e.g. BoT-SORT duplicating
    a seated person under two track IDs) produced the 'masa 1 kişi ama aslında
    3 oturuyor' class of bugs and, summed across tables, the 'toplam 15' inflation."""
    raw = len(self.zone_active_members.get(table_id, {}))
    if not getattr(self.config, 'table_capacity_clamp_enabled', False):
      return raw
    zone = self.zone_definitions.get(table_id)
    per_zone_cap = getattr(zone, 'max_capacity', None) if zone is not None else None
    default_cap = getattr(self.config, 'table_max_capacity', 6)
    cap = per_zone_cap if isinstance(per_zone_cap, int) and per_zone_cap > 0 else default_cap
    if raw > cap:
      if _DEBUG:
        _log.debug(f"[TABLE] clamp table={table_id} raw={raw} cap={cap}")
      return cap
    return raw

  def _update_table_status(self, now: float) -> None:
    """Update table occupancy state machine for each TABLE zone.

    v2 Flow:
      empty        → occupied     (occupants > 0)
      occupied     → occupied     (even if briefly empty < transit_grace, e.g. chair shuffle)
      occupied     → needs_cleaning (empty >= cleaning_empty_threshold AND occupied was >= min_occupied)
      occupied     → empty        (empty >= cleaning_empty_threshold AND occupied was < min_occupied — transient passer-by)
      needs_cleaning → occupied   (someone sat down again)
      needs_cleaning → empty      (auto-timeout OR manual backend PATCH)
    """
    min_occupied = self.config.table_min_occupied_duration
    cleaning_threshold = self.config.table_cleaning_empty_threshold
    auto_empty = self.config.table_auto_empty_timeout
    transit_grace = self.config.table_transit_grace

    for table_id in self.table_ids:
      if table_id not in self.zone_definitions:
        continue
      occupants = self._table_occupant_count(table_id)
      status = self.table_status.get(table_id, "empty")

      if occupants > 0:
        # Someone at the table
        if status == "empty" or status == "needs_cleaning":
          # Transition → occupied
          self.table_status[table_id] = "occupied"
          self.table_occupy_start[table_id] = now
          self.table_left_at.pop(table_id, None)
          self.table_cleaning_since.pop(table_id, None)
          self.table_transit_empty_since.pop(table_id, None)
        else:
          # Still occupied — clear any transit-empty flag
          self.table_transit_empty_since.pop(table_id, None)
          self.table_left_at.pop(table_id, None)
          if table_id not in self.table_occupy_start:
            self.table_occupy_start[table_id] = now
      else:
        # No occupants
        if status == "occupied":
          # Just became empty during an occupancy — start transit buffer
          if table_id not in self.table_transit_empty_since:
            self.table_transit_empty_since[table_id] = now
          transit_elapsed = now - self.table_transit_empty_since[table_id]

          if transit_elapsed < transit_grace:
            # Stay occupied — likely a temporary absence (chair shuffle, bathroom)
            continue

          # Transit grace expired — commit the "left" state
          occ_start = self.table_occupy_start.get(table_id, now)
          occupied_duration = now - occ_start
          self.table_last_occupied_duration[table_id] = occupied_duration
          self.table_turnover[table_id] = self.table_turnover.get(table_id, 0) + 1
          self.table_occupy_start.pop(table_id, None)
          self.table_left_at[table_id] = self.table_transit_empty_since[table_id]
          self.table_transit_empty_since.pop(table_id, None)

          # Check if empty long enough for cleaning decision
          empty_elapsed = now - self.table_left_at[table_id]
          if empty_elapsed >= cleaning_threshold:
            if occupied_duration >= min_occupied:
              # Real use → cleaning needed
              self.table_status[table_id] = "needs_cleaning"
              self.table_cleaning_since[table_id] = now
            else:
              # Transient passer-by, no cleaning needed
              self.table_status[table_id] = "empty"
              self.table_left_at.pop(table_id, None)

        elif status == "needs_cleaning":
          cleaning_at = self.table_cleaning_since.get(table_id, now)
          if (now - cleaning_at) >= auto_empty:
            # Auto-timeout fallback (staff forgot to confirm)
            self.table_status[table_id] = "empty"
            self.table_cleaning_since.pop(table_id, None)
            self.table_left_at.pop(table_id, None)
          # else: stay in needs_cleaning until manual PATCH or auto-timeout

        elif status == "empty":
          # Might have been in transit from occupied previously — check if ready
          left_at = self.table_left_at.get(table_id)
          if left_at is not None:
            empty_elapsed = now - left_at
            if empty_elapsed >= cleaning_threshold:
              last_occ = self.table_last_occupied_duration.get(table_id, 0.0)
              if last_occ >= min_occupied:
                self.table_status[table_id] = "needs_cleaning"
                self.table_cleaning_since[table_id] = now
              else:
                self.table_left_at.pop(table_id, None)
          # otherwise stay empty

  def force_table_empty(self, table_id: str) -> bool:
    """Manually mark a table as empty (staff confirms cleaning done).

    Returns True if the transition was applied, False if table was already empty
    or unknown.
    """
    if table_id not in self.table_ids:
      return False
    prev = self.table_status.get(table_id, "empty")
    if prev == "empty":
      return False
    self.table_status[table_id] = "empty"
    self.table_cleaning_since.pop(table_id, None)
    self.table_left_at.pop(table_id, None)
    self.table_transit_empty_since.pop(table_id, None)
    if _DEBUG:
      _log.debug(f"[TABLE] force_empty table={table_id} prev={prev}")
    return True

  def _build_metrics(self) -> CameraMetrics:
    # Decay heatmap over time
    self.heatmap *= 0.9

    metrics = CameraMetrics()
    metrics.people_in = self.people_in
    metrics.people_out = self.people_out
    metrics.current = sum(1 for person in self.tracks.values() if person.inside)

    age_buckets = default_age_buckets()
    gender_counts = {"male": 0, "female": 0, "unknown": 0}
    
    # Initialize gender_by_age with all buckets
    gender_by_age = {bucket: {"male": 0, "female": 0, "unknown": 0} for bucket in age_buckets}
    
    dwell_times: list[float] = []
    active_people: list[ActivePersonSnapshot] = []
    now = time.time()

    for person in self.tracks.values():
      if not person.inside:
        continue

      dwell = now - person.first_seen
      dwell_times.append(dwell)

      # Update global gender counts
      if person.gender in gender_counts:
        gender_counts[person.gender] += 1
      else:
        gender_counts["unknown"] += 1

      # Update age buckets and gender_by_age
      bucket = bucket_for_age(person.age)
      if bucket != "unknown":
        age_buckets[bucket] += 1
        
        # Update gender count for this specific age bucket
        gender_key = person.gender if person.gender in {"male", "female"} else "unknown"
        gender_by_age[bucket][gender_key] += 1

      # Surface best age confidence seen (from history) + current gender consensus.
      age_conf = 0.0
      if person.age_confidence_history:
        age_conf = float(max(person.age_confidence_history))
      gender_conf = float(getattr(person, 'gender_confidence', 0.0))

      active_people.append(
        ActivePersonSnapshot(
          id=person.track_id,
          age=person.age,
          age_bucket=bucket if bucket != "unknown" else "unknown",
          gender=person.gender,
          dwell_seconds=dwell,
          age_confidence=age_conf,
          gender_confidence=gender_conf,
          age_locked=bool(person.age_locked),
          gender_locked=bool(getattr(person, 'gender_locked', False)),
          age_stability=float(person.age_stability),
        )
      )

    metrics.age_buckets = age_buckets
    metrics.gender = gender_counts
    metrics.gender_by_age = gender_by_age
    metrics.active_people = active_people
    metrics.avg_dwell_time = float(np.mean(dwell_times)) if dwell_times else 0.0

    if self.queue_id:
      durations = self.zone_completed_durations[self.queue_id]
      active_count = len(self.zone_active_members[self.queue_id])
      avg_wait = float(np.mean(durations)) if durations else 0.0
      longest = float(np.max(durations)) if durations else 0.0
      metrics.queue = QueueSnapshot(active_count, avg_wait, longest)

    # Update table occupancy state machine
    self._update_table_status(now)

    table_snapshots: list[TableSnapshot] = []

    zone_snapshots: list[ZoneSnapshot] = []
    for zid, zone in self.zone_definitions.items():
        durations = self.zone_completed_durations[zid]
        active = len(self.zone_active_members[zid])
        avg = float(np.mean(durations)) if durations else 0.0

        zone_snapshots.append(ZoneSnapshot(
            id=zid,
            name=zone.name or zid,
            current_occupants=active,
            total_visitors=len(durations),
            avg_dwell_time=avg
        ))
    metrics.zones = zone_snapshots

    # Build table snapshots from table_ids (populated by update_zones or config)
    for table_id in self.table_ids:
      if table_id not in self.zone_definitions:
        continue
      zone = self.zone_definitions[table_id]
      durations = self.zone_completed_durations[table_id]
      active = self._table_occupant_count(table_id)
      avg = float(np.mean(durations)) if durations else 0.0
      longest = float(np.max(durations)) if durations else 0.0

      occ_start = self.table_occupy_start.get(table_id)
      occ_duration = (now - occ_start) if occ_start else 0.0

      table_snapshots.append(
        TableSnapshot(
          id=table_id,
          name=zone.name,
          current_occupants=active,
          avg_stay_seconds=avg,
          longest_stay_seconds=longest,
          status=self.table_status.get(table_id, "empty"),
          occupancy_duration=occ_duration,
          turnover_count=self.table_turnover.get(table_id, 0),
        )
      )
    metrics.tables = table_snapshots
    metrics.heatmap = self.heatmap.astype(int).tolist()
    metrics.fps = self.fps
    # Task 2.1.1: Async pipeline FPS'leri metrics'e ekle
    if hasattr(self, 'capture_fps'):
      metrics.capture_fps   = round(self.capture_fps, 1)
      metrics.inference_fps = round(self.inference_fps, 1)
    return metrics

  def _heatmap_to_points(self, grid: List[List[int]]) -> List[Dict[str, float]]:
    if not grid:
      return []

    height = len(grid)
    width = len(grid[0]) if height else 0
    if width == 0:
      return []

    max_value = 0
    for row in grid:
      row_max = max(row) if row else 0
      if row_max > max_value:
        max_value = row_max

    if max_value <= 0:
      max_value = 1

    points: List[Dict[str, float]] = []
    for y, row in enumerate(grid):
      for x, value in enumerate(row):
        if value <= 0:
          continue
        points.append(
          {
            "x": (x + 0.5) / width,
            "y": (y + 0.5) / height,
            "intensity": min(1.0, (value / max_value)**0.5),
          }
        )
    return points

  @staticmethod
  def _native(v):
    """Convert numpy scalars to Python native types for JSON safety."""
    if isinstance(v, (np.integer,)):
      return int(v)
    if isinstance(v, (np.floating,)):
      return float(v)
    if isinstance(v, np.ndarray):
      return v.tolist()
    return v

  def _metrics_to_stream(self, metrics: CameraMetrics, timestamp_ms: int) -> Dict[str, object]:
    heatmap_points = self._heatmap_to_points(metrics.heatmap)
    _n = self._native

    # Ensure gender and age_buckets dicts have native int values
    gender = {k: _n(v) for k, v in metrics.gender.items()}
    ages = {k: _n(v) for k, v in metrics.age_buckets.items()}
    gender_by_age = {k: {kk: _n(vv) for kk, vv in v.items()} for k, v in metrics.gender_by_age.items()}

    return {
      "timestamp": timestamp_ms,
      "entries": _n(metrics.people_in),
      "exits": _n(metrics.people_out),
      "current": _n(metrics.current),
      "queue": _n(metrics.queue.current),
      "demographics": {
        "gender": gender,
        "ages": ages,
        "genderByAge": gender_by_age,
      },
      "heatmap": {
        "points": heatmap_points,
        "gridWidth": len(metrics.heatmap[0]) if metrics.heatmap else 0,
        "gridHeight": len(metrics.heatmap),
      },
      "zones": [
        {
          "id": z.id,
          "name": z.name,
          "currentOccupants": _n(z.current_occupants),
          "totalVisitors": _n(z.total_visitors),
          "avgDwellTime": round(float(z.avg_dwell_time), 1)
        } for z in metrics.zones
      ],
      "tables": [
        {
          "id": t.id,
          "name": t.name,
          "status": t.status,
          "currentOccupants": _n(t.current_occupants),
          "avgStaySeconds": round(float(t.avg_stay_seconds), 1),
          "occupancyDuration": round(float(t.occupancy_duration), 1),
          "turnoverCount": _n(t.turnover_count),
        } for t in metrics.tables
      ],
      "fps": round(float(metrics.fps), 1),
    }

  def _build_track_stream(self, now: float) -> List[Dict[str, object]]:
    track_payload: List[Dict[str, object]] = []
    for track_id, person in self.tracks.items():
      age_since_seen = now - person.last_seen
      # Skip tracks unseen for >1.0s — don't send ghost BBoxes to frontend
      if age_since_seen > 1.0:
        continue
      x1, y1, x2, y2 = person.bbox_norm
      width = max(0.0, x2 - x1)
      height = max(0.0, y2 - y1)
      dwell = max(0.0, now - person.first_seen)

      age_bucket = bucket_for_age(person.age)
      age_conf = 0.0
      if person.age_confidence_history:
        age_conf = float(max(person.age_confidence_history))
      payload = {
        "id": f"track_{track_id}",
        "bbox": [float(x1), float(y1), float(width), float(height)],
        "gender": person.gender if person.gender in {"male", "female"} else "unknown",
        "ageBucket": age_bucket if age_bucket != "unknown" else None,
        "age": float(person.age) if person.age is not None else None,
        "dwellSec": float(dwell),
        "state": person.state,
        "isStale": age_since_seen > 0.5,
        "ageConfidence": round(age_conf, 2),
        "genderConfidence": round(float(getattr(person, 'gender_confidence', 0.0)), 2),
        "ageLocked": bool(person.age_locked),
        "genderLocked": bool(getattr(person, 'gender_locked', False)),
      }
      track_payload.append(payload)
    return track_payload

  def _emit_metrics_stream(self, metrics: CameraMetrics, timestamp_ms: int) -> None:
    if self.on_metrics is None:
      return
    payload = self._metrics_to_stream(metrics, timestamp_ms)
    self.on_metrics(payload)

  def _emit_track_stream(self, now: float) -> None:
    if self.on_tracks is None:
      return
    payload = self._build_track_stream(now)
    self.on_tracks(payload)

  def _emit_zone_insights(self, now: float) -> None:
    if self.on_zone_insights is None:
      return
    insights = self._check_zone_insights(now)
    if insights:
      self.on_zone_insights(insights)

  def _apply_privacy_blur(self, frame: np.ndarray, frame_w: int, frame_h: int) -> np.ndarray:
    """
    Apply privacy-preserving blur to faces and bodies (GDPR/KVKK compliant).

    Uses Gaussian blur on detected person bounding boxes to anonymize individuals
    while maintaining tracking and analytics capabilities.
    """
    if not self.privacy_mode:
      return frame

    blurred_frame = frame.copy()

    for person in self.tracks.values():
      x1_norm, y1_norm, x2_norm, y2_norm = person.bbox_norm

      # Convert normalized coords to pixels
      x1 = int(x1_norm * frame_w)
      y1 = int(y1_norm * frame_h)
      x2 = int(x2_norm * frame_w)
      y2 = int(y2_norm * frame_h)

      # Ensure bounds are valid
      x1 = max(0, min(x1, frame_w - 1))
      y1 = max(0, min(y1, frame_h - 1))
      x2 = max(0, min(x2, frame_w))
      y2 = max(0, min(y2, frame_h))

      if x2 > x1 and y2 > y1:
        # Extract ROI (Region of Interest)
        roi = blurred_frame[y1:y2, x1:x2]

        # Apply strong Gaussian blur (kernel size proportional to ROI size)
        blur_size = max(31, min(int((x2 - x1) * 0.3), 99))
        if blur_size % 2 == 0:
          blur_size += 1  # Must be odd

        blurred_roi = cv2.GaussianBlur(roi, (blur_size, blur_size), 0)

        # Optional: Add pixelation effect for stronger anonymization
        # pixelation_factor = 0.1
        # small = cv2.resize(blurred_roi, None, fx=pixelation_factor, fy=pixelation_factor, interpolation=cv2.INTER_LINEAR)
        # blurred_roi = cv2.resize(small, (roi.shape[1], roi.shape[0]), interpolation=cv2.INTER_NEAREST)

        # Replace ROI in frame
        blurred_frame[y1:y2, x1:x2] = blurred_roi

    return blurred_frame

  def _write_metrics(self, metrics: CameraMetrics) -> None:
    self.output_path.parent.mkdir(parents=True, exist_ok=True)

    class _NumpyEncoder(json.JSONEncoder):
      def default(self, obj):
        if isinstance(obj, (np.integer,)):
          return int(obj)
        if isinstance(obj, (np.floating,)):
          return float(obj)
        if isinstance(obj, np.ndarray):
          return obj.tolist()
        return super().default(obj)

    with self.output_path.open("w", encoding="utf-8") as handle:
      json.dump(metrics.to_dict(), handle, indent=2, cls=_NumpyEncoder)

  def _draw_overlay(self, frame: np.ndarray, frame_w: int, frame_h: int) -> np.ndarray:
    # Create semi-transparent overlay for glass effect
    overlay = frame.copy()

    for person in self.tracks.values():
      x1, y1, x2, y2 = person.bbox_norm
      p1 = (int(x1 * frame_w), int(y1 * frame_h))
      p2 = (int(x2 * frame_w), int(y2 * frame_h))
      color = (0, 255, 0) if person.inside else (0, 0, 255)

      # Draw modern bounding box with rounded corners effect
      thickness = 3 if person.inside else 2

      # Main box
      cv2.rectangle(frame, p1, p2, color, thickness)

      # Corner accents (modern look)
      corner_length = 20
      corner_thickness = 4

      # Top-left corner
      cv2.line(frame, p1, (p1[0] + corner_length, p1[1]), color, corner_thickness)
      cv2.line(frame, p1, (p1[0], p1[1] + corner_length), color, corner_thickness)

      # Top-right corner
      cv2.line(frame, (p2[0], p1[1]), (p2[0] - corner_length, p1[1]), color, corner_thickness)
      cv2.line(frame, (p2[0], p1[1]), (p2[0], p1[1] + corner_length), color, corner_thickness)

      # Bottom-left corner
      cv2.line(frame, (p1[0], p2[1]), (p1[0] + corner_length, p2[1]), color, corner_thickness)
      cv2.line(frame, (p1[0], p2[1]), (p1[0], p2[1] - corner_length), color, corner_thickness)

      # Bottom-right corner
      cv2.line(frame, p2, (p2[0] - corner_length, p2[1]), color, corner_thickness)
      cv2.line(frame, p2, (p2[0], p2[1] - corner_length), color, corner_thickness)

      # Create modern label with demographics
      labels = []

      # Track ID (always show)
      labels.append(f"#{person.track_id}")

      # Gender and Age combined (show both or neither to avoid confusion)
      if person.gender != "unknown" and person.age:
        # Show gender with emoji
        gender_emoji = "♂" if person.gender == "male" else "♀"
        gender_display = "M" if person.gender == "male" else "F"
        # Show age as integer
        age_display = int(person.age) if person.age else 0
        labels.append(f"{gender_emoji}{gender_display} {age_display}y")
      elif person.gender != "unknown":
        # Only gender available
        gender_emoji = "♂" if person.gender == "male" else "♀"
        gender_display = "M" if person.gender == "male" else "F"
        labels.append(f"{gender_emoji}{gender_display}")
      elif person.age:
        # Only age available
        age_display = int(person.age) if person.age else 0
        labels.append(f"{age_display}y")

      # Dwell time
      dwell = time.time() - person.first_seen
      if dwell < 60:
        labels.append(f"{int(dwell)}s")
      else:
        labels.append(f"{int(dwell/60)}m{int(dwell%60)}s")

      label = " | ".join(labels)

      # Draw modern label with background
      font = cv2.FONT_HERSHEY_SIMPLEX
      font_scale = 0.6
      text_thickness = 2
      (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, text_thickness)

      # Modern glass background for label
      label_y = max(text_h + 15, p1[1] - 10)
      padding = 8

      # Draw semi-transparent background
      bg_overlay = frame.copy()
      cv2.rectangle(bg_overlay,
                   (p1[0] - padding, label_y - text_h - padding),
                   (p1[0] + text_w + padding, label_y + padding),
                   (20, 20, 40), -1)
      cv2.addWeighted(bg_overlay, 0.7, frame, 0.3, 0, frame)

      # Draw border
      cv2.rectangle(frame,
                   (p1[0] - padding, label_y - text_h - padding),
                   (p1[0] + text_w + padding, label_y + padding),
                   color, 2)

      # Draw text
      cv2.putText(frame, label, (p1[0], label_y), font, font_scale, (255, 255, 255), text_thickness)

    # Only show zones if explicitly requested (for testing/setup)
    if self.show_zones:
      if self.config.entrance_line:
        line = self.config.entrance_line
        start = (int(line.start[0] * frame_w), int(line.start[1] * frame_h))
        end = (int(line.end[0] * frame_w), int(line.end[1] * frame_h))
        cv2.line(frame, start, end, (255, 255, 0), 2)
        cv2.putText(frame, "Entrance", (start[0], start[1] - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)

      for zone in self.zone_definitions.values():
        polygon = [(int(x * frame_w), int(y * frame_h)) for x, y in zone.polygon]
        pts = np.array(polygon, np.int32).reshape((-1, 1, 2))
        cv2.polylines(frame, [pts], True, (255, 0, 0), 2)
        label = zone.name or zone.id
        cv2.putText(
          frame,
          label,
          (polygon[0][0], polygon[0][1] - 5),
          cv2.FONT_HERSHEY_SIMPLEX,
          0.5,
          (255, 0, 0),
          1,
        )

    return frame