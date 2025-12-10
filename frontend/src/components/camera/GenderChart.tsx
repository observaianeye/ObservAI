import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { analyticsDataService, GenderData } from '../../services/analyticsDataService';
import { useDataMode } from '../../contexts/DataModeContext';
import { GlassCard } from '../ui/GlassCard';

export default function GenderChart() {
  const { dataMode } = useDataMode();
  const [genderData, setGenderData] = useState<GenderData>({ male: 0, female: 0, unknown: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set mode in service
    analyticsDataService.setMode(dataMode);

    // Load initial data
    const loadData = async () => {
      setLoading(true);
      const data = await analyticsDataService.getData();
      setGenderData(data.gender);
      setLoading(false);
    };

    loadData();

    // Start real-time updates
    analyticsDataService.startRealtimeUpdates((data) => {
      setGenderData(data.gender);
    });

    // Cleanup on unmount
    return () => {
      analyticsDataService.stopRealtimeUpdates();
    };
  }, [dataMode]);

  const totalVisitors = genderData.male + genderData.female + genderData.unknown;

  const option = {
    title: {
      text: 'Gender Distribution',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 600,
        color: '#ffffff'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(10, 11, 16, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      textStyle: {
        color: '#fff'
      }
    },
    legend: {
      bottom: 10,
      left: 'center',
      textStyle: {
        color: '#9ca3af'
      }
    },
    series: [
      {
        name: 'Gender',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#0a0b10',
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
            color: '#fff'
          }
        },
        labelLine: {
          show: false
        },
        data: [
          { value: genderData.male, name: 'Male', itemStyle: { color: '#3b82f6' } },
          { value: genderData.female, name: 'Female', itemStyle: { color: '#ec4899' } },
          { value: genderData.unknown, name: 'Unknown', itemStyle: { color: '#6b7280' } }
        ]
      }
    ]
  };

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
}
