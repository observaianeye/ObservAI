import { X, Activity, Wifi, WifiOff, AlertCircle, CheckCircle, Server, Database, Brain, Camera } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cameraBackendService } from '../services/cameraBackendService';
import { useDataMode } from '../contexts/DataModeContext';

interface DiagnosticsProps {
  onClose: () => void;
}

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'checking' | 'degraded';
  detail?: string;
  icon: typeof Server;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

export default function Diagnostics({ onClose }: DiagnosticsProps) {
  const { dataMode } = useDataMode();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'failed'>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastDataTimestamp, setLastDataTimestamp] = useState<Date | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Node.js Backend', status: 'checking', icon: Server },
    { name: 'Python Analytics', status: 'checking', icon: Camera },
    { name: 'Database', status: 'checking', icon: Database },
    { name: 'Ollama AI', status: 'checking', icon: Brain },
  ]);

  useEffect(() => {
    const unsubscribe = cameraBackendService.onConnectionStatus((status, attempts) => {
      setConnectionStatus(status);
      setReconnectAttempts(attempts || 0);
    });

    const unsubscribeAnalytics = cameraBackendService.onAnalytics(() => {
      setLastDataTimestamp(new Date());
    });

    setConnectionStatus(cameraBackendService.getCurrentConnectionStatus());

    // Run real health checks
    runHealthChecks();

    return () => {
      unsubscribe();
      unsubscribeAnalytics();
    };
  }, []);

  const runHealthChecks = async () => {
    const results: ServiceStatus[] = [...services];

    // Check Node.js Backend
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) {
        const data = await res.json();
        results[0] = { ...results[0], status: 'online', detail: `Database: ${data.database}` };
        results[2] = { ...results[2], status: data.database === 'connected' ? 'online' : 'offline', detail: data.database };
      } else {
        results[0] = { ...results[0], status: 'degraded', detail: `HTTP ${res.status}` };
        results[2] = { ...results[2], status: 'offline', detail: 'Cannot check' };
      }
    } catch {
      results[0] = { ...results[0], status: 'offline', detail: 'Connection refused' };
      results[2] = { ...results[2], status: 'offline', detail: 'Backend offline' };
    }

    // Check Python Analytics Backend
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      if (res.ok) {
        const data = await res.json();
        results[1] = { ...results[1], status: 'online', detail: data.model ? `Model: ${data.model}` : 'Running' };
      } else {
        results[1] = { ...results[1], status: 'degraded', detail: `HTTP ${res.status}` };
      }
    } catch {
      results[1] = { ...results[1], status: 'offline', detail: 'Not running' };
    }

    // Check Ollama
    try {
      const res = await fetch(`${API_URL}/api/ai/debug`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.ollama?.status === 'online') {
          const modelCount = data.ollama.models?.length || 0;
          results[3] = { ...results[3], status: 'online', detail: `${modelCount} model(s) available` };
        } else {
          results[3] = { ...results[3], status: 'offline', detail: 'Ollama not running' };
        }
      } else {
        results[3] = { ...results[3], status: 'offline', detail: 'Cannot check' };
      }
    } catch {
      results[3] = { ...results[3], status: 'offline', detail: 'Cannot reach backend' };
    }

    setServices(results);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online': return <span className="flex items-center gap-1.5 text-green-400 text-sm font-medium"><CheckCircle className="w-4 h-4" /> Online</span>;
      case 'offline': return <span className="flex items-center gap-1.5 text-red-400 text-sm font-medium"><AlertCircle className="w-4 h-4" /> Offline</span>;
      case 'degraded': return <span className="flex items-center gap-1.5 text-yellow-400 text-sm font-medium"><AlertCircle className="w-4 h-4" /> Degraded</span>;
      default: return <span className="flex items-center gap-1.5 text-gray-400 text-sm font-medium"><Activity className="w-4 h-4 animate-spin" /> Checking...</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#0f1117]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">System Diagnostics</h2>
              <p className="text-blue-100 text-sm">Real-time system health monitoring</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Service Health Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {services.map((service, i) => {
              const Icon = service.icon;
              return (
                <div key={i} className="p-4 border border-white/10 rounded-xl bg-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-gray-400" />
                      <span className="text-sm font-semibold text-white">{service.name}</span>
                    </div>
                    {getStatusBadge(service.status)}
                  </div>
                  {service.detail && (
                    <p className="text-xs text-gray-500 mt-1">{service.detail}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Data Mode */}
          <div className="p-4 border border-white/10 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Data Mode</h3>
                <p className="text-xs text-gray-400 mt-1">Current operating mode</p>
              </div>
              <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                dataMode === 'live' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
              }`}>
                {dataMode.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Live Connection Status */}
          {dataMode === 'live' && (
            <div className="p-4 border border-white/10 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">WebSocket Connection</h3>
                <span className={`text-sm font-medium ${
                  connectionStatus === 'connected' ? 'text-green-400' :
                  connectionStatus === 'reconnecting' ? 'text-yellow-400' :
                  connectionStatus === 'failed' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {connectionStatus === 'connected' ? 'Connected' :
                   connectionStatus === 'reconnecting' ? `Reconnecting (${reconnectAttempts}/10)` :
                   connectionStatus === 'failed' ? 'Failed' : 'Disconnected'}
                </span>
              </div>
              {lastDataTimestamp && (
                <p className="text-xs text-gray-400">Last data: {lastDataTimestamp.toLocaleTimeString()}</p>
              )}
            </div>
          )}

          {/* System Info */}
          <div className="p-4 border border-white/10 rounded-xl">
            <h3 className="text-sm font-bold text-white mb-3">System Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Frontend:</span>
                <span className="font-mono text-gray-300">React + Vite + TypeScript</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Backend API:</span>
                <span className="font-mono text-gray-300">{API_URL}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Analytics:</span>
                <span className="font-mono text-gray-300">{BACKEND_URL}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">AI Provider:</span>
                <span className="font-mono text-gray-300">Ollama (local)</span>
              </div>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="p-4 border border-white/10 rounded-xl">
            <h3 className="text-sm font-bold text-white mb-3">Troubleshooting</h3>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>- Python backend offline? Run: <code className="text-blue-400">start-backend.bat</code></li>
              <li>- Ollama offline? Start Ollama app, then: <code className="text-blue-400">ollama pull llama3.1:8b</code></li>
              <li>- No camera data? Check camera permissions in browser settings</li>
              <li>- Database error? Run: <code className="text-blue-400">npm run db:generate</code> in backend/</li>
            </ul>
          </div>

          {/* Refresh */}
          <button
            onClick={runHealthChecks}
            className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-white/5 rounded-lg transition-colors border border-white/10"
          >
            Re-run Health Checks
          </button>
        </div>
      </div>
    </div>
  );
}
