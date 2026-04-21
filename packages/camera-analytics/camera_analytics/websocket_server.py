"""
WebSocket Server for real-time analytics streaming
Broadcasts camera analytics data to connected web clients
"""

from __future__ import annotations

import json
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Set, Optional

from aiohttp import web
import socketio

from .kafka_producer import get_kafka_producer

logger = logging.getLogger(__name__)


class AnalyticsWebSocketServer:
    """WebSocket server for streaming analytics data to clients"""

    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 5000,
        kafka_enabled: bool = False,
        kafka_bootstrap_servers: str = "localhost:9092"
    ):
        self.host = host
        self.port = port

        # Create Socket.IO server with CORS support
        self.sio = socketio.AsyncServer(
            cors_allowed_origins="*",
            async_mode="aiohttp",
            logger=False,
            engineio_logger=False,
        )

        # Create aiohttp web application
        self.app = web.Application()
        self.sio.attach(self.app)

        # Connected clients
        self.clients: Set[str] = set()
        self.disconnect_timer = None

        # Zone configuration storage
        self.zones: List[Dict] = []
        self.zones_file = Path("config/zones.json")
        self._load_zones()

        # Kafka producer
        self.kafka_producer = get_kafka_producer(
            bootstrap_servers=kafka_bootstrap_servers,
            enabled=kafka_enabled
        )
        self.camera_id = "default"  # Default camera ID

        # Backend readiness state
        self._status = {
            "phase": "initializing",
            "model_loaded": False,
            "source_connected": False,
            "streaming": False,
            "error": None,
            "fps": 0.0,
        }

        # Callbacks
        self.on_start_stream = None
        self.on_stop_stream = None
        self.on_snapshot = None
        self.on_get_frame = None  # For MJPEG inference-mode (annotated frame)
        self.on_get_smooth_frame = None  # Stage 2: smooth-mode frame (raw + interp. overlay)
        self.on_change_source = None
        self.on_toggle_heatmap = None  # Toggle heatmap
        self.on_update_zones = None    # Update zones dynamically

        # Default MJPEG mode if the client doesn't pass ?mode=... Leave as
        # "inference" until smooth mode is validated on live cameras, then flip
        # via OBSERVAI_MJPEG_MODE env.
        import os as _os
        self._default_mjpeg_mode = _os.environ.get("OBSERVAI_MJPEG_MODE", "inference").lower()

        # Setup event handlers
        self._setup_handlers()

    def _setup_handlers(self):
        """Setup Socket.IO event handlers"""

        @self.sio.event
        async def connect(sid, environ):
            """Handle client connection"""
            self.clients.add(sid)
            logger.info(f"Client connected: {sid} (total: {len(self.clients)})")

            # Cancel disconnect timer if a client reconnects
            if self.disconnect_timer:
                self.disconnect_timer.cancel()
                self.disconnect_timer = None
                logger.info("Client reconnected, cancelled analytics shutdown timer")

            await self.sio.emit("connection", {"status": "connected"}, room=sid)

        # MJPEG stream HTTP handler (non-Socket.IO route)
        async def mjpeg_handler(request):
            """MJPEG stream endpoint.

            ?mode=inference (default) — annotated frame at inference rate (~20-25 FPS)
            ?mode=smooth             — raw capture + interpolated bbox overlay (~60 FPS)
            """
            mode = request.query.get("mode", self._default_mjpeg_mode).lower()
            if mode not in ("smooth", "inference"):
                mode = "inference"
            # Smooth mode requires the smooth-frame callback; fall back to
            # inference if the engine didn't wire it up.
            if mode == "smooth" and self.on_get_smooth_frame is None:
                mode = "inference"
            logger.info(f"MJPEG stream requested (mode={mode})")

            response = web.StreamResponse(
                status=200,
                headers={
                    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*'
                }
            )
            await response.prepare(request)

            _last_frame_hash = [0]     # Track frame changes via pixel hash
            _last_jpeg_bytes = [None]  # Cache last encoded JPEG for keepalive resend
            _last_send_time = [0.0]    # Time of last frame send
            # JPEG quality 82: marginally larger than 75 but noticeably less
            # blocky on live video — still well under bandwidth limits.
            _JPEG_QUALITY = 82

            def _get_and_encode_inference():
                """Inference mode: annotated frame + change-detection keepalive."""
                import time as _time
                if not self.on_get_frame:
                    return None, False
                frame = self.on_get_frame()
                if frame is None:
                    return _last_jpeg_bytes[0], False  # Keepalive with last frame
                # Quick change detection: hash a sparse sample of pixels
                h = hash(frame[::64, ::64, 0].tobytes())
                if h == _last_frame_hash[0]:
                    if _time.time() - _last_send_time[0] > 0.3:
                        return _last_jpeg_bytes[0], False  # Keepalive resend
                    return None, False  # Skip — recent enough
                _last_frame_hash[0] = h
                _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, _JPEG_QUALITY])
                _last_jpeg_bytes[0] = buf.tobytes()
                return _last_jpeg_bytes[0], True

            def _get_and_encode_smooth():
                """Smooth mode: raw frame + interpolated overlay, re-encoded every tick.

                The bbox position shifts continuously with interpolation so we
                cannot dedupe by hash — just re-encode the latest raw+overlay.
                """
                import time as _time
                cb = self.on_get_smooth_frame
                if not cb:
                    return None, False
                frame = cb(_time.time())
                if frame is None:
                    return _last_jpeg_bytes[0], False  # keepalive
                _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, _JPEG_QUALITY])
                _last_jpeg_bytes[0] = buf.tobytes()
                return _last_jpeg_bytes[0], True

            _get_and_encode = _get_and_encode_smooth if mode == "smooth" else _get_and_encode_inference

            try:
                import cv2
                import time as _time

                while True:
                    # Get frame + encode JPEG entirely off the event loop
                    jpeg_bytes, is_new = await asyncio.to_thread(_get_and_encode)

                    if jpeg_bytes is not None:
                        try:
                            await response.write(
                                b'--frame\r\n'
                                b'Content-Type: image/jpeg\r\n'
                                b'Content-Length: ' + str(len(jpeg_bytes)).encode() + b'\r\n\r\n'
                                + jpeg_bytes + b'\r\n'
                            )
                            _last_send_time[0] = _time.time()
                        except (ConnectionResetError, BrokenPipeError, web.HTTPException):
                            logger.info("MJPEG client disconnected")
                            break
                        except Exception as e:
                            if "Cannot write to closing transport" in str(e):
                                logger.info("MJPEG client disconnected (closing transport)")
                                break
                            raise e

                    # Smooth: push ~60 FPS (17 ms). Inference: keep original cadence.
                    if mode == "smooth":
                        await asyncio.sleep(0.017 if is_new else 0.033)
                    else:
                        await asyncio.sleep(0.025 if is_new else 0.050)
            except asyncio.CancelledError:
                logger.info("MJPEG stream cancelled")
            except Exception as e:
                logger.error(f"MJPEG stream error: {e}")
            finally:
                # Only write EOF if transport is still open
                try:
                    if not response._payload_writer.transport.is_closing():
                        await response.write_eof()
                except Exception:
                    pass  # Silently ignore - connection already closed

            return response

        # Health-check HTTP endpoint
        async def health_handler(request):
            """Health check endpoint for backend readiness"""
            status_str = "ready" if self._status["streaming"] else (
                "error" if self._status["error"] else "loading"
            )
            body = {
                "status": status_str,
                "phase": self._status["phase"],
                "model_loaded": self._status["model_loaded"],
                "source_connected": self._status["source_connected"],
                "streaming": self._status["streaming"],
                "fps": self._status["fps"],
                "clients": len(self.clients),
            }
            if self._status["error"]:
                body["error"] = str(self._status["error"])

            http_status = 200 if status_str == "ready" else 503
            return web.json_response(body, status=http_status)

        # Register HTTP routes
        self.app.router.add_get('/health', health_handler)
        self.app.router.add_get('/mjpeg', mjpeg_handler)

        @self.sio.event
        async def disconnect(sid):
            """Handle client disconnection"""
            self.clients.discard(sid)
            logger.info(f"Client disconnected: {sid} (total: {len(self.clients)})")

            # If no clients left, stop analytics after a delay
            if len(self.clients) == 0:
                logger.info("No clients connected, will stop analytics in 10 seconds if no new connections...")

                # Cancel any existing timer
                if self.disconnect_timer:
                    self.disconnect_timer.cancel()

                # Create new timer to stop analytics
                async def stop_analytics_delayed():
                    await asyncio.sleep(10)
                    if len(self.clients) == 0 and self.on_stop_stream:
                        logger.info("No clients reconnected, stopping analytics to release camera...")
                        await self.on_stop_stream()

                self.disconnect_timer = asyncio.create_task(stop_analytics_delayed())

        @self.sio.event
        async def ping(sid):
            """Handle ping for heartbeat"""
            await self.sio.emit("pong", room=sid)

        @self.sio.event
        async def save_zones(sid, data):
            """Handle zone configuration from client"""
            try:
                zones = data.get("zones", [])
                self.zones = zones
                self._save_zones()
                logger.info(f"Saved {len(zones)} zones from client {sid}")
                
                # Apply updates to running engine if available
                if self.on_update_zones:
                    await self.on_update_zones(zones)
                    
                await self.sio.emit("zones_saved", {"status": "success"}, room=sid)
            except Exception as e:
                logger.error(f"Error saving zones: {e}")
                await self.sio.emit("zones_saved", {"status": "error", "message": str(e)}, room=sid)

        @self.sio.event
        async def get_zones(sid):
            """Send current zone configuration to client"""
            await self.sio.emit("zones_config", {"zones": self.zones}, room=sid)

        @self.sio.event
        async def get_snapshot(sid):
            """Handle snapshot request"""
            if self.on_snapshot:
                snapshot = await self.on_snapshot()
                if snapshot:
                    await self.sio.emit("snapshot_data", {"image": snapshot}, room=sid)
                else:
                    await self.sio.emit("snapshot_error", {"message": "Failed to capture snapshot"}, room=sid)
            else:
                await self.sio.emit("snapshot_error", {"message": "Snapshot handler not configured"}, room=sid)

        @self.sio.event
        async def start_stream(sid, data=None):
            """Handle start stream request"""
            logger.info(f"Start stream requested by {sid}")
            if self.on_start_stream:
                try:
                    await self.on_start_stream()
                    await self.sio.emit("stream_status", {"status": "started"}, room=sid)
                except Exception as e:
                    logger.error(f"Error starting stream: {e}")
                    await self.sio.emit("stream_status", {"status": "error", "message": str(e)}, room=sid)
            else:
                await self.sio.emit("stream_status", {"status": "error", "message": "Stream start not supported"}, room=sid)

        @self.sio.event
        async def stop_stream(sid, data=None):
            """Handle stop stream request"""
            logger.info(f"Stop stream requested by {sid}")
            if self.on_stop_stream:
                await self.on_stop_stream()
            await self.sio.emit("stream_status", {"status": "stopped"}, room=sid)

        @self.sio.event
        async def change_source(sid, data):
            """Handle source change request"""
            requested_source = data.get("source", 0)
            logger.info(f"Source change requested by {sid}: {requested_source}")
            if self.on_change_source:
                try:
                    # change_source should return tuple (success, actual_source) or raise Exception
                    result = await self.on_change_source(requested_source)

                    # Handle different return types for backwards compatibility
                    if isinstance(result, tuple):
                        success, actual_source = result
                    else:
                        success = result
                        actual_source = requested_source

                    if success:
                        logger.info(f"Source changed successfully. Requested: {requested_source}, Actual: {actual_source}")

                        # Inform client about fallback if source changed
                        did_fallback = (requested_source != actual_source)
                        response = {
                            "status": "success",
                            "requested_source": requested_source,
                            "actual_source": actual_source,
                            "fallback": did_fallback
                        }

                        if did_fallback:
                            logger.warning(f"⚠️  Fallback occurred: {requested_source} → {actual_source}")
                            response["fallback_reason"] = f"Source {requested_source} not available, using {actual_source}"

                        await self.sio.emit("source_changed", response, room=sid)
                    else:
                        error_msg = "Failed to change source - camera not available"
                        logger.error(f"Source change failed: {error_msg}")
                        await self.sio.emit("source_error", {"status": "error", "message": error_msg}, room=sid)
                except ValueError as e:
                    # ValueError typically means camera not found or validation failed
                    error_msg = str(e)
                    logger.error(f"Source validation error: {error_msg}")
                    await self.sio.emit("source_error", {"status": "error", "message": error_msg}, room=sid)
                except Exception as e:
                    # Other unexpected errors
                    error_msg = f"Unexpected error changing source: {str(e)}"
                    logger.error(f"Error changing source: {e}", exc_info=True)
                    await self.sio.emit("source_error", {"status": "error", "message": error_msg}, room=sid)
            else:
                await self.sio.emit("source_error", {"status": "error", "message": "Source change not supported"}, room=sid)

        @self.sio.event
        async def toggle_heatmap(sid, data):
            """Handle heatmap visibility toggle request"""
            visible = data.get("visible", False)
            logger.info(f"Heatmap toggle requested by {sid}: visible={visible}")
            if self.on_toggle_heatmap:
                success = await self.on_toggle_heatmap(visible)
                if success:
                    await self.sio.emit("heatmap_toggled", {"status": "success", "visible": visible}, room=sid)
                else:
                    await self.sio.emit("heatmap_toggled", {"status": "error", "message": "Failed to toggle heatmap"}, room=sid)
            else:
                await self.sio.emit("heatmap_toggled", {"status": "error", "message": "Heatmap toggle not supported"}, room=sid)

    # ------------------------------------------------------------------
    # Backend readiness / status helpers (Task 1.1.1 + 1.1.3)
    # ------------------------------------------------------------------

    async def update_status(self, phase: str, **kwargs):
        """Update backend status and broadcast to all connected clients.

        Phases: initializing -> loading_model -> model_ready ->
                connecting_source -> source_connected -> streaming
                (or 'error' at any point)
        """
        self._status["phase"] = phase
        self._status.update(kwargs)
        logger.info(f"[Status] Phase: {phase}  extras={kwargs}")
        # Broadcast to every connected Socket.IO client
        await self.sio.emit("backend_status", self._status)

    def update_status_sync(self, phase: str, **kwargs):
        """Synchronous wrapper — safe to call from non-async threads."""
        self._status["phase"] = phase
        self._status.update(kwargs)
        logger.info(f"[Status-sync] Phase: {phase}  extras={kwargs}")

    def get_health(self) -> Dict:
        """Return current health dict (used by /health endpoint)."""
        return dict(self._status)

    async def broadcast_global_stream(self, data: Dict):
        """Broadcast GlobalStream data to all clients and publish to Kafka"""
        # Keep FPS metric updated in status
        # _metrics_to_stream() puts fps at top-level, not under "metrics"
        if "fps" in data:
            self._status["fps"] = data["fps"]
        await self.sio.emit("global", data)

        # Publish to Kafka if enabled
        if self.kafka_producer.enabled and 'metrics' in data:
            self.kafka_producer.publish_analytics(
                metrics=data['metrics'],
                camera_id=self.camera_id
            )

    async def broadcast_tracks(self, tracks: List[Dict]):
        """Broadcast TrackStream data to all clients"""
        await self.sio.emit("tracks", tracks)

    async def broadcast_table_region(self, region: Dict):
        """Broadcast TableRegion data to all clients"""
        await self.sio.emit("table", region)

    async def broadcast_zone_insights(self, insights: List[Dict]):
        """Broadcast zone occupancy insights to all clients and publish to Kafka"""
        await self.sio.emit("zone_insights", insights)

        # Publish insights to Kafka if enabled
        if self.kafka_producer.enabled:
            for insight in insights:
                self.kafka_producer.publish_insight(
                    insight=insight,
                    camera_id=self.camera_id
                )

    def _load_zones(self):
        """Load zones from file"""
        try:
            if self.zones_file.exists():
                with open(self.zones_file, "r") as f:
                    self.zones = json.load(f)
                logger.info(f"Loaded {len(self.zones)} zones from {self.zones_file}")
            else:
                logger.info("No zones file found, starting with empty zones")
        except Exception as e:
            logger.error(f"Error loading zones: {e}")
            self.zones = []

    def _save_zones(self):
        """Save zones to file"""
        try:
            self.zones_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.zones_file, "w") as f:
                json.dump(self.zones, f, indent=2)
            logger.info(f"Saved {len(self.zones)} zones to {self.zones_file}")
        except Exception as e:
            logger.error(f"Error saving zones: {e}")

    def get_zones(self) -> List[Dict]:
        """Get current zones configuration"""
        return self.zones

    async def start(self):
        """Start the WebSocket server"""
        runner = web.AppRunner(self.app)
        await runner.setup()

        site = web.TCPSite(runner, self.host, self.port)
        await site.start()

        logger.info(f"WebSocket server started on {self.host}:{self.port}")
        logger.info(f"Clients can connect to: http://{self.host}:{self.port}")

    async def run_forever(self):
        """Keep the server running"""
        await self.start()
        # Keep running
        await asyncio.Event().wait()


async def main():
    """Main entry point for standalone WebSocket server"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    server = AnalyticsWebSocketServer()
    await server.run_forever()


if __name__ == "__main__":
    asyncio.run(main())
