import { Sparkles, TrendingUp, Users, Clock, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cameraBackendService, ZoneInsight } from '../../services/cameraBackendService';

export default function AIInsightsPage() {
  const [zoneInsights, setZoneInsights] = useState<ZoneInsight[]>([]);

  useEffect(() => {
    const unsubscribe = cameraBackendService.onZoneInsights((insights) => {
      setZoneInsights((prev) => {
        const newInsights = [...prev, ...insights];
        return newInsights.slice(-20);
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
        <p className="text-sm text-gray-600 mt-1">Intelligent recommendations and predictions</p>
      </div>

      {zoneInsights.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Zone Occupancy Alerts</h3>
              <p className="text-sm text-gray-600">People detected in zones for extended periods</p>
            </div>
          </div>
          <div className="space-y-3">
            {zoneInsights.map((insight, index) => (
              <div
                key={`${insight.zoneId}-${insight.personId}-${index}`}
                className="bg-red-50 border border-red-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900">{insight.message}</p>
                    <div className="mt-2 flex items-center space-x-4 text-xs text-red-700">
                      <span>Zone: {insight.zoneName}</span>
                      <span>Duration: {formatDuration(insight.duration)}</span>
                      <span>Time: {formatTimestamp(insight.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-sm text-yellow-800 font-medium">
          Additional AI insights features are under development. Advanced analytics coming in next increment.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 opacity-50">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Peak Hours Prediction</h3>
          </div>
          <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-sm text-gray-400">Chart placeholder</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 opacity-50">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Customer Behavior</h3>
          </div>
          <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-sm text-gray-400">Insight placeholder</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 opacity-50">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Optimization Tips</h3>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-100 rounded"></div>
            <div className="h-4 bg-gray-100 rounded w-3/4"></div>
            <div className="h-4 bg-gray-100 rounded w-5/6"></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 opacity-50">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Traffic Forecasting</h3>
          </div>
          <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-sm text-gray-400">Forecast placeholder</p>
          </div>
        </div>
      </div>
    </div>
  );
}
