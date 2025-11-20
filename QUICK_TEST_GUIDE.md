# Quick Test Guide - ObservAI Camera System

**Date:** November 16, 2025  
**Status:** Ready for Testing

## ⚡ Quick Start (5 minutes)

### Step 1: Start Backend (Terminal 1)
```bash
cd /Users/partalle/Projects/ObservAI
./scripts/start-camera-backend.sh 0 5000 --display
```

**Expected output:**
```
✓ WebSocket server started on 0.0.0.0:5000
[INFO] Camera source: 0
[INFO] YOLO model loaded: yolov8n.pt
[INFO] Starting camera analytics pipeline...
```

### Step 2: Start Frontend (Terminal 2)
```bash
cd /Users/partalle/Projects/ObservAI/frontend
npm run dev
```

**Expected output:**
```
  VITE v5.4.8  ready in X ms

  ➜  Local:   http://localhost:5173/
```

### Step 3: Open Browser
1. Go to http://localhost:5173
2. Login: **admin@observai.com** / **demo1234**
3. Navigate to **Camera Analytics**
4. Toggle to **Live** mode (top right)
5. Camera should start automatically

### Step 4: Verify It Works
Stand in front of your MacBook camera. You should see:
- ✅ Detection count increases (bottom right)
- ✅ Green/blue bounding box around you
- ✅ Gender symbol (♂/♀) and age label
- ✅ Dwell time counting up
- ✅ "Backend Connected" green indicator
- ✅ Charts updating with real data

---

## 🧪 Test Checklist

### Basic Functionality
- [ ] MacBook camera shows video
- [ ] Detection count > 0 when in frame
- [ ] Bounding box appears around person
- [ ] Demographics show (gender, age, time)
- [ ] Charts update with real-time data
- [ ] Backend status shows "Connected" (green)

### Camera Sources
- [ ] **MacBook:** Default, should work immediately
- [ ] **iPhone:** Settings → iPhone (requires Continuity Camera)
- [ ] **Screen:** Settings → Screen Capture (local preview only)
- [ ] **Stream URL:** Settings → Advanced → Enter URL → See backend command
- [ ] **Local File:** Settings → Advanced → Choose file → Plays locally
- [ ] **IP Camera:** Settings → Advanced → Add IP Camera → See backend command

### Zone Labeling
- [ ] Go to Zone Labeling page
- [ ] Click "Capture Camera" → Snapshot appears
- [ ] Click "Add Zone" → Draw rectangle
- [ ] Name it "Test Zone", select "Entrance"
- [ ] Click "Save All"
- [ ] Return to Camera Analytics
- [ ] Green dashed rectangle appears on video

### Fullscreen
- [ ] Click fullscreen icon (⛶) in camera card
- [ ] Enters fullscreen mode
- [ ] Press ESC
- [ ] Returns to normal view

---

## 🐛 Troubleshooting

### "Backend Offline" yellow indicator
**Cause:** Backend not running or wrong port

**Fix:**
```bash
# Check if backend is running
lsof -i :5000

# If nothing, start backend
./scripts/start-camera-backend.sh 0 5000
```

### "Detection: 0" never changes
**Cause:** YOLO model not detecting or you're out of frame

**Fix:**
- Move in front of camera
- Check backend terminal for errors
- Verify backend logs show "Detections: X people"

### Camera permission denied
**Cause:** macOS hasn't granted camera access

**Fix:**
1. System Settings → Privacy & Security → Camera
2. Enable Chrome/Safari
3. Restart browser
4. Try again

### No video shows
**Cause:** Another app using camera (Zoom, Teams, etc.)

**Fix:**
- Close other apps using camera
- Restart browser
- Try again

### Backend crashes on startup
**Cause:** Missing dependencies or camera busy

**Fix:**
```bash
# Reinstall dependencies
cd /Users/partalle/Projects/ObservAI/packages/camera-analytics
pip install -e .

# Try different camera source
./scripts/start-camera-backend.sh 1 5000  # Try device 1
```

---

## 📋 Backend Commands Cheat Sheet

### Webcam (Default)
```bash
./scripts/start-camera-backend.sh 0 5000
```

### Webcam with OpenCV Window
```bash
./scripts/start-camera-backend.sh 0 5000 --display
```

### Video File
```bash
./scripts/start-camera-backend.sh "/path/to/video.mp4" 5000
```

### IP Camera (RTSP)
```bash
./scripts/start-camera-backend.sh "rtsp://admin:password@192.168.1.100:554/stream" 5000
```

### YouTube Stream (requires yt-dlp)
```bash
brew install yt-dlp  # First time only
./scripts/start-camera-backend.sh "https://youtube.com/watch?v=VIDEO_ID" 5000
```

---

## 📊 Expected Backend Output

### Normal Operation
```
[INFO] Processing frame... FPS: 28.5
[INFO] Detections: 1 people
[INFO] Track track_123: male, adult, 15.3s
[INFO] Emitting analytics: entries=5, exits=3, current=2
```

### When Frontend Connects
```
[INFO] Client connected: abc123xyz
[INFO] Socket.IO client count: 1
```

### When You're Detected
```
[INFO] New track: track_456
[INFO] Demographics: male, adult (25-34)
[INFO] State: entering → present
[INFO] Dwell time: 5.2s
```

---

## 🎯 Success Criteria

### You know it's working when:
1. **Video plays** - Your MacBook camera shows in the browser
2. **Backend logs** - Show "Detections: X people" when you're in frame
3. **Frontend shows** - "Backend Connected" green indicator
4. **Bounding box** - Green/blue rectangle around you
5. **Demographics** - ♂/♀ symbol, age label, time counter
6. **Detection count** - Bottom right shows "Detected: 1"
7. **Charts update** - Gender and age charts change
8. **Visitor count** - "Current Visitors" increases

---

## 📁 Key Files Reference

### Frontend
- **Camera component:** `frontend/src/components/camera/CameraFeed.tsx`
- **Socket.IO service:** `frontend/src/services/cameraBackendService.ts`
- **Analytics service:** `frontend/src/services/analyticsDataService.ts`
- **Zone canvas:** `frontend/src/components/camera/ZoneCanvas.tsx`

### Backend
- **Startup script:** `scripts/start-camera-backend.sh`
- **Main module:** `packages/camera-analytics/camera_analytics/`

### Documentation
- **Full status:** `IMPLEMENTATION_STATUS.md`
- **Session summary:** `SESSION_4_COMPLETE.md`
- **Turkish guide:** `frontend/KAMERA_SISTEMI_TR.md`
- **This file:** `QUICK_TEST_GUIDE.md`

---

## ⏱️ Time Estimates

| Test | Duration |
|------|----------|
| Basic backend connection | 2 min |
| MacBook camera test | 3 min |
| Zone labeling test | 5 min |
| Fullscreen test | 1 min |
| All camera sources | 10 min |
| **Total** | **~20 min** |

---

## 🆘 Get Help

### Console Logs
**Browser (F12 → Console):**
```
[CameraBackend] Connected to backend
[CameraFeed] Received detections: 2
[CameraFeed] Connecting to backend: http://localhost:5000
```

**Backend Terminal:**
```
[INFO] Starting camera analytics pipeline...
[INFO] Client connected: abc123
[INFO] Detections: 2 people
```

### Common Error Messages

**"No active camera feed found"**
- Go to Camera Analytics page first
- Start camera in Live mode
- Then capture snapshot

**"No secondary camera found"**
- iPhone not connected
- Continuity Camera not enabled
- Try USB connection

**"Permission denied"**
- System Settings → Privacy → Camera/Screen Recording
- Enable browser
- Restart browser

---

## ✅ Final Checklist

Before considering testing complete:

- [ ] Backend starts without errors
- [ ] Frontend connects to backend (green indicator)
- [ ] Real-time detections appear (non-zero count)
- [ ] Bounding boxes render correctly
- [ ] Demographics display (gender, age, time)
- [ ] Charts update with live data
- [ ] Zones can be drawn and saved
- [ ] Zones appear on live feed
- [ ] Fullscreen mode works
- [ ] All camera sources accessible
- [ ] Error messages are clear

---

**If all checkboxes are checked, the system is working correctly! 🎉**

---

**Need more details?** See `SESSION_4_COMPLETE.md` for full technical documentation.

