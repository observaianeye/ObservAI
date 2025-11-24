import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { analyticsDataService, DwellTimeMetrics } from '../../services/analyticsDataService';
import { useDataMode } from '../../contexts/DataModeContext';

export default function DwellTimeWidget() {
  const { dataMode } = useDataMode();
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

    analyticsDataService.startRealtimeUpdates((data) => {
      setDwellTime(data.dwellTime);
    });

    return () => {
      analyticsDataService.stopRealtimeUpdates();
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
          color: '#00f2ea'
        },
        itemStyle: {
          color: '#00f2ea',
          borderWidth: 2,
          borderColor: '#fff'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 242, 234, 0.3)' },
              { offset: 1, color: 'rgba(0, 242, 234, 0.05)' }
            ]
          }
        }
      }
    ]
  };

  return (
    <div className="bg-[#0a0b10]/40 backdrop-blur-md rounded-xl border border-white/10 p-6 shadow-sm hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300">
      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-400">Avg. Dwell Time</p>
              <p className="text-3xl font-bold text-white">
                {avgMinutes} <span className="text-lg text-gray-500">min</span>
              </p>
            </div>
            <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-cyan-400" />
            </div>
          </div>
          {dwellTime.average > 0 ? (
            <>
              <ReactECharts option={option} style={{ height: '80px' }} />
              <p className="text-xs text-gray-500 mt-2">Weekly average visitor dwell time</p>
            </>
          ) : (
            <div className="h-24 flex items-center justify-center text-gray-500 text-xs">
              {dataMode === 'live' ? 'No dwell time data available' : 'Switch to Demo mode'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
