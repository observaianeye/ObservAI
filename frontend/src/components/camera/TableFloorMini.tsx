import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Users, DoorOpen, LogOut } from 'lucide-react';
import { cameraBackendService, type TableData, type Zone, type AnalyticsData } from '../../services/cameraBackendService';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDashboardFilter } from '../../contexts/DashboardFilterContext';
import { GlassCard } from '../ui/GlassCard';

const CROWD_THRESHOLD = 10;

type ZoneType = 'table' | 'queue' | 'entrance' | 'exit' | 'custom';
type TableStatusUI = 'empty' | 'occupied';

type RenderedZone = {
  id: string;
  name: string;
  type: ZoneType;
  points: Array<{ x: number; y: number }>;
  centroid: { x: number; y: number };
  bbox: { x: number; y: number; width: number; height: number };
  status?: TableStatusUI;
  occupants?: number;
  crowded?: boolean;
};

function centroidOf(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (!points.length) return { x: 0.5, y: 0.5 };
  let sx = 0, sy = 0;
  for (const p of points) { sx += p.x; sy += p.y; }
  return { x: sx / points.length, y: sy / points.length };
}

function bboxOf(points: Array<{ x: number; y: number }>): { x: number; y: number; width: number; height: number } {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
}

function pointsToSvgPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`).join(' ') + ' Z';
}

export default function TableFloorMini() {
  const { lang } = useLanguage();
  const { selectedBranch } = useDashboardFilter();
  const [tables, setTables] = useState<TableData[]>([]);
  const [zoneOccupancy, setZoneOccupancy] = useState<Record<string, number>>({});
  const [globalQueue, setGlobalQueue] = useState(0);
  const [zones, setZones] = useState<Zone[]>([]);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const bg = localStorage.getItem('zoneLabelingBackground');
      if (bg) setSnapshot(bg);
    } catch { /* ignore */ }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'zoneLabelingBackground') setSnapshot(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const unsub = cameraBackendService.onAnalytics((data: AnalyticsData) => {
      if (Array.isArray(data.tables)) setTables(data.tables);
      if (Array.isArray(data.zones)) {
        const map: Record<string, number> = {};
        for (const z of data.zones) map[z.id] = z.currentOccupants ?? 0;
        setZoneOccupancy(map);
      }
      if (typeof data.queue === 'number') setGlobalQueue(data.queue);
    });
    return () => { unsub(); };
  }, []);

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

  const rendered = useMemo<RenderedZone[]>(() => {
    return zones.map((z) => {
      const points = z.points && z.points.length
        ? z.points
        : [
            { x: z.x, y: z.y },
            { x: z.x + z.width, y: z.y },
            { x: z.x + z.width, y: z.y + z.height },
            { x: z.x, y: z.y + z.height },
          ];
      const centroid = centroidOf(points);
      const bbox = bboxOf(points);
      const r: RenderedZone = {
        id: z.id,
        name: z.name,
        type: (z.type as ZoneType) ?? 'custom',
        points,
        centroid,
        bbox,
      };
      if (z.type === 'table') {
        const t = tables.find((tt) => tt.id === z.id);
        r.status = t && t.status === 'occupied' ? 'occupied' : 'empty';
      } else if (z.type === 'queue' || z.type === 'entrance' || z.type === 'exit') {
        const occ = zoneOccupancy[z.id] ?? (z.type === 'queue' ? globalQueue : 0);
        r.occupants = occ;
        if (occ > CROWD_THRESHOLD) {
          r.crowded = true;
        }
      }
      return r;
    });
  }, [zones, tables, zoneOccupancy, globalQueue]);

  const tableSummary = useMemo(() => {
    const ts = rendered.filter((r) => r.type === 'table');
    return {
      occupied: ts.filter((t) => t.status === 'occupied').length,
      free: ts.filter((t) => t.status === 'empty').length,
      total: ts.length,
    };
  }, [rendered]);

  const crowdedZones = useMemo(() => rendered.filter((r) => r.crowded), [rendered]);
  const selectedZone = useMemo(() => rendered.find((r) => r.id === selectedZoneId) ?? null, [rendered, selectedZoneId]);
  const empty = rendered.length === 0;

  return (
    <GlassCard variant="neon" className="p-5 text-ink-0">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-[0.18em] font-mono">
            {lang === 'tr' ? 'Yerleşim Planı' : 'Floor Plan'}
          </p>
          <p className="text-[11px] text-ink-4 mt-0.5 truncate">
            {lang === 'tr'
              ? `${tableSummary.occupied} dolu · ${tableSummary.free} boş`
              : `${tableSummary.occupied} occupied · ${tableSummary.free} free`}
            {crowdedZones.length > 0 && (
              <span className="text-danger-300 font-semibold ml-1">
                {lang === 'tr' ? `· ${crowdedZones.length} aşırı kalabalık` : `· ${crowdedZones.length} crowded`}
              </span>
            )}
          </p>
        </div>
        <div className="hidden sm:flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-ink-3">
          <Legend dotClass="bg-danger-400" label={lang === 'tr' ? 'Dolu' : 'Occupied'} />
          <Legend dotClass="bg-success-400" label={lang === 'tr' ? 'Boş' : 'Free'} />
          <Legend dotClass="bg-warning-400" label={lang === 'tr' ? 'Sıra' : 'Queue'} />
          <Legend dotClass="bg-cyan-400" label={lang === 'tr' ? 'Giriş' : 'Entry'} />
        </div>
      </div>

      {empty ? (
        <div className="aspect-video rounded-lg border border-white/[0.06] bg-surface-2/30 flex items-center justify-center">
          <p className="text-[11px] text-ink-4 text-center px-4">
            {lang === 'tr'
              ? 'Bölge tanımlı değil — Bölge Etiketleme sayfasından çizin'
              : 'No zones defined — draw them in Zone Labeling'}
          </p>
        </div>
      ) : (
        <div className="relative w-full aspect-video rounded-lg border border-white/[0.06] bg-gradient-to-br from-surface-2/60 to-surface-1/40 overflow-hidden">
          {snapshot && (
            <img
              src={snapshot}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover opacity-20"
              style={{ filter: 'grayscale(1) contrast(0.9) brightness(0.55) hue-rotate(190deg) saturate(1.3)' }}
            />
          )}
          <div className="absolute inset-0 grid-floor opacity-30" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at top, rgba(96,165,250,0.08), transparent 60%), radial-gradient(ellipse at bottom right, rgba(34,211,238,0.05), transparent 50%)',
            }}
          />

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
          >
            <defs>
              <filter id="zone-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="0.7" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <pattern id="diag-danger" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="2.4" stroke="#f87171" strokeWidth="0.5" opacity="0.55" />
              </pattern>
              <pattern id="diag-occupied" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="2.6" stroke="#f87171" strokeWidth="0.45" opacity="0.55" />
              </pattern>
            </defs>

            {rendered.map((r) => {
              const path = pointsToSvgPath(r.points);
              const stroke = zoneStroke(r);
              const fill = zoneFill(r);
              const isClickable = r.type === 'table' || r.type === 'queue' || r.type === 'entrance';
              const overlay = r.crowded
                ? 'url(#diag-danger)'
                : r.type === 'table' && r.status === 'occupied'
                ? 'url(#diag-occupied)'
                : null;
              return (
                <g
                  key={r.id}
                  onClick={() => isClickable && setSelectedZoneId(selectedZoneId === r.id ? null : r.id)}
                  style={{ cursor: isClickable ? 'pointer' : 'default' }}
                  filter={r.crowded ? 'url(#zone-glow)' : undefined}
                >
                  <path
                    d={path}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={r.crowded ? 0.85 : 0.45}
                    strokeOpacity={0.95}
                    strokeLinejoin="round"
                  />
                  {overlay && <path d={path} fill={overlay} stroke="none" />}
                  {r.crowded && (
                    <path d={path} fill="none" stroke={stroke} strokeWidth={1.2} strokeOpacity={0.5}>
                      <animate attributeName="stroke-opacity" values="0.6;0.05;0.6" dur="1.4s" repeatCount="indefinite" />
                    </path>
                  )}
                  {r.type === 'table' && r.status === 'occupied' && !r.crowded && (
                    <path d={path} fill="none" stroke={stroke} strokeWidth={0.4}>
                      <animate attributeName="stroke-opacity" values="0.7;0.15;0.7" dur="2.6s" repeatCount="indefinite" />
                    </path>
                  )}
                </g>
              );
            })}
          </svg>

          {rendered.map((r) => (
            <ZoneLabel
              key={`lbl-${r.id}`}
              zone={r}
              isSelected={selectedZoneId === r.id}
            />
          ))}

          <AnimatePresence>
            {crowdedZones.length > 0 && !selectedZone && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="absolute top-2.5 left-2.5 right-2.5 flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-500/20 border border-danger-500/40 backdrop-blur-md shadow-lg"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-danger-300 flex-shrink-0" />
                <p className="text-[11px] text-danger-100 truncate">
                  {lang === 'tr'
                    ? `Aşırı kalabalık: ${crowdedZones.map((z) => z.name).join(', ')}`
                    : `Overcrowded: ${crowdedZones.map((z) => z.name).join(', ')}`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedZone && (
              <motion.div
                key={selectedZone.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="absolute bottom-3 left-3 right-3 surface-card-elevated rounded-xl px-4 py-3 border border-white/10 backdrop-blur-xl shadow-2xl"
              >
                {selectedZone.type === 'table' ? (
                  <TableDetail
                    z={selectedZone}
                    lang={lang as 'tr' | 'en'}
                    onClose={() => setSelectedZoneId(null)}
                  />
                ) : (
                  <CrowdDetail
                    z={selectedZone}
                    lang={lang as 'tr' | 'en'}
                    threshold={CROWD_THRESHOLD}
                    onClose={() => setSelectedZoneId(null)}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </GlassCard>
  );
}

function zoneStroke(r: RenderedZone): string {
  if (r.crowded) return '#f87171';
  switch (r.type) {
    case 'table': return r.status === 'occupied' ? '#f87171' : '#34d399';
    case 'queue': return '#fbbf24';
    case 'entrance': return '#22d3ee';
    case 'exit': return '#a78bfa';
    default: return '#94a3b8';
  }
}

function zoneFill(r: RenderedZone): string {
  if (r.crowded) return 'rgba(248,113,113,0.32)';
  switch (r.type) {
    case 'table':
      return r.status === 'occupied' ? 'rgba(248,113,113,0.32)' : 'rgba(52,211,153,0.14)';
    case 'queue': return 'rgba(251,191,36,0.16)';
    case 'entrance': return 'rgba(34,211,238,0.16)';
    case 'exit': return 'rgba(167,139,250,0.12)';
    default: return 'rgba(148,163,184,0.10)';
  }
}

function ZoneLabel({ zone, isSelected }: { zone: RenderedZone; isSelected: boolean }) {
  const cx = zone.centroid.x * 100;
  const cy = zone.centroid.y * 100;
  const isTable = zone.type === 'table';

  const dotColor = zone.crowded
    ? 'bg-danger-400'
    : isTable && zone.status === 'occupied'
    ? 'bg-danger-400'
    : isTable
    ? 'bg-success-400'
    : zone.type === 'queue'
    ? 'bg-warning-400'
    : zone.type === 'entrance'
    ? 'bg-cyan-400'
    : zone.type === 'exit'
    ? 'bg-violet-400'
    : 'bg-ink-3';

  const Icon = isTable ? null
    : zone.type === 'entrance' ? DoorOpen
    : zone.type === 'exit' ? LogOut
    : zone.type === 'queue' ? Users
    : null;

  return (
    <div
      className={`absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 flex flex-col items-center ${
        isSelected ? 'z-10' : ''
      }`}
      style={{ left: `${cx}%`, top: `${cy}%` }}
    >
      <div
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md backdrop-blur-sm border ${
          zone.crowded
            ? 'bg-danger-500/30 border-danger-400/60 shadow-[0_0_12px_rgba(248,113,113,0.4)]'
            : 'bg-surface-1/60 border-white/10'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {Icon && <Icon className={`w-2.5 h-2.5 ${zone.crowded ? 'text-danger-200' : 'text-ink-2'}`} />}
        <span className="text-[10px] font-semibold text-ink-1 leading-tight max-w-[70px] truncate">
          {zone.name}
        </span>
      </div>
    </div>
  );
}

function TableDetail({
  z,
  lang,
  onClose,
}: {
  z: RenderedZone;
  lang: 'tr' | 'en';
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${z.status === 'occupied' ? 'bg-brand-400' : 'bg-success-400'}`} />
        <p className="text-sm font-semibold text-ink-0 truncate">{z.name}</p>
        <span
          className={`text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded ${
            z.status === 'occupied'
              ? 'bg-brand-500/20 text-brand-200'
              : 'bg-success-500/15 text-success-200'
          }`}
        >
          {z.status === 'occupied' ? (lang === 'tr' ? 'Dolu' : 'Occupied') : (lang === 'tr' ? 'Boş' : 'Free')}
        </span>
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-white/[0.08] text-ink-3 hover:text-ink-0 transition-colors flex-shrink-0"
        aria-label="Close"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function CrowdDetail({
  z,
  lang,
  threshold,
  onClose,
}: {
  z: RenderedZone;
  lang: 'tr' | 'en';
  threshold: number;
  onClose: () => void;
}) {
  const isQueue = z.type === 'queue';
  const isEntrance = z.type === 'entrance';
  const TypeIcon = isEntrance ? DoorOpen : isQueue ? Users : LogOut;
  const typeLabel = isEntrance
    ? (lang === 'tr' ? 'Giriş' : 'Entrance')
    : isQueue
    ? (lang === 'tr' ? 'Sıra' : 'Queue')
    : (lang === 'tr' ? 'Çıkış' : 'Exit');

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <TypeIcon className={`w-3.5 h-3.5 ${z.crowded ? 'text-danger-300' : 'text-ink-2'}`} />
          <p className="text-sm font-semibold text-ink-0 truncate">{z.name}</p>
          <span
            className={`text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded ${
              z.crowded ? 'bg-danger-500/25 text-danger-100' : 'bg-surface-2/60 text-ink-2'
            }`}
          >
            {typeLabel}
          </span>
        </div>
        {z.crowded && (
          <div className="flex items-start gap-2 mt-1">
            <AlertTriangle className="w-4 h-4 text-danger-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-danger-100">
                {lang === 'tr' ? 'Aşırı kalabalık' : 'Overcrowded'}
              </p>
              <p className="text-[11px] text-ink-2 mt-0.5">
                {lang === 'tr'
                  ? `Eşik aşıldı (${threshold}+ kişi). Personel yönlendirin.`
                  : `Threshold exceeded (${threshold}+ people). Dispatch staff.`}
              </p>
            </div>
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-white/[0.08] text-ink-3 hover:text-ink-0 transition-colors flex-shrink-0"
        aria-label="Close"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Legend({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

