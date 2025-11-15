import { useNavigate } from 'react-router-dom';
import { TrendingUp, Users, DollarSign, Clock, Eye, Activity } from 'lucide-react';
import GlassLineChart from './charts/GlassLineChart';
import GlassBarChart from './charts/GlassBarChart';
import GlassDonutChart from './charts/GlassDonutChart';
import GlassGaugeChart from './charts/GlassGaugeChart';
import GlassHeatmap from './charts/GlassHeatmap';

interface DashboardMockupProps {
  title: string;
  description: string;
  metrics?: Array<{ label: string; value: string; icon: React.ReactNode }>;
  children: React.ReactNode;
  className?: string;
}

export default function DashboardMockup({ title, description, metrics, children, className = '' }: DashboardMockupProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/login');
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 cursor-pointer ${className}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        borderColor: 'rgba(255, 255, 255, 0.3)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-violet-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative p-6 lg:p-8">
        <div className="mb-6">
          <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-base text-gray-600">{description}</p>
        </div>

        {metrics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {metrics.map((metric, idx) => (
              <div
                key={idx}
                className="rounded-xl p-4 transform group-hover:scale-105 transition-transform duration-300"
                style={{
                  background: 'rgba(255, 255, 255, 0.5)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  transitionDelay: `${idx * 50}ms`
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-white">
                    {metric.icon}
                  </div>
                </div>
                <div className="text-xs text-gray-600 font-medium mb-1">{metric.label}</div>
                <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-6">
          {children}
        </div>

        <button className="w-full py-3 px-6 text-base bg-gradient-to-r from-blue-500 via-violet-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg transform group-hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
          View Full Dashboard →
        </button>
      </div>

      <div className="absolute top-4 right-4 px-3 py-1 bg-gradient-to-r from-blue-500 to-violet-500 text-white text-xs font-semibold rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        Click to explore
      </div>
    </div>
  );
}

export function SalesDashboardMockup() {
  const revenueData = [
    { label: '9AM', value: 420 },
    { label: '10AM', value: 680 },
    { label: '11AM', value: 850 },
    { label: '12PM', value: 1240 },
    { label: '1PM', value: 1180 },
    { label: '2PM', value: 920 },
    { label: '3PM', value: 780 },
    { label: '4PM', value: 650 }
  ];

  const categoryData = [
    { label: 'Beverages', value: 18500, color: 'rgb(59, 130, 246)' },
    { label: 'Food', value: 15200, color: 'rgb(139, 92, 246)' },
    { label: 'Desserts', value: 8300, color: 'rgb(236, 72, 153)' },
    { label: 'Merchandise', value: 3231, color: 'rgb(34, 197, 94)' }
  ];

  return (
    <DashboardMockup
      title="Sales Analytics"
      description="Real-time sales tracking with AI-powered insights"
      metrics={[
        { label: 'Today Revenue', value: '$12,458', icon: <DollarSign className="w-4 h-4" /> },
        { label: 'Transactions', value: '342', icon: <TrendingUp className="w-4 h-4" /> },
        { label: 'Avg Check', value: '$36.42', icon: <DollarSign className="w-4 h-4" /> },
        { label: 'Peak Hour', value: '12-1 PM', icon: <Clock className="w-4 h-4" /> },
      ]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Hourly Revenue Trend</h4>
          <GlassLineChart
            data={revenueData}
            height={200}
            color="rgb(59, 130, 246)"
            gradient={true}
            animate={false}
            showGrid={true}
            showTooltip={false}
          />
        </div>

        <div className="rounded-xl p-4" style={{
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Revenue by Category</h4>
          <div className="flex justify-center">
            <GlassDonutChart
              data={categoryData}
              size={200}
              innerRadius={0.6}
              animate={false}
              showLegend={true}
            />
          </div>
        </div>
      </div>
    </DashboardMockup>
  );
}

export function LaborDashboardMockup() {
  const scheduleData = [
    { label: 'Mon', value: 12 },
    { label: 'Tue', value: 14 },
    { label: 'Wed', value: 11 },
    { label: 'Thu', value: 15 },
    { label: 'Fri', value: 18 },
    { label: 'Sat', value: 20 },
    { label: 'Sun', value: 16 }
  ];

  return (
    <DashboardMockup
      title="Labor Management"
      description="Optimize scheduling and track employee performance"
      metrics={[
        { label: 'Active Staff', value: '18', icon: <Users className="w-4 h-4" /> },
        { label: 'Labor Cost', value: '$1,245', icon: <DollarSign className="w-4 h-4" /> },
        { label: 'Coverage', value: '94%', icon: <TrendingUp className="w-4 h-4" /> },
        { label: 'Overtime', value: '2.5h', icon: <Clock className="w-4 h-4" /> },
      ]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl p-4" style={{
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Weekly Staff Schedule</h4>
          <GlassBarChart
            data={scheduleData.map(d => ({ label: d.label, value: d.value, color: 'rgb(139, 92, 246)' }))}
            height={200}
            animate={false}
            showValues={false}
            horizontal={false}
          />
        </div>

        <div className="space-y-3">
          <div className="rounded-xl p-4" style={{
            background: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}>
            <h4 className="text-xs font-semibold text-gray-600 mb-2">Coverage</h4>
            <GlassGaugeChart value={94} max={100} size={100} color="rgb(34, 197, 94)" />
          </div>
          <div className="rounded-xl p-4" style={{
            background: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}>
            <h4 className="text-xs font-semibold text-gray-600 mb-2">Efficiency</h4>
            <GlassGaugeChart value={88} max={100} size={100} color="rgb(59, 130, 246)" />
          </div>
        </div>
      </div>
    </DashboardMockup>
  );
}

export function CameraDashboardMockup() {
  // Convert 2D array to HeatmapCell[] format
  const heatmapData = [
    { x: 2, y: 1, value: 85, label: 'Entrance' },
    { x: 7, y: 1, value: 92, label: 'Counter' },
    { x: 2, y: 5, value: 68, label: 'Display' },
    { x: 7, y: 5, value: 95, label: 'Seating' },
    { x: 12, y: 3, value: 45, label: 'Restroom' },
    { x: 5, y: 3, value: 78, label: 'Queue' },
    { x: 9, y: 7, value: 88, label: 'Window' },
    { x: 4, y: 8, value: 72, label: 'Corner' }
  ];

  const trafficData = [
    { label: '8AM', value: 15 },
    { label: '10AM', value: 28 },
    { label: '12PM', value: 45 },
    { label: '2PM', value: 38 },
    { label: '4PM', value: 32 },
    { label: '6PM', value: 42 }
  ];

  return (
    <DashboardMockup
      title="AI Camera Analytics"
      description="Monitor customer flow and queue management with computer vision"
      metrics={[
        { label: 'Current Visitors', value: '43', icon: <Users className="w-4 h-4" /> },
        { label: 'Avg Dwell Time', value: '12.5 min', icon: <Clock className="w-4 h-4" /> },
        { label: 'Peak Traffic', value: '12-1 PM', icon: <Activity className="w-4 h-4" /> },
        { label: 'Cameras Online', value: '8/8', icon: <Eye className="w-4 h-4" /> },
      ]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Store Heat Map</h4>
          <GlassHeatmap
            data={heatmapData}
            width={300}
            height={180}
            rows={10}
            cols={15}
            animate={false}
            colorScale={['rgb(16, 185, 129)', 'rgb(245, 158, 11)', 'rgb(239, 68, 68)']}
          />
        </div>

        <div className="rounded-xl p-4" style={{
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Visitor Traffic</h4>
          <GlassLineChart
            data={trafficData}
            height={180}
            color="rgb(20, 184, 166)"
            gradient={true}
            animate={false}
            showGrid={true}
            showTooltip={false}
          />
        </div>
      </div>
    </DashboardMockup>
  );
}
