# ObservAI — Windows RTX 5070 Setup Guide

Branch: `windows-rtx5070`
Hardware target: NVIDIA RTX 5070 (Blackwell, CUDA 12.8)
Profile: **Balanced** — high FPS + conservative accuracy

## AI Profile Summary

| Parameter | Value | Notes |
|---|---|---|
| Model | `yolo11s.pt` | Better accuracy vs yolo11n |
| imgsz | 640 | Optimal for CUDA |
| half precision | True (FP16) | Faster on RTX |
| face_detection_interval (network) | 10 frames | Balanced GPU usage |
| face_detection_interval (webcam) | 5 frames | Responsive demographics |
| Gender voting threshold | 0.70 | Conservative, fewer false labels |
| max_det | 100 | Crowded scene support |

---

## Prerequisites

Before starting, install these on your Windows machine:

1. **NVIDIA Driver** >= 566.x — [nvidia.com/drivers](https://www.nvidia.com/drivers)
2. **CUDA Toolkit 12.8** — [developer.nvidia.com/cuda-downloads](https://developer.nvidia.com/cuda-downloads)
   - Verify: `nvcc --version` and `nvidia-smi` both work in CMD
3. **Python 3.11 or 3.12** — [python.org](https://www.python.org/downloads/)
   - ⚠️ Check "Add Python to PATH" during installation
   - Python 3.13 not recommended (ultralytics compatibility)
4. **Node.js 18+** — [nodejs.org](https://nodejs.org) (LTS version)
5. **pnpm**: `npm install -g pnpm`
6. **Git** — [git-scm.com](https://git-scm.com)

---

## Python Environment Setup

> **The installation ORDER is critical.**
> PyTorch with CUDA must be installed BEFORE everything else.
> If ultralytics installs first, it will pull in CPU-only torch silently.

```cmd
cd packages\camera-analytics

REM Step 1: Create virtual environment
python -m venv venv
venv\Scripts\activate.bat
python -m pip install --upgrade pip setuptools wheel

REM Step 2: Install PyTorch with CUDA 12.8 FIRST (RTX 5070 Blackwell)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128

REM Step 3: Verify GPU is detected BEFORE continuing
python -c "import torch; print('CUDA:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0))"
```

Expected output:
```
CUDA: True
GPU: NVIDIA GeForce RTX 5070
```

If CUDA shows `False` — stop here and fix the driver/CUDA installation before proceeding.

```cmd
REM Step 4: Install the package with demographics extras
REM (ultralytics detects existing torch+CUDA and won't overwrite it)
pip install -e .[demographics]

REM Step 5: Verify onnxruntime-gpu CUDA provider
python -c "import onnxruntime as ort; print(ort.get_available_providers())"
```

Expected output includes `CUDAExecutionProvider`:
```
['TensorrtExecutionProvider', 'CUDAExecutionProvider', 'CPUExecutionProvider']
```

---

## Frontend & Backend Setup

```cmd
REM Frontend
cd ..\..\frontend
pnpm install
copy .env.example .env

REM Backend
cd ..\backend
npm install
copy .env.example .env
npx prisma generate
npx prisma migrate dev
```

Edit `backend\.env` — at minimum set:
```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="change-this-in-production"
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

---

## MiVOLO Demographics (Optional)

MiVOLO provides better age/gender estimation than InsightFace but requires
a manual model download. InsightFace (with onnxruntime-gpu) works well without it.

```cmd
cd packages\camera-analytics
setup_mivolo.bat
```

Follow the on-screen instructions to download model weights from Google Drive.

---

## Running the Application

### Option 1: All services at once (recommended)

```cmd
REM From project root
start-all.bat
```

Services started:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Camera AI (WebSocket): ws://0.0.0.0:5001
- Prisma Studio: http://localhost:5555

### Option 2: Camera AI only (for testing)

```cmd
cd packages\camera-analytics
venv\Scripts\activate.bat

REM With webcam (index 0):
python -m camera_analytics.run_with_websocket --source 0 --model yolo11s.pt --ws-port 5001

REM With YouTube live stream:
python -m camera_analytics.run_with_websocket --source "https://www.youtube.com/watch?v=VIDEO_ID" --model yolo11s.pt --ws-port 5001
```

---

## YouTube Live Stream Testing

No physical camera? Use YouTube live streams for testing.

1. Find a public YouTube live stream (news channel, city cam, etc.)
2. Copy the URL
3. Start the AI engine with it:

```cmd
venv\Scripts\activate.bat
python -m camera_analytics.run_with_websocket \
  --source "https://www.youtube.com/watch?v=VIDEO_ID" \
  --model yolo11s.pt \
  --ws-port 5001
```

Or via the frontend:
1. Open http://localhost:5173
2. Go to Camera Settings
3. Paste the YouTube URL as the source
4. Click Start

The `VideoLinkSource` class handles yt-dlp extraction automatically with retries.

When a physical webcam is connected:
- Windows uses DirectShow backend (`cv2.CAP_DSHOW`) — already configured
- Use `--source 0` for the default camera, `--source 1` for the first external camera

---

## GPU Performance Verification

```cmd
venv\Scripts\activate.bat
python packages\camera-analytics\camera_analytics\optimize.py
```

Expected output:
```
==============================
ObservAI Hardware Optimization Report
==============================
System:        Windows (AMD64)
PyTorch:       2.6.x+cu128
CUDA:          OK NVIDIA GeForce RTX 5070
MPS (Metal):   False

Optimal Device:  CUDA
Image Size:      640px
Half Precision:  True
==============================
```

---

## Troubleshooting

### CUDA shows False after installing torch+cu128

```cmd
REM Check CUDA toolkit version
nvcc --version

REM Check NVIDIA driver
nvidia-smi

REM Force reinstall PyTorch CUDA
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128 --force-reinstall
```

### CUDAExecutionProvider missing from onnxruntime

Do NOT have both `onnxruntime` and `onnxruntime-gpu` installed simultaneously:

```cmd
pip uninstall onnxruntime onnxruntime-gpu -y
pip install onnxruntime-gpu>=1.19.0
```

### ByteTrack / lapx import error

```cmd
pip uninstall lap lapx -y
pip install lapx>=0.5.2
```

`lap` is intentionally not used in this branch — `lapx` is the Windows-compatible drop-in replacement.

### YouTube stream not extracting

```cmd
REM Update yt-dlp
pip install -U yt-dlp

REM Test manually
yt-dlp --force-ipv4 -f "best[ext=mp4]/best" -g "YOUR_YOUTUBE_URL"
```

### Low FPS despite CUDA being active

- Check logs: `type logs\camera-ai.log`
- First run generates TensorRT engine (1-2 min wait is normal)
- Verify FP16 active: look for `[INFO] Model configured for CUDA` in logs
- If using TensorRT, confirm engine file exists: `dir packages\camera-analytics\yolo11s_tensorrt.engine`

### insightface installation fails

insightface requires Visual C++ Build Tools on Windows. Install from:
https://visualstudio.microsoft.com/visual-cpp-build-tools/

Then reinstall: `pip install insightface>=0.7.3`

---

## Branch Notes

- Branch: `windows-rtx5070` — Windows + RTX 5070 optimized
- Branch: `main` — Mac M3 Pro (MPS backend, CoreML, yolo11n)
- Do NOT merge these branches. Cherry-pick bug fixes individually.
