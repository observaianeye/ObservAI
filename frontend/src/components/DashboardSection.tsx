import { TrendingUp, TrendingDown, Users, DollarSign, Percent, Sparkles } from 'lucide-react';
import { useState } from 'react';

const kpiData = [
  {
    label: 'Visitors',
    value: '533',
    delta: '+3% WoW',
    trend: 'up',
    icon: Users,
    color: 'text-brand-300'
  },
  {
    label: 'Average Order Value',
    value: '$7.46',
    delta: '−0.2% WoW',
    trend: 'down',
    icon: DollarSign,
    color: 'text-success'
  },
  {
    label: 'Occupancy Rate',
    value: '68%',
    delta: '+4% WoW',
    trend: 'up',
    icon: Percent,
    color: 'text-violet-400'
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
  { name: 'Coffee', value: 45, color: '#1d6bff' },
  { name: 'Tea', value: 20, color: '#12bcff' },
  { name: 'Energy', value: 15, color: '#ffb547' },
  { name: 'Food', value: 20, color: '#9a4dff' }
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
    <section className="relative py-20 px-6 bg-surface-0">
      <div className="absolute inset-0 grid-floor opacity-30" />
      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          <div className="text-sm font-medium text-brand-300 mb-3 tracking-wide uppercase font-mono">
            Real-time Operational Analytics
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-ink-0 mb-4 tracking-tight">
            See ObservAI in Action
          </h2>
          <p className="text-lg text-ink-3 max-w-2xl mx-auto">
            Unified KPIs from Cameras, POS, Inventory, and Workforce.
          </p>
        </div>

        {/* Dashboard Preview Card */}
        <div
          className="surface-card rounded-2xl shadow-sm overflow-hidden animate-fade-in-up"
          style={{ animationDelay: '100ms' }}
        >
          {/* Filter Bar */}
          <div className="border-b border-white/[0.08] px-6 py-4 bg-white/[0.02]">
            <div className="flex flex-wrap items-center gap-3">
              {/* Branch Selector */}
              <select className="px-4 py-2 bg-surface-2/70 border border-white/[0.08] rounded-xl text-sm font-medium text-ink-1 hover:border-brand-500/30 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/40 transition-all">
                <option>Ankara Downtown</option>
                <option>Istanbul Central</option>
                <option>Izmir Marina</option>
              </select>

              {/* Date Range */}
              <select className="px-4 py-2 bg-surface-2/70 border border-white/[0.08] rounded-xl text-sm font-medium text-ink-1 hover:border-brand-500/30 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/40 transition-all">
                <option>Last 30 days</option>
                <option>Last 7 days</option>
                <option>Last 90 days</option>
              </select>

              {/* Apply Button */}
              <button className="px-6 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white text-sm font-semibold rounded-xl hover:shadow-glow-brand focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-1 transition-all">
                Apply
              </button>

              {/* Reset Button */}
              <button className="px-6 py-2 bg-white/[0.04] border border-white/[0.08] text-ink-1 text-sm font-medium rounded-xl hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-offset-2 focus:ring-offset-surface-1 transition-colors">
                Reset
              </button>
            </div>
          </div>

          {/* KPIs Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border-b border-white/[0.08]">
            {kpiData.map((kpi, index) => {
              const Icon = kpi.icon;
              const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown;

              return (
                <div
                  key={index}
                  className="bg-white/[0.03] rounded-xl p-5 border border-white/[0.08] hover:border-brand-500/30 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center ${kpi.color}`}>
                      <Icon className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    <div className={`flex items-center space-x-1 text-xs font-medium font-mono ${
                      kpi.trend === 'up' ? 'text-success' : 'text-danger'
                    }`}>
                      <TrendIcon className="w-3 h-3" strokeWidth={2} />
                      <span>{kpi.delta}</span>
                    </div>
                  </div>
                  <div className="font-display font-mono text-3xl font-semibold text-ink-0 mb-1">{kpi.value}</div>
                  <div className="text-sm text-ink-3">{kpi.label}</div>
                </div>
              );
            })}
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 border-b border-white/[0.08]">
            {/* Best Sellers Table */}
            <div className="lg:col-span-1">
              <h3 className="font-display text-sm font-semibold text-ink-0 mb-4">Best Sellers</h3>
              <div className="bg-white/[0.02] rounded-xl border border-white/[0.08] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white/[0.04] border-b border-white/[0.08]">
                      <th className="text-left py-3 px-3 font-semibold text-ink-2">#</th>
                      <th className="text-left py-3 px-3 font-semibold text-ink-2">Item</th>
                      <th className="text-right py-3 px-3 font-semibold text-ink-2">Sales</th>
                      <th className="text-right py-3 px-3 font-semibold text-ink-2">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestSellers.map((item, index) => (
                      <tr
                        key={index}
                        className={`border-b border-white/[0.06] last:border-0 transition-colors ${
                          hoveredRow === index ? 'bg-brand-500/10' : 'bg-transparent'
                        }`}
                        onMouseEnter={() => setHoveredRow(index)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <td className="py-3 px-3 text-ink-3 font-mono">{item.rank}</td>
                        <td className="py-3 px-3 text-ink-0 font-medium">{item.item}</td>
                        <td className="py-3 px-3 text-right text-ink-0 font-mono">{item.sales}</td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <span className="text-ink-0 font-mono">{item.margin}</span>
                            {item.trend === 'up' && <TrendingUp className="w-3 h-3 text-success" strokeWidth={2} />}
                            {item.trend === 'down' && <TrendingDown className="w-3 h-3 text-danger" strokeWidth={2} />}
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
              <h3 className="font-display text-sm font-semibold text-ink-0 mb-4">Sales vs Traffic</h3>
              <div className="bg-white/[0.02] rounded-xl border border-white/[0.08] p-4" role="img" aria-label="Sales vs Traffic over last 30 days">
                <div className="relative" style={{ height: `${chartHeight}px` }}>
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-ink-4 font-mono">
                    <span>{maxSales}</span>
                    <span>{Math.floor(maxSales / 2)}</span>
                    <span>0</span>
                  </div>

                  {/* Chart area */}
                  <div className="ml-10 h-full relative">
                    {/* Grid lines */}
                    <svg className="absolute inset-0 w-full h-full">
                      <line x1="0" y1="0" x2="100%" y2="0" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                      <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                      <line x1="0" y1="100%" x2="100%" y2="100%" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

                      {/* Target line (dashed) */}
                      <line
                        x1="0"
                        y1={`${(1 - 450 / maxSales) * 100}%`}
                        x2="100%"
                        y2={`${(1 - 450 / maxSales) * 100}%`}
                        stroke="rgba(181,192,217,0.5)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />

                      {/* Sales line */}
                      <polyline
                        points={salesData.map((d, i) =>
                          `${(i / (salesData.length - 1)) * 100},${(1 - d.sales / maxSales) * 100}`
                        ).join(' ')}
                        fill="none"
                        stroke="#1d6bff"
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
                          fill="#12bcff"
                        />
                      ))}
                    </svg>
                  </div>

                  {/* X-axis labels */}
                  <div className="absolute bottom-0 left-10 right-0 flex justify-between mt-2 text-xs text-ink-4 font-mono">
                    {salesData.map((d, i) => (
                      <span key={i}>{d.day}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Category Mix Donut */}
            <div className="lg:col-span-1">
              <h3 className="font-display text-sm font-semibold text-ink-0 mb-4">Category Mix</h3>
              <div className="bg-white/[0.02] rounded-xl border border-white/[0.08] p-4">
                <div className="flex flex-col items-center">
                  {/* Donut Chart */}
                  <svg width="140" height="140" viewBox="0 0 140 140" className="mb-4">
                    <circle cx="70" cy="70" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="20" />
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
                          <div className="text-ink-0 font-medium">{category.name}</div>
                          <div className="text-ink-3 font-mono">{category.value}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Suggestions Strip */}
          <div className="bg-brand-500/10 border-t border-brand-500/20 px-6 py-5">
            <div className="flex items-start space-x-3 mb-3">
              <Sparkles className="w-5 h-5 text-brand-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <div>
                <h3 className="font-display text-sm font-semibold text-ink-0 mb-1">AI Suggestions</h3>
                <p className="text-xs text-ink-3">Recommendations based on current performance</p>
              </div>
            </div>
            <div className="space-y-2 ml-8">
              {suggestions.map((suggestion, index) => {
                const Icon = suggestion.icon;
                return (
                  <div key={index} className="flex items-start space-x-2 text-sm text-ink-1">
                    <Icon className="w-4 h-4 text-brand-300 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
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
