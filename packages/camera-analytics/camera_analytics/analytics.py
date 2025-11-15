from __future__ import annotations

import json
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Tuple

import cv2
import numpy as np

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
  bucket_for_age,
  default_age_buckets,
)


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

  # Temporal smoothing for demographics
  age_history: deque = field(default_factory=lambda: deque(maxlen=24))
  gender_history: deque = field(default_factory=lambda: deque(maxlen=24))
  gender_confidence: float = 0.5

  def contains_pixel(self, px: float, py: float) -> bool:
    x1, y1, x2, y2 = self.bbox_norm
    return x1 <= px <= x2 and y1 <= py <= y2

  def update_age(self, new_age: float, max_samples: int = 10) -> None:
    """Update age with temporal smoothing - increased samples for stability"""
    if new_age is None:
      return
    self.age_history.append(float(new_age))
    samples = list(self.age_history)
    if len(samples) >= 3:
      self.age = float(np.median(samples))
    else:
      self.age = float(np.mean(samples))

  def update_gender(self, new_gender: str, max_samples: int = 10) -> None:
    """Update gender with majority voting - increased samples for stability"""
    if not new_gender or new_gender == "unknown":
      return

    self.gender_history.append(new_gender)
    if len(self.gender_history) > max_samples:
      self.gender_history.popleft()

    male_votes = self.gender_history.count("male")
    female_votes = self.gender_history.count("female")

    total_votes = len(self.gender_history)
    if total_votes == 0:
      return

    if male_votes / total_votes >= 0.6:
      self.gender = "male"
    elif female_votes / total_votes >= 0.6:
      self.gender = "female"


class CameraAnalyticsEngine:
  def __init__(
    self,
    config: AnalyticsConfig,
    source: str | int,
    output_path: Path,
    model_path: str = "yolov8n.pt",
    sample_interval: float = 1.0,
    display: bool = False,
    show_zones: bool = False,
    on_metrics: Optional[Callable[[Dict[str, object]], None]] = None,
    on_tracks: Optional[Callable[[List[Dict[str, object]]], None]] = None,
  ) -> None:
    self.config = config
    self.source = source
    self.output_path = output_path
    self.sample_interval = sample_interval
    self.display = display
    self.show_zones = show_zones
    self.on_metrics = on_metrics
    self.on_tracks = on_tracks

    self.model = YOLO(model_path)
    # Optimize YOLO runtime configuration
    try:
      self.model.overrides['verbose'] = False
      self.model.overrides['conf'] = 0.5
      self.model.overrides['iou'] = 0.45
      self.model.overrides['max_det'] = 50
      self.model.overrides['half'] = False
      self.model.overrides['device'] = 'cpu'
    except Exception:  # pragma: no cover - safety guard
      pass

    # Frame skipping for face analysis
    self.face_detection_interval = 10
    self.frame_count = 0

    # Adjust video stride for remote streams to improve stability
    self.vid_stride = 1
    if isinstance(self.source, str):
      source_str = str(self.source)
      if source_str.startswith(("rtsp://", "rtmp://", "http://", "https://")):
        self.vid_stride = 2
        print(f"[INFO] Remote stream detected. Using vid_stride={self.vid_stride} for efficiency")

    if FaceAnalysis is not None:
      try:
        self.face_app = FaceAnalysis(name="buffalo_s", providers=["CPUExecutionProvider"])
        self.face_app.prepare(ctx_id=0, det_size=(320, 320))
        print("[INFO] InsightFace initialized (buffalo_s model)")
      except Exception as err:  # pragma: no cover - runtime-only
        print(f"[WARN] InsightFace initialization failed: {err}. Demographics disabled.")
        self.face_app = None
    else:
      self.face_app = None

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

    # Performance metrics
    self.fps = 0.0
    self.fps_counter = 0
    self.fps_start_time = time.time()

  def run(self) -> None:
    last_write = 0.0

    results = self.model.track(
      source=self.source,
      stream=True,
      verbose=False,
      classes=[0],
      tracker="bytetrack.yaml",
      persist=True,
      imgsz=512,
      device='cpu',
      vid_stride=self.vid_stride,
    )

    print("[INFO] Starting camera analytics pipeline...")
    print(f"[INFO] Face detection interval: every {self.face_detection_interval} frames")
    print(f"[INFO] Video stride: {self.vid_stride} (source: {self.source})")

    try:
      for result in results:
        frame = result.orig_img
        frame_h, frame_w = frame.shape[:2]
        timestamp = time.time()
        self._update_tracks(result, frame_w, frame_h, timestamp)
        self._update_demographics(frame)
        self._emit_track_stream(timestamp)

        self.fps_counter += 1
        if timestamp - self.fps_start_time >= 1.0:
          self.fps = self.fps_counter / (timestamp - self.fps_start_time)
          self.fps_counter = 0
          self.fps_start_time = timestamp

        if self.display:
          annotated = self._draw_overlay(frame.copy(), frame_w, frame_h)
        else:
          annotated = None

        if timestamp - last_write >= self.sample_interval:
          metrics = self._build_metrics()
          self._emit_metrics_stream(metrics, int(timestamp * 1000))
          self._write_metrics(metrics)
          last_write = timestamp

        if self.display and annotated is not None:
          cv2.imshow("ObservAI Camera Analytics", annotated)
          key = cv2.waitKey(1) & 0xFF
          if key in (ord("q"), 27):
            break
    finally:
      if self.display:
        cv2.destroyAllWindows()

  def _update_tracks(self, result, frame_w: int, frame_h: int, now: float) -> None:
    active_ids = set()
    if result.boxes.id is None:
      return

    boxes = result.boxes.xyxy.cpu().numpy()
    track_ids = result.boxes.id.int().cpu().numpy()

    for track_id, box in zip(track_ids, boxes):
      x1, y1, x2, y2 = box.tolist()
      x1_norm, y1_norm = x1 / frame_w, y1 / frame_h
      x2_norm, y2_norm = x2 / frame_w, y2 / frame_h
      center_norm = ((x1_norm + x2_norm) / 2.0, (y1_norm + y2_norm) / 2.0)
      active_ids.add(int(track_id))

      person = self.tracks.get(int(track_id))
      if not person:
        person = TrackedPerson(
          track_id=int(track_id),
          first_seen=now,
          last_seen=now,
          bbox_norm=(x1_norm, y1_norm, x2_norm, y2_norm),
          center_norm=center_norm,
        )
        person.state = "entering"
        self.tracks[int(track_id)] = person
      else:
        person.prev_center_norm = person.center_norm
        person.center_norm = center_norm
        person.bbox_norm = (x1_norm, y1_norm, x2_norm, y2_norm)
        person.last_seen = now

      self._update_inside_state(person, now)
      self._update_zones(person, now)
      self._update_heatmap(person.center_norm)

    self._drop_stale_tracks(active_ids, now)

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
    for zone_id, zone in self.zone_definitions.items():
      inside_zone = point_in_polygon(person.center_norm, zone.polygon)
      is_active = zone_id in person.active_zones

      if inside_zone and not is_active:
        person.active_zones[zone_id] = now
        self.zone_active_members[zone_id][person.track_id] = now
      elif not inside_zone and is_active:
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

  def _update_heatmap(self, center_norm: Tuple[float, float]) -> None:
    row, col = heatmap_bin(
      center_norm, self.config.heatmap.grid_width, self.config.heatmap.grid_height
    )
    self.heatmap[row, col] += 5

  def _drop_stale_tracks(self, active_ids: set[int], now: float, ttl: float = 3.0) -> None:
    for track_id in list(self.tracks.keys()):
      person = self.tracks[track_id]
      if track_id in active_ids:
        continue
      if now - person.last_seen > ttl:
        if person.counted_in and not person.counted_out:
          self.people_out += 1
        self._finalize_active_zones(person, now)
        self.tracks.pop(track_id, None)

  def _update_demographics(self, frame: np.ndarray) -> None:
    if self.face_app is None:
      return

    faces = self.face_app.get(frame)
    if not faces:
      return

    for face in faces:
      bbox = face.bbox.astype(float)
      fx1, fy1, fx2, fy2 = bbox.tolist()
      fcx, fcy = (fx1 + fx2) / 2.0, (fy1 + fy2) / 2.0
      best_track: Optional[TrackedPerson] = None
      best_distance = float("inf")

      for person in self.tracks.values():
        x1, y1, x2, y2 = person.bbox_norm
        px1, py1, px2, py2 = (
          x1 * frame.shape[1],
          y1 * frame.shape[0],
          x2 * frame.shape[1],
          y2 * frame.shape[0],
        )
        if px1 <= fcx <= px2 and py1 <= fcy <= py2:
          center_px = (
            person.center_norm[0] * frame.shape[1],
            person.center_norm[1] * frame.shape[0],
          )
          distance = (fcx - center_px[0]) ** 2 + (fcy - center_px[1]) ** 2
          if distance < best_distance:
            best_track = person
            best_distance = distance

      if best_track and best_distance < 10000:
        # Use temporal smoothing for better accuracy
        if face.age is not None:
          best_track.update_age(float(face.age))
        if hasattr(face, "sex") and face.sex is not None:
          # Handle both old (float) and new (string) InsightFace API
          if isinstance(face.sex, str):
            detected_gender = "male" if face.sex.upper() == 'M' else "female"
          else:
            detected_gender = "male" if float(face.sex) > 0.5 else "female"
          best_track.update_gender(detected_gender)
        elif hasattr(face, "gender") and face.gender is not None:
          detected_gender = "male" if int(face.gender) == 1 else "female"
          best_track.update_gender(detected_gender)

  def _build_metrics(self) -> CameraMetrics:
    # Decay heatmap over time
    self.heatmap *= 0.9

    metrics = CameraMetrics()
    metrics.people_in = self.people_in
    metrics.people_out = self.people_out
    metrics.current = sum(1 for person in self.tracks.values() if person.inside)

    age_buckets = default_age_buckets()
    gender_counts = {"male": 0, "female": 0, "unknown": 0}
    dwell_times: list[float] = []
    active_people: list[ActivePersonSnapshot] = []
    now = time.time()

    for person in self.tracks.values():
      if not person.inside:
        continue

      dwell = now - person.first_seen
      dwell_times.append(dwell)

      if person.gender in gender_counts:
        gender_counts[person.gender] += 1
      else:
        gender_counts["unknown"] += 1

      bucket = bucket_for_age(person.age)
      if bucket != "unknown":
        age_buckets[bucket] += 1

      active_people.append(
        ActivePersonSnapshot(
          id=person.track_id,
          age=person.age,
          age_bucket=bucket if bucket != "unknown" else "unknown",
          gender=person.gender,
          dwell_seconds=dwell,
        )
      )

    metrics.age_buckets = age_buckets
    metrics.gender = gender_counts
    metrics.active_people = active_people
    metrics.avg_dwell_time = float(np.mean(dwell_times)) if dwell_times else 0.0

    if self.queue_id:
      durations = self.zone_completed_durations[self.queue_id]
      active_count = len(self.zone_active_members[self.queue_id])
      avg_wait = float(np.mean(durations)) if durations else 0.0
      longest = float(np.max(durations)) if durations else 0.0
      metrics.queue = QueueSnapshot(active_count, avg_wait, longest)

    table_snapshots: list[TableSnapshot] = []
    for table in self.config.tables:
      durations = self.zone_completed_durations[table.id]
      active = len(self.zone_active_members[table.id])
      avg = float(np.mean(durations)) if durations else 0.0
      longest = float(np.max(durations)) if durations else 0.0
      table_snapshots.append(
        TableSnapshot(
          id=table.id,
          name=table.name,
          current_occupants=active,
          avg_stay_seconds=avg,
          longest_stay_seconds=longest,
        )
      )
    metrics.tables = table_snapshots
    metrics.heatmap = self.heatmap.astype(int).tolist()
    metrics.fps = self.fps
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

  def _metrics_to_stream(self, metrics: CameraMetrics, timestamp_ms: int) -> Dict[str, object]:
    heatmap_points = self._heatmap_to_points(metrics.heatmap)

    return {
      "timestamp": timestamp_ms,
      "entries": metrics.people_in,
      "exits": metrics.people_out,
      "current": metrics.current,
      "queue": metrics.queue.current,
      "demographics": {
        "gender": metrics.gender,
        "ages": metrics.age_buckets,
      },
      "heatmap": {
        "points": heatmap_points,
        "gridWidth": len(metrics.heatmap[0]) if metrics.heatmap else 0,
        "gridHeight": len(metrics.heatmap),
      },
      "fps": round(metrics.fps, 1),
    }

  def _build_track_stream(self, now: float) -> List[Dict[str, object]]:
    track_payload: List[Dict[str, object]] = []
    for track_id, person in self.tracks.items():
      x1, y1, x2, y2 = person.bbox_norm
      width = max(0.0, x2 - x1)
      height = max(0.0, y2 - y1)
      dwell = max(0.0, now - person.first_seen)

      age_bucket = bucket_for_age(person.age)
      payload = {
        "id": f"track_{track_id}",
        "bbox": [float(x1), float(y1), float(width), float(height)],
        "gender": person.gender if person.gender in {"male", "female"} else "unknown",
        "ageBucket": age_bucket if age_bucket != "unknown" else None,
        "dwellSec": dwell,
        "state": person.state,
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

  def _write_metrics(self, metrics: CameraMetrics) -> None:
    self.output_path.parent.mkdir(parents=True, exist_ok=True)
    with self.output_path.open("w", encoding="utf-8") as handle:
      json.dump(metrics.to_dict(), handle, indent=2)

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

      # Gender (with emoji)
      if person.gender != "unknown":
        gender_emoji = "♂" if person.gender == "male" else "♀"
        gender_display = "Male" if person.gender == "male" else "Female"
        labels.append(f"{gender_emoji} {gender_display}")

      # Age (show actual age if available)
      if person.age:
        labels.append(f"Age: {person.age}")
        age_category = bucket_for_age(person.age)
        category_emoji = {
          "child": "👶",
          "teen": "🧒",
          "adult": "👤",
          "senior": "👴"
        }.get(age_category, "❓")
        labels.append(category_emoji)

      # Dwell time
      dwell = time.time() - person.first_seen
      if dwell < 60:
        labels.append(f"⏱ {int(dwell)}s")
      else:
        labels.append(f"⏱ {int(dwell/60)}m {int(dwell%60)}s")

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

    metrics = self._build_metrics()

    # Create glass-morphism stats panel
    panel_x, panel_y = 10, 10
    panel_w, panel_h = 280, 200

    # Draw semi-transparent background
    overlay = frame.copy()
    cv2.rectangle(overlay, (panel_x, panel_y), (panel_x + panel_w, panel_y + panel_h), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)

    # Draw border
    cv2.rectangle(frame, (panel_x, panel_y), (panel_x + panel_w, panel_y + panel_h), (147, 112, 219), 2)

    # Title
    cv2.putText(frame, "LIVE ANALYTICS", (panel_x + 10, panel_y + 25),
               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (147, 112, 219), 2)

    # Stats
    y_offset = panel_y + 50
    line_height = 22

    stats = [
      ("IN", metrics.people_in, (0, 255, 0)),
      ("OUT", metrics.people_out, (0, 100, 255)),
      ("CURRENT", metrics.current, (0, 200, 255)),
      ("QUEUE", metrics.queue.current, (255, 200, 0)),
    ]

    for label, value, color in stats:
      cv2.putText(frame, f"{label}:", (panel_x + 15, y_offset),
                 cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
      cv2.putText(frame, str(value), (panel_x + 120, y_offset),
                 cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
      y_offset += line_height

    # Demographics mini chart
    demo_y = y_offset + 10
    cv2.line(frame, (panel_x + 10, demo_y), (panel_x + panel_w - 10, demo_y), (100, 100, 100), 1)

    demo_y += 15
    cv2.putText(frame, "AGE GROUPS:", (panel_x + 15, demo_y),
               cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)

    demo_y += 18
    age_categories = [
      ("Child", metrics.age_buckets.get("child", 0)),
      ("Teen", metrics.age_buckets.get("teen", 0)),
      ("Adult", metrics.age_buckets.get("adult", 0)),
      ("Senior", metrics.age_buckets.get("senior", 0)),
    ]

    total_people = max(sum(v for _, v in age_categories), 1)

    for cat_name, count in age_categories:
      # Bar chart
      bar_width = int((count / total_people) * (panel_w - 100)) if count > 0 else 0
      cv2.rectangle(frame, (panel_x + 80, demo_y - 10), (panel_x + 80 + bar_width, demo_y + 2),
                   (147, 112, 219), -1)

      cv2.putText(frame, f"{cat_name[:3]}: {count}", (panel_x + 15, demo_y),
                 cv2.FONT_HERSHEY_SIMPLEX, 0.35, (150, 150, 150), 1)
      demo_y += 14

    # Blend overlay
    cv2.addWeighted(overlay, 0.3, frame, 0.7, 0, frame)

    return frame
