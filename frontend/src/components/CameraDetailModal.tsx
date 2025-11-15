import { X, Users, Clock, TrendingUp, Activity, MapPin } from 'lucide-react';
import GlassLineChart from './charts/GlassLineChart';
import GlassBarChart from './charts/GlassBarChart';
import GlassDonutChart from './charts/GlassDonutChart';

interface CameraDetailModalProps {
  location: string;
  onClose: () => void;
}

export default function CameraDetailModal({ location, onClose }: CameraDetailModalProps) {
  const hourlyTraffic = [
    { label: '8AM', value: 15 },
    { label: '9AM', value: 28 },
    { label: '10AM', value: 42 },
    { label: '11AM', value: 58 },
    { label: '12PM', value: 75 },
    { label: '1PM', value: 68 },
    { label: '2PM', value: 52 },
    { label: '3PM', value: 45 }
  ];

  const dwellTimeData = [
    { label: '0-2 min', value: 145, color: 'rgb(34, 197, 94)' },
    { label: '2-5 min', value: 238, color: 'rgb(59, 130, 246)' },
    { label: '5-10 min', value: 167, color: 'rgb(251, 146, 60)' },
    { label: '10+ min', value: 89, color: 'rgb(239, 68, 68)' }
  ];

  const demographicsData = [
    { label: 'Male 18-24', value: 22, color: 'rgb(59, 130, 246)' },
    { label: 'Male 25-34', value: 28, color: 'rgb(37, 99, 235)' },
    { label: 'Female 18-24', value: 18, color: 'rgb(236, 72, 153)' },
    { label: 'Female 25-34', value: 32, color: 'rgb(219, 39, 119)' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-violet-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-2xl font-bold text-white">{location}</h2>
              <p className="text-blue-100 text-sm">Detailed Analytics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-88px)]">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-blue-900">Current People</p>
                </div>
                <p className="text-3xl font-bold text-blue-900">47</p>
                <p className="text-xs text-blue-700 mt-1">+12 from last hour</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-600 rounded-lg">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-green-900">Queue Length</p>
                </div>
                <p className="text-3xl font-bold text-green-900">8</p>
                <p className="text-xs text-green-700 mt-1">Avg: 2.3 min wait</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-5 border border-yellow-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-yellow-600 rounded-lg">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-yellow-900">Avg Dwell Time</p>
                </div>
                <p className="text-3xl font-bold text-yellow-900">12:34</p>
                <p className="text-xs text-yellow-700 mt-1">+45s from yesterday</p>
              </div>

              <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-5 border border-violet-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-violet-600 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-violet-900">Conversion Rate</p>
                </div>
                <p className="text-3xl font-bold text-violet-900">87%</p>
                <p className="text-xs text-violet-700 mt-1">+3% from last week</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Hourly Traffic Pattern</h3>
                <GlassLineChart
                  data={hourlyTraffic}
                  height={300}
                  color="rgb(59, 130, 246)"
                  gradient={true}
                  animate={true}
                  showGrid={true}
                  showTooltip={true}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Dwell Time Distribution</h3>
                  <GlassBarChart
                    data={dwellTimeData}
                    height={300}
                    animate={true}
                    showValues={true}
                    horizontal={false}
                  />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Demographics Breakdown</h3>
                  <GlassDonutChart
                    data={demographicsData}
                    size={280}
                    innerRadius={0.6}
                    animate={true}
                    showLegend={true}
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Zone Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">Counter Zone</p>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">
                      High
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">324</p>
                  <p className="text-xs text-gray-600 mt-1">Visitors today</p>
                  <div className="mt-3 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: '92%' }} />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">Queue Zone</p>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded">
                      Medium
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">198</p>
                  <p className="text-xs text-gray-600 mt-1">Visitors today</p>
                  <div className="mt-3 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500 rounded-full" style={{ width: '68%' }} />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">Seating Zone</p>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                      Normal
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">156</p>
                  <p className="text-xs text-gray-600 mt-1">Visitors today</p>
                  <div className="mt-3 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '54%' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <p className="text-sm font-semibold text-gray-900">
                  Camera is online and processing at 30 FPS
                </p>
              </div>
              <p className="text-xs text-gray-600">Detection accuracy: 96.8%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
