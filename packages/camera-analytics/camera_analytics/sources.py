"""
Unified input source handling using Factory Pattern.
Supports webcams, RTSP streams, MP4 files, YouTube Live, and screen capture.
"""

from __future__ import annotations

import platform
import subprocess
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Union, Optional


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
        if isinstance(self.source_input, str):
            return int(self.source_input)
        return self.source_input

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
            if any(domain in source_str for domain in ["youtube.com", "youtu.be"]):
                return YouTubeSource(source_input)
            return RTSPSource(source_input) # Treat generic HTTP as stream

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
    if isinstance(video_source, ScreenCaptureSource): return SourceType.SCREEN_CAPTURE
    return SourceType.FILE
