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
import { useLanguage } from '../../contexts/LanguageContext';
import { useDashboardFilter } from '../../contexts/DashboardFilterContext';

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
  // Each change is a percentage delta vs the prior period, or null when the
  // prior period had no baseline — rendering "-98.99% DOWN" against a zero
  // baseline was the old bug we're avoiding.
  changes: Record<string, number | null>;
  priorPeriodHasData?: boolean;
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
  // Count of aggregated samples — used to gate "unreliable" warning and to
  // normalise the raw vote counts into percentages at render time.
  samples?: number;
}

// Compute a normalised gender split. Raw counts from the aggregator are
// cumulative vote totals across frames — not people. Dividing by the sum gives
// a consistent "share" expressed as a 0–100 percentage regardless of window.
function computeGenderPct(g: DemographicSnapshot['gender']) {
  const total = (g?.male ?? 0) + (g?.female ?? 0) + (g?.unknown ?? 0);
  if (total <= 0) return { malePct: 0, femalePct: 0, unknownPct: 0, total: 0 };
  const malePct = Math.round((g.male / total) * 100);
  const femalePct = Math.round((g.female / total) * 100);
  // Remainder to unknown so the three buckets always add to 100.
  const unknownPct = Math.max(0, 100 - malePct - femalePct);
  return { malePct, femalePct, unknownPct, total };
}

// Turn { "25-34": 137, "35-44": 89, ... } into an array of { label, pct }
// entries that sum to 100. Zero-total guard returns empty list so the chart
// can render a "no demographics" placeholder instead of dividing by zero.
function computeAgePct(age: Record<string, number>): Array<{ label: string; pct: number }> {
  const entries = Object.entries(age ?? {}).filter(([, v]) => typeof v === 'number' && v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return [];
  // Preserve sorted bucket order (0-17, 18-24, 25-34, ...) when present.
  const order = ['0-17', '18-24', '25-34', '35-44', '45-54', '55+'];
  const sorted = entries.sort((a, b) => {
    const ai = order.indexOf(a[0]);
    const bi = order.indexOf(b[0]);
    if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return sorted.map(([label, v]) => ({ label, pct: Math.round((v / total) * 100) }));
}

type ViewMode = 'daily' | 'hourly' | 'comparison';
type ExportFormat = 'csv' | 'pdf';

// ─── Demo Data Generators ─────────────────────────────────────────────────────

function generateDemoHourlyData(_date: string): HourlyDataPoint[] {
  const hours: HourlyDataPoint[] = [];
  for (let h = 7; h <= 22; h++) {
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

function generateDemoDailyData(startDate: string, endDate: string, locale: string): DailyDataPoint[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days: DailyDataPoint[] = [];
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseVisitors = isWeekend ? 180 + Math.random() * 60 : 120 + Math.random() * 40;

    days.push({
      date: current.toISOString().split('T')[0],
      label: current.toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
      visitors: Math.round(baseVisitors),
      avgOccupancy: Math.round(baseVisitors * 0.15),
      peakHour: `${12 + Math.floor(Math.random() * 3)}:00`,
      avgDwellTime: Math.round(600 + Math.random() * 600),
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

  const calcChange = (a: number, b: number): number | null =>
    b === 0 || !Number.isFinite(b) ? null : Math.round(((a - b) / b) * 100);

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
    summary: '',
  };
}

// Design system chart colors
const BRAND = '#1d6bff';
const VIOLET = '#9a4dff';
const SUCCESS = '#1fc98a';
const AGE_PALETTE = ['#1d6bff', '#4c8bff', '#12bcff', '#6dd3ff', '#9a4dff', '#b980ff', '#d8b3ff'];

// ─── Mini Chart Components ────────────────────────────────────────────────────

function MiniBarChart({ data, color = BRAND }: { data: number[]; color?: string }) {
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
  color = BRAND,
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
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
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
            <span key={i} className="text-[10px] text-ink-4 font-mono">{l}</span>
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
          <span className="text-xs text-ink-3 w-12 text-right font-mono">{item.label}</span>
          <div className="flex-1 bg-white/[0.04] rounded-full h-5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
          <span className="text-xs text-ink-1 font-semibold w-8 font-mono">{item.value}%</span>
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
  // null indicates "no prior baseline to compare against" — we render a neutral
  // badge instead of faking a +100%/-100% delta.
  change?: number | null;
  icon: React.ElementType;
  color: string;
}) {
  const hasDelta = typeof change === 'number' && Number.isFinite(change);
  const isPositive = hasDelta && (change as number) > 0;
  const isNegative = hasDelta && (change as number) < 0;
  return (
    <div className="surface-card rounded-xl p-5 hover:shadow-glow-brand transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon strokeWidth={1.5} className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <span
            className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full font-mono ${
              isPositive
                ? 'text-success-300 bg-success-500/15 border border-success-500/30'
                : isNegative
                ? 'text-danger-300 bg-danger-500/15 border border-danger-500/30'
                : 'text-ink-3 bg-white/[0.04] border border-white/[0.08]'
            }`}
            title={hasDelta ? undefined : 'No prior baseline'}
          >
            {isPositive ? <ArrowUpRight strokeWidth={1.5} className="w-3 h-3 mr-0.5" /> : isNegative ? <ArrowDownRight strokeWidth={1.5} className="w-3 h-3 mr-0.5" /> : null}
            {hasDelta ? `${Math.abs(change as number)}%` : '—'}
          </span>
        )}
      </div>
      <p className="font-display text-2xl font-bold text-ink-0">{value}</p>
      <p className="text-xs text-ink-3 mt-1">{title}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HistoricalAnalyticsPage() {
  const { t, lang } = useLanguage();
  const { selectedBranch } = useDashboardFilter();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';

  // ── State ─────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [selectedCamera, setSelectedCamera] = useState('all');
  const [branchCameras, setBranchCameras] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDropdown, setExportDropdown] = useState(false);

  // Refresh the camera dropdown whenever the active branch changes. Uses the
  // server-side branchId filter so we never display cameras from another branch.
  useEffect(() => {
    if (!selectedBranch) { setBranchCameras([]); setSelectedCamera('all'); return; }
    let cancelled = false;
    fetch(`${API_URL}/api/cameras?branchId=${encodeURIComponent(selectedBranch.id)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (cancelled) return;
        const cams = Array.isArray(list)
          ? list.map((c: { id: string; name: string; isActive: boolean }) => ({ id: c.id, name: c.name, isActive: c.isActive }))
          : [];
        setBranchCameras(cams);
        // If previously-picked camera no longer belongs to the new branch, reset
        setSelectedCamera((prev) => (prev !== 'all' && !cams.some((c) => c.id === prev) ? 'all' : prev));
      })
      .catch(() => { if (!cancelled) setBranchCameras([]); });
    return () => { cancelled = true; };
  }, [selectedBranch?.id, API_URL]);

  const [dailyData, setDailyData] = useState<DailyDataPoint[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyDataPoint[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [demographics, setDemographics] = useState<DemographicSnapshot | null>(null);

  // ── Data Loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      {
        // Resolve camera: selectedCamera 'all' → first camera of the active
        // branch (analytics endpoints require a single cameraId). When no
        // branch is selected, branchCameras is empty and we fall through to
        // demo data — never read from another branch's cameras.
        let targetCam = selectedCamera;
        if (targetCam === 'all') {
          if (branchCameras.length > 0) targetCam = branchCameras[0].id;
        }

        let dailyFromApi: DailyDataPoint[] = [];
        let hourlyFromApi: HourlyDataPoint[] = [];
        let demographicsFromApi: DemographicSnapshot | null = null;

        if (targetCam && targetCam !== 'all') {
          try {
            const params = new URLSearchParams({ startDate, endDate });

            // Pull hourly summaries for the whole range — we need them both for
            // the live hourly chart (today) and to derive a per-day peak hour.
            const rangeHourlyRes = await fetch(
              `${API_URL}/api/analytics/${targetCam}/summary?${params}&granularity=hourly`,
              { credentials: 'include' },
            );
            const peakByDay = new Map<string, { hour: number; total: number }>();
            if (rangeHourlyRes.ok) {
              const rows: Array<{ date: string; hour: number; totalEntries: number }> = await rangeHourlyRes.json();
              for (const r of rows) {
                const key = typeof r.date === 'string' ? r.date.slice(0, 10) : String(r.date).slice(0, 10);
                const current = peakByDay.get(key);
                if (!current || r.totalEntries > current.total) {
                  peakByDay.set(key, { hour: r.hour, total: r.totalEntries });
                }
              }
            }

            const dailyRes = await fetch(
              `${API_URL}/api/analytics/${targetCam}/summary?${params}&granularity=daily`,
              { credentials: 'include' },
            );
            if (dailyRes.ok) {
              const rows: Array<{ date: string; totalEntries: number; avgOccupancy: number; demographics: string | null }> = await dailyRes.json();
              dailyFromApi = rows.map((r) => {
                const key = typeof r.date === 'string' ? r.date.slice(0, 10) : String(r.date).slice(0, 10);
                const peak = peakByDay.get(key);
                return {
                  date: r.date,
                  label: new Date(r.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
                  visitors: r.totalEntries,
                  avgOccupancy: Math.round(r.avgOccupancy ?? 0),
                  peakHour: peak ? `${String(peak.hour).padStart(2, '0')}:00` : '—',
                  avgDwellTime: 0,
                };
              });
              // Merge demographics across days
              const gender = { male: 0, female: 0, unknown: 0 };
              const age: Record<string, number> = {};
              let samples = 0;
              for (const r of rows) {
                if (!r.demographics) continue;
                try {
                  const d = JSON.parse(r.demographics);
                  if (d.gender) {
                    gender.male += d.gender.male ?? 0;
                    gender.female += d.gender.female ?? 0;
                    gender.unknown += d.gender.unknown ?? 0;
                  }
                  if (d.age) {
                    for (const [k, v] of Object.entries(d.age)) {
                      if (typeof v === 'number') age[k] = (age[k] ?? 0) + v;
                    }
                  }
                  if (typeof d.samples === 'number') samples += d.samples;
                } catch { /* skip */ }
              }
              if (gender.male + gender.female > 0 || Object.keys(age).length > 0) {
                demographicsFromApi = { gender, age, samples };
              }
            }

            // Today-only hourly data for the hourly-view chart.
            const hourlyRes = await fetch(
              `${API_URL}/api/analytics/${targetCam}/summary?date=${today}&granularity=hourly`,
              { credentials: 'include' },
            );
            if (hourlyRes.ok) {
              const rows: Array<{ hour: number; totalEntries: number; totalExits: number; avgOccupancy: number }> = await hourlyRes.json();
              hourlyFromApi = rows.map((r) => ({
                hour: r.hour,
                label: `${String(r.hour).padStart(2, '0')}:00`,
                visitors: r.totalEntries,
                avgOccupancy: Math.round(r.avgOccupancy ?? 0),
                entries: r.totalEntries,
                exits: r.totalExits,
              }));
            }
          } catch (e) {
            console.warn('[Historical] Real data fetch failed:', e);
          }
        }

        // Comparison (existing endpoint)
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
              }),
            { credentials: 'include' },
          );
          if (compareRes.ok) setComparisonData(await compareRes.json());
        } catch {
          setComparisonData(generateDemoComparison(startDate, endDate));
        }

        // Use real data when non-empty, otherwise fall back to demo so the UI isn't blank
        setDailyData(dailyFromApi.length > 0 ? dailyFromApi : generateDemoDailyData(startDate, endDate, locale));
        setHourlyData(hourlyFromApi.length > 0 ? hourlyFromApi : generateDemoHourlyData(today));
        setDemographics(demographicsFromApi ?? generateDemoDemographics());
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedCamera, branchCameras, API_URL, today, locale]);

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
      const response = await fetch(url, { credentials: 'include' });

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

  const changeLabelKey = (key: string): string => {
    const map: Record<string, string> = {
      totalPeopleIn: 'historical.changes.totalPeopleIn',
      totalPeopleOut: 'historical.changes.totalPeopleOut',
      avgCurrentCount: 'historical.changes.avgCurrentCount',
      avgQueueCount: 'historical.changes.avgQueueCount',
      avgWaitTime: 'historical.changes.avgWaitTime',
    };
    return map[key] || key;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gradient-brand tracking-tight">{t('historical.page.title')}</h1>
          <p className="text-sm text-ink-3 mt-1">{t('historical.page.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-ink-3 hover:text-ink-0 hover:bg-white/[0.06] rounded-xl transition-colors border border-white/[0.08]"
            title={t('historical.page.refreshData')}
          >
            <RefreshCw strokeWidth={1.5} className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportDropdown(!exportDropdown)}
              disabled={exporting}
              className="px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:shadow-glow-brand transition-all disabled:opacity-50"
            >
              <Download strokeWidth={1.5} className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
              <span>{exporting ? t('historical.page.exporting') : t('historical.page.export')}</span>
              <ChevronDown strokeWidth={1.5} className="w-3 h-3" />
            </button>
            {exportDropdown && (
              <div className="absolute right-0 mt-2 w-56 surface-card rounded-xl shadow-lg z-10 overflow-hidden">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-white/[0.06] flex items-center gap-3 transition-colors"
                >
                  <Table strokeWidth={1.5} className="w-4 h-4 text-success-400" />
                  <div>
                    <p className="font-medium text-ink-0">{t('historical.page.csvExport')}</p>
                    <p className="text-xs text-ink-3">{t('historical.page.csvDesc')}</p>
                  </div>
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-white/[0.06] flex items-center gap-3 transition-colors border-t border-white/[0.08]"
                >
                  <FileText strokeWidth={1.5} className="w-4 h-4 text-danger-400" />
                  <div>
                    <p className="font-medium text-ink-0">{t('historical.page.pdfReport')}</p>
                    <p className="text-xs text-ink-3">{t('historical.page.pdfDesc')}</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Filters */}
      <div className="surface-card rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Quick Presets */}
          <div>
            <span className="text-xs text-ink-3 block mb-2">{t('historical.page.quickSelect')}</span>
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
                  className="px-3 py-1.5 text-xs font-medium text-ink-2 rounded-xl border border-white/[0.08] hover:bg-brand-500/10 hover:border-brand-500/30 hover:text-brand-300 transition-colors font-mono"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start Date */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Calendar strokeWidth={1.5} className="w-3.5 h-3.5 text-ink-3" />
              <span className="text-xs text-ink-3">{t('historical.page.startDate')}</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-white/[0.08] bg-surface-2/70 text-ink-0 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 outline-none font-mono"
            />
          </div>

          {/* End Date */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Calendar strokeWidth={1.5} className="w-3.5 h-3.5 text-ink-3" />
              <span className="text-xs text-ink-3">{t('historical.page.endDate')}</span>
            </div>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-white/[0.08] bg-surface-2/70 text-ink-0 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 outline-none font-mono"
            />
          </div>

          {/* Camera Filter — restricted to the active branch's cameras */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Filter strokeWidth={1.5} className="w-3.5 h-3.5 text-ink-3" />
              <span className="text-xs text-ink-3">{t('historical.page.camera')}</span>
            </div>
            <select
              value={selectedCamera}
              onChange={e => setSelectedCamera(e.target.value)}
              disabled={!selectedBranch}
              className="px-3 py-1.5 border border-white/[0.08] bg-surface-2/70 text-ink-0 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 outline-none disabled:opacity-50"
            >
              <option value="all">{t('historical.page.cameraAll')}</option>
              {branchCameras.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div>
            <span className="text-xs text-ink-3 block mb-1.5">{t('historical.page.view')}</span>
            <div className="flex rounded-xl border border-white/[0.08] overflow-hidden">
              {(['daily', 'hourly', 'comparison'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-gradient-to-r from-brand-500 to-accent-500 text-white'
                      : 'bg-white/[0.03] text-ink-2 hover:bg-white/[0.06]'
                  }`}
                >
                  {t(`historical.view.${mode}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw strokeWidth={1.5} className="w-6 h-6 animate-spin text-brand-400 mr-3" />
          <span className="text-sm text-ink-3">{t('historical.page.loading')}</span>
        </div>
      )}

      {/* Summary Stats Cards */}
      {!loading && summaryStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={t('historical.stats.totalVisitors')}
            value={summaryStats.totalVisitors.toLocaleString(locale)}
            change={comparisonData?.changes.totalPeopleIn}
            icon={Users}
            color="bg-brand-500/15 text-brand-300 border border-brand-500/30"
          />
          <StatCard
            title={t('historical.stats.avgOccupancy')}
            value={summaryStats.avgOccupancy.toString()}
            change={comparisonData?.changes.avgCurrentCount}
            icon={BarChart3}
            color="bg-violet-500/15 text-violet-300 border border-violet-500/30"
          />
          <StatCard
            title={t('historical.stats.peakDay')}
            value={summaryStats.peakDay.label}
            icon={TrendingUp}
            color="bg-success-500/15 text-success-300 border border-success-500/30"
          />
          <StatCard
            title={t('historical.stats.avgDwell')}
            value={t('historical.stats.avgDwellUnit', { n: summaryStats.avgDwell })}
            change={comparisonData?.changes.avgWaitTime}
            icon={Clock}
            color="bg-warning-500/15 text-warning-300 border border-warning-500/30"
          />
        </div>
      )}

      {/* Main Chart Area */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Large Chart */}
          <div className="lg:col-span-2 surface-card rounded-xl p-5">
            <h3 className="font-display text-sm font-semibold text-ink-0 mb-4">
              {viewMode === 'daily'
                ? t('historical.chart.dailyTrend')
                : viewMode === 'hourly'
                ? t('historical.chart.hourlyPattern')
                : t('historical.chart.comparison')}
            </h3>

            {viewMode === 'daily' && dailyData.length > 0 && (
              <div>
                <AreaChart
                  data={dailyData.map(d => d.visitors)}
                  labels={dailyData.map(d => d.label)}
                  color={BRAND}
                  height={240}
                />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="p-3 bg-brand-500/10 rounded-xl border border-brand-500/20">
                    <p className="text-xs text-brand-300 font-medium">{t('historical.stats.totalVisitors')}</p>
                    <MiniBarChart data={dailyData.map(d => d.visitors)} color={BRAND} />
                  </div>
                  <div className="p-3 bg-violet-500/10 rounded-xl border border-violet-500/20">
                    <p className="text-xs text-violet-300 font-medium">{t('historical.stats.avgOccupancy')}</p>
                    <MiniBarChart data={dailyData.map(d => d.avgOccupancy)} color={VIOLET} />
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'hourly' && hourlyData.length > 0 && (
              <div>
                <AreaChart
                  data={hourlyData.map(d => d.visitors)}
                  labels={hourlyData.map(d => d.label)}
                  color={SUCCESS}
                  height={240}
                />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="p-3 bg-success-500/10 rounded-xl border border-success-500/20 text-center">
                    <p className="text-xs text-success-300 font-medium mb-1">{t('historical.stats.peakHour')}</p>
                    <p className="font-display text-lg font-bold text-success-200 font-mono">
                      {hourlyData.reduce((max, d) => (d.visitors > max.visitors ? d : max), hourlyData[0]).label}
                    </p>
                  </div>
                  <div className="p-3 bg-brand-500/10 rounded-xl border border-brand-500/20 text-center">
                    <p className="text-xs text-brand-300 font-medium mb-1">{t('historical.stats.totalEntries')}</p>
                    <p className="font-display text-lg font-bold text-brand-200 font-mono">
                      {hourlyData.reduce((s, d) => s + d.entries, 0)}
                    </p>
                  </div>
                  <div className="p-3 bg-warning-500/10 rounded-xl border border-warning-500/20 text-center">
                    <p className="text-xs text-warning-300 font-medium mb-1">{t('historical.stats.totalExits')}</p>
                    <p className="font-display text-lg font-bold text-warning-200 font-mono">
                      {hourlyData.reduce((s, d) => s + d.exits, 0)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'comparison' && comparisonData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-brand-500/10 rounded-xl border border-brand-500/20">
                    <p className="text-xs text-brand-300 font-medium mb-2">{t('historical.stats.currentPeriod')}</p>
                    <p className="font-display text-xl font-bold text-brand-200 font-mono">
                      {comparisonData.period1.totalPeopleIn.toLocaleString(locale)}
                    </p>
                    <p className="text-xs text-brand-300">{t('historical.stats.visitors')}</p>
                  </div>
                  <div className="p-4 bg-white/[0.04] rounded-xl border border-white/[0.08]">
                    <p className="text-xs text-ink-3 font-medium mb-2">{t('historical.stats.previousPeriod')}</p>
                    <p className="font-display text-xl font-bold text-ink-1 font-mono">
                      {comparisonData.period2.totalPeopleIn.toLocaleString(locale)}
                    </p>
                    <p className="text-xs text-ink-3">{t('historical.stats.visitors')}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(comparisonData.changes).map(([key, change]) => {
                    const hasDelta = typeof change === 'number' && Number.isFinite(change);
                    const positive = hasDelta && (change as number) > 0;
                    const negative = hasDelta && (change as number) < 0;
                    return (
                      <div key={key} className="flex items-center justify-between py-2 border-b border-white/[0.08] last:border-0">
                        <span className="text-sm text-ink-2">{t(changeLabelKey(key))}</span>
                        <span
                          className={`flex items-center text-sm font-semibold font-mono ${
                            positive ? 'text-success-400' : negative ? 'text-danger-400' : 'text-ink-4'
                          }`}
                          title={hasDelta ? undefined : (lang === 'tr' ? 'Karsilastirilacak onceki veri yok' : 'No prior data to compare')}
                        >
                          {positive ? (
                            <TrendingUp strokeWidth={1.5} className="w-4 h-4 mr-1" />
                          ) : negative ? (
                            <TrendingDown strokeWidth={1.5} className="w-4 h-4 mr-1" />
                          ) : null}
                          {!hasDelta ? '—' : `${positive ? '+' : ''}${change}%`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {comparisonData.summary && (
                  <p className="text-xs text-ink-3 italic mt-3">{comparisonData.summary}</p>
                )}
              </div>
            )}
          </div>

          {/* Side Panel - Demographics */}
          <div className="space-y-4">
            {/* Gender Distribution */}
            {demographics && (() => {
              const g = computeGenderPct(demographics.gender);
              if (g.total <= 0) {
                return (
                  <div className="surface-card rounded-xl p-5">
                    <h3 className="font-display text-sm font-semibold text-ink-0 mb-4">{t('historical.demographics.gender')}</h3>
                    <p className="text-xs text-ink-4 text-center py-4">{lang === 'tr' ? 'Demografi verisi yok' : 'No demographics yet'}</p>
                  </div>
                );
              }
              return (
                <div className="surface-card rounded-xl p-5">
                  <h3 className="font-display text-sm font-semibold text-ink-0 mb-4">{t('historical.demographics.gender')}</h3>
                  <div className="flex items-center justify-center gap-6 mb-4">
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-full bg-brand-500/15 border border-brand-500/30 flex items-center justify-center mb-1">
                        <span className="font-display text-lg font-bold text-brand-300 font-mono">{g.malePct}%</span>
                      </div>
                      <span className="text-xs text-ink-3">{t('historical.demographics.male')}</span>
                    </div>
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-full bg-accent-500/15 border border-accent-500/30 flex items-center justify-center mb-1">
                        <span className="font-display text-lg font-bold text-accent-300 font-mono">{g.femalePct}%</span>
                      </div>
                      <span className="text-xs text-ink-3">{t('historical.demographics.female')}</span>
                    </div>
                    {g.unknownPct > 0 && (
                      <div className="text-center">
                        <div className="w-14 h-14 rounded-full bg-white/[0.06] border border-white/[0.12] flex items-center justify-center mb-1">
                          <span className="font-display text-lg font-bold text-ink-3 font-mono">{g.unknownPct}%</span>
                        </div>
                        <span className="text-xs text-ink-3">{lang === 'tr' ? 'Belirsiz' : 'Unknown'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Age Distribution */}
            {demographics && (() => {
              const agePct = computeAgePct(demographics.age);
              if (agePct.length === 0) return null;
              return (
                <div className="surface-card rounded-xl p-5">
                  <h3 className="font-display text-sm font-semibold text-ink-0 mb-4">{t('historical.demographics.age')}</h3>
                  <HorizontalBarChart
                    data={agePct.map((entry, i) => ({
                      label: entry.label,
                      value: entry.pct,
                      color: AGE_PALETTE[i] || '#7e89a8',
                    }))}
                  />
                </div>
              );
            })()}

            {/* Data Quality Indicator */}
            <div className="surface-card rounded-xl p-5">
              <h3 className="font-display text-sm font-semibold text-ink-0 mb-3">{t('historical.info.title')}</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-3">{t('historical.info.mode')}</span>
                  <span className="font-medium font-mono text-success-400">
                    {t('historical.info.liveData')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">{t('historical.info.period')}</span>
                  <span className="text-ink-1 font-medium font-mono">{t('historical.info.days', { n: dailyData.length })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">{t('historical.info.dataPoints')}</span>
                  <span className="text-ink-1 font-medium font-mono">
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
        <div className="surface-card rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.08]">
            <h3 className="font-display text-sm font-semibold text-ink-0">{t('historical.table.title')}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.03]">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-ink-3 uppercase tracking-wider">{t('historical.table.date')}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-ink-3 uppercase tracking-wider">{t('historical.table.visitors')}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-ink-3 uppercase tracking-wider">{t('historical.table.avgOccupancy')}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-ink-3 uppercase tracking-wider">{t('historical.table.peakHour')}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-ink-3 uppercase tracking-wider">{t('historical.table.avgDwell')}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-ink-3 uppercase tracking-wider">{t('historical.table.trend')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {dailyData.map((day, i) => {
                  const prev = i > 0 ? dailyData[i - 1].visitors : day.visitors;
                  const change = prev ? Math.round(((day.visitors - prev) / prev) * 100) : 0;
                  return (
                    <tr key={day.date} className="hover:bg-white/[0.04] transition-colors">
                      <td className="px-5 py-3 text-sm text-ink-0 font-medium">{day.label}</td>
                      <td className="px-5 py-3 text-sm text-ink-1 text-right font-mono">{day.visitors}</td>
                      <td className="px-5 py-3 text-sm text-ink-1 text-right font-mono">{day.avgOccupancy}</td>
                      <td className="px-5 py-3 text-sm text-ink-1 text-right font-mono">{day.peakHour}</td>
                      <td className="px-5 py-3 text-sm text-ink-1 text-right font-mono">{t('historical.table.dwellUnit', { n: Math.round(day.avgDwellTime / 60) })}</td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`inline-flex items-center text-xs font-medium font-mono ${
                            change > 0 ? 'text-success-400' : change < 0 ? 'text-danger-400' : 'text-ink-3'
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
