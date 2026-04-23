import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Clock, RefreshCw, Users, Coffee, UtensilsCrossed, ChefHat, Sparkles, X, LayoutGrid, Video, CheckCircle2, Loader2, UserCheck, Flame, Snowflake } from 'lucide-react';
import { cameraBackendService, type TableData, type Zone, type AnalyticsData } from '../../services/cameraBackendService';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import TableFloorLiveView from '../../components/tables/TableFloorLiveView';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface StaffOnShift {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  role?: string | null;
  shiftStart: string;
  shiftEnd: string;
}

// ─── Types & Helpers ─────────────────────────────────────────────────────────

type TableStatus = 'empty' | 'occupied' | 'needs_cleaning' | 'reserved';

const STATUS_STYLES: Record<TableStatus, {
  fill: string;
  stroke: string;
  ring: string;
  text: string;
  dot: string;
  glow: string;
  legendKey: string;
}> = {
  empty: {
    fill: 'bg-success-500/15',
    stroke: 'border-success-500/40',
    ring: 'ring-success-500/30',
    text: 'text-success-300',
    dot: 'bg-success-400',
    glow: 'shadow-[0_0_24px_-6px_rgba(34,197,94,0.45)]',
    legendKey: 'tables.legend.empty',
  },
  occupied: {
    fill: 'bg-brand-500/15',
    stroke: 'border-brand-500/50',
    ring: 'ring-brand-500/40',
    text: 'text-brand-200',
    dot: 'bg-brand-400',
    glow: 'shadow-[0_0_28px_-6px_rgba(29,107,255,0.55)]',
    legendKey: 'tables.legend.occupied',
  },
  // Simplified display: needs_cleaning shares empty's "Boş" styling on this
  // view so the floor plan is strictly two-state (Dolu / Boş) per user
  // requirement. The detail panel still surfaces cleaning workflow actions.
  needs_cleaning: {
    fill: 'bg-success-500/15',
    stroke: 'border-success-500/40',
    ring: 'ring-success-500/30',
    text: 'text-success-300',
    dot: 'bg-success-400',
    glow: 'shadow-[0_0_24px_-6px_rgba(34,197,94,0.45)]',
    legendKey: 'tables.legend.empty',
  },
  reserved: {
    fill: 'bg-violet-500/15',
    stroke: 'border-violet-500/50',
    ring: 'ring-violet-500/40',
    text: 'text-violet-300',
    dot: 'bg-violet-400',
    glow: 'shadow-[0_0_24px_-6px_rgba(154,77,255,0.45)]',
    legendKey: 'tables.legend.reserved',
  },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTimeAgo(seconds: number): string {
  const past = new Date(Date.now() - seconds * 1000);
  return past.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Derive a meal-stage timeline from occupancy duration. The backend doesn't yet
// emit explicit ordered/food events, so we approximate using research-typical
// cafe service intervals — replace with real signals once available.
function deriveMealStage(occupancySeconds: number): {
  seated: string;
  ordered: string | null;
  food: string | null;
  stage: 'seated' | 'ordered' | 'eating' | 'finishing';
} {
  const seated = formatTimeAgo(occupancySeconds);
  if (occupancySeconds < 180) {
    return { seated, ordered: null, food: null, stage: 'seated' };
  }
  if (occupancySeconds < 600) {
    return { seated, ordered: formatTimeAgo(occupancySeconds - 180), food: null, stage: 'ordered' };
  }
  if (occupancySeconds < 2400) {
    return {
      seated,
      ordered: formatTimeAgo(occupancySeconds - 180),
      food: formatTimeAgo(occupancySeconds - 600),
      stage: 'eating',
    };
  }
  return {
    seated,
    ordered: formatTimeAgo(occupancySeconds - 180),
    food: formatTimeAgo(occupancySeconds - 600),
    stage: 'finishing',
  };
}

// Derive a stable position when zone coords are missing — keeps the floor plan
// from collapsing when the backend hasn't shipped layout data yet.
function gridFallbackPosition(index: number, total: number): { x: number; y: number; width: number; height: number } {
  const cols = Math.ceil(Math.sqrt(Math.max(total, 1)));
  const rows = Math.ceil(total / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cellW = 1 / cols;
  const cellH = 1 / rows;
  const padX = cellW * 0.15;
  const padY = cellH * 0.15;
  return {
    x: col * cellW + padX,
    y: row * cellH + padY,
    width: cellW - padX * 2,
    height: cellH - padY * 2,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

type ViewMode = 'schematic' | 'live';

export default function TableOccupancyPage() {
  const { t, lang } = useLanguage();
  const { showToast } = useToast();
  const [tables, setTables] = useState<TableData[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('schematic');
  const [latestAnalytics, setLatestAnalytics] = useState<AnalyticsData | null>(null);
  const [staffOnShift, setStaffOnShift] = useState<StaffOnShift[]>([]);
  const [cleaningInProgress, setCleaningInProgress] = useState<Set<string>>(new Set());

  const handleAnalytics = useCallback((data: AnalyticsData) => {
    setLatestAnalytics(data);
    if (data.tables && Array.isArray(data.tables)) {
      setTables(data.tables);
      setConnected(true);
      setLastUpdate(new Date());
    }
  }, []);

  // Restrict the floor plan to zones whose type is actually 'table'. The
  // Python WebSocket payload can include entrance/exit/queue zones and the
  // previous fallback would render them as tables — the rapor #3 bug where
  // Entrance/Exit cards showed up under "Floor Plan" with occupancy 100%.
  const tableZoneIds = useMemo(() => {
    const ids = new Set<string>();
    for (const z of zones) if (z.type === 'table') ids.add(z.id);
    return ids;
  }, [zones]);

  const tableRows = useMemo(() => {
    if (zones.length === 0) return tables; // zones list not loaded yet — pass through
    return tables.filter((t) => tableZoneIds.has(t.id));
  }, [tables, zones, tableZoneIds]);

  useEffect(() => {
    const unsub = cameraBackendService.onAnalytics(handleAnalytics);
    const statusUnsub = cameraBackendService.onConnectionStatus((status: string) => {
      setConnected(status === 'connected');
    });
    cameraBackendService.getZones?.().then(setZones).catch(() => { /* zones optional */ });
    return () => { unsub(); statusUnsub(); };
  }, [handleAnalytics]);

  // Load staff on today's shift
  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    fetch(`${API_URL}/api/staff-assignments?from=${todayStr}&to=${todayStr}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.assignments) return;
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const currentlyOnShift: StaffOnShift[] = [];
        for (const a of data.assignments) {
          const [sh, sm] = a.shiftStart.split(':').map(Number);
          const [eh, em] = a.shiftEnd.split(':').map(Number);
          const start = sh * 60 + sm;
          const end = eh * 60 + em;
          const inShift = start <= end
            ? (nowMin >= start && nowMin < end)
            : (nowMin >= start || nowMin < end);
          if (inShift && a.status !== 'declined') {
            currentlyOnShift.push({
              id: a.id,
              staffId: a.staff.id,
              firstName: a.staff.firstName,
              lastName: a.staff.lastName,
              role: a.role ?? a.staff.role,
              shiftStart: a.shiftStart,
              shiftEnd: a.shiftEnd,
            });
          }
        }
        setStaffOnShift(currentlyOnShift);
      })
      .catch(() => { /* silent — endpoint may be unauthenticated session */ });
  }, []);

  // Mark table cleaned — hits backend PATCH which queues override for Python
  const markCleaned = useCallback(async (zoneId: string, cameraId: string) => {
    setCleaningInProgress((prev) => { const s = new Set(prev); s.add(zoneId); return s; });
    try {
      const res = await fetch(`${API_URL}/api/tables/${zoneId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cameraId, status: 'empty' }),
      });
      if (res.ok) {
        showToast('success', lang === 'tr' ? 'Masa temizlendi olarak isaretlendi' : 'Table marked as cleaned');
        // Optimistic update — analytics push will confirm shortly
        setTables((prev) => prev.map((t) => (t.id === zoneId ? { ...t, status: 'empty' } : t)));
      } else {
        const data = await res.json().catch(() => ({}));
        showToast('error', data.error || 'Failed to mark cleaned');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Network error');
    } finally {
      setCleaningInProgress((prev) => { const s = new Set(prev); s.delete(zoneId); return s; });
    }
  }, [showToast, lang]);

  // Build the layout: prefer backend zone coords, fall back to derived grid.
  const layout = useMemo(() => {
    const tableZones = zones.filter(z => z.type === 'table');
    return tableRows.map((tbl, i) => {
      const zone = tableZones.find(z => z.id === tbl.id);
      const pos = zone
        ? { x: zone.x, y: zone.y, width: zone.width, height: zone.height }
        : gridFallbackPosition(i, tableRows.length);
      return { ...tbl, ...pos, hasRealCoords: !!zone };
    });
  }, [tableRows, zones]);

  // KPIs — derived from filtered TABLE rows only.
  const occupied = tableRows.filter(t => t.status === 'occupied').length;
  const empty = tableRows.filter(t => t.status === 'empty').length;
  const needsCleaning = tableRows.filter(t => t.status === 'needs_cleaning').length;
  const occupancyPct = tableRows.length > 0 ? Math.round((occupied / tableRows.length) * 100) : 0;
  const totalTurnover = tableRows.reduce((sum, t) => sum + t.turnoverCount, 0);
  const avgStay = tableRows.length > 0
    ? tableRows.reduce((sum, t) => sum + t.avgStaySeconds, 0) / tableRows.length
    : 0;
  const avgRotationPerTable = tableRows.length > 0
    ? Math.round((totalTurnover / tableRows.length) * 10) / 10
    : 0;

  // Design-System KPIs: pick the single busiest / idlest table so shift
  // managers see actionable names, not just totals. Hottest = most turnover
  // today (tiebreaker: longest current occupancy). Dead = zero turnover AND
  // zero current occupants (truly idle).
  const hottestTable = useMemo(() => {
    if (tableRows.length === 0) return null;
    const sorted = [...tableRows].sort((a, b) => {
      if (b.turnoverCount !== a.turnoverCount) return b.turnoverCount - a.turnoverCount;
      return (b.occupancyDuration || 0) - (a.occupancyDuration || 0);
    });
    return sorted[0].turnoverCount > 0 || (sorted[0].occupancyDuration || 0) > 0 ? sorted[0] : null;
  }, [tableRows]);

  const deadTable = useMemo(() => {
    const idle = tableRows.filter(t => t.turnoverCount === 0 && t.currentOccupants === 0);
    if (idle.length === 0) return null;
    // Pick the one with the longest-standing emptiness signal (proxy: smallest
    // avgStaySeconds indicates history of short visits / ignored spot).
    return idle.slice().sort((a, b) => (a.avgStaySeconds || 0) - (b.avgStaySeconds || 0))[0];
  }, [tableRows]);

  // Heatmap intensity per table — uses occupancyDuration normalized by the longest seen.
  const maxDuration = Math.max(...tableRows.map(t => t.occupancyDuration), 1);

  const selected = useMemo(
    () => tableRows.find(t => t.id === selectedId) || null,
    [tableRows, selectedId]
  );

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-ink-1">{t('tables.title')}</h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              connected
                ? 'bg-success-500/10 text-success-300 border-success-500/30'
                : 'bg-danger-500/10 text-danger-300 border-danger-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success-400 animate-pulse' : 'bg-danger-400'}`} />
              {connected ? t('common.live') : t('common.offline')}
            </span>
          </div>
          <p className="text-sm text-ink-3">{t('tables.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 p-0.5">
            <button
              onClick={() => setViewMode('schematic')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'schematic'
                  ? 'bg-brand-500/20 text-brand-100'
                  : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {lang === 'tr' ? 'Semalar' : 'Schematic'}
            </button>
            <button
              onClick={() => setViewMode('live')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'live'
                  ? 'bg-brand-500/20 text-brand-100'
                  : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              {lang === 'tr' ? 'Canli' : 'Live'}
            </button>
          </div>

          {viewMode === 'schematic' && (
            <button
              onClick={() => setShowHeatmap(s => !s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showHeatmap
                  ? 'bg-brand-500/10 text-brand-200 border-brand-500/30'
                  : 'bg-white/5 text-ink-3 border-white/10 hover:text-ink-2'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Heatmap
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Bar ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Users}
          label={t('tables.kpi.occupancy')}
          value={`${occupancyPct}%`}
          sub={`${occupied} / ${tableRows.length}`}
          accent="brand"
        />
        <KpiCard
          icon={Clock}
          label={lang === 'tr' ? 'Ort. turnover' : 'Avg turnover'}
          value={avgStay > 0 ? formatDuration(avgStay) : '—'}
          sub={`${tableRows.length} ${t('tables.title').toLowerCase()}`}
          accent="violet"
        />
        <KpiCard
          icon={RefreshCw}
          label={lang === 'tr' ? 'Rotasyon / masa' : 'Rotation / table'}
          value={String(avgRotationPerTable)}
          sub={`${totalTurnover} ${lang === 'tr' ? 'toplam bugun' : 'total today'}`}
          accent="accent"
        />
        <KpiCard
          icon={Sparkles}
          label={t('tables.legend.cleaning')}
          value={String(needsCleaning)}
          sub={`${empty} ${t('tables.legend.empty').toLowerCase()}`}
          accent="warning"
        />
      </div>

      {/* ── Design-System secondary KPIs: HOTTEST + DEAD ──────────── */}
      {(hottestTable || deadTable) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {hottestTable && (
            <HighlightCard
              icon={Flame}
              kicker={lang === 'tr' ? 'EN YOGUN MASA' : 'HOTTEST TABLE'}
              title={hottestTable.name || `T${hottestTable.id.slice(-2)}`}
              metric={`${hottestTable.turnoverCount}×/day`}
              hint={hottestTable.avgStaySeconds > 0
                ? `${formatDuration(hottestTable.avgStaySeconds)} ${lang === 'tr' ? 'ort. turnover' : 'avg turnover'}`
                : undefined}
              tone="warm"
            />
          )}
          {deadTable && (
            <HighlightCard
              icon={Snowflake}
              kicker={lang === 'tr' ? 'OLU BOLGE' : 'DEAD ZONE'}
              title={deadTable.name || `T${deadTable.id.slice(-2)}`}
              metric={lang === 'tr' ? 'Bugun hic kullanilmadi' : 'Unused today'}
              hint={lang === 'tr' ? 'Yer degisikligi veya promosyon dusun' : 'Consider relocation or promo'}
              tone="cold"
            />
          )}
        </div>
      )}

      {/* ── Main: Live view vs Schematic (tab-switched) ───────────── */}
      {viewMode === 'live' ? (
        <TableFloorLiveView
          cameraId="default"
          tables={tables}
          zones={zones}
          latest={latestAnalytics}
          connected={connected}
        />
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">

        {/* Floor plan card */}
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-ink-1">{t('tables.layout.title')}</h3>
              <p className="text-[11px] text-ink-3 mt-0.5">{t('tables.layout.subtitle')}</p>
            </div>
            {lastUpdate && (
              <span className="text-[11px] text-ink-4">
                {t('tables.layout.lastUpdated', { time: lastUpdate.toLocaleTimeString() })}
              </span>
            )}
          </div>

          {/* Floor plan canvas — 16:9 to match a typical camera frame */}
          {tables.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="relative w-full aspect-[16/9] bg-surface-2/40 rounded-xl border border-white/5 overflow-hidden">
              {/* Grid floor backdrop */}
              <div className="absolute inset-0 grid-floor opacity-40" />

              {/* Heatmap layer */}
              {showHeatmap && (
                <div className="absolute inset-0 pointer-events-none">
                  {layout.map(tbl => {
                    if (tbl.occupancyDuration <= 0) return null;
                    const intensity = tbl.occupancyDuration / maxDuration;
                    return (
                      <div
                        key={`heat-${tbl.id}`}
                        className="absolute rounded-full blur-2xl"
                        style={{
                          left: `${(tbl.x + tbl.width / 2) * 100}%`,
                          top: `${(tbl.y + tbl.height / 2) * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          width: `${Math.max(tbl.width * 100 * 1.4, 12)}%`,
                          height: `${Math.max(tbl.height * 100 * 1.4, 12)}%`,
                          background: `radial-gradient(circle, rgba(255,${Math.round(120 - 80 * intensity)},${Math.round(80 - 60 * intensity)},${0.35 + intensity * 0.45}) 0%, transparent 70%)`,
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Tables */}
              {layout.map(tbl => {
                const status = (tbl.status as TableStatus) || 'empty';
                const style = STATUS_STYLES[status] || STATUS_STYLES.empty;
                const isSelected = selectedId === tbl.id;
                return (
                  <motion.button
                    key={tbl.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedId(tbl.id)}
                    className={`absolute rounded-xl border ${style.fill} ${style.stroke} ${style.glow} backdrop-blur-sm transition-all flex flex-col items-center justify-center text-center p-2 ${
                      isSelected ? `ring-2 ${style.ring} z-10` : ''
                    }`}
                    style={{
                      left: `${tbl.x * 100}%`,
                      top: `${tbl.y * 100}%`,
                      width: `${tbl.width * 100}%`,
                      height: `${tbl.height * 100}%`,
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      <span className="text-[11px] font-bold text-ink-1 truncate">
                        {tbl.name || `T${tbl.id.slice(-2)}`}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Legend — strict two-state (Dolu/Boş) per user request */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px]">
            {(['empty', 'occupied'] as TableStatus[]).map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${STATUS_STYLES[s].dot}`} />
                <span className="text-ink-3">{t(STATUS_STYLES[s].legendKey)}</span>
              </div>
            ))}
            <span className="ml-auto text-ink-4">
              {tables.some(t => layout.find(l => l.id === t.id)?.hasRealCoords)
                ? null
                : <span className="italic">grid fallback · {lang === 'tr' ? 'kamera layoutu bekleniyor' : 'awaiting camera layout'}</span>}
            </span>
          </div>
        </div>

        {/* Detail panel */}
        <div className="surface-card p-5">
          {selected ? (
            <DetailPanel
              table={selected}
              staffOnShift={staffOnShift}
              onClose={() => setSelectedId(null)}
              onMarkCleaned={() => markCleaned(selected.id, 'default')}
              isCleaning={cleaningInProgress.has(selected.id)}
              t={t}
              lang={lang}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="w-12 h-12 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center mb-3">
                <Coffee className="w-5 h-5 text-brand-300" />
              </div>
              <p className="text-sm font-medium text-ink-2">{t('tables.click')}</p>
              <p className="text-[11px] text-ink-3 mt-1 max-w-[220px]">
                {lang === 'tr'
                  ? 'Detayli durum, oturma suresi ve servis asamasi icin masa secin.'
                  : 'Pick a table to see live state, dwell time and service stage.'}
              </p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent: 'brand' | 'violet' | 'accent' | 'warning';
}) {
  const accentMap = {
    brand: 'bg-brand-500/10 text-brand-300 border-brand-500/20',
    violet: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    accent: 'bg-accent-500/10 text-accent-300 border-accent-500/20',
    warning: 'bg-warning-500/10 text-warning-300 border-warning-500/20',
  } as const;

  return (
    <div className="surface-card p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${accentMap[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-[11px] uppercase tracking-wider text-ink-4 font-medium">{label}</p>
      <p className="text-2xl font-bold text-ink-1 mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-ink-3 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Highlight Card (Design System: HOTTEST / DEAD) ─────────────────────────

function HighlightCard({
  icon: Icon,
  kicker,
  title,
  metric,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  kicker: string;
  title: string;
  metric: string;
  hint?: string;
  tone: 'warm' | 'cold';
}) {
  const toneClasses = tone === 'warm'
    ? 'from-warning-500/15 via-warning-500/5 to-transparent border-warning-500/30'
    : 'from-brand-500/10 via-brand-500/5 to-transparent border-brand-500/20';
  const iconClasses = tone === 'warm'
    ? 'bg-warning-500/20 text-warning-300 border-warning-500/40'
    : 'bg-brand-500/15 text-brand-300 border-brand-500/30';
  return (
    <div className={`relative overflow-hidden surface-card border bg-gradient-to-br ${toneClasses} p-5 rounded-2xl`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${iconClasses}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-ink-4 font-semibold font-mono">{kicker}</p>
          <p className="text-lg font-bold text-ink-0 mt-0.5 truncate">{title}</p>
          <p className="text-sm font-semibold text-ink-2 mt-0.5 font-mono">{metric}</p>
          {hint && <p className="text-[11px] text-ink-3 mt-1">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel ────────────────────────────────────────────────────────────

function DetailPanel({
  table,
  staffOnShift,
  onClose,
  onMarkCleaned,
  isCleaning,
  t,
  lang,
}: {
  table: TableData;
  staffOnShift: StaffOnShift[];
  onClose: () => void;
  onMarkCleaned: () => void;
  isCleaning: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  lang: string;
}) {
  const status = (table.status as TableStatus) || 'empty';
  const style = STATUS_STYLES[status];
  const meal = table.status === 'occupied' ? deriveMealStage(table.occupancyDuration) : null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={table.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-4 font-medium">
              {t('tables.title')}
            </p>
            <h3 className="text-xl font-bold text-ink-1 mt-0.5">{table.name || table.id}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink-1 hover:bg-white/5 transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status pill */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${style.fill} ${style.stroke} border ${style.text} text-xs font-medium mb-4`}>
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${status === 'needs_cleaning' ? 'animate-pulse' : ''}`} />
          {t(style.legendKey)}
        </div>

        {/* Cleaning action */}
        {status === 'needs_cleaning' && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={onMarkCleaned}
            disabled={isCleaning}
            className="w-full mb-4 px-4 py-2.5 bg-gradient-to-r from-success-500 to-success-600 text-white rounded-xl font-semibold hover:shadow-[0_0_18px_-4px_rgba(34,197,94,0.6)] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isCleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isCleaning
              ? (lang === 'tr' ? 'Isleniyor...' : 'Working...')
              : (lang === 'tr' ? 'Temizlendi' : 'Mark as cleaned')}
          </motion.button>
        )}

        {/* Stat rows */}
        <div className="space-y-3 text-sm">
          <DetailRow label={t('tables.detail.state')} value={t(style.legendKey)} />

          {table.status === 'occupied' && meal && (
            <>
              <MealStageBar stage={meal.stage} />
              <DetailRow icon={Coffee} label={t('tables.detail.seated')} value={meal.seated} />
              <DetailRow icon={UtensilsCrossed} label={t('tables.detail.ordered')} value={meal.ordered ?? '—'} muted={!meal.ordered} />
              <DetailRow icon={ChefHat} label={t('tables.detail.food')} value={meal.food ?? '—'} muted={!meal.food} />
              <DetailRow icon={Users} label={t('tables.detail.diners')} value={String(table.currentOccupants)} />
              <DetailRow label={t('tables.detail.duration')} value={formatDuration(table.occupancyDuration)} />
            </>
          )}

          <div className="border-t border-white/5 pt-3 mt-3 space-y-3">
            <DetailRow label={t('tables.kpi.avgStay')} value={table.avgStaySeconds > 0 ? formatDuration(table.avgStaySeconds) : '—'} />
            <DetailRow label={t('tables.kpi.turnover')} value={String(table.turnoverCount)} />
          </div>

          {/* Staff on shift now */}
          {staffOnShift.length > 0 && (
            <div className="border-t border-white/5 pt-3 mt-3">
              <p className="text-[11px] uppercase tracking-wider text-ink-4 font-medium mb-2 flex items-center gap-1.5">
                <UserCheck className="w-3 h-3" />
                {lang === 'tr' ? 'Vardiyadaki personel' : 'Staff on shift'}
              </p>
              <div className="space-y-1.5">
                {staffOnShift.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-ink-2 truncate">{s.firstName} {s.lastName}</span>
                    <span className="text-ink-4 font-mono text-[10px]">{s.shiftStart}–{s.shiftEnd}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  muted = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-ink-3 text-xs">
        {Icon && <Icon className="w-3.5 h-3.5 text-ink-4" />}
        {label}
      </span>
      <span className={`font-medium ${muted ? 'text-ink-4' : 'text-ink-1'}`}>{value}</span>
    </div>
  );
}

function MealStageBar({ stage }: { stage: 'seated' | 'ordered' | 'eating' | 'finishing' }) {
  const stages: Array<typeof stage> = ['seated', 'ordered', 'eating', 'finishing'];
  const activeIndex = stages.indexOf(stage);
  return (
    <div className="flex items-center gap-1 my-2">
      {stages.map((s, i) => (
        <div
          key={s}
          className={`flex-1 h-1.5 rounded-full transition-colors ${
            i <= activeIndex
              ? 'bg-gradient-to-r from-brand-500 to-accent-500'
              : 'bg-white/5'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  const { lang } = useLanguage();
  return (
    <div className="bg-surface-2/40 rounded-xl border border-white/5 p-12 text-center">
      <div className="w-14 h-14 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center mx-auto mb-3">
        <Coffee className="w-6 h-6 text-brand-300" />
      </div>
      <p className="text-base font-medium text-ink-2">
        {lang === 'tr' ? 'Henüz masa verisi yok' : 'No table data yet'}
      </p>
      <p className="text-xs text-ink-3 mt-2 max-w-md mx-auto">
        {lang === 'tr'
          ? 'Bölge etiketleme sayfasında "Masa" tipinde bölge çizin. AI otomatik olarak doluluk durumunu takip etmeye başlar.'
          : 'Draw a "Table" zone in Zone Labeling. AI will start tracking occupancy automatically.'}
      </p>
    </div>
  );
}
