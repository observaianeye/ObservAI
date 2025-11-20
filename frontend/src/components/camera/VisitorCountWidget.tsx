import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { analyticsDataService, VisitorMetrics } from '../../services/analyticsDataService';
import { useDataMode } from '../../contexts/DataModeContext';

export default function VisitorCountWidget() {
  const { dataMode } = useDataMode();
  const [metrics, setMetrics] = useState<VisitorMetrics>({
    current: 0,
    entryCount: 0,
    exitCount: 0,
    totalToday: 0
  });
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState(0);

  useEffect(() => {
    analyticsDataService.setMode(dataMode);

    const loadData = async () => {
      setLoading(true);
      const data = await analyticsDataService.getData();
      setMetrics(data.visitors);
      // Calculate trend (simplified - comparing current to average)
      const avgOccupancy = 15; // Typical café occupancy
      setTrend(Math.round(((data.visitors.current - avgOccupancy) / avgOccupancy) * 100));
      setLoading(false);
    };

    loadData();

    analyticsDataService.startRealtimeUpdates((data) => {
      setMetrics(data.visitors);
      const avgOccupancy = 15;
      setTrend(Math.round(((data.visitors.current - avgOccupancy) / avgOccupancy) * 100));
    });

    return () => {
      analyticsDataService.stopRealtimeUpdates();
    };
  }, [dataMode]);

  return (
    <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-white">
      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            {trend !== 0 && (
              <div className={`flex items-center space-x-1 text-sm backdrop-blur-sm px-3 py-1 rounded-full ${
                trend > 0 ? 'bg-green-500/30' : 'bg-red-500/30'
              }`}>
                {trend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="font-semibold">{trend > 0 ? '+' : ''}{trend}%</span>
              </div>
            )}
          </div>
          <div className="mb-1">
            <p className="text-sm font-medium text-blue-100">Current Visitors</p>
            <p className="text-4xl font-bold tracking-tight">{metrics.current}</p>
          </div>
          <div className="pt-3 border-t border-white/20 grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-blue-100">Entry</p>
              <p className="font-bold text-white">{metrics.entryCount}</p>
            </div>
            <div>
              <p className="text-xs text-blue-100">Exit</p>
              <p className="font-bold text-white">{metrics.exitCount}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
