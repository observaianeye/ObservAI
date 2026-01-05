import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Save, Tag, Camera, AlertCircle } from 'lucide-react';
import { cameraBackendService } from '../../services/cameraBackendService';
import { useToast } from '../../contexts/ToastContext';

interface Zone {
  id: string;
  name: string;
  type: 'entrance' | 'exit';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

// Validation helper functions
function isWithinBoundaries(zone: Partial<Zone>): boolean {
  if (!zone.x || !zone.y || !zone.width || !zone.height) return false;

  return (
    zone.x >= 0 &&
    zone.y >= 0 &&
    zone.x + zone.width <= 1 &&
    zone.y + zone.height <= 1 &&
    zone.width > 0 &&
    zone.height > 0
  );
}

function doZonesOverlap(zone1: Zone, zone2: Zone): boolean {
  const left1 = zone1.x;
  const right1 = zone1.x + zone1.width;
  const top1 = zone1.y;
  const bottom1 = zone1.y + zone1.height;

  const left2 = zone2.x;
  const right2 = zone2.x + zone2.width;
  const top2 = zone2.y;
  const bottom2 = zone2.y + zone2.height;

  return !(right1 <= left2 || right2 <= left1 || bottom1 <= top2 || bottom2 <= top1);
}

function validateZone(newZone: Zone, existingZones: Zone[]): string | null {
  // Check boundaries
  if (!isWithinBoundaries(newZone)) {
    return 'Zone must stay within the camera view boundaries';
  }

  // Check overlaps
  for (const existing of existingZones) {
    if (doZonesOverlap(newZone, existing)) {
      return `Zone overlaps with "${existing.name}"`;
    }
  }

  return null; // Valid
}

export default function ZoneCanvas() {
  const { showToast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zones, setZones] = useState<Zone[]>(() => {
    // Load saved zones from localStorage
    const saved = localStorage.getItem('cameraZones');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newZone, setNewZone] = useState<Partial<Zone> | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [captureError, setCaptureError] = useState<string>('');

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDragStart({ x, y });
    setNewZone({
      id: Date.now().toString(),
      name: `Zone ${zones.length + 1}`,
      type: 'entrance',
      x,
      y,
      width: 0,
      height: 0,
      color: '#3b82f6'
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !dragStart || !newZone) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNewZone({
      ...newZone,
      width: Math.abs(x - dragStart.x),
      height: Math.abs(y - dragStart.y),
      x: Math.min(x, dragStart.x),
      y: Math.min(y, dragStart.y)
    });
  };

  const handleMouseUp = () => {
    if (newZone && newZone.width && newZone.width > 20 && newZone.height && newZone.height > 20) {
      // Normalize coordinates before saving (0-1 range)
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const normalizedZone = {
          ...newZone,
          x: newZone.x! / rect.width,
          y: newZone.y! / rect.height,
          width: newZone.width / rect.width,
          height: newZone.height / rect.height
        } as Zone;

        // Validate zone
        const error = validateZone(normalizedZone, zones);
        if (error) {
          showToast('error', error);
        } else {
          setZones([...zones, normalizedZone]);
          showToast('success', `Zone "${normalizedZone.name}" created`);
        }
      }
    }
    setNewZone(null);
    setDragStart(null);
    setIsDrawing(false);
  };

  const deleteZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id));
    setSelectedZone(null);
  };

  const updateZoneName = (id: string, name: string) => {
    setZones(zones.map(z => z.id === id ? { ...z, name } : z));
  };

  const updateZoneType = (id: string, type: 'entrance' | 'exit') => {
    const color = type === 'entrance' ? '#3b82f6' : '#ef4444';
    setZones(zones.map(z => z.id === id ? { ...z, type, color } : z));
  };

  const saveZones = () => {
    try {
      // Save zones to localStorage
      localStorage.setItem('cameraZones', JSON.stringify(zones));
      console.log('Zones saved to localStorage:', zones);
      showToast('success', `Successfully saved ${zones.length} zone${zones.length !== 1 ? 's' : ''}!`);
    } catch (error) {
      console.error('Failed to save zones:', error);
      showToast('error', 'Failed to save zones. Please try again.');
    }
  };

  const captureCameraSnapshot = async () => {
    setCaptureError('');

    try {
      // Ensure connected
      if (!cameraBackendService.getConnectionStatus()) {
        cameraBackendService.connect();
        // Wait a bit for connection
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('[ZoneCanvas] Requesting snapshot from backend...');
      const imageData = await cameraBackendService.getSnapshot();

      setBackgroundImage(imageData);
      localStorage.setItem('zoneLabelingBackground', imageData);
      console.log('Camera snapshot captured successfully');

    } catch (error: any) {
      console.error('Failed to capture snapshot:', error);
      setCaptureError(error.message || 'Failed to capture camera snapshot. Please try again.');
    }
  };

  // Load saved background image on mount
  useEffect(() => {
    const savedBackground = localStorage.getItem('zoneLabelingBackground');
    if (savedBackground) {
      setBackgroundImage(savedBackground);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Zone Labeling</h2>
          <p className="text-sm text-gray-600 mt-1">Draw rectangles to define entrance and exit zones on your camera view</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={captureCameraSnapshot}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 transition-colors flex items-center space-x-2"
          >
            <Camera className="w-4 h-4" />
            <span>Capture Camera</span>
          </button>
          <button
            onClick={() => setIsDrawing(true)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center space-x-2 ${isDrawing
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
          >
            <Plus className="w-4 h-4" />
            <span>{isDrawing ? 'Drawing...' : 'Add Zone'}</span>
          </button>
          <button
            onClick={saveZones}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 transition-colors flex items-center space-x-2 shadow-lg"
          >
            <Save className="w-4 h-4" />
            <span>Save All</span>
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
          <div className="bg-white rounded-xl border-2 border-gray-300 overflow-hidden shadow-lg">
            <div
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="relative bg-gray-900 aspect-video cursor-crosshair"
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

              {zones.map((zone) => {
                // Denormalize coordinates for display
                const rect = canvasRef.current?.getBoundingClientRect();
                const displayX = rect ? zone.x * rect.width : zone.x;
                const displayY = rect ? zone.y * rect.height : zone.y;
                const displayWidth = rect ? zone.width * rect.width : zone.width;
                const displayHeight = rect ? zone.height * rect.height : zone.height;

                return (
                  <div
                    key={zone.id}
                    onClick={() => setSelectedZone(zone.id)}
                    className={`absolute border-2 rounded cursor-move transition-all ${selectedZone === zone.id ? 'ring-4 ring-blue-300 ring-opacity-50' : ''
                      }`}
                    style={{
                      left: displayX,
                      top: displayY,
                      width: displayWidth,
                      height: displayHeight,
                      borderColor: zone.color,
                      backgroundColor: `${zone.color}20`
                    }}
                  >
                    <div
                      className="absolute top-0 left-0 px-2 py-1 text-xs font-semibold text-white rounded-br"
                      style={{ backgroundColor: zone.color }}
                    >
                      {zone.name}
                    </div>
                  </div>
                );
              })}

              {newZone && newZone.width && newZone.height && (
                <div
                  className="absolute border-2 border-dashed rounded"
                  style={{
                    left: newZone.x,
                    top: newZone.y,
                    width: newZone.width,
                    height: newZone.height,
                    borderColor: newZone.color,
                    backgroundColor: `${newZone.color}15`
                  }}
                />
              )}
            </div>

            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-600 rounded"></div>
                  <span className="text-gray-600">Entrance Zone</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-600 rounded"></div>
                  <span className="text-gray-600">Exit Zone</span>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {zones.length} zone{zones.length !== 1 ? 's' : ''} defined
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
              <Tag className="w-4 h-4 mr-2" />
              Zone List
            </h3>
            {zones.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No zones defined yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${selectedZone === zone.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    onClick={() => setSelectedZone(zone.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <input
                        type="text"
                        value={zone.name}
                        onChange={(e) => updateZoneName(zone.id, e.target.value)}
                        className="text-sm font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -ml-1 flex-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteZone(zone.id);
                        }}
                        className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <select
                      value={zone.type}
                      onChange={(e) => updateZoneType(zone.id, e.target.value as 'entrance' | 'exit')}
                      className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="entrance">Entrance</option>
                      <option value="exit">Exit</option>
                    </select>
                    <div className="mt-2 text-xs text-gray-500">
                      Position: ({(zone.x * 100).toFixed(1)}%, {(zone.y * 100).toFixed(1)}%)
                      <br />
                      Size: {(zone.width * 100).toFixed(1)}% × {(zone.height * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-blue-900 mb-2">Instructions</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Click "Add Zone" to start drawing</li>
              <li>• Click and drag on canvas to create zone</li>
              <li>• Click zone to select and edit</li>
              <li>• Change zone type in the list</li>
              <li>• Click "Save All" when done</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
