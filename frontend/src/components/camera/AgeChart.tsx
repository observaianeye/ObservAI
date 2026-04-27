import { useState, useEffect, memo } from 'react';
import ReactECharts from 'echarts-for-react';
import { analyticsDataService, AnalyticsData } from '../../services/analyticsDataService';
import { useLanguage } from '../../contexts/LanguageContext';
import { GlassCard } from '../ui/GlassCard';

const AgeChart = memo(function AgeChart() {
  const { t } = useLanguage();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await analyticsDataService.getData();
      setData(data);
      setLoading(false);
    };

    loadData();

    const unsubscribe = analyticsDataService.startRealtimeUpdates((data) => {
      setData(data);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const ageBuckets = ['0-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

  const maleData = ageBuckets.map(bucket =>
    data?.genderByAge?.[bucket]?.male || 0
  );
  const femaleData = ageBuckets.map(bucket =>
    data?.genderByAge?.[bucket]?.female || 0
  );
  const unknownData = ageBuckets.map(bucket =>
    data?.genderByAge?.[bucket]?.unknown || 0
  );

  const maleLabel = t('charts.gender.male');
  const femaleLabel = t('charts.gender.female');
  const unknownLabel = t('charts.gender.unknown');

  const option = {
    animation: false,
    title: {
      text: t('charts.ageGender.title'),
      left: 'center',
      textStyle: {
        fontSize: 15,
        fontWeight: 600,
        color: '#ffffff',
        fontFamily: '"Space Grotesk", Inter, sans-serif'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      backgroundColor: 'rgba(8, 12, 28, 0.92)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      textStyle: {
        color: '#e6ebff',
        fontFamily: '"JetBrains Mono", monospace'
      }
    },
    legend: {
      bottom: 0,
      textStyle: {
        color: '#7e89a8',
        fontFamily: 'Inter, sans-serif'
      },
      data: [maleLabel, femaleLabel, unknownLabel]
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ageBuckets,
      axisLabel: {
        fontSize: 11,
        color: '#7e89a8',
        fontFamily: '"JetBrains Mono", monospace'
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }
    },
    yAxis: {
      type: 'value',
      name: t('charts.axis.visitors'),
      nameTextStyle: {
        fontSize: 11,
        color: '#7e89a8',
        fontFamily: '"JetBrains Mono", monospace'
      },
      axisLabel: {
        color: '#7e89a8',
        fontFamily: '"JetBrains Mono", monospace'
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.06)'
        }
      }
    },
    series: [
      {
        name: maleLabel,
        type: 'bar',
        stack: 'total',
        data: maleData,
        itemStyle: { color: '#1d6bff' }
      },
      {
        name: femaleLabel,
        type: 'bar',
        stack: 'total',
        data: femaleData,
        itemStyle: { color: '#9a4dff' }
      },
      {
        name: unknownLabel,
        type: 'bar',
        stack: 'total',
        data: unknownData,
        itemStyle: { color: '#4a5576' }
      }
    ]
  };

  const totalVisitors = data ? Object.values(data.age).reduce((sum: number, val: number) => sum + val, 0) : 0;

  return (
    <GlassCard variant="neon" className="p-6 h-full">
      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-400"></div>
        </div>
      ) : totalVisitors === 0 ? (
        <div className="h-[300px] flex flex-col items-center justify-center text-ink-3">
          <p className="text-sm font-medium">{t('charts.empty.title')}</p>
          <p className="text-xs mt-1 text-ink-4">{t('charts.empty.live')}</p>
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: '300px' }} />
      )}
    </GlassCard>
  );
});

export default AgeChart;
