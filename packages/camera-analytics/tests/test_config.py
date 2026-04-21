"""Tests for config loading — catches schema drift and YAML typos."""
from __future__ import annotations

from pathlib import Path

import pytest

from camera_analytics.config import AnalyticsConfig, load_config


DEFAULT_CONFIG = Path(__file__).resolve().parents[1] / "config" / "default_zones.yaml"


class TestLoadConfig:
  def test_default_config_loads(self):
    cfg = load_config(DEFAULT_CONFIG)
    assert isinstance(cfg, AnalyticsConfig)

  def test_entrance_line_present(self):
    cfg = load_config(DEFAULT_CONFIG)
    assert cfg.entrance_line is not None
    sx, sy = cfg.entrance_line.start
    ex, ey = cfg.entrance_line.end
    assert 0.0 <= sx <= 1.0 and 0.0 <= sy <= 1.0
    assert 0.0 <= ex <= 1.0 and 0.0 <= ey <= 1.0

  def test_tables_normalized(self):
    cfg = load_config(DEFAULT_CONFIG)
    for table in cfg.tables:
      for x, y in table.polygon:
        assert 0.0 <= x <= 1.0, f"{table.id} polygon x out of range: {x}"
        assert 0.0 <= y <= 1.0, f"{table.id} polygon y out of range: {y}"

  def test_demographic_params_in_range(self):
    cfg = load_config(DEFAULT_CONFIG)
    # EMA alpha must be (0, 1]
    assert 0.0 < cfg.demo_age_ema_alpha <= 1.0
    # Confidence must be [0, 1]
    assert 0.0 <= cfg.demo_min_confidence <= 1.0
    # Consensus must be [0.5, 1.0] to make semantic sense
    assert 0.5 <= cfg.demo_gender_consensus <= 1.0
    # Hysteresis band must be coherent
    assert cfg.demo_gender_lower_band < cfg.demo_gender_upper_band
    # Temporal decay must be (0, 1]
    assert 0.0 < cfg.demo_temporal_decay <= 1.0

  def test_tracking_params_in_range(self):
    cfg = load_config(DEFAULT_CONFIG)
    assert cfg.face_detection_interval >= 1
    assert cfg.zone_enter_debounce_frames >= 1
    assert cfg.zone_exit_debounce_frames >= 1
    assert cfg.bbox_smoothing_alpha_min < cfg.bbox_smoothing_alpha_max
    assert 0.0 < cfg.bbox_smoothing_alpha_min < 1.0
    assert 0.0 < cfg.bbox_smoothing_alpha_max <= 1.0

  def test_table_timeouts_coherent(self):
    cfg = load_config(DEFAULT_CONFIG)
    assert cfg.table_needs_cleaning_timeout > 0
    assert cfg.table_empty_timeout > cfg.table_needs_cleaning_timeout
    assert cfg.table_long_occupancy_alert > cfg.table_needs_cleaning_timeout

  def test_heatmap_reasonable(self):
    cfg = load_config(DEFAULT_CONFIG)
    assert cfg.heatmap.grid_width >= 2
    assert cfg.heatmap.grid_height >= 2
    assert cfg.heatmap.grid_width * cfg.heatmap.grid_height <= 1024  # sanity cap
