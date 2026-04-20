import { X, Activity, AlertCircle, CheckCircle, Server, Database, Brain, Camera } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cameraBackendService } from '../services/cameraBackendService';
import { useDataMode } from '../contexts/DataModeContext';
import { useLanguage } from '../contexts/LanguageContext';

interface DiagnosticsProps {
  onClose: () => void;
}

type ServiceKey = 'node' | 'python' | 'db' | 'ollama';

interface ServiceStatus {
  key: ServiceKey;
  status: 'online' | 'offline' | 'checking' | 'degraded';
  detail?: string;
  icon: typeof Server;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

export default function Diagnostics({ onClose }: DiagnosticsProps) {
  const { dataMode } = useDataMode();
  const { t } = useLanguage();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'failed'>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastDataTimestamp, setLastDataTimestamp] = useState<Date | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([
    { key: 'node', status: 'checking', icon: Server },
    { key: 'python', status: 'checking', icon: Camera },
    { key: 'db', status: 'checking', icon: Database },
    { key: 'ollama', status: 'checking', icon: Brain },
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

    runHealthChecks();

    return () => {
      unsubscribe();
      unsubscribeAnalytics();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runHealthChecks = async () => {
    const results: ServiceStatus[] = [
      { key: 'node', status: 'checking', icon: Server },
      { key: 'python', status: 'checking', icon: Camera },
      { key: 'db', status: 'checking', icon: Database },
      { key: 'ollama', status: 'checking', icon: Brain },
    ];

    // Node.js Backend
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) {
        const data = await res.json();
        results[0] = { ...results[0], status: 'online', detail: t('diag.detail.dbConnected', { state: data.database }) };
        results[2] = { ...results[2], status: data.database === 'connected' ? 'online' : 'offline', detail: data.database };
      } else {
        results[0] = { ...results[0], status: 'degraded', detail: `HTTP ${res.status}` };
        results[2] = { ...results[2], status: 'offline', detail: t('diag.detail.cannotCheck') };
      }
    } catch {
      results[0] = { ...results[0], status: 'offline', detail: t('diag.detail.refused') };
      results[2] = { ...results[2], status: 'offline', detail: t('diag.detail.backendOffline') };
    }

    // Python Analytics
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      if (res.ok) {
        const data = await res.json();
        results[1] = { ...results[1], status: 'online', detail: data.model ? `Model: ${data.model}` : t('diag.detail.running') };
      } else {
        results[1] = { ...results[1], status: 'degraded', detail: `HTTP ${res.status}` };
      }
    } catch {
      results[1] = { ...results[1], status: 'offline', detail: t('diag.detail.notRunning') };
    }

    // Ollama
    try {
      const res = await fetch(`${API_URL}/api/ai/debug`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.ollama?.status === 'online') {
          const modelCount = data.ollama.models?.length || 0;
          results[3] = { ...results[3], status: 'online', detail: t('diag.detail.modelsAvailable', { n: modelCount }) };
        } else {
          results[3] = { ...results[3], status: 'offline', detail: t('diag.detail.ollamaNotRunning') };
        }
      } else {
        results[3] = { ...results[3], status: 'offline', detail: t('diag.detail.cannotCheck') };
      }
    } catch {
      results[3] = { ...results[3], status: 'offline', detail: t('diag.detail.notReachable') };
    }

    setServices(results);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return (
          <span className="flex items-center gap-1.5 text-success-400 text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> {t('diag.status.online')}
          </span>
        );
      case 'offline':
        return (
          <span className="flex items-center gap-1.5 text-danger-400 text-sm font-medium">
            <AlertCircle className="w-4 h-4" /> {t('diag.status.offline')}
          </span>
        );
      case 'degraded':
        return (
          <span className="flex items-center gap-1.5 text-warning-400 text-sm font-medium">
            <AlertCircle className="w-4 h-4" /> {t('diag.status.degraded')}
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-ink-3 text-sm font-medium">
            <Activity className="w-4 h-4 animate-spin" /> {t('diag.status.checking')}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-surface-0/72 backdrop-blur-md" onClick={onClose} />

      <div className="relative surface-card-elevated w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="relative overflow-hidden border-b border-white/[0.06]">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 via-accent-500/10 to-violet-500/15" aria-hidden />
          <div className="relative p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-surface-2/60 backdrop-blur-sm border border-white/10 rounded-xl flex items-center justify-center shadow-glow-brand">
                <Activity className="w-6 h-6 text-brand-300" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-semibold text-ink-0 tracking-tight">{t('diag.title')}</h2>
                <p className="text-ink-2 text-sm mt-0.5">{t('diag.subtitle')}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors" aria-label={t('common.close')}>
              <X className="w-6 h-6 text-ink-1" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {/* Service Health Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {services.map((service, i) => {
              const Icon = service.icon;
              return (
                <div key={i} className="p-4 border border-white/[0.08] rounded-xl bg-surface-2/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-ink-3" />
                      <span className="text-sm font-semibold text-ink-0">{t(`diag.service.${service.key}`)}</span>
                    </div>
                    {getStatusBadge(service.status)}
                  </div>
                  {service.detail && (
                    <p className="text-xs text-ink-3 mt-1">{service.detail}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Data Mode */}
          <div className="p-4 border border-white/[0.08] rounded-xl bg-surface-2/40">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink-0">{t('diag.dataMode')}</h3>
                <p className="text-xs text-ink-3 mt-1">{t('diag.dataModeSubtitle')}</p>
              </div>
              <span
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-[0.18em] border ${
                  dataMode === 'live'
                    ? 'bg-success-500/10 text-success-300 border-success-500/30'
                    : 'bg-violet-500/10 text-violet-200 border-violet-500/30'
                }`}
              >
                {dataMode}
              </span>
            </div>
          </div>

          {/* Live Connection Status */}
          {dataMode === 'live' && (
            <div className="p-4 border border-white/[0.08] rounded-xl bg-surface-2/40">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-ink-0">{t('diag.ws.title')}</h3>
                <span
                  className={`text-sm font-medium ${
                    connectionStatus === 'connected'
                      ? 'text-success-400'
                      : connectionStatus === 'reconnecting'
                      ? 'text-warning-400'
                      : connectionStatus === 'failed'
                      ? 'text-danger-400'
                      : 'text-ink-3'
                  }`}
                >
                  {connectionStatus === 'connected'
                    ? t('diag.ws.connected')
                    : connectionStatus === 'reconnecting'
                    ? t('diag.ws.reconnecting', { n: reconnectAttempts })
                    : connectionStatus === 'failed'
                    ? t('diag.ws.failed')
                    : t('diag.ws.disconnected')}
                </span>
              </div>
              {lastDataTimestamp && (
                <p className="text-xs text-ink-3">
                  {t('diag.ws.lastData', { time: lastDataTimestamp.toLocaleTimeString() })}
                </p>
              )}
            </div>
          )}

          {/* System Info */}
          <div className="p-4 border border-white/[0.08] rounded-xl bg-surface-2/40">
            <h3 className="text-sm font-bold text-ink-0 mb-3">{t('diag.info.title')}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-3">{t('diag.info.frontend')}</span>
                <span className="font-mono text-ink-2">React + Vite + TypeScript</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">{t('diag.info.backendApi')}</span>
                <span className="font-mono text-ink-2">{API_URL}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">{t('diag.info.analytics')}</span>
                <span className="font-mono text-ink-2">{BACKEND_URL}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-3">{t('diag.info.aiProvider')}</span>
                <span className="font-mono text-ink-2">Ollama (local)</span>
              </div>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="p-4 border border-white/[0.08] rounded-xl bg-surface-2/40">
            <h3 className="text-sm font-bold text-ink-0 mb-3">{t('diag.troubleshoot.title')}</h3>
            <ul className="space-y-2 text-xs text-ink-3">
              <li>
                — {t('diag.troubleshoot.python')} <code className="text-brand-300 font-mono">start-backend.bat</code>
              </li>
              <li>
                — {t('diag.troubleshoot.ollama')} <code className="text-brand-300 font-mono">ollama pull llama3.1:8b</code>
              </li>
              <li>— {t('diag.troubleshoot.camera')}</li>
              <li>
                — {t('diag.troubleshoot.db')} <code className="text-brand-300 font-mono">npm run db:generate</code>
              </li>
            </ul>
          </div>

          {/* Refresh */}
          <button
            onClick={runHealthChecks}
            className="w-full py-2 text-sm text-brand-300 hover:text-brand-200 hover:bg-white/5 rounded-lg transition-colors border border-white/[0.08]"
          >
            {t('diag.rerun')}
          </button>
        </div>
      </div>
    </div>
  );
}
