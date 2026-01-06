import { Settings, Camera, Bell, Globe, Shield } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-600 mt-1">Configure system preferences</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-sm text-yellow-800 font-medium">
          Settings panel is under construction. Configuration options coming in next increment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 opacity-50">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Camera className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Camera Settings</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Detection Sensitivity</label>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue="50"
                className="w-full"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Frame Rate</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" disabled>
                <option>30 FPS</option>
                <option>60 FPS</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 opacity-50">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Notification Preferences</h3>
          </div>
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <input type="checkbox" className="rounded" disabled />
              <span className="text-sm text-gray-700">Email notifications</span>
            </label>
            <label className="flex items-center space-x-3">
              <input type="checkbox" className="rounded" disabled />
              <span className="text-sm text-gray-700">Push notifications</span>
            </label>
            <label className="flex items-center space-x-3">
              <input type="checkbox" className="rounded" disabled />
              <span className="text-sm text-gray-700">Alert sounds</span>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 opacity-50">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Regional Settings</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" disabled>
                <option>English</option>
                <option>Spanish</option>
                <option>French</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" disabled>
                <option>UTC-5 (EST)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 opacity-50">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Security</h3>
          </div>
          <div className="space-y-3">
            <button className="w-full px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">
              Change Password
            </button>
            <button className="w-full px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">
              Two-Factor Auth
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">More Settings Coming Soon</h3>
        <p className="text-sm text-gray-600">Advanced configuration options and integrations will be available next</p>
      </div>
    </div>
  );
}
