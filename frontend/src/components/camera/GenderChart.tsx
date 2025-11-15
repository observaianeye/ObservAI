import ReactECharts from 'echarts-for-react';

export default function GenderChart() {
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
          { value: 568, name: 'Male', itemStyle: { color: '#3b82f6' } },
          { value: 432, name: 'Female', itemStyle: { color: '#ec4899' } }
        ]
      }
    ]
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <ReactECharts option={option} style={{ height: '300px' }} />
    </div>
  );
}
