import { useEffect, useRef, useState } from 'react';

interface WaterfallDataPoint {
  label: string;
  value: number;
  isTotal?: boolean;
}

interface GlassWaterfallChartProps {
  data: WaterfallDataPoint[];
  width?: number;
  height?: number;
  animate?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
}

export default function GlassWaterfallChart({
  data,
  width = 800,
  height = 400,
  animate = true,
  showGrid = true,
  showTooltip = true
}: GlassWaterfallChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredBar, setHoveredBar] = useState<{ point: WaterfallDataPoint; index: number; x: number; y: number } | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);

  const padding = { top: 40, right: 40, bottom: 80, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

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

    let cumulativeValue = 0;
    const positions: { start: number; end: number; value: number }[] = [];

    data.forEach((point) => {
      if (point.isTotal) {
        positions.push({ start: 0, end: cumulativeValue + point.value, value: point.value });
        cumulativeValue += point.value;
      } else {
        const start = cumulativeValue;
        cumulativeValue += point.value;
        positions.push({ start, end: cumulativeValue, value: point.value });
      }
    });

    const allValues = positions.flatMap(p => [p.start, p.end]);
    const minValue = Math.min(...allValues, 0);
    const maxValue = Math.max(...allValues);
    const valueRange = maxValue - minValue || 1;

    if (showGrid) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.lineWidth = 1;

      for (let i = 0; i <= 5; i++) {
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
    ctx.textAlign = 'right';

    for (let i = 0; i <= 5; i++) {
      const y = padding.top + chartHeight - (chartHeight / 5) * i;
      const value = minValue + (valueRange / 5) * i;
      ctx.fillText(`$${value.toFixed(0)}`, padding.left - 10, y + 4);
    }

    const barWidth = chartWidth / data.length * 0.6;
    const barSpacing = chartWidth / data.length;

    data.forEach((point, index) => {
      const progress = animate ? Math.min(animationProgress * 1.5 - index * 0.1, 1) : 1;
      if (progress <= 0) return;

      const position = positions[index];
      const x = padding.left + barSpacing * index + (barSpacing - barWidth) / 2;

      const startY = padding.top + chartHeight - ((position.start - minValue) / valueRange) * chartHeight;
      const endY = padding.top + chartHeight - ((position.end - minValue) / valueRange) * chartHeight;
      const barHeight = Math.abs(endY - startY) * progress;
      const barY = point.value >= 0 ? endY : startY - barHeight;

      let fillColor;
      if (point.isTotal) {
        fillColor = 'rgba(168, 85, 247, 0.8)';
      } else if (point.value >= 0) {
        fillColor = 'rgba(34, 197, 94, 0.8)';
      } else {
        fillColor = 'rgba(239, 68, 68, 0.8)';
      }

      ctx.fillStyle = fillColor;
      ctx.fillRect(x, barY, barWidth, barHeight);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, barY, barWidth, barHeight);

      if (index < data.length - 1 && !point.isTotal) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x + barWidth, endY);
        ctx.lineTo(x + barWidth + (barSpacing - barWidth), positions[index + 1].start === position.end ? endY : startY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const labelY = point.value >= 0 ? barY - 8 : barY + barHeight + 16;
      ctx.fillText(`$${Math.abs(point.value).toFixed(0)}`, x + barWidth / 2, labelY);
    });

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    data.forEach((point, index) => {
      const x = padding.left + barSpacing * index + barSpacing / 2;
      const y = padding.top + chartHeight + 20;

      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(point.label, 0, 0);
      ctx.rotate(Math.PI / 4);
      ctx.translate(-x, -y);
    });

    ctx.restore();
  }, [data, width, height, showGrid, animationProgress]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!showTooltip) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const barSpacing = chartWidth / data.length;
    const barWidth = chartWidth / data.length * 0.6;

    for (let i = 0; i < data.length; i++) {
      const x = padding.left + barSpacing * i + (barSpacing - barWidth) / 2;

      if (mouseX >= x && mouseX <= x + barWidth) {
        setHoveredBar({ point: data[i], index: i, x: mouseX, y: mouseY });
        return;
      }
    }

    setHoveredBar(null);
  };

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredBar(null)}
        style={{ cursor: hoveredBar ? 'pointer' : 'default' }}
      />

      {hoveredBar && showTooltip && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: hoveredBar.x + 10,
            top: hoveredBar.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div
            className="px-4 py-3 rounded-xl shadow-2xl whitespace-nowrap"
            style={{
              background: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <p className="text-xs font-bold text-white mb-1">{hoveredBar.point.label}</p>
            <p className="text-sm font-bold text-white">
              ${Math.abs(hoveredBar.point.value).toLocaleString()}
              {hoveredBar.point.isTotal && ' (Total)'}
            </p>
            <p className="text-xs text-gray-400">
              {hoveredBar.point.value >= 0 ? 'Increase' : 'Decrease'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
