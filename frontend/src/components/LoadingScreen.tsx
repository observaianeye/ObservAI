import { Camera } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0 grid-floor">
      <div className="text-center">
        <div className="relative inline-block mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-brand-500 to-accent-500 rounded-2xl flex items-center justify-center shadow-glow-brand animate-pulse-scale">
            <Camera className="w-12 h-12 text-white" strokeWidth={1.5} />
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-accent-500 rounded-2xl animate-ping opacity-20" />
        </div>

        <h2 className="font-display text-2xl font-semibold text-ink-0 mb-2 tracking-tight">ObservAI</h2>
        <p className="text-sm text-ink-3 mb-6">Loading your dashboard...</p>

        <div className="w-64 h-2 bg-white/[0.06] rounded-full overflow-hidden mx-auto border border-white/[0.08]">
          <div className="h-full bg-gradient-to-r from-brand-500 via-accent-500 to-violet-500 rounded-full animate-loading-bar" />
        </div>
      </div>

      <style>{`
        @keyframes pulse-scale {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes loading-bar {
          0% {
            width: 0%;
          }
          50% {
            width: 70%;
          }
          100% {
            width: 100%;
          }
        }

        .animate-pulse-scale {
          animation: pulse-scale 2s ease-in-out infinite;
        }

        .animate-loading-bar {
          animation: loading-bar 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
