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

logger = logging.getLogger(__name__)


class AnalyticsWebSocketServer:
    """WebSocket server for streaming analytics data to clients"""

    def __init__(self, host: str = "0.0.0.0", port: int = 5000):
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

        # Callbacks
        self.on_start_stream = None
        self.on_stop_stream = None
        self.on_snapshot = None
        self.on_change_source = None

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
        async def start_stream(sid):
            """Handle start stream request"""
            logger.info(f"Start stream requested by {sid}")
            if self.on_start_stream:
                await self.on_start_stream()
            await self.sio.emit("stream_status", {"status": "started"}, room=sid)

        @self.sio.event
        async def stop_stream(sid):
            """Handle stop stream request"""
            logger.info(f"Stop stream requested by {sid}")
            if self.on_stop_stream:
                await self.on_stop_stream()
            await self.sio.emit("stream_status", {"status": "stopped"}, room=sid)

        @self.sio.event
        async def change_source(sid, data):
            """Handle source change request"""
            source = data.get("source", 0)
            logger.info(f"Source change requested by {sid}: {source}")
            if self.on_change_source:
                success = await self.on_change_source(source)
                if success:
                    await self.sio.emit("source_changed", {"status": "success", "source": source}, room=sid)
                else:
                    await self.sio.emit("source_changed", {"status": "error", "message": "Failed to change source"}, room=sid)
            else:
                await self.sio.emit("source_changed", {"status": "error", "message": "Source change not supported"}, room=sid)

    async def broadcast_global_stream(self, data: Dict):
        """Broadcast GlobalStream data to all clients"""
        await self.sio.emit("global", data)

    async def broadcast_tracks(self, tracks: List[Dict]):
        """Broadcast TrackStream data to all clients"""
        await self.sio.emit("tracks", tracks)

    async def broadcast_table_region(self, region: Dict):
        """Broadcast TableRegion data to all clients"""
        await self.sio.emit("table", region)

    async def broadcast_zone_insights(self, insights: List[Dict]):
        """Broadcast zone occupancy insights to all clients"""
        await self.sio.emit("zone_insights", insights)

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
