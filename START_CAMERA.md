# How to Start ObservAI Camera Analytics

## Quick Start (Choose ONE method)

### Method 1: Using Installed Packages (If Available)

```bash
python3 -m camera_analytics.run_with_websocket --source 0
```

### Method 2: Direct Python Execution (Recommended)

```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
python3 camera_analytics/run_with_websocket.py --source 0
```

### Method 3: With PYTHONPATH

```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
PYTHONPATH=. python3 -m camera_analytics.run_with_websocket --source 0
```

## Fixing Current Issues

### Problem: ModuleNotFoundError

If you see this error, your Python dependencies aren't installed.

**Install dependencies:**
```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
pip3 install --user -r requirements.txt
```

Or install individually:
```bash
pip3 install --user pyyaml opencv-python ultralytics numpy
```

### Problem: Camera Already Running

If camera is stuck:
```bash
# Find and kill process
lsof -ti:5000 | xargs kill -9
```

### Problem: Wrong Camera Analytics

Each camera needs its own backend instance:

```bash
# MacBook Camera (Port 5000)
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
python3 camera_analytics/run_with_websocket.py --source 0 --ws-port 5000

# iPhone Camera (Port 5001) - In NEW terminal
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
python3 camera_analytics/run_with_websocket.py --source 1 --ws-port 5001
```

## Complete Startup Sequence

### 1. Stop Any Running Cameras
```bash
lsof -ti:5000 | xargs kill -9
lsof -ti:5001 | xargs kill -9
```

### 2. Start MacBook Camera
```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
python3 camera_analytics/run_with_websocket.py --source 0
```

### 3. Start Frontend (New Terminal)
```bash
cd /Users/partalle/Projects/ObservAI/frontend
npm run dev
```

### 4. Open Browser
```
http://localhost:5173
```

## Testing Different Sources

### Webcam Index
```bash
python3 camera_analytics/run_with_websocket.py --source 0  # MacBook
python3 camera_analytics/run_with_websocket.py --source 1  # iPhone/USB
```

### YouTube Live
```bash
python3 camera_analytics/run_with_websocket.py --source "https://www.youtube.com/watch?v=VIDEO_ID"
```

### RTSP Camera
```bash
python3 camera_analytics/run_with_websocket.py --source "rtsp://192.168.1.100:554/stream"
```

### Screen Capture
```bash
python3 camera_analytics/run_with_websocket.py --source screen
```

## Troubleshooting

### "No module named 'yaml'"
```bash
pip3 install --user pyyaml
```

### "No module named 'cv2'"
```bash
pip3 install --user opencv-python
```

### "No module named 'ultralytics'"
```bash
pip3 install --user ultralytics
```

### Camera Feed Not Showing
1. Check backend is running: `http://localhost:5000/health` should return error
2. Check WebSocket connection in browser console
3. Refresh page

### Wrong Analytics Data
- Make sure frontend is connected to correct port (5000 for MacBook, 5001 for iPhone)
- Stop and restart backend
- Clear browser cache

## Frontend Configuration

The frontend hardcodes connection to `http://localhost:5000`.

To use different cameras:
1. Start backend on port 5000
2. Change `--source` parameter
3. Restart backend

## Current Limitations

1. **One camera at a time**: Frontend can only connect to one WebSocket (port 5000)
2. **Manual switching**: Must stop/start backend to change cameras
3. **No auto-reconnect**: Must refresh page if backend restarts
4. **No camera stop button**: Must kill process manually

## Recommended Workflow

1. Decide which camera to use
2. Start that camera's backend
3. Open frontend
4. To switch cameras: Kill backend process, start new camera, refresh browser

