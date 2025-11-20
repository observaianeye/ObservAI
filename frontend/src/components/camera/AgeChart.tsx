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
        color: '#1f2937'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
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
        fontSize: 11
      }
    },
    yAxis: {
      type: 'value',
      name: 'Visitors',
      nameTextStyle: {
        fontSize: 12
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
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: '#06b6d4' }
            ]
          },
          borderRadius: [6, 6, 0, 0]
        },
        label: {
          show: true,
          position: 'top',
          fontSize: 11,
          fontWeight: 600
        }
      }
    ]
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : totalVisitors === 0 ? (
        <div className="h-[300px] flex flex-col items-center justify-center text-gray-500">
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
