"""Camera analytics runner with WebSocket streaming."""

from __future__ import annotations

import argparse
import asyncio
import signal
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
        model_path: str = "yolo11n.pt",
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
        self.ws_server.on_get_frame = self.get_latest_frame  # For MJPEG streaming
        self.ws_server.on_change_source = self.change_source
        self.ws_server.on_toggle_overlay = self.toggle_overlay  # AI Insights toggle (stats + demographics)
        self.ws_server.on_toggle_heatmap = self.toggle_heatmap  # Heatmap toggle (separate control)

        self.engine: Optional[CameraAnalyticsEngine] = None
        self.analytics_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        # Signal handling
        loop = asyncio.get_running_loop()
        stop_event = asyncio.Event()

        def signal_handler():
            print("\nReceived shutdown signal")
            stop_event.set()

        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, signal_handler)

        await self.ws_server.start()
        print(
            f"✓ WebSocket server started on {self.ws_server.host}:{self.ws_server.port}"
        )
        # Do not start analytics automatically
        print("✓ Waiting for client to start stream...")
        
        # Keep the main loop running until signal
        await stop_event.wait()
        
        # Cleanup
        await self.stop_analytics()
        # self.ws_server.stop() # If implemented in future

    async def start_analytics(self) -> None:
        # Check if engine exists and is either running or being created
        if self.engine:
            if self.engine.running:
                print("⚠ Analytics already running")
                return
            # If engine exists but not running, it's being created - wait a bit
            print("⚠ Analytics engine initializing, please wait...")
            return

        # Check if analytics task is already running
        if self.analytics_task and not self.analytics_task.done():
            print("⚠ Analytics task already starting")
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

    async def change_source(self, new_source: int | str) -> bool:
        """Change camera source and restart analytics

        CRITICAL: Ensures proper camera hardware release before switching sources
        to prevent conflicts when multiple sources try to access the same camera.
        """
        try:
            # Check if source is already the same - avoid unnecessary restart
            if self.source == new_source and self.engine and self.engine.running:
                print(f"ℹ️  Source {new_source} is already active, skipping restart")
                return True

            print(f"🔄 ===== CHANGING CAMERA SOURCE =====")
            print(f"🔄 Current source: {self.source}")
            print(f"🔄 New source: {new_source}")

            # STEP 1: Stop current analytics if running
            if self.engine and self.engine.running:
                print("🔄 Step 1: Stopping current analytics engine...")
                await self.stop_analytics()
                print("✓ Analytics engine stopped")

            # STEP 2: Wait for camera hardware to fully release
            # This is CRITICAL to prevent "camera already in use" errors on macOS
            print("🔄 Step 2: Waiting for camera hardware to release (5 seconds)...")
            await asyncio.sleep(5.0)  # Increased for macOS AVFoundation reliability
            print("✓ Camera hardware released")

            # STEP 3: Update source
            print(f"🔄 Step 3: Updating source to: {new_source}")
            self.source = new_source

            # STEP 4: Start analytics with new source
            print("🔄 Step 4: Starting analytics with new source...")
            await self.start_analytics()
            print("✓ Analytics started with new source")

            print(f"✓ ===== SOURCE CHANGED SUCCESSFULLY TO: {new_source} =====")
            return True
        except Exception as e:
            print(f"❌ ===== FAILED TO CHANGE SOURCE =====")
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
            return False

    async def toggle_overlay(self, visible: bool) -> bool:
        """Toggle AI Insights overlay (stats + demographics only, NOT heatmap)

        Controls the LIVE ANALYTICS and DEMOGRAPHICS panels, but NOT the heatmap.
        Heatmap has separate control via toggle_heatmap().
        """
        try:
            if self.engine:
                # Update persistent preferences (not ephemeral state)
                self.engine._user_overlay_prefs['stats_visible'] = visible
                self.engine._user_overlay_prefs['demographics_visible'] = visible
                # Do NOT touch heatmap - it has separate control
                print(f"✓ AI Insights visibility set to: {visible}")
                return True
            else:
                print("⚠ No active engine to toggle overlay")
                return False
        except Exception as e:
            print(f"❌ Failed to toggle overlay: {e}")
            return False

    async def toggle_heatmap(self, visible: bool) -> bool:
        """Toggle heatmap visibility (separate from AI Insights)

        Controls only the heatmap overlay, independent from stats/demographics.
        """
        try:
            if self.engine:
                self.engine._user_overlay_prefs['heatmap_visible'] = visible
                print(f"✓ Heatmap visibility set to: {visible}")
                return True
            else:
                print("⚠ No active engine to toggle heatmap")
                return False
        except Exception as e:
            print(f"❌ Failed to toggle heatmap: {e}")
            return False

    def get_latest_frame(self) -> Optional['np.ndarray']:
        """Get latest frame from analytics engine (thread-safe, for MJPEG streaming)"""
        if self.engine and self.engine.running:
            return self.engine.get_latest_frame_safe()
        return None

    async def handle_snapshot(self) -> Optional[str]:
        """Handle snapshot request from client (returns base64-encoded JPEG)"""
        print("📸 Snapshot requested...")

        if self.engine and self.engine.running:
            # Use thread-safe snapshot method
            print("⚠ Engine is running, using cached frame...")
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
        default="yolo11n.pt",
        help="YOLO model checkpoint (default: yolo11n.pt)",
    )
    parser.add_argument(
        "--display",
        action="store_true",
        help="Show OpenCV overlay window (press q to quit)",
    )
    parser.add_argument(
        "--ws-host", type=str, default="0.0.0.0", help="WebSocket host"
    )
    parser.add_argument("--ws-port", type=int, default=5001, help="WebSocket port")
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
