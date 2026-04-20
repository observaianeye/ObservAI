import { Sparkles, Zap } from 'lucide-react';

export default function AIRecommendationsVisual() {
  return (
    <div className="relative w-full aspect-square">
      <div className="relative w-full h-full bg-gradient-to-br from-danger/10 to-danger/5 backdrop-blur-sm border border-danger/20 rounded-2xl p-6 overflow-hidden">
        {/* Central AI Brain */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative w-24 h-24">
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-danger to-violet-500 rounded-full blur-xl animate-pulse" />

            {/* Brain Icon Container */}
            <div className="relative w-full h-full bg-gradient-to-br from-danger/40 to-violet-500/40 backdrop-blur-sm border-2 border-danger/50 rounded-full flex items-center justify-center">
              <Sparkles className="w-12 h-12 text-ink-0 animate-pulse" strokeWidth={1.5} />
            </div>

            {/* Orbiting Particles */}
            <div className="absolute inset-0 animate-spin-slow">
              <div className="absolute top-0 left-1/2 w-2 h-2 bg-danger rounded-full -translate-x-1/2" />
            </div>
            <div className="absolute inset-0 animate-spin-slow" style={{ animationDelay: '1s' }}>
              <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-violet-400 rounded-full -translate-x-1/2" />
            </div>
            <div className="absolute inset-0 animate-spin-slow" style={{ animationDelay: '2s' }}>
              <div className="absolute left-0 top-1/2 w-2 h-2 bg-accent-400 rounded-full -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Top Left - Pricing Node */}
        <div className="absolute top-6 left-6 animate-fade-in-up z-10">
          <div className="bg-surface-1/90 backdrop-blur-md border border-danger/40 rounded-xl p-3 w-32 shadow-lg">
            <div className="text-xs font-semibold text-danger mb-1 font-mono">Pricing</div>
            <div className="font-display font-mono text-lg font-semibold text-ink-0">+15%</div>
            <div className="text-xs font-medium text-ink-3">Suggested</div>
          </div>
          {/* Connection Line */}
          <svg className="absolute top-1/2 left-full w-16 h-16" style={{ pointerEvents: 'none' }}>
            <path
              d="M 0 0 Q 30 -20, 60 0"
              stroke="rgba(255, 93, 122, 0.35)"
              strokeWidth="2"
              fill="none"
              className="animate-draw-line"
            />
          </svg>
        </div>

        {/* Top Right - Discount Node */}
        <div className="absolute top-6 right-6 animate-fade-in-up z-10" style={{ animationDelay: '200ms' }}>
          <div className="bg-surface-1/90 backdrop-blur-md border border-violet-500/40 rounded-xl p-3 w-32 shadow-lg">
            <div className="text-xs font-semibold text-violet-400 mb-1 font-mono">Discount</div>
            <div className="font-display font-mono text-lg font-semibold text-ink-0">20%</div>
            <div className="text-xs font-medium text-ink-3">3-5PM</div>
          </div>
          {/* Connection Line */}
          <svg className="absolute top-1/2 right-full w-16 h-16" style={{ pointerEvents: 'none' }}>
            <path
              d="M 60 0 Q 30 -20, 0 0"
              stroke="rgba(154, 77, 255, 0.35)"
              strokeWidth="2"
              fill="none"
              className="animate-draw-line"
            />
          </svg>
        </div>

        {/* Bottom Left - Staffing Node */}
        <div className="absolute bottom-6 left-6 animate-fade-in-up z-10" style={{ animationDelay: '400ms' }}>
          <div className="bg-surface-1/90 backdrop-blur-md border border-accent-500/40 rounded-xl p-3 w-32 shadow-lg">
            <div className="text-xs font-semibold text-accent-400 mb-1 font-mono">Staffing</div>
            <div className="font-display font-mono text-lg font-semibold text-ink-0">+2</div>
            <div className="text-xs font-medium text-ink-3">Peak Hours</div>
          </div>
          {/* Connection Line */}
          <svg className="absolute bottom-1/2 left-full w-16 h-16" style={{ pointerEvents: 'none' }}>
            <path
              d="M 0 16 Q 30 36, 60 16"
              stroke="rgba(18, 188, 255, 0.35)"
              strokeWidth="2"
              fill="none"
              className="animate-draw-line"
            />
          </svg>
        </div>

        {/* Bottom Right - Promo Node */}
        <div className="absolute bottom-6 right-6 animate-fade-in-up z-10" style={{ animationDelay: '600ms' }}>
          <div className="bg-surface-1/90 backdrop-blur-md border border-warning/40 rounded-xl p-3 w-32 shadow-lg">
            <div className="text-xs font-semibold text-warning mb-1 font-mono">Promo</div>
            <div className="font-display font-mono text-lg font-semibold text-ink-0 flex items-center">
              <Zap className="w-4 h-4 mr-1" strokeWidth={1.5} />
              Active
            </div>
            <div className="text-xs font-medium text-ink-3">Happy Hour</div>
          </div>
          {/* Connection Line */}
          <svg className="absolute bottom-1/2 right-full w-16 h-16" style={{ pointerEvents: 'none' }}>
            <path
              d="M 60 16 Q 30 36, 0 16"
              stroke="rgba(255, 181, 71, 0.35)"
              strokeWidth="2"
              fill="none"
              className="animate-draw-line"
            />
          </svg>
        </div>

        {/* AI Label */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-16 bg-surface-1/90 backdrop-blur-md border border-danger/40 rounded-full px-4 py-2 shadow-lg z-10">
          <span className="text-xs text-ink-0 font-semibold font-mono">AI Engine</span>
        </div>
      </div>
    </div>
  );
}
