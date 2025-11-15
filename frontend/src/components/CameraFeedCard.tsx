import { useState, useEffect } from 'react';
import { Users, Clock, TrendingUp, Maximize2, Activity } from 'lucide-react';

interface CameraMetrics {
  peopleCount: number;
  queueLength: number;
  avgWaitTime: string;
  demographics: { male: string; female: string };
  ageGroups: { [key: string]: string };
}

interface CameraFeedCardProps {
  location: string;
  cameraId: number;
  onExpand: () => void;
}

export default function CameraFeedCard({ location, cameraId, onExpand }: CameraFeedCardProps) {
  const [metrics, setMetrics] = useState<CameraMetrics>({
    peopleCount: Math.floor(Math.random() * 20) + 5,
    queueLength: Math.floor(Math.random() * 8),
    avgWaitTime: `${(Math.random() * 5 + 1).toFixed(1)} min`,
    demographics: {
      male: `${Math.floor(Math.random() * 30 + 55)}%`,
      female: `${Math.floor(Math.random() * 30 + 25)}%`
    },
    ageGroups: {
      '18-24': `${Math.floor(Math.random() * 15 + 15)}%`,
      '25-34': `${Math.floor(Math.random() * 15 + 30)}%`,
      '35-44': `${Math.floor(Math.random() * 15 + 20)}%`
    }
  });

  const [isHovered, setIsHovered] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [people, setPeople] = useState<Array<{ x: number; y: number; id: number }>>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        peopleCount: Math.floor(Math.random() * 20) + 5,
        queueLength: Math.floor(Math.random() * 8),
        avgWaitTime: `${(Math.random() * 5 + 1).toFixed(1)} min`,
        demographics: {
          male: `${Math.floor(Math.random() * 30 + 55)}%`,
          female: `${Math.floor(Math.random() * 30 + 25)}%`
        },
        ageGroups: {
          '18-24': `${Math.floor(Math.random() * 15 + 15)}%`,
          '25-34': `${Math.floor(Math.random() * 15 + 30)}%`,
          '35-44': `${Math.floor(Math.random() * 15 + 20)}%`
        }
      });

      setPeople(
        Array.from({ length: metrics.peopleCount }, (_, i) => ({
          x: Math.random() * 80 + 10,
          y: Math.random() * 80 + 10,
          id: i
        }))
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [metrics.peopleCount]);

  const heatmapZones = [
    { x: 15, y: 15, intensity: 0.8, label: 'Counter' },
    { x: 65, y: 20, intensity: 0.6, label: 'Queue' },
    { x: 40, y: 60, intensity: 0.4, label: 'Seating' }
  ];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${
        isHovered ? 'scale-105 shadow-2xl' : 'shadow-lg'
      }`}
      style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setExpandedMetric(null);
      }}
    >
      <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20" />

        <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 opacity-10">
          {Array.from({ length: 48 }).map((_, i) => (
            <div key={i} className="border border-white/10" />
          ))}
        </div>

        {showHeatmap && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <radialGradient id={`heatGradient-${cameraId}`}>
                <stop offset="0%" stopColor="rgba(239, 68, 68, 0.6)" />
                <stop offset="50%" stopColor="rgba(251, 146, 60, 0.4)" />
                <stop offset="100%" stopColor="rgba(34, 197, 94, 0.2)" />
              </radialGradient>
            </defs>
            {heatmapZones.map((zone, idx) => (
              <circle
                key={idx}
                cx={`${zone.x}%`}
                cy={`${zone.y}%`}
                r="15%"
                fill={`url(#heatGradient-${cameraId})`}
                opacity={zone.intensity}
              />
            ))}
          </svg>
        )}

        {people.map((person) => (
          <div
            key={person.id}
            className="absolute w-12 h-16 border-2 border-green-400 rounded animate-pulse"
            style={{
              left: `${person.x}%`,
              top: `${person.y}%`,
              boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)',
              opacity: isHovered ? 1 : 0.6
            }}
          >
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-green-400 text-black text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap">
              Person {person.id + 1}
            </div>
          </div>
        ))}

        <div className="absolute top-3 left-3">
          <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white text-sm font-semibold">LIVE</span>
          </div>
        </div>

        <div className="absolute top-3 right-3">
          <span className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white text-sm font-semibold">
            {location}
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg p-3">
            <div className="grid grid-cols-3 gap-3 text-white">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <div>
                  <p className="text-xs text-gray-300">People</p>
                  <p className="text-lg font-bold">{metrics.peopleCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400" />
                <div>
                  <p className="text-xs text-gray-300">Queue</p>
                  <p className="text-lg font-bold">{metrics.queueLength}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                <div>
                  <p className="text-xs text-gray-300">Wait</p>
                  <p className="text-lg font-bold">{metrics.avgWaitTime}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-1/2 right-3 transform -translate-y-1/2 flex flex-col gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedMetric(expandedMetric === 'demographics' ? null : 'demographics');
            }}
            className="p-2 bg-black/60 backdrop-blur-sm rounded-lg hover:bg-black/80 transition-colors"
          >
            <Users className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedMetric(expandedMetric === 'activity' ? null : 'activity');
            }}
            className="p-2 bg-black/60 backdrop-blur-sm rounded-lg hover:bg-black/80 transition-colors"
          >
            <TrendingUp className="w-5 h-5 text-white" />
          </button>
        </div>

        {expandedMetric === 'demographics' && (
          <div
            className="absolute right-16 top-1/2 transform -translate-y-1/2 w-64 bg-black/90 backdrop-blur-xl rounded-xl p-4 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-bold mb-3">Demographics</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-300 mb-1">Gender</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-blue-500/30 rounded px-2 py-1 text-center">
                    <p className="text-white text-sm font-bold">{metrics.demographics.male}</p>
                    <p className="text-xs text-gray-300">Male</p>
                  </div>
                  <div className="flex-1 bg-pink-500/30 rounded px-2 py-1 text-center">
                    <p className="text-white text-sm font-bold">{metrics.demographics.female}</p>
                    <p className="text-xs text-gray-300">Female</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-300 mb-2">Age Groups</p>
                {Object.entries(metrics.ageGroups).map(([age, percent]) => (
                  <div key={age} className="flex justify-between items-center mb-2">
                    <span className="text-white text-sm">{age}</span>
                    <span className="text-white font-bold text-sm">{percent}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {expandedMetric === 'activity' && (
          <div
            className="absolute right-16 top-1/2 transform -translate-y-1/2 w-64 bg-black/90 backdrop-blur-xl rounded-xl p-4 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-bold mb-3">Activity Metrics</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Avg Dwell Time</span>
                <span className="text-white font-bold">12m 34s</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Throughput/hr</span>
                <span className="text-white font-bold">87</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Conversion Rate</span>
                <span className="text-white font-bold">73%</span>
              </div>
            </div>
          </div>
        )}

        {isHovered && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <button
              onClick={onExpand}
              className="bg-white/90 backdrop-blur-sm hover:bg-white transition-all px-6 py-3 rounded-xl flex items-center gap-2 font-semibold text-gray-900 shadow-xl animate-fade-in"
            >
              <Maximize2 className="w-5 h-5" />
              View Details
            </button>
          </div>
        )}
      </div>

      <div className="p-4 bg-white/50 backdrop-blur-sm">
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            showHeatmap
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {showHeatmap ? 'Hide' : 'Show'} Heatmap
        </button>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
