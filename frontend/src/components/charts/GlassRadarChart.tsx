import { useEffect, useRef, useState } from 'react';

interface RadarDataPoint {
  label: string;
  value: number;
  max?: number;
}

interface GlassRadarChartProps {
  data: RadarDataPoint[];
  size?: number;
  color?: string;
  animate?: boolean;
  showLabels?: boolean;
}

export default function GlassRadarChart({
  data,
  size = 400,
  color = 'rgba(59, 130, 246, 0.5)',
  animate = true,
  showLabels = true
}: GlassRadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animationProgress, setAnimationProgress] = useState(0);

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
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, size, size);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 60;
    const numPoints = data.length;
    const angleStep = (Math.PI * 2) / numPoints;

    for (let i = 0; i < 5; i++) {
      const r = radius * ((i + 1) / 5);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;

      for (let j = 0; j <= numPoints; j++) {
        const angle = angleStep * j - Math.PI / 2;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);

        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();
    }

    for (let i = 0; i < numPoints; i++) {
      const angle = angleStep * i - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (animationProgress > 0) {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.strokeStyle = color.replace('0.5', '0.8');
      ctx.lineWidth = 2;

      data.forEach((point, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const maxValue = point.max || 100;
        const normalizedValue = Math.min(point.value / maxValue, 1);
        const r = radius * normalizedValue * animationProgress;

        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      data.forEach((point, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const maxValue = point.max || 100;
        const normalizedValue = Math.min(point.value / maxValue, 1);
        const r = radius * normalizedValue * animationProgress;

        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = color.replace('0.5', '1');
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    if (showLabels) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      data.forEach((point, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const labelRadius = radius + 30;
        const x = centerX + labelRadius * Math.cos(angle);
        const y = centerY + labelRadius * Math.sin(angle);

        ctx.fillText(point.label, x, y);

        ctx.font = '10px sans-serif';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillText(`${point.value}`, x, y + 14);
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      });
    }
  }, [data, size, color, showLabels, animationProgress]);

  return (
    <div className="inline-block">
      <canvas ref={canvasRef} />
    </div>
  );
}
