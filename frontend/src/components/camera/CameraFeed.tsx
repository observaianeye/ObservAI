import { Video, Maximize2, Minimize2, RotateCcw, AlertCircle, Camera as CameraIcon, Settings, X, Upload, Link as LinkIcon, Plus, Eye, Activity } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useDataMode } from '../../contexts/DataModeContext';
import { cameraBackendService, Detection } from '../../services/cameraBackendService';
import { GlassCard } from '../ui/GlassCard';

export type CameraSource = 'webcam' | 'iphone' | 'ip' | 'videolink' | 'file';

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
  const [currentSource, setCurrentSource] = useState<CameraSourceConfig>({ type: 'webcam' });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [showZones] = useState(true); // Can be made toggleable in future
  const [zones, setZones] = useState<any[]>([]);

  // Advanced settings
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [videoLinkUrl, setVideoLinkUrl] = useState('');
  const [ipCameras, setIPCameras] = useState<IPCamera[]>(() => {
    const saved = localStorage.getItem('ipCameras');
    return saved ? JSON.parse(saved) : [];
  });
  const [showAddIPCamera, setShowAddIPCamera] = useState(false);
  const [newIPCamera, setNewIPCamera] = useState({ name: '', url: '', type: 'rtsp' as 'rtsp' | 'http' });

  // AI Insights visibility toggle (controls backend overlay)
  const [showInsights, setShowInsights] = useState(true);

  // Heatmap visibility toggle (separate control from AI Insights)
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Source switching loading state
  const [isSwitchingSource, setIsSwitchingSource] = useState(false);

  // Dynamic video dimensions for proper aspect ratio
  const [videoDimensions, setVideoDimensions] = useState({ width: 16, height: 9 });

  // Refs for cleanup tracking
  const cleanupRef = useRef<(() => void) | null>(null);
  const isChangingSourceRef = useRef(false);
  const mjpegImgRef = useRef<HTMLImageElement>(null);

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

  // Auto-start MacBook camera when entering Live mode
  const hasAutoStartedRef = useRef(false);
  useEffect(() => {
    if (dataMode === 'live' && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      // Automatically start with MacBook camera (source 0)
      handleSourceChange('webcam');
    } else if (dataMode === 'demo') {
      hasAutoStartedRef.current = false;
      stopCamera();
    }
  }, [dataMode]);

  // Initialize camera stream when source changes
  useEffect(() => {
    if (dataMode === 'live' && currentSource.type) {
      initializeCamera();
    }

    return () => {
      stopCamera();
    };
  }, [currentSource]);

  // Connect to backend Socket.IO for detections
  useEffect(() => {
    if (dataMode === 'live' && isStreaming) {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

      cameraBackendService.connect(backendUrl);
      setBackendConnected(cameraBackendService.getConnectionStatus());

      // Start the analytics stream on the backend
      cameraBackendService.startStream().catch(() => {
        // Silently handle - stream might already be running
      });

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

      // Store cleanup function
      cleanupRef.current = () => {
        unsubscribeDetections();
      };

      return () => {
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
        // Only stop stream if not changing sources
        if (!isChangingSourceRef.current) {
          cameraBackendService.stopStream().catch(() => {});
        }
      };
    } else {
      setBackendConnected(false);
      setDetections([]);
    }
  }, [dataMode, isStreaming]);

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

  // Render detection overlays
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !isStreaming) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    const drawFrame = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Match canvas size to video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
      }

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
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(zoneX, zoneY, zoneWidth, zoneHeight);
          ctx.setLineDash([]);

          // Draw zone label
          ctx.fillStyle = zone.type === 'entrance' ? '#10b981' : '#ef4444';
          ctx.font = '14px sans-serif';
          const textMetrics = ctx.measureText(zone.name);
          ctx.fillRect(zoneX, zoneY - 20, textMetrics.width + 10, 20);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(zone.name, zoneX + 5, zoneY - 5);
        });
      }

      // Draw detections
      detections.forEach((detection) => {
        const [x, y, w, h] = detection.bbox; // Normalized coordinates [0-1]

        // Convert to pixel coordinates
        const px = x * canvas.width;
        const py = y * canvas.height;
        const pw = w * canvas.width;
        const ph = h * canvas.height;

        // Draw bounding box
        ctx.strokeStyle = detection.state === 'entering' ? '#10b981' :
          detection.state === 'exiting' ? '#ef4444' : '#3b82f6';
        ctx.lineWidth = 3;
        ctx.strokeRect(px, py, pw, ph);

        // Draw label background
        const gender = detection.gender === 'male' ? 'M' :
          detection.gender === 'female' ? 'F' : '?';

        // Map backend age buckets to readable labels
        const ageBucketMap: { [key: string]: string } = {
          'child': '0-17',
          'young': '18-35',
          'adult': '36-50',
          'mature': '51-70',
          'senior': '70+'
        };
        const ageBucket = ageBucketMap[detection.ageBucket || ''] || 'Unknown';
        const dwellTime = Math.floor(detection.dwellSec);
        const labelText = `${gender} | ${ageBucket} | ${dwellTime}s`;

        ctx.font = '14px sans-serif';
        const textMetrics = ctx.measureText(labelText);
        const textHeight = 20;

        ctx.fillStyle = detection.state === 'entering' ? '#10b981' :
          detection.state === 'exiting' ? '#ef4444' : '#3b82f6';
        ctx.fillRect(px, py - textHeight, textMetrics.width + 10, textHeight);

        // Draw label text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, px + 5, py - 5);

        // Draw ID badge
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(px, py + ph, 40, 18);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`#${detection.id.slice(-4)}`, px + 5, py + ph + 13);
      });

      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [detections, isStreaming, showZones, zones]);


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
                'No iPhone or secondary camera found.\n\n' +
                'For iPhone:\n' +
                '1. Connect iPhone via USB or Wi-Fi\n' +
                '2. Enable Continuity Camera on macOS\n' +
                '3. Or: Open this page in iPhone Safari for native camera'
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

    try {
      // ... same content ...
    } catch (err) {
      console.error('[CameraFeed] Source change failed:', err);
      setError(`${err instanceof Error ? err.message : 'Unknown error'}`);
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
      case 'webcam': return 'MacBook Camera';
      case 'iphone': return 'iPhone Camera';
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
          {/* AI Insights Toggle - Controls backend overlay visibility */}
          {dataMode === 'live' && (
            <>
              <button
                onClick={() => {
                  const newState = !showInsights;
                  setShowInsights(newState);
                  // Send toggle to backend to show/hide overlay on video stream
                  cameraBackendService.toggleOverlay(newState).catch(() => {
                    // Silently handle - backend might not support this yet
                  });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 ${
                  showInsights
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                }`}
                title={showInsights ? 'AI Insights: ON (click to hide)' : 'AI Insights: OFF (click to show)'}
              >
                <Eye className={`w-3.5 h-3.5 ${showInsights ? '' : 'opacity-50'}`} />
                <span>{showInsights ? 'AI Insights' : 'AI Insights'}</span>
                {showInsights && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">ON</span>}
              </button>

              {/* Heatmap Toggle - Separate control from AI Insights */}
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
            </>
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
              className={`px-3 py-2 text-xs rounded-lg transition-colors ${currentSource.type === 'webcam'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
            >
              MacBook Cam
            </button>
            <button
              onClick={() => handleSourceChange('iphone')}
              className={`px-3 py-2 text-xs rounded-lg transition-colors ${currentSource.type === 'iphone'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
            >
              iPhone
            </button>
          </div>

          {/* Video Link Input (YouTube, HLS, RTMP, MP4) */}
          <div className="mt-3">
            <label className="text-xs text-gray-300 mb-1 block">
              <LinkIcon className="w-3 h-3 inline mr-1" />
              Video Link (YouTube, HLS, RTMP, MP4)
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={videoLinkUrl}
                onChange={(e) => setVideoLinkUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or .m3u8/.mp4 URL"
                className="flex-1 px-3 py-2 bg-gray-700 text-white text-xs rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
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
        style={{ aspectRatio: `${videoDimensions.width}/${videoDimensions.height}` }}
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
            // Not streaming or switching - show loading
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400 font-medium">
                  {isSwitchingSource ? 'Switching camera source...' : 'Connecting to camera...'}
                </p>
                <p className="text-gray-500 text-sm mt-1">Please allow camera permissions</p>
              </div>
            </div>
          ) : null}

          {/* MJPEG stream from backend (Live mode - 30 FPS, low latency) */}
          {dataMode === 'live' && isStreaming && !error && !stream && (
            <img
              ref={mjpegImgRef}
              src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'}/mjpeg`}
              alt="Camera stream"
              className="w-full h-full object-contain bg-black"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setVideoDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                }
              }}
              onError={() => {
                setError('MJPEG stream connection failed.\n\nMake sure Python backend is running:\npython -m camera_analytics.run_with_websocket --source 0');
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
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          )}

          {/* Heatmap overlay */}
          {showHeatmap && dataMode === 'live' && isStreaming && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="w-full h-full" style={{
                background: `radial-gradient(circle at 30% 40%, rgba(239, 68, 68, 0.4) 0%, transparent 30%),
                            radial-gradient(circle at 70% 50%, rgba(249, 115, 22, 0.3) 0%, transparent 25%),
                            radial-gradient(circle at 50% 70%, rgba(234, 179, 8, 0.25) 0%, transparent 20%)`
              }}></div>
            </div>
          )}

          {/* Timestamp & Stats Overlay */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs font-mono">
              {new Date().toLocaleTimeString()}
            </div>
            {showHeatmap && dataMode === 'live' && (
              <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
                <p className="text-xs text-white font-semibold">Heatmap Overlay Active</p>
              </div>
            )}
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
            dataMode === 'demo' ? 'Demo mode' : (isStreaming ? `Live from ${getSourceLabel()}` : 'Waiting for camera')
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
