import { useState } from 'react';
import { Video, Maximize2, Users, Clock, MapPin, Activity } from 'lucide-react';
import CameraFeedCard from '../../components/CameraFeedCard';
import CameraDetailModal from '../../components/CameraDetailModal';

interface CameraFeed {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'inactive';
  peopleCount: number;
  queueLength: number;
  avgWaitTime: string;
}

const demoFeeds: CameraFeed[] = [
  {
    id: '1',
    name: 'Front Counter',
    location: 'Main Floor',
    status: 'active',
    peopleCount: 12,
    queueLength: 4,
    avgWaitTime: '2.3 min'
  },
  {
    id: '2',
    name: 'Seating Area',
    location: 'Dining Zone',
    status: 'active',
    peopleCount: 18,
    queueLength: 0,
    avgWaitTime: '0 min'
  },
  {
    id: '3',
    name: 'Entrance',
    location: 'Front Door',
    status: 'active',
    peopleCount: 3,
    queueLength: 0,
    avgWaitTime: '0 min'
  },
  {
    id: '4',
    name: 'Pickup Station',
    location: 'Back Counter',
    status: 'active',
    peopleCount: 7,
    queueLength: 2,
    avgWaitTime: '1.5 min'
  }
];

export default function CameraLivePage() {
  const [selectedFeed, setSelectedFeed] = useState<CameraFeed | null>(null);
  const [overlaysEnabled, setOverlaysEnabled] = useState({
    peopleCount: true,
    queueLength: true,
    hotZones: false
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Live Camera Feeds</h1>
          <p className="text-sm text-gray-600 mt-1">Real-time monitoring with AI-powered analytics</p>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={overlaysEnabled.peopleCount}
              onChange={(e) => setOverlaysEnabled({...overlaysEnabled, peopleCount: e.target.checked})}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-gray-700">People Count</span>
          </label>
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={overlaysEnabled.queueLength}
              onChange={(e) => setOverlaysEnabled({...overlaysEnabled, queueLength: e.target.checked})}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-gray-700">Queue Length</span>
          </label>
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={overlaysEnabled.hotZones}
              onChange={(e) => setOverlaysEnabled({...overlaysEnabled, hotZones: e.target.checked})}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-gray-700">Hot Zones</span>
          </label>
        </div>
      </div>

      {selectedFeed && (
        <CameraDetailModal
          location={selectedFeed.name}
          onClose={() => setSelectedFeed(null)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {demoFeeds.map((feed, index) => (
          <CameraFeedCard
            key={feed.id}
            location={feed.name}
            cameraId={index}
            onExpand={() => setSelectedFeed(feed)}
          />
        ))}
      </div>
    </div>
  );
}
