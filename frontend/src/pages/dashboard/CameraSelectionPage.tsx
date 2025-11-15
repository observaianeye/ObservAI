import { Camera, Circle, Settings } from 'lucide-react';

export default function CameraSelectionPage() {
  const cameras = [
    { id: 1, name: 'Main Entrance', status: 'online', location: 'Front Door' },
    { id: 2, name: 'Checkout Area', status: 'online', location: 'Zone B' },
    { id: 3, name: 'Back Exit', status: 'offline', location: 'Rear Door' },
    { id: 4, name: 'Side Entrance', status: 'online', location: 'Side Door' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Camera Selection</h1>
        <p className="text-sm text-gray-600 mt-1">Manage and select active cameras</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-sm text-yellow-800 font-medium">
          This page is under development. Camera management features coming in next increment.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cameras.map((camera) => (
          <div key={camera.id} className="bg-white rounded-xl border border-gray-200 p-6 opacity-60">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Camera className="w-6 h-6 text-gray-400" />
              </div>
              <div className="flex items-center space-x-2">
                <Circle
                  className={`w-3 h-3 ${
                    camera.status === 'online' ? 'text-green-500 fill-green-500' : 'text-red-500 fill-red-500'
                  }`}
                />
                <span className="text-xs text-gray-600 capitalize">{camera.status}</span>
              </div>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">{camera.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{camera.location}</p>
            <button className="w-full px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">
              Configure
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced Features Coming Soon</h3>
        <p className="text-sm text-gray-600">Camera configuration, stream settings, and multi-camera view</p>
      </div>
    </div>
  );
}
