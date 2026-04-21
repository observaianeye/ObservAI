"""Pure-function tests for metrics module — no GPU, fast."""
from __future__ import annotations

import json

import numpy as np
import pytest

from camera_analytics.metrics import (
  BenchmarkMetrics,
  CameraMetrics,
  QueueSnapshot,
  TableSnapshot,
  ZoneSnapshot,
  bucket_for_age,
  default_age_buckets,
  _to_native,
)


class TestBucketForAge:
  @pytest.mark.parametrize(
    "age,expected",
    [
      (None, "unknown"),
      (5, "0-17"),
      (17, "0-17"),
      (18, "18-24"),
      (24, "18-24"),
      (25, "25-34"),
      (34, "25-34"),
      (35, "35-44"),
      (55, "55-64"),
      (64, "55-64"),
      (65, "65+"),
      (99, "65+"),
    ],
  )
  def test_buckets(self, age, expected):
    assert bucket_for_age(age) == expected

  def test_accepts_float(self):
    assert bucket_for_age(25.4) == "25-34"


class TestToNative:
  def test_numpy_int(self):
    assert _to_native(np.int64(42)) == 42
    assert isinstance(_to_native(np.int64(42)), int)

  def test_numpy_float(self):
    assert _to_native(np.float32(3.14)) == pytest.approx(3.14, abs=1e-4)
    assert isinstance(_to_native(np.float32(3.14)), float)

  def test_numpy_array(self):
    arr = np.array([[1, 2], [3, 4]])
    assert _to_native(arr) == [[1, 2], [3, 4]]

  def test_native_passthrough(self):
    assert _to_native(42) == 42
    assert _to_native("hello") == "hello"
    assert _to_native(None) is None


class TestDefaultAgeBuckets:
  def test_all_buckets_present(self):
    buckets = default_age_buckets()
    assert set(buckets.keys()) == {
      "0-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"
    }
    assert all(v == 0 for v in buckets.values())


class TestCameraMetricsSerialization:
  def test_empty_metrics_serializable(self):
    m = CameraMetrics()
    d = m.to_dict()
    # Must round-trip through JSON without TypeError
    json.dumps(d)
    assert d["peopleIn"] == 0
    assert d["current"] == 0
    assert "ageBuckets" in d
    assert "gender" in d

  def test_metrics_with_numpy_fps_rounded(self):
    # fps is explicitly round()-ed in to_dict, so numpy floats become native
    m = CameraMetrics(fps=np.float32(29.5), avg_dwell_time=np.float32(12.3))
    d = m.to_dict()
    s = json.dumps(d)
    assert '"fps": 29.5' in s
    assert '"avgDwellTime": 12.3' in s

  def test_zone_snapshot_round_trip(self):
    m = CameraMetrics(
      zones=[ZoneSnapshot(id="z1", name="Entry", current_occupants=4, total_visitors=10, avg_dwell_time=12.5)]
    )
    d = m.to_dict()
    json.dumps(d)
    assert d["zones"][0]["id"] == "z1"
    assert d["zones"][0]["currentOccupants"] == 4

  def test_table_snapshot_round_trip(self):
    m = CameraMetrics(
      tables=[TableSnapshot(
        id="t1", name="Masa 1", current_occupants=3,
        avg_stay_seconds=300.0, longest_stay_seconds=1200.0,
        status="occupied", occupancy_duration=60.0, turnover_count=2,
      )]
    )
    d = m.to_dict()
    json.dumps(d)
    assert d["tables"][0]["status"] == "occupied"
    assert d["tables"][0]["currentOccupants"] == 3


class TestBenchmarkMetrics:
  def test_default_fields(self):
    b = BenchmarkMetrics()
    assert b.duration_s == 0.0
    assert b.fps_mean == 0.0
    assert b.zone_count_delta_mean is None
    assert b.gender_f1 is None

  def test_serialization_none_fields(self):
    b = BenchmarkMetrics(duration_s=30.5, fps_mean=55.2, source="webcam")
    d = b.to_dict()
    s = json.dumps(d)
    assert '"duration_s": 30.5' in s
    assert '"zone_count_delta_mean": null' in s
    assert '"gender_f1": null' in s

  def test_populated_fields_round_trip(self):
    b = BenchmarkMetrics(
      duration_s=60.0,
      frames_processed=1800,
      fps_mean=30.0,
      fps_p95=32.5,
      fps_min=20.1,
      inference_fps_mean=22.0,
      inference_fps_p95=24.0,
      id_churn_rate=1.15,
      unique_track_ids=23,
      max_concurrent_persons=20,
      zone_count_delta_mean=0.3,
      gender_f1=0.87,
      age_mae=5.5,
      source="test.mp4",
      model="yolo11l.pt",
      config_path="config/default_zones.yaml",
    )
    d = b.to_dict()
    s = json.dumps(d)
    assert '"fps_mean": 30.0' in s
    assert '"id_churn_rate": 1.15' in s
    assert '"gender_f1": 0.87' in s
