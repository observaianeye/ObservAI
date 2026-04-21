"""Stage 2: bbox interpolation helper tests.

Smooth-mode MJPEG calls `CameraAnalyticsEngine.get_interpolated_tracks(now)` at
~60 FPS to draw bboxes between inference ticks. These tests lock in the three
behaviors that matter at display time:

- Two fresh samples → linear extrapolation follows the motion.
- A single sample → freeze at that position (no "snap to origin" bug).
- Long inference gap → stop extrapolating (don't let the bbox fly off-screen).
"""
from __future__ import annotations

import types
from pathlib import Path

import pytest

from camera_analytics.analytics import CameraAnalyticsEngine, TrackedPerson


def _make_engine():
  """Build a minimal object exposing only what `get_interpolated_tracks` needs.

  We avoid instantiating the real engine so the test stays fast and doesn't
  touch YOLO/OpenCV.
  """
  obj = types.SimpleNamespace()
  obj.tracks = {}
  obj.get_interpolated_tracks = types.MethodType(
    CameraAnalyticsEngine.get_interpolated_tracks, obj
  )
  return obj


class TestBboxInterpolation:
  def test_two_samples_extrapolates_toward_motion(self):
    engine = _make_engine()
    p = TrackedPerson(
      track_id=1, first_seen=10.0, last_seen=10.1,
      bbox_norm=(0.5, 0.5, 0.6, 0.6),
    )
    # Track moved +0.1 in x over 100 ms.
    p.bbox_samples.append((10.0, (0.4, 0.5, 0.5, 0.6)))
    p.bbox_samples.append((10.1, (0.5, 0.5, 0.6, 0.6)))
    engine.tracks[1] = p

    # Query 50 ms after the latest sample — expect continued forward motion.
    snaps = engine.get_interpolated_tracks(10.15)
    assert len(snaps) == 1
    bbox = snaps[0]["bbox_norm"]
    # Should land between last sample (0.5..) and linear extrapolation (0.55..).
    assert 0.50 <= bbox[0] <= 0.56, f"x1 extrapolation out of range: {bbox}"

  def test_single_sample_freezes_in_place(self):
    engine = _make_engine()
    p = TrackedPerson(
      track_id=2, first_seen=20.0, last_seen=20.0,
      bbox_norm=(0.3, 0.3, 0.4, 0.4),
    )
    p.bbox_samples.append((20.0, (0.3, 0.3, 0.4, 0.4)))
    engine.tracks[2] = p

    snaps = engine.get_interpolated_tracks(20.05)
    assert snaps[0]["bbox_norm"] == (0.3, 0.3, 0.4, 0.4)

  def test_long_gap_freezes_instead_of_flying_off(self):
    engine = _make_engine()
    p = TrackedPerson(
      track_id=3, first_seen=30.0, last_seen=30.1,
      bbox_norm=(0.5, 0.5, 0.6, 0.6),
    )
    p.bbox_samples.append((30.0, (0.4, 0.5, 0.5, 0.6)))
    p.bbox_samples.append((30.1, (0.5, 0.5, 0.6, 0.6)))
    engine.tracks[3] = p

    # Inference stalled for 500 ms — extrapolation would put the bbox wildly
    # ahead of reality. Helper must freeze at the latest sample.
    snaps = engine.get_interpolated_tracks(30.6)
    assert snaps[0]["bbox_norm"] == (0.5, 0.5, 0.6, 0.6)

  def test_stale_track_dropped(self):
    engine = _make_engine()
    p = TrackedPerson(
      track_id=4, first_seen=40.0, last_seen=40.0,
      bbox_norm=(0.5, 0.5, 0.6, 0.6),
    )
    p.bbox_samples.append((40.0, (0.5, 0.5, 0.6, 0.6)))
    engine.tracks[4] = p

    # >1s past the freeze threshold → snapshot omits the track entirely.
    snaps = engine.get_interpolated_tracks(42.0)
    assert snaps == []
