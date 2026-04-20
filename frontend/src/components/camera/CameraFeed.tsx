import { Video, Maximize2, Minimize2, RotateCcw, AlertCircle, Camera as CameraIcon, Settings, X, Upload, Link as LinkIcon, Plus, Activity } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDataMode } from '../../contexts/DataModeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { cameraBackendService, Detection, BackendHealth, Zone } from '../../services/cameraBackendService';
import { GlassCard } from '../ui/GlassCard';

export type CameraSource = 'webcam' | 'iphone' | 'ip' | 'videolink' | 'file';

// Connection state machine states
export type ConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'WAITING_FOR_BACKEND'
  | 'CONNECTED'
  | 'STREAMING'
  | 'FAILED';

interface CameraSourceConfig {
  type: CameraSource;
  url?: string;
  deviceId?: string;
  file?: File;
  ipCameraId?: string;
}

interface IPCamera {
  id: string;
  name: string;
  url: string;
  type: 'rtsp' | 'http';
}

export default function CameraFeed() {
  const { dataMode } = useDataMode();
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSourceSelect, setShowSourceSelect] = useState(false);
  const [currentSource, setCurrentSource] = useState<CameraSourceConfig>(() => {
    // Load last used source from localStorage
    const saved = localStorage.getItem('lastCameraSource');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { type: 'webcam' };
      }
    }
    return { type: 'webcam' };
  });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [showZones] = useState(true); // Can be made toggleable in future
  const [zones, setZones] = useState<Zone[]>([]);

  // Advanced settings
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [videoLinkUrl, setVideoLinkUrl] = useState(() => {
    // Restore video link URL if current source is videolink
    const saved = localStorage.getItem('lastCameraSource');
    if (saved) {
      try {
        const source = JSON.parse(saved);
        if (source.type === 'videolink' && source.url) {
          return source.url;
        }
      } catch {
        return '';
      }
    }
    return '';
  });
  const [ipCameras, setIPCameras] = useState<IPCamera[]>(() => {
    const saved = localStorage.getItem('ipCameras');
    return saved ? JSON.parse(saved) : [];
  });
  const [showAddIPCamera, setShowAddIPCamera] = useState(false);
  const [newIPCamera, setNewIPCamera] = useState({ name: '', url: '', type: 'rtsp' as 'rtsp' | 'http' });

  // Heatmap visibility toggle
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Tailscale / Remote ivCam URL (Phone Cam modunda HTTP stream URL)
  const [iphoneRemoteUrl, setIphoneRemoteUrl] = useState(() => {
    return localStorage.getItem('iphoneRemoteUrl') || '';
  });

  // Source switching loading state
  const [isSwitchingSource, setIsSwitchingSource] = useState(false);

  // Saved cameras from Camera Selection page
  interface SavedCamera {
    id: string;
    name: string;
    sourceType: string;
    sourceValue: string;
    isActive: boolean;
  }
  const [savedCameras, setSavedCameras] = useState<SavedCamera[]>([]);

  // Backend readiness state machine
  const [, setBackendHealth] = useState<BackendHealth | null>(null);
  const healthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Source version counter — incremented on each source change to re-trigger subscriptions
  const [sourceVersion, setSourceVersion] = useState(0);
  // Connection state machine
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;
  const [, setRetryCountDisplay] = useState(0);
  const [, setNextRetryIn] = useState(0); // countdown seconds
  const retryCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mjpegRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mjpegRetryCountRef = useRef(0);
  const MAX_MJPEG_RETRIES = 20;

  // Dynamic video dimensions for proper aspect ratio
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

  // Refs for cleanup tracking
  const cleanupRef = useRef<(() => void) | null>(null);
  const isChangingSourceRef = useRef(false);
  const mjpegImgRef = useRef<HTMLImageElement>(null);
  const canvasSizeInitialized = useRef(false);

  // Stable MJPEG URL — computed once to avoid re-connecting on every re-render
  const mjpegUrl = useMemo(
    () => `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'}/mjpeg`,
    []
  );

  /**
   * Start Python backend automatically when camera source changes
   */
  const startPythonBackend = async (source: string | number) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      const response = await fetch(`${apiUrl}/api/python-backend/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source,
          wsPort: 5001,
          wsHost: '0.0.0.0'
        }),
      });

      if (!response.ok) {
        // Silently handle - backend might already be running
      }
    } catch {
      // Silently handle - API might not be available
    }
  };

  // Load IP cameras from localStorage
  useEffect(() => {
    localStorage.setItem('ipCameras', JSON.stringify(ipCameras));
  }, [ipCameras]);

  // Fetch saved cameras from Camera Selection page
  const fetchSavedCameras = useCallback(async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/cameras`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSavedCameras(data);
      }
    } catch {
      // Silently handle - API might not be available
    }
  }, []);

  useEffect(() => {
    fetchSavedCameras();
  }, [fetchSavedCameras]);

  // Auto-start camera when entering Live mode
  // Use last selected source from localStorage, or default to MacBook camera
  const hasAutoStartedRef = useRef(false);
  useEffect(() => {
    if (dataMode === 'live' && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;

      // Check if we have a saved source and it's not the initial state
      const savedSource = localStorage.getItem('lastCameraSource');
      const isBackendRunning = localStorage.getItem('backendRunning') === 'true';

      if (savedSource && isBackendRunning) {
        // Backend is already running with a source, just reconnect UI
        console.log('[CameraFeed] Backend already running, restoring UI state...');
        setIsStreaming(true);
      } else {
        // Start with last used source or default to webcam
        const sourceToUse = currentSource.type || 'webcam';
        console.log(`[CameraFeed] Starting with source: ${sourceToUse}`);
        handleSourceChange(sourceToUse, currentSource);
      }
    } else if (dataMode === 'demo') {
      hasAutoStartedRef.current = false;
      stopCamera();
      localStorage.removeItem('backendRunning');
    }
  }, [dataMode]);

  // REMOVED: Initialize camera useEffect was causing race conditions
  // Camera initialization is now exclusively handled by handleSourceChange

  // Connect to backend Socket.IO for detections + health monitoring
  // This effect runs once when entering Live mode and stays connected
  useEffect(() => {
    if (dataMode === 'live') {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

      console.log('[CameraFeed] Connecting to backend Socket.IO...');
      cameraBackendService.connect(backendUrl);
      setBackendConnected(cameraBackendService.getConnectionStatus());

      // Subscribe to detections
      const unsubscribeDetections = cameraBackendService.onDetections((tracks) => {
        // Only update if data actually changed to prevent unnecessary re-renders
        setDetections(prev => {
          if (prev.length !== tracks.length) return tracks;
          // Check if content is the same
          const changed = tracks.some((t, i) =>
            !prev[i] || t.id !== prev[i].id ||
            t.bbox[0] !== prev[i].bbox[0] || t.bbox[1] !== prev[i].bbox[1]
          );
          return changed ? tracks : prev;
        });
        setBackendConnected(true);
      });

      // Subscribe to backend status events (real-time readiness updates)
      const unsubscribeHealth = cameraBackendService.onBackendStatus((health) => {
        setBackendHealth(health);
        if (health.streaming) {
          setBackendConnected(true);
          setConnectionState('STREAMING');
        } else if (health.model_loaded) {
          setConnectionState('CONNECTED');
        } else {
          setConnectionState('WAITING_FOR_BACKEND');
        }
      });

      // Poll health endpoint with exponential backoff until backend is streaming
      // States: CONNECTING -> WAITING_FOR_BACKEND -> CONNECTED -> STREAMING
      setConnectionState('CONNECTING');
      retryCountRef.current = 0;

      const pollHealthWithBackoff = async () => {
        const h = await cameraBackendService.checkHealth();
        if (h) {
          setBackendHealth(h);
          if (h.streaming) {
            setBackendConnected(true);
            setConnectionState('STREAMING');
            if (healthPollRef.current) {
              clearInterval(healthPollRef.current);
              healthPollRef.current = null;
            }
          } else if (h.model_loaded) {
            setConnectionState('CONNECTED');
            retryCountRef.current = 0; // reset on progress
          } else if (h.status === 'loading' || h.phase !== 'offline') {
            setConnectionState('WAITING_FOR_BACKEND');
            retryCountRef.current = 0;
          } else {
            // Backend offline — count retries with exponential backoff
            retryCountRef.current += 1;
            setRetryCountDisplay(retryCountRef.current);
            if (retryCountRef.current >= MAX_RETRIES) {
              setConnectionState('FAILED');
              if (healthPollRef.current) {
                clearInterval(healthPollRef.current);
                healthPollRef.current = null;
              }
            } else {
              // Exponential backoff: reschedule with longer delay
              const delay = Math.min(30000, Math.pow(2, retryCountRef.current - 1) * 1000); // 1s, 2s, 4s, 8s, 16s, 30s cap
              setNextRetryIn(Math.round(delay / 1000));
              if (healthPollRef.current) {
                clearInterval(healthPollRef.current);
                healthPollRef.current = null;
              }
              healthPollRef.current = setTimeout(pollHealthWithBackoff, delay) as unknown as ReturnType<typeof setInterval>;
              return;
            }
          }
        } else {
          // checkHealth returned null — backend unreachable
          retryCountRef.current += 1;
          if (retryCountRef.current >= MAX_RETRIES) {
            setConnectionState('FAILED');
            if (healthPollRef.current) {
              clearInterval(healthPollRef.current);
              healthPollRef.current = null;
            }
            return;
          }
        }
      };
      pollHealthWithBackoff(); // immediate first check
      healthPollRef.current = setInterval(pollHealthWithBackoff, 2000); // Poll every 2s

      // Store cleanup function
      cleanupRef.current = () => {
        unsubscribeDetections();
        unsubscribeHealth();
      };

      return () => {
        console.log('[CameraFeed] Cleanup: Unsubscribing from detections + health');
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
        if (healthPollRef.current) {
          clearInterval(healthPollRef.current);
          healthPollRef.current = null;
        }
        // Cleanup MJPEG retry refs
        if (mjpegRetryTimeoutRef.current) {
          clearTimeout(mjpegRetryTimeoutRef.current);
          mjpegRetryTimeoutRef.current = null;
        }
        if (retryCountdownRef.current) {
          clearInterval(retryCountdownRef.current);
          retryCountdownRef.current = null;
        }
        // CRITICAL: Do NOT stop backend stream on component unmount
        // This allows backend to keep running when navigating to Zone Labeling
        // Backend stream is only stopped when explicitly changing sources or exiting Live mode
      };
    } else {
      setBackendConnected(false);
      setDetections([]);
      setBackendHealth(null);
      setConnectionState('DISCONNECTED');
      setRetryCountDisplay(0);
      setNextRetryIn(0);
      mjpegRetryCountRef.current = 0;
      if (healthPollRef.current) {
        clearInterval(healthPollRef.current);
        healthPollRef.current = null;
      }
      if (mjpegRetryTimeoutRef.current) {
        clearTimeout(mjpegRetryTimeoutRef.current);
        mjpegRetryTimeoutRef.current = null;
      }
      if (retryCountdownRef.current) {
        clearInterval(retryCountdownRef.current);
        retryCountdownRef.current = null;
      }
      localStorage.removeItem('backendRunning');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataMode, sourceVersion]);

  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Load zones from localStorage
  useEffect(() => {
    const loadZones = () => {
      const saved = localStorage.getItem('cameraZones');
      if (saved) {
        try {
          setZones(JSON.parse(saved));
        } catch {
          setZones([]);
        }
      }
    };

    loadZones();

    // Listen for zone updates
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cameraZones') {
        loadZones();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Update canvas size ONLY from actual MJPEG frame dimensions — never from container.
  // Using container.clientHeight as fallback was causing the layout to stretch to a
  // portrait aspect ratio at startup before the stream delivered the first frame.
  useEffect(() => {
    if (!isStreaming || canvasSizeInitialized.current) return;

    const checkInterval = setInterval(() => {
      const img = mjpegImgRef.current;

      if (img && img.naturalWidth > 64 && img.naturalHeight > 64) {
        setVideoDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        canvasSizeInitialized.current = true;
        clearInterval(checkInterval);
      }
      // Do NOT fall back to container dimensions — that corrupts the aspect ratio.
    }, 200);

    return () => clearInterval(checkInterval);
  }, [isStreaming]);

  // Render detection overlays
  useEffect(() => {
    if (!canvasRef.current || !isStreaming) return;

    const canvas = canvasRef.current;

    if (canvas.width < 64 || canvas.height < 64) {
      // Use actual video dimensions if available, else 16:9 default
      if (videoDimensions.width > 64 && videoDimensions.height > 64) {
        canvas.width = videoDimensions.width;
        canvas.height = videoDimensions.height;
      } else {
        const container = containerRef.current;
        if (container && container.clientWidth > 64) {
          canvas.width = container.clientWidth;
          canvas.height = Math.round(container.clientWidth * 9 / 16);
        } else {
          return;
        }
      }
    }

    const drawFrame = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Calculate responsive sizes based on canvas dimensions
      // Font size: 1.5% of canvas height (min 10px, max 18px)
      const fontSize = Math.min(18, Math.max(10, canvas.height * 0.015));
      // Line width: 0.25% of canvas width (min 2px, max 4px)
      const lineWidth = Math.min(4, Math.max(2, canvas.width * 0.0025));
      // Badge font size: slightly smaller
      const badgeFontSize = Math.floor(fontSize * 0.85);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw zones if enabled
      if (showZones && zones.length > 0) {
        zones.forEach((zone) => {
          // Zone coordinates are normalized (0-1), convert to pixels
          const zoneX = zone.x * canvas.width;
          const zoneY = zone.y * canvas.height;
          const zoneWidth = zone.width * canvas.width;
          const zoneHeight = zone.height * canvas.height;

          ctx.strokeStyle = zone.type === 'entrance' ? '#10b981' : '#ef4444';
          ctx.lineWidth = lineWidth; // Use responsive line width
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(zoneX, zoneY, zoneWidth, zoneHeight);
          ctx.setLineDash([]);

          // Draw zone label with responsive font
          ctx.fillStyle = zone.type === 'entrance' ? '#10b981' : '#ef4444';
          ctx.font = `${fontSize}px sans-serif`; // Use responsive font size
          const textMetrics = ctx.measureText(zone.name);
          ctx.fillRect(zoneX, zoneY - 20, textMetrics.width + 10, 20);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(zone.name, zoneX + 5, zoneY - 5);
        });
      }

      // Draw detections
      detections.forEach((detection, _idx) => {
        const [x, y, w, h] = detection.bbox; // Normalized coordinates [0-1]

        // Convert to pixel coordinates
        const px = x * canvas.width;
        const py = y * canvas.height;
        const pw = w * canvas.width;
        const ph = h * canvas.height;

        // Draw bounding box with responsive line width
        ctx.strokeStyle = detection.state === 'entering' ? '#10b981' :
          detection.state === 'exiting' ? '#ef4444' : '#3b82f6';
        ctx.lineWidth = lineWidth; // Use responsive line width
        ctx.strokeRect(px, py, pw, ph);

        // Draw label background
        const gender = detection.gender === 'male' ? 'M' :
          detection.gender === 'female' ? 'F' : '?';

        // Use age bucket directly from backend (e.g., '18-24', '25-34', etc.)
        const ageBucket = detection.ageBucket || 'Unknown';
        const dwellTime = Math.floor(detection.dwellSec);
        // Lock indicator: solid "=" when both age + gender are stable,
        // helps the user tell "model is sure" from "still learning".
        const bothLocked = Boolean(detection.ageLocked && detection.genderLocked);
        const lockMark = bothLocked ? ' =' : '';
        const labelText = `${gender} | ${ageBucket} | ${dwellTime}s${lockMark}`;

        ctx.font = `${fontSize}px sans-serif`; // Use responsive font size
        const textMetrics = ctx.measureText(labelText);
        const textHeight = Math.ceil(fontSize * 1.4); // Height proportional to font size

        ctx.fillStyle = detection.state === 'entering' ? '#10b981' :
          detection.state === 'exiting' ? '#ef4444' : '#3b82f6';
        ctx.fillRect(px, py - textHeight, textMetrics.width + 10, textHeight);

        // Draw label text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, px + 5, py - 5);

        // Draw ID badge with responsive font
        ctx.font = `${badgeFontSize}px sans-serif`; // Use responsive badge font size
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        const badgeHeight = Math.ceil(badgeFontSize * 1.5);
        ctx.fillRect(px, py + ph, 40, badgeHeight);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`#${detection.id.slice(-4)}`, px + 5, py + ph + badgeHeight - 5);
      });

      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [detections, isStreaming, showZones, zones, videoDimensions]);


  const initializeCamera = async () => {
    setError(null);
    // Reset MJPEG retry counters so the stream can reconnect
    mjpegRetryCountRef.current = 0;
    setRetryCountDisplay(0);
    setNextRetryIn(0);

    try {
      let mediaStream: MediaStream | null = null;

      switch (currentSource.type) {
        case 'webcam':
        case 'iphone':
          // CRITICAL: In Live mode, backend owns the camera exclusively
          // Frontend should NOT use getUserMedia to avoid conflicts
          if (dataMode === 'live') {
            setIsStreaming(true);
            // Backend will handle camera access and send frames via MJPEG stream
            return;
          }

          // Demo mode: Use getUserMedia for local preview only
          if (currentSource.type === 'webcam') {
            // MacBook built-in camera (default device)
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: 'user'
              },
              audio: false
            });
          } else {
            // iPhone camera - enumerate devices and select by label
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');

            // Look for "iPhone" or "Continuity" in label
            const iphoneDevice = videoDevices.find(d =>
              d.label.toLowerCase().includes('iphone') ||
              d.label.toLowerCase().includes('continuity')
            );

            if (iphoneDevice) {
              mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                  deviceId: { exact: iphoneDevice.deviceId },
                  width: { ideal: 1920 },
                  height: { ideal: 1080 }
                },
                audio: false
              });
            } else if (videoDevices.length > 1) {
              // Fallback to second camera if no label match
              mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                  deviceId: { exact: videoDevices[1].deviceId },
                  width: { ideal: 1920 },
                  height: { ideal: 1080 }
                },
                audio: false
              });
            } else {
              throw new Error(
                'No secondary camera found.\n\n' +
                'To use your iPhone as a camera on Windows:\n' +
                '1. Install EpocCam on iPhone and Windows (elgato.com/epoccam)\n' +
                '   Or iVCam (e2esoft.com/ivcam)\n' +
                '2. Connect via USB or Wi-Fi and launch the app\n' +
                '3. Select "Phone Cam" again once connected'
              );
            }
          }
          break;

        case 'ip':
          // IP camera - backend handles RTSP/HTTP streams
          if (currentSource.ipCameraId) {
            const ipCamera = ipCameras.find(cam => cam.id === currentSource.ipCameraId);
            if (ipCamera) {
              setError(
                `IP Camera "${ipCamera.name}" requires backend processing.\n\n` +
                `Run in terminal:\n` +
                `./scripts/start-camera-backend.sh "${ipCamera.url}"`
              );
              setIsStreaming(true);
              return;
            }
          }
          throw new Error('Please select an IP camera from settings');

        case 'videolink':
          // Video Link (YouTube, HLS, RTMP, MP4) - backend processes
          if (dataMode === 'live') {
            if (!currentSource.url) {
              throw new Error('Please enter a video URL');
            }
            // Backend will handle video link processing
            // Frontend just shows MJPEG stream from backend
            setIsStreaming(true);
            return;
          }
          throw new Error('Video links require Live mode');

        case 'file':
          // Local video file - play in browser
          if (currentSource.file && videoRef.current) {
            const url = URL.createObjectURL(currentSource.file);
            videoRef.current.src = url;
            videoRef.current.loop = true;
            await videoRef.current.play();
            setIsStreaming(true);
            setError(
              'Local video playback only.\n\n' +
              'For YOLO processing, run:\n' +
              `./scripts/start-camera-backend.sh "${currentSource.file.name}"`
            );
            return;
          }
          throw new Error('Please select a video file');

      }

      if (mediaStream && videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setStream(mediaStream);
        setIsStreaming(true);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Failed to access camera');
      setIsStreaming(false);
    }
  };

  const stopCamera = useCallback(() => {
    // Stop MediaStream tracks
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = '';
      videoRef.current.load(); // Force release of resources
    }
    
    // Stop MJPEG stream by clearing src
    if (mjpegImgRef.current) {
      mjpegImgRef.current.src = '';
    }
    
    setIsStreaming(false);
    setDetections([]);
    setBackendConnected(false);
  }, [stream]);

  const handleSourceChange = useCallback(async (type: CameraSource, config?: Partial<CameraSourceConfig>) => {
    // Prevent multiple simultaneous source changes
    if (isChangingSourceRef.current) {
      return;
    }
    isChangingSourceRef.current = true;
    setIsSwitchingSource(true);

    setShowSourceSelect(false);
    setShowAdvancedSettings(false);
    setError(null);

    // Reset canvas size initialization flag when changing sources
    canvasSizeInitialized.current = false;

    try {
      // 1. Stop current frontend camera and streams
      stopCamera();

      // 3. Stop backend stream if active (to release camera hardware)
      if (dataMode === 'live') {
        try {
          await cameraBackendService.stopStream();
        } catch {
          // Expected on first run or if already stopped
        }

        // Give hardware time to release (500ms is safer for camera hardware)
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 4. Start new backend stream with selected source
      if (dataMode === 'live') {
        let backendSource: number | string = 0;

        // Map frontend source type to backend source
        switch (type) {
          case 'webcam':
            backendSource = 0; // MacBook camera
            break;
          case 'iphone':
            // Eğer Tailscale/remote URL girilmişse, ivCam HTTP stream'ini direkt kullan
            // Bu sayede ivCam Windows client'a gerek kalmaz (Parsec/uzaktan erişim için)
            if (iphoneRemoteUrl.trim()) {
              backendSource = iphoneRemoteUrl.trim();
            } else {
              // Aynı ağdayken: ivCam virtual kamera (index 1)
              backendSource = 1;
            }
            break;
          case 'ip':
            if (config?.ipCameraId) {
              const camera = ipCameras.find(cam => cam.id === config.ipCameraId);
              if (camera) {
                backendSource = camera.url;
              }
            }
            break;
          case 'videolink':
            if (config?.url) {
              backendSource = config.url;
            } else {
              throw new Error('Please enter a video URL');
            }
            break;
          // For 'file', backend doesn't process it (browser handles local playback)
        }

        // Start Python backend with the selected source
        console.log(`[CameraFeed] Step 6: Starting Python backend with source: ${backendSource}...`);
        await startPythonBackend(backendSource);

        // Ensure backend connection is established
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
        console.log('[CameraFeed] Step 7: Connecting to backend...');
        cameraBackendService.connect(backendUrl);

        // Change source on backend - this will also start the analytics stream
        console.log('[CameraFeed] Step 8: Changing source on backend...');
        await cameraBackendService.changeSource(backendSource);
        console.log('[CameraFeed] Backend source changed successfully');

        // REMOVED: startStream() call - changeSource already starts the stream internally
        // This was causing "Analytics already running" warning

        // Wait for stream to initialize
        console.log('[CameraFeed] Step 9: Waiting for stream initialization...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Set streaming state BEFORE updating source to trigger MJPEG display
        setIsStreaming(true);

        // Trigger re-subscription to backend detections + health polling
        // The useEffect depends on sourceVersion and will re-run, establishing fresh subscriptions
        setSourceVersion(v => v + 1);
      }

      // 10. Update frontend source state AFTER backend has switched
      console.log('[CameraFeed] Step 10: Updating frontend source state...');
      const newSource = { type, ...config };
      setCurrentSource(newSource);

      // Save to localStorage for persistence across page navigation
      localStorage.setItem('lastCameraSource', JSON.stringify(newSource));
      localStorage.setItem('backendRunning', 'true');
      console.log('[CameraFeed] ✅ Source saved to localStorage for persistence');

      console.log(`[CameraFeed] ===== SOURCE CHANGE COMPLETED SUCCESSFULLY TO: ${type} =====`);

    } catch (err) {
      console.error('[CameraFeed] Source change failed:', err);
      setError(`Failed to switch to ${type}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsStreaming(false);
    } finally {
      isChangingSourceRef.current = false;
      setIsSwitchingSource(false);
    }
  }, [dataMode, ipCameras, stopCamera]);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleVideoLinkConnect = () => {
    if (videoLinkUrl.trim()) {
      handleSourceChange('videolink', { url: videoLinkUrl });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSourceChange('file', { file });
    }
  };

  const handleAddIPCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (newIPCamera.name && newIPCamera.url) {
      const camera: IPCamera = {
        id: Date.now().toString(),
        name: newIPCamera.name,
        url: newIPCamera.url,
        type: newIPCamera.type
      };
      setIPCameras([...ipCameras, camera]);
      setNewIPCamera({ name: '', url: '', type: 'rtsp' });
      setShowAddIPCamera(false);
    }
  };

  const handleSelectIPCamera = (cameraId: string) => {
    handleSourceChange('ip', { ipCameraId: cameraId });
  };

  const handleDeleteIPCamera = (cameraId: string) => {
    setIPCameras(ipCameras.filter(cam => cam.id !== cameraId));
  };

  // Map saved camera sourceType to CameraFeed source change
  const handleSavedCameraSelect = useCallback((camera: SavedCamera) => {
    const value = camera.sourceValue;
    switch (camera.sourceType.toUpperCase()) {
      case 'WEBCAM':
        handleSourceChange('webcam');
        break;
      case 'PHONE':
      case 'HTTP':
        // Phone camera or HTTP stream — use as videolink with URL
        handleSourceChange('videolink', { url: value });
        break;
      case 'RTSP':
      case 'RTMP':
        handleSourceChange('videolink', { url: value });
        break;
      case 'YOUTUBE':
        handleSourceChange('videolink', { url: value });
        break;
      case 'FILE':
        handleSourceChange('videolink', { url: value });
        break;
      case 'SCREEN_CAPTURE':
        handleSourceChange('videolink', { url: 'screen' });
        break;
      default:
        handleSourceChange('videolink', { url: value });
    }
  }, [handleSourceChange]);

  const getSourceLabel = () => {
    switch (currentSource.type) {
      case 'webcam': return 'Camera';
      case 'iphone': return 'Phone Cam';
      case 'ip': {
        const camera = ipCameras.find(cam => cam.id === currentSource.ipCameraId);
        return camera ? camera.name : 'IP Camera';
      }
      case 'videolink': return 'Video Link';
      case 'file': return currentSource.file ? currentSource.file.name : 'Video File';
      default: return 'Camera';
    }
  };

  return (
    <GlassCard
      ref={containerRef}
      variant="neon"
      className={`overflow-hidden ${isFullscreen ? 'flex flex-col h-screen' : ''}`}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-surface-2 to-surface-1 px-4 py-3 flex items-center justify-between border-b border-white/[0.08]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-accent-500 rounded-xl flex items-center justify-center shadow-glow-brand">
            <Video className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-ink-0">{getSourceLabel()}</h3>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-success animate-pulse' : 'bg-danger'}`}></span>
              <span className="text-xs text-ink-2 font-mono">
                {dataMode === 'demo' ? t('cameraFeed.demoMode') : (isStreaming ? t('cameraFeed.live') : t('cameraFeed.offline'))}
              </span>
              {isStreaming && backendConnected && (
                <>
                  <span className="text-xs text-ink-3">•</span>
                  <span className="text-xs text-success font-mono">{t('cameraFeed.backendConnected')}</span>
                </>
              )}
              {isStreaming && !backendConnected && dataMode === 'live' && (
                <>
                  <span className="text-xs text-ink-3">•</span>
                  <span className="text-xs text-warning font-mono">{t('cameraFeed.waitingForBackend')}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Heatmap Toggle */}
          {dataMode === 'live' && (
            <button
              onClick={() => {
                const newState = !showHeatmap;
                setShowHeatmap(newState);
                // Send toggle to backend for heatmap visibility
                cameraBackendService.toggleHeatmap(newState).catch(() => {
                  // Silently handle errors
                });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
                showHeatmap
                  ? 'bg-violet-500 text-white shadow-glow-brand'
                  : 'bg-white/[0.06] text-ink-2 hover:bg-white/[0.1]'
              }`}
              title={showHeatmap ? t('cameraFeed.hideHeatmap') : t('cameraFeed.showHeatmap')}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{t('cameraFeed.heatmap')}</span>
            </button>
          )}
          {dataMode === 'live' && (
            <button
              onClick={() => setShowSourceSelect(!showSourceSelect)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title={t('cameraFeed.changeSource')}
            >
              <Settings className="w-4 h-4 text-ink-1" />
            </button>
          )}
          <button
            onClick={() => {
              stopCamera();
              initializeCamera();
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title={t('cameraFeed.reloadCamera')}
          >
            <RotateCcw className="w-4 h-4 text-ink-1" />
          </button>
          <button
            onClick={handleFullscreen}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title={isFullscreen ? t('cameraFeed.exitFullscreen') : t('cameraFeed.fullscreen')}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-ink-1" />
            ) : (
              <Maximize2 className="w-4 h-4 text-ink-1" />
            )}
          </button>
        </div>
      </div>

      {/* Source Selector */}
      {showSourceSelect && dataMode === 'live' && (
        <div className="bg-surface-1 px-4 py-3 border-t border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-ink-2">{t('cameraFeed.selectSource')}</p>
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="text-xs text-brand-300 hover:text-brand-200 font-mono"
            >
              {showAdvancedSettings ? t('cameraFeed.basic') : t('cameraFeed.advanced')}
            </button>
          </div>

          {/* Saved Cameras from Camera Selection page */}
          {savedCameras.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-ink-4 mb-1.5">{t('cameraFeed.savedSources')}</p>
              <div className="space-y-1">
                {savedCameras.map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => handleSavedCameraSelect(cam)}
                    className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${
                      cam.isActive
                        ? 'bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/40'
                        : 'bg-surface-2/50 text-ink-2 hover:bg-surface-3/50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {cam.isActive && <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />}
                      <span className="font-medium">{cam.name}</span>
                    </span>
                    <span className="text-ink-4 text-[10px] uppercase">{cam.sourceType}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Connect */}
          <p className="text-xs text-ink-4 mb-1.5">{t('cameraFeed.quickConnect')}</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => handleSourceChange('webcam')}
              className={`px-3 py-2 text-xs rounded-lg transition-colors relative ${currentSource.type === 'webcam'
                ? 'bg-gradient-to-r from-brand-500 to-accent-500 text-white ring-2 ring-brand-400/50 shadow-glow-brand'
                : 'bg-surface-2 text-ink-1 hover:bg-surface-3'
                }`}
            >
              <span className="flex items-center justify-center">
                {currentSource.type === 'webcam' && (
                  <span className="absolute left-2 w-2 h-2 bg-success rounded-full animate-pulse"></span>
                )}
                {t('cameraFeed.camera')}
              </span>
            </button>
            <button
              onClick={() => handleSourceChange('iphone')}
              className={`px-3 py-2 text-xs rounded-lg transition-colors relative ${currentSource.type === 'iphone'
                ? 'bg-gradient-to-r from-brand-500 to-accent-500 text-white ring-2 ring-brand-400/50 shadow-glow-brand'
                : 'bg-surface-2 text-ink-1 hover:bg-surface-3'
                }`}
            >
              <span className="flex items-center justify-center">
                {currentSource.type === 'iphone' && (
                  <span className="absolute left-2 w-2 h-2 bg-success rounded-full animate-pulse"></span>
                )}
                {t('cameraFeed.phoneCam')}
              </span>
            </button>
          </div>

          {/* Phone Cam — Tailscale / Remote ivCam URL */}
          {currentSource.type === 'iphone' && (
            <div className="mt-2">
              <label className="text-xs text-ink-2 mb-1 flex items-center">
                <LinkIcon className="w-3 h-3 mr-1" />
                {t('cameraFeed.ivcamUrlLabel')}
                <span className="ml-2 text-ink-4">{t('cameraFeed.ivcamRemote')}</span>
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={iphoneRemoteUrl}
                  onChange={(e) => {
                    setIphoneRemoteUrl(e.target.value);
                    localStorage.setItem('iphoneRemoteUrl', e.target.value);
                  }}
                  placeholder="http://100.127.69.88:4747/video"
                  className="flex-1 px-3 py-2 bg-surface-2 text-ink-0 text-xs rounded-lg border border-white/[0.08] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </div>
              <p className="text-xs text-ink-4 mt-1">
                {iphoneRemoteUrl.trim()
                  ? t('cameraFeed.tailscaleUsed')
                  : t('cameraFeed.ivcamVirtual')}
              </p>
            </div>
          )}

          {/* Video Link Input (YouTube, HLS, RTMP, MP4) */}
          <div className="mt-3">
            <label className="text-xs text-ink-2 mb-1 flex items-center">
              <LinkIcon className="w-3 h-3 mr-1" />
              {t('cameraFeed.videoLink')}
              {currentSource.type === 'videolink' && (
                <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-brand-500 to-accent-500 text-white text-xs rounded-full flex items-center shadow-glow-brand">
                  <span className="w-1.5 h-1.5 bg-success rounded-full mr-1 animate-pulse"></span>
                  {t('cameraFeed.active')}
                </span>
              )}
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={videoLinkUrl}
                onChange={(e) => setVideoLinkUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or .m3u8/.mp4 URL"
                className={`flex-1 px-3 py-2 bg-surface-2 text-ink-0 text-xs rounded-lg border transition-colors focus:outline-none ${
                  currentSource.type === 'videolink'
                    ? 'border-brand-500 ring-1 ring-brand-400/50'
                    : 'border-white/[0.08] focus:border-brand-500'
                }`}
              />
              <button
                onClick={handleVideoLinkConnect}
                disabled={!videoLinkUrl.trim()}
                className="px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white text-xs rounded-lg hover:shadow-glow-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {t('cameraFeed.connect')}
              </button>
            </div>
          </div>

          {/* Advanced Settings */}
          {showAdvancedSettings && (
            <div className="space-y-3 border-t border-white/[0.08] pt-3">
              {/* File Upload */}
              <div>
                <label className="text-xs text-ink-2 mb-1 block">
                  <Upload className="w-3 h-3 inline mr-1" />
                  {t('cameraFeed.localFile')}
                </label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="w-full text-xs text-ink-2 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:bg-gradient-to-r file:from-brand-500 file:to-accent-500 file:text-white hover:file:shadow-glow-brand file:cursor-pointer"
                />
              </div>

              {/* IP Cameras */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-ink-2">{t('cameraFeed.ipCameras')}</label>
                  <button
                    onClick={() => setShowAddIPCamera(!showAddIPCamera)}
                    className="text-xs text-brand-300 hover:text-brand-200 flex items-center font-mono"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {t('cameraFeed.addCamera')}
                  </button>
                </div>

                {showAddIPCamera && (
                  <form onSubmit={handleAddIPCamera} className="bg-surface-2 rounded-lg p-3 mb-2 space-y-2">
                    <input
                      type="text"
                      placeholder={t('cameraFeed.cameraNamePh')}
                      value={newIPCamera.name}
                      onChange={(e) => setNewIPCamera({ ...newIPCamera, name: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-1 text-ink-0 text-xs rounded border border-white/[0.08] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                      required
                    />
                    <input
                      type="text"
                      placeholder="rtsp://username:password@ip:port/stream"
                      value={newIPCamera.url}
                      onChange={(e) => setNewIPCamera({ ...newIPCamera, url: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-1 text-ink-0 text-xs rounded border border-white/[0.08] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                      required
                    />
                    <div className="flex space-x-2">
                      <select
                        value={newIPCamera.type}
                        onChange={(e) => setNewIPCamera({ ...newIPCamera, type: e.target.value as 'rtsp' | 'http' })}
                        className="flex-1 px-3 py-2 bg-surface-1 text-ink-0 text-xs rounded border border-white/[0.08] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                      >
                        <option value="rtsp">RTSP</option>
                        <option value="http">HTTP</option>
                      </select>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white text-xs rounded hover:shadow-glow-brand transition-all"
                      >
                        {t('cameraFeed.add')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddIPCamera(false)}
                        className="px-4 py-2 bg-surface-3 text-white text-xs rounded hover:bg-surface-3"
                      >
                        {t('cameraFeed.cancel')}
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-1">
                  {ipCameras.length === 0 ? (
                    <p className="text-xs text-ink-4 italic">{t('cameraFeed.noIpCameras')}</p>
                  ) : (
                    ipCameras.map((camera) => (
                      <div
                        key={camera.id}
                        className="flex items-center justify-between bg-surface-2 rounded px-3 py-2"
                      >
                        <button
                          onClick={() => handleSelectIPCamera(camera.id)}
                          className="flex-1 text-left text-xs text-ink-0 hover:text-brand-300"
                        >
                          <span className="font-semibold">{camera.name}</span>
                          <span className="text-ink-3 ml-2">({camera.type.toUpperCase()})</span>
                        </button>
                        <button
                          onClick={() => handleDeleteIPCamera(camera.id)}
                          className="p-1 hover:bg-danger/20 rounded transition-colors"
                        >
                          <X className="w-3 h-3 text-ink-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Feed - Container matches exact video aspect ratio for perfect overlay alignment */}
      <div
        className={`relative bg-black ${isFullscreen ? 'flex items-center justify-center' : ''}`}
        style={(() => {
          // In fullscreen: fill available space, center video
          if (isFullscreen) {
            return { flex: 1, minHeight: 0 };
          }
          if (videoDimensions.width > 0 && videoDimensions.height > 0) {
            const isPortrait = videoDimensions.height > videoDimensions.width;
            return {
              aspectRatio: `${videoDimensions.width}/${videoDimensions.height}`,
              ...(isPortrait ? { maxHeight: '70vh', margin: '0 auto' } : {})
            };
          }
          return { aspectRatio: '16/9' };
        })()}
      >
        <div
          className="absolute inset-0"
          style={isFullscreen && videoDimensions.width > 0 ? {
            aspectRatio: `${videoDimensions.width}/${videoDimensions.height}`,
            maxWidth: '100%',
            maxHeight: '100%',
            margin: 'auto',
            position: 'absolute',
            inset: 0,
          } : undefined}
        >
          {dataMode === 'demo' ? (
            // Demo mode - placeholder
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-br from-surface-2 via-surface-1 to-surface-0 flex items-center justify-center">
                <div className="text-center">
                  <CameraIcon className="w-16 h-16 text-ink-4 mx-auto mb-4" />
                  <p className="text-ink-3 font-medium">{t('cameraFeed.demoActive')}</p>
                  <p className="text-ink-4 text-sm mt-1">{t('cameraFeed.switchToLive')}</p>
                  <p className="text-ink-4 text-xs mt-2">{t('cameraFeed.demoCharts')}</p>
                </div>
              </div>
            </div>
          ) : error ? (
            // Error state
            <div className="w-full h-full flex items-center justify-center p-6">
              <div className="text-center max-w-md">
                <AlertCircle className="w-12 h-12 text-danger mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-danger font-medium mb-2">{t('cameraFeed.cameraError')}</p>
                <pre className="text-ink-2 text-xs whitespace-pre-wrap text-left bg-surface-1 rounded p-3 mb-4 font-mono">
                  {error}
                </pre>
                <button
                  onClick={initializeCamera}
                  className="px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white text-sm rounded-lg hover:shadow-glow-brand transition-all"
                >
                  {t('cameraFeed.retry')}
                </button>
              </div>
            </div>
          ) : !isStreaming || isSwitchingSource ? (
            // Not streaming or switching - show state machine status
            <div className="w-full h-full flex items-center justify-center">
              {connectionState === 'FAILED' ? (
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-danger mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-danger font-medium mb-2">{t('cameraFeed.connectionFailed')}</p>
                  <p className="text-ink-4 text-sm mt-1 mb-4">
                    {t('cameraFeed.pythonUnreachable', { max: MAX_RETRIES })}
                  </p>
                  <button
                    onClick={() => {
                      retryCountRef.current = 0;
                      setConnectionState('CONNECTING');
                      const pollRetry = async () => {
                        const h = await cameraBackendService.checkHealth();
                        if (h) {
                          setBackendHealth(h);
                          if (h.streaming) { setBackendConnected(true); setConnectionState('STREAMING'); }
                          else if (h.model_loaded) setConnectionState('CONNECTED');
                          else setConnectionState('WAITING_FOR_BACKEND');
                        }
                      };
                      pollRetry();
                      if (healthPollRef.current) clearInterval(healthPollRef.current);
                      healthPollRef.current = setInterval(pollRetry, 2000);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white text-sm rounded-lg hover:shadow-glow-brand transition-all"
                  >
                    {t('cameraFeed.retry')}
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"></div>
                  <p className="text-ink-3 font-medium">
                    {isSwitchingSource ? t('cameraFeed.switchingSource') :
                     connectionState === 'CONNECTING' ? t('cameraFeed.connectingToBackend') :
                     connectionState === 'WAITING_FOR_BACKEND' ? t('cameraFeed.backendLoadingModel') :
                     connectionState === 'CONNECTED' ? t('cameraFeed.startingStream') :
                     t('cameraFeed.connectingCamera')}
                  </p>
                  <p className="text-ink-4 text-sm mt-1">
                    {connectionState === 'WAITING_FOR_BACKEND'
                      ? (retryCountRef.current > 0
                          ? t('cameraFeed.pleaseWaitAttempt', { attempt: retryCountRef.current, max: MAX_RETRIES })
                          : t('cameraFeed.loadingModel'))
                      : t('cameraFeed.cameraPermission')}
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {/* MJPEG stream from backend (Live mode - 30 FPS, low latency) */}
          {dataMode === 'live' && isStreaming && !error && !stream && !isSwitchingSource && (
            <img
              ref={mjpegImgRef}
              src={mjpegUrl}
              alt="Camera stream"
              className="w-full h-full object-fill"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setVideoDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                }
                // Reset retry counters on successful load
                mjpegRetryCountRef.current = 0;
                setRetryCountDisplay(0);
                setNextRetryIn(0);
                if (retryCountdownRef.current) {
                  clearInterval(retryCountdownRef.current);
                  retryCountdownRef.current = null;
                }
                setError(null);
              }}
              onError={() => {
                // Skip errors while switching sources
                if (isChangingSourceRef.current || !isStreaming) return;
                console.warn(`[CameraFeed] MJPEG stream error (attempt ${mjpegRetryCountRef.current + 1}/${MAX_MJPEG_RETRIES})`);

                if (mjpegRetryCountRef.current >= MAX_MJPEG_RETRIES) {
                  setError(`MJPEG stream ${MAX_MJPEG_RETRIES} denemeden sonra başarısız.\n\niVCam/kamera uygulamasının çalıştığından ve backend'in bağlı olduğundan emin olun.`);
                  return;
                }

                // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s cap
                const attempt = mjpegRetryCountRef.current;
                const delayMs = Math.min(30000, Math.pow(2, attempt) * 1000);
                mjpegRetryCountRef.current += 1;
                setRetryCountDisplay(mjpegRetryCountRef.current);

                // Start countdown
                let remaining = Math.round(delayMs / 1000);
                setNextRetryIn(remaining);
                if (retryCountdownRef.current) clearInterval(retryCountdownRef.current);
                retryCountdownRef.current = setInterval(() => {
                  remaining -= 1;
                  setNextRetryIn(remaining);
                  if (remaining <= 0 && retryCountdownRef.current) {
                    clearInterval(retryCountdownRef.current);
                    retryCountdownRef.current = null;
                  }
                }, 1000);

                // Force MJPEG reconnect by briefly hiding the img
                if (mjpegRetryTimeoutRef.current) clearTimeout(mjpegRetryTimeoutRef.current);
                mjpegRetryTimeoutRef.current = setTimeout(() => {
                  if (!isChangingSourceRef.current) {
                    setIsStreaming(false);
                    setTimeout(() => setIsStreaming(true), 150);
                  }
                }, delayMs);
              }}
            />
          )}

          {/* Video element (Demo mode or when using browser camera directly) */}
          <video
            ref={videoRef}
            className={`w-full h-full object-fill ${dataMode === 'demo' || error ? 'hidden' : ''}`}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              if (video.videoWidth && video.videoHeight) {
                setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
              }
            }}
          />

          {/* Canvas overlay for detections — matches video dimensions exactly */}
          {dataMode === 'live' && isStreaming && !error && (
            <canvas
              ref={canvasRef}
              width={videoDimensions.width > 64 ? videoDimensions.width : 1920}
              height={videoDimensions.height > 64 ? videoDimensions.height : 1080}
              className="absolute inset-0 pointer-events-none"
              style={{ width: '100%', height: '100%' }}
            />
          )}

          {/* Timestamp & Stats Overlay */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs font-mono">
              {new Date().toLocaleTimeString()}
            </div>
            {dataMode === 'live' && detections.length > 0 && (
              <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
                <p className="text-xs text-white font-semibold">
                  {t('cameraFeed.detected', { count: detections.length })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div className="px-4 py-3 bg-surface-2/60 border-t border-white/[0.08] flex items-center justify-between">
        <div className="text-xs text-ink-4">
          <span className="font-semibold">{t('cameraFeed.status')}</span> {
            dataMode === 'demo' ? t('cameraFeed.statusDemo') :
            isStreaming ? t('cameraFeed.statusLive', { source: getSourceLabel() }) :
            connectionState === 'FAILED' ? t('cameraFeed.statusUnreachable') :
            connectionState === 'WAITING_FOR_BACKEND' ? t('cameraFeed.statusLoading') :
            connectionState === 'CONNECTING' ? t('cameraFeed.statusConnecting') :
            t('cameraFeed.statusWaiting')
          }
        </div>
        {dataMode === 'live' && isStreaming && (
          <div className="flex items-center space-x-4 text-xs">
            <div>
              <span className="text-ink-4">{t('cameraFeed.detectedLabel')}</span>
              <span className="font-semibold text-ink-5 ml-1">{detections.length}</span>
            </div>
            <div className={`flex items-center font-mono ${backendConnected ? 'text-success' : 'text-warning'}`}>
              <span className={`w-2 h-2 rounded-full mr-1 ${backendConnected ? 'bg-success' : 'bg-warning'}`}></span>
              <span>{backendConnected ? t('cameraFeed.backendActive') : t('cameraFeed.backendOffline')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateX(10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </GlassCard>
  );
}
