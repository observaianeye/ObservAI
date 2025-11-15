"""Camera analytics runner with WebSocket streaming."""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path
from typing import Dict, List, Optional

from .analytics import CameraAnalyticsEngine
from .config import load_config
from .run import get_live_stream_url
from .websocket_server import AnalyticsWebSocketServer


class CameraAnalyticsWithWebSocket:
    """Bootstrap camera analytics and stream results over WebSocket."""

    def __init__(
        self,
        config_path: Path,
        source: str | int,
        model_path: str = "yolov8n.pt",
        display: bool = False,
        ws_host: str = "0.0.0.0",
        ws_port: int = 5000,
        output_path: Optional[Path] = None,
    ) -> None:
        self.config = load_config(config_path)
        self.source = source
        self.model_path = model_path
        self.display = display
        self.output_path = (
            output_path
            if output_path is not None
            else Path(__file__).resolve().parents[2]
            / "data"
            / "camera"
            / "latest_metrics.json"
        )

        self.ws_server = AnalyticsWebSocketServer(host=ws_host, port=ws_port)
        self.engine: Optional[CameraAnalyticsEngine] = None

    async def start(self) -> None:
        await self.ws_server.start()
        print(
            f"✓ WebSocket server started on {self.ws_server.host}:{self.ws_server.port}"
        )
        await self.run_analytics()

    async def run_analytics(self) -> None:
        loop = asyncio.get_running_loop()

        def emit_metrics(payload: Dict[str, object]) -> None:
            asyncio.run_coroutine_threadsafe(
                self.ws_server.broadcast_global_stream(payload), loop
            )

        def emit_tracks(payload: List[Dict[str, object]]) -> None:
            asyncio.run_coroutine_threadsafe(
                self.ws_server.broadcast_tracks(payload), loop
            )

        source = self._resolve_source(self.source)

        self.engine = CameraAnalyticsEngine(
            config=self.config,
            source=source,
            output_path=self.output_path,
            model_path=self.model_path,
            sample_interval=1.0,
            display=self.display,
            on_metrics=emit_metrics,
            on_tracks=emit_tracks,
        )

        try:
            await asyncio.to_thread(self.engine.run)
        except Exception as exc:  # pragma: no cover
            print(f"❌ Analytics engine stopped: {exc}")
            raise

    def _resolve_source(self, source: str | int) -> str | int:
        if isinstance(source, str) and any(
            domain in source for domain in ["youtube.com", "youtu.be", "twitch.tv"]
        ):
            print(f"🌐 Extracting stream URL from: {source}")
            extracted = get_live_stream_url(source)
            if extracted and extracted != source:
                print("✓ Live stream URL resolved")
                return extracted
            print(
                "⚠ Unable to extract live stream. Install yt-dlp (brew install yt-dlp) for YouTube streams."
            )
        return source


def parse_args() -> argparse.Namespace:
    default_config = (
        Path(__file__).resolve().parents[1] / "config" / "default_zones.yaml"
    )
    parser = argparse.ArgumentParser(
        description="Run ObservAI analytics pipeline with WebSocket streaming"
    )
    parser.add_argument("--source", required=True, help="Camera index or stream URL")
    parser.add_argument(
        "--config",
        type=Path,
        default=default_config,
        help=f"Path to analytics config (default: {default_config})",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="yolov8n.pt",
        help="YOLO model checkpoint (default: yolov8n.pt)",
    )
    parser.add_argument(
        "--display",
        action="store_true",
        help="Show OpenCV overlay window (press q to quit)",
    )
    parser.add_argument(
        "--ws-host", type=str, default="0.0.0.0", help="WebSocket host"
    )
    parser.add_argument("--ws-port", type=int, default=5000, help="WebSocket port")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    runner = CameraAnalyticsWithWebSocket(
        config_path=args.config,
        source=args.source,
        model_path=args.model,
        display=args.display,
        ws_host=args.ws_host,
        ws_port=args.ws_port,
    )
    asyncio.run(runner.start())


if __name__ == "__main__":
    main()
