import { Database, Radio } from 'lucide-react';
import { useDataMode } from '../contexts/DataModeContext';

export default function DataModeToggle() {
  const { dataMode, setDataMode } = useDataMode();

  return (
    <div className="inline-flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
      <button
        onClick={() => setDataMode('demo')}
        className={`px-4 py-2 text-sm font-medium transition-all flex items-center space-x-2 ${
          dataMode === 'demo'
            ? 'bg-purple-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Database className="w-4 h-4" />
        <span>Demo</span>
      </button>
      <button
        onClick={() => setDataMode('live')}
        className={`px-4 py-2 text-sm font-medium transition-all flex items-center space-x-2 ${
          dataMode === 'live'
            ? 'bg-green-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Radio className="w-4 h-4" />
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
