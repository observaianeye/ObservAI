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

  return AnalyticsConfig(
    entrance_line=entrance_line,
    queue_zone=queue_zone,
    tables=tables,
    heatmap=heatmap,
  )
