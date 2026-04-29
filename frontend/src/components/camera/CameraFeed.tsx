import { Video, Maximize2, Minimize2, RotateCcw, AlertCircle, Settings, X, Upload, Link as LinkIcon, Plus } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDashboardFilter } from '../../contexts/DashboardFilterContext';
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

// Set after the user explicitly starts a source; consulted on remount to decide
// whether to auto-restore the stream subscription after navigation.
const STREAMING_ACTIVE_KEY = 'cameraStreamingActive';

export default function CameraFeed() {
  const { t } = useLanguage();
  const { selectedBranch } = useDashboardFilter();
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
  const [savedCamerasError, setSavedCamerasError] = useState<string>('');

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

  // MJPEG URL bust by sourceVersion so a source-change forces the browser to
  // open a fresh stream connection instead of reusing the previous source's
  // cached frame buffer. Without this, switching from MozartLow→MozartHigh
  // could leave the <img> stuck on the old source's last keepalive frame.
  const mjpegUrl = useMemo(
    () => `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'}/mjpeg?mode=smooth&v=${sourceVersion}`,
    [sourceVersion]
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

  // Fetch saved cameras from Camera Selection page, scoped to the active branch
  // when one is selected so the picker only shows cameras owned by that branch.
  // Has a 6s timeout + surfaces error so the panel never stays silently empty
  // when the Node backend is unreachable (was: stuck "loading..." with no
  // diagnostic, user thought their cameras were deleted).
  const fetchSavedCameras = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const url = selectedBranch
        ? `${apiUrl}/api/cameras?branchId=${encodeURIComponent(selectedBranch.id)}`
        : `${apiUrl}/api/cameras`;
      const res = await fetch(url, { credentials: 'include', signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        setSavedCameras(Array.isArray(data) ? data : []);
        setSavedCamerasError('');
      } else if (res.status === 401) {
        setSavedCameras([]);
        setSavedCamerasError('Oturum süresi doldu — yeniden giriş yapın.');
      } else {
        setSavedCameras([]);
        setSavedCamerasError(`Sunucu hatası (${res.status}).`);
      }
    } catch (err: any) {
      setSavedCameras([]);
      if (err?.name === 'AbortError') {
        setSavedCamerasError('Backend yanıt vermedi (6sn timeout).');
      } else {
        setSavedCamerasError('Backend bağlanılamadı.');
      }
    } finally {
      clearTimeout(timeout);
    }
  }, [selectedBranch?.id]);

  useEffect(() => {
    fetchSavedCameras();
  }, [fetchSavedCameras]);

  // Explicit-start policy: no auto-connect. The user must click a source to start
  // streaming. We still remember the last source in localStorage so the form inputs
  // Mirror `isStreaming` into a persistent flag whenever we reach an active
  // stream. Used by the remount-restore effect below to distinguish
  // "user already started a source" from a fresh explicit-start.
  useEffect(() => {
    if (isStreaming) {
      localStorage.setItem(STREAMING_ACTIVE_KEY, '1');
    }
  }, [isStreaming]);

  // Restore streaming state after route change / remount. The user already clicked
  // a source earlier (flag persisted in localStorage); Python runs as a separate
  // process so it's still alive. We just re-subscribe to its Socket.IO + MJPEG
  // streams by flipping `isStreaming` back to true. Guarded on a Python health
  // probe so stale flags (Python killed between sessions) don't trigger false
  // "connecting" states.
  useEffect(() => {
    if (isStreaming) return;

    let cancelled = false;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const hasStreamingFlag = localStorage.getItem(STREAMING_ACTIVE_KEY) === '1';

    (async () => {
      try {
        const res = await fetch(`${apiUrl}/api/python-backend/health`, { credentials: 'include' });
        const body = await res.json().catch(() => null);
        const alive = body?.status && body.status !== 'unreachable';
        // Yan #50: also auto-restore when the pipeline is actively streaming
        // (model_loaded + streaming=true) even if STREAMING_ACTIVE_KEY is
        // missing. Previously a fresh login on a tenant whose Python pipeline
        // was already live (e.g. deneme MozartHigh kept running across
        // sessions) never flipped isStreaming, so the MJPEG <img> never
        // mounted. Gate stays narrow — only flip when the backend reports
        // it's actually serving frames.
        const pipelineLive = !!(body?.streaming && body?.model_loaded);
        if (cancelled) return;
        if (hasStreamingFlag && alive) {
          console.log('[CameraFeed] Restoring stream after remount (flag)');
          setIsStreaming(true);
        } else if (!hasStreamingFlag && pipelineLive) {
          console.log('[CameraFeed] Pipeline already live, auto-attaching');
          setIsStreaming(true);
        } else if (hasStreamingFlag && !alive) {
          localStorage.removeItem(STREAMING_ACTIVE_KEY);
        }
      } catch {
        // API unreachable — leave flag alone so next mount can retry
      }
    })();

    return () => { cancelled = true; };
  }, [isStreaming]);

  // REMOVED: Initialize camera useEffect was causing race conditions
  // Camera initialization is now exclusively handled by handleSourceChange

  // Connect to backend Socket.IO for detections + health monitoring.
  // Gated behind `isStreaming` — we only open the socket and start polling after
  // the user has explicitly started a source. Keeps the idle state silent (no
  // 503 spam, no WebSocket retry loop, no wasted CPU).
  useEffect(() => {
    if (isStreaming) {
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
  }, [sourceVersion, isStreaming]);

  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Load zones from the Node DB for the caller's active camera (per branch).
  // The DB is the single source of truth — never read from the Python engine
  // or localStorage, both of which are device-global and leak ghost zones
  // across cameras / accounts. Re-fetches when the active camera or branch
  // selection changes so each saved source keeps its own zone set.
  const reloadZonesFromDb = useCallback(async (): Promise<string | null> => {
    try {
      const branchParam = selectedBranch?.id
        ? `?branchId=${encodeURIComponent(selectedBranch.id)}`
        : '';
      const activeRes = await fetch(`/api/cameras/active${branchParam}`, { credentials: 'include' });
      if (!activeRes.ok) {
        setZones([]);
        return null;
      }
      const active = await activeRes.json();
      if (!active?.id) {
        setZones([]);
        return null;
      }
      const zonesRes = await fetch(`/api/zones/${active.id}`, { credentials: 'include' });
      if (!zonesRes.ok) {
        setZones([]);
        return active.id;
      }
      const rows = await zonesRes.json() as Array<any>;
      const mapped: Zone[] = rows.map((r) => {
        const coords: Array<{ x: number; y: number }> =
          Array.isArray(r.coordinates) ? r.coordinates : [];
        const xs = coords.map((c) => c.x);
        const ys = coords.map((c) => c.y);
        const minX = xs.length ? Math.min(...xs) : 0;
        const minY = ys.length ? Math.min(...ys) : 0;
        const maxX = xs.length ? Math.max(...xs) : 0;
        const maxY = ys.length ? Math.max(...ys) : 0;
        return {
          id: r.id,
          name: r.name,
          x: minX,
          y: minY,
          width: Math.max(0, maxX - minX),
          height: Math.max(0, maxY - minY),
          type: String(r.type || 'CUSTOM').toLowerCase() as Zone['type'],
          color: r.color || '#3b82f6',
          shape: 'polygon',
          points: coords,
        };
      });
      setZones(mapped);
      return active.id;
    } catch {
      setZones([]);
      return null;
    }
  }, [selectedBranch?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await reloadZonesFromDb();
      if (cancelled) {
        // Component unmounted mid-fetch — drop the result so we don't paint
        // zones from a previous render's branch selection.
        if (id) setZones([]);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadZonesFromDb]);

  // Cross-component signal: when CameraSelectionPage activates a camera, or
  // any other view bumps the active camera in the DB, refetch zones here.
  useEffect(() => {
    const onActiveCameraChange = () => { void reloadZonesFromDb(); };
    window.addEventListener('observai:active-camera-changed', onActiveCameraChange);
    return () => window.removeEventListener('observai:active-camera-changed', onActiveCameraChange);
  }, [reloadZonesFromDb]);

  // Sync DB-issued zone UUIDs into the Python engine once the Socket.IO
  // connection is up. Without this, the engine emits `tables[].id` from a
  // stale zone push (or the local IDs ZoneCanvas had before saving) and the
  // floor plan can't match them against zones loaded from the DB —
  // occupied tables stay green.
  useEffect(() => {
    if (!backendConnected || zones.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        await cameraBackendService.saveZones(zones);
      } catch {
        if (!cancelled) {
          /* engine offline — DB is still source of truth */
        }
      }
    })();
    return () => { cancelled = true; };
  }, [backendConnected, zones]);

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

      // Responsive sizing — previous values were too small to read age/gender at
      // normal viewing distance on 1080p. Bumped ~75% and forced bold weight.
      const fontSize = Math.min(28, Math.max(14, canvas.height * 0.028));
      const lineWidth = Math.min(4, Math.max(2, canvas.width * 0.0025));
      const badgeFontSize = Math.floor(fontSize * 0.8);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw zones if enabled — supports both legacy rect (x/y/w/h) and polygon (points[]).
      if (showZones && zones.length > 0) {
        const zoneColor = (type: string) =>
          type === 'entrance' ? '#10b981'
          : type === 'exit' ? '#ef4444'
          : type === 'queue' ? '#f59e0b'
          : type === 'table' ? '#3b82f6'
          : '#a78bfa';

        zones.forEach((zone) => {
          const stroke = zoneColor(zone.type);
          ctx.strokeStyle = stroke;
          ctx.fillStyle = stroke;
          ctx.lineWidth = lineWidth;
          ctx.setLineDash([6, 6]);

          let labelX = 0;
          let labelY = 0;

          if (zone.shape === 'polygon' && Array.isArray(zone.points) && zone.points.length >= 3) {
            ctx.beginPath();
            zone.points.forEach((pt, i) => {
              const x = pt.x * canvas.width;
              const y = pt.y * canvas.height;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.stroke();
            // Translucent fill to make the zone region readable on busy frames.
            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.12;
            ctx.fill();
            ctx.globalAlpha = prevAlpha;
            // Label anchor: top-left of polygon bounding box.
            labelX = Math.min(...zone.points.map((p) => p.x)) * canvas.width;
            labelY = Math.min(...zone.points.map((p) => p.y)) * canvas.height;
          } else {
            const zoneX = zone.x * canvas.width;
            const zoneY = zone.y * canvas.height;
            const zoneWidth = zone.width * canvas.width;
            const zoneHeight = zone.height * canvas.height;
            ctx.strokeRect(zoneX, zoneY, zoneWidth, zoneHeight);
            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.12;
            ctx.fillRect(zoneX, zoneY, zoneWidth, zoneHeight);
            ctx.globalAlpha = prevAlpha;
            labelX = zoneX;
            labelY = zoneY;
          }

          ctx.setLineDash([]);

          ctx.font = `${fontSize}px sans-serif`;
          const textMetrics = ctx.measureText(zone.name);
          ctx.fillStyle = stroke;
          ctx.fillRect(labelX, labelY - fontSize - 4, textMetrics.width + 10, fontSize + 6);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(zone.name, labelX + 5, labelY - 5);
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

        ctx.font = `bold ${fontSize}px "Inter", "Space Grotesk", system-ui, sans-serif`;
        const textMetrics = ctx.measureText(labelText);
        const padX = 8;
        const padY = 4;
        const textHeight = Math.ceil(fontSize * 1.35);
        const boxWidth = textMetrics.width + padX * 2;

        // Smart Y positioning: if label doesn't fit above the bbox, draw it just
        // inside the top of the bbox instead so it never clips off-screen.
        const labelAbove = py >= textHeight + 2;
        const boxX = px;
        const boxY = labelAbove ? py - textHeight : py;
        const textY = boxY + textHeight - padY;

        // Dark semi-opaque background for contrast against any video content,
        // then a thin colored accent stripe on the left to preserve state color.
        const accent = detection.state === 'entering' ? '#10b981' :
          detection.state === 'exiting' ? '#ef4444' : '#3b82f6';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
        ctx.fillRect(boxX, boxY, boxWidth, textHeight);
        ctx.fillStyle = accent;
        ctx.fillRect(boxX, boxY, Math.max(3, lineWidth), textHeight);

        // Bright white text — no shadow needed thanks to the opaque background.
        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, boxX + padX, textY);

        // ID badge at bottom-left of the bbox
        ctx.font = `bold ${badgeFontSize}px "Inter", "Space Grotesk", system-ui, sans-serif`;
        const badgeText = `#${detection.id.slice(-4)}`;
        const badgeMetrics = ctx.measureText(badgeText);
        const badgeHeight = Math.ceil(badgeFontSize * 1.5);
        const badgeWidth = badgeMetrics.width + padX * 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
        ctx.fillRect(px, py + ph, badgeWidth, badgeHeight);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(badgeText, px + padX, py + ph + badgeHeight - padY);
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
          // Backend owns the camera exclusively and streams frames via MJPEG.
          setIsStreaming(true);
          return;

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
          if (!currentSource.url) {
            throw new Error('Please enter a video URL');
          }
          setIsStreaming(true);
          return;

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
    localStorage.removeItem(STREAMING_ACTIVE_KEY);
  }, [stream]);

  const handleSourceChange = useCallback(async (type: CameraSource, config?: Partial<CameraSourceConfig>) => {
    // Re-entrancy guard — set synchronously before any await so rapid clicks merge.
    if (isChangingSourceRef.current) return;
    isChangingSourceRef.current = true;
    setIsSwitchingSource(true);
    setShowSourceSelect(false);
    setShowAdvancedSettings(false);
    setError(null);
    canvasSizeInitialized.current = false;

    // Clear MJPEG <img> first so it stops retrying the previous stream URL
    // while we tear down and restart. Firefox otherwise keeps the old connection
    // alive and surfaces "interrupted" errors during the switch.
    if (mjpegImgRef.current) mjpegImgRef.current.src = '';

    try {
      // Frontend-side teardown (MediaStream tracks, video element, detections)
      stopCamera();

      // Resolve the backend source descriptor
      let backendSource: number | string = 0;
      switch (type) {
        case 'webcam':
          backendSource = 0;
          break;
        case 'iphone':
          backendSource = iphoneRemoteUrl.trim() || 1;
          break;
        case 'ip': {
          const camera = config?.ipCameraId
            ? ipCameras.find(cam => cam.id === config.ipCameraId)
            : null;
          if (!camera) throw new Error('Please select an IP camera from settings');
          backendSource = camera.url;
          break;
        }
        case 'videolink':
          if (!config?.url) throw new Error('Please enter a video URL');
          backendSource = config.url;
          break;
        default:
          throw new Error(`Unsupported backend source type: ${type}`);
      }

      // Fast path: if Python is already running, skip the kill+respawn cycle and
      // just emit `change_source` over the existing socket. Python's handler tears
      // down the current analytics loop and starts the new source internally. This
      // cuts a YouTube→file switch from ~10s to ~2-3s and preserves the loaded
      // YOLO engine + InsightFace session.
      //
      // Readiness semantics: Python's /health returns HTTP 503 until `streaming`
      // flips true, but we want to know "can I emit change_source yet?" — that's
      // true as soon as the WS+HTTP server is bound. The Node proxy returns a
      // body with status 'unreachable' when Python isn't running at all vs
      // 'loading'/'ready' when it's up; use that to distinguish.
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const probePython = async (): Promise<boolean> => {
        try {
          const res = await fetch(`${apiUrl}/api/python-backend/health`, { credentials: 'include' });
          const body = await res.json().catch(() => null);
          return body?.status && body.status !== 'unreachable';
        } catch {
          return false;
        }
      };

      let pythonAlive = await probePython();

      if (!pythonAlive) {
        console.log(`[CameraFeed] Spawning Python backend for source: ${backendSource}`);
        await startPythonBackend(backendSource);
        const deadline = Date.now() + 60000; // models + InsightFace fallback can take ~20-40s
        while (Date.now() < deadline) {
          if (await probePython()) { pythonAlive = true; break; }
          await new Promise(r => setTimeout(r, 500));
        }
        if (!pythonAlive) throw new Error('Python backend failed to come online within 60s');
      }

      // Open (or reuse) the Socket.IO connection and emit change_source
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
      cameraBackendService.connect(backendUrl);
      console.log(`[CameraFeed] Emitting change_source → ${backendSource}`);
      await cameraBackendService.changeSource(backendSource);

      // Flip streaming state — this gates the Socket.IO/health-polling useEffect
      // so it only subscribes now that we know Python is up and the source is set.
      const newSource = { type, ...config };
      setCurrentSource(newSource);
      localStorage.setItem('lastCameraSource', JSON.stringify(newSource));
      setIsStreaming(true);
      setSourceVersion(v => v + 1);
      console.log(`[CameraFeed] ✅ Source switched → ${type}`);
    } catch (err) {
      console.error('[CameraFeed] Source change failed:', err);
      setError(`Failed to switch to ${type}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsStreaming(false);
    } finally {
      isChangingSourceRef.current = false;
      setIsSwitchingSource(false);
    }
  }, [ipCameras, iphoneRemoteUrl, stopCamera]);

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

  // Map saved camera sourceType to CameraFeed source change. Always activates
  // the picked camera in the Node DB FIRST so `/api/cameras/active` and the
  // per-camera zone fetch line up with the source the user is now viewing.
  // Without this, ZoneCanvas + CameraFeed kept loading the previously-active
  // camera's zones — drawn zones appeared to "vanish" on every source switch.
  const handleSavedCameraSelect = useCallback(async (camera: SavedCamera) => {
    // Optimistic UI: flip the active marker locally before the round-trip so
    // the user gets immediate feedback when they click. Reverts implicitly
    // when fetchSavedCameras() lands with the server's truth.
    setSavedCameras((prev) =>
      prev.map((c) => ({ ...c, isActive: c.id === camera.id }))
    );

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    try {
      await fetch(`${apiUrl}/api/cameras/activate/${camera.id}`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('[CameraFeed] Failed to activate camera in DB:', err);
    }
    // Refresh saved-cameras pane so the LIVE badge tracks the new active row,
    // and refetch this camera's zones immediately.
    fetchSavedCameras();
    void reloadZonesFromDb();
    // Notify other mounted views (e.g. ZoneCanvas on /zones) so they refetch.
    window.dispatchEvent(new CustomEvent('observai:active-camera-changed', {
      detail: { cameraId: camera.id },
    }));

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
      default:
        handleSourceChange('videolink', { url: value });
    }
  }, [handleSourceChange, fetchSavedCameras, reloadZonesFromDb]);

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
                {isStreaming ? t('cameraFeed.live') : t('cameraFeed.offline')}
              </span>
              {isStreaming && !backendConnected && (
                <>
                  <span className="text-xs text-ink-3">•</span>
                  <span className="text-xs text-warning font-mono">{t('cameraFeed.waitingForBackend')}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              const opening = !showSourceSelect;
              setShowSourceSelect(opening);
              // Refetch on open so the saved-sources list reflects any
              // additions/deletions made elsewhere (Camera Selection page,
              // another tab) without forcing a page reload.
              if (opening) void fetchSavedCameras();
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title={t('cameraFeed.changeSource')}
          >
            <Settings className="w-4 h-4 text-ink-1" />
          </button>
          <button
            onClick={() => {
              // Restart the actual pipeline with the current source so the
              // Python engine releases stale state (frozen MJPEG cache after
              // EOF, stuck capture). initializeCamera alone only flips the
              // streaming flag — Python still sees the old source.
              if (currentSource.type === 'webcam') {
                handleSourceChange('webcam');
              } else if (currentSource.type === 'iphone') {
                handleSourceChange('iphone');
              } else if (currentSource.type === 'videolink' && currentSource.url) {
                handleSourceChange('videolink', { url: currentSource.url });
              } else if (currentSource.type === 'ip' && currentSource.ipCameraId) {
                handleSourceChange('ip', { ipCameraId: currentSource.ipCameraId });
              } else {
                stopCamera();
                initializeCamera();
              }
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
      {showSourceSelect && (
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
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-ink-4">{t('cameraFeed.savedSources')}</p>
              <button
                onClick={() => void fetchSavedCameras()}
                className="text-[10px] text-brand-300 hover:text-brand-200 font-mono uppercase"
                title="Yenile"
              >
                ↻
              </button>
            </div>
            {savedCamerasError ? (
              <div className="px-3 py-2 text-xs rounded-lg bg-danger-500/10 border border-danger-500/30 text-danger-300">
                {savedCamerasError}
                <button
                  onClick={() => void fetchSavedCameras()}
                  className="ml-2 underline hover:text-danger-200"
                >
                  Tekrar dene
                </button>
              </div>
            ) : savedCameras.length === 0 ? (
              <p className="px-3 py-2 text-xs italic text-ink-4 bg-surface-2/40 rounded-lg">
                Bu sube icin kayitli kaynak yok. Camera Selection sayfasindan ekleyin.
              </p>
            ) : (
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
            )}
          </div>

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
          {error ? (
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

          {/* MJPEG stream from backend (30 FPS, low latency) */}
          {isStreaming && !error && !stream && !isSwitchingSource && (
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

          {/* Video element (browser camera fallback) */}
          <video
            ref={videoRef}
            className={`w-full h-full object-fill ${error ? 'hidden' : ''}`}
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
          {isStreaming && !error && (
            <canvas
              ref={canvasRef}
              width={videoDimensions.width > 64 ? videoDimensions.width : 1920}
              height={videoDimensions.height > 64 ? videoDimensions.height : 1080}
              className="absolute inset-0 pointer-events-none"
              style={{ width: '100%', height: '100%' }}
            />
          )}

        </div>
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
