"""
Unified input source handling using Factory Pattern.
Supports webcams, RTSP streams, MP4 files, YouTube Live, and screen capture.
"""

from __future__ import annotations

import platform
import subprocess
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Union, Optional
import numpy as np
import cv2

try:
    from mss import mss
except ImportError:
    mss = None



class SourceType:
    """Enumeration of supported source types"""
    WEBCAM = "webcam"
    FILE = "file"
    RTSP = "rtsp"
    RTMP = "rtmp"
    HTTP = "http"
    YOUTUBE = "youtube"
    SCREEN_CAPTURE = "screen_capture"


class VideoSource(ABC):
    """Abstract base class for video sources"""
    
    def __init__(self, source_input: Union[str, int]):
        self.source_input = source_input

    @abstractmethod
    def get_source(self) -> Union[str, int]:
        """Return the processed source identifier for OpenCV/YOLO"""
        pass

    @abstractmethod
    def validate(self) -> bool:
        """Validate if the source is accessible"""
        pass

    @property
    def vid_stride(self) -> int:
        """Recommended video stride for this source type"""
        return 1


class WebcamSource(VideoSource):
    def get_source(self) -> int:
        requested_index = int(self.source_input) if isinstance(self.source_input, str) else self.source_input

        # Special handling for index 1 on macOS - might be iPhone/Continuity Camera
        # If requested index doesn't work, try to discover the correct camera
        if requested_index >= 1 and platform.system() == "Darwin":  # macOS
            print(f"[INFO] Requested camera index: {requested_index}")
            print(f"[INFO] Verifying camera availability on macOS...")

            # Try the requested index first
            test_cap = cv2.VideoCapture(requested_index, cv2.CAP_AVFOUNDATION)
            if test_cap.isOpened():
                ret, frame = test_cap.read()
                test_cap.release()
                if ret and frame is not None:
                    print(f"[INFO] ✓ Camera at index {requested_index} is working")
                    return requested_index
                else:
                    print(f"[WARN] Camera at index {requested_index} opened but no frames")
            else:
                print(f"[WARN] Camera at index {requested_index} not available")

            # Camera not working at requested index - try discovery
            print(f"[INFO] Discovering available cameras (indices 0-9)...")
            available_cameras = []

            for i in range(10):  # Check indices 0-9
                cap = cv2.VideoCapture(i, cv2.CAP_AVFOUNDATION)
                if cap.isOpened():
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        available_cameras.append(i)
                        print(f"[INFO] ✓ Camera found at index {i}")
                    else:
                        print(f"[DEBUG] Camera at index {i} opened but failed to read frame")
                    cap.release()
                else:
                    # Silent debug for non-existent indices to avoid log spam
                    pass

            if len(available_cameras) > 1 and requested_index == 1:
                # User wants the second camera (iPhone), use the second available camera
                actual_index = available_cameras[1]
                print(f"[INFO] Using camera at index {actual_index} for iPhone/secondary camera")
                return actual_index
            
            # CRITICAL: Removed silent fallback to index 0. 
            # If requested index is not found/working, we raise an error
            # so that the engine initialization fails immediately and
            # reports back to the frontend.
            error_msg = f"Requested camera index {requested_index} is not working or not found."
            print(f"[ERROR] {error_msg}")
            if len(available_cameras) > 0:
                print(f"[INFO] Available working camera indices: {available_cameras}")
            else:
                print(f"[ERROR] No working cameras detected on this system.")
                
            raise ValueError(error_msg)

        return requested_index

    def validate(self) -> bool:
        return True  # Difficult to validate without opening

    @property
    def vid_stride(self) -> int:
        return 1


class FileSource(VideoSource):
    def get_source(self) -> str:
        path = Path(self.source_input)
        if path.exists():
            return str(path.absolute())
        return str(self.source_input)

    def validate(self) -> bool:
        return Path(self.source_input).exists()

    @property
    def vid_stride(self) -> int:
        return 1


class RTSPSource(VideoSource):
    def get_source(self) -> str:
        return str(self.source_input)

    def validate(self) -> bool:
        return str(self.source_input).startswith(("rtsp://", "rtmp://"))

    @property
    def vid_stride(self) -> int:
        return 2  # Skip frames for smoother real-time processing


class YouTubeSource(VideoSource):
    """YouTube video source (legacy - use VideoLinkSource instead)"""
    def get_source(self) -> str:
        url = str(self.source_input)
        print(f"   Extracting YouTube Live stream URL from {url}...")

        # Try yt-dlp with improved arguments
        try:
            print("   Trying yt-dlp...")
            # Use best mp4 video or best available if mp4 not found
            cmd = ['yt-dlp', '-f', 'best[ext=mp4]/best', '-g', url]
            print(f"   Command: {' '.join(cmd)}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30  # Increased timeout
            )

            if result.returncode == 0 and result.stdout.strip():
                stream_url = result.stdout.strip().split('\n')[0]
                print(f"   ✓ Found stream using yt-dlp")
                return stream_url
            else:
                print(f"   ⚠️  yt-dlp failed with code {result.returncode}")
                if result.stderr:
                    print(f"   stderr: {result.stderr.strip()}")

        except Exception as e:
            print(f"   ⚠️  yt-dlp error: {e}")

        # Streamlink fallback removed as it is not installed in the environment
        # If installed in future, can be re-enabled here

        print("   ❌ Could not extract stream URL, using original")
        return url

    def validate(self) -> bool:
        return True

    @property
    def vid_stride(self) -> int:
        return 3  # Skip more frames for network streams


class VideoLinkSource(VideoSource):
    """Unified handler for YouTube, HLS (.m3u8), RTMP, HTTP streams, and direct video URLs (.mp4)"""

    def __init__(self, source_input: Union[str, int]):
        super().__init__(source_input)
        # Exponential backoff configuration for retries
        self.retry_delays = [1, 2, 4]  # Retry delays in seconds
        self.max_retries = 3

    def get_source(self) -> str:
        url = str(self.source_input)

        # YouTube detection
        if any(domain in url.lower() for domain in ["youtube.com", "youtu.be"]):
            print(f"   Detected YouTube URL: {url}")
            return self._resolve_youtube_with_retry(url)

        # HLS stream (.m3u8)
        if url.endswith('.m3u8'):
            print(f"   Detected HLS stream: {url}")
            return url

        # RTMP stream
        if url.startswith('rtmp://'):
            print(f"   Detected RTMP stream: {url}")
            return url

        # HTTP/HTTPS stream or direct video file
        if url.startswith(('http://', 'https://')):
            if url.endswith(('.mp4', '.avi', '.mov', '.mkv', '.flv')):
                print(f"   Detected direct video file URL: {url}")
            else:
                print(f"   Detected HTTP stream: {url}")
            return url

        # Default: return as-is
        print(f"   Using URL as-is: {url}")
        return url

    def _resolve_youtube(self, url: str) -> str:
        """Extract direct stream URL from YouTube using yt-dlp (legacy single-attempt)"""
        try:
            cmd = ['yt-dlp', '-f', 'best[ext=mp4]/best', '-g', url]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

            if result.returncode == 0 and result.stdout.strip():
                stream_url = result.stdout.strip().split('\n')[0]
                print(f"   ✓ Extracted YouTube stream URL")
                return stream_url
            else:
                print(f"   ⚠️  yt-dlp failed (code {result.returncode}), using original URL")
                if result.stderr:
                    print(f"   Error: {result.stderr.strip()[:200]}")
        except Exception as e:
            print(f"   ⚠️  YouTube resolution failed: {e}")

        return url

    def _resolve_youtube_with_retry(self, url: str) -> str:
        """Extract YouTube stream URL with exponential backoff retry logic"""
        for attempt in range(self.max_retries):
            try:
                delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                if attempt > 0:
                    print(f"   🔄 Retry {attempt}/{self.max_retries} after {delay}s delay...")
                    time.sleep(delay)

                cmd = ['yt-dlp', '-f', 'best[ext=mp4]/best', '-g', url]
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=30
                )

                if result.returncode == 0 and result.stdout.strip():
                    stream_url = result.stdout.strip().split('\n')[0]
                    print(f"   ✓ YouTube stream extracted (attempt {attempt + 1})")
                    return stream_url
                else:
                    print(f"   ⚠️  yt-dlp failed (attempt {attempt + 1}, code {result.returncode})")
                    if result.stderr and attempt == self.max_retries - 1:
                        print(f"   Error: {result.stderr.strip()[:200]}")

            except subprocess.TimeoutExpired:
                print(f"   ⚠️  yt-dlp timeout (attempt {attempt + 1})")
            except Exception as e:
                print(f"   ⚠️  Error (attempt {attempt + 1}): {e}")

        print("   ❌ All retry attempts failed, using original URL")
        return url

    def validate(self) -> bool:
        return True

    @property
    def vid_stride(self) -> int:
        return 3  # Skip frames for network streams to reduce latency



class ScreenCaptureWrapper:
    """
    OpenCV-compatible wrapper for screen capture using mss.
    Provides read(), isOpened(), release() methods.
    """
    def __init__(self, monitor_idx: int = 1):
        if mss is None:
            raise ImportError("mss library is required for screen capture. Install with: pip install mss")
        self.sct = mss()
        self.monitors = self.sct.monitors
        # mss monitor 0 is all monitors combined, 1 is primary
        self.monitor_idx = monitor_idx if monitor_idx < len(self.monitors) else 1
        self.monitor = self.monitors[self.monitor_idx]
        self._is_opened = True

    def isOpened(self) -> bool:
        return self._is_opened

    def read(self) -> tuple[bool, Optional[np.ndarray]]:
        if not self._is_opened:
            return False, None
        
        try:
            # Capture screen
            screenshot = self.sct.grab(self.monitor)
            # Convert to numpy array (BGRA)
            img = np.array(screenshot)
            # Convert BGRA to BGR for OpenCV
            frame = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
            return True, frame
        except Exception as e:
            print(f"[ERROR] Screen capture failed: {e}")
            return False, None

    def release(self) -> None:
        self._is_opened = False
        if hasattr(self, 'sct'):
            self.sct.close()

class ScreenCaptureSource(VideoSource):

    def get_source(self) -> Union[str, int]:
        system = platform.system()
        
        if system == "Darwin":  # macOS
            # Use AVFoundation screen capture
            # Usually index 1 is the screen if 0 is webcam
            # But OpenCV on Mac often maps '0' to webcam and '1' to screen capture if configured?
            # Actually, for YOLO/OpenCV on Mac, 'screen' is not natively supported as a keyword like in some other tools.
            # However, Ultralytics YOLO supports 'screen' as a source which internally handles MSS or similar.
            # If we want to use OpenCV VideoCapture directly:
            # return "avfoundation:1" # This is specific to ffmpeg backend
            
            # If we are using Ultralytics YOLO 'track' mode, it supports 'screen' source directly via MSS.
            return "screen" 

        elif system == "Linux":
            return "screen" # Ultralytics handles this

        elif system == "Windows":
            return "screen" # Ultralytics handles this

        return "screen"

    def validate(self) -> bool:
        return True

    @property
    def vid_stride(self) -> int:
        return 2


class SourceFactory:
    @staticmethod
    def create_source(source_input: Union[str, int]) -> VideoSource:
        """Factory method to create the appropriate VideoSource instance"""
        
        if isinstance(source_input, int):
            return WebcamSource(source_input)

        source_str = str(source_input).lower()

        # Check for live stream protocols
        if source_str.startswith("rtsp://") or source_str.startswith("rtmp://"):
            return RTSPSource(source_input)
            
        if source_str.startswith(("http://", "https://")):
            # Use unified VideoLinkSource for all HTTP/HTTPS URLs
            # It will detect YouTube, HLS, direct video files, etc.
            return VideoLinkSource(source_input)

        # Check for screen capture
        if source_str == "screen" or source_str.startswith("screen:"):
            return ScreenCaptureSource(source_input)

        # Check if it's a file
        path = Path(source_input)
        if path.exists() and path.is_file():
            return FileSource(source_input)

        # Try to parse as webcam index
        try:
            int(source_input)
            return WebcamSource(int(source_input))
        except ValueError:
            pass

        # Default to file (might be a URL or path that will be checked later)
        return FileSource(source_input)


# Helper functions for backward compatibility
def prepare_source(source: Union[str, int], verbose: bool = True) -> Union[str, int]:
    if verbose:
        print(f"\n🔍 Preparing source: {source}")
    
    video_source = SourceFactory.create_source(source)
    processed_source = video_source.get_source()
    
    if verbose:
        print(f"   ✓ Processed source: {processed_source}")
        
    return processed_source

def detect_source_type(source: Union[str, int]) -> str:
    video_source = SourceFactory.create_source(source)
    if isinstance(video_source, WebcamSource): return SourceType.WEBCAM
    if isinstance(video_source, FileSource): return SourceType.FILE
    if isinstance(video_source, RTSPSource): return SourceType.RTSP
    if isinstance(video_source, YouTubeSource): return SourceType.YOUTUBE
    if isinstance(video_source, VideoLinkSource): return SourceType.HTTP  # Unified video link
    if isinstance(video_source, ScreenCaptureSource): return SourceType.SCREEN_CAPTURE
    return SourceType.FILE
