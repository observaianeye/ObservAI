import { Camera } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-teal-50/30">
      <div className="text-center">
        <div className="relative inline-block mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-teal-500 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse-scale">
            <Camera className="w-12 h-12 text-white" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-teal-500 rounded-2xl animate-ping opacity-20" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">ObservAI</h2>
        <p className="text-sm text-gray-600 mb-6">Loading your dashboard...</p>

        <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-gradient-to-r from-blue-600 to-teal-500 rounded-full animate-loading-bar" />
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
