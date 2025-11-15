import { TrendingUp } from 'lucide-react';

export default function SalesPOSVisual() {
  const salesData = [
    { label: '9AM', value: 45 },
    { label: '10AM', value: 68 },
    { label: '11AM', value: 85 },
    { label: '12PM', value: 92 },
    { label: '1PM', value: 78 },
    { label: '2PM', value: 65 }
  ];

  return (
    <div className="relative w-full aspect-square">
      {/* Main Container */}
      <div className="relative w-full h-full bg-gradient-to-br from-teal-500/10 to-teal-600/10 backdrop-blur-sm border border-teal-500/20 rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm text-teal-300 mb-1">Today's Revenue</div>
            <div className="text-3xl font-bold text-white">$3,456</div>
          </div>
          <div className="w-12 h-12 bg-teal-500/20 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-teal-400" />
          </div>
        </div>

        {/* Bar Chart */}
        <div className="space-y-4 mb-6">
          {salesData.map((item, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="w-12 text-xs text-gray-400 font-medium">{item.label}</div>
              <div className="flex-1 h-8 bg-teal-500/10 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-lg animate-expand-width"
                  style={{
                    width: `${item.value}%`,
                    animationDelay: `${i * 100}ms`
                  }}
                />
              </div>
              <div className="w-12 text-xs text-white font-bold text-right">
                ${Math.floor(item.value * 5)}
              </div>
            </div>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-teal-500/10 backdrop-blur-sm border border-teal-500/20 rounded-xl p-4">
            <div className="text-xs text-teal-300 mb-1">Best Seller</div>
            <div className="text-lg font-bold text-white">Latte</div>
            <div className="text-xs text-gray-400">42 sold</div>
          </div>
          <div className="bg-teal-500/10 backdrop-blur-sm border border-teal-500/20 rounded-xl p-4">
            <div className="text-xs text-teal-300 mb-1">Peak Hour</div>
            <div className="text-lg font-bold text-white">12PM</div>
            <div className="text-xs text-gray-400">+34%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
