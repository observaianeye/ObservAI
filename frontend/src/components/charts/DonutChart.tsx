import { useState } from 'react';

interface DataSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DataSegment[];
  size?: number;
  centerText?: string;
  centerSubtext?: string;
  showTooltip?: boolean;
  animate?: boolean;
}

export default function DonutChart({
  data,
  size = 200,
  centerText,
  centerSubtext,
  showTooltip = true,
  animate = true
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = data.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 40;
  const strokeWidth = 12;
  const center = 50;
  const circumference = 2 * Math.PI * radius;

  let accumulatedAngle = 0;
  const segments = data.map((segment) => {
    const percentage = (segment.value / total) * 100;
    const angle = (segment.value / total) * 360;
    const offset = (accumulatedAngle / 360) * circumference;
    const dashArray = `${(angle / 360) * circumference} ${circumference}`;

    const result = {
      ...segment,
      percentage,
      offset,
      dashArray,
      startAngle: accumulatedAngle,
      endAngle: accumulatedAngle + angle
    };

    accumulatedAngle += angle;
    return result;
  });

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="transform -rotate-90">
          {segments.map((segment, index) => {
            const isHovered = hoveredIndex === index;
            return (
              <circle
                key={index}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                strokeDasharray={segment.dashArray}
                strokeDashoffset={-segment.offset}
                className="transition-all duration-300 cursor-pointer"
                style={{
                  filter: isHovered ? `drop-shadow(0 0 8px ${segment.color})` : 'none',
                  strokeDasharray: animate ? segment.dashArray : '0 1000',
                  animation: animate ? `drawCircle 1s ease-out ${index * 0.2}s forwards` : 'none'
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerText && (
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{centerText}</div>
              {centerSubtext && (
                <div className="text-xs text-gray-600 mt-1">{centerSubtext}</div>
              )}
            </div>
          )}
        </div>

        {showTooltip && hoveredIndex !== null && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-center animate-fade-in-up pointer-events-none">
            <div className="text-xs font-medium">{segments[hoveredIndex].label}</div>
            <div className="text-sm font-semibold">{segments[hoveredIndex].percentage.toFixed(1)}%</div>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 w-full">
        {segments.map((segment, index) => (
          <div
            key={index}
            className="flex items-center space-x-2 cursor-pointer"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div
              className="w-3 h-3 rounded-full transition-transform duration-200"
              style={{
                backgroundColor: segment.color,
                transform: hoveredIndex === index ? 'scale(1.3)' : 'scale(1)'
              }}
            />
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-900">{segment.label}</div>
              <div className="text-xs text-gray-600">{segment.percentage.toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes drawCircle {
          from {
            stroke-dasharray: 0 1000;
          }
        }
      `}</style>
    </div>
  );
}
