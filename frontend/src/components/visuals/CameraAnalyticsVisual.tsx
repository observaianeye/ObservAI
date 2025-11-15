import { Eye } from 'lucide-react';

export default function CameraAnalyticsVisual() {
  return (
    <div className="relative w-full aspect-square">
      {/* Main Container */}
      <div className="relative w-full h-full bg-gradient-to-br from-purple-500/10 to-purple-600/10 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-6 overflow-hidden">
        {/* Camera Icon */}
        <div className="absolute top-6 left-6">
          <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <Eye className="w-6 h-6 text-purple-400 animate-pulse" />
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
                      ? 'bg-purple-500/60 animate-pulse'
                      : isMedium
                      ? 'bg-purple-500/30'
                      : 'bg-purple-500/10'
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
        <div className="absolute top-1/4 right-8 w-16 h-20 border-2 border-teal-400 rounded-lg animate-pulse">
          <div className="absolute -top-6 left-0 px-2 py-1 bg-teal-400/20 backdrop-blur-sm rounded text-xs text-teal-300 font-medium">
            Guest
          </div>
        </div>

        <div className="absolute bottom-1/4 left-8 w-16 h-20 border-2 border-teal-400 rounded-lg animate-pulse" style={{ animationDelay: '1s' }}>
          <div className="absolute -top-6 left-0 px-2 py-1 bg-teal-400/20 backdrop-blur-sm rounded text-xs text-teal-300 font-medium">
            Guest
          </div>
        </div>

        {/* Stats Overlay */}
        <div className="absolute bottom-6 left-6 right-6 bg-purple-900/40 backdrop-blur-md border border-purple-500/30 rounded-xl p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xl font-bold text-white">127</div>
              <div className="text-xs text-purple-300">Detected</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white">2.5m</div>
              <div className="text-xs text-purple-300">Avg Time</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white">65%</div>
              <div className="text-xs text-purple-300">Male</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
