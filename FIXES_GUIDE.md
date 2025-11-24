# ObservAI Fixes Guide

This document addresses all the issues found during testing.

## Issue #1: Dashboard Color Inconsistency

**Problem**: Dashboard pages have different color schemes compared to login/register/landing pages.

**Root Cause**: Dashboard uses dark theme while auth pages use light theme with particle background.

**Fix Required**:
All dashboard pages need consistent styling matching the login page design:
- Background: Light with subtle gradient
- Cards: White with subtle shadows
- Text: Dark gray (#1f2937) for headers
- Accents: Blue (#3b82f6)

**Files to Update**:
- `/frontend/src/pages/dashboard/*.tsx` - All dashboard pages
- `/frontend/src/components/layout/DashboardLayout.tsx` - Main layout

**Solution**: Create a unified theme configuration file.

---

## Issue #2: Camera Switching Doesn't Work

**Problem**: Switching cameras in UI doesn't actually change the video source. MacBook camera keeps running.

**Root Cause**:
1. Frontend doesn't have camera source switching logic
2. Python backend connects to only ONE source at startup
3. No mechanism to tell backend to switch sources
4. Multiple camera instances would require multiple Python processes

**Current Architecture**:
```
Python Backend (Port 5000) ──> WebSocket ──> Frontend
   └── Single camera source (hardcoded at startup)
```

**Solution Options**:

### Option A: Multiple Backend Instances (Recommended)
Run separate Python backend for each camera source:
```bash
# Terminal 1: MacBook Camera
cd packages/camera-analytics
./run_camera.sh --source 0 --ws-port 5000

# Terminal 2: iPhone Camera
./run_camera.sh --source 1 --ws-port 5001

# Terminal 3: RTSP Camera
./run_camera.sh --source rtsp://192.168.1.100:554/stream --ws-port 5002
```

Frontend connects to different ports based on selected camera.

### Option B: Dynamic Source Switching (Complex)
Add WebSocket command to change source at runtime:
```python
@self.sio.event
async def change_source(sid, data):
    new_source = data.get("source")
    # Stop current camera
    # Start new camera
    # Restart analytics engine
```

**Recommended**: Use Option A for now.

---

## Issue #3: Python Module Import Error

**Problem**:
```
python3 -m camera_analytics.run_with_websocket
ModuleNotFoundError: No module named 'camera_analytics'
```

**Root Cause**: Package not installed in Python path.

**Solution**:

### Quick Fix - Use Shell Script
```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
chmod +x run_camera.sh
./run_camera.sh --source 0
```

### Proper Fix - Install Package
```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics

# Option 1: Install with break-system-packages
python3 -m pip install --break-system-packages -e .

# Option 2: Use virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate
pip install -e .
python3 -m camera_analytics.run_with_websocket --source 0
```

### Alternative - Run Directly
```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
python3 -m camera_analytics.run_with_websocket --source 0
```

---

## Issue #4: Zone Labeling Camera Capture Error

**Problem**: "No active camera feed found. Please start the camera first from the Camera Analytics page in Live mode."

**Root Cause**:
- Zone labeling page tries to capture from video element
- Video element might not be loaded/playing
- No check if camera backend is actually running

**Solution**:

### Check Backend is Running
```bash
# Check if Python backend is running
lsof -ti:5000
```

If nothing returned, start backend:
```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
./run_camera.sh --source 0
```

### Code Fix Needed
File: `/frontend/src/pages/dashboard/ZoneLabelingPage.tsx`

Add proper camera state detection:
```typescript
// Check if WebSocket is connected
const isBackendConnected = cameraBackendService.getConnectionStatus();

// Check if video element is playing
const isVideoPlaying = videoRef.current &&
                      !videoRef.current.paused &&
                      videoRef.current.readyState === 4;

if (!isBackendConnected || !isVideoPlaying) {
  alert('Please wait for camera to fully load');
  return;
}
```

---

## Issue #5: Camera Error on Navigation

**Problem**:
```
The play() request was interrupted by a new load request.
https://goo.gl/LdLk22
```

**Root Cause**:
- Video element src changes when navigating between pages
- React remounts video element
- Browser interrupts previous play() call

**Solution**:

### Lift Camera State to Layout Level
Instead of creating new camera feed on each page, maintain single feed at layout level:

File: `/frontend/src/components/layout/DashboardLayout.tsx`
```typescript
// Maintain single camera connection
const [cameraFeed, setCameraFeed] = useState<MediaStream | null>(null);

// Pass camera feed to child pages via context
<CameraContext.Provider value={{ cameraFeed, setCameraFeed }}>
  {children}
</CameraContext.Provider>
```

### Alternative: Use key prop
```typescript
<CameraFeed key={currentPage} />
```

This forces React to unmount old video before mounting new one.

---

## Issue #6: MacBook Camera Doesn't Stop

**Problem**: Camera keeps running even after switching to different camera.

**Root Cause**:
- Python backend process continues running
- No stop mechanism
- Frontend doesn't disconnect WebSocket properly

**Solution**:

### Stop Python Backend
```bash
# Find process
lsof -ti:5000

# Kill process
kill $(lsof -ti:5000)
```

### Add Stop Button in UI
File: `/frontend/src/components/camera/CameraFeed.tsx`

Add button:
```typescript
<button onClick={() => {
  cameraBackendService.disconnect();
  // Stop Python backend via API call
  fetch('http://localhost:5000/stop', { method: 'POST' });
}}>
  Stop Camera
</button>
```

Add endpoint in Python:
```python
@app.route('/stop', methods=['POST'])
def stop_camera():
    # Stop analytics engine
    # Shutdown gracefully
    return {'status': 'stopped'}
```

---

## Issue #7: iPhone Camera Shows MacBook Insights

**Problem**: iPhone camera video displays but analytics data comes from MacBook camera.

**Root Cause**:
- Frontend connects to WebSocket on port 5000 (MacBook backend)
- iPhone camera likely not running its own backend on different port
- Frontend doesn't know which backend to connect to

**Solution**:

### Run Separate Backend for iPhone
```bash
# Terminal 1: MacBook Camera
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
./run_camera.sh --source 0 --ws-port 5000

# Terminal 2: iPhone Camera
./run_camera.sh --source 1 --ws-port 5001
```

### Update Frontend to Switch WebSocket Connections
File: `/frontend/src/services/cameraBackendService.ts`

```typescript
switchCamera(sourceConfig: SourceConfig) {
  // Disconnect from current
  this.disconnect();

  // Determine port based on source
  const port = sourceConfig.type === 'webcam' && sourceConfig.value === '0'
    ? 5000
    : 5001;

  // Reconnect to correct backend
  this.connect(`http://localhost:${port}`);
}
```

---

## Complete Setup Steps

### 1. Start Backend(s)

```bash
# Terminal 1: MacBook Camera
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
python3 -m camera_analytics.run_with_websocket --source 0 --ws-port 5000

# Terminal 2: iPhone Camera (optional)
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
python3 -m camera_analytics.run_with_websocket --source 1 --ws-port 5001
```

### 2. Start Frontend

```bash
cd /Users/partalle/Projects/ObservAI/frontend
npm run dev
```

### 3. Verify Connections

- MacBook camera: http://localhost:5000/health
- iPhone camera: http://localhost:5001/health
- Frontend: http://localhost:5173

---

## Quick Fixes Summary

| Issue | Quick Fix Command |
|-------|------------------|
| Module not found | `cd packages/camera-analytics && export PYTHONPATH="${PYTHONPATH}:$(pwd)"` |
| Camera not stopping | `kill $(lsof -ti:5000)` |
| Wrong analytics | Connect frontend to correct port (5000 vs 5001) |
| Zone capture fails | Wait for video to fully load, check backend is running |
| Navigation error | Add `key` prop to CameraFeed component |

---

## Long-term Architecture Fix

The proper solution is to implement a **Camera Manager Service**:

```
Frontend
   ↓
Camera Manager API (Port 3002)
   ↓
Manages Multiple Python Processes
   ├── MacBook Camera (Port 5000)
   ├── iPhone Camera (Port 5001)
   └── RTSP Camera (Port 5002)
```

The manager would:
1. Start/stop Python backends on demand
2. Route WebSocket connections
3. Handle camera switching
4. Manage port allocation

This requires a Node.js service that spawns child processes.

---

## Testing Checklist

- [ ] Python backend starts without module error
- [ ] MacBook camera shows analytics
- [ ] iPhone camera shows its own analytics (not MacBook's)
- [ ] Switching cameras changes both video and analytics
- [ ] Zone capture works when camera is running
- [ ] Navigation doesn't cause play() errors
- [ ] Stopping camera actually stops Python process
- [ ] Dashboard colors match login page theme

