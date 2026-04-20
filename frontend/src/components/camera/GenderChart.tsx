import { useState, useEffect, memo } from 'react';
import ReactECharts from 'echarts-for-react';
import { analyticsDataService, GenderData } from '../../services/analyticsDataService';
import { useDataMode } from '../../contexts/DataModeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { GlassCard } from '../ui/GlassCard';

const GenderChart = memo(function GenderChart() {
  const { dataMode } = useDataMode();
  const { t } = useLanguage();
  const [genderData, setGenderData] = useState<GenderData>({ male: 0, female: 0, unknown: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsDataService.setMode(dataMode);

    const loadData = async () => {
      setLoading(true);
      const data = await analyticsDataService.getData();
      setGenderData(data.gender);
      setLoading(false);
    };

    loadData();

    const unsubscribe = analyticsDataService.startRealtimeUpdates((data) => {
      setGenderData(data.gender);
    });

    return () => {
      unsubscribe();
    };
  }, [dataMode]);

  const totalVisitors = genderData.male + genderData.female + genderData.unknown;

  const option = {
    animation: dataMode === 'demo',
    title: {
      text: t('charts.gender.title'),
      left: 'center',
      textStyle: {
        fontSize: 15,
        fontWeight: 600,
        color: '#ffffff',
        fontFamily: '"Space Grotesk", Inter, sans-serif'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(8, 12, 28, 0.92)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: {
        color: '#e6ebff',
        fontFamily: '"JetBrains Mono", monospace'
      }
    },
    legend: {
      bottom: 10,
      left: 'center',
      textStyle: {
        color: '#7e89a8',
        fontFamily: 'Inter, sans-serif'
      }
    },
    series: [
      {
        name: t('charts.gender.title'),
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#050813',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold',
            color: '#ffffff',
            fontFamily: '"Space Grotesk", sans-serif'
          }
        },
        labelLine: {
          show: false
        },
        data: [
          { value: genderData.male, name: t('charts.gender.male'), itemStyle: { color: '#1d6bff' } },
          { value: genderData.female, name: t('charts.gender.female'), itemStyle: { color: '#9a4dff' } },
          { value: genderData.unknown, name: t('charts.gender.unknown'), itemStyle: { color: '#4a5576' } }
        ]
      }
    ]
  };

  return (
    <GlassCard variant="neon" className="p-6 h-full">
      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-400"></div>
        </div>
      ) : totalVisitors === 0 ? (
        <div className="h-[300px] flex flex-col items-center justify-center text-ink-3">
          <p className="text-sm font-medium">{t('charts.empty.title')}</p>
          <p className="text-xs mt-1 text-ink-4">
            {dataMode === 'live' ? t('charts.empty.live') : t('charts.empty.demo')}
          </p>
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: '300px' }} />
      )}
    </GlassCard>
  );
});

export default GenderChart;
