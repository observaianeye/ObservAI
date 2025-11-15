import { TrendingUp, TrendingDown, Users, DollarSign, ShoppingCart, Eye } from 'lucide-react';
import GlassGaugeChart from '../../components/charts/GlassGaugeChart';
import GlassLineChart from '../../components/charts/GlassLineChart';
import Tooltip from '../../components/Tooltip';

const kpis = [
  {
    label: 'Total Revenue',
    value: '$45,231',
    change: '+12.5%',
    trend: 'up',
    icon: DollarSign,
    tooltip: 'Total revenue from all sales during the current period. Includes all payment methods and tips.'
  },
  {
    label: 'Total Visitors',
    value: '8,234',
    change: '+8.2%',
    trend: 'up',
    icon: Eye,
    tooltip: 'Number of customers detected by camera analytics. Helps track foot traffic patterns and peak hours.'
  },
  {
    label: 'Average Order Value',
    value: '$7.46',
    change: '-0.2%',
    trend: 'down',
    icon: ShoppingCart,
    tooltip: 'Average Order Value (AOV) is calculated by dividing total revenue by the number of orders. A higher AOV indicates customers are purchasing more per transaction.'
  },
  {
    label: 'Active Staff',
    value: '23',
    change: '+2',
    trend: 'up',
    icon: Users,
    tooltip: 'Number of employees currently on shift or scheduled to work today. Use this to optimize staffing levels.'
  }
];

const weeklyData = [
  { label: 'Mon', value: 4200 },
  { label: 'Tue', value: 4850 },
  { label: 'Wed', value: 5100 },
  { label: 'Thu', value: 6200 },
  { label: 'Fri', value: 7800 },
  { label: 'Sat', value: 8900 },
  { label: 'Sun', value: 7200 }
];

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard Overview</h1>
        <p className="text-sm text-gray-600 mt-1">Welcome back! Here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown;

          return (
            <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center space-x-1 text-xs font-medium ${
                    kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <TrendIcon className="w-3 h-3" />
                    <span>{kpi.change}</span>
                  </div>
                  <Tooltip content={kpi.tooltip} title={kpi.label} />
                </div>
              </div>
              <div className="text-2xl font-semibold text-gray-900 mb-1">{kpi.value}</div>
              <div className="text-sm text-gray-600">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      <div className="w-full">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Revenue Trend</h2>
        <div className="w-full max-w-full overflow-hidden">
          <GlassLineChart
            data={weeklyData}
            height={300}
            color="rgb(59, 130, 246)"
            gradient={true}
            animate={true}
            showGrid={true}
            showTooltip={true}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassGaugeChart
          value={87}
          max={100}
          label="Daily Goal"
          size={180}
          color="auto"
          animate={true}
        />
        <GlassGaugeChart
          value={73}
          max={100}
          label="Staff Utilization"
          size={180}
          color="auto"
          animate={true}
        />
        <GlassGaugeChart
          value={92}
          max={100}
          label="Customer Satisfaction"
          size={180}
          color="auto"
          animate={true}
        />
        <GlassGaugeChart
          value={68}
          max={100}
          label="Inventory Health"
          size={180}
          color="auto"
          animate={true}
        />
      </div>
    </div>
  );
}
