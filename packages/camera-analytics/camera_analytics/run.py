from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from .analytics import CameraAnalyticsEngine
from .config import load_config


def get_live_stream_url(url: str) -> str:
  """Extract direct stream URL from YouTube/Twitch/etc using yt-dlp or streamlink"""

  # Check if it's already a direct stream URL
  if url.startswith('rtsp://') or url.startswith('rtmp://') or url.endswith('.m3u8'):
    return url

  print(f"\n🔍 Detecting live stream format...")

  # Try yt-dlp first (better for YouTube) - for live streams use 95 format (best video only)
  try:
    print("   Trying yt-dlp...")
    result = subprocess.run(
      ['yt-dlp', '-f', '95/96/best', '-g', url],
      capture_output=True,
      text=True,
      timeout=15
    )
    if result.returncode == 0 and result.stdout.strip():
      stream_url = result.stdout.strip().split('\n')[0]  # Take first URL if multiple
      print(f"   ✓ Found stream using yt-dlp")
      return stream_url
    else:
      if result.stderr:
        print(f"   yt-dlp error: {result.stderr[:200]}")
  except FileNotFoundError:
    print("   ⚠️  yt-dlp not found. Install with: brew install yt-dlp")
  except subprocess.TimeoutExpired:
    print("   ⚠️  yt-dlp timeout")

  # Try streamlink (better for Twitch)
  try:
    print("   Trying streamlink...")
    result = subprocess.run(
      ['streamlink', '--stream-url', url, 'best'],
      capture_output=True,
      text=True,
      timeout=15
    )
    if result.returncode == 0 and result.stdout.strip():
      print(f"   ✓ Found stream using streamlink")
      return result.stdout.strip()
  except FileNotFoundError:
    print("   ⚠️  streamlink not found. Install with: brew install streamlink")
  except subprocess.TimeoutExpired:
    print("   ⚠️  streamlink timeout")

  print("   ❌ Could not extract stream URL.")
  return url


def parse_args() -> argparse.Namespace:
  default_config = Path(__file__).resolve().parents[1] / "config" / "default_zones.yaml"
  default_output = Path(__file__).resolve().parents[2] / "data" / "camera" / "latest_metrics.json"

  parser = argparse.ArgumentParser(description="Run ObservAI camera analytics pipeline")
  parser.add_argument(
    "--source",
    type=str,
    default="0",
    help="Camera index (0,1,2...), video file, or live stream URL (YouTube, Twitch, etc.) (default: 0)",
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
    default="yolov8n.pt",
    help="YOLO model checkpoint (default: yolov8n.pt)",
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

  # Parse source - could be camera index, file, or live stream URL
  try:
    source = int(args.source)
    print(f"\n📹 Using camera index: {source}")
  except ValueError:
    source_str = args.source

    # Check if it's a live stream URL
    if any(domain in source_str for domain in ['youtube.com', 'youtu.be', 'twitch.tv', 'facebook.com', 'instagram.com']):
      print(f"\n🌐 Live stream detected: {source_str}")
      extracted_url = get_live_stream_url(source_str)

      if extracted_url != source_str and not extracted_url.startswith('http'):
        # Failed to extract
        print(f"\n❌ Failed to extract stream URL")
        print(f"   Make sure yt-dlp is installed: brew install yt-dlp")
        print(f"   Trying original URL anyway...")
        source = source_str
      elif extracted_url != source_str:
        # Successfully extracted
        source = extracted_url
        print(f"\n✓ Direct stream URL obtained ({len(source)} chars)")
        print(f"   URL: {source[:80]}...")
      else:
        # No extraction happened
        print(f"\n⚠️  Using original URL (no extraction)")
        source = source_str
    else:
      print(f"\n📁 Using file/URL: {source_str}")
      source = source_str

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
