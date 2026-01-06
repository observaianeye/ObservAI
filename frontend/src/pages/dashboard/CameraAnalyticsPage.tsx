import CameraFeed from '../../components/camera/CameraFeed';
import GenderChart from '../../components/camera/GenderChart';
import AgeChart from '../../components/camera/AgeChart';
import VisitorCountWidget from '../../components/camera/VisitorCountWidget';
import DwellTimeWidget from '../../components/camera/DwellTimeWidget';

export default function CameraAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-400">Camera Analytics Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Real-time visitor insights and analytics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CameraFeed />
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
