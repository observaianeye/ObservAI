import { useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  showTooltip?: boolean;
  animate?: boolean;
}

export default function LineChart({
  data,
  height = 200,
  color = 'rgb(59, 130, 246)',
  showTooltip = true,
  animate = true
}: LineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue;
  const chartHeight = height;
  const chartWidth = 100;
  const padding = 20;

  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * (chartWidth - 2 * padding) + padding;
    const y = chartHeight - ((point.value - minValue) / range) * (chartHeight - 2 * padding) - padding;
    return { x, y, ...point };
  });

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const areaPath = `${pathData} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  return (
    <div className="w-full relative">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        style={{ height: `${height}px` }}
      >
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <path
          d={areaPath}
          fill="url(#lineGradient)"
          className={animate ? 'animate-fade-in' : ''}
        />

        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={animate ? 'animate-draw-line' : ''}
          style={{
            strokeDasharray: animate ? 1000 : 'none',
            strokeDashoffset: animate ? 1000 : 0,
            animation: animate ? 'drawLine 1.5s ease-out forwards' : 'none'
          }}
        />

        {points.map((point, index) => {
          const isHovered = hoveredIndex === index;
          return (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r={isHovered ? 5 : 3}
                fill={color}
                className="transition-all duration-200 cursor-pointer"
                style={{
                  filter: isHovered ? 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.6))' : 'none'
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
              {showTooltip && isHovered && (
                <g>
                  <rect
                    x={point.x - 35}
                    y={point.y - 40}
                    width="70"
                    height="30"
                    rx="6"
                    fill="#1f2937"
                    className="animate-fade-in-up"
                  />
                  <text
                    x={point.x}
                    y={point.y - 30}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {point.label}
                  </text>
                  <text
                    x={point.x}
                    y={point.y - 18}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                  >
                    {point.value.toLocaleString()}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex items-center justify-between mt-3 px-4">
        {data.map((point, index) => (
          <div key={index} className="text-center">
            <span className="text-xs text-gray-600 font-medium">{point.label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes drawLine {
          to {
            stroke-dashoffset: 0;
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
