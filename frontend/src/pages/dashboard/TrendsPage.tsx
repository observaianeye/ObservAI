import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WEEKDAY_LABELS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

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
  const [weeklyData, setWeeklyData] = useState<WeekdayTrend[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [, setQuietHours] = useState<PeakHour[]>([]);
  const [hourlyProfile, setHourlyProfile] = useState<number[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [loading, setLoading] = useState(true);
  const [, setCameraId] = useState('');

  useEffect(() => {
    // Get first camera from localStorage or default
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
    legend: { data: ['Bu Hafta', 'Geçen Hafta'], textStyle: { color: '#9ca3af' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      axisLabel: { color: '#9ca3af' },
    },
    yAxis: { type: 'value' as const, axisLabel: { color: '#9ca3af' } },
    series: [
      { name: 'Bu Hafta', type: 'line' as const, data: selectedTrend.thisWeek, smooth: true, itemStyle: { color: '#8b5cf6' } },
      { name: 'Geçen Hafta', type: 'line' as const, data: selectedTrend.lastWeek, smooth: true, itemStyle: { color: '#6b7280' }, lineStyle: { type: 'dashed' as const } },
    ],
  } : null;

  const profileOption = hourlyProfile.length > 0 ? {
    tooltip: { trigger: 'axis' as const },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      axisLabel: { color: '#9ca3af' },
    },
    yAxis: { type: 'value' as const, axisLabel: { color: '#9ca3af' } },
    series: [{
      type: 'bar' as const,
      data: hourlyProfile,
      itemStyle: {
        color: (params: any) => {
          const peak = peakHours.map(p => p.hour);
          return peak.includes(params.dataIndex) ? '#ef4444' : '#8b5cf6';
        },
      },
    }],
  } : null;

  const predictionOption = prediction && prediction.confidence > 0 ? {
    tooltip: { trigger: 'axis' as const },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: prediction.hourlyPrediction.map(p => `${p.hour}:00`),
      axisLabel: { color: '#9ca3af' },
    },
    yAxis: { type: 'value' as const, axisLabel: { color: '#9ca3af' } },
    series: [{
      type: 'bar' as const,
      data: prediction.hourlyPrediction.map(p => p.predicted),
      itemStyle: { color: '#10b981' },
    }],
  } : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Trend Analizi</h2>
        <p className="text-sm text-gray-400 mt-1">Haftalık karşılaştırma, yoğun saatler ve yarınki tahmin</p>
      </div>

      {/* Weekly Comparison */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Haftalık Karşılaştırma</h3>
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {WEEKDAY_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedDay === i
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedTrend && (
          <div className="flex gap-4 mb-4">
            <div className="bg-gray-700/30 rounded-lg px-4 py-2">
              <p className="text-xs text-gray-400">Bu Hafta</p>
              <p className="text-lg font-bold text-white">{selectedTrend.thisWeekTotal}</p>
            </div>
            <div className="bg-gray-700/30 rounded-lg px-4 py-2">
              <p className="text-xs text-gray-400">Geçen Hafta</p>
              <p className="text-lg font-bold text-white">{selectedTrend.lastWeekTotal}</p>
            </div>
            <div className="bg-gray-700/30 rounded-lg px-4 py-2">
              <p className="text-xs text-gray-400">Değişim</p>
              <p className={`text-lg font-bold ${selectedTrend.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {selectedTrend.changePercent >= 0 ? '+' : ''}{selectedTrend.changePercent}%
              </p>
            </div>
          </div>
        )}

        {weeklyChartOption ? (
          <ReactECharts option={weeklyChartOption} style={{ height: 300 }} />
        ) : (
          <p className="text-gray-500 text-center py-12">Henüz yeterli veri yok</p>
        )}
      </div>

      {/* Peak Hours + Prediction side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peak Hours */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Saatlik Profil (30 Gün)</h3>
          {profileOption ? (
            <ReactECharts option={profileOption} style={{ height: 250 }} />
          ) : (
            <p className="text-gray-500 text-center py-12">Veri yok</p>
          )}
          {peakHours.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-400 font-medium">En Yoğun Saatler:</p>
              {peakHours.map(p => (
                <div key={p.hour} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-sm text-white">{p.hour}:00</span>
                  <span className="text-sm text-gray-400">ort. {p.avg} kişi</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prediction */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Yarınki Tahmin</h3>
            {prediction && prediction.confidence > 0 && (
              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                %{prediction.confidence} güven
              </span>
            )}
          </div>
          {prediction?.message ? (
            <p className="text-gray-500 text-center py-12">{prediction.message}</p>
          ) : predictionOption ? (
            <>
              <p className="text-sm text-gray-400 mb-2">
                {prediction!.date} ({WEEKDAY_LABELS[prediction!.weekday]}) — {prediction!.dataWeeks} haftalık veriye dayalı
              </p>
              <ReactECharts option={predictionOption} style={{ height: 250 }} />
            </>
          ) : (
            <p className="text-gray-500 text-center py-12">Tahmin için yeterli veri yok</p>
          )}
        </div>
      </div>
    </div>
  );
}
