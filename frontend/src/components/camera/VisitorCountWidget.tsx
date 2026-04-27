import { Users } from 'lucide-react';
import { useEffect, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { analyticsDataService, VisitorMetrics } from '../../services/analyticsDataService';
import { useLanguage } from '../../contexts/LanguageContext';
import { GlassCard } from '../ui/GlassCard';

const VisitorCountWidget = memo(function VisitorCountWidget() {
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState<VisitorMetrics>({
    current: 0, entryCount: 0, exitCount: 0, totalToday: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleNewData = (data: { visitors: VisitorMetrics }) => {
      setMetrics(data.visitors);
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
  }, []);

  return (
    <GlassCard variant="neon" className="p-4 text-ink-0">
      {loading ? (
        <div className="h-12 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-400"></div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-brand-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-brand-300" strokeWidth={1.5} />
            </div>
            <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.18em] font-mono truncate">
              {t('widgets.visitors.current')}
            </p>
          </div>
          <motion.span
            key={metrics.current}
            initial={{ opacity: 0.7, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-2xl font-bold tracking-tight text-ink-0 font-mono"
          >
            {metrics.current}
          </motion.span>
        </div>
      )}
    </GlassCard>
  );
});

export default VisitorCountWidget;
