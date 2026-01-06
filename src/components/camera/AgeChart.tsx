import { useState, useEffect, memo } from 'react';
import ReactECharts from 'echarts-for-react';
import { analyticsDataService, AnalyticsData } from '../../services/analyticsDataService';
import { useDataMode } from '../../contexts/DataModeContext';
import { GlassCard } from '../ui/GlassCard';

const AgeChart = memo(function AgeChart() {
  const { dataMode } = useDataMode();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set mode in service
    analyticsDataService.setMode(dataMode);

    // Load initial data
    const loadData = async () => {
      setLoading(true);
      const data = await analyticsDataService.getData();
      setData(data);
      setLoading(false);
    };

    loadData();

    // Subscribe and get unsubscribe function
    const unsubscribe = analyticsDataService.startRealtimeUpdates((data) => {
      setData(data);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [dataMode]);

  const ageBuckets = ['0-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

  // Prepare series data for stacked bar chart
  const maleData = ageBuckets.map(bucket =>
    data?.genderByAge?.[bucket]?.male || 0
  );
  const femaleData = ageBuckets.map(bucket =>
    data?.genderByAge?.[bucket]?.female || 0
  );
  const unknownData = ageBuckets.map(bucket =>
    data?.genderByAge?.[bucket]?.unknown || 0
  );

  const option = {
    // Disable animation in Live mode for smoother updates
    animation: dataMode === 'demo',
    title: {
      text: 'Age & Gender Distribution',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 600,
        color: '#ffffff'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      backgroundColor: 'rgba(10, 11, 16, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      textStyle: {
        color: '#fff'
      }
    },
    legend: {
      bottom: 0,
      textStyle: {
        color: '#9ca3af'
      },
      data: ['Male', 'Female', 'Unknown']
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
        color: '#9ca3af'
      }
    },
    yAxis: {
      type: 'value',
      name: 'Visitors',
      nameTextStyle: {
        fontSize: 12,
        color: '#9ca3af'
      },
      axisLabel: {
        color: '#9ca3af'
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    },
    series: [
      {
        name: 'Male',
        type: 'bar',
        stack: 'total',
        data: maleData,
        itemStyle: { color: '#3b82f6' }
      },
      {
        name: 'Female',
        type: 'bar',
        stack: 'total',
        data: femaleData,
        itemStyle: { color: '#ec4899' }
      },
      {
        name: 'Unknown',
        type: 'bar',
        stack: 'total',
        data: unknownData,
        itemStyle: { color: '#6b7280' }
      }
    ]
  };

  const totalVisitors = data ? Object.values(data.age).reduce((sum: number, val: number) => sum + val, 0) : 0;

  return (
    <GlassCard variant="neon" className="p-6 h-full">
      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : totalVisitors === 0 ? (
        <div className="h-[300px] flex flex-col items-center justify-center text-gray-400">
          <p className="text-sm font-medium">No data available</p>
          <p className="text-xs mt-1">
            {dataMode === 'live' ? 'No camera connected or no visitors detected' : 'Switch to Demo mode to see sample data'}
          </p>
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: '300px' }} />
      )}
    </GlassCard>
  );
});

export default AgeChart;
