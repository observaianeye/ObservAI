import { Clock, Timer, TrendingUp, TrendingDown } from 'lucide-react';

const speedKpis = [
  { label: 'Avg Service Time', value: '2:34', change: '-12s', trend: 'up', icon: Clock },
  { label: 'Peak Hour Time', value: '3:15', change: '+8s', trend: 'down', icon: Timer },
  { label: 'Orders/Hour', value: '47', change: '+5', trend: 'up', icon: TrendingUp },
  { label: 'Goal Achievement', value: '94%', change: '+3%', trend: 'up', icon: TrendingUp }
];

const serviceBreakdown = [
  { category: 'Order Taking', avgTime: '0:45', target: '1:00', percentage: 75 },
  { category: 'Preparation', avgTime: '1:20', target: '1:30', percentage: 89 },
  { category: 'Quality Check', avgTime: '0:15', target: '0:20', percentage: 75 },
  { category: 'Delivery', avgTime: '0:14', target: '0:15', percentage: 93 }
];

const regionData = [
  { region: 'Counter', avgTime: '2:12', orders: 234, efficiency: 96 },
  { region: 'Drive-Thru', avgTime: '3:45', orders: 189, efficiency: 82 },
  { region: 'Delivery', avgTime: '4:20', orders: 156, efficiency: 78 },
  { region: 'Mobile Order', avgTime: '1:54', orders: 98, efficiency: 98 }
];

export default function SpeedPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Speed of Service</h1>
        <p className="text-sm text-gray-600 mt-1">Track service times, efficiency, and goal achievement</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {speedKpis.map((kpi, index) => {
          const Icon = kpi.icon;
          const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown;

          return (
            <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-teal-600" />
                </div>
                <div className={`flex items-center space-x-1 text-xs font-medium ${
                  kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  <TrendIcon className="w-3 h-3" />
                  <span>{kpi.change}</span>
                </div>
              </div>
              <div className="text-2xl font-semibold text-gray-900 mb-1">{kpi.value}</div>
              <div className="text-sm text-gray-600">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Time Breakdown</h2>
          <div className="space-y-4">
            {serviceBreakdown.map((item, index) => (
              <div key={index}>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.category}</p>
                    <p className="text-xs text-gray-500">Target: {item.target}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{item.avgTime}</span>
                </div>
                <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.percentage >= 90 ? 'bg-green-500' : item.percentage >= 75 ? 'bg-blue-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance by Region</h2>
          <div className="space-y-4">
            {regionData.map((region, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{region.region}</p>
                    <p className="text-xs text-gray-500">{region.orders} orders</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{region.avgTime}</p>
                    <p className={`text-xs font-medium ${
                      region.efficiency >= 90 ? 'text-green-600' : region.efficiency >= 80 ? 'text-blue-600' : 'text-amber-600'
                    }`}>
                      {region.efficiency}% efficiency
                    </p>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      region.efficiency >= 90 ? 'bg-green-500' : region.efficiency >= 80 ? 'bg-blue-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${region.efficiency}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-xl border border-teal-200 p-6">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Performance Insight</h3>
            <p className="text-sm text-gray-700 mb-3">
              Your service times have improved by 12 seconds this week. Mobile orders show the best performance at 1:54 average time.
            </p>
            <p className="text-sm text-teal-700 font-medium">
              Consider promoting mobile ordering during peak hours to maintain efficiency.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
