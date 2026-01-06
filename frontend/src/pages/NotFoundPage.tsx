import { Link } from 'react-router-dom';
import { Camera, ArrowLeft, Home, Search } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-teal-50/30 flex items-center justify-center px-6">
      <div className="text-center max-w-2xl">
        <div className="relative inline-block mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-blue-600 to-teal-500 rounded-3xl flex items-center justify-center shadow-2xl animate-bounce-slow">
            <Camera className="w-16 h-16 text-white" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
            !
          </div>
        </div>

        <h1 className="text-8xl font-bold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent mb-4">
          404
        </h1>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Camera Lost Signal</h2>
        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
          Looks like this page wandered off the grid. Our AI couldn't detect it anywhere.
          Let's get you back to familiar territory.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold rounded-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
          >
            <Home className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>

          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 glass text-gray-900 font-semibold rounded-xl hover:shadow-lg transition-all duration-300"
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(0, 0, 0, 0.1)'
            }}
          >
            <Search className="w-5 h-5" />
            <span>Go to Dashboard</span>
          </Link>
        </div>

        <div className="mt-12 p-6 rounded-2xl" style={{
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 0, 0, 0.1)'
        }}>
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Common Pages:</span> Overview, Sales, Camera Analytics, Inventory, AI Insights
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
