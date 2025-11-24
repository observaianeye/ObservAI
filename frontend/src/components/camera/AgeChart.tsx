import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { analyticsDataService, AgeDistribution } from '../../services/analyticsDataService';
import { useDataMode } from '../../contexts/DataModeContext';

export default function AgeChart() {
  const { dataMode } = useDataMode();
  const [ageData, setAgeData] = useState<AgeDistribution>({
    '0-17': 0,
    '18-24': 0,
    '25-34': 0,
    '35-44': 0,
    '45-54': 0,
    '55-64': 0,
    '65+': 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set mode in service
    analyticsDataService.setMode(dataMode);

    // Load initial data
    const loadData = async () => {
      setLoading(true);
      const data = await analyticsDataService.getData();
      setAgeData(data.age);
      setLoading(false);
    };

    loadData();

    // Start real-time updates
    analyticsDataService.startRealtimeUpdates((data) => {
      setAgeData(data.age);
    });

    // Cleanup on unmount
    return () => {
      analyticsDataService.stopRealtimeUpdates();
    };
  }, [dataMode]);

  const totalVisitors = Object.values(ageData).reduce((sum, val) => sum + val, 0);
  const ageValues = [
    ageData['0-17'],
    ageData['18-24'],
    ageData['25-34'],
    ageData['35-44'],
    ageData['45-54'],
    ageData['55-64'],
    ageData['65+']
  ];

  const option = {
    title: {
      text: 'Age Distribution',
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
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['0-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'],
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
        data: ageValues,
        type: 'bar',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#00f2ea' }, // Neon Cyan
              { offset: 1, color: '#3b82f6' }  // Blue
            ]
          },
          borderRadius: [6, 6, 0, 0]
        },
        label: {
          show: true,
          position: 'top',
          fontSize: 11,
          fontWeight: 600,
          color: '#fff'
        }
      }
    ]
  };

  return (
    <div className="bg-[#0a0b10]/40 backdrop-blur-md rounded-xl border border-white/10 p-6 shadow-sm hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300">
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
    </div>
  );
}
