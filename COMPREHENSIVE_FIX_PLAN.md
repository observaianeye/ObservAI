# Comprehensive Fix Plan - ObservAI Camera System
**Date:** 2025-11-16
**Scope:** Fix all 10 critical issues within 20% Prototype

## Architecture Overview

### Backend (Python - Already Exists)
- **Location:** `/packages/camera-analytics/`
- **Main File:** `camera_analytics/run_with_websocket.py`
- **YOLO Model:** YOLOv8-nano (yolov8n.pt)
- **Transport:** Socket.IO on port 5000
- **Events:**
  - `global` - Analytics metrics (entries, exits, current, demographics, heatmap, FPS)
  - `tracks` - Individual detections with bounding boxes
- **Source Support:**
  - `--source 0` - Webcam (camera index)
  - `--source /path/to/video.mp4` - Local video file
  - `--source rtsp://...` - IP camera (RTSP)
  - `--source https://youtube.com/...` - YouTube (requires yt-dlp)

### Frontend (React + TypeScript)
- **Transport Change:** WebSocket → Socket.IO client
- **Package Added:** `socket.io-client`
- **Backend URL:** `http://localhost:5000` (was 5001, now corrected)

## Issue-by-Issue Implementation Plan

### Issue 1: Camera image visible but no analytics processed ✅ PARTIALLY DONE
**Problem:** Current visitors, detections stay at 0, charts empty
**Root Cause:** Frontend not connected to Socket.IO backend properly

**Solution:**
1. ✅ Created `cameraBackendService.ts` - Socket.IO client wrapper
2. ✅ Updated `analyticsDataService.ts` - Use Socket.IO instead of WebSocket
3. ⏳ Update `CameraFeed.tsx` - Display detections from `tracks` event
4. ⏳ Create backend startup script

**Backend Command:**
```bash
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
python -m camera_analytics.run_with_websocket --source 0 --ws-port 5000
```

**Data Flow:**
```
MacBook Camera (source 0)
  ↓ (video frames)
YOLOv8 Detection
  ↓ (bounding boxes + demographics)
Socket.IO Server (port 5000)
  ↓ emit('global') + emit('tracks')
Frontend React App
  ↓
Charts + Overlays Updated
```

---

### Issue 2: Fullscreen button does nothing ⏳ TODO
**Solution:** Add fullscreen functionality to CameraFeed.tsx

**Implementation:**
```typescript
const handleFullscreen = () => {
  const container = videoContainerRef.current;
  if (!document.fullscreenElement) {
    container?.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};

// Listen for fullscreen changes
useEffect(() => {
  const handleFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
}, []);
```

---

### Issue 3: iPhone camera source does not actually switch ⏳ TODO
**Problem:** Selecting "iPhone" changes UI text but not actual stream

**Solution Options:**

#### Option A: Remote Device Pairing (Recommended for Prototype)
1. Create a simple pairing flow with QR code
2. iPhone opens camera page in browser
3. iPhone streams directly to backend via Socket.IO
4. Dashboard receives stream from backend

#### Option B: USB Tethering (Simpler but Limited)
1. Use iPhone as webcam via Continuity Camera (macOS feature)
2. iPhone appears as camera device in macOS
3. Select it as source in backend

**Prototype Implementation (Option B):**
- Document that iPhone must be connected via Continuity Camera
- Backend uses camera index 1 or 2 for iPhone
- UI allows selecting different camera indices

**Backend Command for iPhone:**
```bash
python -m camera_analytics.run_with_websocket --source 1 --ws-port 5000
```

---

### Issue 4: Zoom screen capture permissions ⏳ TODO
**Problem:** getDisplayMedia() loops, can't select screen

**Solution:**
1. Check for HTTPS requirement (getDisplayMedia only works on localhost or HTTPS)
2. Add proper error handling
3. Show clear instructions if permissions denied

**Implementation:**
```typescript
case 'zoom':
  try {
    if (!navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen sharing not supported. Use HTTPS or localhost.');
    }

    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        cursor: 'always' // Show cursor in capture
      },
      audio: false
    });

    // Screen capture successful
    setIsStreaming(true);
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      setError('Screen recording permission denied. Check System Preferences → Privacy & Security → Screen Recording');
    } else if (err.name === 'NotSupportedError') {
      setError('Screen sharing requires HTTPS or localhost');
    } else {
      setError(err.message);
    }
  }
  break;
```

**Limitation:** Screen capture in browser won't send to Python backend for YOLO processing (browser limitation). For prototype, document this as "local preview only".

---

### Issue 5: YouTube/livestream URLs not supported ⏳ TODO
**Problem:** No UI to input YouTube URL

**Solution:** Add stream URL input to camera source selector

**UI Addition:**
```tsx
{currentSource.type === 'youtube' && (
  <div className="mt-2">
    <input
      type="text"
      placeholder="Paste YouTube or stream URL..."
      value={streamUrl}
      onChange={(e) => setStreamUrl(e.target.value)}
      className="w-full px-3 py-2 border rounded-lg"
    />
    <button
      onClick={() => connectToStream(streamUrl)}
      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
    >
      Connect
    </button>
  </div>
)}
```

**Backend Integration:**
- Frontend sends stream URL to backend via API
- Backend restarts analytics with new source
- Or: Use backend directly with `--source <youtube_url>`

**Requires:** `yt-dlp` installed (`brew install yt-dlp`)

---

### Issue 6: Local video file option missing ⏳ TODO
**Solution:** Add file picker for local video

**Implementation:**
```tsx
case 'file':
  <input
    type="file"
    accept="video/*"
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) {
        handleSourceChange('file', { file });
      }
    }}
  />

  // In initializeCamera:
  if (currentSource.file && videoRef.current) {
    const url = URL.createObjectURL(currentSource.file);
    videoRef.current.src = url;
    videoRef.current.play();
    setIsStreaming(true);

    // For YOLO processing, would need to upload to backend
    // For prototype: Show video + manual upload button
  }
```

**Backend Processing:**
- Option A: Upload video to backend, backend processes it
- Option B: Play locally, no YOLO (prototype limitation)

---

### Issue 7: No way to add real IP cameras ⏳ TODO
**Solution:** Add IP camera configuration UI

**Data Structure:**
```typescript
interface IPCamera {
  id: string;
  name: string;
  url: string; // rtsp://username:password@ip:port/stream
  type: 'rtsp' | 'http' | 'rtmp';
}
```

**UI Location:** Settings page or Camera Selection page

**Implementation:**
```tsx
<div className="border rounded-lg p-4">
  <h3 className="font-semibold mb-2">IP Cameras</h3>
  {ipCameras.map(camera => (
    <button
      key={camera.id}
      onClick={() => selectIPCamera(camera)}
      className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded"
    >
      {camera.name} ({camera.type})
    </button>
  ))}
  <button onClick={() => setShowAddCamera(true)} className="mt-2 text-blue-600">
    + Add IP Camera
  </button>
</div>

{showAddCamera && (
  <form onSubmit={handleAddCamera}>
    <input name="name" placeholder="Camera name" required />
    <input name="url" placeholder="rtsp://..." required />
    <select name="type">
      <option value="rtsp">RTSP</option>
      <option value="http">HTTP</option>
      <option value="rtmp">RTMP</option>
    </select>
    <button type="submit">Add Camera</button>
  </form>
)}
```

**Storage:** localStorage for prototype (or Supabase for persistence)

**Backend:** Use camera URL as source
```bash
python -m camera_analytics.run_with_websocket --source "rtsp://admin:password@192.168.1.100:554/stream" --ws-port 5000
```

---

### Issue 8: Zone Labeling disconnected from camera ⏳ TODO
**Problem:** Zone labeling shows blank grid, not linked to camera

**Solution:**
1. Use camera snapshot as background
2. Save zones to backend config
3. Show zones as overlays on live feed

**Zone Labeling Page Updates:**
```tsx
// 1. Get camera snapshot
useEffect(() => {
  const canvas = document.createElement('canvas');
  const video = videoRef.current;
  if (video) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);
    const snapshot = canvas.toDataURL();
    setBackgroundImage(snapshot);
  }
}, []);

// 2. Draw zones on camera background
<div
  className="relative"
  style={{
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    opacity: 0.7
  }}
>
  <ZoneCanvas zones={zones} onZonesChange={setZones} />
</div>

// 3. Save zones to backend config
const handleSaveZones = async () => {
  await fetch('http://localhost:5000/api/zones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zones })
  });
};
```

**Backend Config:** `/packages/camera-analytics/config/default_zones.yaml`

---

### Issue 9: Documentation & Consistency ⏳ TODO
**Files to Create/Update:**
1. `CAMERA_SYSTEM_TR.md` - Turkish camera documentation
2. `BACKEND_SETUP_TR.md` - Turkish backend setup guide
3. Update `IMPLEMENTATION_STATUS.md`
4. Update `frontend/OKUBENI.md`

---

### Issue 10: Acceptance Checklist ⏳ TODO
**Testing Plan:**
1. ✅ Install Socket.IO client
2. ✅ Create backend service wrapper
3. ⏳ Start Python backend with webcam
4. ⏳ Verify detections appear in dashboard
5. ⏳ Test fullscreen
6. ⏳ Test iPhone camera (via Continuity)
7. ⏳ Test screen capture with proper error messages
8. ⏳ Test YouTube URL input
9. ⏳ Test local video file
10. ⏳ Test IP camera configuration
11. ⏳ Test zone labeling with camera background
12. ⏳ Build and typecheck

---

## Implementation Priority

### Phase 1: Core Analytics (Issue 1) - CURRENT
1. ✅ Install socket.io-client
2. ✅ Create cameraBackendService.ts
3. ✅ Update analyticsDataService.ts
4. ⏳ Update CameraFeed.tsx to use Socket.IO detections
5. ⏳ Create backend startup script
6. ⏳ Test with real camera

### Phase 2: Camera Sources (Issues 3-7)
1. Fix iPhone camera switching
2. Fix Zoom screen capture errors
3. Add YouTube URL input
4. Add local file upload
5. Add IP camera config

### Phase 3: UI Enhancements (Issues 2, 8)
1. Add fullscreen functionality
2. Connect zone labeling to camera

### Phase 4: Documentation (Issue 9)
1. Write Turkish docs
2. Update English docs

### Phase 5: Testing (Issue 10)
1. End-to-end testing
2. Acceptance checklist verification

---

## Next Steps

**Immediate Actions:**
1. Update CameraFeed.tsx to use cameraBackendService for detections
2. Create backend startup helper script
3. Test with real MacBook camera
4. Then proceed with other issues systematically

**Backend Startup Script:** `scripts/start-camera-backend.sh`
```bash
#!/bin/bash
cd "$(dirname "$0")/../packages/camera-analytics"

# Activate virtual environment
source .venv/bin/activate

# Start backend with webcam
python -m camera_analytics.run_with_websocket \
  --source 0 \
  --ws-port 5000 \
  --display

echo "Camera analytics backend started on http://localhost:5000"
echo "Press Ctrl+C to stop"
```

---

**Status:** Ready to implement Phase 1 fixes
