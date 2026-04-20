import { Clock } from 'lucide-react';
import { useEffect, useState, memo } from 'react';
import ReactECharts from 'echarts-for-react';
import { analyticsDataService, DwellTimeMetrics } from '../../services/analyticsDataService';
import { useDataMode } from '../../contexts/DataModeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { GlassCard } from '../ui/GlassCard';

const DwellTimeWidget = memo(function DwellTimeWidget() {
  const { dataMode } = useDataMode();
  const { t } = useLanguage();
  const [dwellTime, setDwellTime] = useState<DwellTimeMetrics>({
    average: 0,
    min: 0,
    max: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsDataService.setMode(dataMode);

    const loadData = async () => {
      setLoading(true);
      const data = await analyticsDataService.getData();
      setDwellTime(data.dwellTime);
      setLoading(false);
    };

    loadData();

    // Subscribe and get unsubscribe function
    const unsubscribe = analyticsDataService.startRealtimeUpdates((data) => {
      setDwellTime(data.dwellTime);
    });

    return () => {
      unsubscribe();
    };
  }, [dataMode]);

  // Format seconds to minutes
  const avgMinutes = (dwellTime.average / 60).toFixed(1);

  // Sample weekly trend data (in demo mode, show realistic pattern)
  const weeklyData = [
    (dwellTime.average * 0.85) / 60,
    (dwellTime.average * 0.78) / 60,
    (dwellTime.average * 1.05) / 60,
    (dwellTime.average * 0.97) / 60,
    (dwellTime.average * 1.10) / 60,
    (dwellTime.average * 1.28) / 60,
    (dwellTime.average * 1.20) / 60
  ].map(v => Number(v.toFixed(1)));

  const option = {
    // Disable animation in Live mode for smoother updates
    animation: dataMode === 'demo',
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line'
      },
      formatter: (params: any) => {
        const value = params[0].value;
        return `${params[0].axisValue}: ${value} min`;
      }
    },
    grid: {
      left: 10,
      right: 10,
      bottom: 0,
      top: 10,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      show: false
    },
    yAxis: {
      type: 'value',
      show: false
    },
    series: [
      {
        data: weeklyData,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 3,
          color: '#12bcff'
        },
        itemStyle: {
          color: '#12bcff',
          borderWidth: 2,
          borderColor: '#ffffff'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(18, 188, 255, 0.3)' },
              { offset: 1, color: 'rgba(18, 188, 255, 0.05)' }
            ]
          }
        }
      }
    ]
  };

  return (
    <GlassCard variant="neon" className="p-6">
      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent-400"></div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-ink-3">{t('widgets.dwell.title')}</p>
              <p className="font-display text-3xl font-bold text-ink-0">
                {avgMinutes} <span className="text-lg text-ink-4 font-mono font-normal">{t('widgets.dwell.minutes')}</span>
              </p>
            </div>
            <div className="w-12 h-12 bg-accent-500/10 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-accent-300" strokeWidth={1.5} />
            </div>
          </div>
          {dwellTime.average > 0 ? (
            <>
              <ReactECharts option={option} style={{ height: '80px' }} />
              <p className="text-xs text-ink-4 mt-2">{t('widgets.dwell.caption')}</p>
            </>
          ) : (
            <div className="h-24 flex items-center justify-center text-ink-4 text-xs">
              {dataMode === 'live' ? t('widgets.dwell.noData') : t('widgets.dwell.switchToDemo')}
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
});

export default DwellTimeWidget;
