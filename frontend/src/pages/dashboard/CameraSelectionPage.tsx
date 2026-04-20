import { Camera, Circle, Monitor, Wifi, Upload, Trash2, Loader2, Smartphone, Play } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

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
  const { t } = useLanguage();
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
    { value: 'webcam', label: t('cameraSelection.type.webcam.label'), icon: Camera, description: t('cameraSelection.type.webcam.desc') },
    { value: 'phone', label: t('cameraSelection.type.phone.label'), icon: Smartphone, description: t('cameraSelection.type.phone.desc') },
    { value: 'file', label: t('cameraSelection.type.file.label'), icon: Upload, description: t('cameraSelection.type.file.desc') },
    { value: 'rtsp', label: t('cameraSelection.type.rtsp.label'), icon: Wifi, description: t('cameraSelection.type.rtsp.desc') },
    { value: 'screen', label: t('cameraSelection.type.screen.label'), icon: Monitor, description: t('cameraSelection.type.screen.desc') },
    { value: 'youtube', label: t('cameraSelection.type.youtube.label'), icon: Camera, description: t('cameraSelection.type.youtube.desc') },
  ];

  const handleAddSource = async () => {
    if (!sourceValue || !sourceName) {
      setError(t('cameraSelection.errorMissing'));
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
        setError(data.error || t('cameraSelection.errorSave'));
      }
    } catch (err) {
      setError(t('cameraSelection.errorBackend'));
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

  const getSourceDescription = () => t(`cameraSelection.placeholder.${sourceType}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-gradient-brand tracking-tight">{t('cameraSelection.page.title')}</h1>
        <p className="text-sm text-ink-3 mt-1">{t('cameraSelection.page.subtitle')}</p>
      </div>

      {/* Add New Source */}
      <div className="surface-card rounded-xl p-6">
        <h2 className="font-display text-lg font-semibold text-ink-0 mb-4">{t('cameraSelection.addNew')}</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium text-ink-2 mb-3">{t('cameraSelection.page.sourceLabel')}</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {sourceTypes.map((st) => {
              const Icon = st.icon;
              const active = sourceType === st.value;
              return (
                <button
                  key={st.value}
                  onClick={() => {
                    setSourceType(st.value as SourceType);
                    setSourceValue(st.value === 'webcam' ? '0' : st.value === 'screen' ? 'screen' : st.value === 'phone' ? 'http://' : '');
                  }}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    active
                      ? 'border-brand-500/60 bg-brand-500/15 shadow-glow-brand'
                      : 'border-white/[0.08] hover:border-white/[0.16] bg-white/[0.03]'
                  }`}
                >
                  <Icon strokeWidth={1.5} className={`w-6 h-6 mx-auto mb-2 ${active ? 'text-brand-300' : 'text-ink-3'}`} />
                  <p className={`text-sm font-medium ${active ? 'text-brand-200' : 'text-ink-2'}`}>{st.label}</p>
                  <p className="text-xs text-ink-4 mt-1">{st.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">{t('cameraSelection.sourceName')}</label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder={t('cameraSelection.sourceNamePh')}
              className="w-full px-4 py-2 border border-white/[0.08] bg-surface-2/70 text-ink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 placeholder:text-ink-4 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">{t('cameraSelection.sourceValue')}</label>
            <input
              type="text"
              value={sourceValue}
              onChange={(e) => setSourceValue(e.target.value)}
              placeholder={getSourcePlaceholder()}
              className="w-full px-4 py-2 border border-white/[0.08] bg-surface-2/70 text-ink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 font-mono text-sm placeholder:text-ink-4 transition-all"
            />
            <p className="mt-2 text-xs text-ink-4">{getSourceDescription()}</p>
          </div>

          {error && (
            <p className="text-sm text-danger-400">{error}</p>
          )}

          <button
            onClick={handleAddSource}
            disabled={isSaving}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-xl font-medium hover:shadow-glow-brand transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isSaving ? t('cameraSelection.saving') : t('cameraSelection.addSource')}
          </button>
        </div>
      </div>

      {/* Saved Cameras */}
      <div>
        <h2 className="font-display text-lg font-semibold text-ink-0 mb-4">
          {t('cameraSelection.configured')} {cameras.length > 0 && `(${cameras.length})`}
        </h2>

        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-400 mx-auto" />
            <p className="text-sm text-ink-3 mt-2">{t('cameraSelection.loading')}</p>
          </div>
        ) : cameras.length === 0 ? (
          <div className="surface-card rounded-xl p-8 text-center">
            <Camera strokeWidth={1.5} className="w-10 h-10 text-ink-4 mx-auto mb-3" />
            <p className="text-ink-3">{t('cameraSelection.emptyTitle')}</p>
            <p className="text-sm text-ink-4 mt-1">{t('cameraSelection.emptyHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cameras.map((camera) => {
              const Icon = getSourceIcon(camera.sourceType);
              return (
                <div key={camera.id} className="surface-card rounded-xl p-6 hover:border-brand-500/30 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-brand-500/15 rounded-xl flex items-center justify-center">
                      <Icon strokeWidth={1.5} className="w-6 h-6 text-brand-300" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Circle className={`w-3 h-3 ${camera.isActive ? 'text-success-400 fill-success-400' : 'text-ink-4 fill-ink-4'}`} />
                      <span className="text-xs text-ink-3 capitalize font-mono">{camera.sourceType.toLowerCase()}</span>
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-ink-0 mb-1">{camera.name}</h3>
                  <p className="text-xs text-ink-4 mb-4 font-mono break-all">{camera.sourceValue}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleActivate(camera.id)}
                      className="flex-1 px-3 py-2 bg-brand-500/15 text-brand-200 border border-brand-500/30 rounded-xl text-sm font-medium hover:bg-brand-500/25 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" strokeWidth={1.5} />
                      {t('cameraSelection.activate')}
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `python -m camera_analytics.run_with_websocket --source "${camera.sourceValue}"`
                        );
                      }}
                      className="px-3 py-2 bg-white/[0.04] text-ink-2 rounded-xl text-sm font-medium hover:bg-white/[0.08] transition-colors border border-white/[0.08]"
                      title={t('cameraSelection.copyCmd')}
                    >
                      {t('cameraSelection.copy')}
                    </button>
                    <button
                      onClick={() => handleDelete(camera.id)}
                      className="px-3 py-2 text-danger-400 hover:bg-danger-500/10 rounded-xl transition-colors border border-white/[0.08]"
                      title={t('cameraSelection.delete')}
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
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
