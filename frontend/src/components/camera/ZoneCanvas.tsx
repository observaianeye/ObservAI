import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Save, Tag, Camera, AlertCircle, RefreshCw, Square, Hexagon, Eraser, Check } from 'lucide-react';
import { cameraBackendService, Zone } from '../../services/cameraBackendService';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  NormPoint,
  polygonBounds,
  polygonArea,
  rectToPolygon,
  simplifyPolygon,
  polygonsOverlap,
  pointsToSvgString,
  coordsLookLikeRect,
} from './ZonePolygonUtils';

type DrawMode = 'rect' | 'polygon' | 'freehand' | null;

export default function ZoneCanvas() {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [loading, setLoading] = useState(false);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [captureError, setCaptureError] = useState<string>('');
  const [overlapError, setOverlapError] = useState<string>('');
  const [tempZoneOverlaps, setTempZoneOverlaps] = useState(false);

  // Rect drag state
  const [rectStart, setRectStart] = useState<NormPoint | null>(null);
  const [tempRect, setTempRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Polygon state (click-to-add points)
  const [polygonPoints, setPolygonPoints] = useState<NormPoint[]>([]);
  const [polygonHover, setPolygonHover] = useState<NormPoint | null>(null);

  // Freehand state
  const [freehandPoints, setFreehandPoints] = useState<NormPoint[]>([]);
  const [freehandActive, setFreehandActive] = useState(false);

  // Move/resize interaction state
  const [interactionState, setInteractionState] = useState<{
    mode: 'moving' | 'resizing' | null;
    startPoint: { x: number; y: number } | null;
    activeZoneId: string | null;
    initialZoneState: Zone | null;
    resizeHandle: string | null;
  }>({
    mode: null, startPoint: null, activeZoneId: null, initialZoneState: null, resizeHandle: null,
  });

  const loadZones = useCallback(async () => {
    setLoading(true);
    try {
      // Tenant-scoped: fetch the caller's active camera, then ask the Node API
      // (which already filters by req.user.id) for that camera's zones. We
      // intentionally do NOT pull from the Python backend WebSocket here —
      // that store is shared across the whole device and would leak zones
      // from a previously-signed-in account.
      const activeRes = await fetch('/api/cameras/active', { credentials: 'include' });
      if (!activeRes.ok) {
        setActiveCameraId(null);
        setZones([]);
        return;
      }
      const activeBody = await activeRes.json();
      if (!activeBody?.id) {
        setActiveCameraId(null);
        setZones([]);
        return;
      }
      setActiveCameraId(activeBody.id);

      const zonesRes = await fetch(`/api/zones/${activeBody.id}`, { credentials: 'include' });
      if (!zonesRes.ok) {
        setZones([]);
        return;
      }
      const rows = await zonesRes.json() as Array<any>;
      // Node payload uses { coordinates: NormPoint[], type, name, color, ... };
      // map into the polygon shape ZoneCanvas renders. Detect axis-aligned
      // rect (4 corners on bbox edges) and mark shape='rect' so user-saved
      // rectangles don't morph into polygons after a reload (Issue #3).
      const mapped: Zone[] = rows.map((r) => {
        const coords: NormPoint[] = Array.isArray(r.coordinates) ? r.coordinates : [];
        const bbox = polygonBounds(coords);
        const isRect = coords.length === 4 && coordsLookLikeRect(coords, bbox);
        return {
          id: r.id,
          name: r.name,
          type: (String(r.type || 'CUSTOM').toLowerCase()) as Zone['type'],
          color: r.color || '#3b82f6',
          shape: isRect ? 'rect' : 'polygon',
          points: coords,
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
        };
      });
      setZones(mapped);
    } catch (error) {
      console.error('Failed to load zones:', error);
      setZones([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadZones();
    const savedBackground = localStorage.getItem('zoneLabelingBackground');
    if (savedBackground) setBackgroundImage(savedBackground);
  }, [loadZones]);

  // Refetch zones when another view activates a different camera. Without
  // this, the labeling page would stay pinned to the camera that was active
  // when this component mounted — even if the user picked a new source from
  // CameraFeed or CameraSelectionPage in another tab/route.
  useEffect(() => {
    const onActiveCameraChange = () => { loadZones(); };
    window.addEventListener('observai:active-camera-changed', onActiveCameraChange);
    return () => window.removeEventListener('observai:active-camera-changed', onActiveCameraChange);
  }, [loadZones]);

  // ESC to cancel drawing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawMode(null);
        setPolygonPoints([]);
        setPolygonHover(null);
        setRectStart(null);
        setTempRect(null);
        setFreehandPoints([]);
      } else if (e.key === 'Enter' && drawMode === 'polygon' && polygonPoints.length >= 3) {
        commitPolygon();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);

  }, [drawMode, polygonPoints]);

  const getNormalizedPoint = (clientX: number, clientY: number): NormPoint => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  const zoneBoundsRect = (z: Zone): { x: number; y: number; width: number; height: number } => {
    if (z.shape === 'polygon' && z.points) {
      return polygonBounds(z.points);
    }
    return { x: z.x, y: z.y, width: z.width, height: z.height };
  };

  // Yan #31: real polygon-polygon overlap. Existing zones expose either an
  // explicit `points` array (polygon/freehand) or just (x, y, width, height)
  // for rect — normalise both into a 4-vertex polygon so polygonsOverlap can
  // run a real edge/containment check instead of a bbox heuristic.
  const zoneToPolygon = (z: Zone): NormPoint[] => {
    if (z.shape === 'polygon' && z.points && z.points.length >= 3) return z.points;
    return rectToPolygon(z.x, z.y, z.width, z.height);
  };

  const checkOverlap = (candidatePolygon: NormPoint[], excludeId?: string): boolean => {
    return zones.some((z) => {
      if (z.id === excludeId) return false;
      return polygonsOverlap(candidatePolygon, zoneToPolygon(z));
    });
  };

  // ─── Commit helpers ──────────────────────────────────────────────────────
  const colorForType = (type: Zone['type']): string => ({
    entrance: '#3b82f6', exit: '#ef4444', queue: '#f59e0b', table: '#10b981',
  }[type]);

  const commitRect = () => {
    if (!tempRect) return;
    if (tempRect.width < 0.03 || tempRect.height < 0.03) {
      setTempRect(null);
      setRectStart(null);
      return;
    }
    if (checkOverlap(rectToPolygon(tempRect.x, tempRect.y, tempRect.width, tempRect.height))) {
      setOverlapError(t('zones.canvas.overlapMsg') || 'Zone overlaps with an existing zone.');
      setTimeout(() => setOverlapError(''), 3200);
      setTempRect(null);
      setRectStart(null);
      return;
    }
    const newZone: Zone = {
      id: Date.now().toString(),
      name: `Zone ${zones.length + 1}`,
      type: 'entrance',
      x: tempRect.x, y: tempRect.y, width: tempRect.width, height: tempRect.height,
      color: colorForType('entrance'),
      shape: 'rect',
    };
    setZones([...zones, newZone]);
    setSelectedZoneId(newZone.id);
    showToast('success', `Zone created`);
    setTempRect(null);
    setRectStart(null);
    setDrawMode(null);
  };

  const commitPolygon = () => {
    if (polygonPoints.length < 3) return;
    const bounds = polygonBounds(polygonPoints);
    if (polygonArea(polygonPoints) < 0.002) {
      setPolygonPoints([]);
      return;
    }
    if (checkOverlap(polygonPoints)) {
      setOverlapError(t('zones.canvas.overlapMsg') || 'Zone overlaps with an existing zone.');
      setTimeout(() => setOverlapError(''), 3200);
      setPolygonPoints([]);
      return;
    }
    const newZone: Zone = {
      id: Date.now().toString(),
      name: `Zone ${zones.length + 1}`,
      type: 'entrance',
      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      color: colorForType('entrance'),
      shape: 'polygon',
      points: polygonPoints,
    };
    setZones([...zones, newZone]);
    setSelectedZoneId(newZone.id);
    showToast('success', `Zone created`);
    setPolygonPoints([]);
    setPolygonHover(null);
    setDrawMode(null);
  };

  const commitFreehand = () => {
    if (freehandPoints.length < 6) {
      setFreehandPoints([]);
      setFreehandActive(false);
      return;
    }
    const simplified = simplifyPolygon(freehandPoints, 0.008);
    if (simplified.length < 3) {
      setFreehandPoints([]);
      setFreehandActive(false);
      return;
    }
    const bounds = polygonBounds(simplified);
    if (polygonArea(simplified) < 0.002) {
      setFreehandPoints([]);
      setFreehandActive(false);
      return;
    }
    if (checkOverlap(simplified)) {
      setOverlapError(t('zones.canvas.overlapMsg') || 'Zone overlaps with an existing zone.');
      setTimeout(() => setOverlapError(''), 3200);
      setFreehandPoints([]);
      setFreehandActive(false);
      return;
    }
    const newZone: Zone = {
      id: Date.now().toString(),
      name: `Zone ${zones.length + 1}`,
      type: 'entrance',
      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      color: colorForType('entrance'),
      shape: 'polygon',
      points: simplified,
    };
    setZones([...zones, newZone]);
    setSelectedZoneId(newZone.id);
    showToast('success', `Zone created`);
    setFreehandPoints([]);
    setFreehandActive(false);
    setDrawMode(null);
  };

  // ─── Mouse handlers ──────────────────────────────────────────────────────
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (loading) return;
    if (interactionState.mode) return;
    e.preventDefault();
    e.stopPropagation();

    const pt = getNormalizedPoint(e.clientX, e.clientY);

    if (drawMode === 'rect') {
      setRectStart(pt);
      setTempRect({ x: pt.x, y: pt.y, width: 0, height: 0 });
      return;
    }
    if (drawMode === 'polygon') {
      // Left click adds a vertex
      setPolygonPoints((prev) => [...prev, pt]);
      return;
    }
    if (drawMode === 'freehand') {
      setFreehandActive(true);
      setFreehandPoints([pt]);
      return;
    }

    setSelectedZoneId(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pt = getNormalizedPoint(e.clientX, e.clientY);

    if (drawMode === 'rect' && rectStart) {
      const x = Math.min(rectStart.x, pt.x);
      const y = Math.min(rectStart.y, pt.y);
      const w = Math.abs(pt.x - rectStart.x);
      const h = Math.abs(pt.y - rectStart.y);
      setTempRect({ x, y, width: w, height: h });
      setTempZoneOverlaps(w > 0 && h > 0 ? checkOverlap(rectToPolygon(x, y, w, h)) : false);
      return;
    }
    if (drawMode === 'polygon' && polygonPoints.length > 0) {
      setPolygonHover(pt);
      return;
    }
    if (drawMode === 'freehand' && freehandActive) {
      setFreehandPoints((prev) => {
        const last = prev[prev.length - 1];
        if (!last || Math.abs(last.x - pt.x) + Math.abs(last.y - pt.y) > 0.006) {
          return [...prev, pt];
        }
        return prev;
      });
      return;
    }

    // Move / resize
    if (!interactionState.mode || !interactionState.startPoint) return;
    const deltaX = (e.clientX - interactionState.startPoint.x) / rect.width;
    const deltaY = (e.clientY - interactionState.startPoint.y) / rect.height;

    if (interactionState.mode === 'moving' && interactionState.initialZoneState) {
      const init = interactionState.initialZoneState;
      const initBounds = zoneBoundsRect(init);
      let newX = initBounds.x + deltaX;
      let newY = initBounds.y + deltaY;
      newX = Math.max(0, Math.min(newX, 1 - initBounds.width));
      newY = Math.max(0, Math.min(newY, 1 - initBounds.height));
      const shift = { x: newX - initBounds.x, y: newY - initBounds.y };
      // Issue #3: build the EXACT candidate polygon (shifted poly verts when
      // the zone has explicit points, otherwise the rect bbox) before passing
      // to checkOverlap — the previous WIP passed a bbox object which not only
      // failed typecheck but was an inaccurate proxy for poly drag overlap.
      const candidatePoly = (init.points && init.points.length >= 3)
        ? init.points.map((p) => ({ x: p.x + shift.x, y: p.y + shift.y }))
        : rectToPolygon(newX, newY, initBounds.width, initBounds.height);
      if (checkOverlap(candidatePoly, init.id)) return;
      setZones((prev) => prev.map((z) => {
        if (z.id !== init.id) return z;
        // Issue #3: polygon drag teleport — must use init.points (snapshot at
        // mousedown), NOT z.points (already-moved current state). Adding the
        // delta to current points each mousemove accumulates and the zone
        // flies off-canvas.
        if ((init.shape === 'polygon' || init.shape === 'rect') && init.points && init.points.length >= 3) {
          const points = init.points.map((p) => ({ x: p.x + shift.x, y: p.y + shift.y }));
          const b = polygonBounds(points);
          return { ...z, points, x: b.x, y: b.y, width: b.width, height: b.height };
        }
        return { ...z, x: newX, y: newY };
      }));
    } else if (interactionState.mode === 'resizing' && interactionState.initialZoneState) {
      const init = interactionState.initialZoneState;
      const handle = interactionState.resizeHandle;
      let { x, y, width: w, height: h } = { x: init.x, y: init.y, width: init.width, height: init.height };
      if (handle?.includes('e')) w += deltaX;
      if (handle?.includes('w')) { x += deltaX; w -= deltaX; }
      if (handle?.includes('s')) h += deltaY;
      if (handle?.includes('n')) { y += deltaY; h -= deltaY; }
      if (w < 0.02) w = 0.02;
      if (h < 0.02) h = 0.02;
      // Issue #3: same candidate-polygon pattern as drag — scaled poly verts
      // for poly/rect-with-points zones, plain rect for legacy bbox-only.
      const candidatePoly = (init.points && init.points.length >= 3)
        ? (() => {
            const prevB = polygonBounds(init.points!);
            return init.points!.map((p) => ({
              x: x + ((p.x - prevB.x) / (prevB.width || 1)) * w,
              y: y + ((p.y - prevB.y) / (prevB.height || 1)) * h,
            }));
          })()
        : rectToPolygon(x, y, w, h);
      if (checkOverlap(candidatePoly, init.id)) return;
      setZones((prev) => prev.map((z) => {
        if (z.id !== init.id) return z;
        // Issue #3: scale poly from INITIAL points snapshot, not z.points which
        // already reflects the current resize step (causes drift).
        if ((init.shape === 'polygon' || init.shape === 'rect') && init.points && init.points.length >= 3) {
          const prevB = polygonBounds(init.points);
          const scaled = init.points.map((p) => ({
            x: x + ((p.x - prevB.x) / (prevB.width || 1)) * w,
            y: y + ((p.y - prevB.y) / (prevB.height || 1)) * h,
          }));
          return { ...z, points: scaled, x, y, width: w, height: h };
        }
        return { ...z, x, y, width: w, height: h };
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    if (drawMode === 'rect' && rectStart) {
      commitRect();
      return;
    }
    if (drawMode === 'freehand' && freehandActive) {
      commitFreehand();
      return;
    }
    setInteractionState({ mode: null, startPoint: null, activeZoneId: null, initialZoneState: null, resizeHandle: null });
  };

  const handleCanvasDoubleClick = () => {
    if (drawMode === 'polygon' && polygonPoints.length >= 3) {
      commitPolygon();
    }
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    if (drawMode === 'polygon' && polygonPoints.length >= 3) {
      e.preventDefault();
      commitPolygon();
    }
  };

  const startMoving = (e: React.MouseEvent, zone: Zone) => {
    e.stopPropagation();
    if (drawMode) return;
    setSelectedZoneId(zone.id);
    setInteractionState({
      mode: 'moving', startPoint: { x: e.clientX, y: e.clientY }, activeZoneId: zone.id,
      initialZoneState: { ...zone }, resizeHandle: null,
    });
  };
  const startResizing = (e: React.MouseEvent, zone: Zone, handle: string) => {
    e.stopPropagation();
    if (drawMode) return;
    const b = zoneBoundsRect(zone);
    setInteractionState({
      mode: 'resizing', startPoint: { x: e.clientX, y: e.clientY }, activeZoneId: zone.id,
      initialZoneState: { ...zone, x: b.x, y: b.y, width: b.width, height: b.height },
      resizeHandle: handle,
    });
  };

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const deleteZone = (id: string) => {
    setZones(zones.filter((z) => z.id !== id));
    if (selectedZoneId === id) setSelectedZoneId(null);
  };

  const updateZoneName = (id: string, name: string) =>
    setZones(zones.map((z) => (z.id === id ? { ...z, name } : z)));

  const updateZoneType = (id: string, type: Zone['type']) => {
    const color = colorForType(type);
    setZones(zones.map((z) => (z.id === id ? { ...z, type, color } : z)));
  };

  const saveZones = async () => {
    if (!activeCameraId) {
      showToast('error', 'Once Kamera Secimi sayfasindan bir kamera secin.');
      return;
    }
    try {
      setLoading(true);
      // Ensure rect zones also have `shape: 'rect'` filled for backend normalization
      const normalized = zones.map((z) => {
        if (z.shape === 'polygon' && z.points) return z;
        return { ...z, shape: 'rect' as const, points: rectToPolygon(z.x, z.y, z.width, z.height) };
      });

      // Persist in the Node DB (tenant-scoped to the caller's camera). Replaces
      // every zone for this camera, matching the prior "save all" semantics.
      const persistRes = await fetch('/api/zones/batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraId: activeCameraId,
          zones: normalized.map((z) => ({
            name: z.name,
            type: String(z.type || 'CUSTOM').toUpperCase(),
            coordinates: z.points,
            color: z.color,
          })),
        }),
      });
      if (!persistRes.ok) {
        throw new Error(`Persist failed: ${persistRes.status}`);
      }

      // Re-fetch with the DB-issued UUIDs and reload local state. Without this,
      // the local IDs we send to Python below don't match the IDs the floor
      // plan reads from /api/zones/<cameraId>, so table occupancy never lights
      // up. Push the fresh DB zones to Python so `tables[].id` matches.
      const freshRes = await fetch(`/api/zones/${activeCameraId}`, { credentials: 'include' });
      const freshZones: Zone[] = freshRes.ok
        ? (((await freshRes.json()) as Array<any>) ?? []).map((r) => {
            const coords: NormPoint[] = Array.isArray(r.coordinates) ? r.coordinates : [];
            const bb = polygonBounds(coords);
            return {
              id: r.id,
              name: r.name,
              type: String(r.type || 'CUSTOM').toLowerCase() as Zone['type'],
              color: r.color || '#3b82f6',
              shape: 'polygon',
              points: coords,
              x: bb.x,
              y: bb.y,
              width: bb.width,
              height: bb.height,
            };
          })
        : normalized;
      setZones(freshZones);

      try {
        await cameraBackendService.saveZones(freshZones);
      } catch (err) {
        console.warn('[zones] Python push failed (engine offline?):', err);
      }

      showToast('success', `Saved ${freshZones.length} zone${freshZones.length !== 1 ? 's' : ''}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showToast('error', `Failed to save: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const captureCameraSnapshot = async () => {
    setCaptureError('');
    try {
      if (!cameraBackendService.getConnectionStatus()) {
        cameraBackendService.connect();
        await new Promise((r) => setTimeout(r, 1000));
      }
      const imageData = await cameraBackendService.getSnapshot();
      setBackgroundImage(imageData);
      localStorage.setItem('zoneLabelingBackground', imageData);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setCaptureError(msg || 'Failed to capture camera snapshot.');
    }
  };

  const cursorClass = drawMode ? 'cursor-crosshair' : 'cursor-default';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-gradient-brand tracking-tight">{t('zones.canvas.title')}</h2>
          <p className="text-sm text-ink-3 mt-1">{t('zones.canvas.subtitle')}</p>
        </div>
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <button onClick={loadZones} className="p-2 text-ink-3 hover:text-ink-0 hover:bg-white/[0.06] rounded-xl border border-white/[0.08] transition-colors" title={t('zones.canvas.reload')}>
            <RefreshCw strokeWidth={1.5} className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={captureCameraSnapshot}
            className="px-4 py-2 bg-violet-500/15 text-violet-200 border border-violet-500/30 rounded-xl font-medium text-sm hover:bg-violet-500/25 transition-colors flex items-center space-x-2"
          >
            <Camera strokeWidth={1.5} className="w-4 h-4" />
            <span>{t('zones.canvas.capture')}</span>
          </button>
          <button
            onClick={saveZones}
            disabled={loading}
            data-testid="zone-save-all"
            className={`px-4 py-2 bg-success-500/20 text-success-200 border border-success-500/40 rounded-xl font-medium text-sm hover:bg-success-500/30 transition-colors flex items-center space-x-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Save strokeWidth={1.5} className="w-4 h-4" />
            <span>{loading ? t('zones.canvas.saving') : t('zones.canvas.saveAll')}</span>
          </button>
        </div>
      </div>

      {/* Drawing mode toolbar.
       * Yan #51 audit: previous OBSERVATIONAL e2e runs (4.1a/b/c rect/poly/freehand)
       * suspected the toolbar was hidden behind a snapshot/backgroundImage gate.
       * Source review confirms there is NO such gate — DrawModeButtons render
       * unconditionally inside this motion.div. The OBSERVATIONAL result came
       * from e2e expecting a POST /api/zones after a canvas drag, but drag-end
       * only commits to local state via setZones(); persistence happens in the
       * separate "Save All" button which calls POST /api/zones/batch. Adding
       * data-testid attrs so future specs can target the buttons + Save All
       * deterministically without relying on framer-motion class names. */}
      <motion.div
        layout
        data-testid="zone-draw-toolbar"
        className="inline-flex items-center gap-2 p-1.5 rounded-xl bg-surface-1/60 backdrop-blur border border-white/[0.08]"
      >
        <DrawModeButton testId="zone-draw-rect" active={drawMode === 'rect'} onClick={() => setDrawMode(drawMode === 'rect' ? null : 'rect')} icon={<Square className="w-4 h-4" strokeWidth={1.5} />} label={t('zones.canvas.drawRect') || 'Rectangle'} />
        <DrawModeButton testId="zone-draw-polygon" active={drawMode === 'polygon'} onClick={() => setDrawMode(drawMode === 'polygon' ? null : 'polygon')} icon={<Hexagon className="w-4 h-4" strokeWidth={1.5} />} label={t('zones.canvas.drawPolygon') || 'Polygon'} />
        <DrawModeButton testId="zone-draw-freehand" active={drawMode === 'freehand'} onClick={() => setDrawMode(drawMode === 'freehand' ? null : 'freehand')} icon={<Eraser className="w-4 h-4" strokeWidth={1.5} />} label={t('zones.canvas.drawFreehand') || 'Freehand'} />
        <div className="w-px h-6 bg-white/[0.08] mx-1"></div>
        {drawMode === 'polygon' && polygonPoints.length >= 3 && (
          <button
            onClick={commitPolygon}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-success-500/20 text-success-200 border border-success-500/40 hover:bg-success-500/30 transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2} />
            {t('zones.canvas.finishPolygon') || 'Finish'}
          </button>
        )}
        <span className="text-xs text-ink-3 px-2">
          {drawMode === 'polygon'
            ? (t('zones.canvas.polygonHint') || 'Tikla nokta ekle, cift tikla/Enter ile tamamla, ESC iptal')
            : drawMode === 'freehand'
              ? (t('zones.canvas.freehandHint') || 'Basili tut ve serbestce ciz')
              : drawMode === 'rect'
                ? (t('zones.canvas.rectHint') || 'Tikla ve surukleyerek dikdortgen ciz')
                : (t('zones.canvas.pickMode') || 'Bir cizim modu sec')}
        </span>
      </motion.div>

      {/* Error toasts */}
      <AnimatePresence>
        {captureError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-4 flex items-start space-x-3"
          >
            <AlertCircle strokeWidth={1.5} className="w-5 h-5 text-danger-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-danger-200">{t('zones.canvas.captureFailed')}</p>
              <p className="text-sm text-danger-300 mt-1">{captureError}</p>
            </div>
          </motion.div>
        )}
        {overlapError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-danger-500/15 border border-danger-500/40 rounded-xl p-4 flex items-start space-x-3"
          >
            <AlertCircle strokeWidth={1.5} className="w-5 h-5 text-danger-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-danger-200">{t('zones.canvas.zoneOverlap')}</p>
              <p className="text-sm text-danger-300 mt-1">{overlapError}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-xl border-2 border-brand-500/30 overflow-hidden shadow-[0_0_15px_rgba(29,107,255,0.12)] hover:shadow-glow-brand hover:border-brand-500/50 backdrop-blur-md bg-surface-0/80 select-none">
            <div
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onDoubleClick={handleCanvasDoubleClick}
              onContextMenu={handleCanvasContextMenu}
              className={`relative bg-surface-0 aspect-video ${cursorClass}`}
              style={{
                backgroundImage: backgroundImage
                  ? `url(${backgroundImage})`
                  : 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect width=\'20\' height=\'20\' fill=\'%23374151\'/%3E%3Cpath d=\'M0 0h20v20H0z\' fill=\'none\' stroke=\'%234b5563\' stroke-width=\'1\'/%3E%3C/svg%3E")',
                backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
              }}
            >
              {!backgroundImage && (
                <div className="absolute inset-0 flex items-center justify-center text-ink-3 text-sm font-medium pointer-events-none">
                  <div className="text-center">
                    <Camera strokeWidth={1.5} className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>{t('zones.canvas.clickCapture')}</p>
                  </div>
                </div>
              )}

              {/* Existing zones */}
              <AnimatePresence>
                {zones.map((zone) => {
                  const isSelected = selectedZoneId === zone.id;
                  const isPoly = zone.shape === 'polygon' && zone.points && zone.points.length >= 3;
                  return (
                    <motion.div
                      key={zone.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      onMouseDown={(e) => startMoving(e, zone)}
                      className={`absolute transition-shadow ${isSelected ? 'z-10' : 'z-0'}`}
                      style={{
                        left: `${(isPoly ? polygonBounds(zone.points!).x : zone.x) * 100}%`,
                        top: `${(isPoly ? polygonBounds(zone.points!).y : zone.y) * 100}%`,
                        width: `${(isPoly ? polygonBounds(zone.points!).width : zone.width) * 100}%`,
                        height: `${(isPoly ? polygonBounds(zone.points!).height : zone.height) * 100}%`,
                        cursor: drawMode ? 'crosshair' : 'move',
                        filter: isSelected ? `drop-shadow(0 0 14px ${zone.color}90)` : undefined,
                      }}
                    >
                      {isPoly ? (
                        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <polygon
                            points={zone.points!.map((p) => {
                              const b = polygonBounds(zone.points!);
                              return `${((p.x - b.x) / (b.width || 1)) * 100},${((p.y - b.y) / (b.height || 1)) * 100}`;
                            }).join(' ')}
                            fill={`${zone.color}33`}
                            stroke={zone.color}
                            strokeWidth={isSelected ? 0.7 : 0.4}
                            vectorEffect="non-scaling-stroke"
                            style={{ strokeDasharray: isSelected ? 'none' : '2 1' }}
                          />
                        </svg>
                      ) : (
                        <div
                          className={`absolute inset-0 border-2 rounded ${isSelected ? 'ring-2 ring-white/50' : ''}`}
                          style={{ borderColor: zone.color, backgroundColor: `${zone.color}20` }}
                        />
                      )}
                      <div
                        className="absolute top-0 left-0 px-2 py-1 text-xs font-semibold text-white rounded-br pointer-events-none"
                        style={{ backgroundColor: zone.color }}
                      >
                        {zone.name}
                      </div>
                      {isSelected && !drawMode && (
                        <>
                          <ResizeHandle pos="nw" onMouseDown={(e) => startResizing(e, zone, 'nw')} />
                          <ResizeHandle pos="ne" onMouseDown={(e) => startResizing(e, zone, 'ne')} />
                          <ResizeHandle pos="sw" onMouseDown={(e) => startResizing(e, zone, 'sw')} />
                          <ResizeHandle pos="se" onMouseDown={(e) => startResizing(e, zone, 'se')} />
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Temp rect */}
              {tempRect && (
                <div
                  className={`absolute border-2 border-dashed rounded pointer-events-none ${tempZoneOverlaps ? 'bg-danger-500/20 border-danger-500' : 'bg-brand-500/20 border-brand-500'}`}
                  style={{
                    left: `${tempRect.x * 100}%`, top: `${tempRect.y * 100}%`,
                    width: `${tempRect.width * 100}%`, height: `${tempRect.height * 100}%`,
                    boxShadow: tempZoneOverlaps ? undefined : '0 0 22px rgba(29,107,255,0.35)',
                  }}
                />
              )}

              {/* Polygon preview */}
              {drawMode === 'polygon' && polygonPoints.length > 0 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {polygonHover && polygonPoints.length >= 1 && (
                    <polyline
                      points={pointsToSvgString([...polygonPoints, polygonHover])}
                      fill={polygonPoints.length >= 2 ? 'rgba(29,107,255,0.15)' : 'none'}
                      stroke="#1d6bff"
                      strokeWidth={0.5}
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray="1.5 1"
                    />
                  )}
                  {polygonPoints.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x * 100} cy={p.y * 100} r={0.8}
                      fill="#fff" stroke="#1d6bff" strokeWidth={0.4}
                      vectorEffect="non-scaling-stroke"
                    >
                      <animate attributeName="r" from="0.5" to="0.8" dur="0.25s" fill="freeze" />
                    </circle>
                  ))}
                </svg>
              )}

              {/* Freehand preview */}
              {drawMode === 'freehand' && freehandPoints.length > 1 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline
                    points={pointsToSvgString(freehandPoints)}
                    fill="rgba(29,107,255,0.10)"
                    stroke="#1d6bff"
                    strokeWidth={0.5}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}
            </div>
          </div>

          <div className="mt-4 px-4 py-3 surface-card rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-4 text-xs">
              <LegendSwatch color="#3b82f6" label={t('zones.canvas.entranceZone')} />
              <LegendSwatch color="#ef4444" label={t('zones.canvas.exitZone')} />
              <LegendSwatch color="#f59e0b" label={t('zones.canvas.queueZone')} />
              <LegendSwatch color="#10b981" label={t('zones.canvas.tableZone')} />
            </div>
            <div className="text-xs text-ink-3 font-mono">
              {t('zones.canvas.zonesDefined', { n: zones.length })}
            </div>
          </div>
        </div>

        {/* Side panel: zone list */}
        <div className="space-y-4">
          <div className="surface-card rounded-xl p-4 h-full flex flex-col">
            <h3 className="font-display text-sm font-semibold text-ink-0 mb-3 flex items-center">
              <Tag strokeWidth={1.5} className="w-4 h-4 mr-2 text-brand-300" />
              {t('zones.canvas.zoneList')}
            </h3>
            {zones.length === 0 ? (
              <p className="text-sm text-ink-3 text-center py-4">{t('zones.canvas.noZonesYet')}</p>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                <AnimatePresence>
                  {zones.map((zone) => (
                    <motion.div
                      key={zone.id}
                      layout
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedZoneId === zone.id ? 'border-brand-500/60 bg-brand-500/15 shadow-glow-brand' : 'border-white/[0.08] hover:border-white/[0.16] bg-white/[0.03]'}`}
                      onClick={() => setSelectedZoneId(zone.id)}
                    >
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <input
                          type="text"
                          value={zone.name}
                          onChange={(e) => updateZoneName(zone.id, e.target.value)}
                          className="text-sm font-semibold text-ink-0 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-brand-500/40 rounded px-1 -ml-1 flex-1 min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/[0.05] text-ink-3 border border-white/[0.08]">
                          {zone.shape === 'polygon' ? <Hexagon className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                          {zone.shape === 'polygon' ? 'poly' : 'rect'}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteZone(zone.id); }}
                          className="text-danger-400 hover:text-danger-300 p-1 hover:bg-danger-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 strokeWidth={1.5} className="w-4 h-4" />
                        </button>
                      </div>
                      <select
                        value={zone.type}
                        onChange={(e) => updateZoneType(zone.id, e.target.value as Zone['type'])}
                        className="w-full text-xs px-2 py-1 border border-white/[0.08] bg-surface-2/70 text-ink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="entrance">{t('zones.canvas.type.entrance')}</option>
                        <option value="exit">{t('zones.canvas.type.exit')}</option>
                        <option value="queue">{t('zones.canvas.type.queue')}</option>
                        <option value="table">{t('zones.canvas.type.table')}</option>
                      </select>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawModeButton({ active, onClick, icon, label, testId }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; testId?: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      data-testid={testId}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? 'bg-gradient-to-r from-brand-500 to-accent-500 text-white shadow-glow-brand'
          : 'bg-transparent text-ink-2 hover:text-ink-0 hover:bg-white/[0.05]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}

function ResizeHandle({ pos, onMouseDown }: { pos: 'nw' | 'ne' | 'sw' | 'se'; onMouseDown: (e: React.MouseEvent) => void }) {
  const cls = {
    nw: '-top-1.5 -left-1.5 cursor-nw-resize',
    ne: '-top-1.5 -right-1.5 cursor-ne-resize',
    sw: '-bottom-1.5 -left-1.5 cursor-sw-resize',
    se: '-bottom-1.5 -right-1.5 cursor-se-resize',
  }[pos];
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      transition={{ duration: 0.18 }}
      className={`absolute w-3 h-3 bg-white border border-white/40 rounded-full shadow-md ${cls}`}
      onMouseDown={onMouseDown}
    />
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center space-x-2">
      <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
      <span className="text-ink-2">{label}</span>
    </div>
  );
}
