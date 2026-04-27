import { Camera, Circle, Monitor, Wifi, Upload, Trash2, Loader2, Smartphone, Play, Youtube, Plus, Check, Pencil, X, Building2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDashboardFilter } from '../../contexts/DashboardFilterContext';

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

const SOURCE_TYPE_META: Record<SourceType, { gradient: string; accentColor: string }> = {
  webcam: { gradient: 'from-brand-500/25 via-brand-500/10 to-transparent', accentColor: '#1d6bff' },
  phone: { gradient: 'from-violet-500/25 via-violet-500/10 to-transparent', accentColor: '#8b5cf6' },
  file: { gradient: 'from-cyan-500/25 via-cyan-500/10 to-transparent', accentColor: '#06b6d4' },
  rtsp: { gradient: 'from-accent-500/25 via-accent-500/10 to-transparent', accentColor: '#12bcff' },
  screen: { gradient: 'from-amber-500/25 via-amber-500/10 to-transparent', accentColor: '#f59e0b' },
  youtube: { gradient: 'from-danger-500/25 via-danger-500/10 to-transparent', accentColor: '#ef4444' },
};

export default function CameraSelectionPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { selectedBranch } = useDashboardFilter();
  const [sourceType, setSourceType] = useState<SourceType>('webcam');
  const [sourceValue, setSourceValue] = useState<string>('0');
  const [sourceName, setSourceName] = useState<string>('');
  const [cameras, setCameras] = useState<SavedCamera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchCameras = useCallback(async () => {
    setIsLoading(true);
    try {
      // When a branch is active we scope to it; otherwise show every camera
      // the user owns. This matches CameraFeed's behavior and stops the
      // "Configured Sources" pane from looking empty when the navbar branch
      // selector hasn't loaded yet.
      const url = selectedBranch
        ? `${API_URL}/api/cameras?branchId=${encodeURIComponent(selectedBranch.id)}`
        : `${API_URL}/api/cameras`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCameras(data);
      } else {
        setCameras([]);
      }
    } catch (err) {
      console.error('Failed to fetch cameras:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch?.id]);

  useEffect(() => { fetchCameras(); }, [fetchCameras]);

  const sourceTypes = [
    { value: 'webcam' as SourceType, label: t('cameraSelection.type.webcam.label'), icon: Camera, description: t('cameraSelection.type.webcam.desc') },
    { value: 'phone' as SourceType, label: t('cameraSelection.type.phone.label'), icon: Smartphone, description: t('cameraSelection.type.phone.desc') },
    { value: 'file' as SourceType, label: t('cameraSelection.type.file.label'), icon: Upload, description: t('cameraSelection.type.file.desc') },
    { value: 'rtsp' as SourceType, label: t('cameraSelection.type.rtsp.label'), icon: Wifi, description: t('cameraSelection.type.rtsp.desc') },
    { value: 'screen' as SourceType, label: t('cameraSelection.type.screen.label'), icon: Monitor, description: t('cameraSelection.type.screen.desc') },
    { value: 'youtube' as SourceType, label: t('cameraSelection.type.youtube.label'), icon: Youtube, description: t('cameraSelection.type.youtube.desc') },
  ];

  const handleAddSource = async () => {
    if (!sourceValue || !sourceName) {
      setError(t('cameraSelection.errorMissing'));
      return;
    }
    if (!selectedBranch) {
      setError('Once bir sube secin (ust menuden) — kameralar subeye baglidir.');
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
          createdBy: user?.id,
          branchId: selectedBranch.id,
        }),
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
        credentials: 'include',
      });
      if (res.ok || res.status === 204) {
        setCameras((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete camera:', err);
    }
  };

  const startEdit = (cam: SavedCamera) => {
    setEditingId(cam.id);
    setEditName(cam.name);
    setEditValue(cam.sourceValue);
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditValue('');
    setEditError('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim() || !editValue.trim()) {
      setEditError(t('cameraSelection.errorMissing'));
      return;
    }
    setIsUpdating(true);
    setEditError('');
    try {
      const res = await fetch(`${API_URL}/api/cameras/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editName, sourceValue: editValue }),
      });
      if (res.ok) {
        await fetchCameras();
        cancelEdit();
      } else {
        const data = await res.json().catch(() => ({}));
        setEditError(data.error || t('cameraSelection.errorSave'));
      }
    } catch (err) {
      setEditError(t('cameraSelection.errorBackend'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleActivate = async (cameraId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/cameras/activate/${cameraId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await fetchCameras();
        // Notify other mounted views (CameraFeed, ZoneCanvas) to refetch
        // their zone state against the newly-active camera.
        window.dispatchEvent(new CustomEvent('observai:active-camera-changed', {
          detail: { cameraId },
        }));
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Failed to activate camera:', err);
    }
  };

  const getSourceIcon = (type: string) => {
    const st = sourceTypes.find((s) => s.value === (type.toLowerCase() as SourceType));
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

  const activeMeta = SOURCE_TYPE_META[sourceType];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-gradient-brand tracking-tight">{t('cameraSelection.page.title')}</h1>
        <p className="text-sm text-ink-3 mt-1">{t('cameraSelection.page.subtitle')}</p>
      </div>

      {selectedBranch ? (
        <div className="surface-card rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-ink-2">
          <Building2 className="w-4 h-4 text-brand-300" strokeWidth={1.5} />
          <span>
            <span className="text-ink-3">Aktif sube:</span>{' '}
            <span className="font-semibold text-ink-0">{selectedBranch.name}</span>
            <span className="text-ink-4"> &middot; {selectedBranch.city}</span>
          </span>
          <span className="ml-auto text-[11px] text-ink-4">Eklenen kameralar bu subeye baglanir.</span>
        </div>
      ) : (
        <div className="surface-card rounded-xl px-4 py-3 flex items-center gap-3 text-sm border border-warning-500/30 bg-warning-500/5">
          <Building2 className="w-4 h-4 text-warning-300" strokeWidth={1.5} />
          <span className="text-warning-200">
            Once bir sube secin (ust menuden &ldquo;Sube ekle&rdquo;) — kameralar subeye bagli yonetilir.
          </span>
        </div>
      )}

      {/* Add New Source */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden surface-card rounded-2xl p-6"
      >
        {/* Ambient gradient that shifts with selected source */}
        <motion.div
          key={sourceType}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className={`pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl bg-gradient-to-br ${activeMeta.gradient}`}
        />

        <h2 className="relative font-display text-lg font-semibold text-ink-0 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-brand-300" strokeWidth={1.5} />
          {t('cameraSelection.addNew')}
        </h2>

        <div className="relative mb-6">
          <label className="block text-sm font-medium text-ink-2 mb-3">{t('cameraSelection.page.sourceLabel')}</label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {sourceTypes.map((st, i) => {
              const Icon = st.icon;
              const active = sourceType === st.value;
              const meta = SOURCE_TYPE_META[st.value];
              return (
                <motion.button
                  key={st.value}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.045, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setSourceType(st.value);
                    setSourceValue(st.value === 'webcam' ? '0' : st.value === 'screen' ? 'screen' : st.value === 'phone' ? 'http://' : '');
                  }}
                  className={`relative p-4 rounded-xl border-2 transition-colors text-left overflow-hidden ${
                    active
                      ? 'border-brand-500/60 bg-brand-500/10'
                      : 'border-white/[0.08] hover:border-white/[0.16] bg-white/[0.03]'
                  }`}
                  style={active ? { boxShadow: `0 0 22px ${meta.accentColor}33, inset 0 0 0 1px ${meta.accentColor}40` } : undefined}
                >
                  {active && (
                    <motion.div
                      layoutId="sourceTypeGlow"
                      className="absolute inset-0 pointer-events-none rounded-xl"
                      style={{
                        background: `radial-gradient(circle at 30% 20%, ${meta.accentColor}30, transparent 70%)`,
                      }}
                    />
                  )}
                  <div className="relative">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 transition-colors`}
                      style={{
                        backgroundColor: active ? `${meta.accentColor}25` : 'rgba(255,255,255,0.04)',
                      }}
                    >
                      <Icon strokeWidth={1.5} className="w-5 h-5" style={{ color: active ? meta.accentColor : undefined }} />
                    </div>
                    <p className={`text-sm font-semibold ${active ? 'text-ink-0' : 'text-ink-2'}`}>{st.label}</p>
                    <p className="text-xs text-ink-4 mt-0.5 line-clamp-2">{st.description}</p>
                  </div>
                  {active && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center shadow-glow-brand"
                    >
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="relative space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">{t('cameraSelection.sourceName')}</label>
            <input
              data-testid="new-camera-name"
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder={t('cameraSelection.sourceNamePh')}
              className="w-full px-4 py-2.5 border border-white/[0.08] bg-surface-2/70 text-ink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 placeholder:text-ink-4 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">{t('cameraSelection.sourceValue')}</label>
            <input
              data-testid="new-camera-value"
              type="text"
              value={sourceValue}
              onChange={(e) => setSourceValue(e.target.value)}
              placeholder={getSourcePlaceholder()}
              className="w-full px-4 py-2.5 border border-white/[0.08] bg-surface-2/70 text-ink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 font-mono text-sm placeholder:text-ink-4 transition-all"
            />
            <p className="mt-2 text-xs text-ink-4">{t(`cameraSelection.placeholder.${sourceType}`)}</p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-sm text-danger-400"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            whileTap={{ scale: 0.98 }}
            data-testid="new-camera-submit"
            onClick={handleAddSource}
            disabled={isSaving}
            className="w-full px-4 py-3 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-xl font-semibold hover:shadow-glow-brand transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2} />}
            {isSaving ? t('cameraSelection.saving') : t('cameraSelection.addSource')}
          </motion.button>
        </div>
      </motion.div>

      {/* Saved Cameras */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-ink-0">
            {t('cameraSelection.configured')} {cameras.length > 0 && <span className="text-ink-3 font-normal">({cameras.length})</span>}
          </h2>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-brand-400 mx-auto" />
            <p className="text-sm text-ink-3 mt-2">{t('cameraSelection.loading')}</p>
          </div>
        ) : cameras.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="surface-card rounded-2xl p-10 text-center"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500/10 mb-4">
              <Camera strokeWidth={1.5} className="w-7 h-7 text-brand-300" />
            </div>
            <p className="text-ink-2 font-medium">{t('cameraSelection.emptyTitle')}</p>
            <p className="text-sm text-ink-4 mt-1">{t('cameraSelection.emptyHint')}</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {cameras.map((camera, i) => {
                const Icon = getSourceIcon(camera.sourceType);
                const meta = SOURCE_TYPE_META[camera.sourceType.toLowerCase() as SourceType] || SOURCE_TYPE_META.webcam;
                return (
                  <motion.div
                    key={camera.id}
                    data-testid="camera-card"
                    data-camera-id={camera.id}
                    data-camera-name={camera.name}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -3 }}
                    className="relative group surface-card rounded-2xl p-6 overflow-hidden"
                    style={{ boxShadow: camera.isActive ? `0 0 22px ${meta.accentColor}22` : undefined }}
                  >
                    <div
                      className="pointer-events-none absolute -top-12 -right-10 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: `radial-gradient(circle, ${meta.accentColor}44, transparent 70%)` }}
                    />
                    <div className="relative flex items-start justify-between mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${meta.accentColor}20` }}
                      >
                        <Icon strokeWidth={1.5} className="w-6 h-6" style={{ color: meta.accentColor }} />
                      </div>
                      <div className="flex items-center gap-2">
                        {camera.isActive && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-success-500/20 text-success-300 border border-success-500/30"
                          >
                            <motion.span
                              animate={{ scale: [1, 1.3, 1] }}
                              transition={{ repeat: Infinity, duration: 1.6 }}
                              className="w-1.5 h-1.5 rounded-full bg-success-400"
                            />
                            LIVE
                          </motion.span>
                        )}
                        <Circle className={`w-2.5 h-2.5 ${camera.isActive ? 'text-success-400 fill-success-400' : 'text-ink-4 fill-ink-4'}`} />
                        <span className="text-[11px] text-ink-3 capitalize font-mono">{camera.sourceType.toLowerCase()}</span>
                      </div>
                    </div>
                    {editingId === camera.id ? (
                      <div data-testid="camera-edit-form" className="relative space-y-3">
                        <input
                          data-testid="camera-edit-name"
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder={t('cameraSelection.sourceNamePh')}
                          className="w-full px-3 py-2 border border-white/[0.08] bg-surface-2/70 text-ink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 text-sm placeholder:text-ink-4"
                        />
                        <input
                          data-testid="camera-edit-value"
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full px-3 py-2 border border-white/[0.08] bg-surface-2/70 text-ink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 font-mono text-xs placeholder:text-ink-4"
                        />
                        {editError && <p className="text-xs text-danger-400">{editError}</p>}
                        <div className="flex gap-2">
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            data-testid="camera-edit-save"
                            onClick={() => handleSaveEdit(camera.id)}
                            disabled={isUpdating}
                            className="flex-1 px-3 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" strokeWidth={2} />}
                            {t('cameraSelection.save')}
                          </motion.button>
                          <button
                            data-testid="camera-edit-cancel"
                            onClick={cancelEdit}
                            className="px-3 py-2 text-ink-2 hover:bg-white/[0.06] rounded-xl border border-white/[0.08] flex items-center justify-center"
                            title={t('cameraSelection.cancel')}
                          >
                            <X className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 data-testid="camera-name" className="relative text-base font-semibold text-ink-0 mb-1 truncate" title={camera.name}>{camera.name}</h3>
                        <p data-testid="camera-value" className="relative text-xs text-ink-4 mb-4 font-mono break-all line-clamp-2" title={camera.sourceValue}>{camera.sourceValue}</p>
                        <div className="relative flex gap-2">
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            data-testid="camera-activate"
                            onClick={() => handleActivate(camera.id)}
                            className="flex-1 px-3 py-2 bg-brand-500/15 text-brand-200 border border-brand-500/30 rounded-xl text-sm font-medium hover:bg-brand-500/25 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5" strokeWidth={1.5} />
                            {t('cameraSelection.activate')}
                          </motion.button>
                          <button
                            data-testid="camera-edit"
                            onClick={() => startEdit(camera)}
                            className="px-3 py-2 text-ink-2 hover:bg-white/[0.06] rounded-xl transition-colors border border-white/[0.08]"
                            title={t('cameraSelection.edit')}
                          >
                            <Pencil className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(`python -m camera_analytics.run_with_websocket --source "${camera.sourceValue}"`)}
                            className="px-3 py-2 bg-white/[0.04] text-ink-2 rounded-xl text-sm font-medium hover:bg-white/[0.08] transition-colors border border-white/[0.08]"
                            title={t('cameraSelection.copyCmd')}
                          >
                            {t('cameraSelection.copy')}
                          </button>
                          <button
                            data-testid="camera-delete"
                            onClick={() => handleDelete(camera.id)}
                            className="px-3 py-2 text-danger-400 hover:bg-danger-500/10 rounded-xl transition-colors border border-white/[0.08]"
                            title={t('cameraSelection.delete')}
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
