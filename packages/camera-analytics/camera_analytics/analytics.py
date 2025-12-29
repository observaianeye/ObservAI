from __future__ import annotations

import hashlib
import json
import time
import warnings
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Tuple

import cv2
import numpy as np

# Suppress FutureWarning from InsightFace (deprecated scikit-image estimate function)
warnings.filterwarnings('ignore', category=FutureWarning, module='insightface')

try:
  from insightface.app import FaceAnalysis
except Exception:  # pragma: no cover - handled at runtime
  FaceAnalysis = None

from ultralytics import YOLO

from .config import AnalyticsConfig, EntranceLine, Zone
from .geometry import heatmap_bin, line_side, point_in_polygon
from .metrics import (
  ActivePersonSnapshot,
  CameraMetrics,
  QueueSnapshot,
  TableSnapshot,
  bucket_for_age,
  default_age_buckets,
)
from .optimize import HardwareOptimizer


@dataclass
class TrackedPerson:
  track_id: int
  first_seen: float
  last_seen: float
  bbox_norm: Tuple[float, float, float, float]
  prev_center_norm: Optional[Tuple[float, float]] = None
  center_norm: Tuple[float, float] = (0.0, 0.0)
  counted_in: bool = False
  counted_out: bool = False
  inside: bool = False
  age: Optional[float] = None
  gender: str = "unknown"
  state: str = "entering"
  active_zones: Dict[str, float] = field(default_factory=dict)
  anonymous_id: Optional[str] = None  # Privacy-preserving ID for cross-zone tracking

  # Temporal smoothing for demographics
  age_history: deque = field(default_factory=lambda: deque(maxlen=24))
  gender_history: deque = field(default_factory=lambda: deque(maxlen=24))
  gender_confidence: float = 0.5

  def contains_pixel(self, px: float, py: float) -> bool:
    x1, y1, x2, y2 = self.bbox_norm
    return x1 <= px <= x2 and y1 <= py <= y2

  def update_age(self, new_age: float, max_samples: int = 10) -> None:
    """Update age with temporal smoothing - increased samples for stability"""
    if new_age is None:
      return
    self.age_history.append(float(new_age))
    samples = list(self.age_history)
    if len(samples) >= 3:
      self.age = float(np.median(samples))
    else:
      self.age = float(np.mean(samples))

  def update_gender(self, new_gender: str, max_samples: int = 10) -> None:
    """Update gender with majority voting - increased samples for stability"""
    if not new_gender or new_gender == "unknown":
      return

    self.gender_history.append(new_gender)
    if len(self.gender_history) > max_samples:
      self.gender_history.popleft()

    male_votes = self.gender_history.count("male")
    female_votes = self.gender_history.count("female")

    total_votes = len(self.gender_history)
    if total_votes == 0:
      return

    if male_votes / total_votes >= 0.6:
      self.gender = "male"
    elif female_votes / total_votes >= 0.6:
      self.gender = "female"


class CameraAnalyticsEngine:
  """
  Real-time camera analytics engine using SOTA YOLOv12n for person detection.

  YOLOv12n provides improved accuracy and speed over YOLOv8n:
  - Better small object detection
  - Enhanced tracking stability
  - Optimized for real-time inference (<5ms latency target)

  Privacy Features:
  - Anonymous Re-ID: Uses non-biometric features (appearance, not facial embeddings)
  - GDPR/KVKK compliant: Optional privacy mode blurs faces/bodies
  - No PII storage: Anonymous IDs are one-way hashed, cannot be reversed
  """

  @staticmethod
  def _generate_anonymous_id(track_id: int, session_salt: str) -> str:
    """
    Generate privacy-preserving anonymous ID for cross-zone tracking.

    Uses one-way hash (SHA256) with session salt to ensure:
    - IDs cannot be reversed to reveal track_id
    - IDs are consistent within session for analytics
    - IDs change between sessions for privacy

    Args:
        track_id: Internal tracking ID
        session_salt: Random salt generated per session

    Returns:
        8-character anonymous ID (e.g., "A3F9C2E1")
    """
    hash_input = f"{session_salt}:{track_id}".encode()
    hash_output = hashlib.sha256(hash_input).hexdigest()
    return hash_output[:8].upper()

  def __init__(
    self,
    config: AnalyticsConfig,
    source: str | int,
    output_path: Path,
    model_path: str = "yolo11n.pt",
    sample_interval: float = 1.0,
    display: bool = False,
    show_zones: bool = False,
    on_metrics: Optional[Callable[[Dict[str, object]], None]] = None,
    on_tracks: Optional[Callable[[List[Dict[str, object]]], None]] = None,
    on_zone_insights: Optional[Callable[[List[Dict[str, object]]], None]] = None,
  ) -> None:
    self.config = config
    self.source = source
    self.output_path = output_path
    self.sample_interval = sample_interval
    self.display = display
    self.show_zones = show_zones
    self.on_metrics = on_metrics
    self.on_tracks = on_tracks
    self.on_zone_insights = on_zone_insights

    self.conf = config.confidence_threshold
    self.snapshot_interval = config.snapshot_interval
    self.last_metrics_write = 0.0
    self.privacy_mode = config.privacy_mode
    if self.privacy_mode:
      print("[INFO] Privacy Mode ENABLED: Faces and bodies will be blurred (GDPR/KVKK compliant)")

    # Generate session salt for anonymous Re-ID
    import secrets
    self.session_salt = secrets.token_hex(16)
    print("[INFO] Anonymous Re-ID enabled: Using non-biometric tracking (privacy-preserving)")

    # Thread-safe frame cache for MJPEG streaming
    import threading
    self._frame_lock = threading.Lock()
    self._latest_frame = None

    # Persistent overlay preferences (survive metric cycles)
    self._user_overlay_prefs = {
        'heatmap_visible': False
    }

    # Video capture tracking for explicit cleanup
    self._video_capture = None

    # Hardware-specific optimization (MPS for M3 Pro, TensorRT for RTX, ONNX for CPU)
    print("[INFO] Initializing hardware-optimized YOLOv12n...")
    self.device = HardwareOptimizer.get_optimal_device()
    self.inference_params = HardwareOptimizer.get_optimal_inference_params()

    # Load base model
    self.model = YOLO(model_path)

    # Attempt hardware-specific optimization
    try:
      optimized_path = HardwareOptimizer.optimize_model(
        self.model,
        model_path,
        target_format=None  # Auto-detect best format
      )
      # Reload if optimized version was created
      if optimized_path != model_path and Path(optimized_path).exists():
        self.model = YOLO(optimized_path)
    except Exception as e:
      print(f"[WARN] Hardware optimization failed: {e}")
      print("[INFO] Continuing with standard PyTorch model")

    # Configure YOLO runtime with optimal settings
    try:
      self.model.overrides['verbose'] = False
      self.model.overrides['conf'] = self.conf
      self.model.overrides['iou'] = 0.45
      self.model.overrides['max_det'] = 50
      self.model.overrides['half'] = self.inference_params.get('half', False)
      self.model.overrides['device'] = self.device
      print(f"[INFO] Model configured for {self.device.upper()} with imgsz={self.inference_params['imgsz']}")
    except Exception:  # pragma: no cover - safety guard
      pass

    # Frame skipping for face analysis (async processing)
    # Increase interval for network streams to reduce processing load
    if isinstance(source, str) and source.startswith(('http', 'rtsp', 'rtmp')):
      self.face_detection_interval = 20  # Less frequent for network streams
    else:
      self.face_detection_interval = 10  # Normal interval for local cameras

    self.frame_count = 0
    self.demographics_executor = ThreadPoolExecutor(
      max_workers=1, thread_name_prefix="demographics"
    )
    self.pending_demographics_future = None
    print(f"[INFO] Demographics processing: Async mode (every {self.face_detection_interval} frames)")

    # Resolve source using Factory
    from .sources import SourceFactory, VideoLinkSource
    
    video_source = SourceFactory.create_source(source)
    self.source = video_source.get_source()
    self.vid_stride = video_source.vid_stride
    
    # Store source metadata for frame rate control
    self.is_live_source = False
    self.source_fps: Optional[float] = None
    self.frame_delay: float = 0.0  # Delay between frames for playback timing
    self.original_url: Optional[str] = None  # Original URL for yt-dlp pipe mode
    
    # Get metadata from VideoLinkSource if available
    if isinstance(video_source, VideoLinkSource):
        source_info = video_source.get_source_info()
        self.is_live_source = source_info.get("is_live", False)
        self.source_fps = source_info.get("source_fps")
        self.original_url = source_info.get("original_url")  # For yt-dlp pipe mode
        
        # Calculate frame delay for non-live videos
        if not self.is_live_source and self.source_fps and self.source_fps > 0:
            self.frame_delay = 1.0 / self.source_fps
            print(f"[INFO] Frame delay for playback timing: {self.frame_delay*1000:.1f}ms ({self.source_fps} FPS)")
        elif self.is_live_source:
            print(f"[INFO] Live stream detected - no frame delay applied")
    
    print(f"[INFO] Source type: {type(video_source).__name__}")
    print(f"[INFO] Video stride: {self.vid_stride}")
    print(f"[INFO] Is live source: {self.is_live_source}")
    if self.source != source:
        print(f"[INFO] Resolved source: {str(self.source)[:50]}...")

    # CRITICAL: Validate source immediately during initialization.
    # This ensures that if the camera cannot be opened (e.g. iPhone not found),
    # the engine fails to initialize and reports the error back to the caller
    # before we return success to the frontend.
    self._validate_source_on_init()

    if FaceAnalysis is not None:
      try:
        self.face_app = FaceAnalysis(name="buffalo_s", providers=["CPUExecutionProvider"])
        self.face_app.prepare(ctx_id=0, det_size=(320, 320))
        print("[INFO] InsightFace initialized (buffalo_s model)")
      except Exception as err:  # pragma: no cover - runtime-only
        print(f"[WARN] InsightFace initialization failed: {err}. Demographics disabled.")
        self.face_app = None
    else:
      self.face_app = None

    self.tracks: Dict[int, TrackedPerson] = {}
    self.people_in = 0
    self.people_out = 0
    self.heatmap = np.zeros(
      (self.config.heatmap.grid_height, self.config.heatmap.grid_width), dtype=np.float32
    )

    # zone stats keyed by zone id
    self.zone_definitions: Dict[str, Zone] = {}
    self.table_ids: Iterable[str] = []
    for table in self.config.tables:
      self.zone_definitions[table.id] = table
    self.table_ids = [table.id for table in self.config.tables]
    if self.config.queue_zone:
      self.zone_definitions[self.config.queue_zone.id] = self.config.queue_zone
      self.queue_id = self.config.queue_zone.id
    else:
      self.queue_id = None

    self.zone_active_members: Dict[str, Dict[int, float]] = defaultdict(dict)
    self.zone_completed_durations: Dict[str, list[float]] = defaultdict(list)

    # Zone insights tracking (track IDs that have already triggered insights)
    self.zone_insight_triggered: Dict[str, set[int]] = defaultdict(set)
    self.zone_insight_threshold = 600.0  # 10 minutes in seconds

    # Performance metrics
    self.fps_start_time = time.time()
    self.fps_counter = 0
    self.fps = 0.0
    self.running = False
    
    # Initialize Glass Visualization Overlay
    from .overlay_viz import GlassOverlay
    # Assuming standard HD frame for init, will resize if needed or handle in render
    self.overlay = GlassOverlay(1280, 720) 

  def stop(self) -> None:
    """Stop the analytics engine"""
    print("[INFO] Stopping analytics engine...")
    self.running = False
    if hasattr(self, 'demographics_executor'):
      self.demographics_executor.shutdown(wait=False)
      print("[INFO] Demographics executor shut down")

  def _validate_source_on_init(self) -> None:
    """
    Validate that the video source can be opened and read.
    Also detects FPS for non-live sources if not already set.
    Raises ValueError if validation fails.
    """
    print(f"[INFO] Validating video source: {self.source}")
    
    # For camera indices, use platform-specific backend
    if isinstance(self.source, int):
      from .sources import _get_camera_backend
      cap = cv2.VideoCapture(self.source, _get_camera_backend())
    else:
      cap = cv2.VideoCapture(self.source)
      
      # For network streams (live), set buffer size and other options
      if self.is_live_source:
        # Reduce buffer size for lower latency on live streams
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        print(f"[INFO] Set buffer size to 1 for live stream")

    if not cap.isOpened():
      error_msg = f"Failed to open video source: {self.source}"
      try:
        backend_name = cap.getBackendName()
        error_msg += f" (Backend: {backend_name})"
      except Exception:
        pass
      
      print(f"[ERROR] {error_msg}")
      raise ValueError(error_msg)

    # Try to get FPS from OpenCV if not already set (fallback for non-live videos)
    if not self.is_live_source and self.source_fps is None:
      opencv_fps = cap.get(cv2.CAP_PROP_FPS)
      if opencv_fps and opencv_fps > 0:
        self.source_fps = opencv_fps
        self.frame_delay = 1.0 / self.source_fps
        print(f"[INFO] Detected FPS from OpenCV: {self.source_fps:.1f} (frame delay: {self.frame_delay*1000:.1f}ms)")
      else:
        # Default to 30 FPS for pre-recorded videos without FPS info
        self.source_fps = 30.0
        self.frame_delay = 1.0 / 30.0
        print(f"[INFO] Could not detect FPS, using default: 30 FPS")

    # Test read a frame to ensure camera is actually working
    ret, test_frame = cap.read()
    cap.release()

    if not ret or test_frame is None:
      error_msg = f"Video source {self.source} opened but cannot read frames!"
      print(f"[ERROR] {error_msg}")
      raise ValueError(error_msg)
    
    print(f"[INFO] ✓ Video source validation successful (shape: {test_frame.shape})")

  def get_latest_frame_safe(self) -> Optional[np.ndarray]:
    """Thread-safe access to latest frame for MJPEG streaming"""
    with self._frame_lock:
      return self._latest_frame.copy() if self._latest_frame is not None else None

  def get_snapshot(self) -> Optional[str]:
    """Capture a single frame and return as base64 string (thread-safe)"""
    import base64

    frame = None

    # CRITICAL FIX: If engine is running, ALWAYS use the cached frame.
    # NEVER try to open the source again, as it will cause a hardware conflict
    # and massive FPS drops/lag on the capture device.
    if self.running:
        frame = self.get_latest_frame_safe()
        # If running but no frame yet, return None or wait (returning None is safer)
        if frame is None:
            return None

    # If NOT running, we can safely open the source momentarily
    else:
        # If no cached frame (or not running), try to capture fresh
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            return None

        # Read a few frames to settle auto-exposure
        for _ in range(5):
            cap.grab()

        ret, frame = cap.read()
        cap.release()

        if not ret:
            return None

    # Encode as JPEG
    _, buffer = cv2.imencode('.jpg', frame)
    jpg_as_text = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{jpg_as_text}"

  def run(self) -> None:
    print("[INFO] Starting camera analytics pipeline...")
    print(f"[INFO] Face detection interval: every {self.face_detection_interval} frames")
    print(f"[INFO] Video stride: {self.vid_stride} (source: {self.source})")
    print(f"[INFO] Confidence threshold: {self.conf}")

    self.running = True
    if self.snapshot_interval > 0:
      print(f"[INFO] Snapshot mode enabled: every {self.snapshot_interval}s")
      self._run_snapshots()
    else:
      self._run_continuous()

  def _run_continuous(self) -> None:
    """Run continuous tracking with explicit camera cleanup"""
    # Note: Validation is now done in __init__
    
    # For webcams (integer source), use YOLO's built-in streaming
    # For all other sources (URLs, files), use custom capture for proper frame rate control
    if isinstance(self.source, int):
      self._run_with_yolo_stream()
    else:
      self._run_with_custom_capture()

  def _run_with_custom_capture(self) -> None:
    """
    Run tracking with custom OpenCV capture for proper frame rate control.
    This ensures videos play at their native speed regardless of processing speed.
    Works for both live streams and pre-recorded videos.
    """
    source_type = "LIVE stream" if self.is_live_source else "video"
    print(f"[INFO] Using custom capture loop for {source_type} (proper frame rate)")
    
    # For YouTube live streams with original URL, use yt-dlp pipe mode
    # This bypasses OpenCV's HLS buffering issues
    if self.is_live_source and self.original_url:
      print("[INFO] YouTube live stream detected - using yt-dlp pipe mode for smooth playback")
      self._run_live_with_ytdlp_pipe()
      return
    
    # Create VideoCapture with FFMPEG backend for network streams
    if isinstance(self.source, str) and self.source.startswith('http'):
      cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
    else:
      cap = cv2.VideoCapture(self.source)
    
    # Set buffer size to minimum for lower latency
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    
    if not cap.isOpened():
      print(f"[ERROR] Failed to open {source_type}")
      return
    
    # Get actual FPS from the video source
    source_fps = cap.get(cv2.CAP_PROP_FPS)
    if source_fps <= 0 or source_fps > 120:
      source_fps = 30.0  # Default fallback
    
    frame_interval = 1.0 / source_fps
    print(f"[INFO] {source_type} opened: {source_fps:.1f} FPS, frame interval: {frame_interval*1000:.1f}ms")
    
    if self.is_live_source:
      # For non-YouTube live streams (RTSP, RTMP, HLS), use threaded reader
      self._run_live_with_threaded_reader(cap, source_fps)
    else:
      # For regular videos, use frame-by-frame with timing control
      self._run_video_with_timing(cap, frame_interval)

  def _run_live_with_threaded_reader(self, cap, source_fps: float) -> None:
    """
    Run live stream processing with a threaded frame reader.
    This ensures we always have the latest frame available without blocking.
    """
    import threading
    import queue
    
    # Shared state for threaded reader
    frame_queue = queue.Queue(maxsize=2)  # Small queue to keep only recent frames
    reader_running = threading.Event()
    reader_running.set()
    
    def frame_reader():
      """Background thread to continuously read frames"""
      consecutive_failures = 0
      while reader_running.is_set():
        ret, frame = cap.read()
        if ret and frame is not None:
          consecutive_failures = 0
          # If queue is full, remove old frame and add new one
          if frame_queue.full():
            try:
              frame_queue.get_nowait()
            except queue.Empty:
              pass
          try:
            frame_queue.put_nowait(frame)
          except queue.Full:
            pass
        else:
          consecutive_failures += 1
          if consecutive_failures > 50:  # ~5 seconds of failures
            print("[WARN] Too many consecutive failures, reconnecting...")
            consecutive_failures = 0
          time.sleep(0.01)
    
    # Start reader thread
    reader_thread = threading.Thread(target=frame_reader, daemon=True)
    reader_thread.start()
    print("[INFO] Live stream reader thread started")
    
    target_interval = 1.0 / 30.0  # Target 30 FPS output
    
    try:
      while self.running:
        frame_start = time.time()
        
        # Get latest frame from queue
        frame = None
        try:
          frame = frame_queue.get(timeout=1.0)
        except queue.Empty:
          print("[WARN] No frame available from live stream")
          continue
        
        if frame is None:
          continue
        
        # Run YOLO tracking on the frame
        results = self.model.track(
          source=frame,
          persist=True,
          verbose=False,
          classes=[0],
          tracker="camera_analytics/bytetrack.yaml",
          imgsz=self.inference_params['imgsz'],
          device=self.device,
          conf=self.conf,
          iou=0.45,
          half=self.inference_params.get('half', False),
        )
        
        # Process results
        for result in results:
          if not self._process_result(result):
            self.running = False
            break
        
        if not self.running:
          break
        
        # Limit output to ~30 FPS
        processing_time = time.time() - frame_start
        sleep_time = target_interval - processing_time
        if sleep_time > 0:
          time.sleep(sleep_time)
          
    except Exception as e:
      print(f"[ERROR] Live stream error: {e}")
      import traceback
      traceback.print_exc()
    finally:
      reader_running.clear()
      reader_thread.join(timeout=2.0)
      cap.release()
      print("[INFO] Live stream capture released")
      if self.display:
        cv2.destroyAllWindows()

  def _run_live_with_ytdlp_pipe(self) -> None:
    """
    Run live stream using yt-dlp pipe mode for smooth playback.
    This bypasses OpenCV's HLS handling issues by using yt-dlp's native streaming.
    
    Architecture:
    yt-dlp (download) -> stdout | ffmpeg (decode to raw) -> stdout | Python (read frames)
    """
    import subprocess
    import threading
    import struct
    
    url = self.original_url
    if not url:
      print("[ERROR] No original URL available for yt-dlp pipe mode")
      return
    
    print(f"[INFO] Starting yt-dlp pipe mode for live stream: {url[:50]}...")
    
    # Frame dimensions - will be detected from stream
    width, height = 1280, 720  # Default, will be updated
    
    # First, get video dimensions using yt-dlp
    try:
      print("[INFO] Detecting stream resolution...")
      info_cmd = ['yt-dlp', '--print', 'width', '--print', 'height', '-f', 'best[height<=720]/best', url]
      info_result = subprocess.run(info_cmd, capture_output=True, text=True, timeout=15)
      if info_result.returncode == 0:
        lines = info_result.stdout.strip().split('\n')
        if len(lines) >= 2:
          try:
            width = int(lines[0])
            height = int(lines[1])
            print(f"[INFO] Stream resolution: {width}x{height}")
          except ValueError:
            print(f"[WARN] Could not parse dimensions, using default {width}x{height}")
    except Exception as e:
      print(f"[WARN] Could not detect resolution: {e}, using default {width}x{height}")
    
    frame_size = width * height * 3  # BGR format
    
    # yt-dlp command: stream to stdout
    ytdlp_cmd = [
      'yt-dlp',
      '-f', 'best[height<=720]/best',
      '-o', '-',  # Output to stdout
      '--quiet',
      '--no-warnings',
      url
    ]
    
    # FFmpeg command: decode video to raw BGR frames
    ffmpeg_cmd = [
      'ffmpeg',
      '-i', 'pipe:0',           # Read from stdin
      '-f', 'rawvideo',          # Output raw video
      '-pix_fmt', 'bgr24',       # OpenCV compatible pixel format
      '-s', f'{width}x{height}', # Output size
      '-r', '30',                # Output at 30 FPS
      '-an',                     # No audio
      '-loglevel', 'error',      # Minimal logging
      'pipe:1'                   # Write to stdout
    ]
    
    ytdlp_proc = None
    ffmpeg_proc = None
    
    try:
      # Start yt-dlp process
      print("[INFO] Starting yt-dlp subprocess...")
      ytdlp_proc = subprocess.Popen(
        ytdlp_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        bufsize=10**8
      )
      
      # Start FFmpeg process, reading from yt-dlp's stdout
      print("[INFO] Starting FFmpeg decoder...")
      ffmpeg_proc = subprocess.Popen(
        ffmpeg_cmd,
        stdin=ytdlp_proc.stdout,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=10**8
      )
      
      # Allow yt-dlp to receive SIGPIPE if ffmpeg exits
      if ytdlp_proc.stdout:
        ytdlp_proc.stdout.close()
      
      print("[INFO] yt-dlp pipe mode initialized, waiting for frames...")
      
      frame_count = 0
      consecutive_failures = 0
      target_interval = 1.0 / 30.0  # 30 FPS target
      
      while self.running:
        frame_start = time.time()
        
        # Read raw frame from FFmpeg stdout
        raw_frame = ffmpeg_proc.stdout.read(frame_size)
        
        if len(raw_frame) != frame_size:
          consecutive_failures += 1
          if consecutive_failures > 10:
            print("[ERROR] Too many frame read failures, stopping...")
            break
          if len(raw_frame) == 0:
            # Stream ended or error
            print("[INFO] Stream ended")
            break
          continue
        
        consecutive_failures = 0
        frame_count += 1
        
        # Convert to numpy array
        frame = np.frombuffer(raw_frame, dtype=np.uint8).reshape((height, width, 3))
        
        # Run YOLO tracking on the frame
        results = self.model.track(
          source=frame,
          persist=True,
          verbose=False,
          classes=[0],
          tracker="camera_analytics/bytetrack.yaml",
          imgsz=self.inference_params['imgsz'],
          device=self.device,
          conf=self.conf,
          iou=0.45,
          half=self.inference_params.get('half', False),
        )
        
        # Process results
        for result in results:
          if not self._process_result(result):
            self.running = False
            break
        
        if not self.running:
          break
        
        # Log progress periodically
        if frame_count % 300 == 0:  # Every 10 seconds at 30fps
          print(f"[INFO] yt-dlp pipe: processed {frame_count} frames")
        
        # Frame rate control
        processing_time = time.time() - frame_start
        sleep_time = target_interval - processing_time
        if sleep_time > 0:
          time.sleep(sleep_time)
          
    except Exception as e:
      print(f"[ERROR] yt-dlp pipe error: {e}")
      import traceback
      traceback.print_exc()
    finally:
      # Cleanup subprocesses
      print("[INFO] Cleaning up yt-dlp pipe processes...")
      
      if ffmpeg_proc:
        try:
          ffmpeg_proc.terminate()
          ffmpeg_proc.wait(timeout=2)
        except:
          ffmpeg_proc.kill()
      
      if ytdlp_proc:
        try:
          ytdlp_proc.terminate()
          ytdlp_proc.wait(timeout=2)
        except:
          ytdlp_proc.kill()
      
      print(f"[INFO] yt-dlp pipe mode stopped. Total frames: {frame_count if 'frame_count' in dir() else 0}")
      if self.display:
        cv2.destroyAllWindows()

  def _run_video_with_timing(self, cap, frame_interval: float) -> None:
    """
    Run pre-recorded video with proper timing to match source FPS.
    """
    print(f"[INFO] Playing video at {1.0/frame_interval:.1f} FPS")
    
    try:
      while self.running and cap.isOpened():
        frame_start = time.time()
        
        ret, frame = cap.read()
        if not ret or frame is None:
          # End of video file
          print("[INFO] End of video reached")
          break
        
        # Run YOLO tracking on the frame
        results = self.model.track(
          source=frame,
          persist=True,
          verbose=False,
          classes=[0],
          tracker="camera_analytics/bytetrack.yaml",
          imgsz=self.inference_params['imgsz'],
          device=self.device,
          conf=self.conf,
          iou=0.45,
          half=self.inference_params.get('half', False),
        )
        
        # Process results
        for result in results:
          if not self._process_result(result):
            self.running = False
            break
        
        if not self.running:
          break
        
        # Frame rate control: wait to match source FPS
        processing_time = time.time() - frame_start
        sleep_time = frame_interval - processing_time
        if sleep_time > 0:
          time.sleep(sleep_time)
          
    except Exception as e:
      print(f"[ERROR] Video playback error: {e}")
      import traceback
      traceback.print_exc()
    finally:
      cap.release()
      print("[INFO] Video capture released")
      if self.display:
        cv2.destroyAllWindows()

  def _run_with_yolo_stream(self) -> None:
    """
    Run tracking using YOLO's built-in streaming.
    Best for webcams only - provides optimal camera handling.
    """
    print("[INFO] Using YOLO's built-in streaming (webcam)")
    
    # For macOS cameras, ensure we pass the index with the right backend hint
    # YOLO will use this to create its own VideoCapture with AVFoundation
    yolo_source = self.source

    results = self.model.track(
      source=yolo_source,
      stream=True,
      verbose=False,
      classes=[0],
      tracker="camera_analytics/bytetrack.yaml",
      persist=True,
      imgsz=self.inference_params['imgsz'],
      device=self.device,
      vid_stride=self.vid_stride,
      conf=self.conf,
      iou=0.45,
      half=self.inference_params.get('half', False),
    )

    try:
      for result in results:
        if not self.running:
          break
        if not self._process_result(result):
          break
    finally:
      # CRITICAL: Explicit camera cleanup for macOS
      # YOLO manages its own VideoCapture, but we still need to ensure cleanup
      self._video_capture = None
      print("[INFO] YOLO tracking stopped, camera released by YOLO")

      if self.display:
        cv2.destroyAllWindows()

  def _run_snapshots(self) -> None:
    cap = cv2.VideoCapture(self.source)
    last_snapshot = 0.0
    
    try:
      while cap.isOpened() and self.running:
        now = time.time()
        if now - last_snapshot < self.snapshot_interval:
          if self.display:
            if cv2.waitKey(100) & 0xFF in (ord('q'), 27):
              break
          else:
            time.sleep(0.1)
          continue
        
        # Clear buffer (read a few frames) to get fresh image
        for _ in range(5):
          cap.grab()
        
        ret, frame = cap.read()
        if not ret:
          break

        # Run object tracking
        # Use custom tracker configuration for better stability
        import os
        import logging
        logger = logging.getLogger(__name__) # Assuming logger is set up

        if not os.path.exists(self.tracker_config_path):
            logger.error(f"Tracker config not found at {self.tracker_config_path}")
        else:
            logger.info(f"Using tracker config at {self.tracker_config_path}")
            with open(self.tracker_config_path, 'r') as f:
                logger.info(f"Tracker config content: {f.read()}")

        results = self.model.track(
          frame,
          persist=True,
          verbose=False,
          classes=[0],
          tracker=self.tracker_config_path,
          imgsz=self.inference_params['imgsz'],
          device=self.device,
          conf=self.confidence_threshold,
          iou=0.45,
          half=self.inference_params.get('half', False),
        )
        
        for result in results:
          if not self._process_result(result):
            return
        
        last_snapshot = now
    finally:
      cap.release()
      if self.display:
        cv2.destroyAllWindows()

  def _process_result(self, result) -> bool:
    frame = result.orig_img
    frame_h, frame_w = frame.shape[:2]
    timestamp = time.time()
    self._update_tracks(result, frame_w, frame_h, timestamp)
    self._update_demographics(frame)
    self._emit_track_stream(timestamp)

    # Apply privacy blur if enabled (GDPR/KVKK compliance)
    if self.privacy_mode:
      frame = self._apply_privacy_blur(frame, frame_w, frame_h)

    self.fps_counter += 1
    if timestamp - self.fps_start_time >= 1.0:
      self.fps = self.fps_counter / (timestamp - self.fps_start_time)
      self.fps_counter = 0
      self.fps_start_time = timestamp

    annotated = None
    if self.display:
      annotated = self._draw_overlay(frame.copy(), frame_w, frame_h)

    # Check if we should update metrics and overlays
    should_update_metrics = timestamp - self.last_metrics_write >= self.sample_interval

    if should_update_metrics:
      metrics = self._build_metrics()

      # Update overlay with new metrics - respect user preferences
      self.overlay.state.heatmap_visible = self._user_overlay_prefs['heatmap_visible']

      # Update size if changed
      if self.overlay.width != frame_w or self.overlay.height != frame_h:
          self.overlay.width = frame_w
          self.overlay.height = frame_h

      # Store the latest metrics for rendering
      self._latest_metrics = metrics.to_dict() if hasattr(metrics, 'to_dict') else metrics.__dict__

      self._emit_metrics_stream(metrics, int(timestamp * 1000))
      self._emit_zone_insights(timestamp)
      self._write_metrics(metrics)
      self.last_metrics_write = timestamp

    # ALWAYS render overlay on every frame (using latest metrics)
    # This ensures toggle changes take effect immediately
    if hasattr(self, '_latest_metrics'):
      frame = self.overlay.render(frame, self._latest_metrics)

    # Update cache with overlay (thread-safe) - every frame
    with self._frame_lock:
      self._latest_frame = frame

    if self.display and annotated is not None:
      cv2.imshow("ObservAI Camera Analytics", annotated)
      key = cv2.waitKey(1) & 0xFF
      if key in (ord("q"), 27):
        return False
    
    return True

  def _update_tracks(self, result, frame_w: int, frame_h: int, now: float) -> None:
    active_ids = set()
    if result.boxes.id is None:
      return

    boxes = result.boxes.xyxy.cpu().numpy()
    track_ids = result.boxes.id.int().cpu().numpy()

    for track_id, box in zip(track_ids, boxes):
      x1, y1, x2, y2 = box.tolist()
      x1_norm, y1_norm = x1 / frame_w, y1 / frame_h
      x2_norm, y2_norm = x2 / frame_w, y2 / frame_h
      center_norm = ((x1_norm + x2_norm) / 2.0, (y1_norm + y2_norm) / 2.0)
      active_ids.add(int(track_id))

      person = self.tracks.get(int(track_id))
      if not person:
        person = TrackedPerson(
          track_id=int(track_id),
          first_seen=now,
          last_seen=now,
          bbox_norm=(x1_norm, y1_norm, x2_norm, y2_norm),
          center_norm=center_norm,
          anonymous_id=self._generate_anonymous_id(int(track_id), self.session_salt),
        )
        person.state = "entering"
        self.tracks[int(track_id)] = person
      else:
        person.prev_center_norm = person.center_norm
        person.center_norm = center_norm
        person.bbox_norm = (x1_norm, y1_norm, x2_norm, y2_norm)
        person.last_seen = now

      self._update_inside_state(person, now)
      self._update_zones(person, now)
      self._update_heatmap(person.center_norm)

    self._drop_stale_tracks(active_ids, now)

  def _update_inside_state(self, person: TrackedPerson, now: float) -> None:
    if not self.config.entrance_line:
      person.inside = True
      dwell = now - person.first_seen
      person.state = "entering" if dwell < 2.0 else "present"
      return

    entrance: EntranceLine = self.config.entrance_line
    side = line_side(person.center_norm, entrance.start, entrance.end)

    if entrance.inside_on in {"top", "above"}:
      inside = side < 0
    elif entrance.inside_on in {"bottom", "below"}:
      inside = side > 0
    elif entrance.inside_on == "left":
      inside = side > 0
    elif entrance.inside_on == "right":
      inside = side < 0
    else:
      inside = side < 0

    previously_inside = person.inside
    person.inside = inside
    dwell = now - person.first_seen

    if person.inside:
      person.state = "entering" if dwell < 2.0 else "present"
    else:
      person.state = "exiting" if person.counted_in else "entering"

    if previously_inside != inside and person.prev_center_norm is not None:
      if inside and not person.counted_in:
        self.people_in += 1
        person.counted_in = True
      elif not inside and person.counted_in and not person.counted_out:
        self.people_out += 1
        person.counted_out = True
        person.state = "exiting"
        self._finalize_active_zones(person, now)

  def _update_zones(self, person: TrackedPerson, now: float) -> None:
    for zone_id, zone in self.zone_definitions.items():
      inside_zone = point_in_polygon(person.center_norm, zone.polygon)
      is_active = zone_id in person.active_zones

      if inside_zone and not is_active:
        person.active_zones[zone_id] = now
        self.zone_active_members[zone_id][person.track_id] = now
      elif not inside_zone and is_active:
        started = person.active_zones.pop(zone_id)
        duration = now - started
        self.zone_completed_durations[zone_id].append(duration)
        self.zone_active_members[zone_id].pop(person.track_id, None)

  def _finalize_active_zones(self, person: TrackedPerson, now: float) -> None:
    for zone_id, entered_at in list(person.active_zones.items()):
      duration = now - entered_at
      self.zone_completed_durations[zone_id].append(duration)
      self.zone_active_members[zone_id].pop(person.track_id, None)
      person.active_zones.pop(zone_id, None)

  def _check_zone_insights(self, now: float) -> List[Dict[str, object]]:
    """Check for persons who have been in zones for >10 minutes and generate insights"""
    insights = []

    for zone_id, active_members in self.zone_active_members.items():
      zone_name = self.zone_definitions.get(zone_id, None)
      if zone_name is None:
        continue

      for track_id, entered_at in active_members.items():
        duration = now - entered_at

        # Check if person has been in zone for more than threshold
        if duration >= self.zone_insight_threshold:
          # Only trigger insight once per person per zone
          if track_id not in self.zone_insight_triggered[zone_id]:
            self.zone_insight_triggered[zone_id].add(track_id)

            person = self.tracks.get(track_id)
            insight = {
              "zoneId": zone_id,
              "zoneName": getattr(zone_name, 'name', zone_id),
              "personId": f"track_{track_id}",
              "duration": duration,
              "timestamp": now,
              "message": f"Person has been in {getattr(zone_name, 'name', zone_id)} for over {int(duration / 60)} minutes"
            }

            # Add demographic info if available
            if person:
              insight["demographics"] = {
                "gender": person.gender,
                "age": int(person.age) if person.age else None
              }

            insights.append(insight)

    return insights

  def _update_heatmap(self, center_norm: Tuple[float, float]) -> None:
    row, col = heatmap_bin(
      center_norm, self.config.heatmap.grid_width, self.config.heatmap.grid_height
    )
    self.heatmap[row, col] += 5

  def _drop_stale_tracks(self, active_ids: set[int], now: float, ttl: float = 5.0) -> None:
    for track_id in list(self.tracks.keys()):
      person = self.tracks[track_id]
      if track_id in active_ids:
        continue
      if now - person.last_seen > ttl:
        if person.counted_in and not person.counted_out:
          self.people_out += 1
        self._finalize_active_zones(person, now)
        self.tracks.pop(track_id, None)

  def _process_demographics_async(self, frame: np.ndarray, frame_w: int, frame_h: int) -> List[tuple]:
    """
    Async demographics processing (runs in thread pool).
    Returns list of (track_id, age, gender) tuples.
    """
    if self.face_app is None:
      return []

    try:
      faces = self.face_app.get(frame)
      if not faces:
        return []

      results = []
      for face in faces:
        bbox = face.bbox.astype(float)
        fx1, fy1, fx2, fy2 = bbox.tolist()
        fcx, fcy = (fx1 + fx2) / 2.0, (fy1 + fy2) / 2.0

        # Find best matching track
        best_track_id = None
        best_distance = float("inf")

        for track_id, person in self.tracks.items():
          x1_norm, y1_norm, x2_norm, y2_norm = person.bbox_norm
          px1 = x1_norm * frame_w
          py1 = y1_norm * frame_h
          px2 = x2_norm * frame_w
          py2 = y2_norm * frame_h

          # Intersection
          ix1 = max(px1, fx1)
          iy1 = max(py1, fy1)
          ix2 = min(px2, fx2)
          iy2 = min(py2, fy2)

          if ix2 > ix1 and iy2 > iy1:
            intersection = (ix2 - ix1) * (iy2 - iy1)
            face_area = (fx2 - fx1) * (fy2 - fy1)
            overlap_ratio = intersection / face_area

            if overlap_ratio > 0.5:
              cx = (px1 + px2) / 2.0
              cy = (py1 + py2) / 2.0
              distance = (fcx - cx) ** 2 + (fcy - cy) ** 2

              if distance < best_distance:
                best_track_id = track_id
                best_distance = distance

        if best_track_id and best_distance < 10000:
          # Extract age and gender
          age = float(face.age) if face.age is not None else None
          if hasattr(face, "sex") and face.sex is not None:
            gender = "male" if (face.sex.upper() == 'M' if isinstance(face.sex, str) else float(face.sex) > 0.5) else "female"
          elif hasattr(face, "gender") and face.gender is not None:
            gender = "male" if int(face.gender) == 1 else "female"
          else:
            gender = None

          results.append((best_track_id, age, gender))

      return results
    except Exception as e:
      print(f"[WARN] Demographics processing error: {e}")
      return []

  def _update_demographics(self, frame: np.ndarray) -> None:
    """
    Non-blocking demographics update.
    Submits work to thread pool and processes completed results.
    """
    if self.face_app is None:
      return

    # Check if previous async task completed
    if self.pending_demographics_future is not None:
      if self.pending_demographics_future.done():
        try:
          results = self.pending_demographics_future.result(timeout=0)
          # Apply demographics to tracks
          for track_id, age, gender in results:
            if track_id in self.tracks:
              person = self.tracks[track_id]
              if age is not None:
                person.update_age(age)
              if gender is not None:
                person.update_gender(gender)
        except Exception as e:
          print(f"[WARN] Demographics result error: {e}")
        finally:
          self.pending_demographics_future = None

    # Schedule new demographics processing if needed
    self.frame_count += 1
    if self.frame_count % self.face_detection_interval == 0:
      # Only schedule if no pending task
      if self.pending_demographics_future is None:
        frame_h, frame_w = frame.shape[:2]
        self.pending_demographics_future = self.demographics_executor.submit(
          self._process_demographics_async,
          frame.copy(),  # Copy frame to avoid race conditions
          frame_w,
          frame_h
        )

  def _build_metrics(self) -> CameraMetrics:
    # Decay heatmap over time
    self.heatmap *= 0.9

    metrics = CameraMetrics()
    metrics.people_in = self.people_in
    metrics.people_out = self.people_out
    metrics.current = sum(1 for person in self.tracks.values() if person.inside)

    age_buckets = default_age_buckets()
    gender_counts = {"male": 0, "female": 0, "unknown": 0}
    
    # Initialize gender_by_age with all buckets
    gender_by_age = {bucket: {"male": 0, "female": 0, "unknown": 0} for bucket in age_buckets}
    
    dwell_times: list[float] = []
    active_people: list[ActivePersonSnapshot] = []
    now = time.time()

    for person in self.tracks.values():
      if not person.inside:
        continue

      dwell = now - person.first_seen
      dwell_times.append(dwell)

      # Update global gender counts
      if person.gender in gender_counts:
        gender_counts[person.gender] += 1
      else:
        gender_counts["unknown"] += 1

      # Update age buckets and gender_by_age
      bucket = bucket_for_age(person.age)
      if bucket != "unknown":
        age_buckets[bucket] += 1
        
        # Update gender count for this specific age bucket
        gender_key = person.gender if person.gender in {"male", "female"} else "unknown"
        gender_by_age[bucket][gender_key] += 1

      active_people.append(
        ActivePersonSnapshot(
          id=person.track_id,
          age=person.age,
          age_bucket=bucket if bucket != "unknown" else "unknown",
          gender=person.gender,
          dwell_seconds=dwell,
        )
      )

    metrics.age_buckets = age_buckets
    metrics.gender = gender_counts
    metrics.gender_by_age = gender_by_age
    metrics.active_people = active_people
    metrics.avg_dwell_time = float(np.mean(dwell_times)) if dwell_times else 0.0

    if self.queue_id:
      durations = self.zone_completed_durations[self.queue_id]
      active_count = len(self.zone_active_members[self.queue_id])
      avg_wait = float(np.mean(durations)) if durations else 0.0
      longest = float(np.max(durations)) if durations else 0.0
      metrics.queue = QueueSnapshot(active_count, avg_wait, longest)

    table_snapshots: list[TableSnapshot] = []
    for table in self.config.tables:
      durations = self.zone_completed_durations[table.id]
      active = len(self.zone_active_members[table.id])
      avg = float(np.mean(durations)) if durations else 0.0
      longest = float(np.max(durations)) if durations else 0.0
      table_snapshots.append(
        TableSnapshot(
          id=table.id,
          name=table.name,
          current_occupants=active,
          avg_stay_seconds=avg,
          longest_stay_seconds=longest,
        )
      )
    metrics.tables = table_snapshots
    metrics.heatmap = self.heatmap.astype(int).tolist()
    metrics.fps = self.fps
    return metrics

  def _heatmap_to_points(self, grid: List[List[int]]) -> List[Dict[str, float]]:
    if not grid:
      return []

    height = len(grid)
    width = len(grid[0]) if height else 0
    if width == 0:
      return []

    max_value = 0
    for row in grid:
      row_max = max(row) if row else 0
      if row_max > max_value:
        max_value = row_max

    if max_value <= 0:
      max_value = 1

    points: List[Dict[str, float]] = []
    for y, row in enumerate(grid):
      for x, value in enumerate(row):
        if value <= 0:
          continue
        points.append(
          {
            "x": (x + 0.5) / width,
            "y": (y + 0.5) / height,
            "intensity": min(1.0, (value / max_value)**0.5),
          }
        )
    return points

  def _metrics_to_stream(self, metrics: CameraMetrics, timestamp_ms: int) -> Dict[str, object]:
    heatmap_points = self._heatmap_to_points(metrics.heatmap)

    return {
      "timestamp": timestamp_ms,
      "entries": metrics.people_in,
      "exits": metrics.people_out,
      "current": metrics.current,
      "queue": metrics.queue.current,
      "demographics": {
        "gender": metrics.gender,
        "ages": metrics.age_buckets,
        "genderByAge": metrics.gender_by_age,
      },
      "heatmap": {
        "points": heatmap_points,
        "gridWidth": len(metrics.heatmap[0]) if metrics.heatmap else 0,
        "gridHeight": len(metrics.heatmap),
      },
      "fps": round(metrics.fps, 1),
    }

  def _build_track_stream(self, now: float) -> List[Dict[str, object]]:
    track_payload: List[Dict[str, object]] = []
    for track_id, person in self.tracks.items():
      x1, y1, x2, y2 = person.bbox_norm
      width = max(0.0, x2 - x1)
      height = max(0.0, y2 - y1)
      dwell = max(0.0, now - person.first_seen)

      age_bucket = bucket_for_age(person.age)
      payload = {
        "id": f"track_{track_id}",
        "bbox": [float(x1), float(y1), float(width), float(height)],
        "gender": person.gender if person.gender in {"male", "female"} else "unknown",
        "ageBucket": age_bucket if age_bucket != "unknown" else None,
        "dwellSec": dwell,
        "state": person.state,
      }
      track_payload.append(payload)
    return track_payload

  def _emit_metrics_stream(self, metrics: CameraMetrics, timestamp_ms: int) -> None:
    if self.on_metrics is None:
      return
    payload = self._metrics_to_stream(metrics, timestamp_ms)
    self.on_metrics(payload)

  def _emit_track_stream(self, now: float) -> None:
    if self.on_tracks is None:
      return
    payload = self._build_track_stream(now)
    self.on_tracks(payload)

  def _emit_zone_insights(self, now: float) -> None:
    if self.on_zone_insights is None:
      return
    insights = self._check_zone_insights(now)
    if insights:
      self.on_zone_insights(insights)

  def _apply_privacy_blur(self, frame: np.ndarray, frame_w: int, frame_h: int) -> np.ndarray:
    """
    Apply privacy-preserving blur to faces and bodies (GDPR/KVKK compliant).

    Uses Gaussian blur on detected person bounding boxes to anonymize individuals
    while maintaining tracking and analytics capabilities.
    """
    if not self.privacy_mode:
      return frame

    blurred_frame = frame.copy()

    for person in self.tracks.values():
      x1_norm, y1_norm, x2_norm, y2_norm = person.bbox_norm

      # Convert normalized coords to pixels
      x1 = int(x1_norm * frame_w)
      y1 = int(y1_norm * frame_h)
      x2 = int(x2_norm * frame_w)
      y2 = int(y2_norm * frame_h)

      # Ensure bounds are valid
      x1 = max(0, min(x1, frame_w - 1))
      y1 = max(0, min(y1, frame_h - 1))
      x2 = max(0, min(x2, frame_w))
      y2 = max(0, min(y2, frame_h))

      if x2 > x1 and y2 > y1:
        # Extract ROI (Region of Interest)
        roi = blurred_frame[y1:y2, x1:x2]

        # Apply strong Gaussian blur (kernel size proportional to ROI size)
        blur_size = max(31, min(int((x2 - x1) * 0.3), 99))
        if blur_size % 2 == 0:
          blur_size += 1  # Must be odd

        blurred_roi = cv2.GaussianBlur(roi, (blur_size, blur_size), 0)

        # Optional: Add pixelation effect for stronger anonymization
        # pixelation_factor = 0.1
        # small = cv2.resize(blurred_roi, None, fx=pixelation_factor, fy=pixelation_factor, interpolation=cv2.INTER_LINEAR)
        # blurred_roi = cv2.resize(small, (roi.shape[1], roi.shape[0]), interpolation=cv2.INTER_NEAREST)

        # Replace ROI in frame
        blurred_frame[y1:y2, x1:x2] = blurred_roi

    return blurred_frame

  def _write_metrics(self, metrics: CameraMetrics) -> None:
    self.output_path.parent.mkdir(parents=True, exist_ok=True)
    with self.output_path.open("w", encoding="utf-8") as handle:
      json.dump(metrics.to_dict(), handle, indent=2)

  def _draw_overlay(self, frame: np.ndarray, frame_w: int, frame_h: int) -> np.ndarray:
    # Create semi-transparent overlay for glass effect
    overlay = frame.copy()

    for person in self.tracks.values():
      x1, y1, x2, y2 = person.bbox_norm
      p1 = (int(x1 * frame_w), int(y1 * frame_h))
      p2 = (int(x2 * frame_w), int(y2 * frame_h))
      color = (0, 255, 0) if person.inside else (0, 0, 255)

      # Draw modern bounding box with rounded corners effect
      thickness = 3 if person.inside else 2

      # Main box
      cv2.rectangle(frame, p1, p2, color, thickness)

      # Corner accents (modern look)
      corner_length = 20
      corner_thickness = 4

      # Top-left corner
      cv2.line(frame, p1, (p1[0] + corner_length, p1[1]), color, corner_thickness)
      cv2.line(frame, p1, (p1[0], p1[1] + corner_length), color, corner_thickness)

      # Top-right corner
      cv2.line(frame, (p2[0], p1[1]), (p2[0] - corner_length, p1[1]), color, corner_thickness)
      cv2.line(frame, (p2[0], p1[1]), (p2[0], p1[1] + corner_length), color, corner_thickness)

      # Bottom-left corner
      cv2.line(frame, (p1[0], p2[1]), (p1[0] + corner_length, p2[1]), color, corner_thickness)
      cv2.line(frame, (p1[0], p2[1]), (p1[0], p2[1] - corner_length), color, corner_thickness)

      # Bottom-right corner
      cv2.line(frame, p2, (p2[0] - corner_length, p2[1]), color, corner_thickness)
      cv2.line(frame, p2, (p2[0], p2[1] - corner_length), color, corner_thickness)

      # Create modern label with demographics
      labels = []

      # Track ID (always show)
      labels.append(f"#{person.track_id}")

      # Gender and Age combined (show both or neither to avoid confusion)
      if person.gender != "unknown" and person.age:
        # Show gender with emoji
        gender_emoji = "♂" if person.gender == "male" else "♀"
        gender_display = "M" if person.gender == "male" else "F"
        # Show age as integer
        age_display = int(person.age) if person.age else 0
        labels.append(f"{gender_emoji}{gender_display} {age_display}y")
      elif person.gender != "unknown":
        # Only gender available
        gender_emoji = "♂" if person.gender == "male" else "♀"
        gender_display = "M" if person.gender == "male" else "F"
        labels.append(f"{gender_emoji}{gender_display}")
      elif person.age:
        # Only age available
        age_display = int(person.age) if person.age else 0
        labels.append(f"{age_display}y")

      # Dwell time
      dwell = time.time() - person.first_seen
      if dwell < 60:
        labels.append(f"{int(dwell)}s")
      else:
        labels.append(f"{int(dwell/60)}m{int(dwell%60)}s")

      label = " | ".join(labels)

      # Draw modern label with background
      font = cv2.FONT_HERSHEY_SIMPLEX
      font_scale = 0.6
      text_thickness = 2
      (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, text_thickness)

      # Modern glass background for label
      label_y = max(text_h + 15, p1[1] - 10)
      padding = 8

      # Draw semi-transparent background
      bg_overlay = frame.copy()
      cv2.rectangle(bg_overlay,
                   (p1[0] - padding, label_y - text_h - padding),
                   (p1[0] + text_w + padding, label_y + padding),
                   (20, 20, 40), -1)
      cv2.addWeighted(bg_overlay, 0.7, frame, 0.3, 0, frame)

      # Draw border
      cv2.rectangle(frame,
                   (p1[0] - padding, label_y - text_h - padding),
                   (p1[0] + text_w + padding, label_y + padding),
                   color, 2)

      # Draw text
      cv2.putText(frame, label, (p1[0], label_y), font, font_scale, (255, 255, 255), text_thickness)

    # Only show zones if explicitly requested (for testing/setup)
    if self.show_zones:
      if self.config.entrance_line:
        line = self.config.entrance_line
        start = (int(line.start[0] * frame_w), int(line.start[1] * frame_h))
        end = (int(line.end[0] * frame_w), int(line.end[1] * frame_h))
        cv2.line(frame, start, end, (255, 255, 0), 2)
        cv2.putText(frame, "Entrance", (start[0], start[1] - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)

      for zone in self.zone_definitions.values():
        polygon = [(int(x * frame_w), int(y * frame_h)) for x, y in zone.polygon]
        pts = np.array(polygon, np.int32).reshape((-1, 1, 2))
        cv2.polylines(frame, [pts], True, (255, 0, 0), 2)
        label = zone.name or zone.id
        cv2.putText(
          frame,
          label,
          (polygon[0][0], polygon[0][1] - 5),
          cv2.FONT_HERSHEY_SIMPLEX,
          0.5,
          (255, 0, 0),
          1,
        )

    return frame
