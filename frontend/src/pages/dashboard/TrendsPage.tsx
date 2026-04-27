import { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { motion } from 'framer-motion';
import { Calendar, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDashboardFilter } from '../../contexts/DashboardFilterContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface WeekdayTrend {
  weekday: number;
  thisWeek: number[];
  lastWeek: number[];
  thisWeekTotal: number;
  lastWeekTotal: number;
  changePercent: number;
}

interface PeakHour {
  hour: number;
  avg: number;
}

interface Prediction {
  date: string;
  weekday: number;
  hourlyPrediction: Array<{ hour: number; predicted: number }>;
  confidence: number;
  dataWeeks: number;
  message?: string;
}

const RANGE_OPTIONS: { days: number; key: string }[] = [
  { days: 7, key: 'topbar.lastNDays' },
  { days: 30, key: 'topbar.lastNDays' },
  { days: 90, key: 'topbar.lastNDays' },
];

export default function TrendsPage() {
  const { t } = useLanguage();
  const { selectedBranch } = useDashboardFilter();
  const [weeklyData, setWeeklyData] = useState<WeekdayTrend[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [hourlyProfile, setHourlyProfile] = useState<number[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [cameraId, setCameraId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const weekdayLabels = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`common.weekday.${i}`));

  // Resolve camera: branch cameras (active first) → none. We deliberately do
  // NOT fall back to the unscoped /api/cameras list; that would leak data from
  // other branches into this branch's view.
  useEffect(() => {
    if (!selectedBranch) { setCameraId(''); return; }
    if (selectedBranch.cameras && selectedBranch.cameras.length > 0) {
      const active = selectedBranch.cameras.find((c) => c.isActive) || selectedBranch.cameras[0];
      setCameraId(active.id);
      return;
    }
    setCameraId('');
  }, [selectedBranch]);

  const fetchData = useCallback(async (camId: string, days: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const qs = `?days=${days}`;
      const [weeklyRes, peakRes, predRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/${camId}/trends/weekly${qs}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_URL}/api/analytics/${camId}/peak-hours${qs}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_URL}/api/analytics/${camId}/prediction${qs}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (weeklyRes?.weekdays) setWeeklyData(weeklyRes.weekdays);
      if (peakRes) {
        setPeakHours(peakRes.peakHours || []);
        setHourlyProfile(peakRes.hourlyProfile || []);
      }
      if (predRes) setPrediction(predRes);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t('trends.empty.error.fallback'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (cameraId) fetchData(cameraId, rangeDays);
  }, [cameraId, rangeDays, fetchData]);

  const selectedTrend = weeklyData.find((w) => w.weekday === selectedDay);
  const hasData = weeklyData.some((w) => w.thisWeekTotal > 0 || w.lastWeekTotal > 0);

  // Build a map of weekday → "is this day still in the future within the
  // current ISO week?". Prevents the UI from rendering "-100%" on Thu/Fri/Sat
  // when the data simply hasn't been recorded yet because the day is tomorrow.
  const { futureDays, pastDaysWithZeroThisWeek } = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const future = new Set<number>();
    const zeroButPast = new Set<number>();
    for (let wd = 0; wd < 7; wd++) {
      const d = new Date(thisWeekStart);
      d.setDate(thisWeekStart.getDate() + wd);
      if (d > today) future.add(wd);
    }
    for (const w of weeklyData) {
      if (w.thisWeekTotal === 0 && !future.has(w.weekday)) {
        zeroButPast.add(w.weekday);
      }
    }
    return { futureDays: future, pastDaysWithZeroThisWeek: zeroButPast };
  })();

  // ── Charts ──────────────────────────────────────────────────────────────
  const weeklyChartOption = selectedTrend ? {
    grid: { left: 40, right: 12, top: 30, bottom: 28 },
    tooltip: { trigger: 'axis' as const, backgroundColor: '#0b1020', borderColor: '#1d6bff40', textStyle: { color: '#fff' } },
    legend: { data: [t('trends.thisWeek'), t('trends.lastWeek')], textStyle: { color: '#94a3b8' }, top: 0 },
    xAxis: {
      type: 'category' as const,
      data: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`),
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
        name: t('trends.thisWeek'),
        type: 'line' as const,
        data: selectedTrend.thisWeek,
        smooth: true,
        areaStyle: {
          color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(29,107,255,0.45)' },
              { offset: 1, color: 'rgba(29,107,255,0.02)' },
            ],
          },
        },
        lineStyle: { width: 2.5, color: '#1d6bff' },
        itemStyle: { color: '#1d6bff' },
      },
      {
        name: t('trends.lastWeek'),
        type: 'line' as const,
        data: selectedTrend.lastWeek,
        smooth: true,
        lineStyle: { width: 1.5, color: '#94a3b8', type: 'dashed' as const },
        itemStyle: { color: '#94a3b8' },
      },
    ],
  } : null;

  // Heatmap: 7 days × 24 hours, color intensity = avg entries
  const maxAvg = Math.max(1, ...hourlyProfile);

  const predictionOption = prediction ? {
    grid: { left: 40, right: 12, top: 10, bottom: 28 },
    tooltip: { trigger: 'axis' as const, backgroundColor: '#0b1020', borderColor: '#8b5cf640' },
    xAxis: {
      type: 'category' as const,
      data: prediction.hourlyPrediction.map((h) => `${String(h.hour).padStart(2, '0')}:00`),
      axisLine: { lineStyle: { color: '#1f2937' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
    },
    yAxis: {
      type: 'value' as const, axisLabel: { color: '#64748b', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [{
      type: 'bar' as const,
      data: prediction.hourlyPrediction.map((h) => h.predicted),
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#8b5cf6' },
            { offset: 1, color: '#8b5cf640' },
          ],
        },
      },
    }],
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gradient-brand tracking-tight">{t('nav.trends')}</h1>
          <p className="text-sm text-ink-3 mt-1">
            {t('trends.page.subtitle')}
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-white/[0.08] overflow-hidden bg-surface-2/70 backdrop-blur-sm">
          {RANGE_OPTIONS.map((opt) => {
            const active = rangeDays === opt.days;
            return (
              <button
                key={opt.days}
                onClick={() => setRangeDays(opt.days)}
                className={`px-3 py-2 text-xs font-medium font-mono transition-colors ${
                  active
                    ? 'bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-glow-brand'
                    : 'text-ink-2 hover:text-ink-0 hover:bg-white/[0.04]'
                }`}
              >
                {t(opt.key, { n: opt.days })}
              </button>
            );
          })}
        </div>
      </div>

      {!cameraId ? (
        <EmptyState
          title={t('trends.empty.noCamera.title')}
          hint={t('trends.empty.noCamera.hint')}
          icon={<AlertCircle className="w-7 h-7 text-warning-300" />}
        />
      ) : loading ? (
        <div className="text-center py-14 text-ink-3">{t('common.loading')}</div>
      ) : errorMsg ? (
        <EmptyState title={t('trends.empty.error.title')} hint={errorMsg} icon={<AlertCircle className="w-7 h-7 text-danger-300" />} />
      ) : !hasData ? (
        <EmptyState
          title={t('trends.empty.noData.title')}
          hint={t('trends.empty.noData.hint')}
          icon={<TrendingUp className="w-7 h-7 text-brand-300" />}
        />
      ) : (
        <>
          {/* Weekday selector */}
          <div className="flex gap-2 flex-wrap">
            {weekdayLabels.map((label, i) => {
              const w = weeklyData.find((x) => x.weekday === i);
              const active = selectedDay === i;
              const isFuture = futureDays.has(i);
              const isZeroPast = pastDaysWithZeroThisWeek.has(i);
              return (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedDay(i)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-glow-brand'
                      : isFuture
                        ? 'bg-white/[0.02] text-ink-4 border border-white/[0.05]'
                        : 'bg-white/[0.03] text-ink-2 hover:text-ink-0 hover:bg-white/[0.06] border border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    {isFuture && (
                      <span className="px-1 py-0.5 rounded-full bg-white/[0.06] text-[9px] font-mono uppercase tracking-wide">
                        {t('trends.dayBadge.upcoming')}
                      </span>
                    )}
                  </div>
                  {w && (
                    <div className="text-[10px] opacity-70 font-mono mt-0.5">
                      {isFuture
                        ? '—'
                        : isZeroPast && w.lastWeekTotal === 0
                          ? `${w.thisWeekTotal}`
                          : `${w.thisWeekTotal} · ${w.changePercent > 0 ? '+' : ''}${w.changePercent}%`}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Weekly comparison */}
          {weeklyChartOption && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="surface-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-brand-300" />
                <h3 className="font-semibold text-ink-0">{t('trends.weekVsLast', { day: weekdayLabels[selectedDay] })}</h3>
              </div>
              <ReactECharts option={weeklyChartOption} style={{ height: '260px' }} />
            </motion.div>
          )}

          <div className="grid grid-cols-1 gap-6">
            {/* Peak hours */}
            <div className="surface-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-warning-300" />
                <h3 className="font-semibold text-ink-0">{t('trends.peakHours.title', { n: rangeDays })}</h3>
              </div>
              {peakHours.length === 0 ? (
                <p className="text-sm text-ink-3">{t('trends.noData')}</p>
              ) : (
                <div className="space-y-2">
                  {peakHours.map((p, i) => (
                    <motion.div
                      key={p.hour}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-warning-500/15 text-warning-300 font-bold text-sm">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-semibold text-ink-0">{String(p.hour).padStart(2, '0')}:00</span>
                          <span className="text-xs text-ink-3 font-mono">{t('trends.peakHours.avgPeople', { n: p.avg })}</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(p.avg / maxAvg) * 100}%` }}
                            transition={{ duration: 0.6, delay: 0.15 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full bg-gradient-to-r from-warning-500 to-warning-400 rounded-full"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Prediction */}
          {prediction && predictionOption && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="surface-card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-300" />
                  <h3 className="font-semibold text-ink-0">{t('trends.prediction.title')} &mdash; {prediction.date}</h3>
                </div>
                <div className="text-xs text-ink-3 font-mono">
                  {t('trends.prediction.confidence')}: <span className="text-violet-300">{Math.round(prediction.confidence)}%</span> &middot; {t('trends.prediction.weeksData', { n: prediction.dataWeeks })}
                </div>
              </div>
              {prediction.message && <p className="text-xs text-ink-4 mb-3">{prediction.message}</p>}
              <ReactECharts option={predictionOption} style={{ height: '200px' }} />
            </motion.div>
          )}
        </>
      )}
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
