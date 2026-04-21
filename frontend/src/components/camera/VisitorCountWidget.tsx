import { Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useEffect, useRef, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyticsDataService, VisitorMetrics, ZoneData } from '../../services/analyticsDataService';
import { useDataMode } from '../../contexts/DataModeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { GlassCard } from '../ui/GlassCard';

interface TrendSample {
  current: number;
  at: number;
}

const TREND_WINDOW_MS = 5 * 60 * 1000; // 5 min

const VisitorCountWidget = memo(function VisitorCountWidget() {
  const { dataMode } = useDataMode();
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState<VisitorMetrics>({
    current: 0, entryCount: 0, exitCount: 0, totalToday: 0,
  });
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(true);
  const samplesRef = useRef<TrendSample[]>([]);
  const [trend, setTrend] = useState<{ pct: number; label: 'up' | 'down' | 'flat' } | null>(null);

  useEffect(() => {
    analyticsDataService.setMode(dataMode);

    const handleNewData = (data: { visitors: VisitorMetrics; zones?: ZoneData[] }) => {
      setMetrics(data.visitors);
      setZones(data.zones || []);

      // Push sample and compute trend as 5-min delta
      const now = Date.now();
      samplesRef.current.push({ current: data.visitors.current, at: now });
      samplesRef.current = samplesRef.current.filter((s) => now - s.at <= TREND_WINDOW_MS * 2);

      const oldest = samplesRef.current.find((s) => now - s.at >= TREND_WINDOW_MS);
      if (oldest && oldest.current > 0) {
        const delta = data.visitors.current - oldest.current;
        const pct = Math.round((delta / Math.max(1, oldest.current)) * 100);
        setTrend({
          pct,
          label: pct > 3 ? 'up' : pct < -3 ? 'down' : 'flat',
        });
      } else {
        setTrend(null);
      }
    };

    const loadData = async () => {
      setLoading(true);
      const data = await analyticsDataService.getData();
      handleNewData(data);
      setLoading(false);
    };
    loadData();

    const unsubscribe = analyticsDataService.startRealtimeUpdates(handleNewData);
    return () => unsubscribe();
  }, [dataMode]);

  const formatDwell = (secs: number): string => {
    if (!Number.isFinite(secs) || secs <= 0) return '-';
    if (secs < 60) return `${Math.round(secs)} sn`;
    return `${Math.round(secs / 60)} dk`;
  };

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
            <AnimatePresence mode="wait">
              {trend && (
                <motion.div
                  key={trend.label}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className={`flex items-center space-x-1 text-sm backdrop-blur-sm px-3 py-1 rounded-full ${
                    trend.label === 'up'
                      ? 'bg-success-500/10 text-success-300'
                      : trend.label === 'down'
                        ? 'bg-danger-500/10 text-danger-300'
                        : 'bg-white/[0.05] text-ink-3'
                  }`}
                  title={t('widgets.visitors.trend5min') || 'Son 5 dk degisim'}
                >
                  {trend.label === 'up' ? <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
                    : trend.label === 'down' ? <TrendingDown className="w-4 h-4" strokeWidth={1.5} />
                      : <Minus className="w-4 h-4" strokeWidth={1.5} />}
                  <span className="font-semibold font-mono">
                    {trend.pct > 0 ? '+' : ''}{trend.pct}%
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mb-1">
            <p className="text-sm font-medium text-ink-3">{t('widgets.visitors.current')}</p>
            <motion.p
              key={metrics.current}
              initial={{ opacity: 0.7, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-4xl font-bold tracking-tight text-ink-0"
            >
              {metrics.current}
            </motion.p>
            <p className="mt-1 text-xs text-ink-4 font-mono">
              {metrics.entryCount} ↑ / {metrics.exitCount} ↓ &middot; bugun
            </p>
          </div>

          {zones.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/[0.08]">
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-[0.18em] font-mono mb-2">
                {t('widgets.visitors.zoneActivity')}
              </p>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                {zones.map((zone) => {
                  const dwell = formatDwell(zone.avgDwellTime || 0);
                  return (
                    <div
                      key={zone.id}
                      className="flex items-center justify-between text-xs rounded-md px-2 py-1.5 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${zone.currentOccupants > 0 ? 'bg-success-400' : 'bg-white/20'}`}
                        />
                        <span className="text-ink-2 truncate max-w-[110px]" title={zone.name}>
                          {zone.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="bg-brand-500/20 text-brand-200 px-1.5 py-0.5 rounded">
                          {zone.currentOccupants} <span className="text-[9px] opacity-70">kisi</span>
                        </span>
                        <span className="text-ink-4 text-[10px]">{dwell}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
});

export default VisitorCountWidget;
