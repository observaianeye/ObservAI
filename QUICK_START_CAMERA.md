# Quick Start - ObservAI Camera Analytics

**Last Updated:** 2025-11-16
**Status:** Partial Implementation (Backend Integration in Progress)

## What's Working Now

✅ **Socket.IO Integration:**
- Installed `socket.io-client`
- Created `cameraBackendService.ts` for backend communication
- Updated `analyticsDataService.ts` to use Socket.IO

✅ **Backend Exists:**
- Python YOLOv8 detection pipeline at `/packages/camera-analytics/`
- Socket.IO server on port 5000
- Supports webcam, video files, IP cameras, YouTube streams

⏳ **In Progress:**
- CameraFeed.tsx full integration with Socket.IO
- Detection overlay rendering
- All camera source types (iPhone, Zoom, etc.)

## Quick Test - See Real Detections

### Step 1: Start the Backend

```bash
# From project root
./scripts/start-camera-backend.sh

# Or manually:
cd packages/camera-analytics
source .venv/bin/activate
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5000 --display
```

**What This Does:**
- Opens your MacBook camera (source 0)
- Runs YOLOv8 person detection
- Streams results via Socket.IO on port 5000
- `--display` flag shows OpenCV window with overlays

**Expected Output:**
```
✓ WebSocket server started on 0.0.0.0:5000
[INFO] Starting camera analytics pipeline...
[INFO] Face detection interval: every 10 frames
[INFO] Video stride: 1 (source: 0)
```

### Step 2: Start the Frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:5173

### Step 3: Login & Navigate

1. Login with: `admin@observai.com` / `demo1234`
2. Go to **Camera Analytics** page
3. Switch to **Live** mode (toggle at top)

### Step 4: Check Browser Console

Open Developer Tools (F12) and look for:

```
[CameraBackend] Connecting to http://localhost:5000...
[CameraBackend] Connected to backend
[LiveDataProvider] Connected to camera backend
```

If you see analytics data coming in:
```
{
  timestamp: 1700000000000,
  entries: 5,
  exits: 2,
  current: 3,
  demographics: { gender: { male: 2, female: 1 } ...}
}
```

**You're connected!** ✅

---

## Troubleshooting

### Issue: "Connection error"

**Check:**
1. Is backend running? (`ps aux | grep camera_analytics`)
2. Is it on port 5000? (not 5001)
3. Check backend logs for errors

**Fix:**
```bash
# Kill any existing backends
pkill -f camera_analytics

# Restart
./scripts/start-camera-backend.sh
```

### Issue: Camera permission denied

**macOS:**
1. System Preferences → Privacy & Security → Camera
2. Add Terminal (or your IDE) to allowed apps
3. Restart terminal/IDE

### Issue: YOLO model not found

**Fix:**
```bash
cd packages/camera-analytics
source .venv/bin/activate
pip install ultralytics
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```

This downloads the model (~6MB).

### Issue: No detections appearing

**Check:**
1. Are you in front of the camera?
2. Is lighting adequate?
3. Check backend OpenCV window (if using `--display`)

**Backend logs should show:**
```
[INFO] Face detection interval: every 10 frames
```

If you see errors about InsightFace, that's OK - it's optional for demographics.

---

## What Each Component Does

### Backend (`camera_analytics/`)
- **`analytics.py`** - Main YOLO detection engine
- **`run_with_websocket.py`** - Socket.IO server wrapper
- **`websocket_server.py`** - Socket.IO event handling
- **`config/default_zones.yaml`** - Zone definitions

### Frontend (`frontend/src/`)
- **`services/cameraBackendService.ts`** - Socket.IO client wrapper
- **`services/analyticsDataService.ts`** - Data aggregation (Demo/Live)
- **`components/camera/CameraFeed.tsx`** - Video display & overlays
- **`pages/dashboard/CameraAnalyticsPage.tsx`** - Main dashboard

---

## Testing Different Camera Sources

### Webcam (MacBook Camera)
```bash
./scripts/start-camera-backend.sh 0
```

### External USB Camera
```bash
./scripts/start-camera-backend.sh 1
```

### Video File
```bash
./scripts/start-camera-backend.sh /path/to/video.mp4
```

### IP Camera (RTSP)
```bash
./scripts/start-camera-backend.sh "rtsp://admin:password@192.168.1.100:554/stream"
```

### YouTube Live Stream
```bash
# Requires yt-dlp: brew install yt-dlp
./scripts/start-camera-backend.sh "https://www.youtube.com/watch?v=VIDEO_ID"
```

---

## Current Limitations (To Be Fixed)

1. ❌ CameraFeed.tsx not yet fully updated to use Socket.IO
2. ❌ Detection overlays not rendering from backend data
3. ❌ iPhone camera switching not implemented
4. ❌ Zoom screen capture has permission issues
5. ❌ YouTube URL input UI not added
6. ❌ Local file upload UI not added
7. ❌ IP camera config UI not added
8. ❌ Zone labeling not connected to camera
9. ❌ Fullscreen button not functional

**These will be fixed in the next iteration.**

---

## Immediate Next Steps

To complete the integration:

1. **Update CameraFeed.tsx** to:
   - Import `cameraBackendService`
   - Subscribe to `tracks` event
   - Render detection bounding boxes from backend data

2. **Add missing UI elements**:
   - Stream URL input
   - File upload button
   - IP camera configuration
   - Fullscreen handler

3. **Fix camera source switching**:
   - Send source change to backend via API
   - Or: Restart backend with new source

4. **Connect zone labeling**:
   - Load camera snapshot as background
   - Save zones to backend config file

---

## Expected Behavior When Complete

When all fixes are done:

1. Start backend → YOLO detections running
2. Start frontend → Socket.IO connected
3. Open Camera Analytics page
4. Switch to Live mode
5. **See:**
   - Current Visitors: real count
   - Entry/Exit: real counts
   - Bounding boxes on video
   - Age/gender labels
   - Charts updating in real-time

---

## Technical Details

### Socket.IO Events

**From Backend to Frontend:**
- `connection` - Connection established
- `global` - Analytics metrics (every 1 second)
  ```json
  {
    "timestamp": 1700000000,
    "entries": 10,
    "exits": 5,
    "current": 5,
    "demographics": {
      "gender": { "male": 3, "female": 2 },
      "ages": { "adult": 4, "teen": 1 }
    },
    "heatmap": { "points": [...] },
    "fps": 15.2
  }
  ```

- `tracks` - Individual detections (every frame)
  ```json
  [
    {
      "id": "track_1",
      "bbox": [0.2, 0.3, 0.4, 0.5],
      "gender": "male",
      "ageBucket": "adult",
      "dwellSec": 45.2,
      "state": "present"
    }
  ]
  ```

**From Frontend to Backend:**
- `ping` - Heartbeat check

### Data Flow

```
MacBook Camera
  ↓
OpenCV VideoCapture
  ↓
YOLO Detection (YOLOv8-nano)
  ↓
InsightFace (optional - demographics)
  ↓
Socket.IO Server (port 5000)
  ↓ emit('global') + emit('tracks')
Socket.IO Client (React)
  ↓
cameraBackendService
  ↓
analyticsDataService
  ↓
React Components (Charts, CameraFeed)
```

---

## For Developers

### Adding a New Camera Source Type

1. **Backend:** Already supports via `--source` parameter
2. **Frontend:** Add to `CameraSource` type in CameraFeed.tsx
3. **UI:** Add button to camera source selector
4. **Integration:** Send source to backend via API or restart backend

### Modifying Detection Logic

Edit `/packages/camera-analytics/camera_analytics/analytics.py`:
- Line 90-227: `CameraAnalyticsEngine` class
- Line 174-226: Main detection loop
- Line 228-264: Track updates and metrics

### Changing Analytics Update Frequency

**Backend:** `/packages/camera-analytics/camera_analytics/run_with_websocket.py`
```python
sample_interval=1.0,  # Change this (seconds)
```

**Frontend:** `/frontend/src/services/analyticsDataService.ts`
```typescript
}, 5000); // Change this (milliseconds)
```

---

**Status:** Backend is ready. Frontend integration in progress.

**Next:** Complete CameraFeed.tsx updates and test end-to-end.
