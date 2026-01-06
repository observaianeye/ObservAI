import { useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: DataPoint[];
  height?: number;
  showTooltip?: boolean;
  animate?: boolean;
}

export default function BarChart({ data, height = 200, showTooltip = true, animate = true }: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxValue = Math.max(...data.map(d => d.value));
  const chartHeight = height;

  return (
    <div className="w-full">
      <div className="flex items-end justify-between space-x-2 sm:space-x-3" style={{ height: `${chartHeight}px` }}>
        {data.map((point, index) => {
          const barHeight = (point.value / maxValue) * chartHeight;
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center justify-end relative group cursor-pointer"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {showTooltip && isHovered && (
                <div className="absolute bottom-full mb-2 px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap z-10 animate-fade-in-up">
                  {point.label}: {point.value.toLocaleString()}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
              <div
                className={`w-full rounded-t-lg transition-all duration-300 ${
                  point.color || 'bg-blue-500'
                } ${isHovered ? 'opacity-100 shadow-lg' : 'opacity-90'}`}
                style={{
                  height: animate ? `${barHeight}px` : '0px',
                  animation: animate ? `grow 0.6s ease-out ${index * 0.1}s forwards` : 'none'
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3 px-1">
        {data.map((point, index) => (
          <div key={index} className="flex-1 text-center">
            <span className="text-xs text-gray-600 font-medium">{point.label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes grow {
          from {
            height: 0;
            opacity: 0;
          }
          to {
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
}
