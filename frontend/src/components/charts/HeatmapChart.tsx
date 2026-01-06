import { useState } from 'react';

interface HeatmapCell {
  x: number;
  y: number;
  value: number;
  label?: string;
}

interface HeatmapChartProps {
  data: HeatmapCell[];
  xLabels: string[];
  yLabels: string[];
  colorScale?: { min: string; mid: string; max: string };
  showTooltip?: boolean;
  animate?: boolean;
}

export default function HeatmapChart({
  data,
  xLabels,
  yLabels,
  colorScale = { min: '#dbeafe', mid: '#3b82f6', max: '#1e3a8a' },
  showTooltip = true,
  animate = true
}: HeatmapChartProps) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));

  const getColor = (value: number) => {
    const normalized = (value - minValue) / (maxValue - minValue);

    if (normalized < 0.5) {
      const ratio = normalized * 2;
      return interpolateColor(colorScale.min, colorScale.mid, ratio);
    } else {
      const ratio = (normalized - 0.5) * 2;
      return interpolateColor(colorScale.mid, colorScale.max, ratio);
    }
  };

  const interpolateColor = (color1: string, color2: string, ratio: number) => {
    const hex = (c: string) => parseInt(c.substring(1), 16);
    const r1 = (hex(color1) >> 16) & 255;
    const g1 = (hex(color1) >> 8) & 255;
    const b1 = hex(color1) & 255;

    const r2 = (hex(color2) >> 16) & 255;
    const g2 = (hex(color2) >> 8) & 255;
    const b2 = hex(color2) & 255;

    const r = Math.round(r1 + (r2 - r1) * ratio);
    const g = Math.round(g1 + (g2 - g1) * ratio);
    const b = Math.round(b1 + (b2 - b1) * ratio);

    return `rgb(${r}, ${g}, ${b})`;
  };

  const cellSize = 100 / Math.max(xLabels.length, yLabels.length);

  return (
    <div className="w-full">
      <div className="flex">
        <div className="flex flex-col justify-around pr-2" style={{ width: '60px' }}>
          {yLabels.map((label, index) => (
            <div key={index} className="text-xs text-gray-600 text-right font-medium">
              {label}
            </div>
          ))}
        </div>

        <div className="flex-1">
          <div className="relative">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${xLabels.length}, 1fr)` }}>
              {data.map((cell, index) => {
                const isHovered = hoveredCell?.x === cell.x && hoveredCell?.y === cell.y;
                const color = getColor(cell.value);

                return (
                  <div
                    key={index}
                    className="aspect-square rounded transition-all duration-200 cursor-pointer relative"
                    style={{
                      backgroundColor: color,
                      transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                      boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                      opacity: animate ? 1 : 0,
                      animation: animate ? `fadeInScale 0.4s ease-out ${index * 0.02}s forwards` : 'none'
                    }}
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    {showTooltip && isHovered && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg whitespace-nowrap text-xs font-medium z-10 animate-fade-in-up">
                        {cell.label || `${xLabels[cell.x]}, ${yLabels[cell.y]}`}: {cell.value}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-around mt-2">
            {xLabels.map((label, index) => (
              <div key={index} className="text-xs text-gray-600 font-medium text-center">
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 px-2">
        <div className="flex items-center space-x-2">
          <div className="w-16 h-3 rounded" style={{
            background: `linear-gradient(to right, ${colorScale.min}, ${colorScale.mid}, ${colorScale.max})`
          }}></div>
          <div className="flex justify-between text-xs text-gray-600 w-24">
            <span>{minValue}</span>
            <span>{maxValue}</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
