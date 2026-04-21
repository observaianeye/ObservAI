"""Tests for geometry helpers — point-in-polygon, line side, heatmap binning."""
from __future__ import annotations

import pytest

from camera_analytics.geometry import denormalize, heatmap_bin, line_side, point_in_polygon


class TestPointInPolygon:
  def test_simple_square_inside(self):
    poly = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    assert point_in_polygon((0.5, 0.5), poly)

  def test_simple_square_outside(self):
    poly = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    assert not point_in_polygon((1.5, 0.5), poly)
    assert not point_in_polygon((0.5, -0.1), poly)

  def test_touching_edge(self):
    poly = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    # shapely touches-or-contains; edge counts as inside
    assert point_in_polygon((0.5, 0.0), poly)

  def test_irregular_polygon(self):
    poly = [(0.1, 0.1), (0.5, 0.2), (0.7, 0.5), (0.4, 0.8), (0.2, 0.5)]
    assert point_in_polygon((0.4, 0.4), poly)
    assert not point_in_polygon((0.95, 0.95), poly)


class TestLineSide:
  def test_horizontal_line_above(self):
    # Line from (0,0) → (1,0); point (0.5, 0.5) is above
    assert line_side((0.5, 0.5), (0.0, 0.0), (1.0, 0.0)) > 0

  def test_horizontal_line_below(self):
    assert line_side((0.5, -0.5), (0.0, 0.0), (1.0, 0.0)) < 0

  def test_point_on_line(self):
    assert line_side((0.5, 0.0), (0.0, 0.0), (1.0, 0.0)) == 0

  def test_side_flips_when_line_reversed(self):
    s1 = line_side((0.5, 0.5), (0.0, 0.0), (1.0, 0.0))
    s2 = line_side((0.5, 0.5), (1.0, 0.0), (0.0, 0.0))
    assert s1 * s2 < 0


class TestHeatmapBin:
  def test_top_left_corner(self):
    row, col = heatmap_bin((0.0, 0.0), grid_w=10, grid_h=10)
    assert (row, col) == (0, 0)

  def test_bottom_right_corner_clamped(self):
    # Normalized (1.0, 1.0) should clamp to last cell — never produce out-of-range index
    row, col = heatmap_bin((1.0, 1.0), grid_w=6, grid_h=4)
    assert 0 <= row < 4
    assert 0 <= col < 6
    assert (row, col) == (3, 5)

  def test_midpoint(self):
    row, col = heatmap_bin((0.5, 0.5), grid_w=10, grid_h=10)
    assert (row, col) == (5, 5)

  def test_various_grid_sizes(self):
    # Ensure no ValueError for any reasonable grid/point combo
    for gw in [1, 2, 6, 10, 32]:
      for gh in [1, 2, 4, 10, 32]:
        for x in [0.0, 0.25, 0.5, 0.75, 0.999]:
          for y in [0.0, 0.25, 0.5, 0.75, 0.999]:
            row, col = heatmap_bin((x, y), grid_w=gw, grid_h=gh)
            assert 0 <= row < gh
            assert 0 <= col < gw


class TestDenormalize:
  def test_basic(self):
    assert denormalize((0.5, 0.5), 1920, 1080) == (960, 540)

  def test_clamp_low(self):
    assert denormalize((-0.1, -0.5), 640, 480) == (0, 0)

  def test_clamp_high(self):
    assert denormalize((1.5, 2.0), 640, 480) == (640, 480)
