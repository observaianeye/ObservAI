import { X, Activity, Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cameraBackendService } from '../services/cameraBackendService';
import { useDataMode } from '../contexts/DataModeContext';

interface DiagnosticsProps {
  onClose: () => void;
}

export default function Diagnostics({ onClose }: DiagnosticsProps) {
  const { dataMode } = useDataMode();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'failed'>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastDataTimestamp, setLastDataTimestamp] = useState<Date | null>(null);

  useEffect(() => {
    // Subscribe to connection status updates
    const unsubscribe = cameraBackendService.onConnectionStatus((status, attempts) => {
      setConnectionStatus(status);
      setReconnectAttempts(attempts || 0);
    });

    // Subscribe to analytics updates to track last data received
    const unsubscribeAnalytics = cameraBackendService.onAnalytics(() => {
      setLastDataTimestamp(new Date());
    });

    // Get initial status
    setConnectionStatus(cameraBackendService.getCurrentConnectionStatus());

    return () => {
      unsubscribe();
      unsubscribeAnalytics();
    };
  }, []);

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'reconnecting':
        return <Activity className="w-6 h-6 text-yellow-500 animate-pulse" />;
      case 'failed':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      default:
        return <WifiOff className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'reconnecting':
        return `Reconnecting (${reconnectAttempts}/${10})`;
      case 'failed':
        return 'Connection Failed';
      default:
        return 'Disconnected';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-500';
      case 'reconnecting':
        return 'text-yellow-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">System Diagnostics</h2>
              <p className="text-blue-100 text-sm">Monitor ObservAI system health</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Data Mode */}
            <div className="p-4 border-2 border-gray-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Data Mode</h3>
                  <p className="text-sm text-gray-600 mt-1">Current operating mode</p>
                </div>
                <div className={`px-4 py-2 rounded-lg font-semibold ${
                  dataMode === 'live'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {dataMode.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Backend Connection Status */}
            {dataMode === 'live' && (
              <div className="p-4 border-2 border-gray-200 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Backend Connection</h3>
                    <p className="text-sm text-gray-600 mt-1">Socket.IO connection to Python backend</p>
                  </div>
                  {getStatusIcon()}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-semibold ${getStatusColor()}`}>{getStatusText()}</span>
                  </div>
                  {lastDataTimestamp && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Last Data Received:</span>
                      <span className="font-mono text-gray-900">
                        {lastDataTimestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                  {connectionStatus === 'failed' && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">
                        Unable to connect to camera analytics backend. Ensure the Python backend is running.
                      </p>
                    </div>
                  )}
                  {connectionStatus === 'disconnected' && (
                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-700">
                        Not connected. Start live mode to connect to the backend.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Demo Mode Info */}
            {dataMode === 'demo' && (
              <div className="p-4 border-2 border-blue-200 rounded-xl bg-blue-50">
                <div className="flex items-center gap-3">
                  <Wifi className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-bold text-blue-900">Demo Mode Active</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Using simulated data. Switch to Live mode to connect to camera analytics.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* System Information */}
            <div className="p-4 border-2 border-gray-200 rounded-xl">
              <h3 className="text-lg font-bold text-gray-900 mb-4">System Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Frontend:</span>
                  <span className="font-mono text-gray-900">React + Vite</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Backend API:</span>
                  <span className="font-mono text-gray-900">
                    {import.meta.env.VITE_API_URL || 'http://localhost:3001'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Analytics Backend:</span>
                  <span className="font-mono text-gray-900">
                    {import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'}
                  </span>
                </div>
              </div>
            </div>

            {/* Troubleshooting Tips */}
            <div className="p-4 border-2 border-gray-200 rounded-xl">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Troubleshooting</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>If connection fails, ensure Python backend is running on port 5001</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Check browser console (F12) for detailed error messages</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Verify camera permissions are granted in browser settings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Try refreshing the page if connection is stuck</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
