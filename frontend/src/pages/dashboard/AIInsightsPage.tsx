import {
  Sparkles,
  TrendingUp,
  Users,
  Clock,
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  CheckCircle,
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

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── API Helpers ─────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API Error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    critical: {
      bg: 'bg-red-500/20 border-red-500/40',
      text: 'text-red-400',
      icon: <AlertCircle className="w-3 h-3" />,
    },
    high: {
      bg: 'bg-orange-500/20 border-orange-500/40',
      text: 'text-orange-400',
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    medium: {
      bg: 'bg-yellow-500/20 border-yellow-500/40',
      text: 'text-yellow-400',
      icon: <Info className="w-3 h-3" />,
    },
    low: {
      bg: 'bg-blue-500/20 border-blue-500/40',
      text: 'text-blue-400',
      icon: <Info className="w-3 h-3" />,
    },
  };
  const c = config[severity] || config.low;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text}`}>
      {c.icon}
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
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
    <div className="bg-[#0f1117]/80 backdrop-blur-sm border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function PeakHoursChart({ peakHours, quietHours }: { peakHours: TrendAnalysis['peakHours']; quietHours: TrendAnalysis['quietHours'] }) {
  const allHours = [...peakHours, ...quietHours].sort((a, b) => a.hour - b.hour);
  const maxOcc = Math.max(...allHours.map(h => h.avgOccupancy), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Peak</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Quiet</span>
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
                className={`w-full rounded-t transition-all ${
                  isPeak ? 'bg-orange-500/70' : isQuiet ? 'bg-emerald-500/50' : 'bg-white/10'
                }`}
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
              {h % 4 === 0 && (
                <span className="text-[9px] text-gray-600">{h}:00</span>
              )}
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                {h}:00 — {occ.toFixed(1)} avg
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AIInsightsPage() {
  // Zone insights (real-time from Socket.IO)
  const [zoneInsights, setZoneInsights] = useState<ZoneInsight[]>([]);

  // Backend data
  const [insights, setInsights] = useState<Insight[]>([]);
  const [trends, setTrends] = useState<TrendAnalysis | null>(null);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [recSource, setRecSource] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState(0);

  // AI status
  const [aiStatus, setAiStatus] = useState<{
    provider: string;
    ollama: { status: string; model: string | null };
    available: boolean;
  } | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  // Period selector — matches "Last 30 days" dropdown in top nav
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('month');

  // We use a default cameraId — in future this will come from route or context
  const cameraIdRef = useRef<string>('');

  // ── Load all data (kamera ID'sini de burada fetch ediyor) ──
  const loadData = useCallback(async (period: 'day' | 'week' | 'month' = 'month') => {
    setLoading(true);
    setError(null);
    try {
      // Kamera ID'sini önce al (henüz yoksa)
      if (!cameraIdRef.current) {
        try {
          // Backend /api/cameras düz array döndürüyor: [{id, name, ...}, ...]
          const camRes = await fetchJSON<{ id: string }[] | { cameras: { id: string }[] }>('/api/cameras');
          const list = Array.isArray(camRes) ? camRes : (camRes as any).cameras;
          if (list && list.length > 0) {
            cameraIdRef.current = list[0].id;
            // Tell the backend service which camera ID to use for analytics persistence
            cameraBackendService.setCameraId(list[0].id);
          }
        } catch {
          // Kamera olmadan da bazı endpointler çalışır
        }
      }

      const cameraId = cameraIdRef.current;

      // Insights listesi, okunmamış sayısı ve öneriler paralel çalışır
      const [insightsRes, unreadRes, recsRes] = await Promise.all([
        fetchJSON<{ insights: Insight[] }>(`/api/insights?limit=50`),
        fetchJSON<{ unreadCount: number }>(`/api/insights/unread-count`),
        fetchJSON<{ recommendations: string[]; source: string }>(`/api/insights/recommendations${cameraId ? `?cameraId=${cameraId}` : ''}`),
      ]);

      setInsights(insightsRes.insights || []);
      setUnreadCount(unreadRes.unreadCount || 0);
      setRecommendations(recsRes.recommendations || []);
      setRecSource(recsRes.source || 'demo');

      // Kameraya özel verileri al
      if (cameraId) {
        const [statsRes, trendsRes] = await Promise.all([
          fetchJSON<StatsResult>(`/api/insights/stats/${cameraId}?period=${period}`),
          fetchJSON<TrendAnalysis>(`/api/insights/trends/${cameraId}`),
        ]);
        setStats(statsRes);
        setTrends(trendsRes);
      }
    } catch (err: any) {
      console.error('[AIInsightsPage] Load error:', err);
      setError(err.message || 'Failed to load insights data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedPeriod);
    // Refresh every 60 seconds
    const interval = setInterval(() => loadData(selectedPeriod), 60000);
    return () => clearInterval(interval);
  }, [loadData, selectedPeriod]);

  // Fetch AI provider status
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

  // ── Socket.IO zone insights ──
  useEffect(() => {
    const unsubscribe = cameraBackendService.onZoneInsights((newInsights) => {
      setZoneInsights((prev) => {
        const merged = [...prev, ...newInsights];
        return merged.slice(-20);
      });
    });
    return () => { unsubscribe(); };
  }, []);

  // ── Generate insights on demand ──
  const handleGenerate = async () => {
    const cameraId = cameraIdRef.current;
    if (!cameraId) {
      setError('No camera found. Please configure a camera first.');
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
      setError(err.message || 'Failed to generate insights');
    } finally {
      setGenerating(false);
    }
  };

  // ── Mark insight as read ──
  const markAsRead = async (id: string) => {
    try {
      await fetchJSON(`/api/insights/${id}/read`, { method: 'PATCH' });
      setInsights(prev => prev.map(i => i.id === id ? { ...i, isRead: true } : i));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Silent fail
    }
  };

  // ── Filter insights ──
  const filteredInsights = insights.filter(i => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return !i.isRead;
    return i.type === activeFilter;
  });

  // ── Format helpers ──
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) return `${hours}h ${remainingMinutes}m`;
    return `${minutes}m`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const insightTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      crowd_surge: 'Crowd Surge',
      occupancy_alert: 'Occupancy Alert',
      wait_time_alert: 'Wait Time',
      trend: 'Trend',
      demographic_trend: 'Demographics',
      recommendation: 'Recommendation',
    };
    return labels[type] || type;
  };

  const insightTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      crowd_surge: 'text-red-400 bg-red-500/20',
      occupancy_alert: 'text-orange-400 bg-orange-500/20',
      wait_time_alert: 'text-yellow-400 bg-yellow-500/20',
      trend: 'text-blue-400 bg-blue-500/20',
      demographic_trend: 'text-purple-400 bg-purple-500/20',
      recommendation: 'text-emerald-400 bg-emerald-500/20',
    };
    return colors[type] || 'text-gray-400 bg-gray-500/20';
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            AI Insights
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-gray-400">
              Intelligent alerts, trend analysis, and AI-powered recommendations
            </p>
            {aiStatus && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  aiStatus.available
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
              >
                {aiStatus.available ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
                {aiStatus.available
                  ? aiStatus.ollama.status === 'online'
                    ? `Ollama: ${aiStatus.ollama.model || 'connected'}`
                    : 'Gemini'
                  : 'AI Offline'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="px-2.5 py-1 bg-blue-500/20 border border-blue-500/40 rounded-full text-xs font-semibold text-blue-400">
              {unreadCount} unread
            </span>
          )}
          {/* Period selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as 'day' | 'week' | 'month')}
            className="px-3 py-2 bg-[#1a1b26] border border-gray-700 text-gray-300 text-sm rounded-lg hover:border-gray-600 transition-colors cursor-pointer"
          >
            <option value="day">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 border border-purple-500/40 text-purple-400 text-sm font-medium rounded-lg hover:bg-purple-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : 'Generate Insights'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400 font-medium">Error loading insights</p>
            <p className="text-xs text-red-400/70 mt-1">{error}</p>
          </div>
          <button onClick={() => loadData(selectedPeriod)} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">
            Retry
          </button>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Visitors"
          value={stats?.totalVisitors ?? '—'}
          icon={<Users className="w-4 h-4 text-blue-400" />}
          color="bg-blue-500/20"
          sub={stats ? `${stats.period} period` : undefined}
        />
        <StatCard
          label="Avg Occupancy"
          value={stats?.avgOccupancy ?? '—'}
          icon={<BarChart3 className="w-4 h-4 text-emerald-400" />}
          color="bg-emerald-500/20"
          sub={stats?.peakHour ? `Peak at ${stats.peakHour}` : undefined}
        />
        <StatCard
          label="Peak Occupancy"
          value={stats?.peakOccupancy ?? '—'}
          icon={<Zap className="w-4 h-4 text-orange-400" />}
          color="bg-orange-500/20"
        />
        <StatCard
          label="Total Alerts"
          value={stats?.totalAlerts ?? insights.length}
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          color="bg-red-500/20"
          sub={unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
        />
      </div>

      {/* Main Grid: Left = Insights Feed, Right = Trends + Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Insights Feed (2 cols) ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Zone Occupancy Alerts (real-time) */}
          {zoneInsights.length > 0 && (
            <div className="bg-[#0f1117]/80 backdrop-blur-sm border border-red-500/20 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Live Zone Alerts</h3>
                  <p className="text-xs text-gray-500">Real-time zone occupancy warnings</p>
                </div>
                <span className="ml-auto px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded-full text-xs text-red-400 font-medium animate-pulse">
                  LIVE
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {zoneInsights.map((insight, index) => (
                  <div
                    key={`${insight.zoneId}-${insight.personId}-${index}`}
                    className="bg-red-500/5 border border-red-500/10 rounded-lg p-3"
                  >
                    <p className="text-sm text-gray-300">{insight.message}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                      <span>Zone: {insight.zoneName}</span>
                      <span>Duration: {formatDuration(insight.duration)}</span>
                      <span>{formatTimestamp(insight.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="bg-[#0f1117]/80 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filter
                  {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {['all', 'unread', 'crowd_surge', 'occupancy_alert', 'wait_time_alert', 'trend', 'demographic_trend'].map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      activeFilter === f
                        ? 'bg-purple-500/20 border border-purple-500/40 text-purple-400'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'unread' ? `Unread (${unreadCount})` : insightTypeLabel(f)}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-500">
                {filteredInsights.length} insight{filteredInsights.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Insights List */}
          {loading ? (
            <div className="bg-[#0f1117]/80 backdrop-blur-sm border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-3" />
              <p className="text-sm text-gray-400">Loading insights...</p>
            </div>
          ) : filteredInsights.length === 0 ? (
            <div className="bg-[#0f1117]/80 backdrop-blur-sm border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center">
              <Sparkles className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-sm text-gray-400 mb-1">No insights yet</p>
              <p className="text-xs text-gray-600">Click "Generate Insights" to analyze current data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={`bg-[#0f1117]/80 backdrop-blur-sm border rounded-xl p-4 transition-all cursor-pointer hover:border-white/20 ${
                    insight.isRead ? 'border-white/5' : 'border-purple-500/20'
                  }`}
                  onClick={() => {
                    setExpandedInsight(expandedInsight === insight.id ? null : insight.id);
                    if (!insight.isRead) markAsRead(insight.id);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${insightTypeColor(insight.type)}`}>
                      {insight.type === 'crowd_surge' && <Zap className="w-4 h-4" />}
                      {insight.type === 'occupancy_alert' && <Users className="w-4 h-4" />}
                      {insight.type === 'wait_time_alert' && <Clock className="w-4 h-4" />}
                      {insight.type === 'trend' && <TrendingUp className="w-4 h-4" />}
                      {insight.type === 'demographic_trend' && <BarChart3 className="w-4 h-4" />}
                      {!['crowd_surge', 'occupancy_alert', 'wait_time_alert', 'trend', 'demographic_trend'].includes(insight.type) && (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className={`text-sm font-semibold ${insight.isRead ? 'text-gray-300' : 'text-white'}`}>
                          {insight.title}
                        </h4>
                        <SeverityBadge severity={insight.severity} />
                        {!insight.isRead && (
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">{insight.message}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                        <span className={`px-1.5 py-0.5 rounded ${insightTypeColor(insight.type)}`}>
                          {insightTypeLabel(insight.type)}
                        </span>
                        <span>{formatDate(insight.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {expandedInsight === insight.id ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </div>

                  {/* Expanded context */}
                  {expandedInsight === insight.id && insight.context && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <p className="text-xs text-gray-500 font-medium mb-2">Context Data</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(insight.context).map(([key, value]) => (
                          <div key={key} className="bg-white/5 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-gray-500 uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                            <p className="text-sm text-white font-medium">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
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

        {/* ── Right Column: Trends + Recommendations ── */}
        <div className="space-y-4">
          {/* Peak Hours Chart */}
          <div className="bg-[#0f1117]/80 backdrop-blur-sm border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Peak Hours</h3>
                <p className="text-xs text-gray-500">{trends?.periodLabel || 'Today'}</p>
              </div>
            </div>
            {trends && trends.peakHours.length > 0 ? (
              <PeakHoursChart peakHours={trends.peakHours} quietHours={trends.quietHours} />
            ) : (
              <div className="h-28 flex items-center justify-center">
                <p className="text-xs text-gray-600">No trend data available yet</p>
              </div>
            )}
            {trends && trends.peakHours.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                {trends.peakHours.slice(0, 3).map((ph, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Peak #{i + 1}: {ph.hour}:00</span>
                    <span className="text-orange-400 font-medium">{ph.avgOccupancy} avg</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Demographics */}
          <div className="bg-[#0f1117]/80 backdrop-blur-sm border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Demographics</h3>
            </div>
            {trends?.demographicProfile ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Gender Distribution</p>
                  <div className="space-y-1.5">
                    {Object.entries(trends.demographicProfile.genderDistribution).map(([gender, count]) => {
                      const total = Object.values(trends.demographicProfile!.genderDistribution).reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={gender} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-16 capitalize">{gender}</span>
                          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${gender === 'male' ? 'bg-blue-500' : gender === 'female' ? 'bg-pink-500' : 'bg-gray-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Age Distribution</p>
                  <div className="space-y-1.5">
                    {Object.entries(trends.demographicProfile.ageDistribution)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([age, count]) => {
                        const total = Object.values(trends.demographicProfile!.ageDistribution).reduce((a, b) => a + b, 0);
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={age} className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-16">{age}</span>
                            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center">
                <p className="text-xs text-gray-600">No demographic data available</p>
              </div>
            )}
          </div>

          {/* Zone Comparison */}
          {trends && trends.zoneComparison.length > 0 && (
            <div className="bg-[#0f1117]/80 backdrop-blur-sm border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <Eye className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">Zone Activity</h3>
              </div>
              <div className="space-y-2">
                {trends.zoneComparison.map((zone) => (
                  <div key={zone.zoneId} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-300">{zone.zoneName}</span>
                    <span className="text-xs text-amber-400 font-medium">{zone.alertCount} alerts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Recommendations */}
          <div className="bg-[#0f1117]/80 backdrop-blur-sm border border-purple-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">AI Recommendations</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                  {recSource === 'ollama' ? 'Powered by Ollama' : recSource === 'gemini' ? 'Powered by Gemini' : 'Demo Mode'}
                </p>
              </div>
            </div>
            {recommendations.length > 0 ? (
              <div className="space-y-2.5">
                {recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] text-purple-400 font-bold">{i + 1}</span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center">
                <p className="text-xs text-gray-600">Generate insights to see recommendations</p>
              </div>
            )}
          </div>

          {/* Alerts by Severity */}
          {stats && Object.keys(stats.alertsBySeverity).length > 0 && (
            <div className="bg-[#0f1117]/80 backdrop-blur-sm border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">Alerts by Severity</h3>
              </div>
              <div className="space-y-2">
                {['critical', 'high', 'medium', 'low'].map(sev => {
                  const count = stats.alertsBySeverity[sev] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={sev} className="flex items-center justify-between">
                      <SeverityBadge severity={sev} />
                      <span className="text-sm text-white font-medium">{count}</span>
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
