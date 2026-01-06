import { Sparkles, Zap } from 'lucide-react';

export default function AIRecommendationsVisual() {
  return (
    <div className="relative w-full aspect-square">
      <div className="relative w-full h-full bg-gradient-to-br from-pink-500/10 to-pink-600/10 backdrop-blur-sm border border-pink-500/20 rounded-2xl p-6 overflow-hidden">
        {/* Central AI Brain */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative w-24 h-24">
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full blur-xl animate-pulse" />

            {/* Brain Icon Container */}
            <div className="relative w-full h-full bg-gradient-to-br from-pink-500/40 to-purple-500/40 backdrop-blur-sm border-2 border-pink-400/50 rounded-full flex items-center justify-center">
              <Sparkles className="w-12 h-12 text-white animate-pulse" />
            </div>

            {/* Orbiting Particles */}
            <div className="absolute inset-0 animate-spin-slow">
              <div className="absolute top-0 left-1/2 w-2 h-2 bg-pink-400 rounded-full -translate-x-1/2" />
            </div>
            <div className="absolute inset-0 animate-spin-slow" style={{ animationDelay: '1s' }}>
              <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-purple-400 rounded-full -translate-x-1/2" />
            </div>
            <div className="absolute inset-0 animate-spin-slow" style={{ animationDelay: '2s' }}>
              <div className="absolute left-0 top-1/2 w-2 h-2 bg-teal-400 rounded-full -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Top Left - Pricing Node */}
        <div className="absolute top-6 left-6 animate-fade-in-up z-10">
          <div className="bg-pink-900/80 backdrop-blur-md border border-pink-400/40 rounded-xl p-3 w-32 shadow-lg">
            <div className="text-xs font-semibold text-pink-200 mb-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Pricing</div>
            <div className="text-lg font-bold text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>+15%</div>
            <div className="text-xs font-medium text-pink-100" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Suggested</div>
          </div>
          {/* Connection Line */}
          <svg className="absolute top-1/2 left-full w-16 h-16" style={{ pointerEvents: 'none' }}>
            <path
              d="M 0 0 Q 30 -20, 60 0"
              stroke="rgba(236, 72, 153, 0.3)"
              strokeWidth="2"
              fill="none"
              className="animate-draw-line"
            />
          </svg>
        </div>

        {/* Top Right - Discount Node */}
        <div className="absolute top-6 right-6 animate-fade-in-up z-10" style={{ animationDelay: '200ms' }}>
          <div className="bg-purple-900/80 backdrop-blur-md border border-purple-400/40 rounded-xl p-3 w-32 shadow-lg">
            <div className="text-xs font-semibold text-purple-200 mb-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Discount</div>
            <div className="text-lg font-bold text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>20%</div>
            <div className="text-xs font-medium text-purple-100" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>3-5PM</div>
          </div>
          {/* Connection Line */}
          <svg className="absolute top-1/2 right-full w-16 h-16" style={{ pointerEvents: 'none' }}>
            <path
              d="M 60 0 Q 30 -20, 0 0"
              stroke="rgba(168, 85, 247, 0.3)"
              strokeWidth="2"
              fill="none"
              className="animate-draw-line"
            />
          </svg>
        </div>

        {/* Bottom Left - Staffing Node */}
        <div className="absolute bottom-6 left-6 animate-fade-in-up z-10" style={{ animationDelay: '400ms' }}>
          <div className="bg-teal-900/80 backdrop-blur-md border border-teal-400/40 rounded-xl p-3 w-32 shadow-lg">
            <div className="text-xs font-semibold text-teal-200 mb-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Staffing</div>
            <div className="text-lg font-bold text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>+2</div>
            <div className="text-xs font-medium text-teal-100" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Peak Hours</div>
          </div>
          {/* Connection Line */}
          <svg className="absolute bottom-1/2 left-full w-16 h-16" style={{ pointerEvents: 'none' }}>
            <path
              d="M 0 16 Q 30 36, 60 16"
              stroke="rgba(20, 184, 166, 0.3)"
              strokeWidth="2"
              fill="none"
              className="animate-draw-line"
            />
          </svg>
        </div>

        {/* Bottom Right - Promo Node */}
        <div className="absolute bottom-6 right-6 animate-fade-in-up z-10" style={{ animationDelay: '600ms' }}>
          <div className="bg-amber-900/80 backdrop-blur-md border border-amber-400/40 rounded-xl p-3 w-32 shadow-lg">
            <div className="text-xs font-semibold text-amber-200 mb-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Promo</div>
            <div className="text-lg font-bold text-white flex items-center" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              <Zap className="w-4 h-4 mr-1" />
              Active
            </div>
            <div className="text-xs font-medium text-amber-100" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Happy Hour</div>
          </div>
          {/* Connection Line */}
          <svg className="absolute bottom-1/2 right-full w-16 h-16" style={{ pointerEvents: 'none' }}>
            <path
              d="M 60 16 Q 30 36, 0 16"
              stroke="rgba(251, 191, 36, 0.3)"
              strokeWidth="2"
              fill="none"
              className="animate-draw-line"
            />
          </svg>
        </div>

        {/* AI Label */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-16 bg-pink-900/80 backdrop-blur-md border border-pink-400/40 rounded-full px-4 py-2 shadow-lg z-10">
          <span className="text-xs text-white font-semibold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>AI Engine</span>
        </div>
      </div>
    </div>
  );
}
