#!/bin/bash

# ObservAI Camera Analytics Backend Starter
# Automatically activates venv and starts backend

cd "$(dirname "$0")/packages/camera-analytics"

echo "🚀 Starting ObservAI Camera Analytics Backend..."
echo ""

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "❌ Error: Virtual environment not found at packages/camera-analytics/venv"
    echo "Please create one with: python3 -m venv venv"
    exit 1
fi

# Activate virtual environment
echo "✓ Activating virtual environment..."
source venv/bin/activate

# Check if lap is installed
if ! python3 -c "import lap" 2>/dev/null; then
    echo "⚠️  Installing missing dependency: lap..."
    pip install lap
fi

# Start backend
echo "✓ Starting backend on 0.0.0.0:5001"
echo ""
python3 -m camera_analytics.run_with_websocket --source 0
