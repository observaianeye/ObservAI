import { Database, Radio, Lock } from 'lucide-react';
import { useDataMode } from '../contexts/DataModeContext';

export default function DataModeToggle() {
  const { dataMode, setDataMode, isModeLocked } = useDataMode();

  return (
    <div className="inline-flex items-center bg-[#0f1117]/80 border border-white/10 rounded-lg overflow-hidden shadow-sm relative">
      <button
        onClick={() => setDataMode('demo')}
        className={`px-4 py-2 text-sm font-medium transition-all flex items-center space-x-2 ${
          dataMode === 'demo'
            ? 'bg-purple-600 text-white'
            : 'bg-transparent text-gray-300 hover:bg-white/5'
        }`}
      >
        <Database className="w-4 h-4" />
        <span>Demo</span>
      </button>
      <button
        onClick={() => setDataMode('live')}
        disabled={isModeLocked}
        title={isModeLocked ? 'Upgrade to access live data' : undefined}
        className={`px-4 py-2 text-sm font-medium transition-all flex items-center space-x-2 ${
          dataMode === 'live'
            ? 'bg-green-600 text-white'
            : isModeLocked
              ? 'bg-transparent text-gray-500 cursor-not-allowed'
              : 'bg-transparent text-gray-300 hover:bg-white/5'
        }`}
      >
        {isModeLocked ? <Lock className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
        <span>Live</span>
        {dataMode === 'live' && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-200"></span>
          </span>
        )}
      </button>
    </div>
  );
}
