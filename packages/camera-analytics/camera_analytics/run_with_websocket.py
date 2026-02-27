"""Camera analytics runner with WebSocket streaming."""

from __future__ import annotations

import argparse
import asyncio
import platform
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
        model_path: str = "yolo11s.pt",
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
        self.ws_server.on_toggle_heatmap = self.toggle_heatmap  # Heatmap toggle
        self.ws_server.on_update_zones = self.update_zones      # Zone update

        self.engine: Optional[CameraAnalyticsEngine] = None
        self.analytics_task: Optional[asyncio.Task] = None

    async def update_zones(self, zones: List[Dict]) -> None:
        """Update zones in the running analytics engine"""
        if self.engine:
            # Run in thread executor because update_zones might take a lock
            await asyncio.to_thread(self.engine.update_zones, zones)
            print(f"✓ Zones updated in running engine")
        else:
            print("ℹ️  Zones saved, but engine not running")
        self.analytics_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        # Signal handling
        loop = asyncio.get_running_loop()
        stop_event = asyncio.Event()

        def signal_handler():
            print("\nReceived shutdown signal")
            stop_event.set()

        # Platform-specific signal handling
        # Windows doesn't support loop.add_signal_handler()
        if platform.system() != "Windows":
            for sig in (signal.SIGINT, signal.SIGTERM):
                loop.add_signal_handler(sig, signal_handler)
        else:
            # Windows: Use traditional signal handler for Ctrl+C
            def windows_signal_handler(signum, frame):
                signal_handler()
            signal.signal(signal.SIGINT, windows_signal_handler)

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

    async def start_analytics(self) -> bool:
        # Check if engine exists and is either running or being created
        if self.engine:
            if self.engine.running:
                print("⚠ Analytics already running")
                return True
            # If engine exists but not running, it's being created - wait a bit
            print("⚠ Analytics engine initializing, please wait...")
            return True

        # Check if analytics task is already running
        if self.analytics_task and not self.analytics_task.done():
            print("⚠ Analytics task already starting")
            return True

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

        try:
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
        except Exception as e:
            print(f"❌ Failed to initialize analytics engine: {e}")
            self.engine = None
            raise e

        # Run engine in a separate thread
        self.analytics_task = asyncio.create_task(asyncio.to_thread(self._run_engine_safe))
        return True

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

    async def change_source(self, new_source: int | str) -> tuple[bool, int | str]:
        """Change camera source and restart analytics

        CRITICAL: Ensures proper camera hardware release before switching sources
        to prevent conflicts when multiple sources try to access the same camera.

        Returns:
            tuple[bool, int | str]: (success, actual_source)
            The actual_source may differ from new_source if fallback occurred (e.g., iPhone → MacBook)
        """
        try:
            # Check if source is already the same - avoid unnecessary restart
            if self.source == new_source and self.engine and self.engine.running:
                print(f"ℹ️  Source {new_source} is already active, skipping restart")
                return (True, self.source)

            print(f"🔄 ===== CHANGING CAMERA SOURCE =====")
            print(f"🔄 Current source: {self.source}")
            print(f"🔄 Requested source: {new_source}")
            print(f"🔄 Requested source type: {type(new_source)}")

            # Debug: Check if it's a URL
            if isinstance(new_source, str):
                if new_source.startswith(('http://', 'https://')):
                    print(f"🎬 Detected video URL (YouTube/HLS/MP4)")
                elif new_source.startswith(('rtsp://', 'rtmp://')):
                    print(f"📹 Detected RTSP/RTMP stream")
                else:
                    print(f"📁 Detected file path or unknown string source")

            # STEP 1: Stop current analytics if running
            if self.engine and self.engine.running:
                print("🔄 Step 1: Stopping current analytics engine...")
                await self.stop_analytics()
                print("✓ Analytics engine stopped")

            # STEP 2: Wait for camera hardware to fully release
            # This is CRITICAL to prevent "camera already in use" errors on macOS
            print("🔄 Step 2: Waiting for camera hardware to release (2 seconds)...")
            await asyncio.sleep(2.0)
            print("✓ Camera hardware released")

            # STEP 3: Update source
            print(f"🔄 Step 3: Updating source to: {new_source}")
            self.source = new_source

            # STEP 4: Start analytics with new source
            print("🔄 Step 4: Starting analytics with new source...")
            success = await self.start_analytics()
            if not success:
                print("❌ Step 4 failed: Could not start analytics with new source")
                # Reset source to 0 as fallback or just fail
                return (False, new_source)

            print("✓ Analytics started with new source")

            # Get actual source used (may differ due to fallback)
            actual_source = self.engine.source if self.engine else new_source

            if actual_source != new_source:
                print(f"⚠️  FALLBACK: Requested {new_source} but using {actual_source}")

            print(f"✓ ===== SOURCE CHANGED SUCCESSFULLY TO: {actual_source} =====")
            return (True, actual_source)
        except Exception as e:
            print(f"❌ ===== FAILED TO CHANGE SOURCE =====")
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
            raise e

    async def toggle_heatmap(self, visible: bool) -> bool:
        """Toggle heatmap visibility."""
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
        default="yolo11s.pt",
        help="YOLO model checkpoint (default: yolo11s.pt)",
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
