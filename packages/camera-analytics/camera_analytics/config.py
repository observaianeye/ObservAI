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

  # Task 2.2.1: Demographic Prediction Improvement parameters
  demo_age_ema_alpha: float = 0.3       # EMA smoothing factor for age (0=slow adapt, 1=instant)
  demo_min_confidence: float = 0.15     # Minimum confidence to accept a demographic prediction
  demo_gender_consensus: float = 0.52   # Gender consensus threshold (fraction of weighted votes)
  demo_max_age_history: int = 30        # Max age samples for temporal smoothing
  demo_max_gender_history: int = 30     # Max gender samples for temporal smoothing
  demo_temporal_decay: float = 0.95     # Decay factor for older gender votes (per sample)
  demo_continuous_refinement: bool = True  # Keep refining demographics even after initial classification

  # Minimum person bounding-box sizes for demographics processing
  demo_min_bbox_width: int = 30   # px – below this, skip face analysis
  demo_min_bbox_height: int = 50  # px – below this, skip face analysis
  # Minimum crop sizes after padding
  demo_min_crop_height: int = 40
  demo_min_crop_width: int = 20

  # Performance: Face detection frequency (every N frames)
  face_detection_interval: int = 10  # CPU: 15-20, GPU: 5-10


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
    # Task 2.2.1: Demographic smoothing params
    demo_age_ema_alpha=float(data.get("demo_age_ema_alpha", 0.3)),
    demo_min_confidence=float(data.get("demo_min_confidence", 0.15)),
    demo_gender_consensus=float(data.get("demo_gender_consensus", 0.52)),
    demo_max_age_history=int(data.get("demo_max_age_history", 30)),
    demo_max_gender_history=int(data.get("demo_max_gender_history", 30)),
    demo_temporal_decay=float(data.get("demo_temporal_decay", 0.95)),
    demo_continuous_refinement=bool(data.get("demo_continuous_refinement", True)),
    # Demographic bounding-box and crop size thresholds
    demo_min_bbox_width=int(data.get("demo_min_bbox_width", 30)),
    demo_min_bbox_height=int(data.get("demo_min_bbox_height", 50)),
    demo_min_crop_height=int(data.get("demo_min_crop_height", 40)),
    demo_min_crop_width=int(data.get("demo_min_crop_width", 20)),
    # Performance: Face detection frequency
    face_detection_interval=int(data.get("face_detection_interval", 10)),
  )
