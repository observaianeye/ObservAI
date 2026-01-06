#!/bin/bash

# Zone Counting Verification Tool for ObservAI
# usage: ./verify_zones.sh

echo "🔍 ObservAI Zone Verification Tool"
echo "==================================="
echo "This script connects to the backend and checks if Zone counts are being broadcast."
echo ""

# Check if backend is likely running
if ! lsof -i :5001 > /dev/null; then
    echo "⚠️  WARNING: Backend (port 5001) does not seem to be running."
    echo "   Please start the backend with 'python backend/main.py' or equivalent."
    echo "   (If it is running on a different port, update this script)"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Ensure python-socketio is installed
if ! pip3 show "python-socketio" > /dev/null; then
    echo "📦 Installing required dependency: python-socketio..."
    pip3 install "python-socketio[client]" > /dev/null 2>&1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/packages/camera-analytics/scripts/verify_zones_socket.py"

echo "🚀 Connecting to Backend..."
python3 "$PYTHON_SCRIPT"
