import { useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface GlassLineChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  gradient?: boolean;
  animate?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
}

export default function GlassLineChart({
  data,
  height = 300,
  color = 'rgb(59, 130, 246)',
  gradient = true,
  animate = true,
  showGrid = true,
  showTooltip = true
}: GlassLineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = 100;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const valueRange = maxValue - minValue || 1;

  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * chartWidth;
    const y = chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
    return { x, y, ...point };
  });

  const pathD = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prevPoint = points[index - 1];
    const cpX1 = prevPoint.x + (point.x - prevPoint.x) / 3;
    const cpX2 = prevPoint.x + (2 * (point.x - prevPoint.x)) / 3;
    return `${path} C ${cpX1} ${prevPoint.y}, ${cpX2} ${point.y}, ${point.x} ${point.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  const gridLines = 5;
  const yGridLines = Array.from({ length: gridLines }, (_, i) => {
    const value = minValue + (valueRange * i) / (gridLines - 1);
    const y = chartHeight - ((value - minValue) / valueRange) * chartHeight;
    return { y, value };
  });

  return (
    <div className="relative w-full glass-chart p-6" style={{ height }}>
      <svg
        viewBox={`0 0 ${chartWidth + padding.left + padding.right} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {showGrid && yGridLines.map((line, i) => (
            <g key={i}>
              <line
                x1="0"
                y1={line.y}
                x2={chartWidth}
                y2={line.y}
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x="-10"
                y={line.y}
                textAnchor="end"
                alignmentBaseline="middle"
                className="text-xs fill-gray-400"
                style={{ fontSize: '10px' }}
              >
                {Math.round(line.value)}
              </text>
            </g>
          ))}

          {gradient && (
            <path
              d={areaD}
              fill={`url(#gradient-${color})`}
              className={animate ? 'animate-fade-in' : ''}
              style={{ animationDelay: '0.2s' }}
            />
          )}

          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={animate ? 'chart-line-animate' : ''}
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
            }}
          />

          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r={hoveredIndex === index ? 6 : 4}
                fill="white"
                stroke={color}
                strokeWidth="2"
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => showTooltip && setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
                  animationDelay: `${index * 50}ms`
                }}
              />

              {showTooltip && hoveredIndex === index && (
                <g>
                  <rect
                    x={point.x - 35}
                    y={point.y - 45}
                    width="70"
                    height="35"
                    rx="8"
                    fill="rgba(0, 0, 0, 0.8)"
                    className="animate-fade-in"
                  />
                  <text
                    x={point.x}
                    y={point.y - 30}
                    textAnchor="middle"
                    className="fill-white font-semibold"
                    style={{ fontSize: '11px' }}
                  >
                    {point.label}
                  </text>
                  <text
                    x={point.x}
                    y={point.y - 17}
                    textAnchor="middle"
                    className="fill-white font-bold"
                    style={{ fontSize: '13px' }}
                  >
                    {point.value.toLocaleString()}
                  </text>
                </g>
              )}
            </g>
          ))}

          {data.map((point, index) => {
            const p = points[index];
            return (
              <text
                key={index}
                x={p.x}
                y={chartHeight + 20}
                textAnchor="middle"
                className="text-xs fill-gray-400"
                style={{ fontSize: '10px' }}
              >
                {point.label}
              </text>
            );
          })}
        </g>
      </svg>

      <style>{`
        @keyframes chart-line-draw {
          from {
            stroke-dashoffset: 1000;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        .chart-line-animate {
          stroke-dasharray: 1000;
          animation: chart-line-draw 1.5s ease-out forwards;
        }

        .glass-chart {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
