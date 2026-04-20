import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { useEffect, useState, memo } from 'react';
import { analyticsDataService, VisitorMetrics, ZoneData } from '../../services/analyticsDataService';
import { useDataMode } from '../../contexts/DataModeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { GlassCard } from '../ui/GlassCard';

const VisitorCountWidget = memo(function VisitorCountWidget() {
  const { dataMode } = useDataMode();
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState<VisitorMetrics>({
    current: 0,
    entryCount: 0,
    exitCount: 0,
    totalToday: 0
  });
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState(0);

  useEffect(() => {
    analyticsDataService.setMode(dataMode);

    const loadData = async () => {
      setLoading(true);
      const data = await analyticsDataService.getData();
      setMetrics(data.visitors);
      setZones(data.zones || []);
      // Calculate trend (simplified - comparing current to average)
      const avgOccupancy = 15; // Typical café occupancy
      setTrend(Math.round(((data.visitors.current - avgOccupancy) / avgOccupancy) * 100));
      setLoading(false);
    };

    loadData();

    // Subscribe and get unsubscribe function
    const unsubscribe = analyticsDataService.startRealtimeUpdates((data) => {
      setMetrics(data.visitors);
      setZones(data.zones || []);
      const avgOccupancy = 15;
      setTrend(Math.round(((data.visitors.current - avgOccupancy) / avgOccupancy) * 100));
    });

    return () => {
      unsubscribe();
    };
  }, [dataMode]);

  return (
    <GlassCard variant="neon" className="p-6 text-ink-0">
      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-400"></div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-brand-500/10 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-brand-300" strokeWidth={1.5} />
            </div>
            {trend !== 0 && (
              <div className={`flex items-center space-x-1 text-sm backdrop-blur-sm px-3 py-1 rounded-full ${trend > 0 ? 'bg-success-500/10 text-success-400' : 'bg-danger-500/10 text-danger-400'
                }`}>
                {trend > 0 ? <TrendingUp className="w-4 h-4" strokeWidth={1.5} /> : <TrendingDown className="w-4 h-4" strokeWidth={1.5} />}
                <span className="font-semibold font-mono">{trend > 0 ? '+' : ''}{trend}%</span>
              </div>
            )}
          </div>
          <div className="mb-1">
            <p className="text-sm font-medium text-ink-3">{t('widgets.visitors.current')}</p>
            <p className="font-display text-4xl font-bold tracking-tight text-ink-0">{metrics.current}</p>
          </div>

          {/* Zone Occupancy List */}
          {zones.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.08] space-y-2">
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-[0.18em] font-mono mb-2">{t('widgets.visitors.zoneActivity')}</p>
              <div className="space-y-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
                {zones.map(zone => (
                  <div key={zone.id} className="flex justify-between items-center text-xs">
                    <span className="text-ink-2 truncate max-w-[120px]" title={zone.name}>{zone.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="bg-brand-500/20 text-brand-200 px-1.5 py-0.5 rounded font-mono">
                        {zone.currentOccupants} {t('widgets.visitors.inside')}
                      </span>
                      <span className="text-ink-4 border-l border-white/[0.08] pl-2 font-mono">
                        {zone.totalVisitors} {t('widgets.visitors.total')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
});

export default VisitorCountWidget;
