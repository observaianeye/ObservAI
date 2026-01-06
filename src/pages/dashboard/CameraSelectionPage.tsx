import { Camera, Circle, Settings, Monitor, Wifi, Upload } from 'lucide-react';
import { useState } from 'react';

type SourceType = 'webcam' | 'file' | 'rtsp' | 'screen' | 'youtube';

interface SourceConfig {
  type: SourceType;
  value: string;
  name: string;
}

export default function CameraSelectionPage() {
  const [sourceType, setSourceType] = useState<SourceType>('webcam');
  const [sourceValue, setSourceValue] = useState<string>('0');
  const [sourceName, setSourceName] = useState<string>('');
  const [savedSources, setSavedSources] = useState<SourceConfig[]>([
    { type: 'webcam', value: '0', name: 'Built-in Webcam' }
  ]);

  const cameras = [
    { id: 1, name: 'Main Entrance', status: 'online', location: 'Front Door' },
    { id: 2, name: 'Checkout Area', status: 'online', location: 'Zone B' },
    { id: 3, name: 'Back Exit', status: 'offline', location: 'Rear Door' },
    { id: 4, name: 'Side Entrance', status: 'online', location: 'Side Door' }
  ];

  const sourceTypes = [
    { value: 'webcam', label: 'Webcam', icon: Camera, description: 'Built-in or USB camera' },
    { value: 'file', label: 'Video File', icon: Upload, description: 'MP4, AVI, or other video file' },
    { value: 'rtsp', label: 'RTSP/RTMP Stream', icon: Wifi, description: 'Network camera or stream' },
    { value: 'screen', label: 'Screen Capture', icon: Monitor, description: 'Capture your screen' },
    { value: 'youtube', label: 'YouTube Live', icon: Camera, description: 'YouTube live stream URL' }
  ];

  const handleAddSource = () => {
    if (!sourceValue || !sourceName) {
      alert('Please provide both a source name and value');
      return;
    }

    const newSource: SourceConfig = {
      type: sourceType,
      value: sourceValue,
      name: sourceName
    };

    setSavedSources([...savedSources, newSource]);
    setSourceName('');
    setSourceValue(sourceType === 'webcam' ? '0' : '');
  };

  const getSourceIcon = (type: SourceType) => {
    const sourceType = sourceTypes.find(st => st.value === type);
    return sourceType ? sourceType.icon : Camera;
  };

  const getSourcePlaceholder = () => {
    switch (sourceType) {
      case 'webcam':
        return '0';
      case 'file':
        return '/path/to/video.mp4';
      case 'rtsp':
        return 'rtsp://username:password@192.168.1.100:554/stream';
      case 'screen':
        return 'screen';
      case 'youtube':
        return 'https://www.youtube.com/watch?v=...';
      default:
        return '';
    }
  };

  const getSourceDescription = () => {
    switch (sourceType) {
      case 'webcam':
        return 'Enter camera index (0 for built-in, 1 for first USB camera, etc.)';
      case 'file':
        return 'Enter the full path to your video file';
      case 'rtsp':
        return 'Enter RTSP or RTMP stream URL (rtsp://... or rtmp://...)';
      case 'screen':
        return 'Type "screen" to capture your screen display';
      case 'youtube':
        return 'Enter YouTube Live stream URL (requires yt-dlp: brew install yt-dlp)';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Camera & Video Sources</h1>
        <p className="text-sm text-gray-600 mt-1">Configure video input sources for analytics</p>
      </div>

      {/* Add New Source Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Source</h2>

        {/* Source Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Source Type</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {sourceTypes.map((st) => {
              const Icon = st.icon;
              return (
                <button
                  key={st.value}
                  onClick={() => {
                    setSourceType(st.value as SourceType);
                    setSourceValue(st.value === 'webcam' ? '0' : st.value === 'screen' ? 'screen' : '');
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    sourceType === st.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-6 h-6 mx-auto mb-2 ${
                    sourceType === st.value ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <p className={`text-sm font-medium ${
                    sourceType === st.value ? 'text-blue-900' : 'text-gray-700'
                  }`}>{st.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{st.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Source Configuration */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source Name</label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g., Front Door Camera"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source Value</label>
            <input
              type="text"
              value={sourceValue}
              onChange={(e) => setSourceValue(e.target.value)}
              placeholder={getSourcePlaceholder()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
            <p className="mt-2 text-xs text-gray-600">{getSourceDescription()}</p>
          </div>

          <button
            onClick={handleAddSource}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Add Source
          </button>
        </div>
      </div>

      {/* Saved Sources */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configured Sources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedSources.map((source, index) => {
            const Icon = getSourceIcon(source.type);
            return (
              <div key={index} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Circle className="w-3 h-3 text-gray-400 fill-gray-400" />
                    <span className="text-xs text-gray-600 capitalize">{source.type}</span>
                  </div>
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">{source.name}</h3>
                <p className="text-xs text-gray-600 mb-4 font-mono break-all">{source.value}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(source.value);
                    alert(`Copied to clipboard!\n\nRun:\npython3 -m camera_analytics.run_with_websocket --source "${source.value}"`);
                  }}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Copy Command
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legacy Camera Grid */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-sm text-yellow-800 font-medium">
          Legacy camera management UI below. Use the new source configuration above.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cameras.map((camera) => (
          <div key={camera.id} className="bg-white rounded-xl border border-gray-200 p-6 opacity-60">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Camera className="w-6 h-6 text-gray-400" />
              </div>
              <div className="flex items-center space-x-2">
                <Circle
                  className={`w-3 h-3 ${
                    camera.status === 'online' ? 'text-green-500 fill-green-500' : 'text-red-500 fill-red-500'
                  }`}
                />
                <span className="text-xs text-gray-600 capitalize">{camera.status}</span>
              </div>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">{camera.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{camera.location}</p>
            <button className="w-full px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">
              Configure
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced Features Coming Soon</h3>
        <p className="text-sm text-gray-600">Camera configuration, stream settings, and multi-camera view</p>
      </div>
    </div>
  );
}
