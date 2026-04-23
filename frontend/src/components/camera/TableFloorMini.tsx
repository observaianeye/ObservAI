import { useEffect, useMemo, useState } from 'react';
import { cameraBackendService, type TableData, type Zone, type AnalyticsData } from '../../services/cameraBackendService';
import { useLanguage } from '../../contexts/LanguageContext';
import { GlassCard } from '../ui/GlassCard';

// Compact schematic floor plan for the analytics dashboard. Shows table zones
// at their real camera-space coordinates, colored by two-state status
// (Dolu/Boş). Only renders data we actually track — no head counts, durations,
// or meal-stage heuristics.
export default function TableFloorMini() {
  const { lang } = useLanguage();
  const [tables, setTables] = useState<TableData[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    const unsub = cameraBackendService.onAnalytics((data: AnalyticsData) => {
      if (Array.isArray(data.tables)) setTables(data.tables);
    });

    // Prefer live zones from the Python backend, but fall back to the local
    // copy written by ZoneCanvas on save. The storage listener lets this
    // widget pick up zones the user just drew on the Zone Labeling page
    // without requiring a full page reload.
    const loadZonesFromStorage = () => {
      const raw = localStorage.getItem('cameraZones');
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setZones(parsed as Zone[]);
      } catch { /* ignore parse errors */ }
    };
    loadZonesFromStorage();
    cameraBackendService.getZones?.().then((zs) => {
      if (Array.isArray(zs) && zs.length > 0) setZones(zs);
    }).catch(() => { /* zones optional */ });

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cameraZones') loadZonesFromStorage();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      unsub();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Collapse needs_cleaning into "Boş" for display — the detail workflow for
  // cleaning lives elsewhere; this mini view is strictly occupied vs empty.
  const layout = useMemo(() => {
    const tableZones = zones.filter((z) => z.type === 'table');
    return tables
      .map((t) => {
        const z = tableZones.find((zz) => zz.id === t.id);
        if (!z) return null;
        const isOccupied = t.status === 'occupied';
        return {
          id: t.id,
          name: t.name || `T${t.id.slice(-2)}`,
          x: z.x,
          y: z.y,
          width: z.width,
          height: z.height,
          occupied: isOccupied,
        };
      })
      .filter((v): v is NonNullable<typeof v> => !!v);
  }, [tables, zones]);

  const occupiedCount = layout.filter((t) => t.occupied).length;

  return (
    <GlassCard variant="neon" className="p-5 text-ink-0">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-[0.18em] font-mono">
            {lang === 'tr' ? 'Masa Planı' : 'Floor Plan'}
          </p>
          <p className="text-[11px] text-ink-4 mt-0.5">
            {lang === 'tr' ? `${occupiedCount}/${layout.length} dolu` : `${occupiedCount}/${layout.length} occupied`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-ink-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
            {lang === 'tr' ? 'Dolu' : 'Occupied'}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success-400" />
            {lang === 'tr' ? 'Boş' : 'Free'}
          </span>
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
        <div className="relative w-full aspect-[16/10] rounded-lg border border-white/[0.06] bg-surface-2/40 overflow-hidden">
          <div className="absolute inset-0 grid-floor opacity-40" />
          {layout.map((tbl) => (
            <div
              key={tbl.id}
              className={`absolute rounded-md border backdrop-blur-sm flex items-center justify-center text-center transition-colors ${
                tbl.occupied
                  ? 'bg-brand-500/15 border-brand-500/50 shadow-[0_0_16px_-4px_rgba(29,107,255,0.55)]'
                  : 'bg-success-500/12 border-success-500/40'
              }`}
              style={{
                left: `${tbl.x * 100}%`,
                top: `${tbl.y * 100}%`,
                width: `${tbl.width * 100}%`,
                height: `${tbl.height * 100}%`,
              }}
            >
              <div className="flex items-center gap-1 px-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    tbl.occupied ? 'bg-brand-400' : 'bg-success-400'
                  }`}
                />
                <span className="text-[10px] font-semibold text-ink-1 truncate">{tbl.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
