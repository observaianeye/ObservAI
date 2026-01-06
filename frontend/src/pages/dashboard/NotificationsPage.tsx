import { Bell, AlertTriangle, Info, CheckCircle } from 'lucide-react';

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-600 mt-1">System alerts and camera notifications</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-sm text-yellow-800 font-medium">
          Notification system is under development. Real-time alerts coming soon.
        </p>
      </div>

      <div className="space-y-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 opacity-50 flex items-start space-x-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Camera Offline</h3>
            <p className="text-sm text-gray-600">Camera 3 - Back Exit has gone offline</p>
            <p className="text-xs text-gray-500 mt-1">5 minutes ago</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 opacity-50 flex items-start space-x-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">High Traffic Alert</h3>
            <p className="text-sm text-gray-600">Visitor count exceeded threshold</p>
            <p className="text-xs text-gray-500 mt-1">12 minutes ago</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 opacity-50 flex items-start space-x-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">System Update</h3>
            <p className="text-sm text-gray-600">Analytics engine updated successfully</p>
            <p className="text-xs text-gray-500 mt-1">1 hour ago</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">More Notifications Coming</h3>
        <p className="text-sm text-gray-600">Advanced filtering and notification preferences will be available in the next increment</p>
      </div>
    </div>
  );
}
