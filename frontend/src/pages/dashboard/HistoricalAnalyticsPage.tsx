import { Calendar, Filter, Download } from 'lucide-react';

export default function HistoricalAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historical Analytics</h1>
          <p className="text-sm text-gray-600 mt-1">View past camera data and trends</p>
        </div>
        <button className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium flex items-center space-x-2 cursor-not-allowed">
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-sm text-yellow-800 font-medium">
          Historical data viewing and export features under development.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 opacity-50">
          <div className="flex items-center space-x-2 mb-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Start Date</span>
          </div>
          <input
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            disabled
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 opacity-50">
          <div className="flex items-center space-x-2 mb-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">End Date</span>
          </div>
          <input
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            disabled
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 opacity-50">
          <div className="flex items-center space-x-2 mb-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Camera</span>
          </div>
          <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" disabled>
            <option>All Cameras</option>
          </select>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 opacity-50">
          <div className="flex items-center space-x-2 mb-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Metric</span>
          </div>
          <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" disabled>
            <option>All Metrics</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="h-96 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Historical Charts</h3>
            <p className="text-sm text-gray-600">Timeline charts and historical data will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}
