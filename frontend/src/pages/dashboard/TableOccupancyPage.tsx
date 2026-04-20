import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Clock, RefreshCw, Users, Coffee, UtensilsCrossed, ChefHat, Sparkles, X } from 'lucide-react';
import { cameraBackendService, type TableData, type Zone } from '../../services/cameraBackendService';
import { useLanguage } from '../../contexts/LanguageContext';

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
  needs_cleaning: {
    fill: 'bg-warning-500/15',
    stroke: 'border-warning-500/50',
    ring: 'ring-warning-500/40',
    text: 'text-warning-300',
    dot: 'bg-warning-400',
    glow: 'shadow-[0_0_24px_-6px_rgba(234,179,8,0.45)]',
    legendKey: 'tables.legend.cleaning',
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

export default function TableOccupancyPage() {
  const { t, lang } = useLanguage();
  const [tables, setTables] = useState<TableData[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const handleAnalytics = useCallback((data: any) => {
    if (data.tables && Array.isArray(data.tables)) {
      setTables(data.tables);
      setConnected(true);
      setLastUpdate(new Date());
    }
  }, []);

  useEffect(() => {
    const unsub = cameraBackendService.onAnalytics(handleAnalytics);
    const statusUnsub = cameraBackendService.onConnectionStatus((status: string) => {
      setConnected(status === 'connected');
    });
    cameraBackendService.getZones?.().then(setZones).catch(() => { /* zones optional */ });
    return () => { unsub(); statusUnsub(); };
  }, [handleAnalytics]);

  // Build the layout: prefer backend zone coords, fall back to derived grid.
  const layout = useMemo(() => {
    const tableZones = zones.filter(z => z.type === 'table');
    return tables.map((tbl, i) => {
      const zone = tableZones.find(z => z.id === tbl.id);
      const pos = zone
        ? { x: zone.x, y: zone.y, width: zone.width, height: zone.height }
        : gridFallbackPosition(i, tables.length);
      return { ...tbl, ...pos, hasRealCoords: !!zone };
    });
  }, [tables, zones]);

  // KPIs
  const occupied = tables.filter(t => t.status === 'occupied').length;
  const empty = tables.filter(t => t.status === 'empty').length;
  const needsCleaning = tables.filter(t => t.status === 'needs_cleaning').length;
  const occupancyPct = tables.length > 0 ? Math.round((occupied / tables.length) * 100) : 0;
  const totalTurnover = tables.reduce((sum, t) => sum + t.turnoverCount, 0);
  const avgStay = tables.length > 0
    ? tables.reduce((sum, t) => sum + t.avgStaySeconds, 0) / tables.length
    : 0;

  // Heatmap intensity per table — uses occupancyDuration normalized by the longest seen.
  const maxDuration = Math.max(...tables.map(t => t.occupancyDuration), 1);

  const selected = useMemo(
    () => tables.find(t => t.id === selectedId) || null,
    [tables, selectedId]
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
        </div>
      </div>

      {/* ── KPI Bar ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Users}
          label={t('tables.kpi.occupancy')}
          value={`${occupancyPct}%`}
          sub={`${occupied} / ${tables.length}`}
          accent="brand"
        />
        <KpiCard
          icon={Clock}
          label={t('tables.kpi.avgStay')}
          value={avgStay > 0 ? formatDuration(avgStay) : '—'}
          sub={`${tables.length} ${t('tables.title').toLowerCase()}`}
          accent="violet"
        />
        <KpiCard
          icon={RefreshCw}
          label={t('tables.kpi.turnover')}
          value={String(totalTurnover)}
          sub={lang === 'tr' ? 'bugun' : 'today'}
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

      {/* ── Main: Floor plan + Detail panel ──────────────────────── */}
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
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${tbl.status === 'needs_cleaning' ? 'animate-pulse' : ''}`} />
                      <span className="text-[11px] font-bold text-ink-1 truncate">
                        {tbl.name || `T${tbl.id.slice(-2)}`}
                      </span>
                    </div>
                    {tbl.status === 'occupied' && (
                      <div className="flex items-center gap-1 text-[10px] text-ink-2">
                        <Users className="w-2.5 h-2.5" />
                        <span>{tbl.currentOccupants}</span>
                        <span className="text-ink-4">·</span>
                        <span>{formatDuration(tbl.occupancyDuration)}</span>
                      </div>
                    )}
                    {tbl.status === 'needs_cleaning' && (
                      <span className="text-[9px] uppercase tracking-wide text-warning-300">{t('tables.legend.cleaning')}</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px]">
            {(['empty', 'occupied', 'needs_cleaning', 'reserved'] as TableStatus[]).map(s => (
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
              onClose={() => setSelectedId(null)}
              t={t}
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

// ─── Detail Panel ────────────────────────────────────────────────────────────

function DetailPanel({
  table,
  onClose,
  t,
}: {
  table: TableData;
  onClose: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
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
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
          {t(style.legendKey)}
        </div>

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
