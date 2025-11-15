import { useState } from 'react';

interface HeatmapCell {
  x: number;
  y: number;
  value: number;
  label?: string;
}

interface GlassHeatmapProps {
  data: HeatmapCell[];
  width?: number;
  height?: number;
  rows?: number;
  cols?: number;
  animate?: boolean;
  colorScale?: string[];
}

export default function GlassHeatmap({
  data,
  width = 600,
  height = 400,
  rows = 10,
  cols = 15,
  animate = true,
  colorScale = ['rgb(34, 197, 94)', 'rgb(251, 146, 60)', 'rgb(239, 68, 68)']
}: GlassHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  const cellWidth = width / cols;
  const cellHeight = height / rows;

  const maxValue = Math.max(...data.map(d => d.value), 1);

  const getColor = (value: number) => {
    const normalized = value / maxValue;
    if (normalized < 0.33) {
      return interpolateColor(colorScale[0], colorScale[1], normalized * 3);
    } else if (normalized < 0.66) {
      return interpolateColor(colorScale[1], colorScale[2], (normalized - 0.33) * 3);
    } else {
      return interpolateColor(colorScale[1], colorScale[2], (normalized - 0.33) * 1.5);
    }
  };

  const interpolateColor = (color1: string, color2: string, factor: number) => {
    const c1 = color1.match(/\d+/g)?.map(Number) || [0, 0, 0];
    const c2 = color2.match(/\d+/g)?.map(Number) || [0, 0, 0];
    const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
    const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
    const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const gridData: (HeatmapCell | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );

  data.forEach(cell => {
    if (cell.y < rows && cell.x < cols) {
      gridData[cell.y][cell.x] = cell;
    }
  });

  return (
    <div className="relative w-full glass-chart p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Store Heat Map</h3>
        <p className="text-sm text-gray-600" style={{ lineHeight: '1.6' }}>
          Higher intensity indicates more visitor activity
        </p>
      </div>

      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height}>
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {gridData.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const x = colIndex * cellWidth;
              const y = rowIndex * cellHeight;
              const isHovered = hoveredCell?.x === colIndex && hoveredCell?.y === rowIndex;

              if (!cell) {
                return (
                  <rect
                    key={`${rowIndex}-${colIndex}`}
                    x={x}
                    y={y}
                    width={cellWidth}
                    height={cellHeight}
                    fill="rgba(200, 200, 200, 0.1)"
                    stroke="rgba(255, 255, 255, 0.3)"
                    strokeWidth="1"
                  />
                );
              }

              const color = getColor(cell.value);
              const opacity = 0.3 + (cell.value / maxValue) * 0.7;

              return (
                <g key={`${rowIndex}-${colIndex}`}>
                  <rect
                    x={x}
                    y={y}
                    width={cellWidth}
                    height={cellHeight}
                    fill={color}
                    opacity={opacity}
                    stroke="rgba(255, 255, 255, 0.3)"
                    strokeWidth="1"
                    className={`transition-all duration-300 cursor-pointer ${animate ? 'heatmap-cell-animate' : ''}`}
                    style={{
                      animationDelay: `${(rowIndex + colIndex) * 20}ms`,
                      filter: isHovered ? 'url(#glow) brightness(1.2)' : 'none',
                      transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                      transformOrigin: `${x + cellWidth / 2}px ${y + cellHeight / 2}px`
                    }}
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                  />
                  {isHovered && (
                    <g>
                      <rect
                        x={x + cellWidth / 2 - 40}
                        y={y - 45}
                        width="80"
                        height="40"
                        rx="8"
                        fill="rgba(0, 0, 0, 0.85)"
                        className="animate-fade-in"
                      />
                      <text
                        x={x + cellWidth / 2}
                        y={y - 28}
                        textAnchor="middle"
                        className="fill-white font-semibold"
                        style={{ fontSize: '11px' }}
                      >
                        {cell.label || `Zone ${cell.x},${cell.y}`}
                      </text>
                      <text
                        x={x + cellWidth / 2}
                        y={y - 14}
                        textAnchor="middle"
                        className="fill-white font-bold"
                        style={{ fontSize: '13px' }}
                      >
                        Activity: {cell.value}
                      </text>
                    </g>
                  )}
                </g>
              );
            })
          )}
        </svg>

        {hoveredCell && (
          <div className="absolute bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-semibold animate-fade-in">
            Position: ({hoveredCell.x}, {hoveredCell.y}) • Value: {hoveredCell.value}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <p className="text-xs font-semibold text-gray-600">Low Activity</p>
        <div className="flex items-center gap-1">
          {colorScale.map((color, index) => (
            <div
              key={index}
              className="w-16 h-3 rounded"
              style={{ backgroundColor: color, opacity: 0.3 + index * 0.35 }}
            />
          ))}
        </div>
        <p className="text-xs font-semibold text-gray-600">High Activity</p>
      </div>

      <style>{`
        @keyframes heatmap-cell-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .heatmap-cell-animate {
          animation: heatmap-cell-fade 0.5s ease-out forwards;
          opacity: 0;
        }

        .glass-chart {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
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
