from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional


def default_age_buckets() -> Dict[str, int]:
  return {"child": 0, "young": 0, "adult": 0, "mature": 0, "senior": 0}


def bucket_for_age(age: Optional[float]) -> str:
  """
  Categorize age into meaningful life stages:
  - child: 0-17 (Çocuk)
  - young: 18-35 (Genç)
  - adult: 36-50 (Orta yaş)
  - mature: 51-70 (Deneyimli)
  - senior: 70+ (İleri yaş)
  """
  if age is None:
    return "unknown"
  age_val = float(age)
  if age_val < 18:
    return "child"
  if age_val < 36:
    return "young"
  if age_val < 51:
    return "adult"
  if age_val < 71:
    return "mature"
  return "senior"


@dataclass
class TableSnapshot:
  id: str
  name: Optional[str]
  current_occupants: int
  avg_stay_seconds: float
  longest_stay_seconds: float


@dataclass
class QueueSnapshot:
  current: int
  average_wait_seconds: float
  longest_wait_seconds: float


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
  queue: QueueSnapshot = field(default_factory=lambda: QueueSnapshot(0, 0.0, 0.0))
  tables: List[TableSnapshot] = field(default_factory=list)
  heatmap: List[List[int]] = field(default_factory=list)
  active_people: List[ActivePersonSnapshot] = field(default_factory=list)
  ts: str = field(default_factory=lambda: datetime.utcnow().isoformat())
  fps: float = 0.0
  avg_dwell_time: float = 0.0

  def to_dict(self) -> Dict[str, object]:
    return {
      "ts": self.ts,
      "peopleIn": self.people_in,
      "peopleOut": self.people_out,
      "current": self.current,
      "ageBuckets": self.age_buckets,
      "gender": self.gender,
      "queue": {
        "current": self.queue.current,
        "averageWaitSeconds": round(self.queue.average_wait_seconds, 1),
        "longestWaitSeconds": round(self.queue.longest_wait_seconds, 1),
      },
      "tables": [
        {
          "id": table.id,
          "name": table.name,
          "currentOccupants": table.current_occupants,
          "avgStaySeconds": round(table.avg_stay_seconds, 1),
          "longestStaySeconds": round(table.longest_stay_seconds, 1),
        }
        for table in self.tables
      ],
      "heatmap": self.heatmap,
      "activePeople": [
        {
          "id": person.id,
          "age": person.age,
          "ageBucket": person.age_bucket,
          "gender": person.gender,
          "dwellSeconds": round(person.dwell_seconds, 1),
        }
        for person in self.active_people
      ],
      "fps": round(self.fps, 1),
      "avgDwellTime": round(self.avg_dwell_time, 1),
    }
