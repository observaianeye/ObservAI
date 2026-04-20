import { Eye } from 'lucide-react';

export default function CameraAnalyticsVisual() {
  return (
    <div className="relative w-full aspect-square">
      {/* Main Container */}
      <div className="relative w-full h-full bg-gradient-to-br from-violet-500/10 to-violet-500/5 backdrop-blur-sm border border-violet-500/20 rounded-2xl p-6 overflow-hidden">
        {/* Camera Icon */}
        <div className="absolute top-6 left-6">
          <div className="w-12 h-12 bg-violet-500/20 border border-violet-500/30 rounded-xl flex items-center justify-center">
            <Eye className="w-6 h-6 text-violet-400 animate-pulse" strokeWidth={1.5} />
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="absolute inset-0 p-6 pt-24">
          <div className="grid grid-cols-6 grid-rows-6 gap-2 h-full">
            {Array.from({ length: 36 }).map((_, i) => {
              const intensity = Math.random();
              const isHot = intensity > 0.6;
              const isMedium = intensity > 0.3 && intensity <= 0.6;

              return (
                <div
                  key={i}
                  className={`rounded-lg transition-all duration-500 ${
                    isHot
                      ? 'bg-violet-500/60 animate-pulse'
                      : isMedium
                      ? 'bg-violet-500/30'
                      : 'bg-violet-500/10'
                  }`}
                  style={{
                    animationDelay: `${i * 50}ms`
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Detection Boxes */}
        <div className="absolute top-1/4 right-8 w-16 h-20 border-2 border-accent-400 rounded-lg animate-pulse">
          <div className="absolute -top-6 left-0 px-2 py-1 bg-accent-500/20 backdrop-blur-sm rounded text-xs text-accent-300 font-medium font-mono">
            Guest
          </div>
        </div>

        <div className="absolute bottom-1/4 left-8 w-16 h-20 border-2 border-accent-400 rounded-lg animate-pulse" style={{ animationDelay: '1s' }}>
          <div className="absolute -top-6 left-0 px-2 py-1 bg-accent-500/20 backdrop-blur-sm rounded text-xs text-accent-300 font-medium font-mono">
            Guest
          </div>
        </div>

        {/* Stats Overlay */}
        <div className="absolute bottom-6 left-6 right-6 bg-surface-1/80 backdrop-blur-md border border-violet-500/30 rounded-xl p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="font-display font-mono text-xl font-semibold text-ink-0">127</div>
              <div className="text-xs text-ink-3">Detected</div>
            </div>
            <div>
              <div className="font-display font-mono text-xl font-semibold text-ink-0">2.5m</div>
              <div className="text-xs text-ink-3">Avg Time</div>
            </div>
            <div>
              <div className="font-display font-mono text-xl font-semibold text-ink-0">65%</div>
              <div className="text-xs text-ink-3">Male</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
