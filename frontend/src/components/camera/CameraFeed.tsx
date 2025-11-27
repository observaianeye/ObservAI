import { Video, Maximize2, Minimize2, RotateCcw, AlertCircle, Camera as CameraIcon, Settings, X, Upload, Link as LinkIcon, Plus } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useDataMode } from '../../contexts/DataModeContext';
import { cameraBackendService, Detection } from '../../services/cameraBackendService';

interface CameraFeedProps {
  showHeatmap?: boolean;
}

export type CameraSource = 'webcam' | 'iphone' | 'ip' | 'youtube' | 'file' | 'zoom';

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

export default function CameraFeed({ showHeatmap = false }: CameraFeedProps) {
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
  const [streamUrl, setStreamUrl] = useState('');
  const [ipCameras, setIPCameras] = useState<IPCamera[]>(() => {
    const saved = localStorage.getItem('ipCameras');
    return saved ? JSON.parse(saved) : [];
  });
  const [showAddIPCamera, setShowAddIPCamera] = useState(false);
  const [newIPCamera, setNewIPCamera] = useState({ name: '', url: '', type: 'rtsp' as 'rtsp' | 'http' });

  // Load IP cameras from localStorage
  useEffect(() => {
    localStorage.setItem('ipCameras', JSON.stringify(ipCameras));
  }, [ipCameras]);

  // Initialize camera stream
  useEffect(() => {
    if (dataMode === 'live') {
      initializeCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [dataMode, currentSource]);

  // Connect to backend Socket.IO for detections
  useEffect(() => {
    if (dataMode === 'live' && isStreaming) {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
      console.log('[CameraFeed] Connecting to backend:', backendUrl);

      cameraBackendService.connect(backendUrl);
      setBackendConnected(cameraBackendService.getConnectionStatus());

      // Start the analytics stream on the backend
      cameraBackendService.startStream()
        .then(() => console.log('[CameraFeed] Backend stream started'))
        .catch(err => console.error('[CameraFeed] Failed to start backend stream:', err));

      const unsubscribeDetections = cameraBackendService.onDetections((tracks) => {
        console.log('[CameraFeed] Received detections:', tracks.length);
        setDetections(tracks);
        setBackendConnected(true);
      });

      return () => {
        unsubscribeDetections();
        cameraBackendService.stopStream().catch(console.error);
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
          // MacBook built-in camera (default device)
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              facingMode: 'user'
            },
            audio: false
          });
          break;

        case 'iphone':
          // iPhone camera - enumerate devices and select secondary camera
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(d => d.kind === 'videoinput');
          console.log('[CameraFeed] Available video devices:', videoDevices);

          if (videoDevices.length > 1) {
            // Use second camera (iPhone via Continuity Camera)
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
              'For iPhone:\n' +
              '1. Connect iPhone via USB or Wi-Fi\n' +
              '2. Enable Continuity Camera on macOS\n' +
              '3. Or: Open this page in iPhone Safari for native camera'
            );
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

        case 'youtube':
          // YouTube/Stream URL - backend processes with yt-dlp
          if (currentSource.url) {
            setError(
              `Stream URL requires backend processing.\n\n` +
              `Run in terminal:\n` +
              `./scripts/start-camera-backend.sh "${currentSource.url}"\n\n` +
              `Requirements: brew install yt-dlp`
            );
            setIsStreaming(true);
            return;
          }
          throw new Error('Please enter a stream URL');

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

        case 'zoom':
          // Screen capture for Zoom meetings
          try {
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
              },
              audio: false
            });

            // Add track end listener
            mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
              console.log('[CameraFeed] Screen sharing stopped by user');
              stopCamera();
            });

            setError(
              'Screen capture: Local preview only.\n\n' +
              'Browser security prevents sending screen content to backend.\n' +
              'Detections will only work with webcam/iPhone sources.'
            );
          } catch (err: any) {
            if (err.name === 'NotAllowedError') {
              throw new Error(
                'Screen recording permission denied.\n\n' +
                'Grant permission:\n' +
                'System Settings → Privacy & Security → Screen Recording\n' +
                'Enable your browser (Chrome/Safari)\n\n' +
                'Then reload this page and try again.'
              );
            } else if (err.name === 'NotFoundError') {
              throw new Error('No screen/window selected. Please try again.');
            } else {
              throw err;
            }
          }
          break;
      }

      if (mediaStream && videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setStream(mediaStream);
        setIsStreaming(true);
      }
    } catch (err: any) {
      console.error('[CameraFeed] Initialization error:', err);
      setError(err.message || 'Failed to access camera');
      setIsStreaming(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = '';
    }
    setIsStreaming(false);
    setDetections([]);
  };

  const handleSourceChange = async (type: CameraSource, config?: Partial<CameraSourceConfig>) => {
    // Stop current camera first
    stopCamera();

    setShowSourceSelect(false);
    setShowAdvancedSettings(false);

    // Notify backend about source change FIRST if in live mode
    if (dataMode === 'live' && backendConnected) {
      try {
        let backendSource: number | string = 0;

        // Map frontend source type to backend source
        switch (type) {
          case 'webcam':
            backendSource = 0; // MacBook camera
            break;
          case 'iphone':
            backendSource = 1; // iPhone camera (Continuity Camera)
            break;
          case 'ip':
            if (config?.ipCameraId) {
              const camera = ipCameras.find(cam => cam.id === config.ipCameraId);
              if (camera) {
                backendSource = camera.url;
              }
            }
            break;
          case 'youtube':
            if (config?.url) {
              backendSource = config.url;
            }
            break;
          // For 'file' and 'zoom', backend doesn't process them
        }

        console.log('[CameraFeed] Changing backend source to:', backendSource);

        // Wait for backend to switch source before updating frontend
        await cameraBackendService.changeSource(backendSource);
        console.log('[CameraFeed] Backend source changed successfully');

        // Small delay to ensure backend has fully switched
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error('[CameraFeed] Failed to change backend source:', err);
        setError(`Failed to switch backend to ${type} camera: ${err}`);
        return;
      }
    }

    // Update frontend source AFTER backend has switched
    setCurrentSource({ type, ...config });
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleStreamUrlConnect = () => {
    if (streamUrl.trim()) {
      handleSourceChange('youtube', { url: streamUrl });
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
      case 'youtube': return 'Stream URL';
      case 'file': return currentSource.file ? currentSource.file.name : 'Video File';
      case 'zoom': return 'Screen Capture';
      default: return 'Camera';
    }
  };

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
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
              <span className="text-xs text-gray-300">
                {dataMode === 'demo' ? 'DEMO MODE' : (isStreaming ? 'LIVE' : 'OFFLINE')}
              </span>
              {isStreaming && backendConnected && (
                <>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-green-400">Backend Connected</span>
                </>
              )}
              {isStreaming && !backendConnected && dataMode === 'live' && (
                <>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-yellow-400">Waiting for backend...</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {dataMode === 'live' && (
            <button
              onClick={() => setShowSourceSelect(!showSourceSelect)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Change camera source"
            >
              <Settings className="w-4 h-4 text-gray-300" />
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
            <RotateCcw className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={handleFullscreen}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-gray-300" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-300" />
            )}
          </button>
        </div>
      </div>

      {/* Source Selector */}
      {showSourceSelect && dataMode === 'live' && (
        <div className="bg-gray-800 px-4 py-3 border-t border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400">Select camera source:</p>
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {showAdvancedSettings ? 'Basic' : 'Advanced'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
            <button
              onClick={() => handleSourceChange('webcam')}
              className={`px-3 py-2 text-xs rounded-lg transition-colors ${currentSource.type === 'webcam'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
              MacBook Cam
            </button>
            <button
              onClick={() => handleSourceChange('iphone')}
              className={`px-3 py-2 text-xs rounded-lg transition-colors ${currentSource.type === 'iphone'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
              iPhone
            </button>
            <button
              onClick={() => handleSourceChange('zoom')}
              className={`px-3 py-2 text-xs rounded-lg transition-colors ${currentSource.type === 'zoom'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
              Screen Capture
            </button>
          </div>

          {/* Advanced Settings */}
          {showAdvancedSettings && (
            <div className="space-y-3 border-t border-gray-700 pt-3">
              {/* Stream URL Input */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  <LinkIcon className="w-3 h-3 inline mr-1" />
                  Stream URL (YouTube, RTSP, HLS)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="https://youtube.com/... or rtsp://..."
                    className="flex-1 px-3 py-2 bg-gray-700 text-white text-xs rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={handleStreamUrlConnect}
                    disabled={!streamUrl.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Connect
                  </button>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
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
                  <label className="text-xs text-gray-400">IP Cameras</label>
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

      {/* Video Feed */}
      <div className="relative bg-gray-900 aspect-video">
        {dataMode === 'demo' ? (
          // Demo mode - placeholder
          <div className="absolute inset-0 flex items-center justify-center">
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
          <div className="absolute inset-0 flex items-center justify-center p-6">
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
        ) : !isStreaming ? (
          // Not streaming - waiting
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400 font-medium">Connecting to camera...</p>
              <p className="text-gray-500 text-sm mt-1">Please allow camera permissions</p>
            </div>
          </div>
        ) : null}

        {/* Video element */}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${dataMode === 'demo' || error ? 'hidden' : ''}`}
          autoPlay
          playsInline
          muted
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
    </div>
  );
}
