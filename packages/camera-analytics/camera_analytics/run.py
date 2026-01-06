from __future__ import annotations

import argparse
from pathlib import Path

from .analytics import CameraAnalyticsEngine
from .config import load_config
from .sources import prepare_source, detect_source_type, SourceType


def parse_args() -> argparse.Namespace:
  default_config = Path(__file__).resolve().parents[1] / "config" / "default_zones.yaml"
  default_output = Path(__file__).resolve().parents[2] / "data" / "camera" / "latest_metrics.json"

  parser = argparse.ArgumentParser(description="Run ObservAI camera analytics pipeline")
  parser.add_argument(
    "--source",
    type=str,
    default="0",
    help="Video source: webcam index (0,1,2...), video file path (.mp4, .avi), "
         "RTSP/RTMP stream URL, YouTube Live URL, or 'screen' for screen capture (default: 0)",
  )
  parser.add_argument(
    "--config",
    type=Path,
    default=default_config,
    help=f"Path to zones configuration (default: {default_config})",
  )
  parser.add_argument(
    "--output",
    type=Path,
    default=default_output,
    help=f"Metrics output JSON file (default: {default_output})",
  )
  parser.add_argument(
    "--model",
    type=str,
    default="yolo11n.pt",
    help="YOLO model checkpoint (default: yolo11n.pt)",
  )
  parser.add_argument(
    "--interval",
    type=float,
    default=1.0,
    help="Number of seconds between metrics dumps (default: 1.0)",
  )
  parser.add_argument(
    "--display",
    action="store_true",
    help="Show annotated video window (press q to quit)",
  )
  return parser.parse_args()


def main() -> None:
  args = parse_args()

  # Prepare source using unified source handler
  try:
    source = prepare_source(args.source, verbose=True)
  except Exception as e:
    print(f"\n❌ Error preparing source: {e}")
    print(f"   Source: {args.source}")
    return

  config = load_config(args.config)
  engine = CameraAnalyticsEngine(
    config=config,
    source=source,
    output_path=args.output,
    model_path=args.model,
    sample_interval=args.interval,
    display=args.display,
  )

  print(f"\n🚀 Starting analytics engine...\n")
  engine.run()


if __name__ == "__main__":
  main()
