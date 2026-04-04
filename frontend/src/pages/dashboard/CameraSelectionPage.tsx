import { Camera, Circle, Monitor, Wifi, Upload, Trash2, Loader2, Smartphone, Play } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

type SourceType = 'webcam' | 'file' | 'rtsp' | 'screen' | 'youtube' | 'phone';

interface SavedCamera {
  id: string;
  name: string;
  sourceType: string;
  sourceValue: string;
  isActive: boolean;
  createdAt: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function CameraSelectionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sourceType, setSourceType] = useState<SourceType>('webcam');
  const [sourceValue, setSourceValue] = useState<string>('0');
  const [sourceName, setSourceName] = useState<string>('');
  const [cameras, setCameras] = useState<SavedCamera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCameras = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/cameras`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCameras(data);
      }
    } catch (err) {
      console.error('Failed to fetch cameras:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  const sourceTypes = [
    { value: 'webcam', label: 'Webcam', icon: Camera, description: 'Built-in or USB camera' },
    { value: 'phone', label: 'Phone Cam', icon: Smartphone, description: 'iVCam / DroidCam HTTP stream' },
    { value: 'file', label: 'Video File', icon: Upload, description: 'MP4, AVI, or other video file' },
    { value: 'rtsp', label: 'RTSP/RTMP Stream', icon: Wifi, description: 'Network camera or stream' },
    { value: 'screen', label: 'Screen Capture', icon: Monitor, description: 'Capture your screen' },
    { value: 'youtube', label: 'YouTube Live', icon: Camera, description: 'YouTube live stream URL' }
  ];

  const handleAddSource = async () => {
    if (!sourceValue || !sourceName) {
      setError('Please provide both a source name and value');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/cameras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: sourceName,
          sourceType: sourceType.toUpperCase(),
          sourceValue: sourceValue,
          createdBy: user?.id
        })
      });

      if (res.ok) {
        setSourceName('');
        setSourceValue(sourceType === 'webcam' ? '0' : '');
        await fetchCameras();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add camera');
      }
    } catch (err) {
      setError('Failed to save camera. Check backend connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/cameras/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok || res.status === 204) {
        setCameras(prev => prev.filter(c => c.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete camera:', err);
    }
  };

  const handleActivate = async (cameraId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/cameras/activate/${cameraId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        await fetchCameras();
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Failed to activate camera:', err);
    }
  };

  const getSourceIcon = (type: string) => {
    const st = sourceTypes.find(s => s.value === type.toLowerCase());
    return st ? st.icon : Camera;
  };

  const getSourcePlaceholder = () => {
    switch (sourceType) {
      case 'webcam': return '0';
      case 'phone': return 'http://192.168.1.100:4747/video';
      case 'file': return '/path/to/video.mp4';
      case 'rtsp': return 'rtsp://username:password@192.168.1.100:554/stream';
      case 'screen': return 'screen';
      case 'youtube': return 'https://www.youtube.com/watch?v=...';
      default: return '';
    }
  };

  const getSourceDescription = () => {
    switch (sourceType) {
      case 'webcam': return 'Enter camera index (0 for built-in, 1 for first USB camera, etc.)';
      case 'phone': return 'iVCam veya DroidCam HTTP stream URL girin (orn: http://IP:4747/video)';
      case 'file': return 'Enter the full path to your video file';
      case 'rtsp': return 'Enter RTSP or RTMP stream URL';
      case 'screen': return 'Type "screen" to capture your screen display';
      case 'youtube': return 'Enter YouTube Live stream URL (requires yt-dlp)';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Camera & Video Sources</h1>
        <p className="text-sm text-gray-400 mt-1">Configure video input sources for analytics</p>
      </div>

      {/* Add New Source */}
      <div className="rounded-xl border border-white/10 p-6 bg-[#0f1117]/80">
        <h2 className="text-lg font-semibold text-white mb-4">Add New Source</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">Source Type</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {sourceTypes.map((st) => {
              const Icon = st.icon;
              return (
                <button
                  key={st.value}
                  onClick={() => {
                    setSourceType(st.value as SourceType);
                    setSourceValue(st.value === 'webcam' ? '0' : st.value === 'screen' ? 'screen' : st.value === 'phone' ? 'http://' : '');
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    sourceType === st.value
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-white/10 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <Icon className={`w-6 h-6 mx-auto mb-2 ${
                    sourceType === st.value ? 'text-blue-400' : 'text-gray-400'
                  }`} />
                  <p className={`text-sm font-medium ${
                    sourceType === st.value ? 'text-blue-300' : 'text-gray-300'
                  }`}>{st.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{st.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Source Name</label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g., Front Door Camera"
              className="w-full px-4 py-2 border border-white/10 bg-white/5 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Source Value</label>
            <input
              type="text"
              value={sourceValue}
              onChange={(e) => setSourceValue(e.target.value)}
              placeholder={getSourcePlaceholder()}
              className="w-full px-4 py-2 border border-white/10 bg-white/5 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm placeholder:text-gray-500"
            />
            <p className="mt-2 text-xs text-gray-500">{getSourceDescription()}</p>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            onClick={handleAddSource}
            disabled={isSaving}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isSaving ? 'Saving...' : 'Add Source'}
          </button>
        </div>
      </div>

      {/* Saved Cameras */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Configured Sources {cameras.length > 0 && `(${cameras.length})`}
        </h2>

        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto" />
            <p className="text-sm text-gray-400 mt-2">Loading cameras...</p>
          </div>
        ) : cameras.length === 0 ? (
          <div className="rounded-xl border border-white/10 p-8 text-center bg-[#0f1117]/80">
            <Camera className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No cameras configured yet</p>
            <p className="text-sm text-gray-500 mt-1">Add a source above to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cameras.map((camera) => {
              const Icon = getSourceIcon(camera.sourceType);
              return (
                <div key={camera.id} className="rounded-xl border border-white/10 p-6 bg-[#0f1117]/80 hover:border-white/20 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <Icon className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Circle className={`w-3 h-3 ${camera.isActive ? 'text-green-500 fill-green-500' : 'text-gray-500 fill-gray-500'}`} />
                      <span className="text-xs text-gray-400 capitalize">{camera.sourceType.toLowerCase()}</span>
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1">{camera.name}</h3>
                  <p className="text-xs text-gray-500 mb-4 font-mono break-all">{camera.sourceValue}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleActivate(camera.id)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Aktif Et
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `python -m camera_analytics.run_with_websocket --source "${camera.sourceValue}"`
                        );
                      }}
                      className="px-3 py-2 bg-white/5 text-gray-300 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors border border-white/10"
                      title="Komutu kopyala"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => handleDelete(camera.id)}
                      className="px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-white/10"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
