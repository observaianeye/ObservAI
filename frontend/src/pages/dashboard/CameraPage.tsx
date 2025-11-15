import { Camera, Eye, Users, TrendingUp, MapPin } from 'lucide-react';
import GlassHeatmap from '../../components/charts/GlassHeatmap';
import GlassDonutChart from '../../components/charts/GlassDonutChart';
import GlassBarChart from '../../components/charts/GlassBarChart';

const cameraKpis = [
  { label: 'Total Visitors', value: '8,234', change: '+8.2%', icon: Eye },
  { label: 'Avg Dwell Time', value: '12:34', change: '+45s', icon: Users },
  { label: 'Peak Hour', value: '1:00 PM', change: '487 visitors', icon: TrendingUp },
  { label: 'Active Cameras', value: '8', change: 'All online', icon: Camera }
];

const demographicData = [
  { label: 'Male', percentage: 65, color: 'blue' },
  { label: 'Female', percentage: 35, color: 'pink' }
];

const ageGroups = [
  { range: '18-24', count: 1847, percentage: 22 },
  { range: '25-34', count: 2965, percentage: 36 },
  { range: '35-44', count: 2058, percentage: 25 },
  { range: '45+', count: 1364, percentage: 17 }
];

const ageGroupsData = ageGroups.map(age => ({
  label: age.range,
  value: age.count,
  color: `rgb(${99 + age.percentage}, ${102 + age.percentage * 2}, ${241})`
}));

const genderData = [
  { label: 'Male', value: 65, color: 'rgb(59, 130, 246)' },
  { label: 'Female', value: 35, color: 'rgb(236, 72, 153)' }
];

const heatmapData = [
  { x: 2, y: 1, value: 85, label: 'Entrance' },
  { x: 7, y: 1, value: 92, label: 'Counter' },
  { x: 2, y: 5, value: 68, label: 'Display' },
  { x: 7, y: 5, value: 95, label: 'Seating' },
  { x: 12, y: 3, value: 45, label: 'Restroom' },
  { x: 5, y: 3, value: 78, label: 'Queue' },
  { x: 9, y: 7, value: 88, label: 'Window Seats' },
  { x: 4, y: 8, value: 72, label: 'Corner' },
  { x: 11, y: 6, value: 81, label: 'Bar Area' }
];

export default function CameraPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Camera Analytics</h1>
        <p className="text-sm text-gray-600 mt-1">Track visitor patterns, demographics, and zone performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cameraKpis.map((kpi, index) => {
          const Icon = kpi.icon;

          return (
            <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-indigo-600" />
                </div>
                <span className="text-xs font-medium text-gray-600">{kpi.change}</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900 mb-1">{kpi.value}</div>
              <div className="text-sm text-gray-600">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      <div className="space-y-6">
        <GlassHeatmap
          data={heatmapData}
          width={600}
          height={400}
          rows={10}
          cols={15}
          animate={true}
          colorScale={['rgb(34, 197, 94)', 'rgb(251, 146, 60)', 'rgb(239, 68, 68)']}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassDonutChart
            data={genderData}
            size={250}
            innerRadius={0.65}
            animate={true}
            showLegend={true}
          />

          <GlassBarChart
            data={ageGroupsData}
            height={300}
            animate={true}
            showValues={true}
            horizontal={false}
          />
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Camera System Status</h3>
            <p className="text-sm text-gray-700 mb-3">
              All 8 cameras are online and operating normally. System is processing approximately 485 visitors per hour during peak times.
            </p>
            <div className="flex items-center space-x-6">
              <div>
                <p className="text-xs text-gray-600">Detection Accuracy</p>
                <p className="text-lg font-semibold text-gray-900">96.8%</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Processing Delay</p>
                <p className="text-lg font-semibold text-gray-900">0.3s</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Uptime</p>
                <p className="text-lg font-semibold text-gray-900">99.9%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
