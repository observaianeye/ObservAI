from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Tuple

import numpy as np
from shapely.geometry import Point, Polygon

from .config import NormalizedPoint


def denormalize(point: NormalizedPoint, width: int, height: int) -> Tuple[int, int]:
  x = max(0.0, min(1.0, point[0]))
  y = max(0.0, min(1.0, point[1]))
  return int(x * width), int(y * height)


def point_in_polygon(point: Tuple[float, float], polygon: Iterable[Tuple[float, float]]) -> bool:
  poly = Polygon(polygon)
  return poly.contains(Point(point)) or poly.touches(Point(point))


def line_side(point: Tuple[float, float], start: Tuple[float, float], end: Tuple[float, float]) -> float:
  x0, y0 = start
  x1, y1 = end
  x, y = point
  return (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0)


def heatmap_bin(center: Tuple[float, float], grid_w: int, grid_h: int) -> Tuple[int, int]:
  x = np.clip(center[0], 0.0, 1.0 - 1e-9)
  y = np.clip(center[1], 0.0, 1.0 - 1e-9)
  col = int(x * grid_w)
  row = int(y * grid_h)
  return row, col
