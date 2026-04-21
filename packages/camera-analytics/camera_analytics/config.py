from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

import yaml

NormalizedPoint = Tuple[float, float]


@dataclass
class EntranceLine:
  start: NormalizedPoint
  end: NormalizedPoint
  inside_on: str = "top"


@dataclass
class Zone:
  id: str
  polygon: List[NormalizedPoint]
  name: Optional[str] = None


@dataclass
class HeatmapConfig:
  grid_width: int = 6
  grid_height: int = 4


@dataclass
class AnalyticsConfig:
  entrance_line: Optional[EntranceLine] = None
  queue_zone: Optional[Zone] = None
  tables: List[Zone] = field(default_factory=list)
  heatmap: HeatmapConfig = field(default_factory=HeatmapConfig)
  confidence_threshold: float = 0.5
  snapshot_interval: float = 0.0
  privacy_mode: bool = False  # GDPR/KVKK compliance: blur faces/bodies in streams

  # Task 2.1.2: YOLO Model Optimization parameters
  nms_iou_threshold: float = 0.45      # NMS IoU threshold (lower = stricter dedup, faster)
  yolo_input_size: Optional[int] = None # Override YOLO input size (None = auto from hardware)
  agnostic_nms: bool = True             # Class-agnostic NMS (faster for single-class person detection)
  max_detections: int = 100             # Max detections per frame (crowded scene support)

  # Task 2.2.1: Demographic Prediction Improvement parameters (Stage 3 tuned)
  demo_age_ema_alpha: float = 0.20      # EMA smoothing factor for age (lower = more stable)
  demo_min_confidence: float = 0.35     # Minimum confidence to accept a demographic prediction
  demo_gender_consensus: float = 0.70   # Gender consensus threshold (fraction of weighted votes)
  demo_max_age_history: int = 80        # Max age samples for temporal smoothing
  demo_max_gender_history: int = 80     # Max gender samples for temporal smoothing
  demo_temporal_decay: float = 0.90     # Decay factor for older gender votes
  demo_continuous_refinement: bool = True  # Keep refining demographics even after initial classification
  demo_gender_lock_threshold: int = 6     # Lock gender after N consecutive same-gender high-confidence votes
  demo_gender_lower_band: float = 0.35    # Gender prob below this = female (hysteresis band)
  demo_gender_upper_band: float = 0.65    # Gender prob above this = male (hysteresis band)
  demo_ambiguous_recovery: bool = False   # Stage 3: salvage hysteresis-band samples via majority fallback
  demo_ambiguous_recent_votes: int = 3    # Min recent vote history required for fallback

  # Minimum person bounding-box sizes for demographics processing
  demo_min_bbox_width: int = 25   # px – below this, skip face analysis
  demo_min_bbox_height: int = 40  # px – below this, skip face analysis
  # Minimum crop sizes after padding
  demo_min_crop_height: int = 30
  demo_min_crop_width: int = 20

  # Performance: Face detection frequency (every N frames)
  face_detection_interval: int = 3   # RTX 5070: every 3 frames (good FPS on crowded scenes)

  # Queue analytics
  queue_alert_threshold: int = 5
  queue_wait_time_window: int = 300

  # Zone entry/exit debounce (frame count) — Stage 4 tuned
  zone_enter_debounce_frames: int = 5
  zone_exit_debounce_frames: int = 10
  # Stage 4: occlusion grace for zone members (seconds)
  zone_grace_period_s: float = 3.0
  # Stage 4: enable occlusion-grace reconciler. OFF by default — flip on after
  # zone count accuracy validated against ground truth fixtures.
  zone_occlusion_grace_enabled: bool = True
  # Stage 4: default table occupant clamp (applies to TABLE zones with no explicit
  # max_capacity). Clamp is enforced only when enabled to allow safe rollback.
  table_max_capacity: int = 6
  table_capacity_clamp_enabled: bool = True

  # Bbox smoothing EMA alpha range
  bbox_smoothing_alpha_min: float = 0.2
  bbox_smoothing_alpha_max: float = 0.9

  # Table occupancy tracking (v2 — proper state machine)
  # Legacy fields kept for backward compat (no longer primary; see new fields below)
  table_needs_cleaning_timeout: float = 60.0
  table_empty_timeout: float = 180.0
  table_long_occupancy_alert: float = 5400.0   # 90 min → alert "check on table"

  # v2: proper occupied → empty-buffer → needs_cleaning → empty flow
  table_min_occupied_duration: float = 60.0    # Min seconds table must be occupied before cleaning is triggered (transient passers-by don't count)
  table_cleaning_empty_threshold: float = 120.0  # Seconds of empty after occupancy → mark needs_cleaning (user's "2 min" rule)
  table_auto_empty_timeout: float = 900.0      # Auto-transition needs_cleaning → empty after 15 min (staff forgot)
  table_transit_grace: float = 10.0            # <N seconds empty during occupancy = ignore (chair shuffle, bathroom trip)

  # Post-NMS overlap filtering
  post_nms_containment_thresh: float = 0.70  # Suppress nested bbox if containment > this
  post_nms_iou_merge_thresh: float = 0.60    # Suppress overlapping bbox if IoU > this

  # Demographics freeze thresholds (Stage 3 tuned)
  demo_age_lock_stability: float = 0.92   # Age stability required to lock (live cams rarely hit 0.95)
  demo_age_lock_min_samples: int = 20     # Minimum samples before age can lock
  demo_pose_max_yaw: float = 70.0         # Max face yaw (deg) for gender decision (was 55, relaxed for more coverage)

  # Track persistence
  track_stale_ttl: float = 4.0  # Seconds before dropping unseen tracks


def _load_normalized_point(raw: Sequence[float]) -> NormalizedPoint:
  if len(raw) != 2:
    raise ValueError(f"Expected point with length 2, got {raw}")
  x, y = float(raw[0]), float(raw[1])
  return x, y


def _load_zone(zone_id: str, raw_zone: dict) -> Zone:
  polygon_raw = raw_zone.get("polygon")
  if not polygon_raw:
    raise ValueError(f"Zone {zone_id} is missing polygon definition")
  polygon = [_load_normalized_point(pt) for pt in polygon_raw]
  return Zone(
    id=raw_zone.get("id", zone_id),
    name=raw_zone.get("name"),
    polygon=polygon,
  )


def load_config(path: Path) -> AnalyticsConfig:
  data = yaml.safe_load(path.read_text())
  entrance_line = None
  if "entrance_line" in data:
    raw = data["entrance_line"]
    entrance_line = EntranceLine(
      start=_load_normalized_point(raw["start"]),
      end=_load_normalized_point(raw["end"]),
      inside_on=str(raw.get("inside_on", "top")).lower(),
    )

  queue_zone = None
  if "queue_zone" in data and data["queue_zone"]:
    queue_zone = _load_zone("queue", data["queue_zone"])

  tables: List[Zone] = []
  for idx, raw_zone in enumerate(data.get("tables", []), start=1):
    zone_id = raw_zone.get("id") or f"table-{idx}"
    tables.append(_load_zone(zone_id, raw_zone))

  heatmap_raw = data.get("heatmap", {})
  heatmap = HeatmapConfig(
    grid_width=int(heatmap_raw.get("grid_width", 6)),
    grid_height=int(heatmap_raw.get("grid_height", 4)),
  )

  # Task 2.1.2: YOLO optimization params from config
  yolo_input_size_raw = data.get("yolo_input_size", None)
  yolo_input_size = int(yolo_input_size_raw) if yolo_input_size_raw is not None else None

  return AnalyticsConfig(
    entrance_line=entrance_line,
    queue_zone=queue_zone,
    tables=tables,
    heatmap=heatmap,
    confidence_threshold=float(data.get("confidence_threshold", 0.5)),
    snapshot_interval=float(data.get("snapshot_interval", 0.0)),
    privacy_mode=bool(data.get("privacy_mode", False)),
    nms_iou_threshold=float(data.get("nms_iou_threshold", 0.45)),
    yolo_input_size=yolo_input_size,
    agnostic_nms=bool(data.get("agnostic_nms", True)),
    max_detections=int(data.get("max_detections", 100)),
    # Task 2.2.1: Demographic smoothing params (Stage 3 tuned)
    demo_age_ema_alpha=float(data.get("demo_age_ema_alpha", 0.20)),
    demo_min_confidence=float(data.get("demo_min_confidence", 0.35)),
    demo_gender_consensus=float(data.get("demo_gender_consensus", 0.70)),
    demo_max_age_history=int(data.get("demo_max_age_history", 80)),
    demo_max_gender_history=int(data.get("demo_max_gender_history", 80)),
    demo_temporal_decay=float(data.get("demo_temporal_decay", 0.90)),
    demo_continuous_refinement=bool(data.get("demo_continuous_refinement", True)),
    demo_gender_lock_threshold=int(data.get("demo_gender_lock_threshold", 6)),
    demo_gender_lower_band=float(data.get("demo_gender_lower_band", 0.35)),
    demo_gender_upper_band=float(data.get("demo_gender_upper_band", 0.65)),
    demo_ambiguous_recovery=bool(data.get("demo_ambiguous_recovery", False)),
    demo_ambiguous_recent_votes=int(data.get("demo_ambiguous_recent_votes", 3)),
    # Demographic bounding-box and crop size thresholds
    demo_min_bbox_width=int(data.get("demo_min_bbox_width", 25)),
    demo_min_bbox_height=int(data.get("demo_min_bbox_height", 40)),
    demo_min_crop_height=int(data.get("demo_min_crop_height", 30)),
    demo_min_crop_width=int(data.get("demo_min_crop_width", 20)),
    # Performance: Face detection frequency
    face_detection_interval=int(data.get("face_detection_interval", 3)),
    # Queue analytics
    queue_alert_threshold=int(data.get("queue_alert_threshold", 5)),
    queue_wait_time_window=int(data.get("queue_wait_time_window", 300)),
    # Zone entry/exit debounce — Stage 4 tuned
    zone_enter_debounce_frames=int(data.get("zone_enter_debounce_frames", 5)),
    zone_exit_debounce_frames=int(data.get("zone_exit_debounce_frames", 10)),
    zone_grace_period_s=float(data.get("zone_grace_period_s", 3.0)),
    zone_occlusion_grace_enabled=bool(data.get("zone_occlusion_grace_enabled", True)),
    table_max_capacity=int(data.get("table_max_capacity", 6)),
    table_capacity_clamp_enabled=bool(data.get("table_capacity_clamp_enabled", True)),
    # Bbox smoothing
    bbox_smoothing_alpha_min=float(data.get("bbox_smoothing_alpha_min", 0.2)),
    bbox_smoothing_alpha_max=float(data.get("bbox_smoothing_alpha_max", 0.9)),
    # Table occupancy tracking (v2)
    table_needs_cleaning_timeout=float(data.get("table_needs_cleaning_timeout", 60.0)),
    table_empty_timeout=float(data.get("table_empty_timeout", 180.0)),
    table_long_occupancy_alert=float(data.get("table_long_occupancy_alert", 5400.0)),
    table_min_occupied_duration=float(data.get("table_min_occupied_duration", 60.0)),
    table_cleaning_empty_threshold=float(data.get("table_cleaning_empty_threshold", 120.0)),
    table_auto_empty_timeout=float(data.get("table_auto_empty_timeout", 900.0)),
    table_transit_grace=float(data.get("table_transit_grace", 10.0)),
    # Post-NMS overlap filtering
    post_nms_containment_thresh=float(data.get("post_nms_containment_thresh", 0.70)),
    post_nms_iou_merge_thresh=float(data.get("post_nms_iou_merge_thresh", 0.60)),
    # Demographics freeze (Stage 3 tuned)
    demo_age_lock_stability=float(data.get("demo_age_lock_stability", 0.92)),
    demo_age_lock_min_samples=int(data.get("demo_age_lock_min_samples", 20)),
    demo_pose_max_yaw=float(data.get("demo_pose_max_yaw", 70.0)),
    # Track persistence
    track_stale_ttl=float(data.get("track_stale_ttl", 4.0)),
  )
