"""Camera analytics runner with WebSocket streaming."""

from __future__ import annotations

import argparse
import asyncio
import os
import platform
import signal
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiohttp

from .analytics import CameraAnalyticsEngine
from .config import load_config
from .sources import prepare_source
from .websocket_server import AnalyticsWebSocketServer


class NodePersister:
    """Yan #22 — Push analytics ticks directly to Node `/api/analytics/ingest`.

    Frontend-independent persistence: the Python pipeline buffers per-tick
    metrics and POSTs them in batches to the Node backend, so historical
    data is captured even when no dashboard client is open.
    Activated when both OBSERVAI_NODE_URL and OBSERVAI_INGEST_KEY env vars
    are set; otherwise instances are not created and emit cost is zero.
    """

    def __init__(
        self,
        url: str,
        api_key: str,
        batch_size: int = 5,
        interval: float = 1.0,
    ) -> None:
        self.url = url.rstrip("/") + "/api/analytics/ingest"
        self.api_key = api_key
        self.batch_size = batch_size
        self.interval = interval
        self.buffer: List[Dict[str, Any]] = []
        self.lock = asyncio.Lock()
        self.task: Optional[asyncio.Task] = None
        self.session: Optional[aiohttp.ClientSession] = None
        self._stopped = False

    async def start(self) -> None:
        if self.session is None:
            self.session = aiohttp.ClientSession()
        self._stopped = False
        self.task = asyncio.create_task(self._loop())
        print(
            f"[NodePersister] started → {self.url}, "
            f"batch={self.batch_size}, interval={self.interval}s"
        )

    async def stop(self) -> None:
        self._stopped = True
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None
        if self.session:
            await self.session.close()
            self.session = None

    async def push(self, payload: Dict[str, Any]) -> None:
        if self._stopped:
            return
        async with self.lock:
            self.buffer.append(payload)

    async def _loop(self) -> None:
        try:
            while True:
                await asyncio.sleep(self.interval)
                async with self.lock:
                    if not self.buffer:
                        continue
                    batch = self.buffer[: self.batch_size]
                    self.buffer = self.buffer[self.batch_size:]
                await self._post(batch)
        except asyncio.CancelledError:
            return

    async def _post(self, batch: List[Dict[str, Any]], retries: int = 3) -> None:
        if self.session is None:
            return
        for attempt in range(retries):
            try:
                async with self.session.post(
                    self.url,
                    json=batch,
                    headers={
                        "X-Ingest-Key": self.api_key,
                        "Content-Type": "application/json",
                    },
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    if resp.status == 200:
                        return
                    body = await resp.text()
                    print(f"[NodePersister] {resp.status}: {body[:200]}")
                    return
            except Exception as e:  # network, timeout, dns
                if attempt == retries - 1:
                    print(f"[NodePersister] Failed after {retries} attempts: {e}")
                else:
                    await asyncio.sleep(2 ** attempt)


class CameraAnalyticsWithWebSocket:
    """Bootstrap camera analytics and stream results over WebSocket."""

    def __init__(
        self,
        config_path: Path,
        source: str | int,
        model_path: str = "yolo11l.pt",
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
        self.ws_server.on_get_frame = self.get_latest_frame  # MJPEG inference-mode
        self.ws_server.on_get_smooth_frame = self.get_smooth_frame  # MJPEG smooth-mode
        self.ws_server.on_change_source = self.change_source
        self.ws_server.on_toggle_heatmap = self.toggle_heatmap  # Heatmap toggle
        self.ws_server.on_update_zones = self.update_zones      # Zone update
        self.ws_server.on_set_camera = self.set_camera          # Faz 10 Bug #4: dynamic cam binding

        self.engine: Optional[CameraAnalyticsEngine] = None
        self.analytics_task: Optional[asyncio.Task] = None

        # Preloaded model cache (set during startup by _preload_models)
        self._preloaded_yolo = None
        self._preloaded_estimator = None

        # Yan #22 — Node persister (frontend-independent persistence).
        # Activated when both OBSERVAI_NODE_URL + OBSERVAI_INGEST_KEY are set.
        # cam_id sourced from OBSERVAI_CAMERA_ID env var (set by start-all.bat
        # or pythonBackendManager.spawn). Unset → persister disabled.
        self.persister: Optional[NodePersister] = None
        self.cam_id: Optional[str] = os.environ.get("OBSERVAI_CAMERA_ID") or None

    async def update_zones(self, zones: List[Dict]) -> None:
        """Update zones in the running analytics engine"""
        if self.engine:
            # Run in thread executor because update_zones might take a lock
            await asyncio.to_thread(self.engine.update_zones, zones)
            print(f"✓ Zones updated in running engine")
        else:
            print("ℹ️  Zones saved, but engine not running")
        self.analytics_task: Optional[asyncio.Task] = None

    async def set_camera(self, cam_id: str) -> None:
        """Faz 10 Bug #4 — bind the running engine to a Node camera UUID.

        Called by Node `pythonBackendManager.setCamera()` (Express POST to
        /set-camera). Updates self.cam_id and lazily starts the NodePersister
        so analytics_logs rows start landing immediately without restarting
        Python. Idempotent — re-binding to the same id is a no-op except for
        logging, and re-binding to a new id rotates the cam_id field that
        emit_metrics tags subsequent ticks with.
        """
        prev = self.cam_id
        self.cam_id = cam_id
        node_url = os.environ.get("OBSERVAI_NODE_URL")
        ingest_key = os.environ.get("OBSERVAI_INGEST_KEY")
        if not (node_url and ingest_key):
            print(
                "[NodePersister] /set-camera received but OBSERVAI_NODE_URL or "
                "OBSERVAI_INGEST_KEY is unset — persister cannot activate."
            )
            return
        if self.persister is None:
            self.persister = NodePersister(node_url, ingest_key)
            await self.persister.start()
            print(f"[NodePersister] activated for camera {cam_id} (prev={prev})")
        else:
            print(f"[NodePersister] camera id rebind {prev} → {cam_id}")

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

        # Yan #22 — Activate Node persister if env vars are set.
        node_url = os.environ.get("OBSERVAI_NODE_URL")
        ingest_key = os.environ.get("OBSERVAI_INGEST_KEY")
        if node_url and ingest_key:
            if not self.cam_id:
                print(
                    "[NodePersister] WARN: OBSERVAI_NODE_URL+KEY set but "
                    "OBSERVAI_CAMERA_ID is empty — persister disabled."
                )
            else:
                self.persister = NodePersister(node_url, ingest_key)
                await self.persister.start()
        else:
            print(
                "[NodePersister] disabled (set OBSERVAI_NODE_URL + "
                "OBSERVAI_INGEST_KEY + OBSERVAI_CAMERA_ID to enable)."
            )

        # Preload models in background so first start_analytics is fast
        asyncio.ensure_future(self._preload_models())
        print("✓ Waiting for client to start stream (models loading in background)...")

        # Keep the main loop running until signal
        await stop_event.wait()

        # Cleanup
        await self.stop_analytics()
        if self.persister:
            await self.persister.stop()
            self.persister = None
        # self.ws_server.stop() # If implemented in future

    async def _preload_models(self) -> None:
        """Eagerly load YOLO and InsightFace models in the background.
        
        This runs right after the WebSocket server starts so the first call to
        start_analytics() reuses the pre-warmed objects instead of waiting for
        cold model loading (which can take 5-30s on first run).
        """
        try:
            await self.ws_server.update_status("model_loading", model_loaded=False)
            print("🔄 Preloading YOLO model in background...")
            
            from ultralytics import YOLO
            from .age_gender import EstimatorFactory
            
            loop = asyncio.get_running_loop()
            
            # Load YOLO in thread executor (CPU/GPU bound)
            def _load_yolo():
                from pathlib import Path
                from .optimize import HardwareOptimizer
                model = YOLO(self.model_path)

                # Run hardware optimization (TensorRT on NVIDIA, CoreML on Apple Silicon).
                # This is done during preload so subsequent starts use the cached engine.
                try:
                    optimized_path = HardwareOptimizer.optimize_model(model, self.model_path)
                    if optimized_path != self.model_path and Path(optimized_path).exists():
                        print(f"✓ Reloading TensorRT/optimized model: {optimized_path}")
                        model = YOLO(optimized_path)
                except Exception as e:
                    print(f"[WARN] Hardware optimization during preload failed: {e}")

                # Stage 2: TensorRT warm-up loop (10 dummy frames) — cold-start
                # can spike first-inference latency to 200-400 ms which shows up
                # as a visible hitch when the smooth-mode stream launches. Ten
                # forward passes are enough to settle the TRT graph.
                try:
                    import numpy as np
                    warmup_size = self.config.yolo_input_size or 640
                    dummy = np.zeros((warmup_size, warmup_size, 3), dtype=np.uint8)
                    for _ in range(10):
                        _ = model.predict(dummy, verbose=False, imgsz=warmup_size)
                    print(f"✓ YOLO TensorRT warm-up done ({warmup_size}p × 10)")
                except Exception as _warm_err:
                    print(f"[WARN] YOLO warm-up skipped: {_warm_err}")
                return model

            self._preloaded_yolo = await loop.run_in_executor(None, _load_yolo)
            print(f"✓ YOLO model preloaded: {self.model_path}")
            
            # Load InsightFace/MiVOLO in thread executor
            def _load_estimator():
                try:
                    estimator = EstimatorFactory.create_estimator()
                    estimator.prepare(ctx_id=0, det_size=(640, 640))
                    return estimator
                except Exception as e:
                    print(f"[WARN] Age/Gender preload failed: {e}")
                    return None
            
            self._preloaded_estimator = await loop.run_in_executor(None, _load_estimator)
            if self._preloaded_estimator:
                print("✓ Age/Gender estimator preloaded")
            
            await self.ws_server.update_status("ready", model_loaded=True)
            print("✅ All models preloaded — backend ready for instant stream start")
            
        except Exception as e:
            print(f"❌ Model preloading failed: {e}")
            await self.ws_server.update_status("error", model_loaded=False, error=str(e))

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
            # Yan #22 — Forward tick to Node ingest endpoint when configured.
            # Field translation: payload uses entries/exits/current/queue/fps;
            # AnalyticsLog schema expects peopleIn/peopleOut/currentCount/queueCount/fps.
            if self.persister and self.cam_id:
                ingest_entry = {
                    "cameraId": self.cam_id,
                    "timestamp": int(payload.get("timestamp", 0) or 0),
                    "currentCount": int(payload.get("current", 0) or 0),
                    "peopleIn": int(payload.get("entries", 0) or 0),
                    "peopleOut": int(payload.get("exits", 0) or 0),
                    "queueCount": int(payload.get("queue", 0) or 0),
                    "avgWaitTime": 0.0,
                    "longestWaitTime": 0.0,
                    "fps": float(payload.get("fps", 0.0) or 0.0),
                }
                # Faz 12 (T17 fix): forward demographics so Analytics page can
                # render live gender/age even before hourly aggregation rolls up.
                # Normalize Python websocket shape (ages plural) to backend
                # mergeDemographics shape (age singular + samples count).
                demo = payload.get("demographics")
                if demo and isinstance(demo, dict):
                    age_buckets = demo.get("ages") or {}
                    gender_buckets = demo.get("gender") or {}
                    samples = sum(int(v or 0) for v in age_buckets.values()) \
                        or sum(int(v or 0) for v in gender_buckets.values())
                    if samples > 0:
                        ingest_entry["demographics"] = {
                            "gender": gender_buckets,
                            "age": age_buckets,
                            "samples": samples,
                        }
                asyncio.run_coroutine_threadsafe(
                    self.persister.push(ingest_entry), loop
                )

        def emit_tracks(payload: List[Dict[str, object]]) -> None:
            asyncio.run_coroutine_threadsafe(
                self.ws_server.broadcast_tracks(payload), loop
            )

        def emit_zone_insights(payload: List[Dict[str, object]]) -> None:
            asyncio.run_coroutine_threadsafe(
                self.ws_server.broadcast_zone_insights(payload), loop
            )

        # Notify frontend that we're about to start
        await self.ws_server.update_status("connecting", source_connected=False, streaming=False)

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
                preloaded_yolo=self._preloaded_yolo,
                preloaded_estimator=self._preloaded_estimator,
            )
            await self.ws_server.update_status("source_connected", model_loaded=True, source_connected=True, streaming=True)
        except Exception as e:
            print(f"❌ Failed to initialize analytics engine: {e}")
            await self.ws_server.update_status("error", error=str(e), streaming=False)
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

    def get_smooth_frame(self, now: float) -> Optional['np.ndarray']:
        """Stage 2: raw capture frame + interpolated bbox overlay at display rate.

        The smooth MJPEG mode calls this every ~17 ms to produce a 60 FPS stream
        that doesn't stall when inference drops below the display cadence.
        """
        if self.engine and self.engine.running:
            return self.engine.get_smooth_frame(now)
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
        default="yolo11l.pt",
        help="YOLO model checkpoint (default: yolo11l.pt)",
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
