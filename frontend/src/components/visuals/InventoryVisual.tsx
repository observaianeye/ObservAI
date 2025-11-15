import { AlertTriangle, TrendingDown } from 'lucide-react';

export default function InventoryVisual() {
  const inventoryItems = [
    { name: 'Coffee Beans', level: 85, status: 'good' },
    { name: 'Milk', level: 45, status: 'medium' },
    { name: 'Sugar', level: 15, status: 'low' },
    { name: 'Cups', level: 72, status: 'good' }
  ];

  return (
    <div className="relative w-full aspect-square">
      {/* Main Container */}
      <div className="relative w-full h-full bg-gradient-to-br from-amber-500/10 to-amber-600/10 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm text-amber-300 mb-1">Inventory Status</div>
            <div className="text-2xl font-bold text-white">4 Items</div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-xs text-amber-300">Live</span>
          </div>
        </div>

        {/* Inventory List */}
        <div className="space-y-4 mb-6">
          {inventoryItems.map((item, i) => (
            <div
              key={i}
              className="bg-amber-500/10 backdrop-blur-sm border border-amber-500/20 rounded-xl p-4 hover:bg-amber-500/15 transition-all animate-fade-in-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{item.name}</span>
                <span
                  className={`text-xs font-bold ${
                    item.status === 'low'
                      ? 'text-red-400'
                      : item.status === 'medium'
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }`}
                >
                  {item.level}%
                </span>
              </div>
              <div className="h-2 bg-amber-900/30 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    item.status === 'low'
                      ? 'bg-gradient-to-r from-red-500 to-red-400'
                      : item.status === 'medium'
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                      : 'bg-gradient-to-r from-green-500 to-green-400'
                  }`}
                  style={{ width: `${item.level}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Alert Box */}
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 animate-pulse-slow">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-red-300 mb-1">Low Stock Alert</div>
              <div className="text-xs text-red-200">Sugar needs reordering</div>
            </div>
          </div>
        </div>

        {/* Cost Trend Indicator */}
        <div className="absolute bottom-6 right-6 bg-amber-900/40 backdrop-blur-md border border-amber-500/30 rounded-lg p-3 flex items-center space-x-2">
          <TrendingDown className="w-4 h-4 text-green-400" />
          <div>
            <div className="text-xs text-amber-300">Costs</div>
            <div className="text-sm font-bold text-white">-8%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
