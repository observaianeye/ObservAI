import {
  Calendar,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  FileText,
  Table,
  ChevronDown,
} from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDataMode } from '../../contexts/DataModeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HourlyDataPoint {
  hour: number;
  label: string;
  visitors: number;
  avgOccupancy: number;
  entries: number;
  exits: number;
}

interface DailyDataPoint {
  date: string;
  label: string;
  visitors: number;
  avgOccupancy: number;
  peakHour: string;
  avgDwellTime: number;
}

interface ComparisonData {
  period1: PeriodStats;
  period2: PeriodStats;
  changes: Record<string, number>;
  summary: string;
}

interface PeriodStats {
  dataPoints: number;
  totalPeopleIn: number;
  totalPeopleOut: number;
  avgCurrentCount: number;
  avgQueueCount: number;
  avgWaitTime: number;
  maxWaitTime: number;
  avgFps: number;
  peakHour: string;
  startDate: string;
  endDate: string;
}

interface DemographicSnapshot {
  gender: { male: number; female: number; unknown: number };
  age: Record<string, number>;
}

type ViewMode = 'daily' | 'hourly' | 'comparison';
type ExportFormat = 'csv' | 'pdf';

// ─── Demo Data Generators ─────────────────────────────────────────────────────

function generateDemoHourlyData(date: string): HourlyDataPoint[] {
  const hours: HourlyDataPoint[] = [];
  for (let h = 7; h <= 22; h++) {
    // Realistic café pattern: morning rush, lunch peak, afternoon lull, evening
    let base: number;
    if (h >= 7 && h < 9) base = 15 + Math.random() * 10;
    else if (h >= 9 && h < 12) base = 8 + Math.random() * 8;
    else if (h >= 12 && h < 14) base = 20 + Math.random() * 12;
    else if (h >= 14 && h < 17) base = 10 + Math.random() * 10;
    else if (h >= 17 && h < 20) base = 12 + Math.random() * 8;
    else base = 3 + Math.random() * 5;

    const visitors = Math.round(base);
    const entries = visitors + Math.round(Math.random() * 3);
    const exits = Math.max(0, entries - Math.round(Math.random() * 4 - 2));

    hours.push({
      hour: h,
      label: `${h}:00`,
      visitors,
      avgOccupancy: Math.round(base * 0.7),
      entries,
      exits,
    });
  }
  return hours;
}

function generateDemoDailyData(startDate: string, endDate: string): DailyDataPoint[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days: DailyDataPoint[] = [];
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Weekend vs weekday pattern
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseVisitors = isWeekend ? 180 + Math.random() * 60 : 120 + Math.random() * 40;

    days.push({
      date: current.toISOString().split('T')[0],
      label: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      visitors: Math.round(baseVisitors),
      avgOccupancy: Math.round(baseVisitors * 0.15),
      peakHour: `${12 + Math.floor(Math.random() * 3)}:00`,
      avgDwellTime: Math.round(600 + Math.random() * 600), // 10-20 min in seconds
    });

    current.setDate(current.getDate() + 1);
  }
  return days;
}

function generateDemoDemographics(): DemographicSnapshot {
  const total = 100;
  return {
    gender: {
      male: Math.round(total * (0.44 + Math.random() * 0.06)),
      female: Math.round(total * (0.48 + Math.random() * 0.06)),
      unknown: Math.round(total * 0.02),
    },
    age: {
      '0-17': Math.round(total * 0.08),
      '18-24': Math.round(total * 0.25),
      '25-34': Math.round(total * 0.30),
      '35-44': Math.round(total * 0.18),
      '45-54': Math.round(total * 0.11),
      '55-64': Math.round(total * 0.05),
      '65+': Math.round(total * 0.03),
    },
  };
}

function generateDemoComparison(startDate: string, endDate: string): ComparisonData {
  const makeStats = (start: string, end: string, multiplier: number): PeriodStats => ({
    dataPoints: 48 + Math.floor(Math.random() * 20),
    totalPeopleIn: Math.round((140 + Math.random() * 40) * multiplier),
    totalPeopleOut: Math.round((130 + Math.random() * 35) * multiplier),
    avgCurrentCount: Math.round(18 + Math.random() * 12),
    avgQueueCount: Math.round(2 + Math.random() * 4),
    avgWaitTime: Math.round(25 + Math.random() * 20),
    maxWaitTime: Math.round(80 + Math.random() * 40),
    avgFps: Math.round(28 + Math.random() * 4),
    peakHour: `${12 + Math.floor(Math.random() * 3)}:00`,
    startDate: start,
    endDate: end,
  });

  const p1 = makeStats(startDate, endDate, 1.1);
  const p2 = makeStats(startDate, endDate, 1.0);

  const calcChange = (a: number, b: number) => (b === 0 ? 0 : Math.round(((a - b) / b) * 100));

  return {
    period1: p1,
    period2: p2,
    changes: {
      totalPeopleIn: calcChange(p1.totalPeopleIn, p2.totalPeopleIn),
      totalPeopleOut: calcChange(p1.totalPeopleOut, p2.totalPeopleOut),
      avgCurrentCount: calcChange(p1.avgCurrentCount, p2.avgCurrentCount),
      avgQueueCount: calcChange(p1.avgQueueCount, p2.avgQueueCount),
      avgWaitTime: calcChange(p1.avgWaitTime, p2.avgWaitTime),
    },
    summary: `Current period shows a ${calcChange(p1.totalPeopleIn, p2.totalPeopleIn)}% change in foot traffic. Average occupancy shifted from ${p2.avgCurrentCount} to ${p1.avgCurrentCount}. Peak hour: ${p1.peakHour}.`,
  };
}

// ─── Mini Chart Components ────────────────────────────────────────────────────

function MiniBarChart({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-16">
      {data.map((val, i) => (
        <div
          key={i}
          className="flex-1 rounded-t transition-all duration-300 hover:opacity-80"
          style={{
            height: `${(val / max) * 100}%`,
            backgroundColor: color,
            minHeight: val > 0 ? '2px' : '0',
          }}
          title={`${val}`}
        />
      ))}
    </div>
  );
}

function AreaChart({
  data,
  height = 240,
  color = '#3b82f6',
  labels,
}: {
  data: number[];
  height?: number;
  color?: string;
  labels?: string[];
}) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const pad = 10;

  const points = data.map((v, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * (w - 2 * pad) + pad,
    y: h - ((v - min) / range) * (h - 2 * pad) - pad,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: `${height}px` }}>
        <defs>
          <linearGradient id={`areaGrad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#areaGrad-${color.replace('#', '')})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} />
        ))}
      </svg>
      {labels && (
        <div className="flex justify-between px-2 mt-1">
          {labels.filter((_, i) => i % Math.ceil(labels.length / 8) === 0 || i === labels.length - 1).map((l, i) => (
            <span key={i} className="text-[10px] text-gray-400">{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function HorizontalBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-12 text-right font-medium">{item.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
          <span className="text-xs text-gray-700 font-semibold w-8">{item.value}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  change?: number;
  icon: React.ElementType;
  color: string;
}) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <span
            className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${
              isPositive ? 'text-green-700 bg-green-50' : isNegative ? 'text-red-700 bg-red-50' : 'text-gray-500 bg-gray-50'
            }`}
          >
            {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : isNegative ? <ArrowDownRight className="w-3 h-3 mr-0.5" /> : null}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{title}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HistoricalAnalyticsPage() {
  const { dataMode } = useDataMode();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // ── State ─────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [selectedCamera, setSelectedCamera] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDropdown, setExportDropdown] = useState(false);

  // Data states
  const [dailyData, setDailyData] = useState<DailyDataPoint[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyDataPoint[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [demographics, setDemographics] = useState<DemographicSnapshot | null>(null);

  // ── Data Loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (dataMode === 'demo') {
        // Demo data
        await new Promise(r => setTimeout(r, 400)); // Simulate loading
        setDailyData(generateDemoDailyData(startDate, endDate));
        setHourlyData(generateDemoHourlyData(today));
        setDemographics(generateDemoDemographics());
        setComparisonData(generateDemoComparison(startDate, endDate));
      } else {
        // Live: fetch from backend /api/analytics/compare
        try {
          const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
          const compareRes = await fetch(
            `${API_URL}/api/analytics/compare?` +
              new URLSearchParams({
                period1Start: startDate,
                period1End: endDate,
                period2Start: twoWeeksAgo,
                period2End: startDate,
                ...(selectedCamera !== 'all' ? { cameraId: selectedCamera } : {}),
              })
          );
          if (compareRes.ok) {
            setComparisonData(await compareRes.json());
          }
        } catch {
          // Fallback to demo
          setComparisonData(generateDemoComparison(startDate, endDate));
        }
        // Also generate daily/hourly for charts (demo fallback)
        setDailyData(generateDemoDailyData(startDate, endDate));
        setHourlyData(generateDemoHourlyData(today));
        setDemographics(generateDemoDemographics());
      }
    } finally {
      setLoading(false);
    }
  }, [dataMode, startDate, endDate, selectedCamera, API_URL, today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Export Handler ────────────────────────────────────────────────────────
  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    setExportDropdown(false);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(selectedCamera !== 'all' ? { cameraId: selectedCamera } : {}),
      });

      const url = `${API_URL}/api/export/${format}?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `analytics_${format === 'pdf' ? 'report' : 'export'}_${startDate}_${endDate}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(`Export ${format} error:`, err);
      // Demo fallback: generate a simple CSV client-side
      if (format === 'csv' && dailyData.length > 0) {
        const header = 'Date,Visitors,Avg Occupancy,Peak Hour,Avg Dwell Time (min)\n';
        const rows = dailyData
          .map(d => `${d.date},${d.visitors},${d.avgOccupancy},${d.peakHour},${Math.round(d.avgDwellTime / 60)}`)
          .join('\n');
        const csvBlob = new Blob([header + rows], { type: 'text/csv' });
        const url = window.URL.createObjectURL(csvBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics_export_${startDate}_${endDate}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  };

  // ── Computed Values ───────────────────────────────────────────────────────
  const summaryStats = useMemo(() => {
    if (dailyData.length === 0) return null;
    const totalVisitors = dailyData.reduce((s, d) => s + d.visitors, 0);
    const avgOccupancy = Math.round(dailyData.reduce((s, d) => s + d.avgOccupancy, 0) / dailyData.length);
    const peakDay = dailyData.reduce((max, d) => (d.visitors > max.visitors ? d : max), dailyData[0]);
    const avgDwell = Math.round(dailyData.reduce((s, d) => s + d.avgDwellTime, 0) / dailyData.length / 60);
    return { totalVisitors, avgOccupancy, peakDay, avgDwell };
  }, [dailyData]);

  // ── Quick Date Presets ────────────────────────────────────────────────────
  const setDatePreset = (days: number) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 86400000);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historical Analytics</h1>
          <p className="text-sm text-gray-600 mt-1">
            View past camera data, trends, and export reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh data"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportDropdown(!exportDropdown)}
              disabled={exporting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
              <span>{exporting ? 'Exporting...' : 'Export'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {exportDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-gray-200 shadow-lg z-10 overflow-hidden">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <Table className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">CSV Export</p>
                    <p className="text-xs text-gray-500">Spreadsheet format</p>
                  </div>
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors border-t border-gray-100"
                >
                  <FileText className="w-4 h-4 text-red-600" />
                  <div>
                    <p className="font-medium text-gray-900">PDF Report</p>
                    <p className="text-xs text-gray-500">Formatted report</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Quick Presets */}
          <div>
            <span className="text-xs text-gray-500 block mb-2">Quick Select</span>
            <div className="flex gap-1">
              {[
                { label: '7D', days: 7 },
                { label: '14D', days: 14 },
                { label: '30D', days: 30 },
                { label: '90D', days: 90 },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => setDatePreset(preset.days)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start Date */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">Start Date</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* End Date */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">End Date</span>
            </div>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Camera Filter */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">Camera</span>
            </div>
            <select
              value={selectedCamera}
              onChange={e => setSelectedCamera(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="all">All Cameras</option>
              <option value="cam-1">Main Entrance</option>
              <option value="cam-2">Checkout Area</option>
              <option value="cam-3">Product Display</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div>
            <span className="text-xs text-gray-500 block mb-1.5">View</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['daily', 'hourly', 'comparison'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    viewMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-3" />
          <span className="text-sm text-gray-500">Loading analytics data...</span>
        </div>
      )}

      {/* Summary Stats Cards */}
      {!loading && summaryStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Visitors"
            value={summaryStats.totalVisitors.toLocaleString()}
            change={comparisonData?.changes.totalPeopleIn}
            icon={Users}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            title="Avg Occupancy"
            value={summaryStats.avgOccupancy.toString()}
            change={comparisonData?.changes.avgCurrentCount}
            icon={BarChart3}
            color="bg-purple-50 text-purple-600"
          />
          <StatCard
            title="Peak Day"
            value={summaryStats.peakDay.label}
            icon={TrendingUp}
            color="bg-green-50 text-green-600"
          />
          <StatCard
            title="Avg Dwell Time"
            value={`${summaryStats.avgDwell} min`}
            change={comparisonData?.changes.avgWaitTime}
            icon={Clock}
            color="bg-amber-50 text-amber-600"
          />
        </div>
      )}

      {/* Main Chart Area */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Large Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              {viewMode === 'daily'
                ? 'Daily Visitor Trend'
                : viewMode === 'hourly'
                ? "Today's Hourly Pattern"
                : 'Period Comparison'}
            </h3>

            {viewMode === 'daily' && dailyData.length > 0 && (
              <div>
                <AreaChart
                  data={dailyData.map(d => d.visitors)}
                  labels={dailyData.map(d => d.label)}
                  color="#3b82f6"
                  height={240}
                />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium">Visitors</p>
                    <MiniBarChart data={dailyData.map(d => d.visitors)} color="#3b82f6" />
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600 font-medium">Avg Occupancy</p>
                    <MiniBarChart data={dailyData.map(d => d.avgOccupancy)} color="#8b5cf6" />
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'hourly' && hourlyData.length > 0 && (
              <div>
                <AreaChart
                  data={hourlyData.map(d => d.visitors)}
                  labels={hourlyData.map(d => d.label)}
                  color="#10b981"
                  height={240}
                />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-xs text-green-600 font-medium mb-1">Peak Hour</p>
                    <p className="text-lg font-bold text-green-800">
                      {hourlyData.reduce((max, d) => (d.visitors > max.visitors ? d : max), hourlyData[0]).label}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <p className="text-xs text-blue-600 font-medium mb-1">Total Entries</p>
                    <p className="text-lg font-bold text-blue-800">
                      {hourlyData.reduce((s, d) => s + d.entries, 0)}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg text-center">
                    <p className="text-xs text-amber-600 font-medium mb-1">Total Exits</p>
                    <p className="text-lg font-bold text-amber-800">
                      {hourlyData.reduce((s, d) => s + d.exits, 0)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'comparison' && comparisonData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium mb-2">Current Period</p>
                    <p className="text-xl font-bold text-blue-800">
                      {comparisonData.period1.totalPeopleIn.toLocaleString()}
                    </p>
                    <p className="text-xs text-blue-500">visitors</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 font-medium mb-2">Previous Period</p>
                    <p className="text-xl font-bold text-gray-700">
                      {comparisonData.period2.totalPeopleIn.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">visitors</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(comparisonData.changes).map(([key, change]) => {
                    const label = key.replace(/([A-Z])/g, ' $1').replace('total ', '').trim();
                    return (
                      <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <span className="text-sm text-gray-600 capitalize">{label}</span>
                        <span
                          className={`flex items-center text-sm font-semibold ${
                            change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
                          }`}
                        >
                          {change > 0 ? (
                            <TrendingUp className="w-4 h-4 mr-1" />
                          ) : change < 0 ? (
                            <TrendingDown className="w-4 h-4 mr-1" />
                          ) : null}
                          {change > 0 ? '+' : ''}
                          {change}%
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 italic mt-3">{comparisonData.summary}</p>
              </div>
            )}
          </div>

          {/* Side Panel - Demographics */}
          <div className="space-y-4">
            {/* Gender Distribution */}
            {demographics && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Gender Distribution</h3>
                <div className="flex items-center justify-center gap-6 mb-4">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-1">
                      <span className="text-lg font-bold text-blue-600">{demographics.gender.male}%</span>
                    </div>
                    <span className="text-xs text-gray-500">Male</span>
                  </div>
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-pink-100 flex items-center justify-center mb-1">
                      <span className="text-lg font-bold text-pink-600">{demographics.gender.female}%</span>
                    </div>
                    <span className="text-xs text-gray-500">Female</span>
                  </div>
                </div>
              </div>
            )}

            {/* Age Distribution */}
            {demographics && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Age Distribution</h3>
                <HorizontalBarChart
                  data={Object.entries(demographics.age).map(([label, value], i) => ({
                    label,
                    value,
                    color: [
                      '#60a5fa', '#818cf8', '#a78bfa', '#c084fc',
                      '#e879f9', '#f472b6', '#fb7185',
                    ][i] || '#94a3b8',
                  }))}
                />
              </div>
            )}

            {/* Data Quality Indicator */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Data Info</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Mode</span>
                  <span className={`font-medium ${dataMode === 'live' ? 'text-green-600' : 'text-amber-600'}`}>
                    {dataMode === 'live' ? 'Live Data' : 'Demo Data'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Period</span>
                  <span className="text-gray-700 font-medium">{dailyData.length} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Data Points</span>
                  <span className="text-gray-700 font-medium">
                    {comparisonData?.period1.dataPoints || dailyData.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Data Table */}
      {!loading && viewMode === 'daily' && dailyData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Daily Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Visitors</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Occupancy</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Peak Hour</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Dwell</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dailyData.map((day, i) => {
                  const prev = i > 0 ? dailyData[i - 1].visitors : day.visitors;
                  const change = prev ? Math.round(((day.visitors - prev) / prev) * 100) : 0;
                  return (
                    <tr key={day.date} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm text-gray-900 font-medium">{day.label}</td>
                      <td className="px-5 py-3 text-sm text-gray-700 text-right">{day.visitors}</td>
                      <td className="px-5 py-3 text-sm text-gray-700 text-right">{day.avgOccupancy}</td>
                      <td className="px-5 py-3 text-sm text-gray-700 text-right">{day.peakHour}</td>
                      <td className="px-5 py-3 text-sm text-gray-700 text-right">{Math.round(day.avgDwellTime / 60)} min</td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`inline-flex items-center text-xs font-medium ${
                            change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-400'
                          }`}
                        >
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
    </div>
  );
}
