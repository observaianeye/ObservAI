import { useEffect, useState } from 'react';
import { TrendingUp, Users, Eye, DollarSign, Activity } from 'lucide-react';

export default function DashboardPreview() {
  const [visitors, setVisitors] = useState(127);
  const [revenue, setRevenue] = useState(3456);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisitors(prev => prev + Math.floor(Math.random() * 3));
      setRevenue(prev => prev + Math.floor(Math.random() * 50));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      {/* Main Dashboard Card */}
      <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-teal-500/10 rounded-2xl" />

        <div className="relative space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Live Analytics</h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-400">Live</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Visitors Card */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all group">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-teal-400" />
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-white group-hover:scale-105 transition-transform">
                {visitors}
              </div>
              <div className="text-xs text-gray-400">Visitors Today</div>
            </div>

            {/* Revenue Card */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all group">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-white group-hover:scale-105 transition-transform">
                ${revenue}
              </div>
              <div className="text-xs text-gray-400">Revenue Today</div>
            </div>
          </div>

          {/* Chart Visualization */}
          <div className="space-y-3">
            <div className="text-sm text-gray-400">Hourly Traffic</div>
            <div className="flex items-end space-x-2 h-32">
              {[40, 65, 45, 80, 95, 70, 85, 90, 75, 60, 55, 70].map((height, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-purple-500/50 to-teal-400/50 rounded-t-lg hover:from-purple-500 hover:to-teal-400 transition-all cursor-pointer animate-fade-in-up"
                  style={{
                    height: `${height}%`,
                    animationDelay: `${i * 50}ms`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Camera Overlay Indicator */}
          <div className="bg-purple-500/20 border border-purple-400/30 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <Eye className="w-5 h-5 text-purple-400 animate-pulse" />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">3 Cameras Active</div>
                <div className="text-xs text-gray-400">AI Detection Running</div>
              </div>
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Cards */}
      <div className="absolute -top-4 -right-4 bg-gradient-to-br from-teal-500/20 to-purple-500/20 backdrop-blur-xl border border-white/20 rounded-xl p-4 shadow-xl animate-float">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <div className="text-xs text-gray-400">Conversion</div>
            <div className="text-lg font-bold text-white">+12%</div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-4 -left-4 bg-gradient-to-br from-amber-500/20 to-purple-500/20 backdrop-blur-xl border border-white/20 rounded-xl p-4 shadow-xl animate-float" style={{ animationDelay: '1s' }}>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-xs text-gray-400">Avg Order</div>
            <div className="text-lg font-bold text-white">$24.50</div>
          </div>
        </div>
      </div>

      {/* Glow Effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-teal-500/20 blur-3xl -z-10 animate-pulse" />
    </div>
  );
}
