import { useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface GlassBarChartProps {
  data: DataPoint[];
  height?: number;
  animate?: boolean;
  showValues?: boolean;
  horizontal?: boolean;
}

export default function GlassBarChart({
  data,
  height = 300,
  animate = true,
  showValues = true,
  horizontal = false
}: GlassBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const padding = { top: 20, right: 20, bottom: 60, left: horizontal ? 100 : 50 };
  const chartWidth = 100;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data.map(d => d.value));
  const barPadding = 0.2;
  const barWidth = (horizontal ? chartHeight : chartWidth) / data.length;
  const innerBarWidth = barWidth * (1 - barPadding);

  const defaultColors = [
    'rgb(59, 130, 246)',
    'rgb(139, 92, 246)',
    'rgb(236, 72, 153)',
    'rgb(34, 197, 94)',
    'rgb(251, 146, 60)',
    'rgb(14, 165, 233)'
  ];

  return (
    <div className="relative w-full glass-chart p-6" style={{ height }}>
      <svg
        viewBox={`0 0 ${chartWidth + padding.left + padding.right} ${height}`}
        className="w-full h-full"
      >
        <defs>
          {data.map((_, index) => {
            const color = data[index].color || defaultColors[index % defaultColors.length];
            return (
              <linearGradient key={index} id={`bar-gradient-${index}`} x1="0" y1="0" x2={horizontal ? "1" : "0"} y2={horizontal ? "0" : "1"}>
                <stop offset="0%" stopColor={color} stopOpacity="0.8" />
                <stop offset="100%" stopColor={color} stopOpacity="0.4" />
              </linearGradient>
            );
          })}
        </defs>

        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {data.map((item, index) => {
            const barHeight = (item.value / maxValue) * chartHeight;
            const x = index * barWidth + (barWidth - innerBarWidth) / 2;
            const y = chartHeight - barHeight;
            const color = item.color || defaultColors[index % defaultColors.length];

            if (horizontal) {
              const barLength = (item.value / maxValue) * chartWidth;
              const barY = index * barWidth + (barWidth - innerBarWidth) / 2;

              return (
                <g key={index}>
                  <rect
                    x="0"
                    y={barY}
                    width={barLength}
                    height={innerBarWidth}
                    fill={`url(#bar-gradient-${index})`}
                    rx="8"
                    className={`transition-all duration-300 cursor-pointer ${animate ? 'bar-animate-horizontal' : ''}`}
                    style={{
                      transformOrigin: 'left center',
                      animationDelay: `${index * 100}ms`,
                      filter: hoveredIndex === index ? 'brightness(1.2) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
                    }}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />

                  {showValues && (
                    <text
                      x={barLength + 10}
                      y={barY + innerBarWidth / 2}
                      alignmentBaseline="middle"
                      className="fill-gray-700 font-semibold"
                      style={{ fontSize: '12px' }}
                    >
                      {item.value.toLocaleString()}
                    </text>
                  )}

                  <text
                    x="-10"
                    y={barY + innerBarWidth / 2}
                    textAnchor="end"
                    alignmentBaseline="middle"
                    className="fill-gray-700 font-semibold"
                    style={{ fontSize: '11px' }}
                  >
                    {item.label}
                  </text>
                </g>
              );
            }

            return (
              <g key={index}>
                <rect
                  x={x}
                  y={y}
                  width={innerBarWidth}
                  height={barHeight}
                  fill={`url(#bar-gradient-${index})`}
                  rx="8"
                  className={`transition-all duration-300 cursor-pointer ${animate ? 'bar-animate' : ''}`}
                  style={{
                    transformOrigin: 'bottom center',
                    animationDelay: `${index * 100}ms`,
                    filter: hoveredIndex === index ? 'brightness(1.2) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />

                {showValues && (
                  <text
                    x={x + innerBarWidth / 2}
                    y={y - 10}
                    textAnchor="middle"
                    className="fill-gray-700 font-semibold"
                    style={{ fontSize: '12px' }}
                  >
                    {item.value.toLocaleString()}
                  </text>
                )}

                <text
                  x={x + innerBarWidth / 2}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  className="fill-gray-700 font-semibold"
                  style={{ fontSize: '11px' }}
                >
                  {item.label.length > 10 ? item.label.substring(0, 8) + '...' : item.label}
                </text>

                {hoveredIndex === index && (
                  <g>
                    <rect
                      x={x + innerBarWidth / 2 - 40}
                      y={y - 50}
                      width="80"
                      height="35"
                      rx="8"
                      fill="rgba(0, 0, 0, 0.8)"
                      className="animate-fade-in"
                    />
                    <text
                      x={x + innerBarWidth / 2}
                      y={y - 35}
                      textAnchor="middle"
                      className="fill-white font-semibold"
                      style={{ fontSize: '11px' }}
                    >
                      {item.label}
                    </text>
                    <text
                      x={x + innerBarWidth / 2}
                      y={y - 22}
                      textAnchor="middle"
                      className="fill-white font-bold"
                      style={{ fontSize: '13px' }}
                    >
                      {item.value.toLocaleString()}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <style>{`
        @keyframes bar-grow {
          from {
            transform: scaleY(0);
          }
          to {
            transform: scaleY(1);
          }
        }

        @keyframes bar-grow-horizontal {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }

        .bar-animate {
          animation: bar-grow 0.8s ease-out forwards;
          transform: scaleY(0);
        }

        .bar-animate-horizontal {
          animation: bar-grow-horizontal 0.8s ease-out forwards;
          transform: scaleX(0);
        }

        .glass-chart {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
