import { useEffect, useRef, useState } from 'react';

interface DataPoint {
  x: number;
  y: number;
  label?: string;
  size?: number;
  color?: string;
}

interface GlassScatterChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  animate?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  xLabel?: string;
  yLabel?: string;
}

export default function GlassScatterChart({
  data,
  width = 600,
  height = 400,
  animate = true,
  showGrid = true,
  showTooltip = true,
  xLabel = 'X Axis',
  yLabel = 'Y Axis'
}: GlassScatterChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ point: DataPoint; x: number; y: number } | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);

  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xValues = data.map(d => d.x);
  const yValues = data.map(d => d.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  useEffect(() => {
    if (animate) {
      let start: number;
      const duration = 1000;

      const animateChart = (timestamp: number) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        setAnimationProgress(progress);

        if (progress < 1) {
          requestAnimationFrame(animateChart);
        }
      };

      requestAnimationFrame(animateChart);
    } else {
      setAnimationProgress(1);
    }
  }, [animate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (showGrid) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.lineWidth = 1;

      for (let i = 0; i <= 5; i++) {
        const x = padding.left + (chartWidth / 5) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();

        const y = padding.top + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i <= 5; i++) {
      const x = padding.left + (chartWidth / 5) * i;
      const value = minX + (xRange / 5) * i;
      ctx.fillText(value.toFixed(1), x, padding.top + chartHeight + 20);
    }

    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + chartHeight - (chartHeight / 5) * i;
      const value = minY + (yRange / 5) * i;
      ctx.fillText(value.toFixed(1), padding.left - 10, y + 4);
    }

    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, padding.left + chartWidth / 2, height - 10);

    ctx.save();
    ctx.translate(15, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    data.forEach((point, index) => {
      const progress = animate ? Math.min(animationProgress * 1.5 - index * 0.05, 1) : 1;
      if (progress <= 0) return;

      const x = padding.left + ((point.x - minX) / xRange) * chartWidth;
      const y = padding.top + chartHeight - ((point.y - minY) / yRange) * chartHeight;
      const size = (point.size || 5) * progress;
      const color = point.color || 'rgba(59, 130, 246, 0.7)';

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [data, width, height, showGrid, xLabel, yLabel, animationProgress]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!showTooltip) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    for (const point of data) {
      const x = padding.left + ((point.x - minX) / xRange) * chartWidth;
      const y = padding.top + chartHeight - ((point.y - minY) / yRange) * chartHeight;
      const size = point.size || 5;

      const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
      if (distance <= size + 5) {
        setHoveredPoint({ point, x: mouseX, y: mouseY });
        return;
      }
    }

    setHoveredPoint(null);
  };

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
        style={{ cursor: hoveredPoint ? 'pointer' : 'default' }}
      />

      {hoveredPoint && showTooltip && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: hoveredPoint.x + 10,
            top: hoveredPoint.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div
            className="px-4 py-3 rounded-xl shadow-2xl"
            style={{
              background: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            {hoveredPoint.point.label && (
              <p className="text-xs font-bold text-white mb-1">{hoveredPoint.point.label}</p>
            )}
            <p className="text-xs text-gray-300">
              X: <span className="font-semibold text-white">{hoveredPoint.point.x.toFixed(2)}</span>
            </p>
            <p className="text-xs text-gray-300">
              Y: <span className="font-semibold text-white">{hoveredPoint.point.y.toFixed(2)}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
