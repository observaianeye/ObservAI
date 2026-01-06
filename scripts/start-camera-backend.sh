#!/bin/bash

# ObservAI Camera Analytics Backend Startup Script
# This script starts the Python backend with YOLO detection and Socket.IO streaming

set -e

echo "================================================"
echo " ObservAI Camera Analytics Backend"
echo "================================================"
echo ""

# Navigate to camera-analytics package
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CAMERA_PKG="$PROJECT_ROOT/packages/camera-analytics"

cd "$CAMERA_PKG"

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "⚠️  Virtual environment not found. Creating..."
    python3 -m venv .venv
    source .venv/bin/activate
    echo "📦 Installing dependencies..."
    pip install -e .
else
    echo "✓ Virtual environment found"
    source .venv/bin/activate
fi

# Check if YOLO model exists
if [ ! -f "yolov8n.pt" ]; then
    echo "📥 Downloading YOLOv8-nano model..."
    echo "   (This will happen automatically on first run)"
fi

# Parse command line arguments
SOURCE="${1:-0}"  # Default to webcam (index 0)
WS_PORT="${2:-5000}"  # Default to port 5000
DISPLAY_FLAG=""

if [ "$3" == "--display" ]; then
    DISPLAY_FLAG="--display"
    echo "🖥️  Display mode enabled (OpenCV window will show)"
fi

echo ""
echo "Configuration:"
echo "  Source: $SOURCE"
echo "  WebSocket Port: $WS_PORT"
echo "  Display: ${DISPLAY_FLAG:-disabled}"
echo ""

# Check if source is a file
if [ -f "$SOURCE" ]; then
    echo "📹 Using video file: $SOURCE"
elif [[ "$SOURCE" =~ ^rtsp:// ]] || [[ "$SOURCE" =~ ^http:// ]] || [[ "$SOURCE" =~ ^https:// ]]; then
    echo "🌐 Using stream URL: $SOURCE"
elif [[ "$SOURCE" =~ ^[0-9]+$ ]]; then
    echo "📷 Using camera device: /dev/video$SOURCE"
else
    echo "🎥 Using source: $SOURCE"
fi

echo ""
echo "🚀 Starting camera analytics backend..."
echo "   Backend will be available at: http://localhost:$WS_PORT"
echo "   Frontend should connect to: http://localhost:$WS_PORT"
echo ""
echo "Press Ctrl+C to stop"
echo "================================================"
echo ""

# Start the backend
python -m camera_analytics.run_with_websocket \
    --source "$SOURCE" \
    --ws-port "$WS_PORT" \
    $DISPLAY_FLAG

echo ""
echo "Backend stopped."
