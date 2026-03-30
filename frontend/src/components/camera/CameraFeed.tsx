import { Video, Maximize2, Minimize2, RotateCcw, AlertCircle, Camera as CameraIcon, Settings, X, Upload, Link as LinkIcon, Plus, Activity, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDataMode } from '../../contexts/DataModeContext';
import { cameraBackendService, Detection, BackendHealth } from '../../services/cameraBackendService';
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
  const [zones, setZones] = useState<any[]>([]);

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

  // Backend readiness state machine
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const healthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Connection state machine
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;
  const [retryCountDisplay, setRetryCountDisplay] = useState(0);
  const [nextRetryIn, setNextRetryIn] = useState(0); // countdown seconds
  const retryCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mjpegRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mjpegRetryCountRef = useRef(0);
  const MAX_MJPEG_RETRIES = 8;

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
  }, [dataMode]);

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
        zones.forEach((zone: any) => {
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
      detections.forEach((detection, idx) => {
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
        const labelText = `${gender} | ${ageBucket} | ${dwellTime}s`;

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
      // 1. Cleanup existing subscriptions
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      // 2. Stop current frontend camera and streams
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
      className="overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{getSourceLabel()}</h3>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
              <span className="text-xs text-gray-200">
                {dataMode === 'demo' ? 'DEMO MODE' : (isStreaming ? 'LIVE' : 'OFFLINE')}
              </span>
              {isStreaming && backendConnected && (
                <>
                  <span className="text-xs text-gray-200">•</span>
                  <span className="text-xs text-green-400">Backend Connected</span>
                </>
              )}
              {isStreaming && !backendConnected && dataMode === 'live' && (
                <>
                  <span className="text-xs text-gray-200">•</span>
                  <span className="text-xs text-yellow-400">Waiting for backend...</span>
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
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
              title={showHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Heatmap</span>
            </button>
          )}
          {dataMode === 'live' && (
            <button
              onClick={() => setShowSourceSelect(!showSourceSelect)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Change camera source"
            >
              <Settings className="w-4 h-4 text-gray-200" />
            </button>
          )}
          <button
            onClick={() => {
              stopCamera();
              initializeCamera();
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Reload camera"
          >
            <RotateCcw className="w-4 h-4 text-gray-200" />
          </button>
          <button
            onClick={handleFullscreen}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-gray-200" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-200" />
            )}
          </button>
        </div>
      </div>

      {/* Source Selector */}
      {showSourceSelect && dataMode === 'live' && (
        <div className="bg-gray-800 px-4 py-3 border-t border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-300">Select camera source:</p>
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {showAdvancedSettings ? 'Basic' : 'Advanced'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => handleSourceChange('webcam')}
              className={`px-3 py-2 text-xs rounded-lg transition-colors relative ${currentSource.type === 'webcam'
                ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
            >
              <span className="flex items-center justify-center">
                {currentSource.type === 'webcam' && (
                  <span className="absolute left-2 w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                )}
                Camera
              </span>
            </button>
            <button
              onClick={() => handleSourceChange('iphone')}
              className={`px-3 py-2 text-xs rounded-lg transition-colors relative ${currentSource.type === 'iphone'
                ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
            >
              <span className="flex items-center justify-center">
                {currentSource.type === 'iphone' && (
                  <span className="absolute left-2 w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                )}
                Phone Cam
              </span>
            </button>
          </div>

          {/* Phone Cam — Tailscale / Remote ivCam URL */}
          {currentSource.type === 'iphone' && (
            <div className="mt-2">
              <label className="text-xs text-gray-300 mb-1 flex items-center">
                <LinkIcon className="w-3 h-3 mr-1" />
                ivCam Tailscale URL
                <span className="ml-2 text-gray-500">(uzaktan erişim için)</span>
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
                  className="flex-1 px-3 py-2 bg-gray-700 text-white text-xs rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {iphoneRemoteUrl.trim()
                  ? '🌐 Tailscale HTTP stream kullanılacak (ivCam Windows client gerekmez)'
                  : '📱 Boş bırakırsan: ivCam virtual kamera (index 1) — aynı ağda çalışır'}
              </p>
            </div>
          )}

          {/* Video Link Input (YouTube, HLS, RTMP, MP4) */}
          <div className="mt-3">
            <label className="text-xs text-gray-300 mb-1 flex items-center">
              <LinkIcon className="w-3 h-3 mr-1" />
              Video Link (YouTube, HLS, RTMP, MP4)
              {currentSource.type === 'videolink' && (
                <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full flex items-center">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1 animate-pulse"></span>
                  Active
                </span>
              )}
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={videoLinkUrl}
                onChange={(e) => setVideoLinkUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or .m3u8/.mp4 URL"
                className={`flex-1 px-3 py-2 bg-gray-700 text-white text-xs rounded-lg border transition-colors focus:outline-none ${
                  currentSource.type === 'videolink'
                    ? 'border-blue-500 ring-1 ring-blue-400'
                    : 'border-gray-600 focus:border-blue-500'
                }`}
              />
              <button
                onClick={handleVideoLinkConnect}
                disabled={!videoLinkUrl.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Connect
              </button>
            </div>
          </div>

          {/* Advanced Settings */}
          {showAdvancedSettings && (
            <div className="space-y-3 border-t border-gray-700 pt-3">
              {/* File Upload */}
              <div>
                <label className="text-xs text-gray-300 mb-1 block">
                  <Upload className="w-3 h-3 inline mr-1" />
                  Local Video File
                </label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="w-full text-xs text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
                />
              </div>

              {/* IP Cameras */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-300">IP Cameras</label>
                  <button
                    onClick={() => setShowAddIPCamera(!showAddIPCamera)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Camera
                  </button>
                </div>

                {showAddIPCamera && (
                  <form onSubmit={handleAddIPCamera} className="bg-gray-700 rounded-lg p-3 mb-2 space-y-2">
                    <input
                      type="text"
                      placeholder="Camera name"
                      value={newIPCamera.name}
                      onChange={(e) => setNewIPCamera({ ...newIPCamera, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 text-white text-xs rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                      required
                    />
                    <input
                      type="text"
                      placeholder="rtsp://username:password@ip:port/stream"
                      value={newIPCamera.url}
                      onChange={(e) => setNewIPCamera({ ...newIPCamera, url: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 text-white text-xs rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                      required
                    />
                    <div className="flex space-x-2">
                      <select
                        value={newIPCamera.type}
                        onChange={(e) => setNewIPCamera({ ...newIPCamera, type: e.target.value as 'rtsp' | 'http' })}
                        className="flex-1 px-3 py-2 bg-gray-800 text-white text-xs rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="rtsp">RTSP</option>
                        <option value="http">HTTP</option>
                      </select>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddIPCamera(false)}
                        className="px-4 py-2 bg-gray-600 text-white text-xs rounded hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-1">
                  {ipCameras.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No IP cameras configured</p>
                  ) : (
                    ipCameras.map((camera) => (
                      <div
                        key={camera.id}
                        className="flex items-center justify-between bg-gray-700 rounded px-3 py-2"
                      >
                        <button
                          onClick={() => handleSelectIPCamera(camera.id)}
                          className="flex-1 text-left text-xs text-white hover:text-blue-400"
                        >
                          <span className="font-semibold">{camera.name}</span>
                          <span className="text-gray-400 ml-2">({camera.type.toUpperCase()})</span>
                        </button>
                        <button
                          onClick={() => handleDeleteIPCamera(camera.id)}
                          className="p-1 hover:bg-red-600 rounded transition-colors"
                        >
                          <X className="w-3 h-3 text-gray-400" />
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

      {/* Video Feed - Container maintains proper aspect ratio */}
      <div 
        className="relative bg-gray-900" 
        style={{ aspectRatio: (videoDimensions.width > 0 && videoDimensions.height > 0) ? `${videoDimensions.width}/${videoDimensions.height}` : '16/9' }}
      >
        <div className="absolute inset-0">
          {dataMode === 'demo' ? (
            // Demo mode - placeholder
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                  <CameraIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 font-medium">Demo Mode Active</p>
                  <p className="text-gray-500 text-sm mt-1">Switch to Live mode to see camera feed</p>
                  <p className="text-gray-600 text-xs mt-2">Charts below show demo data</p>
                </div>
              </div>
            </div>
          ) : error ? (
            // Error state
            <div className="w-full h-full flex items-center justify-center p-6">
              <div className="text-center max-w-md">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-red-400 font-medium mb-2">Camera Error</p>
                <pre className="text-gray-300 text-xs whitespace-pre-wrap text-left bg-gray-800 rounded p-3 mb-4">
                  {error}
                </pre>
                <button
                  onClick={initializeCamera}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : !isStreaming || isSwitchingSource ? (
            // Not streaming or switching - show state machine status
            <div className="w-full h-full flex items-center justify-center">
              {connectionState === 'FAILED' ? (
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <p className="text-red-400 font-medium mb-2">Bağlantı Kurulamadı</p>
                  <p className="text-gray-500 text-sm mt-1 mb-4">
                    Python backend çalışmıyor veya erişilemiyor ({MAX_RETRIES} deneme başarısız)
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
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Tekrar Dene
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-400 font-medium">
                    {isSwitchingSource ? 'Kaynak değiştiriliyor...' :
                     connectionState === 'CONNECTING' ? 'Backend\'e bağlanılıyor...' :
                     connectionState === 'WAITING_FOR_BACKEND' ? 'Backend hazırlanıyor, model yükleniyor...' :
                     connectionState === 'CONNECTED' ? 'Kamera akışı başlatılıyor...' :
                     'Kameraya bağlanılıyor...'}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    {connectionState === 'WAITING_FOR_BACKEND'
                      ? `Lütfen bekleyin — ${retryCountRef.current > 0 ? `Deneme ${retryCountRef.current}/${MAX_RETRIES}` : 'model yükleniyor'}`
                      : 'Lütfen kamera izinlerine onay verin'}
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
              className="w-full h-full object-contain bg-black"
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
                  setError(`MJPEG stream failed after ${MAX_MJPEG_RETRIES} attempts.\n\nCheck Python backend:\npython -m camera_analytics.run_with_websocket --source 0`);
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
            className={`w-full h-full object-contain bg-black ${dataMode === 'demo' || error ? 'hidden' : ''}`}
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

          {/* Canvas overlay for detections */}
          {dataMode === 'live' && isStreaming && !error && (
            <canvas
              ref={canvasRef}
              width={(videoDimensions.width > 64 ? videoDimensions.width : null) || containerRef.current?.clientWidth || 1280}
              height={(videoDimensions.height > 64 ? videoDimensions.height : null) || containerRef.current?.clientHeight || 720}
              className="absolute inset-0 w-full h-full pointer-events-none"
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
                  {detections.length} detected
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <div className="text-xs text-gray-600">
          <span className="font-semibold">Status:</span> {
            dataMode === 'demo' ? 'Demo mode' :
            isStreaming ? `Live from ${getSourceLabel()}` :
            connectionState === 'FAILED' ? 'Backend unreachable' :
            connectionState === 'WAITING_FOR_BACKEND' ? 'Loading model...' :
            connectionState === 'CONNECTING' ? 'Connecting...' :
            'Waiting for camera'
          }
        </div>
        {dataMode === 'live' && isStreaming && (
          <div className="flex items-center space-x-4 text-xs">
            <div>
              <span className="text-gray-500">Detected:</span>
              <span className="font-semibold text-gray-900 ml-1">{detections.length}</span>
            </div>
            <div className={`flex items-center ${backendConnected ? 'text-green-600' : 'text-yellow-600'}`}>
              <span className={`w-2 h-2 rounded-full mr-1 ${backendConnected ? 'bg-green-600' : 'bg-yellow-600'}`}></span>
              <span>{backendConnected ? 'Backend Active' : 'Backend Offline'}</span>
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
