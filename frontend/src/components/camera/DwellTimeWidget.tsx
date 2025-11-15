import { Clock } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

export default function DwellTimeWidget() {
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line'
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
        data: [4.2, 3.8, 5.1, 4.7, 5.3, 6.2, 5.8],
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 3,
          color: '#06b6d4'
        },
        itemStyle: {
          color: '#06b6d4',
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
              { offset: 0, color: 'rgba(6, 182, 212, 0.3)' },
              { offset: 1, color: 'rgba(6, 182, 212, 0.05)' }
            ]
          }
        }
      }
    ]
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-600">Avg. Dwell Time</p>
          <p className="text-3xl font-bold text-gray-900">4.8 <span className="text-lg text-gray-500">min</span></p>
        </div>
        <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center">
          <Clock className="w-6 h-6 text-cyan-600" />
        </div>
      </div>
      <ReactECharts option={option} style={{ height: '80px' }} />
      <p className="text-xs text-gray-500 mt-2">Weekly average visitor dwell time</p>
    </div>
  );
}
