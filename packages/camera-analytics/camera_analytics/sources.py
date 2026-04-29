"""
Unified input source handling using Factory Pattern.
Supports webcams (incl. iVCam virtual webcam), RTSP streams, MP4 files, and
YouTube/HTTP live links. Screen capture removed in Faz 10 (Issue #2).
"""

from __future__ import annotations

import platform
import subprocess
import sys
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Union, Optional
import numpy as np
import cv2


def _get_ytdlp_executable() -> str:
    """Find yt-dlp executable, preferring the one in the current venv."""
    # Derive yt-dlp path from Python executable (works in venv)
    python_path = Path(sys.executable)
    scripts_dir = python_path.parent

    # On Windows the executable is yt-dlp.exe
    for candidate in ["yt-dlp.exe", "yt-dlp"]:
        candidate_path = scripts_dir / candidate
        if candidate_path.exists():
            return str(candidate_path)

    # Fallback: hope it's on PATH
    return "yt-dlp"

def _get_camera_backend():
    """Get platform-specific OpenCV camera backend.
    
    Returns the optimal backend for each operating system:
    - macOS (Darwin): AVFoundation
    - Windows: DirectShow
    - Linux: Video4Linux2
    """
    system = platform.system()
    if system == "Darwin":
        return cv2.CAP_AVFOUNDATION
    elif system == "Windows":
        return cv2.CAP_DSHOW
    else:  # Linux
        return cv2.CAP_V4L2


class SourceType:
    """Enumeration of supported source types"""
    WEBCAM = "webcam"
    FILE = "file"
    RTSP = "rtsp"
    RTMP = "rtmp"
    HTTP = "http"
    YOUTUBE = "youtube"


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
        system = platform.system()
        backend = _get_camera_backend()

        # Special handling for index >= 1 - verify camera availability
        # On macOS this handles iPhone/Continuity Camera, on other platforms it validates the camera
        if requested_index >= 1:
            print(f"[INFO] Requested camera index: {requested_index}")
            print(f"[INFO] Verifying camera availability on {system}...")
            
            # ATTEMPT 1: Try requested index immediately
            cap = cv2.VideoCapture(requested_index, backend)
            if cap.isOpened():
                ret, frame = cap.read()
                cap.release()
                if ret and frame is not None:
                    print(f"[INFO] ✓ Camera at index {requested_index} is working")
                    return requested_index

            # ATTEMPT 2: Robust Retry Loop (Continuity Camera can take time to wake up)
            # We will try for up to 15 seconds (10 attempts * 1.5s)
            print(f"[INFO] ⏳ Continuously checking for camera {requested_index} (up to 15s)...")
            
            for i in range(10):
                print(f"[INFO] ⏳ Verification attempt {i+1}/10...")
                cap = cv2.VideoCapture(requested_index, backend)
                if cap.isOpened():
                    ret, _ = cap.read()
                    cap.release()
                    if ret:
                        print(f"[INFO] ✓ Camera at index {requested_index} is working!")
                        return requested_index
                time.sleep(1.5)

            # ATTEMPT 3: Discovery mode - look for ANY non-primary camera
            # If the specific index failed, maybe it moved to another index?
            print(f"[INFO] Discovering available cameras (indices 0-5)...")
            available_cameras = []

            for i in range(6):  # Check indices 0-5
                if i == 0: continue # Skip main camera
                
                temp_cap = cv2.VideoCapture(i, backend)
                if temp_cap.isOpened():
                    ret, _ = temp_cap.read()
                    temp_cap.release()
                    if ret:
                        available_cameras.append(i)
                        print(f"[INFO] Found working camera at index {i}")

            # If we found any camera other than 0, use it
            if available_cameras:
                # Pick the first available secondary camera (closest to desired index)
                best_match = min(available_cameras, key=lambda x: abs(x - requested_index))
                print(f"[INFO] ✓ Using alternative secondary camera at index {best_match}")
                return best_match

            # FAIL: If we passed all retries and found nothing.
            # As last resort, fallback to primary camera (index 0) with warning
            print(f"[WARN] Camera at index {requested_index} not available after all attempts")
            print(f"[WARN] Falling back to primary camera (index 0)")
            if system == "Darwin":
                print(f"[INFO] iPhone Troubleshooting (macOS):")
                print(f"[INFO]   1. Ensure iPhone is near Mac, unlocked, WiFi/Bluetooth ON")
                print(f"[INFO]   2. Check 'Continuity Camera' in Mac System Settings")
                print(f"[INFO]   3. Connect via USB cable for better reliability")
            elif system == "Windows":
                print(f"[INFO] Phone Camera Troubleshooting (Windows):")
                print(f"[INFO]   1. Install EpocCam or iVCam on your iPhone and Windows PC")
                print(f"[INFO]      EpocCam: https://www.elgato.com/epoccam")
                print(f"[INFO]      iVCam:   https://www.e2esoft.com/ivcam/")
                print(f"[INFO]   2. Connect iPhone via USB or WiFi and launch the app")
                print(f"[INFO]   3. The virtual camera driver should appear as camera index 1 or higher")
            return 0  # Fallback to primary camera instead of failing


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
            ytdlp = _get_ytdlp_executable()
            cmd = [ytdlp, '-f', 'best[ext=mp4]/best', '-g', url]
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
        # Video metadata (set after get_source is called)
        self.is_live = False
        self.source_fps: Optional[float] = None
        self._resolved_source: Optional[str] = None
        # Store original URL for yt-dlp pipe mode (live streams)
        self._original_url: Optional[str] = None

    def get_source(self) -> str:
        url = str(self.source_input)
        # Store original URL for yt-dlp pipe mode
        self._original_url = url

        # YouTube detection
        if any(domain in url.lower() for domain in ["youtube.com", "youtu.be"]):
            print(f"   Detected YouTube URL: {url}")
            self._resolved_source = self._resolve_youtube_with_retry(url)
            return self._resolved_source

        # HLS stream (.m3u8) - typically live
        if url.endswith('.m3u8'):
            print(f"   Detected HLS stream: {url}")
            self.is_live = True
            self._resolved_source = url
            return url

        # RTMP stream - always live
        if url.startswith('rtmp://'):
            print(f"   Detected RTMP stream: {url}")
            self.is_live = True
            self._resolved_source = url
            return url

        # HTTP/HTTPS stream or direct video file
        if url.startswith(('http://', 'https://')):
            if url.endswith(('.mp4', '.avi', '.mov', '.mkv', '.flv')):
                print(f"   Detected direct video file URL: {url}")
                self.is_live = False
            elif ':4747/' in url or '/mjpeg' in url.lower() or ':8080/video' in url.lower():
                # iVCam, DroidCam, and similar phone camera HTTP streams
                print(f"   Detected phone camera HTTP stream (live): {url}")
                self.is_live = True
            else:
                # Generic HTTP streams without file extension are typically live feeds
                print(f"   Detected HTTP stream (live): {url}")
                self.is_live = True
            self._resolved_source = url
            return url

        # Default: return as-is
        print(f"   Using URL as-is: {url}")
        self._resolved_source = url
        return url

    def _check_if_live(self, url: str) -> bool:
        """Check if YouTube URL is a live stream using yt-dlp"""
        try:
            # Added --force-ipv4 to avoid IPv6 timeouts
            cmd = [_get_ytdlp_executable(), '--force-ipv4', '--print', 'is_live', '--no-warnings', url]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15
            )
            if result.returncode == 0:
                is_live_str = result.stdout.strip().lower()
                return is_live_str == 'true'
        except Exception as e:
            print(f"   ⚠️  Could not determine if live: {e}")
        return False

    def _get_video_fps(self, url: str) -> Optional[float]:
        """Get video FPS using yt-dlp (for non-live videos)"""
        try:
            cmd = [_get_ytdlp_executable(), '--force-ipv4', '--print', 'fps', '--no-warnings', url]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15
            )
            if result.returncode == 0 and result.stdout.strip():
                fps_str = result.stdout.strip()
                if fps_str and fps_str != 'NA':
                    return float(fps_str)
        except Exception as e:
            print(f"   ⚠️  Could not get FPS: {e}")
        return None

    def _resolve_youtube(self, url: str) -> str:
        """Extract direct stream URL from YouTube using yt-dlp (legacy single-attempt)"""
        try:
            cmd = [_get_ytdlp_executable(), '--force-ipv4', '-f', 'best[ext=mp4]/best', '-g', url]
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
        """Extract YouTube stream URL with exponential backoff retry logic

        CRITICAL FIX: YouTube stream URLs from yt-dlp often fail with OpenCV due to:
        1. Complex URL signatures that OpenCV can't handle properly
        2. HTTP redirect chains that timeout
        3. Stream URLs expire after several hours
        4. IPv6 DNS issues with yt-dlp on some networks

        Solution: Use yt-dlp with --force-ipv4 and better format selection.
        We prioritize simpler formats that OpenCV can handle reliably.
        """
        # First, check if it's a live stream
        print(f"   Checking if video is live...")
        self.is_live = self._check_if_live(url)

        if self.is_live:
            print(f"   📺 Video is LIVE - using optimized live stream format")
        else:
            print(f"   🎬 Video is NOT live - getting FPS for playback timing")
            self.source_fps = self._get_video_fps(url)
            if self.source_fps:
                print(f"   📊 Source FPS: {self.source_fps}")

        # Try multiple format strategies for better compatibility
        format_strategies = []
        if self.is_live:
            # Live stream format strategies (prefer 720p combined stream)
            format_strategies = [
                'best[height<=720]/best',   # 720p combined: best quality that's reliably pipeable
                'best[height<=1080]/best',  # 1080p fallback
                '95/94/93',                # Specific HLS itags
                'worst'                    # Last resort
            ]
        else:
            # Regular video: prefer DASH video-only for higher quality
            # (OpenCV doesn't need audio, so video-only streams work fine)
            format_strategies = [
                'bestvideo[ext=mp4][height<=1080]',  # 1080p DASH video-only
                'bestvideo[ext=mp4][height<=720]',   # 720p DASH video-only
                '22',                                 # 720p combined MP4
                'best[ext=mp4][height<=720]',         # 720p combined fallback
                'best[ext=mp4]',                      # Any combined MP4
                'best'
            ]

        for strategy_idx, format_spec in enumerate(format_strategies):
            try:
                print(f"   🎯 Trying format strategy {strategy_idx + 1}/{len(format_strategies)}: {format_spec}")

                cmd = [_get_ytdlp_executable(), '--force-ipv4', '-f', format_spec, '-g', url]
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=30
                )

                if result.returncode == 0 and result.stdout.strip():
                    stream_url = result.stdout.strip().split('\n')[0]
                    stream_type = "LIVE" if self.is_live else "VIDEO"
                    print(f"   ✓ YouTube {stream_type} stream URL extracted")
                    print(f"   Stream URL: {stream_url[:80]}...")
                    print(f"   ✅ Returning stream URL (skipping OpenCV pre-validation)")
                    return stream_url
                else:
                    print(f"   ⚠️  yt-dlp failed with code {result.returncode}")
                    if result.stderr:
                        error_msg = result.stderr.strip()
                        print(f"   Error: {error_msg[:200]}")
                    continue

            except subprocess.TimeoutExpired:
                print(f"   ⚠️  yt-dlp timeout on strategy {strategy_idx + 1}")
                continue
            except Exception as e:
                print(f"   ⚠️  Error on strategy {strategy_idx + 1}: {e}")
                continue

        # If all strategies failed
        error_msg = f"Failed to extract valid YouTube stream URL after trying {len(format_strategies)} different format strategies"
        print(f"   ❌ {error_msg}")
        raise ValueError(error_msg)

    def validate(self) -> bool:
        return True

    @property
    def vid_stride(self) -> int:
        # Process all frames for smooth video playback (no skipping)
        # YouTube videos will play smoothly without stuttering
        return 1
    
    def get_source_info(self) -> dict:
        """Get source metadata after get_source() has been called"""
        return {
            "is_live": self.is_live,
            "source_fps": self.source_fps,
            "resolved_source": self._resolved_source,
            "original_url": self._original_url  # For yt-dlp pipe mode
        }



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
    return SourceType.FILE
