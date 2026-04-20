import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { useLanguage } from '../../contexts/LanguageContext';

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

export default function TrendsPage() {
  const { t } = useLanguage();
  const [weeklyData, setWeeklyData] = useState<WeekdayTrend[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [, setQuietHours] = useState<PeakHour[]>([]);
  const [hourlyProfile, setHourlyProfile] = useState<number[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [loading, setLoading] = useState(true);
  const [, setCameraId] = useState('');

  const weekdayLabels = [0, 1, 2, 3, 4, 5, 6].map(i => t(`common.weekday.${i}`));

  useEffect(() => {
    const stored = localStorage.getItem('selectedCameraId');
    const id = stored || 'default';
    setCameraId(id);
    fetchData(id);
  }, []);

  const fetchData = async (camId: string) => {
    setLoading(true);
    try {
      const [weeklyRes, peakRes, predRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/${camId}/trends/weekly`).then(r => r.ok ? r.json() : null),
        fetch(`${API_URL}/api/analytics/${camId}/peak-hours`).then(r => r.ok ? r.json() : null),
        fetch(`${API_URL}/api/analytics/${camId}/prediction`).then(r => r.ok ? r.json() : null),
      ]);
      if (weeklyRes?.weekdays) setWeeklyData(weeklyRes.weekdays);
      if (peakRes) {
        setPeakHours(peakRes.peakHours || []);
        setQuietHours(peakRes.quietHours || []);
        setHourlyProfile(peakRes.hourlyProfile || []);
      }
      if (predRes) setPrediction(predRes);
    } catch (e) {
      console.error('Failed to fetch trends:', e);
    } finally {
      setLoading(false);
    }
  };

  const selectedTrend = weeklyData.find(w => w.weekday === selectedDay);

  const weeklyChartOption = selectedTrend ? {
    tooltip: { trigger: 'axis' as const },
    legend: { data: [t('trends.thisWeek'), t('trends.lastWeek')] },
    xAxis: {
      type: 'category' as const,
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    },
    yAxis: { type: 'value' as const },
    series: [
      {
        name: t('trends.thisWeek'),
        type: 'line' as const,
        data: selectedTrend.thisWeek,
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(29,107,255,0.35)' },
              { offset: 1, color: 'rgba(29,107,255,0.02)' },
            ],
          },
        },
        itemStyle: { color: '#1d6bff' },
      },
      {
        name: t('trends.lastWeek'),
        type: 'line' as const,
        data: selectedTrend.lastWeek,
        smooth: true,
        lineStyle: { type: 'dashed' as const, width: 1.5 },
        itemStyle: { color: '#7e89a8' },
      },
    ],
  } : null;

  const profileOption = hourlyProfile.length > 0 ? {
    tooltip: { trigger: 'axis' as const },
    xAxis: {
      type: 'category' as const,
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    },
    yAxis: { type: 'value' as const },
    series: [{
      type: 'bar' as const,
      data: hourlyProfile,
      itemStyle: {
        color: (params: any) => {
          const peak = peakHours.map(p => p.hour);
          return peak.includes(params.dataIndex) ? '#ff5d7a' : '#1d6bff';
        },
        borderRadius: [6, 6, 0, 0],
      },
    }],
  } : null;

  const predictionOption = prediction && prediction.confidence > 0 ? {
    tooltip: { trigger: 'axis' as const },
    xAxis: {
      type: 'category' as const,
      data: prediction.hourlyPrediction.map(p => `${p.hour}:00`),
    },
    yAxis: { type: 'value' as const },
    series: [{
      type: 'bar' as const,
      data: prediction.hourlyPrediction.map(p => p.predicted),
      itemStyle: {
        color: {
          type: 'linear' as const,
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#1fc98a' },
            { offset: 1, color: '#0fa66e' },
          ],
        },
        borderRadius: [6, 6, 0, 0],
      },
    }],
  } : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-gradient-brand tracking-tight">{t('trends.page.title')}</h2>
        <p className="text-sm text-ink-3 mt-1">{t('trends.page.subtitle')}</p>
      </div>

      {/* Weekly Comparison */}
      <div className="surface-card p-6 rounded-xl">
        <h3 className="font-display text-lg font-semibold text-ink-0 mb-4">{t('trends.weeklyComparison')}</h3>
        <div className="flex gap-2 mb-4 overflow-x-auto custom-scrollbar">
          {weekdayLabels.map((label, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedDay === i
                  ? 'bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-glow-brand'
                  : 'bg-white/[0.04] text-ink-3 hover:bg-white/[0.08] hover:text-ink-1 border border-white/[0.08]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedTrend && (
          <div className="flex gap-3 mb-4">
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2">
              <p className="text-[11px] uppercase tracking-wider text-ink-4 font-mono">{t('trends.thisWeek')}</p>
              <p className="font-display text-lg font-bold text-ink-0 font-mono">{selectedTrend.thisWeekTotal}</p>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2">
              <p className="text-[11px] uppercase tracking-wider text-ink-4 font-mono">{t('trends.lastWeek')}</p>
              <p className="font-display text-lg font-bold text-ink-0 font-mono">{selectedTrend.lastWeekTotal}</p>
            </div>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2">
              <p className="text-[11px] uppercase tracking-wider text-ink-4 font-mono">{t('trends.change')}</p>
              <p className={`font-display text-lg font-bold font-mono ${selectedTrend.changePercent >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                {selectedTrend.changePercent >= 0 ? '+' : ''}{selectedTrend.changePercent}%
              </p>
            </div>
          </div>
        )}

        {weeklyChartOption ? (
          <ReactECharts theme="observai" option={weeklyChartOption} style={{ height: 300 }} />
        ) : (
          <p className="text-ink-4 text-center py-12">{t('trends.notEnoughData')}</p>
        )}
      </div>

      {/* Peak Hours + Prediction side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peak Hours */}
        <div className="surface-card p-6 rounded-xl">
          <h3 className="font-display text-lg font-semibold text-ink-0 mb-4">{t('trends.hourlyProfile')}</h3>
          {profileOption ? (
            <ReactECharts theme="observai" option={profileOption} style={{ height: 250 }} />
          ) : (
            <p className="text-ink-4 text-center py-12">{t('trends.noData')}</p>
          )}
          {peakHours.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-ink-3 font-medium">{t('trends.peakHoursLabel')}</p>
              {peakHours.map(p => (
                <div key={p.hour} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-danger-400" />
                  <span className="text-sm text-ink-1 font-mono">{p.hour}:00</span>
                  <span className="text-sm text-ink-3">{t('trends.avgPeople', { n: p.avg })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prediction */}
        <div className="surface-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-ink-0">{t('trends.tomorrowPrediction')}</h3>
            {prediction && prediction.confidence > 0 && (
              <span className="px-2 py-1 bg-success-500/15 text-success-300 border border-success-500/30 text-xs rounded-full font-mono">
                {t('trends.confidence', { n: prediction.confidence })}
              </span>
            )}
          </div>
          {prediction?.message ? (
            <p className="text-ink-4 text-center py-12">{prediction.message}</p>
          ) : predictionOption ? (
            <>
              <p className="text-sm text-ink-3 mb-2">
                {t('trends.dataWeeks', {
                  date: prediction!.date,
                  day: weekdayLabels[prediction!.weekday],
                  n: prediction!.dataWeeks,
                })}
              </p>
              <ReactECharts theme="observai" option={predictionOption} style={{ height: 250 }} />
            </>
          ) : (
            <p className="text-ink-4 text-center py-12">{t('trends.predictionNoData')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
