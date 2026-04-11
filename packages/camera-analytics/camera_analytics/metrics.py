from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

import numpy as np


def _to_native(val):
  """Convert numpy types to native Python types for JSON serialization."""
  if isinstance(val, (np.integer,)):
    return int(val)
  if isinstance(val, (np.floating,)):
    return float(val)
  if isinstance(val, np.ndarray):
    return val.tolist()
  return val


def default_age_buckets() -> Dict[str, int]:
  return {
    "0-17": 0,
    "18-24": 0,
    "25-34": 0,
    "35-44": 0,
    "45-54": 0,
    "55-64": 0,
    "65+": 0,
  }


def bucket_for_age(age: Optional[float]) -> str:
  """
  Categorize age into granular ranges:
  - 0-17
  - 18-24
  - 25-34
  - 35-44
  - 45-54
  - 55-64
  - 65+
  """
  if age is None:
    return "unknown"
  age_val = float(age)
  if age_val < 18:
    return "0-17"
  if age_val < 25:
    return "18-24"
  if age_val < 35:
    return "25-34"
  if age_val < 45:
    return "35-44"
  if age_val < 55:
    return "45-54"
  if age_val < 65:
    return "55-64"
  return "65+"


@dataclass
class TableSnapshot:
  id: str
  name: Optional[str]
  current_occupants: int
  avg_stay_seconds: float
  longest_stay_seconds: float
  status: str = "empty"           # "empty" | "occupied" | "needs_cleaning"
  occupancy_duration: float = 0.0  # seconds since current occupancy began
  turnover_count: int = 0          # number of occupy→leave cycles


@dataclass
class QueueSnapshot:
  current: int
  average_wait_seconds: float
  longest_wait_seconds: float
  longest_current_wait_seconds: float = 0.0
  peak_count: int = 0
  throughput_per_minute: float = 0.0


@dataclass
class ZoneSnapshot:
  id: str
  name: str
  current_occupants: int
  total_visitors: int
  avg_dwell_time: float


@dataclass
class ActivePersonSnapshot:
  id: int
  age: Optional[float]
  age_bucket: str
  gender: str
  dwell_seconds: float


@dataclass
class CameraMetrics:
  people_in: int = 0
  people_out: int = 0
  current: int = 0
  age_buckets: Dict[str, int] = field(default_factory=default_age_buckets)
  gender: Dict[str, int] = field(default_factory=lambda: {"male": 0, "female": 0, "unknown": 0})
  gender_by_age: Dict[str, Dict[str, int]] = field(default_factory=dict)
  queue: QueueSnapshot = field(default_factory=lambda: QueueSnapshot(0, 0.0, 0.0))
  zones: List[ZoneSnapshot] = field(default_factory=list)
  tables: List[TableSnapshot] = field(default_factory=list)
  heatmap: List[List[int]] = field(default_factory=list)
  active_people: List[ActivePersonSnapshot] = field(default_factory=list)
  ts: str = field(default_factory=lambda: datetime.utcnow().isoformat())
  fps: float = 0.0
  avg_dwell_time: float = 0.0
  # Task 2.1.1: Async pipeline per-thread FPS
  capture_fps: float = 0.0
  inference_fps: float = 0.0

  def to_dict(self) -> Dict[str, object]:
    return {
      "ts": self.ts,
      "peopleIn": self.people_in,
      "peopleOut": self.people_out,
      "current": self.current,
      "ageBuckets": self.age_buckets,
      "gender": self.gender,
      "genderByAge": self.gender_by_age,
      "queue": {
        "current": self.queue.current,
        "averageWaitSeconds": round(self.queue.average_wait_seconds, 1),
        "longestWaitSeconds": round(self.queue.longest_wait_seconds, 1),
      },
      "zones": [
        {
          "id": zone.id,
          "name": zone.name,
          "currentOccupants": zone.current_occupants,
          "totalVisitors": zone.total_visitors,
          "avgDwellTime": round(zone.avg_dwell_time, 1),
        }
        for zone in self.zones
      ],
      "tables": [
        {
          "id": table.id,
          "name": table.name,
          "currentOccupants": table.current_occupants,
          "avgStaySeconds": round(table.avg_stay_seconds, 1),
          "longestStaySeconds": round(table.longest_stay_seconds, 1),
          "status": table.status,
          "occupancyDuration": round(table.occupancy_duration, 1),
          "turnoverCount": table.turnover_count,
        }
        for table in self.tables
      ],
      "heatmap": _to_native(self.heatmap) if hasattr(self.heatmap, 'tolist') else self.heatmap,
      "activePeople": [
        {
          "id": int(person.id),
          "age": _to_native(person.age),
          "ageBucket": person.age_bucket,
          "gender": person.gender,
          "dwellSeconds": round(float(person.dwell_seconds), 1),
        }
        for person in self.active_people
      ],
      "fps": round(float(self.fps), 1),
      "avgDwellTime": round(float(self.avg_dwell_time), 1),
      "captureFps": round(float(self.capture_fps), 1),
      "inferenceFps": round(float(self.inference_fps), 1),
    }
