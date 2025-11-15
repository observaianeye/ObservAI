import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import CameraFeed from '../../components/camera/CameraFeed';
import GenderChart from '../../components/camera/GenderChart';
import AgeChart from '../../components/camera/AgeChart';
import VisitorCountWidget from '../../components/camera/VisitorCountWidget';
import DwellTimeWidget from '../../components/camera/DwellTimeWidget';

export default function CameraAnalyticsPage() {
  const [showHeatmap, setShowHeatmap] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Camera Analytics Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Real-time visitor insights and analytics</p>
        </div>
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center space-x-2 ${
            showHeatmap
              ? 'bg-orange-600 text-white shadow-lg'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {showHeatmap ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span>{showHeatmap ? 'Hide' : 'Show'} Heatmap</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CameraFeed showHeatmap={showHeatmap} />
        </div>
        <div className="space-y-6">
          <VisitorCountWidget />
          <DwellTimeWidget />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GenderChart />
        <AgeChart />
      </div>
    </div>
  );
}
