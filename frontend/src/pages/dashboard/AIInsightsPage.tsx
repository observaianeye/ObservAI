import {
  Sparkles,
  TrendingUp,
  Users,
  Clock,
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  BarChart3,
  Zap,
  Eye,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Filter,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { cameraBackendService, ZoneInsight } from '../../services/cameraBackendService';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDashboardFilter } from '../../contexts/DashboardFilterContext';

interface Insight {
  id: string;
  cameraId: string;
  zoneId: string | null;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  context: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
}

interface TrendAnalysis {
  peakHours: { hour: number; avgOccupancy: number }[];
  quietHours: { hour: number; avgOccupancy: number }[];
  totalVisitors: number;
  avgOccupancy: number;
  demographicProfile: {
    dominantGender: string;
    dominantAgeGroup: string;
    genderDistribution: Record<string, number>;
    ageDistribution: Record<string, number>;
  } | null;
  zoneComparison: { zoneId: string; zoneName: string; alertCount: number }[];
  periodLabel: string;
}

interface StatsResult {
  period: string;
  cameraId: string;
  totalVisitors: number;
  avgOccupancy: number;
  peakOccupancy: number;
  peakHour: string;
  totalAlerts: number;
  alertsBySeverity: Record<string, number>;
  demographics: {
    genderDistribution: Record<string, number>;
    ageDistribution: Record<string, number>;
  } | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API Error ${res.status}: ${await res.text()}`);
  return res.json();
}

function SeverityBadge({ severity }: { severity: string }) {
  const { t } = useLanguage();
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode; labelKey: string }> = {
    critical: {
      bg: 'bg-danger-500/20 border-danger-500/40',
      text: 'text-danger-300',
      icon: <AlertCircle className="w-3 h-3" strokeWidth={1.5} />,
      labelKey: 'insight.sev.critical',
    },
    high: {
      bg: 'bg-warning-500/20 border-warning-500/40',
      text: 'text-warning-300',
      icon: <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />,
      labelKey: 'insight.sev.high',
    },
    medium: {
      bg: 'bg-warning-500/20 border-warning-500/40',
      text: 'text-warning-300',
      icon: <Info className="w-3 h-3" strokeWidth={1.5} />,
      labelKey: 'insight.sev.medium',
    },
    low: {
      bg: 'bg-brand-500/20 border-brand-500/40',
      text: 'text-brand-300',
      icon: <Info className="w-3 h-3" strokeWidth={1.5} />,
      labelKey: 'insight.sev.low',
    },
  };
  const c = config[severity] || config.low;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text}`}>
      {c.icon}
      {t(c.labelKey)}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}) {
  return (
    <div className="surface-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-ink-3 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="font-display text-2xl font-bold text-ink-0 font-mono">{value}</p>
      {sub && <p className="text-xs text-ink-4 mt-1">{sub}</p>}
    </div>
  );
}

function PeakHoursChart({ peakHours, quietHours }: { peakHours: TrendAnalysis['peakHours']; quietHours: TrendAnalysis['quietHours'] }) {
  const { t } = useLanguage();
  const allHours = [...peakHours, ...quietHours].sort((a, b) => a.hour - b.hour);
  const maxOcc = Math.max(...allHours.map(h => h.avgOccupancy), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-ink-4">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning-500" /> {t('insight.peak.legendPeak')}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success-500" /> {t('insight.peak.legendQuiet')}</span>
      </div>
      <div className="flex items-end gap-1 h-28">
        {Array.from({ length: 24 }, (_, h) => {
          const entry = allHours.find(e => e.hour === h);
          const occ = entry?.avgOccupancy || 0;
          const pct = maxOcc > 0 ? (occ / maxOcc) * 100 : 0;
          const isPeak = peakHours.some(p => p.hour === h);
          const isQuiet = quietHours.some(q => q.hour === h);
          return (
            <div key={h} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div
                className={`w-full rounded-t transition-colors ${
                  isPeak ? 'bg-warning-500/70' : isQuiet ? 'bg-success-500/50' : 'bg-white/[0.08]'
                }`}
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
              {h % 4 === 0 && (
                <span className="text-[9px] text-ink-4 font-mono">{h}:00</span>
              )}
              <div className="absolute bottom-full mb-2 hidden group-hover:block surface-card text-ink-0 text-xs px-2 py-1 rounded whitespace-nowrap z-10 font-mono">
                {t('insight.peak.tooltip', { hour: h, avg: occ.toFixed(1) })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AIInsightsPage() {
  const { t, lang } = useLanguage();
  const { selectedBranch } = useDashboardFilter();

  const [zoneInsights, setZoneInsights] = useState<ZoneInsight[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [trends, setTrends] = useState<TrendAnalysis | null>(null);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [recSource, setRecSource] = useState<string>('');
  const [summary, setSummary] = useState<{ tr: string; en: string; source: string } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [aiStatus, setAiStatus] = useState<{
    provider: string;
    ollama: { status: string; model: string | null };
    available: boolean;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [, setShowFilters] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('month');

  const cameraIdRef = useRef<string>('');

  const loadData = useCallback(async (period: 'day' | 'week' | 'month' = 'month') => {
    setLoading(true);
    setError(null);
    try {
      // Always re-resolve cameraId from the active branch so a branch switch
      // can't keep a stale camera from the previous branch alive in cameraIdRef.
      let resolved = '';
      if (selectedBranch) {
        resolved = selectedBranch.cameras?.find((c) => c.isActive)?.id
          || selectedBranch.cameras?.[0]?.id
          || '';
        if (!resolved) {
          // Branch-scoped lookup: never leaks cameras from another branch.
          try {
            const camRes = await fetchJSON<{ id: string }[] | { cameras: { id: string }[] }>(
              `/api/cameras?branchId=${encodeURIComponent(selectedBranch.id)}`,
            );
            const list = Array.isArray(camRes) ? camRes : (camRes as any).cameras;
            if (list && list.length > 0) resolved = list[0].id;
          } catch { /* fall through to no-camera state */ }
        }
      }
      if (resolved !== cameraIdRef.current) {
        cameraIdRef.current = resolved;
        if (resolved) cameraBackendService.setCameraId(resolved);
      }

      const cameraId = cameraIdRef.current;

      // Fast endpoints first — recommendations call Ollama (slow), don't block loading on it.
      const branchQs = selectedBranch ? `&branchId=${encodeURIComponent(selectedBranch.id)}` : '';
      const branchQsLeading = selectedBranch ? `?branchId=${encodeURIComponent(selectedBranch.id)}` : '';
      const [insightsRes, unreadRes] = await Promise.allSettled([
        fetchJSON<{ insights: Insight[] }>(`/api/insights?limit=50${branchQs}`),
        fetchJSON<{ unreadCount: number }>(`/api/insights/unread-count${branchQsLeading}`),
      ]);

      setInsights(insightsRes.status === 'fulfilled' ? insightsRes.value.insights || [] : []);
      setUnreadCount(unreadRes.status === 'fulfilled' ? unreadRes.value.unreadCount || 0 : 0);

      if (cameraId) {
        const [statsRes, trendsRes] = await Promise.allSettled([
          fetchJSON<StatsResult>(`/api/insights/stats/${cameraId}?period=${period}`),
          fetchJSON<TrendAnalysis>(`/api/insights/trends/${cameraId}`),
        ]);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value);
        if (trendsRes.status === 'fulfilled') setTrends(trendsRes.value);
      }

      // Surface a soft error only if both core list calls failed
      const anySuccess = [insightsRes, unreadRes].some((r) => r.status === 'fulfilled');
      if (!anySuccess) {
        setError(t('insight.page.loadFailed') || 'Icgorii verileri alinamadi');
      }

      // Recommendations fetch in background — Ollama 26b can take 30-60s for first inference.
      fetchJSON<{ recommendations: string[]; source: string }>(
        `/api/insights/recommendations${cameraId ? `?cameraId=${cameraId}` : ''}`
      )
        .then((res) => {
          setRecommendations(res.recommendations || []);
          setRecSource(res.source || 'demo');
        })
        .catch(() => { /* keep previous recommendations */ });

      // AI summary in background — same reasoning as recommendations.
      setSummaryLoading(true);
      fetchJSON<{ tr: string; en: string; source: string }>(
        `/api/insights/summary${cameraId ? `?cameraId=${cameraId}` : ''}`
      )
        .then((res) => {
          setSummary({ tr: res.tr, en: res.en, source: res.source });
        })
        .catch(() => { /* keep previous summary */ })
        .finally(() => setSummaryLoading(false));
    } catch (err: any) {
      console.error('[AIInsightsPage] Load error:', err);
      setError(err.message || t('insight.page.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, selectedBranch?.id]);

  useEffect(() => {
    loadData(selectedPeriod);
    const interval = setInterval(() => loadData(selectedPeriod), 60000);
    return () => clearInterval(interval);
  }, [loadData, selectedPeriod]);

  useEffect(() => {
    async function fetchAIStatus() {
      try {
        const res = await fetch(`${API_URL}/api/ai/status`);
        if (res.ok) setAiStatus(await res.json());
      } catch { /* silent */ }
    }
    fetchAIStatus();
    const interval = setInterval(fetchAIStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = cameraBackendService.onZoneInsights((newInsights) => {
      setZoneInsights((prev) => {
        const merged = [...prev, ...newInsights];
        return merged.slice(-20);
      });
    });
    return () => { unsubscribe(); };
  }, []);

  const handleGenerate = async () => {
    const cameraId = cameraIdRef.current;
    if (!cameraId) {
      setError(t('insight.page.noCamera'));
      return;
    }
    setGenerating(true);
    try {
      await fetchJSON('/api/insights/generate', {
        method: 'POST',
        body: JSON.stringify({ cameraId }),
      });
      await loadData();
    } catch (err: any) {
      setError(err.message || t('insight.page.error'));
    } finally {
      setGenerating(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetchJSON(`/api/insights/${id}/read`, { method: 'PATCH' });
      setInsights(prev => prev.map(i => i.id === id ? { ...i, isRead: true } : i));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      /* silent */
    }
  };

  const filteredInsights = insights.filter(i => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return !i.isRead;
    return i.type === activeFilter;
  });

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) return `${hours}h ${remainingMinutes}m`;
    return `${minutes}m`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US');
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const insightTypeLabel = (type: string) => {
    const key = `insight.type.${type}`;
    const val = t(key);
    return val === key ? type : val;
  };

  const insightTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      crowd_surge: 'text-danger-300 bg-danger-500/20',
      occupancy_alert: 'text-warning-300 bg-warning-500/20',
      wait_time_alert: 'text-warning-300 bg-warning-500/20',
      trend: 'text-brand-300 bg-brand-500/20',
      demographic_trend: 'text-violet-300 bg-violet-500/20',
      recommendation: 'text-success-300 bg-success-500/20',
    };
    return colors[type] || 'text-ink-3 bg-surface-3/20';
  };

  const periodSubKey = selectedPeriod === 'day' ? 'insight.stats.period.day' : selectedPeriod === 'week' ? 'insight.stats.period.week' : 'insight.stats.period.month';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gradient-brand tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-400" strokeWidth={1.5} />
            {t('insight.page.title')}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-ink-3">
              {t('insight.page.intro')}
            </p>
            {aiStatus && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  aiStatus.available
                    ? 'bg-success-500/10 border-success-500/30 text-success-300'
                    : 'bg-danger-500/10 border-danger-500/30 text-danger-300'
                }`}
              >
                {aiStatus.available ? (
                  <Wifi className="w-3 h-3" strokeWidth={1.5} />
                ) : (
                  <WifiOff className="w-3 h-3" strokeWidth={1.5} />
                )}
                {aiStatus.available
                  ? aiStatus.ollama.status === 'online'
                    ? aiStatus.ollama.model
                      ? t('insight.ai.ollama', { model: aiStatus.ollama.model })
                      : t('insight.ai.ollamaDefault')
                    : t('insight.ai.gemini')
                  : t('insight.ai.offline')}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="px-2.5 py-1 bg-brand-500/20 border border-brand-500/40 rounded-full text-xs font-semibold text-brand-300 font-mono">
              {t('insight.page.unread', { n: unreadCount })}
            </span>
          )}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as 'day' | 'week' | 'month')}
            className="px-3 py-2 bg-surface-1/80 border border-white/[0.08] text-ink-2 text-sm rounded-xl hover:border-white/[0.14] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            <option value="day">{t('insight.page.today')}</option>
            <option value="week">{t('insight.page.last7')}</option>
            <option value="month">{t('insight.page.last30')}</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white text-sm font-medium rounded-xl hover:shadow-glow-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            {generating ? t('insight.page.generating') : t('insight.page.generate')}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <p className="text-sm text-danger-300 font-medium">{t('insight.page.errorTitle')}</p>
            <p className="text-xs text-danger-300/70 mt-1">{error}</p>
          </div>
          <button onClick={() => loadData(selectedPeriod)} className="ml-auto text-xs text-danger-300 hover:text-danger-200 underline">
            {t('insight.page.retry')}
          </button>
        </div>
      )}

      <div className="surface-card border border-violet-500/20 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-violet-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-violet-300" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display text-sm font-semibold text-ink-0">
                {lang === 'tr' ? 'AI Yorumu' : 'AI Summary'}
              </h3>
              {summary?.source && (
                <span className="text-[10px] uppercase tracking-wider font-mono text-ink-4">
                  {summary.source === 'ollama' ? 'Ollama' : summary.source === 'gemini' ? 'Gemini' : (lang === 'tr' ? 'Demo' : 'Demo')}
                </span>
              )}
            </div>
            {summaryLoading && !summary ? (
              <p className="text-xs text-ink-3 leading-relaxed">
                {lang === 'tr' ? 'AI özeti hazırlanıyor…' : 'Generating AI summary…'}
              </p>
            ) : summary ? (
              <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-wrap">
                {lang === 'tr' ? summary.tr : summary.en}
              </p>
            ) : (
              <p className="text-xs text-ink-4 leading-relaxed">
                {lang === 'tr' ? 'Veri yok — yeterli analiz birikmedi.' : 'No data — not enough analytics yet.'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('insight.stats.totalVisitors')}
          value={stats?.totalVisitors ?? '—'}
          icon={<Users className="w-4 h-4 text-brand-300" strokeWidth={1.5} />}
          color="bg-brand-500/20"
          sub={stats ? t(periodSubKey) : undefined}
        />
        <StatCard
          label={t('insight.stats.avgOccupancy')}
          value={stats?.avgOccupancy ?? '—'}
          icon={<BarChart3 className="w-4 h-4 text-success-300" strokeWidth={1.5} />}
          color="bg-success-500/20"
          sub={stats?.peakHour ? t('insight.stats.peakAt', { hour: stats.peakHour }) : undefined}
        />
        <StatCard
          label={t('insight.stats.peakOccupancy')}
          value={stats?.peakOccupancy ?? '—'}
          icon={<Zap className="w-4 h-4 text-warning-300" strokeWidth={1.5} />}
          color="bg-warning-500/20"
        />
        <StatCard
          label={t('insight.stats.totalAlerts')}
          value={stats?.totalAlerts ?? insights.length}
          icon={<AlertTriangle className="w-4 h-4 text-danger-300" strokeWidth={1.5} />}
          color="bg-danger-500/20"
          sub={unreadCount > 0 ? t('insight.page.unread', { n: unreadCount }) : t('insight.stats.allRead')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {zoneInsights.length > 0 && (
            <div className="surface-card border border-danger-500/20 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-danger-500/20 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-danger-300" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold text-ink-0">{t('insight.zones.title')}</h3>
                  <p className="text-xs text-ink-4">{t('insight.zones.subtitle')}</p>
                </div>
                <span className="ml-auto px-2 py-0.5 bg-danger-500/20 border border-danger-500/30 rounded-full text-xs text-danger-300 font-medium animate-pulse font-mono">
                  {t('insight.zones.live')}
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {zoneInsights.map((insight, index) => (
                  <div
                    key={`${insight.zoneId}-${insight.personId}-${index}`}
                    className="bg-danger-500/5 border border-danger-500/10 rounded-xl p-3"
                  >
                    <p className="text-sm text-ink-2">{insight.message}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-4 font-mono">
                      <span>{t('insight.zones.zone', { name: insight.zoneName })}</span>
                      <span>{t('insight.zones.duration', { time: formatDuration(insight.duration) })}</span>
                      <span>{formatTimestamp(insight.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="surface-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowFilters(s => !s)}
                  className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink-0 transition-colors"
                >
                  <Filter className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {t('insight.filter.filter')}
                </button>
                {['all', 'unread', 'crowd_surge', 'occupancy_alert', 'wait_time_alert', 'trend', 'demographic_trend'].map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      activeFilter === f
                        ? 'bg-violet-500/20 border border-violet-500/40 text-violet-300'
                        : 'bg-white/[0.04] border border-white/[0.08] text-ink-3 hover:text-ink-0 hover:border-white/[0.14]'
                    }`}
                  >
                    {f === 'all'
                      ? t('insight.filter.all')
                      : f === 'unread'
                        ? t('insight.filter.unread', { n: unreadCount })
                        : t(`insight.filter.${f}`)}
                  </button>
                ))}
              </div>
              <span className="text-xs text-ink-4 font-mono">
                {t(filteredInsights.length === 1 ? 'insight.filter.countOne' : 'insight.filter.countMany', { n: filteredInsights.length })}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="surface-card rounded-xl p-12 flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-violet-300 animate-spin mb-3" strokeWidth={1.5} />
              <p className="text-sm text-ink-3">{t('insight.list.loading')}</p>
            </div>
          ) : filteredInsights.length === 0 ? (
            <div className="surface-card rounded-xl p-12 flex flex-col items-center justify-center">
              <Sparkles className="w-10 h-10 text-ink-4 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-ink-3 mb-1">{t('insight.list.emptyTitle')}</p>
              <p className="text-xs text-ink-4">{t('insight.list.emptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={`surface-card rounded-xl p-4 transition-colors cursor-pointer hover:border-white/[0.14] ${
                    insight.isRead ? '' : 'border-violet-500/20'
                  }`}
                  onClick={() => {
                    setExpandedInsight(expandedInsight === insight.id ? null : insight.id);
                    if (!insight.isRead) markAsRead(insight.id);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${insightTypeColor(insight.type)}`}>
                      {insight.type === 'crowd_surge' && <Zap className="w-4 h-4" strokeWidth={1.5} />}
                      {insight.type === 'occupancy_alert' && <Users className="w-4 h-4" strokeWidth={1.5} />}
                      {insight.type === 'wait_time_alert' && <Clock className="w-4 h-4" strokeWidth={1.5} />}
                      {insight.type === 'trend' && <TrendingUp className="w-4 h-4" strokeWidth={1.5} />}
                      {insight.type === 'demographic_trend' && <BarChart3 className="w-4 h-4" strokeWidth={1.5} />}
                      {!['crowd_surge', 'occupancy_alert', 'wait_time_alert', 'trend', 'demographic_trend'].includes(insight.type) && (
                        <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className={`font-display text-sm font-semibold ${insight.isRead ? 'text-ink-2' : 'text-ink-0'}`}>
                          {insight.title}
                        </h4>
                        <SeverityBadge severity={insight.severity} />
                        {!insight.isRead && (
                          <span className="w-2 h-2 rounded-full bg-violet-500" />
                        )}
                      </div>
                      <p className="text-xs text-ink-3 leading-relaxed">{insight.message}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-ink-4">
                        <span className={`px-1.5 py-0.5 rounded ${insightTypeColor(insight.type)}`}>
                          {insightTypeLabel(insight.type)}
                        </span>
                        <span className="font-mono">{formatDate(insight.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {expandedInsight === insight.id ? (
                        <ChevronUp className="w-4 h-4 text-ink-4" strokeWidth={1.5} />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-ink-4" strokeWidth={1.5} />
                      )}
                    </div>
                  </div>

                  {expandedInsight === insight.id && insight.context && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06]">
                      <p className="text-xs text-ink-4 font-medium mb-2 uppercase tracking-wider">{t('insight.card.context')}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(insight.context).map(([key, value]) => (
                          <div key={key} className="bg-white/[0.04] rounded-xl px-3 py-2">
                            <p className="text-[10px] text-ink-4 uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                            <p className="text-sm text-ink-0 font-medium font-mono">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="surface-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-brand-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-brand-300" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold text-ink-0">{t('insight.peak.title')}</h3>
                <p className="text-xs text-ink-4">{trends?.periodLabel || t('insight.peak.today')}</p>
              </div>
            </div>
            {trends && trends.peakHours.length > 0 ? (
              <PeakHoursChart peakHours={trends.peakHours} quietHours={trends.quietHours} />
            ) : (
              <div className="h-28 flex items-center justify-center">
                <p className="text-xs text-ink-4">{t('insight.peak.noData')}</p>
              </div>
            )}
            {trends && trends.peakHours.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1">
                {trends.peakHours.slice(0, 3).map((ph, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-ink-3 font-mono">{t('insight.peak.rank', { n: i + 1, hour: ph.hour })}</span>
                    <span className="text-warning-300 font-medium font-mono">{t('insight.peak.avg', { n: ph.avgOccupancy })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="surface-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-violet-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-4 h-4 text-violet-300" strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-sm font-semibold text-ink-0">{t('insight.demo.title')}</h3>
            </div>
            {trends?.demographicProfile ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-ink-4 mb-2">{t('insight.demo.gender')}</p>
                  <div className="space-y-1.5">
                    {Object.entries(trends.demographicProfile.genderDistribution).map(([gender, count]) => {
                      const total = Object.values(trends.demographicProfile!.genderDistribution).reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      const label = gender === 'male' ? t('insight.demo.male') : gender === 'female' ? t('insight.demo.female') : gender;
                      return (
                        <div key={gender} className="flex items-center gap-2">
                          <span className="text-xs text-ink-3 w-16 capitalize">{label}</span>
                          <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${gender === 'male' ? 'bg-brand-500' : gender === 'female' ? 'bg-violet-500' : 'bg-surface-3'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-ink-3 w-10 text-right font-mono">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-ink-4 mb-2">{t('insight.demo.age')}</p>
                  <div className="space-y-1.5">
                    {Object.entries(trends.demographicProfile.ageDistribution)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([age, count]) => {
                        const total = Object.values(trends.demographicProfile!.ageDistribution).reduce((a, b) => a + b, 0);
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={age} className="flex items-center gap-2">
                            <span className="text-xs text-ink-3 w-16 font-mono">{age}</span>
                            <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-ink-3 w-10 text-right font-mono">{pct}%</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center">
                <p className="text-xs text-ink-4">{t('insight.demo.noData')}</p>
              </div>
            )}
          </div>

          {trends && trends.zoneComparison.length > 0 && (
            <div className="surface-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-warning-500/20 rounded-xl flex items-center justify-center">
                  <Eye className="w-4 h-4 text-warning-300" strokeWidth={1.5} />
                </div>
                <h3 className="font-display text-sm font-semibold text-ink-0">{t('insight.zoneComp.title')}</h3>
              </div>
              <div className="space-y-2">
                {trends.zoneComparison.map((zone) => (
                  <div key={zone.zoneId} className="flex items-center justify-between bg-white/[0.04] rounded-xl px-3 py-2">
                    <span className="text-xs text-ink-2">{zone.zoneName}</span>
                    <span className="text-xs text-warning-300 font-medium font-mono">{t('insight.zoneComp.alerts', { n: zone.alertCount })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="surface-card border border-violet-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-violet-500/20 rounded-xl flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-violet-300" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold text-ink-0">{t('insight.recs.title')}</h3>
                <p className="text-[10px] text-ink-4 uppercase tracking-wider">
                  {recSource === 'ollama' ? t('insight.recs.poweredOllama') : recSource === 'gemini' ? t('insight.recs.poweredGemini') : t('insight.recs.poweredOllama')}
                </p>
              </div>
            </div>
            {recommendations.length > 0 ? (
              <div className="space-y-2.5">
                {recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] text-violet-300 font-bold font-mono">{i + 1}</span>
                    </div>
                    <p className="text-xs text-ink-2 leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center">
                <p className="text-xs text-ink-4">{t('insight.recs.empty')}</p>
              </div>
            )}
          </div>

          {stats && Object.keys(stats.alertsBySeverity).length > 0 && (
            <div className="surface-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-danger-500/20 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-danger-300" strokeWidth={1.5} />
                </div>
                <h3 className="font-display text-sm font-semibold text-ink-0">{t('insight.alerts.title')}</h3>
              </div>
              <div className="space-y-2">
                {['critical', 'high', 'medium', 'low'].map(sev => {
                  const count = stats.alertsBySeverity[sev] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={sev} className="flex items-center justify-between">
                      <SeverityBadge severity={sev} />
                      <span className="text-sm text-ink-0 font-medium font-mono">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
