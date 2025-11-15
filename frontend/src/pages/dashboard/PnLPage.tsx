import { DollarSign, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import GlassWaterfallChart from '../../components/charts/GlassWaterfallChart';
import GlassRadarChart from '../../components/charts/GlassRadarChart';

const pnlKpis = [
  { label: 'Gross Revenue', value: '$45,231', change: '+12.5%', trend: 'up', icon: DollarSign },
  { label: 'Gross Profit', value: '$27,890', change: '+10.2%', trend: 'up', icon: TrendingUp },
  { label: 'Net Profit', value: '$8,450', change: '+8.1%', trend: 'up', icon: DollarSign },
  { label: 'Profit Margin', value: '18.7%', change: '+1.2%', trend: 'up', icon: Percent }
];

const pnlBreakdown = [
  { category: 'Revenue', amount: 45231, percentage: 100, color: 'blue' },
  { category: 'COGS', amount: -17341, percentage: 38.3, color: 'red', isExpense: true },
  { category: 'Gross Profit', amount: 27890, percentage: 61.7, color: 'green' },
  { category: 'Labor', amount: -12450, percentage: 27.5, color: 'red', isExpense: true },
  { category: 'Rent & Utilities', amount: -4200, percentage: 9.3, color: 'red', isExpense: true },
  { category: 'Operating Expenses', amount: -2790, percentage: 6.2, color: 'red', isExpense: true },
  { category: 'Net Profit', amount: 8450, percentage: 18.7, color: 'green', isFinal: true }
];

const monthlyComparison = [
  { month: 'Jan', revenue: 42300, profit: 7850 },
  { month: 'Feb', revenue: 43100, profit: 8020 },
  { month: 'Mar', revenue: 44200, profit: 8200 },
  { month: 'Apr', revenue: 43800, profit: 8100 },
  { month: 'May', revenue: 44900, profit: 8350 },
  { month: 'Jun', revenue: 45231, profit: 8450 }
];

const waterfallData = [
  { label: 'Revenue', value: 45231 },
  { label: 'COGS', value: -17341 },
  { label: 'Labor', value: -12450 },
  { label: 'Rent', value: -4200 },
  { label: 'Opex', value: -2790 },
  { label: 'Net Profit', value: 8450, isTotal: true }
];

const performanceMetrics = [
  { label: 'Revenue Growth', value: 85, max: 100 },
  { label: 'Cost Control', value: 72, max: 100 },
  { label: 'Profit Margin', value: 78, max: 100 },
  { label: 'Efficiency', value: 90, max: 100 },
  { label: 'Market Share', value: 65, max: 100 }
];

export default function PnLPage() {
  const maxValue = Math.max(...monthlyComparison.map(d => d.revenue));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Profit & Loss Overview</h1>
        <p className="text-sm text-gray-600 mt-1">Track revenue, costs, and profitability</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {pnlKpis.map((kpi, index) => {
          const Icon = kpi.icon;
          const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown;

          return (
            <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-green-600" />
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">P&L Statement</h2>
          <div className="space-y-3">
            {pnlBreakdown.map((item, index) => {
              const colorMap = {
                blue: 'text-blue-600',
                green: 'text-green-600',
                red: 'text-red-600'
              };

              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    item.isFinal ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${item.isFinal ? 'text-green-900' : 'text-gray-900'}`}>
                      {item.category}
                    </p>
                    {!item.isFinal && (
                      <p className="text-xs text-gray-500">{item.percentage}% of revenue</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${item.isFinal ? 'text-green-700' : colorMap[item.color as keyof typeof colorMap]}`}>
                      {item.isExpense ? '-' : ''}${Math.abs(item.amount).toLocaleString()}
                    </p>
                    {item.isFinal && (
                      <p className="text-xs text-green-600">{item.percentage}% margin</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">6-Month Trend</h2>
          <div className="relative h-64">
            <div className="absolute inset-0 flex items-end justify-between space-x-2">
              {monthlyComparison.map((data, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="w-full relative" style={{ height: '200px' }}>
                    <div
                      className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg"
                      style={{ height: `${(data.revenue / maxValue) * 100}%` }}
                    />
                    <div
                      className="absolute bottom-0 w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg"
                      style={{ height: `${(data.profit / maxValue) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">{data.month}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center space-x-6 mt-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-xs text-gray-600">Revenue</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-xs text-gray-600">Net Profit</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Waterfall Analysis</h2>
          <div className="flex justify-center">
            <GlassWaterfallChart
              data={waterfallData}
              width={700}
              height={400}
              animate={true}
              showGrid={true}
              showTooltip={true}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h2>
          <div className="flex justify-center">
            <GlassRadarChart
              data={performanceMetrics}
              size={400}
              color="rgba(59, 130, 246, 0.5)"
              animate={true}
              showLabels={true}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Cost of Goods</h3>
          <div className="flex items-baseline space-x-2 mb-2">
            <span className="text-3xl font-semibold text-gray-900">$17,341</span>
            <span className="text-sm text-gray-600">38.3%</span>
          </div>
          <p className="text-xs text-red-600">+2.1% vs target</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Labor Cost</h3>
          <div className="flex items-baseline space-x-2 mb-2">
            <span className="text-3xl font-semibold text-gray-900">$12,450</span>
            <span className="text-sm text-gray-600">27.5%</span>
          </div>
          <p className="text-xs text-green-600">-0.8% vs target</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Operating Costs</h3>
          <div className="flex items-baseline space-x-2 mb-2">
            <span className="text-3xl font-semibold text-gray-900">$6,990</span>
            <span className="text-sm text-gray-600">15.5%</span>
          </div>
          <p className="text-xs text-green-600">-1.2% vs target</p>
        </div>
      </div>
    </div>
  );
}
