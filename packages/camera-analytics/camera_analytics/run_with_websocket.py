"""Camera analytics runner with WebSocket streaming."""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path
from typing import Dict, List, Optional

from .analytics import CameraAnalyticsEngine
from .config import load_config
from .sources import prepare_source
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
        self.ws_server.on_start_stream = self.start_analytics
        self.ws_server.on_stop_stream = self.stop_analytics
        self.ws_server.on_snapshot = self.handle_snapshot
        
        self.engine: Optional[CameraAnalyticsEngine] = None
        self.analytics_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        await self.ws_server.start()
        print(
            f"✓ WebSocket server started on {self.ws_server.host}:{self.ws_server.port}"
        )
        # Do not start analytics automatically
        print("✓ Waiting for client to start stream...")
        
        # Keep the main loop running
        await asyncio.Event().wait()

    async def start_analytics(self) -> None:
        if self.engine and self.engine.running:
            print("⚠ Analytics already running")
            return

        print("🚀 Starting analytics stream...")
        loop = asyncio.get_running_loop()

        def emit_metrics(payload: Dict[str, object]) -> None:
            asyncio.run_coroutine_threadsafe(
                self.ws_server.broadcast_global_stream(payload), loop
            )

        def emit_tracks(payload: List[Dict[str, object]]) -> None:
            asyncio.run_coroutine_threadsafe(
                self.ws_server.broadcast_tracks(payload), loop
            )

        def emit_zone_insights(payload: List[Dict[str, object]]) -> None:
            asyncio.run_coroutine_threadsafe(
                self.ws_server.broadcast_zone_insights(payload), loop
            )

        self.engine = CameraAnalyticsEngine(
            config=self.config,
            source=self.source,
            output_path=self.output_path,
            model_path=self.model_path,
            sample_interval=1.0,
            display=self.display,
            on_metrics=emit_metrics,
            on_tracks=emit_tracks,
            on_zone_insights=emit_zone_insights,
        )

        # Run engine in a separate thread
        self.analytics_task = asyncio.create_task(asyncio.to_thread(self._run_engine_safe))

    def _run_engine_safe(self):
        try:
            if self.engine:
                self.engine.run()
        except Exception as exc:
            print(f"❌ Analytics engine stopped with error: {exc}")

    async def stop_analytics(self) -> None:
        if not self.engine or not self.engine.running:
            print("⚠ Analytics not running")
            return

        print("🛑 Stopping analytics stream...")
        self.engine.stop()
        
        if self.analytics_task:
            await self.analytics_task
            self.analytics_task = None
        
        self.engine = None
        print("✓ Analytics stopped")

    async def handle_snapshot(self) -> Optional[str]:
        """Handle snapshot request from client"""
        print("📸 Snapshot requested...")
        
        # If engine is running, we can't easily grab a frame from it asynchronously without thread safety issues
        # or modifying the engine to store the last frame.
        # However, if we open a NEW capture while the engine is running on the SAME device (webcam), it will likely fail.
        
        # Ideally, the engine should expose a 'get_latest_frame' method if it's running.
        # But for now, let's assume we can just create a temporary engine if not running.
        
        if self.engine and self.engine.running:
            # TODO: Implement thread-safe way to get frame from running engine
            # For now, we'll try to open a new capture, but expect it might fail on webcams
            print("⚠ Engine is running, attempting to capture from source (might conflict)...")
            return await asyncio.to_thread(self.engine.get_snapshot)
            
        # Create a temporary engine just for the snapshot
        print("   Creating temporary engine for snapshot...")
        try:
            temp_engine = CameraAnalyticsEngine(
                config=self.config,
                source=self.source,
                output_path=self.output_path,
                model_path=self.model_path
            )
            snapshot = await asyncio.to_thread(temp_engine.get_snapshot)
            print("   ✓ Snapshot captured")
            return snapshot
        except Exception as e:
            print(f"❌ Snapshot failed: {e}")
            return None

    def _resolve_source(self, source: str | int) -> str | int:
        """Deprecated: Source resolution is now handled by CameraAnalyticsEngine"""
        return source


def parse_args() -> argparse.Namespace:
    default_config = (
        Path(__file__).resolve().parents[1] / "config" / "default_zones.yaml"
    )
    parser = argparse.ArgumentParser(
        description="Run ObservAI analytics pipeline with WebSocket streaming"
    )
    parser.add_argument(
        "--source",
        required=True,
        help="Video source: webcam index (0,1,2...), video file path (.mp4, .avi), "
             "RTSP/RTMP stream URL, YouTube Live URL, or 'screen' for screen capture",
    )
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
