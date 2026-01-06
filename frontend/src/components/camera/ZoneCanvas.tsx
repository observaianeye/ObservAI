import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, Tag, Camera, AlertCircle, RefreshCw } from 'lucide-react';
import { cameraBackendService, Zone } from '../../services/cameraBackendService';
import { useToast } from '../../contexts/ToastContext';

export default function ZoneCanvas() {
  const { showToast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  // State
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [captureError, setCaptureError] = useState<string>('');

  // Interaction State
  const [interactionState, setInteractionState] = useState<{
    mode: 'drawing' | 'moving' | 'resizing' | null;
    startPoint: { x: number; y: number } | null; // Screen coordinates (clientX, clientY)
    activeZoneId: string | null;
    initialZoneState: Zone | null; // For reverting or delta calc
    resizeHandle: string | null; // 'nw', 'ne', 'sw', 'se'
  }>({
    mode: null,
    startPoint: null,
    activeZoneId: null,
    initialZoneState: null,
    resizeHandle: null
  });

  // Temporary New Zone (while drawing)
  const [tempZone, setTempZone] = useState<Partial<Zone> | null>(null);

  // Load Zones from Backend
  const loadZones = useCallback(async () => {
    try {
      setLoading(true);
      // Try to connect if not connected
      if (!cameraBackendService.getConnectionStatus()) {
        cameraBackendService.connect();
        await new Promise(r => setTimeout(r, 500));
      }

      const loadedZones = await cameraBackendService.getZones();
      setZones(loadedZones);
      console.log('Loaded zones:', loadedZones);
    } catch (error: any) {
      console.error('Failed to load zones:', error);
      // Fallback to localStorage just in case
      const saved = localStorage.getItem('cameraZones');
      if (saved) {
        try {
          setZones(JSON.parse(saved));
        } catch { }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadZones();

    // Load background
    const savedBackground = localStorage.getItem('zoneLabelingBackground');
    if (savedBackground) setBackgroundImage(savedBackground);
  }, [loadZones]);

  // --- Interaction Handlers ---

  const getNormalizedPoint = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (loading) return;

    // Prevent default to stop text selection
    e.preventDefault();
    e.stopPropagation(); // Important to stop event bubbling

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // If we are already in an interaction, ignore
    if (interactionState.mode) return;

    // If "Add Zone" mode is active
    if (isDrawing) {
      const { x, y } = getNormalizedPoint(e);
      setInteractionState({
        mode: 'drawing',
        startPoint: { x: e.clientX, y: e.clientY },
        activeZoneId: 'temp',
        initialZoneState: null,
        resizeHandle: null
      });
      setTempZone({
        id: Date.now().toString(),
        name: `Zone ${zones.length + 1}`,
        type: 'entrance',
        x, y, width: 0, height: 0,
        color: '#3b82f6'
      });
      setSelectedZoneId(null);
      return;
    }

    // Default: Deselect
    setSelectedZoneId(null);
  };

  const startMoving = (e: React.MouseEvent, zone: Zone) => {
    e.stopPropagation();
    if (isDrawing) return;

    setSelectedZoneId(zone.id);
    setInteractionState({
      mode: 'moving',
      startPoint: { x: e.clientX, y: e.clientY },
      activeZoneId: zone.id,
      initialZoneState: { ...zone },
      resizeHandle: null
    });
  };

  const startResizing = (e: React.MouseEvent, zone: Zone, handle: string) => {
    e.stopPropagation();
    if (isDrawing) return;

    setInteractionState({
      mode: 'resizing',
      startPoint: { x: e.clientX, y: e.clientY },
      activeZoneId: zone.id,
      initialZoneState: { ...zone },
      resizeHandle: handle
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !interactionState.mode || !interactionState.startPoint) return;

    const deltaX = (e.clientX - interactionState.startPoint.x) / rect.width;
    const deltaY = (e.clientY - interactionState.startPoint.y) / rect.height;

    if (interactionState.mode === 'drawing' && tempZone) {
      const rawStart = getNormalizedPoint({ clientX: interactionState.startPoint.x, clientY: interactionState.startPoint.y } as any);
      const current = getNormalizedPoint(e);

      const x = Math.min(rawStart.x, current.x);
      const y = Math.min(rawStart.y, current.y);
      const w = Math.abs(current.x - rawStart.x);
      const h = Math.abs(current.y - rawStart.y);

      setTempZone({ ...tempZone, x, y, width: w, height: h });
    }
    else if (interactionState.mode === 'moving' && interactionState.initialZoneState) {
      const init = interactionState.initialZoneState;
      let newX = init.x + deltaX;
      let newY = init.y + deltaY;

      // Clamp to bounds
      newX = Math.max(0, Math.min(newX, 1 - init.width));
      newY = Math.max(0, Math.min(newY, 1 - init.height));

      // Update zone list optimistically
      setZones(zones.map(z => z.id === init.id ? { ...z, x: newX, y: newY } : z));
    }
    else if (interactionState.mode === 'resizing' && interactionState.initialZoneState) {
      const init = interactionState.initialZoneState;
      const handle = interactionState.resizeHandle;
      let { x, y, width: w, height: h } = init;

      // Calculate change
      if (handle?.includes('e')) w += deltaX;
      if (handle?.includes('w')) { x += deltaX; w -= deltaX; }
      if (handle?.includes('s')) h += deltaY;
      if (handle?.includes('n')) { y += deltaY; h -= deltaY; }

      // Constraint: Min size
      if (w < 0.02) w = 0.02;
      if (h < 0.02) h = 0.02;

      // Update zone
      setZones(zones.map(z => z.id === init.id ? { ...z, x, y, width: w, height: h } : z));
    }
  };

  const handleMouseUp = () => {
    if (interactionState.mode === 'drawing' && tempZone) {
      if (tempZone.width && tempZone.width > 0.05 && tempZone.height && tempZone.height > 0.05) {
        setZones([...zones, tempZone as Zone]);
        showToast('success', `Zone created`);
      } else {
        // showToast('error', 'Zone too small');
      }
      setTempZone(null);
      setIsDrawing(false);
    }

    // Reset interaction
    setInteractionState({
      mode: null,
      startPoint: null,
      activeZoneId: null,
      initialZoneState: null,
      resizeHandle: null
    });
  };

  // --- CRUD Operations ---

  const deleteZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id));
    if (selectedZoneId === id) setSelectedZoneId(null);
  };

  const updateZoneName = (id: string, name: string) => {
    setZones(zones.map(z => z.id === id ? { ...z, name } : z));
  };

  const updateZoneType = (id: string, type: 'entrance' | 'exit') => {
    const color = type === 'entrance' ? '#3b82f6' : '#ef4444';
    setZones(zones.map(z => z.id === id ? { ...z, type, color } : z));
  };

  const saveZones = async () => {
    try {
      setLoading(true);

      // 1. Save to Backend via Socket
      await cameraBackendService.saveZones(zones);

      // 2. Save to LocalStorage (backup)
      localStorage.setItem('cameraZones', JSON.stringify(zones));

      console.log('Zones saved successfully');
      showToast('success', `Successfully saved ${zones.length} zone${zones.length !== 1 ? 's' : ''}!`);
    } catch (error: any) {
      console.error('Failed to save zones:', error);
      showToast('error', `Failed to save: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const captureCameraSnapshot = async () => {
    setCaptureError('');
    try {
      if (!cameraBackendService.getConnectionStatus()) {
        cameraBackendService.connect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      const imageData = await cameraBackendService.getSnapshot();
      setBackgroundImage(imageData);
      localStorage.setItem('zoneLabelingBackground', imageData);
    } catch (error: any) {
      setCaptureError(error.message || 'Failed to capture camera snapshot.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-400">Zone Labeling</h2>
          <p className="text-sm text-gray-400 mt-1">Draw rectangles to define entrance and exit zones on your camera view</p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={loadZones} className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800/50 rounded-lg" title="Reload Zones">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={captureCameraSnapshot}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 transition-colors flex items-center space-x-2"
          >
            <Camera className="w-4 h-4" />
            <span>Capture Camera</span>
          </button>
          <button
            onClick={() => { setIsDrawing(!isDrawing); setSelectedZoneId(null); }}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center space-x-2 ${isDrawing
              ? 'bg-blue-600 text-white shadow-lg ring-2 ring-offset-2 ring-blue-500'
              : 'bg-gray-800/50 border border-blue-500/30 text-gray-300 hover:bg-gray-800/70'
              }`}
          >
            <Plus className="w-4 h-4" />
            <span>{isDrawing ? 'Drawing Mode' : 'Add Zone'}</span>
          </button>
          <button
            onClick={saveZones}
            disabled={loading}
            className={`px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 transition-colors flex items-center space-x-2 shadow-lg ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Save All'}</span>
          </button>
        </div>
      </div>

      {captureError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Capture Failed</p>
            <p className="text-sm text-red-700 mt-1">{captureError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-xl border-2 border-blue-500/30 overflow-hidden shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:border-blue-500/50 backdrop-blur-md bg-gray-900/80 select-none">
            <div
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`relative bg-gray-900 aspect-video ${isDrawing ? 'cursor-crosshair' : 'cursor-default'}`}
              style={{
                backgroundImage: backgroundImage
                  ? `url(${backgroundImage})`
                  : 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect width=\'20\' height=\'20\' fill=\'%23374151\'/%3E%3Cpath d=\'M0 0h20v20H0z\' fill=\'none\' stroke=\'%234b5563\' stroke-width=\'1\'/%3E%3C/svg%3E")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            >
              {!backgroundImage && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm font-medium pointer-events-none">
                  <div className="text-center">
                    <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Click "Capture Camera" to use your camera view as background</p>
                  </div>
                </div>
              )}

              {/* Render Zones */}
              {zones.map((zone) => {
                const isSelected = selectedZoneId === zone.id;

                return (
                  <div
                    key={zone.id}
                    onMouseDown={(e) => startMoving(e, zone)}
                    className={`absolute border-2 rounded transition-opacity hover:opacity-90 ${isSelected ? 'z-10 ring-2 ring-white ring-opacity-50' : 'z-0'}`}
                    style={{
                      left: `${zone.x * 100}%`,
                      top: `${zone.y * 100}%`,
                      width: `${zone.width * 100}%`,
                      height: `${zone.height * 100}%`,
                      borderColor: zone.color,
                      backgroundColor: `${zone.color}20`,
                      cursor: isDrawing ? 'crosshair' : 'move'
                    }}
                  >
                    <div
                      className="absolute top-0 left-0 px-2 py-1 text-xs font-semibold text-white rounded-br pointer-events-none"
                      style={{ backgroundColor: zone.color }}
                    >
                      {zone.name}
                    </div>

                    {/* Resize Handles (only if selected) */}
                    {isSelected && !isDrawing && (
                      <>
                        {/* Corners */}
                        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-gray-400 rounded-full cursor-nw-resize"
                          onMouseDown={(e) => startResizing(e, zone, 'nw')}></div>
                        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-gray-400 rounded-full cursor-ne-resize"
                          onMouseDown={(e) => startResizing(e, zone, 'ne')}></div>
                        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-gray-400 rounded-full cursor-sw-resize"
                          onMouseDown={(e) => startResizing(e, zone, 'sw')}></div>
                        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-gray-400 rounded-full cursor-se-resize"
                          onMouseDown={(e) => startResizing(e, zone, 'se')}></div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Temp Zone Drawing */}
              {tempZone && tempZone.width !== undefined && (
                <div
                  className="absolute border-2 border-dashed rounded bg-blue-500 bg-opacity-20 border-blue-500 pointer-events-none"
                  style={{
                    left: `${(tempZone.x || 0) * 100}%`,
                    top: `${(tempZone.y || 0) * 100}%`,
                    width: `${(tempZone.width || 0) * 100}%`,
                    height: `${(tempZone.height || 0) * 100}%`
                  }}
                />
              )}
            </div>
          </div>

          <div className="mt-4 px-4 py-3 bg-gray-900/80 border border-blue-500/30 rounded-lg flex items-center justify-between shadow-[0_0_15px_rgba(59,130,246,0.1)] backdrop-blur-md">
            <div className="flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-600 rounded"></div>
                <span className="text-gray-300">Entrance Zone</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-600 rounded"></div>
                <span className="text-gray-300">Exit Zone</span>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              {zones.length} zone{zones.length !== 1 ? 's' : ''} defined
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-blue-500/30 p-4 shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:border-blue-500/50 backdrop-blur-md bg-gray-900/80 h-full flex flex-col">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center">
              <Tag className="w-4 h-4 mr-2" />
              Zone List
            </h3>
            {zones.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No zones defined yet</p>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${selectedZoneId === zone.id
                      ? 'border-blue-500 bg-blue-500/20 ring-1 ring-blue-500'
                      : 'border-blue-500/30 hover:border-blue-500/50 bg-gray-800/50'
                      }`}
                    onClick={() => setSelectedZoneId(zone.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <input
                        type="text"
                        value={zone.name}
                        onChange={(e) => updateZoneName(zone.id, e.target.value)}
                        className="text-sm font-semibold text-white bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -ml-1 flex-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteZone(zone.id);
                        }}
                        className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/20 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <select
                      value={zone.type}
                      onChange={(e) => updateZoneType(zone.id, e.target.value as 'entrance' | 'exit')}
                      className="w-full text-xs px-2 py-1 border border-blue-500/30 bg-gray-800/50 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="entrance">Entrance</option>
                      <option value="exit">Exit</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
