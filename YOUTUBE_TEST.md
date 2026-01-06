# YouTube Video Stream Test Guide

## ✅ Prerequisites Installed

- ✅ yt-dlp (installed in venv)
- ✅ ffmpeg (system-wide)
- ✅ Python dependencies

## 🎬 Test YouTube Videos

### Option 1: YouTube Regular Video (Recommended for Testing)
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

### Option 2: YouTube Live Stream
```
https://www.youtube.com/watch?v=jfKfPfyJRdk
```
(Note: Live stream URL may change, search for "lofi hip hop" on YouTube)

### Option 3: Direct Video URL (MP4)
```
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
```

## 📋 How to Test

1. Start all services:
   ```bash
   ./start-all.sh
   ```

2. Open browser: `http://localhost:5173`

3. Switch to **Live Mode**

4. Click camera settings (⚙️ icon)

5. In "Video Link" field, paste one of the URLs above

6. Click **Connect**

7. Wait 5-10 seconds for:
   - Backend to extract stream URL
   - Analytics to start
   - MJPEG stream to initialize

8. ✅ You should see:
   - Video playing in the camera feed
   - Person detection boxes (if people in video)
   - Age and gender labels

## 🔍 Troubleshooting

If video doesn't load:

1. **Check backend logs:**
   ```bash
   tail -f logs/camera-ai.log
   ```
   Look for:
   - `✓ YouTube VIDEO stream extracted`
   - `[INFO] Starting camera analytics pipeline...`

2. **Test yt-dlp manually:**
   ```bash
   cd packages/camera-analytics
   source venv/bin/activate
   yt-dlp -f "bestvideo[height<=1080]/best" -g "YOUR_YOUTUBE_URL"
   ```
   Should output a stream URL.

3. **Check browser console:**
   - Open DevTools (F12)
   - Look for WebSocket connection errors
   - Check MJPEG stream URL

4. **Common Issues:**
   - ⚠️ "Video unavailable" - Try different YouTube URL
   - ⚠️ "Timeout" - Video might be geo-restricted
   - ⚠️ MJPEG not loading - Backend might still be processing

## 📊 Expected Performance

- **Regular YouTube Video:**
  - Resolution: Up to 1080p
  - FPS: 30 (matches source)
  - Latency: ~1-2 seconds
  - Face detection: Every 3 frames

- **YouTube Live Stream:**
  - Resolution: Up to 720p (optimized for real-time)
  - FPS: 30
  - Latency: 3-5 seconds (HLS inherent)
  - Face detection: Every 3 frames

## 🎯 What Works

✅ YouTube regular videos
✅ YouTube live streams
✅ Direct MP4/video URLs
✅ HLS streams (.m3u8)
✅ RTMP streams
✅ Person detection
✅ Age/Gender detection (with targeted crop analysis)
✅ Real-time analytics

## 🚀 Advanced Testing

Test with a video that has people:
```
https://www.youtube.com/watch?v=c9nFS8607t0
```
(Search for "people walking" on YouTube)

This will show:
- Multiple person tracking
- Age/gender demographics
- Dwell time tracking
- Heatmap generation
