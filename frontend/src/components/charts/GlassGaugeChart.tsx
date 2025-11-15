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
  color = 'rgb(59, 130, 246)',
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
    if (percentage < 30) return 'rgb(239, 68, 68)';
    if (percentage < 70) return 'rgb(251, 146, 60)';
    return 'rgb(34, 197, 94)';
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
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.3"/>
          </filter>
        </defs>

        <path
          d={backgroundPath}
          fill="none"
          stroke="rgba(200, 200, 200, 0.2)"
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
            strokeDashoffset: animate ? 1000 : 0
          }}
        />

        <circle
          cx={current.x}
          cy={current.y}
          r={strokeWidth / 2 + 2}
          fill="white"
          stroke={gaugeColor}
          strokeWidth="3"
          filter="url(#gauge-shadow)"
          className={animate ? 'gauge-dot-animate' : ''}
        />

        <text
          x={centerX}
          y={centerY - 10}
          textAnchor="middle"
          className="fill-gray-900 font-bold"
          style={{ fontSize: '32px' }}
        >
          {value}
        </text>
        <text
          x={centerX}
          y={centerY + 15}
          textAnchor="middle"
          className="fill-gray-600 font-semibold"
          style={{ fontSize: '14px' }}
        >
          / {max}
        </text>
      </svg>

      <div className="text-center">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{percentage.toFixed(1)}%</p>
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
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
        }
      `}</style>
    </div>
  );
}
