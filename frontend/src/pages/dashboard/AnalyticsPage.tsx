import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { motion } from 'framer-motion';
import {
  Users,
  Clock,
  TrendingUp,
  Sparkles,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Wifi,
  WifiOff,
  Lightbulb,
  Calendar,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  ChevronDown,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDashboardFilter } from '../../contexts/DashboardFilterContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Range = '1h' | '1d' | '1w' | '1m' | '3m';

interface OverviewKpis {
  totalVisitors: number;
  avgOccupancy: number;
  peakOccupancy: number;
  peakHour: string | null;
}

interface TimelinePoint {
  ts: string;
  label: string;
  visitors: number;
  occupancy: number;
  hour?: number;
}

interface PeakHourEntry { hour: number; avg: number; }

interface WeekdayCompareEntry {
  weekday: number;
  thisWeek: number[];
  lastWeek: number[];
  thisWeekTotal: number;
  lastWeekTotal: number;
  changePercent: number | null;
}

interface DemographicsSnap {
  gender: { male: number; female: number; unknown: number };
  age: Record<string, number>;
  samples: number;
}

interface CompareBlock {
  current: { visitors: number; avgOccupancy: number };
  previous: { visitors: number; avgOccupancy: number };
  delta: { visitors: number | null; avgOccupancy: number | null };
  previousLabel: string;
}

interface PredictionBlock {
  date: string;
  weekday: number;
  hourlyPrediction: Array<{ hour: number; predicted: number }>;
  confidence: number;
  dataWeeks: number;
}

interface OverviewResponse {
  range: Range;
  rangeStart: string;
  rangeEnd: string;
  hasData: boolean;
  dataSource: 'logs' | 'summary';
  kpis: OverviewKpis;
  timeline: TimelinePoint[];
  peakHours: PeakHourEntry[];
  weekdayCompare: WeekdayCompareEntry[] | null;
  demographics: DemographicsSnap | null;
  compare: CompareBlock;
  prediction: PredictionBlock | null;
}

interface AISummary { tr: string; en: string; source: string; }

const RANGE_OPTIONS: { key: Range; labelKey: string }[] = [
  { key: '1h', labelKey: 'analytics.range.1h' },
  { key: '1d', labelKey: 'analytics.range.1d' },
  { key: '1w', labelKey: 'analytics.range.1w' },
  { key: '1m', labelKey: 'analytics.range.1m' },
  { key: '3m', labelKey: 'analytics.range.3m' },
];

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

function DeltaBadge({ value }: { value: number | null }) {
  const has = typeof value === 'number' && Number.isFinite(value);
  const positive = has && (value as number) > 0;
  const negative = has && (value as number) < 0;
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded-full font-mono ${
        positive
          ? 'text-success-300 bg-success-500/15 border border-success-500/30'
          : negative
            ? 'text-danger-300 bg-danger-500/15 border border-danger-500/30'
            : 'text-ink-3 bg-white/[0.04] border border-white/[0.08]'
      }`}
      title={has ? undefined : 'No prior baseline'}
    >
      {positive ? <ArrowUpRight className="w-3 h-3 mr-0.5" strokeWidth={1.5} /> : negative ? <ArrowDownRight className="w-3 h-3 mr-0.5" strokeWidth={1.5} /> : null}
      {has ? `${Math.abs(value as number)}%` : '—'}
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
  delta,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  delta?: number | null;
  sub?: string;
}) {
  return (
    <div className="surface-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
        {delta !== undefined && <DeltaBadge value={delta} />}
      </div>
      <p className="font-display text-2xl font-bold text-ink-0 font-mono">{value}</p>
      <p className="text-xs text-ink-3 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-ink-4 mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyState({ title, hint, icon }: { title: string; hint: string; icon: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="surface-card rounded-2xl p-10 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500/10 mb-4">{icon}</div>
      <p className="text-ink-1 font-medium">{title}</p>
      <p className="text-sm text-ink-3 mt-1 max-w-md mx-auto">{hint}</p>
    </motion.div>
  );
}

export default function AnalyticsPage() {
  const { t, lang } = useLanguage();
  // Yan #38: dateRange now lives in DashboardFilterContext + localStorage so
  // navigating away and back preserves the selection.
  const { selectedBranch, dateRange: range, setDateRange: setRange } = useDashboardFilter();

  const [cameraId, setCameraId] = useState('');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [recSource, setRecSource] = useState<string>('');
  const [aiStatus, setAiStatus] = useState<{ available: boolean; ollama: { status: string; model: string | null } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Yan #43: user-controlled export row cap. UI default 1000 (cheap), ceiling
  // 10000 (matches backend ExportRequestSchema.limit.max), 'all' omits the
  // query param so the backend default takes over.
  const [exportLimit, setExportLimit] = useState<'1000' | '5000' | '10000' | 'all'>('1000');

  const aiAbortRef = useRef<AbortController | null>(null);

  // Resolve camera from active branch — never leak across branches
  useEffect(() => {
    if (!selectedBranch) { setCameraId(''); return; }
    const cams = selectedBranch.cameras || [];
    if (cams.length === 0) { setCameraId(''); return; }
    const active = cams.find((c) => c.isActive) || cams[0];
    setCameraId(active.id);
  }, [selectedBranch]);

  // AI status poll
  useEffect(() => {
    let cancelled = false;
    async function fetchStatus() {
      try {
        const res = await fetch(`${API_URL}/api/ai/status`, { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setAiStatus(data);
      } catch { /* silent */ }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const loadOverview = useCallback(async (camId: string, r: Range) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJSON<OverviewResponse>(`/api/analytics/${camId}/overview?range=${r}`);
      setOverview(data);
    } catch (e: any) {
      setError(e.message || 'Yükleme hatası');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAI = useCallback(async (camId: string) => {
    if (aiAbortRef.current) aiAbortRef.current.abort();
    const ctrl = new AbortController();
    aiAbortRef.current = ctrl;
    setAiLoading(true);
    try {
      const [summaryRes, recsRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/insights/summary?cameraId=${camId}`, { credentials: 'include', signal: ctrl.signal }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_URL}/api/insights/recommendations?cameraId=${camId}`, { credentials: 'include', signal: ctrl.signal }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        setAiSummary({ tr: summaryRes.value.tr, en: summaryRes.value.en, source: summaryRes.value.source });
      }
      if (recsRes.status === 'fulfilled' && recsRes.value) {
        setRecommendations(recsRes.value.recommendations || []);
        setRecSource(recsRes.value.source || '');
      }
    } catch { /* aborted */ } finally {
      if (!ctrl.signal.aborted) setAiLoading(false);
    }
  }, []);

  // Load overview on camera/range change
  useEffect(() => {
    if (!cameraId) return;
    loadOverview(cameraId, range);
  }, [cameraId, range, loadOverview]);

  // Load AI summary + recommendations on camera change (slow Ollama, separate)
  useEffect(() => {
    if (!cameraId) { setAiSummary(null); setRecommendations([]); return; }
    loadAI(cameraId);
    const interval = setInterval(() => loadAI(cameraId), 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [cameraId, loadAI]);

  // Auto-refresh overview for live ranges
  useEffect(() => {
    if (!cameraId) return;
    const refreshMs = range === '1h' ? 30000 : range === '1d' ? 60000 : 300000;
    const interval = setInterval(() => loadOverview(cameraId, range), refreshMs);
    return () => clearInterval(interval);
  }, [cameraId, range, loadOverview]);

  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const weekdayLabels = useMemo(() => [0, 1, 2, 3, 4, 5, 6].map((i) => t(`common.weekday.short.${i}`)), [t]);

  // ─── Charts ────────────────────────────────────────────────────────────────
  const timelineOption = useMemo(() => {
    if (!overview || overview.timeline.length === 0) return null;
    return {
      grid: { left: 44, right: 16, top: 20, bottom: 28 },
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: '#0b1020',
        borderColor: '#1d6bff40',
        textStyle: { color: '#fff', fontSize: 11 },
      },
      xAxis: {
        type: 'category' as const,
        data: overview.timeline.map((p) => p.label),
        axisLine: { lineStyle: { color: '#1f2937' } },
        axisLabel: { color: '#64748b', fontSize: 10 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748b', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      series: [
        {
          name: t('analytics.chart.visitors'),
          type: 'line' as const,
          smooth: true,
          data: overview.timeline.map((p) => p.visitors),
          areaStyle: {
            color: {
              type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(29,107,255,0.45)' },
                { offset: 1, color: 'rgba(29,107,255,0.02)' },
              ],
            },
          },
          lineStyle: { width: 2.5, color: '#1d6bff' },
          itemStyle: { color: '#1d6bff' },
        },
      ],
    };
  }, [overview, t]);

  const predictionOption = useMemo(() => {
    if (!overview?.prediction) return null;
    return {
      grid: { left: 44, right: 16, top: 14, bottom: 28 },
      tooltip: { trigger: 'axis' as const, backgroundColor: '#0b1020', borderColor: '#8b5cf640' },
      xAxis: {
        type: 'category' as const,
        data: overview.prediction.hourlyPrediction.map((h) => `${String(h.hour).padStart(2, '0')}:00`),
        axisLine: { lineStyle: { color: '#1f2937' } },
        axisLabel: { color: '#64748b', fontSize: 10 },
      },
      yAxis: {
        type: 'value' as const, axisLabel: { color: '#64748b', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      series: [{
        type: 'bar' as const,
        data: overview.prediction.hourlyPrediction.map((h) => h.predicted),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: {
            type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#8b5cf6' },
              { offset: 1, color: '#8b5cf640' },
            ],
          },
        },
      }],
    };
  }, [overview]);

  // ─── Render ────────────────────────────────────────────────────────────────
  const showWeekdayBlock = overview?.weekdayCompare && overview.weekdayCompare.some((w) => w.thisWeekTotal > 0 || w.lastWeekTotal > 0);
  const showPrediction = overview?.prediction && overview.prediction.dataWeeks > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gradient-brand tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-400" strokeWidth={1.5} />
            {t('analytics.page.title')}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-ink-3">{t('analytics.page.subtitle')}</p>
            {aiStatus && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  aiStatus.available
                    ? 'bg-success-500/10 border-success-500/30 text-success-300'
                    : 'bg-danger-500/10 border-danger-500/30 text-danger-300'
                }`}
              >
                {aiStatus.available ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
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
          <div className="inline-flex rounded-xl border border-white/[0.08] overflow-hidden bg-surface-2/70 backdrop-blur-sm">
            {RANGE_OPTIONS.map((opt) => {
              const active = range === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setRange(opt.key)}
                  className={`px-3 py-2 text-xs font-medium font-mono transition-colors ${
                    active
                      ? 'bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-glow-brand'
                      : 'text-ink-2 hover:text-ink-0 hover:bg-white/[0.04]'
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>
          {/* Yan #43: export row-cap selector. Persists per-tab session only;
              the export dropdown (Yan #55) reads this directly. */}
          <select
            data-testid="export-limit-select"
            value={exportLimit}
            onChange={(e) => setExportLimit(e.target.value as '1000' | '5000' | '10000' | 'all')}
            className="px-2 py-2 text-xs bg-surface-2/70 border border-white/[0.08] rounded-xl text-ink-1 hover:border-brand-500/40 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            aria-label={t('export.limit.label')}
          >
            <option value="1000">{t('export.limit.1000')}</option>
            <option value="5000">{t('export.limit.5000')}</option>
            <option value="10000">{t('export.limit.10000')}</option>
            <option value="all">{t('export.limit.all')}</option>
          </select>
          <button
            onClick={() => { if (cameraId) { loadOverview(cameraId, range); loadAI(cameraId); } }}
            disabled={loading}
            className="p-2 text-ink-3 hover:text-ink-0 hover:bg-white/[0.06] rounded-xl transition-colors border border-white/[0.08]"
            title={t('common.refresh')}
          >
            <RefreshCw strokeWidth={1.5} className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* No camera */}
      {!cameraId ? (
        <EmptyState
          title={t('analytics.empty.noCamera.title')}
          hint={t('analytics.empty.noCamera.hint')}
          icon={<AlertCircle className="w-7 h-7 text-warning-300" />}
        />
      ) : error ? (
        <EmptyState
          title={t('analytics.empty.error.title')}
          hint={error}
          icon={<AlertCircle className="w-7 h-7 text-danger-300" />}
        />
      ) : loading && !overview ? (
        <div className="text-center py-14 text-ink-3">{t('common.loading')}</div>
      ) : !overview?.hasData ? (
        <EmptyState
          title={t('analytics.empty.noData.title')}
          hint={t('analytics.empty.noData.hint')}
          icon={<TrendingUp className="w-7 h-7 text-brand-300" />}
        />
      ) : (
        <>
          {/* AI Summary */}
          <div className="surface-card border border-violet-500/20 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-violet-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-violet-300" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-display text-sm font-semibold text-ink-0">{t('analytics.ai.summary')}</h3>
                  {aiSummary?.source && (
                    <span className="text-[10px] uppercase tracking-wider font-mono text-ink-4">
                      {aiSummary.source === 'ollama' ? 'Ollama' : aiSummary.source === 'gemini' ? 'Gemini' : t('common.demo')}
                    </span>
                  )}
                </div>
                {aiLoading && !aiSummary ? (
                  <p className="text-xs text-ink-3">{t('analytics.ai.generating')}</p>
                ) : aiSummary ? (
                  <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-wrap">{lang === 'tr' ? aiSummary.tr : aiSummary.en}</p>
                ) : (
                  <p className="text-xs text-ink-4">{t('analytics.ai.empty')}</p>
                )}
              </div>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label={t('analytics.kpi.totalVisitors')}
              value={overview.kpis.totalVisitors.toLocaleString(locale)}
              icon={<Users className="w-4 h-4 text-brand-300" strokeWidth={1.5} />}
              color="bg-brand-500/15"
              delta={overview.compare.delta.visitors}
              sub={t(`analytics.compare.${overview.compare.previousLabel}`)}
            />
            <KpiCard
              label={t('analytics.kpi.avgOccupancy')}
              value={overview.kpis.avgOccupancy.toString()}
              icon={<BarChart3 className="w-4 h-4 text-success-300" strokeWidth={1.5} />}
              color="bg-success-500/15"
              delta={overview.compare.delta.avgOccupancy}
            />
            <KpiCard
              label={t('analytics.kpi.peakOccupancy')}
              value={overview.kpis.peakOccupancy.toString()}
              icon={<Zap className="w-4 h-4 text-warning-300" strokeWidth={1.5} />}
              color="bg-warning-500/15"
            />
            <KpiCard
              label={t('analytics.kpi.peakHour')}
              value={overview.kpis.peakHour ?? '—'}
              icon={<Clock className="w-4 h-4 text-violet-300" strokeWidth={1.5} />}
              color="bg-violet-500/15"
            />
          </div>

          {/* Main timeline + side panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Timeline chart */}
            <div className="lg:col-span-2 surface-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-brand-300" strokeWidth={1.5} />
                <h3 className="font-semibold text-ink-0 text-sm">{t(`analytics.chart.title.${overview.range}`)}</h3>
              </div>
              {timelineOption ? (
                <ReactECharts option={timelineOption} style={{ height: '280px' }} notMerge lazyUpdate />
              ) : (
                <p className="text-sm text-ink-4 text-center py-12">{t('analytics.chart.noData')}</p>
              )}
            </div>

            {/* Side: peak hours + demographics */}
            <div className="space-y-4">
              {/* Peak hours */}
              <div className="surface-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-warning-300" strokeWidth={1.5} />
                  <h3 className="font-semibold text-ink-0 text-sm">{t('analytics.peak.title')}</h3>
                </div>
                {overview.peakHours.length === 0 ? (
                  <p className="text-xs text-ink-4">{t('analytics.peak.empty')}</p>
                ) : (
                  <div className="space-y-2">
                    {overview.peakHours.map((p, i) => {
                      const max = Math.max(1, ...overview.peakHours.map((x) => x.avg));
                      return (
                        <motion.div
                          key={p.hour}
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-3"
                        >
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-warning-500/15 text-warning-300 font-bold text-xs font-mono">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono font-semibold text-ink-0 text-sm">{String(p.hour).padStart(2, '0')}:00</span>
                              <span className="text-[11px] text-ink-3 font-mono">{p.avg}</span>
                            </div>
                            <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(p.avg / max) * 100}%` }}
                                transition={{ duration: 0.6, delay: 0.15 + i * 0.08 }}
                                className="h-full bg-gradient-to-r from-warning-500 to-warning-400 rounded-full"
                              />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Demographics */}
              <div className="surface-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-violet-300" strokeWidth={1.5} />
                  <h3 className="font-semibold text-ink-0 text-sm">{t('analytics.demo.title')}</h3>
                </div>
                {!overview.demographics ? (
                  <p className="text-xs text-ink-4">{t('analytics.demo.empty')}</p>
                ) : (() => {
                  const d = overview.demographics;
                  const gTot = d.gender.male + d.gender.female + d.gender.unknown;
                  const malePct = gTot > 0 ? Math.round((d.gender.male / gTot) * 100) : 0;
                  const femalePct = gTot > 0 ? Math.round((d.gender.female / gTot) * 100) : 0;
                  const ageEntries = Object.entries(d.age).filter(([, v]) => v > 0);
                  const ageOrder = ['0-17', '18-24', '25-34', '35-44', '45-54', '55-64', '55+', '65+'];
                  ageEntries.sort((a, b) => {
                    const ai = ageOrder.indexOf(a[0]); const bi = ageOrder.indexOf(b[0]);
                    if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
                    if (ai === -1) return 1; if (bi === -1) return -1;
                    return ai - bi;
                  });
                  const ageTotal = ageEntries.reduce((s, [, v]) => s + v, 0);
                  return (
                    <div className="space-y-3">
                      {gTot > 0 && (
                        <div>
                          <p className="text-[11px] text-ink-4 mb-1.5">{t('analytics.demo.gender')}</p>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-ink-3 w-12">{t('analytics.demo.male')}</span>
                              <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500" style={{ width: `${malePct}%` }} />
                              </div>
                              <span className="text-xs text-ink-3 w-9 text-right font-mono">{malePct}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-ink-3 w-12">{t('analytics.demo.female')}</span>
                              <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500" style={{ width: `${femalePct}%` }} />
                              </div>
                              <span className="text-xs text-ink-3 w-9 text-right font-mono">{femalePct}%</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {ageEntries.length > 0 && (
                        <div>
                          <p className="text-[11px] text-ink-4 mb-1.5">{t('analytics.demo.age')}</p>
                          <div className="space-y-1">
                            {ageEntries.map(([k, v]) => {
                              const pct = ageTotal > 0 ? Math.round((v / ageTotal) * 100) : 0;
                              return (
                                <div key={k} className="flex items-center gap-2">
                                  <span className="text-[11px] text-ink-3 w-12 font-mono">{k}</span>
                                  <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-brand-500 to-accent-500" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[11px] text-ink-3 w-9 text-right font-mono">{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Weekday compare (only ≥1w) */}
          {showWeekdayBlock && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="surface-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-brand-300" strokeWidth={1.5} />
                <h3 className="font-semibold text-ink-0 text-sm">{t('analytics.weekday.title')}</h3>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {overview.weekdayCompare!.map((w) => {
                  const change = w.changePercent;
                  const positive = change !== null && change > 0;
                  const negative = change !== null && change < 0;
                  return (
                    <div key={w.weekday} className="surface-card rounded-xl p-3 border border-white/[0.06]">
                      <p className="text-[11px] text-ink-3 font-mono uppercase tracking-wider mb-1">{weekdayLabels[w.weekday]}</p>
                      <p className="font-mono font-bold text-ink-0 text-base">{w.thisWeekTotal}</p>
                      <p className="text-[10px] text-ink-4 font-mono">vs {w.lastWeekTotal}</p>
                      <p className={`text-[11px] font-mono mt-1 ${positive ? 'text-success-400' : negative ? 'text-danger-400' : 'text-ink-4'}`}>
                        {change === null ? '—' : `${positive ? '+' : ''}${change}%`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Tomorrow prediction (only ≥1w) */}
          {showPrediction && predictionOption && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="surface-card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-300" strokeWidth={1.5} />
                  <h3 className="font-semibold text-ink-0 text-sm">
                    {t('analytics.prediction.title')} — {overview.prediction!.date} ({t(`common.weekday.${overview.prediction!.weekday}`)})
                  </h3>
                </div>
                <div className="text-xs text-ink-3 font-mono">
                  {t('analytics.prediction.confidence')}: <span className="text-violet-300">{Math.round(overview.prediction!.confidence)}%</span> · {t('analytics.prediction.weeksData', { n: overview.prediction!.dataWeeks })}
                </div>
              </div>
              <ReactECharts option={predictionOption} style={{ height: '200px' }} notMerge lazyUpdate />
            </motion.div>
          )}

          {/* Recommendations */}
          <div className="surface-card border border-violet-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-violet-300" strokeWidth={1.5} />
              <h3 className="font-semibold text-ink-0 text-sm">{t('analytics.recs.title')}</h3>
              {recSource && (
                <span className="text-[10px] uppercase tracking-wider font-mono text-ink-4 ml-1">
                  {recSource === 'ollama' ? 'Ollama' : recSource === 'gemini' ? 'Gemini' : t('common.demo')}
                </span>
              )}
            </div>
            {aiLoading && recommendations.length === 0 ? (
              <p className="text-xs text-ink-3">{t('analytics.ai.generating')}</p>
            ) : recommendations.length === 0 ? (
              <p className="text-xs text-ink-4">{t('analytics.recs.empty')}</p>
            ) : (
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
            )}
          </div>

          {/* Daily table for ≥1m ranges */}
          {(range === '1m' || range === '3m') && overview.timeline.length > 0 && (
            <div className="surface-card rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h3 className="font-semibold text-ink-0 text-sm">{t('analytics.table.title')}</h3>
              </div>
              <div className="overflow-x-auto max-h-96 custom-scrollbar">
                <table className="w-full">
                  <thead className="sticky top-0 bg-surface-1/95 backdrop-blur-sm">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">{t('analytics.table.date')}</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-ink-3 uppercase tracking-wider">{t('analytics.table.visitors')}</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-ink-3 uppercase tracking-wider">{t('analytics.table.avgOccupancy')}</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-ink-3 uppercase tracking-wider">{t('analytics.table.trend')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {overview.timeline.map((p, i) => {
                      const prev = i > 0 ? overview.timeline[i - 1].visitors : p.visitors;
                      const change = prev ? Math.round(((p.visitors - prev) / prev) * 100) : 0;
                      const dateLabel = new Date(p.ts).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
                      return (
                        <tr key={p.ts} className="hover:bg-white/[0.04] transition-colors">
                          <td className="px-5 py-2.5 text-sm text-ink-0">{dateLabel}</td>
                          <td className="px-5 py-2.5 text-sm text-ink-1 text-right font-mono">{p.visitors}</td>
                          <td className="px-5 py-2.5 text-sm text-ink-1 text-right font-mono">{p.occupancy}</td>
                          <td className="px-5 py-2.5 text-right">
                            <span className={`text-xs font-mono ${change > 0 ? 'text-success-400' : change < 0 ? 'text-danger-400' : 'text-ink-3'}`}>
                              {change > 0 ? '+' : ''}{change}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
