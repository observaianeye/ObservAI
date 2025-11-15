import { useEffect, useRef, useState } from 'react';

interface TreemapDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface GlassTreemapChartProps {
  data: TreemapDataPoint[];
  width?: number;
  height?: number;
  animate?: boolean;
  showTooltip?: boolean;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  data: TreemapDataPoint;
}

export default function GlassTreemapChart({
  data,
  width = 800,
  height = 500,
  animate = true,
  showTooltip = true
}: GlassTreemapChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredRect, setHoveredRect] = useState<{ rect: Rect; x: number; y: number } | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [rectangles, setRectangles] = useState<Rect[]>([]);

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

  const squarify = (
    data: TreemapDataPoint[],
    x: number,
    y: number,
    w: number,
    h: number
  ): Rect[] => {
    if (data.length === 0) return [];

    const sortedData = [...data].sort((a, b) => b.value - a.value);
    const total = sortedData.reduce((sum, d) => sum + d.value, 0);

    if (sortedData.length === 1) {
      return [{ x, y, width: w, height: h, data: sortedData[0] }];
    }

    const normalizedData = sortedData.map(d => ({
      ...d,
      normalizedValue: (d.value / total) * w * h
    }));

    const rects: Rect[] = [];
    let currentX = x;
    let currentY = y;
    let remainingWidth = w;
    let remainingHeight = h;

    normalizedData.forEach((item, index) => {
      const area = item.normalizedValue;

      if (remainingWidth > remainingHeight) {
        const rectWidth = area / remainingHeight;
        rects.push({
          x: currentX,
          y: currentY,
          width: Math.min(rectWidth, remainingWidth),
          height: remainingHeight,
          data: item
        });
        currentX += rectWidth;
        remainingWidth -= rectWidth;
      } else {
        const rectHeight = area / remainingWidth;
        rects.push({
          x: currentX,
          y: currentY,
          width: remainingWidth,
          height: Math.min(rectHeight, remainingHeight),
          data: item
        });
        currentY += rectHeight;
        remainingHeight -= rectHeight;
      }
    });

    return rects;
  };

  useEffect(() => {
    const rects = squarify(data, 10, 10, width - 20, height - 20);
    setRectangles(rects);
  }, [data, width, height]);

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

    const defaultColors = [
      'rgba(59, 130, 246, 0.8)',
      'rgba(34, 197, 94, 0.8)',
      'rgba(251, 146, 60, 0.8)',
      'rgba(168, 85, 247, 0.8)',
      'rgba(236, 72, 153, 0.8)',
      'rgba(14, 165, 233, 0.8)'
    ];

    rectangles.forEach((rect, index) => {
      const progress = animate ? Math.min(animationProgress * 1.5 - index * 0.05, 1) : 1;
      if (progress <= 0) return;

      const color = rect.data.color || defaultColors[index % defaultColors.length];

      const scaledWidth = rect.width * progress;
      const scaledHeight = rect.height * progress;
      const scaledX = rect.x + (rect.width - scaledWidth) / 2;
      const scaledY = rect.y + (rect.height - scaledHeight) / 2;

      ctx.fillStyle = color;
      ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

      if (progress > 0.5 && rect.width > 60 && rect.height > 40) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const text = rect.data.label;
        const textX = rect.x + rect.width / 2;
        const textY = rect.y + rect.height / 2 - 8;

        ctx.fillText(text, textX, textY);

        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(rect.data.value.toLocaleString(), textX, textY + 18);
      }
    });
  }, [rectangles, width, height, animationProgress]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!showTooltip) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    for (const rectangle of rectangles) {
      if (
        mouseX >= rectangle.x &&
        mouseX <= rectangle.x + rectangle.width &&
        mouseY >= rectangle.y &&
        mouseY <= rectangle.y + rectangle.height
      ) {
        setHoveredRect({ rect: rectangle, x: mouseX, y: mouseY });
        return;
      }
    }

    setHoveredRect(null);
  };

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredRect(null)}
        style={{ cursor: hoveredRect ? 'pointer' : 'default' }}
      />

      {hoveredRect && showTooltip && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: hoveredRect.x + 10,
            top: hoveredRect.y - 10,
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
            <p className="text-xs font-bold text-white mb-1">{hoveredRect.rect.data.label}</p>
            <p className="text-sm font-bold text-white">
              {hoveredRect.rect.data.value.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">
              {((hoveredRect.rect.data.value / data.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
