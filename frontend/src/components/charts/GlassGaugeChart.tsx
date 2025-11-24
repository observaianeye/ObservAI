interface GlassGaugeChartProps {
  value: number;
  max?: number;
  label?: string;
  size?: number;
  color?: string;
  animate?: boolean;
}

export default function GlassGaugeChart({
  value,
  max = 100,
  label = 'Progress',
  size = 200,
  color = '#bf00ff',
  animate = true
}: GlassGaugeChartProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = (size / 2) - 20;
  const centerX = size / 2;
  const centerY = size / 2;
  const strokeWidth = 20;

  const startAngle = 135;
  const endAngle = 405;
  const angleRange = endAngle - startAngle;
  const currentAngle = startAngle + (angleRange * percentage) / 100;

  const getCoordinates = (angle: number, r: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: centerX + r * Math.cos(rad),
      y: centerY + r * Math.sin(rad)
    };
  };

  const start = getCoordinates(startAngle, radius);
  const end = getCoordinates(endAngle, radius);
  const current = getCoordinates(currentAngle, radius);

  const backgroundPath = [
    `M ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 1 1 ${end.x} ${end.y}`
  ].join(' ');

  const valuePath = [
    `M ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${percentage > 50 ? 1 : 0} 1 ${current.x} ${current.y}`
  ].join(' ');

  const getColor = () => {
    if (percentage < 30) return '#ef4444'; // Red
    if (percentage < 70) return '#f59e0b'; // Amber
    return '#39ff14'; // Neon Lime
  };

  const gaugeColor = color === 'auto' ? getColor() : color;

  return (
    <div className="glass-chart p-6 flex flex-col items-center justify-center" style={{ width: size + 40, height: size + 60 }}>
      <svg width={size} height={size} className="mb-4">
        <defs>
          <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={gaugeColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={gaugeColor} stopOpacity="0.9" />
          </linearGradient>
          <filter id="gauge-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.3" />
          </filter>
        </defs>

        <path
          d={backgroundPath}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        <path
          d={valuePath}
          fill="none"
          stroke="url(#gauge-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter="url(#gauge-shadow)"
          className={animate ? 'gauge-animate' : ''}
          style={{
            strokeDasharray: 1000,
            strokeDashoffset: animate ? 1000 : 0,
            filter: `drop-shadow(0 0 8px ${gaugeColor})`
          }}
        />

        <circle
          cx={current.x}
          cy={current.y}
          r={strokeWidth / 2 + 2}
          fill="#0a0b10"
          stroke={gaugeColor}
          strokeWidth="3"
          filter="url(#gauge-shadow)"
          className={animate ? 'gauge-dot-animate' : ''}
        />

        <text
          x={centerX}
          y={centerY - 10}
          textAnchor="middle"
          className="fill-white font-bold"
          style={{ fontSize: '32px' }}
        >
          {value}
        </text>
        <text
          x={centerX}
          y={centerY + 15}
          textAnchor="middle"
          className="fill-gray-400 font-semibold"
          style={{ fontSize: '14px' }}
        >
          / {max}
        </text>
      </svg>

      <div className="text-center">
        <p className="text-sm font-semibold text-gray-300">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{percentage.toFixed(1)}%</p>
      </div>

      <style>{`
        @keyframes gauge-draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes gauge-dot-appear {
          from {
            opacity: 0;
            transform: scale(0);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .gauge-animate {
          animation: gauge-draw 1.5s ease-out forwards;
        }

        .gauge-dot-animate {
          animation: gauge-dot-appear 0.5s ease-out 1.2s both;
          opacity: 0;
        }

        .glass-chart {
          background: rgba(10, 11, 16, 0.4);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}
