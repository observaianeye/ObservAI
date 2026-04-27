import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Sparkles, X } from 'lucide-react';
import { cameraBackendService, type TableData, type Zone, type AnalyticsData } from '../../services/cameraBackendService';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDashboardFilter } from '../../contexts/DashboardFilterContext';
import { GlassCard } from '../ui/GlassCard';

type TableStatusUI = 'empty' | 'occupied';

type TableLayout = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: TableStatusUI;
  occupancyDuration: number;
  totalOccupiedSeconds: number;
  avgStaySeconds: number;
  turnoverCount: number;
};

function formatDuration(secs: number, lang: 'tr' | 'en'): string {
  if (!secs || secs < 1) return lang === 'tr' ? '—' : '—';
  if (secs < 60) return `${Math.round(secs)} ${lang === 'tr' ? 'sn' : 's'}`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  if (m < 60) return s > 0 ? `${m}d ${s}sn` : `${m} ${lang === 'tr' ? 'dk' : 'min'}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}sa ${rm}d`;
}

export default function TableFloorMini() {
  const { lang } = useLanguage();
  const { selectedBranch } = useDashboardFilter();
  const [tables, setTables] = useState<TableData[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const unsub = cameraBackendService.onAnalytics((data: AnalyticsData) => {
      if (Array.isArray(data.tables)) setTables(data.tables);
    });
    return () => { unsub(); };
  }, []);

  // Zones come from the Node DB (tenant-scoped to the caller's active camera).
  // Re-fetches when the dashboard branch changes so we pick up the right
  // camera angle's table layout instead of leaking zones across cameras.
  useEffect(() => {
    let cancelled = false;
    const loadFromDb = async () => {
      try {
        const branchParam = selectedBranch?.id
          ? `?branchId=${encodeURIComponent(selectedBranch.id)}`
          : '';
        const activeRes = await fetch(`/api/cameras/active${branchParam}`, { credentials: 'include' });
        if (!activeRes.ok) {
          if (!cancelled) setZones([]);
          return;
        }
        const active = await activeRes.json();
        if (!active?.id) {
          if (!cancelled) setZones([]);
          return;
        }
        const zonesRes = await fetch(`/api/zones/${active.id}`, { credentials: 'include' });
        if (!zonesRes.ok) {
          if (!cancelled) setZones([]);
          return;
        }
        const rows = await zonesRes.json() as Array<any>;
        const mapped: Zone[] = rows.map((r) => {
          const coords: Array<{ x: number; y: number }> =
            Array.isArray(r.coordinates) ? r.coordinates : [];
          const xs = coords.map((c) => c.x);
          const ys = coords.map((c) => c.y);
          const minX = xs.length ? Math.min(...xs) : 0;
          const minY = ys.length ? Math.min(...ys) : 0;
          const maxX = xs.length ? Math.max(...xs) : 0;
          const maxY = ys.length ? Math.max(...ys) : 0;
          return {
            id: r.id,
            name: r.name,
            x: minX,
            y: minY,
            width: Math.max(0, maxX - minX),
            height: Math.max(0, maxY - minY),
            type: String(r.type || 'CUSTOM').toLowerCase() as Zone['type'],
            color: r.color || '#3b82f6',
            shape: 'polygon',
            points: coords,
          };
        });
        if (!cancelled) setZones(mapped);
      } catch {
        if (!cancelled) setZones([]);
      }
    };
    loadFromDb();
    return () => { cancelled = true; };
  }, [selectedBranch?.id]);

  const layout = useMemo<TableLayout[]>(() => {
    const tableZones = zones.filter((z) => z.type === 'table');
    return tables
      .map((t) => {
        const z = tableZones.find((zz) => zz.id === t.id);
        if (!z) return null;
        // Collapse the backend's 3-state machine to 2 — needs_cleaning shows as empty here.
        const uiStatus: TableStatusUI = t.status === 'occupied' ? 'occupied' : 'empty';
        return {
          id: t.id,
          name: t.name || `T${t.id.slice(-2)}`,
          x: z.x,
          y: z.y,
          width: z.width,
          height: z.height,
          status: uiStatus,
          occupancyDuration: t.occupancyDuration ?? 0,
          totalOccupiedSeconds: t.totalOccupiedSeconds ?? 0,
          avgStaySeconds: t.avgStaySeconds ?? 0,
          turnoverCount: t.turnoverCount ?? 0,
        };
      })
      .filter((v): v is TableLayout => !!v);
  }, [tables, zones]);

  const occupiedCount = layout.filter((t) => t.status === 'occupied').length;
  const selectedTable = useMemo(() => layout.find((t) => t.id === selected) ?? null, [layout, selected]);

  return (
    <GlassCard variant="neon" className="p-5 text-ink-0">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-[0.18em] font-mono">
            {lang === 'tr' ? 'Masa Planı' : 'Floor Plan'}
          </p>
          <p className="text-[11px] text-ink-4 mt-0.5">
            {lang === 'tr'
              ? `${occupiedCount} dolu · ${layout.length - occupiedCount} boş`
              : `${occupiedCount} occupied · ${layout.length - occupiedCount} free`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-ink-3">
          <Legend color="bg-brand-400" label={lang === 'tr' ? 'Dolu' : 'Occupied'} />
          <Legend color="bg-success-400" label={lang === 'tr' ? 'Boş' : 'Free'} />
        </div>
      </div>

      {layout.length === 0 ? (
        <div className="aspect-[16/10] rounded-lg border border-white/[0.06] bg-surface-2/30 flex items-center justify-center">
          <p className="text-[11px] text-ink-4 text-center px-4">
            {lang === 'tr'
              ? 'Masa bölgesi tanımlı değil — Bölge Etiketleme sayfasından ekleyin'
              : 'No table zones — draw them in Zone Labeling'}
          </p>
        </div>
      ) : (
        <div className="relative w-full aspect-[16/10] rounded-lg border border-white/[0.06] bg-gradient-to-br from-surface-2/60 to-surface-1/40 overflow-hidden">
          <div className="absolute inset-0 grid-floor opacity-40" />
          {layout.map((tbl, idx) => {
            const isSelected = selected === tbl.id;
            const palette = tbl.status === 'occupied'
              ? 'bg-brand-500/20 border-brand-400/70'
              : 'bg-success-500/15 border-success-400/60';
            const dot = tbl.status === 'occupied'
              ? 'bg-brand-400'
              : 'bg-success-400';
            return (
              <motion.button
                key={tbl.id}
                onClick={() => setSelected(isSelected ? null : tbl.id)}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.04, type: 'spring', stiffness: 220, damping: 22 }}
                whileHover={{ scale: 1.05, zIndex: 10 }}
                whileTap={{ scale: 0.95 }}
                className={`absolute rounded-md border backdrop-blur-sm flex items-center justify-center text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/60 ${palette} ${isSelected ? 'ring-2 ring-brand-400 z-20' : ''}`}
                style={{
                  left: `${tbl.x * 100}%`,
                  top: `${tbl.y * 100}%`,
                  width: `${tbl.width * 100}%`,
                  height: `${tbl.height * 100}%`,
                }}
                aria-label={tbl.name}
              >
                {tbl.status === 'occupied' && (
                  <motion.span
                    className="absolute inset-0 rounded-md border border-brand-400/50"
                    animate={{ opacity: [0.6, 0.1, 0.6], scale: [1, 1.08, 1] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    aria-hidden
                  />
                )}
                <div className="relative flex items-center gap-1 px-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  <span className="text-[10px] font-semibold text-ink-1 truncate">{tbl.name}</span>
                </div>
              </motion.button>
            );
          })}

          <AnimatePresence>
            {selectedTable && (
              <motion.div
                key={selectedTable.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="absolute bottom-3 left-3 right-3 surface-card-elevated rounded-xl px-4 py-3 border border-white/10 backdrop-blur-xl shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        selectedTable.status === 'occupied' ? 'bg-brand-400' : 'bg-success-400'
                      }`} />
                      <p className="text-sm font-semibold text-ink-0 truncate">{selectedTable.name}</p>
                      <span className={`text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded ${
                        selectedTable.status === 'occupied' ? 'bg-brand-500/20 text-brand-200'
                          : 'bg-success-500/15 text-success-200'
                      }`}>
                        {selectedTable.status === 'occupied' ? (lang === 'tr' ? 'Dolu' : 'Occupied')
                          : (lang === 'tr' ? 'Boş' : 'Free')}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-[11px]">
                      <Stat
                        icon={<Clock className="w-3 h-3" />}
                        label={lang === 'tr' ? 'Toplam dolu' : 'Total occupied'}
                        value={formatDuration(selectedTable.totalOccupiedSeconds, lang as 'tr' | 'en')}
                      />
                      <Stat
                        icon={<Sparkles className="w-3 h-3" />}
                        label={lang === 'tr' ? 'Ort. oturum' : 'Avg stay'}
                        value={formatDuration(selectedTable.avgStaySeconds, lang as 'tr' | 'en')}
                      />
                      <Stat
                        label={lang === 'tr' ? 'Devir' : 'Turnover'}
                        value={String(selectedTable.turnoverCount)}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 rounded hover:bg-white/[0.08] text-ink-3 hover:text-ink-0 transition-colors flex-shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </GlassCard>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-ink-4 text-[10px] uppercase tracking-wider font-mono">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-ink-1 font-semibold text-xs">{value}</p>
    </div>
  );
}
