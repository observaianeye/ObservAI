import { Users } from 'lucide-react';
import { useEffect, useRef, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { analyticsDataService, VisitorMetrics } from '../../services/analyticsDataService';
import { useLanguage } from '../../contexts/LanguageContext';
import { GlassCard } from '../ui/GlassCard';

const HOUR_MS = 60 * 60 * 1000;

interface EntrySample {
  total: number;
  at: number;
}

const VisitorCountWidget = memo(function VisitorCountWidget() {
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState<VisitorMetrics>({
    current: 0, entryCount: 0, exitCount: 0, totalToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'hour' | 'today'>('hour');
  const samplesRef = useRef<EntrySample[]>([]);
  const [hourCount, setHourCount] = useState(0);

  useEffect(() => {
    const handleNewData = (data: { visitors: VisitorMetrics }) => {
      setMetrics(data.visitors);

      const now = Date.now();
      const total = data.visitors.entryCount;
      samplesRef.current.push({ total, at: now });
      samplesRef.current = samplesRef.current.filter((s) => now - s.at <= HOUR_MS + 60_000);

      const oldest = samplesRef.current.find((s) => now - s.at >= HOUR_MS) ?? samplesRef.current[0];
      if (oldest && oldest !== samplesRef.current[samplesRef.current.length - 1]) {
        setHourCount(Math.max(0, total - oldest.total));
      } else {
        setHourCount(0);
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
  }, []);

  const shownCount = view === 'hour' ? hourCount : metrics.entryCount;
  const shownLabel = view === 'hour'
    ? t('widgets.visitors.lastHour')
    : t('widgets.visitors.today');

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
          </div>
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

          <div className="mt-4 inline-flex items-center rounded-full bg-white/[0.04] border border-white/[0.06] p-0.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setView('hour')}
              className={`px-3 py-1 rounded-full transition-colors ${
                view === 'hour'
                  ? 'bg-brand-500/20 text-brand-200'
                  : 'text-ink-3 hover:text-ink-1'
              }`}
            >
              {t('widgets.visitors.lastHour')}
            </button>
            <button
              type="button"
              onClick={() => setView('today')}
              className={`px-3 py-1 rounded-full transition-colors ${
                view === 'today'
                  ? 'bg-brand-500/20 text-brand-200'
                  : 'text-ink-3 hover:text-ink-1'
              }`}
            >
              {t('widgets.visitors.today')}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-3">
            <span className="font-mono font-bold text-ink-1">{shownCount}</span>{' '}
            {t('widgets.visitors.cameIn')}{' '}
            <span className="text-ink-4">· {shownLabel}</span>
          </p>
        </>
      )}
    </GlassCard>
  );
});

export default VisitorCountWidget;
