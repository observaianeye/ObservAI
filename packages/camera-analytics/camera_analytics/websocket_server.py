"""
WebSocket Server for real-time analytics streaming
Broadcasts camera analytics data to connected web clients
"""

from __future__ import annotations

import json
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Set

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

        # Setup event handlers
        self._setup_handlers()

    def _setup_handlers(self):
        """Setup Socket.IO event handlers"""

        @self.sio.event
        async def connect(sid, environ):
            """Handle client connection"""
            self.clients.add(sid)
            logger.info(f"Client connected: {sid} (total: {len(self.clients)})")
            await self.sio.emit("connection", {"status": "connected"}, room=sid)

        @self.sio.event
        async def disconnect(sid):
            """Handle client disconnection"""
            self.clients.discard(sid)
            logger.info(f"Client disconnected: {sid} (total: {len(self.clients)})")

        @self.sio.event
        async def ping(sid):
            """Handle ping for heartbeat"""
            await self.sio.emit("pong", room=sid)

    async def broadcast_global_stream(self, data: Dict):
        """Broadcast GlobalStream data to all clients"""
        await self.sio.emit("global", data)

    async def broadcast_tracks(self, tracks: List[Dict]):
        """Broadcast TrackStream data to all clients"""
        await self.sio.emit("tracks", tracks)

    async def broadcast_table_region(self, region: Dict):
        """Broadcast TableRegion data to all clients"""
        await self.sio.emit("table", region)

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
