"""Shared pytest fixtures for camera-analytics tests.

Fixtures provided:
- `gpu_available`: skip tests when CUDA is not available
- `synthetic_video`: auto-generated 3-second mp4 with moving rectangles (no Git LFS)
- `mozart_cafe_1`: real fixture path, skips test if missing
- `fixtures_dir`: absolute path to tests/fixtures

Design: real cafe videos are huge and not in git. Synthetic fixtures cover
pipeline-level behavior (tracking, zone counting, bbox smoothing) without
needing real footage. Real-footage tests are gated behind @pytest.mark.fixture_video.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator

import numpy as np
import pytest


FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def fixtures_dir() -> Path:
  FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
  return FIXTURES_DIR


@pytest.fixture(scope="session")
def gpu_available() -> bool:
  """Return True if CUDA is available via PyTorch."""
  try:
    import torch  # type: ignore
    return bool(torch.cuda.is_available())
  except Exception:
    return False


@pytest.fixture(scope="session")
def synthetic_video(fixtures_dir: Path) -> Path:
  """Generate a small synthetic mp4 with 3 moving rectangles (≈person-sized).

  Frames: 90 (3 seconds at 30fps) at 640x480.
  Content: 3 filled rectangles moving linearly — simulates tracked persons.
  Written once per test session and cached.
  """
  import cv2  # type: ignore

  out_path = fixtures_dir / "synthetic_3persons.mp4"
  if out_path.exists() and out_path.stat().st_size > 0:
    return out_path

  width, height, fps, total_frames = 640, 480, 30, 90
  # mp4v is the most portable fourcc across platforms/OpenCV builds
  fourcc = cv2.VideoWriter_fourcc(*"mp4v")
  writer = cv2.VideoWriter(str(out_path), fourcc, fps, (width, height))
  if not writer.isOpened():
    pytest.skip("OpenCV cannot write mp4v — skipping synthetic video tests")

  rng = np.random.default_rng(42)
  # 3 "people" with varying start positions and velocities
  persons = [
    {"x": 50, "y": 100, "vx": 4, "vy": 0, "color": (0, 255, 0)},
    {"x": 200, "y": 200, "vx": -2, "vy": 1, "color": (0, 0, 255)},
    {"x": 400, "y": 300, "vx": 3, "vy": -1, "color": (255, 0, 0)},
  ]

  try:
    for _ in range(total_frames):
      frame = np.zeros((height, width, 3), dtype=np.uint8)
      # light background noise so YOLO doesn't treat it as pure solid
      frame += rng.integers(0, 40, size=frame.shape, dtype=np.uint8)
      for p in persons:
        x, y = int(p["x"]), int(p["y"])
        cv2.rectangle(frame, (x, y), (x + 40, y + 100), p["color"], -1)
        p["x"] = max(0, min(width - 40, p["x"] + p["vx"]))
        p["y"] = max(0, min(height - 100, p["y"] + p["vy"]))
      writer.write(frame)
  finally:
    writer.release()

  return out_path


def _maybe_fixture(name: str) -> Path:
  return FIXTURES_DIR / name


@pytest.fixture(scope="session")
def mozart_cafe_1() -> Path:
  """Mozart Cafe 1 short clip; skip test if not present."""
  path = _maybe_fixture("mozart_cafe_1_short.mp4")
  if not path.exists():
    pytest.skip(f"{path} missing — place a 30s clip there to run this test")
  return path


@pytest.fixture(scope="session")
def mozart_cafe_2() -> Path:
  path = _maybe_fixture("mozart_cafe_2_short.mp4")
  if not path.exists():
    pytest.skip(f"{path} missing — place a 30s clip there to run this test")
  return path


@pytest.fixture(autouse=True)
def _isolate_cuda_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
  """Avoid tests polluting each other's CUDA context selection."""
  # Keep test runs deterministic around CUDA device ordering
  if "CUDA_VISIBLE_DEVICES" not in os.environ:
    monkeypatch.setenv("CUDA_VISIBLE_DEVICES", "0")
  yield
