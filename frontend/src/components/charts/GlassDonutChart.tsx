import { useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface GlassDonutChartProps {
  data: DataPoint[];
  size?: number;
  innerRadius?: number;
  animate?: boolean;
  showLegend?: boolean;
}

export default function GlassDonutChart({
  data,
  size = 300,
  innerRadius = 0.6,
  animate = true,
  showLegend = true
}: GlassDonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 20;
  const innerR = radius * innerRadius;

  const defaultColors = [
    'rgb(59, 130, 246)',
    'rgb(139, 92, 246)',
    'rgb(236, 72, 153)',
    'rgb(34, 197, 94)',
    'rgb(251, 146, 60)',
    'rgb(14, 165, 233)'
  ];

  let currentAngle = -90;
  const segments = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);

    const x3 = centerX + innerR * Math.cos(endRad);
    const y3 = centerY + innerR * Math.sin(endRad);
    const x4 = centerX + innerR * Math.cos(startRad);
    const y4 = centerY + innerR * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;

    const path = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z'
    ].join(' ');

    const midAngle = (startAngle + endAngle) / 2;
    const labelRadius = radius * 0.75;
    const labelX = centerX + labelRadius * Math.cos((midAngle * Math.PI) / 180);
    const labelY = centerY + labelRadius * Math.sin((midAngle * Math.PI) / 180);

    return {
      path,
      color: item.color || defaultColors[index % defaultColors.length],
      percentage,
      label: item.label,
      value: item.value,
      labelX,
      labelY,
      midAngle
    };
  });

  return (
    <div className="flex flex-col lg:flex-row items-center gap-8 w-full glass-chart p-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <defs>
            {segments.map((segment, index) => (
              <linearGradient key={index} id={`donut-gradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={segment.color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={segment.color} stopOpacity="0.6" />
              </linearGradient>
            ))}
          </defs>

          {segments.map((segment, index) => (
            <path
              key={index}
              d={segment.path}
              fill={`url(#donut-gradient-${index})`}
              className={`transition-all duration-300 cursor-pointer ${animate ? 'donut-segment-animate' : ''}`}
              style={{
                transformOrigin: 'center',
                animationDelay: `${index * 150}ms`,
                filter: hoveredIndex === index
                  ? 'brightness(1.2) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))'
                  : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                transform: hoveredIndex === index ? 'scale(1.05)' : 'scale(1)'
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">
              {hoveredIndex !== null ? segments[hoveredIndex].percentage.toFixed(1) : '100'}%
            </p>
            <p className="text-sm font-semibold text-gray-600 mt-1">
              {hoveredIndex !== null ? segments[hoveredIndex].label : 'Total'}
            </p>
            {hoveredIndex !== null && (
              <p className="text-xs text-gray-500 mt-1">
                {segments[hoveredIndex].value.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {showLegend && (
        <div className="flex-1 space-y-3">
          {segments.map((segment, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 cursor-pointer ${
                hoveredIndex === index ? 'bg-white/50 scale-105' : 'bg-white/20 hover:bg-white/30'
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{segment.label}</p>
                  <p className="text-xs text-gray-600">{segment.value.toLocaleString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{segment.percentage.toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes donut-segment-grow {
          from {
            opacity: 0;
            transform: scale(0);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .donut-segment-animate {
          animation: donut-segment-grow 0.6s ease-out forwards;
          opacity: 0;
        }

        .glass-chart {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
        }
      `}</style>
    </div>
  );
}
