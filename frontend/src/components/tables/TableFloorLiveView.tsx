/**
 * Stage 5: Live-video floor plan.
 *
 * Composition:
 *  - <img> pointed at the Python backend's MJPEG stream in smooth mode
 *    (that stream already paints bboxes + labels at ~60 FPS — Stage 2).
 *  - SVG overlay on top in normalized 0..1 viewBox for zone polygons and
 *    per-table status chips, so the zones stay pixel-perfect regardless of
 *    container size.
 *  - A side panel fetches POST /api/tables/ai-summary every 30 s and shows
 *    a Turkish/English floor-manager brief next to the video.
 *
 * This is the "Live View" tab — the schematic/heatmap view stays as is on the
 * sibling tab so users with a zone-less camera still see something useful.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import type { TableData, Zone, AnalyticsData } from '../../services/cameraBackendService';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  cameraId: string;
  tables: TableData[];
  zones: Zone[];
  latest: AnalyticsData | null;
  connected: boolean;
}

const MJPEG_BASE =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) || 'http://localhost:5001';
const NODE_API =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3001';

type Status = TableData['status'];
const STATUS_FILL: Record<Status, string> = {
  empty: 'rgba(34,197,94,0.18)',
  occupied: 'rgba(29,107,255,0.22)',
  needs_cleaning: 'rgba(234,179,8,0.22)',
};
const STATUS_STROKE: Record<Status, string> = {
  empty: 'rgba(34,197,94,0.8)',
  occupied: 'rgba(29,107,255,0.9)',
  needs_cleaning: 'rgba(234,179,8,0.9)',
};
const STATUS_LABEL_TR: Record<Status, string> = {
  empty: 'Bos',
  occupied: 'Dolu',
  needs_cleaning: 'Temizlik',
};
const STATUS_LABEL_EN: Record<Status, string> = {
  empty: 'Free',
  occupied: 'Busy',
  needs_cleaning: 'Cleaning',
};

export default function TableFloorLiveView({ cameraId, tables, zones, latest, connected }: Props) {
  const { lang } = useLanguage();

  // MJPEG stream URL — smooth mode guarantees 60 FPS display (Stage 2).
  // The `t` query param forces a fresh connection when the cameraId changes
  // so the browser doesn't reuse a stale pinned multipart stream.
  const mjpegUrl = useMemo(
    () => `${MJPEG_BASE}/mjpeg?mode=smooth&t=${encodeURIComponent(cameraId)}`,
    [cameraId]
  );

  // Merge zone coords onto tables. Rectangles are stored as (x,y,w,h) in
  // normalized 0..1 space, matching the existing ZoneCanvas convention.
  const tableZones = useMemo(() => {
    const byId = new Map(zones.filter((z) => z.type === 'table').map((z) => [z.id, z]));
    return tables
      .map((t) => {
        const z = byId.get(t.id);
        if (!z) return null;
        return { ...t, x: z.x, y: z.y, width: z.width, height: z.height };
      })
      .filter((v): v is TableData & { x: number; y: number; width: number; height: number } => !!v);
  }, [tables, zones]);

  const entryExitZones = useMemo(
    () => zones.filter((z) => z.type === 'entrance' || z.type === 'exit' || z.type === 'queue'),
    [zones]
  );

  // AI commentary — backend throttles to 30 s per cameraId.
  const [summary, setSummary] = useState<string>('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryModel, setSummaryModel] = useState<string>('');
  const [summaryAt, setSummaryAt] = useState<number | null>(null);
  const summaryAbort = useRef<AbortController | null>(null);

  const requestSummary = async () => {
    if (!tables.length) return;
    summaryAbort.current?.abort();
    const ac = new AbortController();
    summaryAbort.current = ac;
    setSummaryLoading(true);
    try {
      const genderTotal =
        (latest?.demographics.gender.male || 0) + (latest?.demographics.gender.female || 0);
      const malePct =
        genderTotal > 0 ? ((latest!.demographics.gender.male || 0) / genderTotal) * 100 : 0;
      const femalePct =
        genderTotal > 0 ? ((latest!.demographics.gender.female || 0) / genderTotal) * 100 : 0;
      const ages = latest?.demographics.ages || {};
      const dominantAge = Object.entries(ages).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0];

      const res = await fetch(`${NODE_API}/api/tables/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: ac.signal,
        body: JSON.stringify({
          cameraId,
          tables: tables.map((t) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            currentOccupants: t.currentOccupants,
            avgStaySeconds: t.avgStaySeconds,
            occupancyDuration: t.occupancyDuration,
            turnoverCount: t.turnoverCount,
          })),
          totals: {
            current: latest?.current ?? 0,
            entries: latest?.entries ?? 0,
            exits: latest?.exits ?? 0,
            fps: latest?.fps ?? 0,
          },
          demographics: {
            male: malePct,
            female: femalePct,
            dominantAge,
          },
          lang,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSummary(data.summary || '');
      setSummaryModel(data.model || '');
      setSummaryAt(data.generatedAt || Date.now());
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return;
      setSummary(
        lang === 'tr'
          ? 'AI yorumu alinamadi. Backend bagli mi?'
          : 'Failed to fetch AI commentary. Is the backend up?'
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  // Auto-refresh every 30 s; skip while page hidden to save tokens.
  useEffect(() => {
    if (!tables.length) return;
    requestSummary();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') requestSummary();
    }, 30_000);
    return () => {
      window.clearInterval(id);
      summaryAbort.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId, tables.length]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
      {/* Video + overlay */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-1">
              {lang === 'tr' ? 'Canli Gorunum' : 'Live View'}
            </h3>
            <p className="text-[11px] text-ink-3 mt-0.5">
              {lang === 'tr'
                ? 'MJPEG smooth mod + bolge ustbindirme'
                : 'MJPEG smooth stream + zone overlay'}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
              connected
                ? 'bg-success-500/10 text-success-300 border-success-500/30'
                : 'bg-danger-500/10 text-danger-300 border-danger-500/30'
            }`}
          >
            {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {connected
              ? lang === 'tr'
                ? 'Canli'
                : 'Live'
              : lang === 'tr'
              ? 'Kopuk'
              : 'Offline'}
          </span>
        </div>

        <div className="relative w-full aspect-video bg-black/60 rounded-xl border border-white/5 overflow-hidden">
          <img
            src={mjpegUrl}
            alt="live camera stream"
            className="w-full h-full object-contain"
            draggable={false}
          />

          {/* Normalized SVG overlay — 0..1 viewBox so polygons stay pixel-perfect */}
          <svg
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            {entryExitZones.map((z) => (
              <g key={`zone-${z.id}`}>
                <rect
                  x={z.x}
                  y={z.y}
                  width={z.width}
                  height={z.height}
                  fill={z.type === 'entrance' ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)'}
                  stroke={z.type === 'entrance' ? 'rgba(59,130,246,0.9)' : 'rgba(239,68,68,0.9)'}
                  strokeWidth={0.0025}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}

            {tableZones.map((t) => {
              const style = STATUS_FILL[t.status] || STATUS_FILL.empty;
              const stroke = STATUS_STROKE[t.status] || STATUS_STROKE.empty;
              return (
                <g key={`table-${t.id}`}>
                  <rect
                    x={t.x}
                    y={t.y}
                    width={t.width}
                    height={t.height}
                    fill={style}
                    stroke={stroke}
                    strokeWidth={0.003}
                    vectorEffect="non-scaling-stroke"
                    rx={0.008}
                  />
                </g>
              );
            })}
          </svg>

          {/* HTML labels layer — SVG text inside normalized viewBox rescales
              awkwardly, so we absolutely-position standard divs instead. */}
          <div className="absolute inset-0 pointer-events-none">
            {tableZones.map((t) => {
              const label = t.name || `T${t.id.slice(-3)}`;
              const statusText = lang === 'tr' ? STATUS_LABEL_TR[t.status] : STATUS_LABEL_EN[t.status];
              return (
                <div
                  key={`tag-${t.id}`}
                  className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-medium border border-white/20 backdrop-blur"
                  style={{
                    left: `${(t.x + t.width / 2) * 100}%`,
                    top: `${(t.y + Math.max(0, t.height - 0.04)) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: STATUS_STROKE[t.status] }}
                  />
                  <span>{label}</span>
                  <span className="text-white/60">·</span>
                  <span>{statusText}</span>
                  {t.status === 'occupied' && (
                    <>
                      <span className="text-white/60">·</span>
                      <span>{t.currentOccupants}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {!connected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <p className="text-sm text-white">
                {lang === 'tr'
                  ? 'Kamera akisi yok — Python backend kapali olabilir'
                  : 'No camera stream — Python backend may be offline'}
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: STATUS_STROKE.empty }} />
            {lang === 'tr' ? 'Bos' : 'Free'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: STATUS_STROKE.occupied }} />
            {lang === 'tr' ? 'Dolu' : 'Occupied'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: STATUS_STROKE.needs_cleaning }} />
            {lang === 'tr' ? 'Temizlik' : 'Cleaning'}
          </span>
          <span className="ml-auto text-ink-4">
            {tableZones.length
              ? lang === 'tr'
                ? `${tableZones.length} masa bolgesi eslenti`
                : `${tableZones.length} table zones mapped`
              : lang === 'tr'
              ? 'Bolge cizilmemis — Zone Labeling sayfasindan masa ekleyin'
              : 'No zones — draw table zones in Zone Labeling'}
          </span>
        </div>
      </div>

      {/* AI commentary */}
      <div className="surface-card p-5 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-brand-300" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-ink-1">
                {lang === 'tr' ? 'Salon Ozeti' : 'Floor Summary'}
              </h4>
              <p className="text-[10px] text-ink-4">
                {summaryModel
                  ? `${summaryModel}${summaryAt ? ' · ' + new Date(summaryAt).toLocaleTimeString() : ''}`
                  : lang === 'tr'
                  ? 'Ollama · 30sn yenileme'
                  : 'Ollama · 30s refresh'}
              </p>
            </div>
          </div>
          <button
            onClick={requestSummary}
            disabled={summaryLoading || !tables.length}
            className="p-1.5 rounded-md text-ink-3 hover:text-ink-1 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="refresh"
          >
            <RefreshCw className={`w-4 h-4 ${summaryLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {summaryLoading && !summary ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <RefreshCw className="w-5 h-5 text-ink-3 animate-spin mb-2" />
            <p className="text-xs text-ink-3">
              {lang === 'tr' ? 'AI yorumu yazliyor…' : 'AI is thinking…'}
            </p>
          </div>
        ) : summary ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-ink-2 leading-relaxed whitespace-pre-line"
          >
            {summary}
          </motion.div>
        ) : (
          <p className="text-xs text-ink-3">
            {lang === 'tr'
              ? 'Henuz yorum yok — kamera aktif oldugunda otomatik doldurulur.'
              : 'No commentary yet — auto-fills once the camera is live.'}
          </p>
        )}
      </div>
    </div>
  );
}
