import { TrendingUp, TrendingDown, Users, DollarSign, Percent, Sparkles } from 'lucide-react';
import { useState } from 'react';

const kpiData = [
  {
    label: 'Visitors',
    value: '533',
    delta: '+3% WoW',
    trend: 'up',
    icon: Users,
    color: 'text-blue-600'
  },
  {
    label: 'Average Order Value',
    value: '$7.46',
    delta: '−0.2% WoW',
    trend: 'down',
    icon: DollarSign,
    color: 'text-green-600'
  },
  {
    label: 'Occupancy Rate',
    value: '68%',
    delta: '+4% WoW',
    trend: 'up',
    icon: Percent,
    color: 'text-purple-600'
  }
];

const bestSellers = [
  { rank: 1, item: 'Iced Latte', sales: '32%', margin: '64%', trend: 'up' },
  { rank: 2, item: 'Cappuccino', sales: '24%', margin: '58%', trend: 'same' },
  { rank: 3, item: 'Croissant', sales: '18%', margin: '72%', trend: 'up' },
  { rank: 4, item: 'Espresso', sales: '14%', margin: '68%', trend: 'down' },
  { rank: 5, item: 'Cold Brew', sales: '12%', margin: '56%', trend: 'up' }
];

const categoryData = [
  { name: 'Coffee', value: 45, color: '#5B6BFF' },
  { name: 'Tea', value: 20, color: '#00BFA6' },
  { name: 'Energy', value: 15, color: '#F59E0B' },
  { name: 'Food', value: 20, color: '#EC4899' }
];

const suggestions = [
  { text: 'Staff 1 extra barista from 14:00–16:00 (queue spike).', icon: Users },
  { text: 'Run 10% bundle on iced latte + cookie (low afternoon AOV).', icon: Sparkles },
  { text: 'Replenish oat milk inventory before Friday.', icon: TrendingUp }
];

const salesData = [
  { day: 'Mon', sales: 420, target: 450 },
  { day: 'Tue', sales: 480, target: 450 },
  { day: 'Wed', sales: 460, target: 450 },
  { day: 'Thu', sales: 510, target: 450 },
  { day: 'Fri', sales: 580, target: 450 },
  { day: 'Sat', sales: 640, target: 450 },
  { day: 'Sun', sales: 520, target: 450 }
];

export default function DashboardSection() {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const maxSales = Math.max(...salesData.map(d => d.sales));
  const chartHeight = 180;

  return (
    <section className="relative py-20 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          <div className="text-sm font-medium text-blue-600 mb-3 tracking-wide uppercase">
            Real-time Operational Analytics
          </div>
          <h2 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-4">
            See ObservAI in Action
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Unified KPIs from Cameras, POS, Inventory, and Workforce.
          </p>
        </div>

        {/* Dashboard Preview Card */}
        <div
          className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in-up"
          style={{ animationDelay: '100ms' }}
        >
          {/* Filter Bar */}
          <div className="border-b border-gray-200 px-6 py-4 bg-gray-50/50">
            <div className="flex flex-wrap items-center gap-3">
              {/* Branch Selector */}
              <select className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                <option>Ankara Downtown</option>
                <option>Istanbul Central</option>
                <option>Izmir Marina</option>
              </select>

              {/* Date Range */}
              <select className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                <option>Last 30 days</option>
                <option>Last 7 days</option>
                <option>Last 90 days</option>
              </select>

              {/* Apply Button */}
              <button className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
                Apply
              </button>

              {/* Reset Button */}
              <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">
                Reset
              </button>
            </div>
          </div>

          {/* KPIs Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border-b border-gray-200">
            {kpiData.map((kpi, index) => {
              const Icon = kpi.icon;
              const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown;

              return (
                <div
                  key={index}
                  className="bg-gray-50 rounded-xl p-5 border border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center ${kpi.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className={`flex items-center space-x-1 text-xs font-medium ${
                      kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <TrendIcon className="w-3 h-3" />
                      <span>{kpi.delta}</span>
                    </div>
                  </div>
                  <div className="text-3xl font-semibold text-gray-900 mb-1">{kpi.value}</div>
                  <div className="text-sm text-gray-600">{kpi.label}</div>
                </div>
              );
            })}
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 border-b border-gray-200">
            {/* Best Sellers Table */}
            <div className="lg:col-span-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Best Sellers</h3>
              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white border-b border-gray-200">
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">#</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Item</th>
                      <th className="text-right py-3 px-3 font-semibold text-gray-700">Sales</th>
                      <th className="text-right py-3 px-3 font-semibold text-gray-700">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestSellers.map((item, index) => (
                      <tr
                        key={index}
                        className={`border-b border-gray-200 last:border-0 transition-colors ${
                          hoveredRow === index ? 'bg-blue-50/50' : 'bg-white'
                        }`}
                        onMouseEnter={() => setHoveredRow(index)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <td className="py-3 px-3 text-gray-600">{item.rank}</td>
                        <td className="py-3 px-3 text-gray-900 font-medium">{item.item}</td>
                        <td className="py-3 px-3 text-right text-gray-900">{item.sales}</td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <span className="text-gray-900">{item.margin}</span>
                            {item.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-600" />}
                            {item.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-600" />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sales vs Traffic Chart */}
            <div className="lg:col-span-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Sales vs Traffic</h3>
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4" role="img" aria-label="Sales vs Traffic over last 30 days">
                <div className="relative" style={{ height: `${chartHeight}px` }}>
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-gray-500">
                    <span>{maxSales}</span>
                    <span>{Math.floor(maxSales / 2)}</span>
                    <span>0</span>
                  </div>

                  {/* Chart area */}
                  <div className="ml-10 h-full relative">
                    {/* Grid lines */}
                    <svg className="absolute inset-0 w-full h-full">
                      <line x1="0" y1="0" x2="100%" y2="0" stroke="#E5E7EB" strokeWidth="1" />
                      <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#E5E7EB" strokeWidth="1" />
                      <line x1="0" y1="100%" x2="100%" y2="100%" stroke="#E5E7EB" strokeWidth="1" />

                      {/* Target line (dashed) */}
                      <line
                        x1="0"
                        y1={`${(1 - 450 / maxSales) * 100}%`}
                        x2="100%"
                        y2={`${(1 - 450 / maxSales) * 100}%`}
                        stroke="#9CA3AF"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />

                      {/* Sales line */}
                      <polyline
                        points={salesData.map((d, i) =>
                          `${(i / (salesData.length - 1)) * 100},${(1 - d.sales / maxSales) * 100}`
                        ).join(' ')}
                        fill="none"
                        stroke="#5B6BFF"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />

                      {/* Data points */}
                      {salesData.map((d, i) => (
                        <circle
                          key={i}
                          cx={`${(i / (salesData.length - 1)) * 100}%`}
                          cy={`${(1 - d.sales / maxSales) * 100}%`}
                          r="3"
                          fill="#5B6BFF"
                        />
                      ))}
                    </svg>
                  </div>

                  {/* X-axis labels */}
                  <div className="absolute bottom-0 left-10 right-0 flex justify-between mt-2 text-xs text-gray-500">
                    {salesData.map((d, i) => (
                      <span key={i}>{d.day}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Category Mix Donut */}
            <div className="lg:col-span-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Category Mix</h3>
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col items-center">
                  {/* Donut Chart */}
                  <svg width="140" height="140" viewBox="0 0 140 140" className="mb-4">
                    <circle cx="70" cy="70" r="50" fill="none" stroke="#F3F4F6" strokeWidth="20" />
                    {(() => {
                      let currentAngle = -90;
                      return categoryData.map((category, index) => {
                        const percentage = category.value / 100;
                        const circumference = 2 * Math.PI * 50;
                        const strokeDasharray = `${percentage * circumference} ${circumference}`;
                        const rotation = currentAngle;
                        currentAngle += (percentage * 360);

                        return (
                          <circle
                            key={index}
                            cx="70"
                            cy="70"
                            r="50"
                            fill="none"
                            stroke={category.color}
                            strokeWidth="20"
                            strokeDasharray={strokeDasharray}
                            transform={`rotate(${rotation} 70 70)`}
                            style={{ transition: 'stroke-dasharray 0.3s ease' }}
                          />
                        );
                      });
                    })()}
                  </svg>

                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {categoryData.map((category, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: category.color }}
                        />
                        <div className="text-xs">
                          <div className="text-gray-900 font-medium">{category.name}</div>
                          <div className="text-gray-600">{category.value}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Suggestions Strip */}
          <div className="bg-blue-50 px-6 py-5">
            <div className="flex items-start space-x-3 mb-3">
              <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">AI Suggestions</h3>
                <p className="text-xs text-gray-600">Recommendations based on current performance</p>
              </div>
            </div>
            <div className="space-y-2 ml-8">
              {suggestions.map((suggestion, index) => {
                const Icon = suggestion.icon;
                return (
                  <div key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                    <Icon className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>{suggestion.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
