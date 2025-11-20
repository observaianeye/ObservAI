import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { analyticsDataService, GenderData } from '../../services/analyticsDataService';
import { useDataMode } from '../../contexts/DataModeContext';

export default function GenderChart() {
  const { dataMode } = useDataMode();
  const [genderData, setGenderData] = useState<GenderData>({ male: 0, female: 0 });
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

  const totalVisitors = genderData.male + genderData.female;

  const option = {
    title: {
      text: 'Gender Distribution',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 600,
        color: '#1f2937'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      bottom: 10,
      left: 'center'
    },
    series: [
      {
        name: 'Gender',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
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
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: [
          { value: genderData.male, name: 'Male', itemStyle: { color: '#3b82f6' } },
          { value: genderData.female, name: 'Female', itemStyle: { color: '#ec4899' } }
        ]
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
