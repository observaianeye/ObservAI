import { Video, Maximize2, RotateCcw } from 'lucide-react';
import { useState } from 'react';

interface CameraFeedProps {
  showHeatmap?: boolean;
}

export default function CameraFeed({ showHeatmap = false }: CameraFeedProps) {
  const [isLive, setIsLive] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Camera 01 - Main Entrance</h3>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
              <span className="text-xs text-gray-300">{isLive ? 'LIVE' : 'OFFLINE'}</span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-400">1920x1080 • 30 FPS</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <RotateCcw className="w-4 h-4 text-gray-300" />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <Maximize2 className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      <div className="relative bg-gray-900 aspect-video">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center">
            <div className="text-center">
              <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">Live Camera Feed Placeholder</p>
              <p className="text-gray-500 text-sm mt-1">Demo video would stream here</p>
            </div>
          </div>
        </div>

        {showHeatmap && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="w-full h-full" style={{
              background: `radial-gradient(circle at 30% 40%, rgba(239, 68, 68, 0.4) 0%, transparent 30%),
                          radial-gradient(circle at 70% 50%, rgba(249, 115, 22, 0.3) 0%, transparent 25%),
                          radial-gradient(circle at 50% 70%, rgba(234, 179, 8, 0.25) 0%, transparent 20%)`
            }}></div>
          </div>
        )}

        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs font-mono">
            {new Date().toLocaleTimeString()}
          </div>
          {showHeatmap && (
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
              <p className="text-xs text-white font-semibold">Heatmap Overlay Active</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <div className="text-xs text-gray-600">
          <span className="font-semibold">Current:</span> 12 visitors detected
        </div>
        <div className="flex items-center space-x-4 text-xs">
          <div>
            <span className="text-gray-500">Peak:</span> <span className="font-semibold text-gray-900">34</span>
          </div>
          <div>
            <span className="text-gray-500">Avg:</span> <span className="font-semibold text-gray-900">18</span>
          </div>
        </div>
      </div>
    </div>
  );
}
