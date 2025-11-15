import { Sparkles, TrendingUp, Users, Clock } from 'lucide-react';

export default function AIInsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
        <p className="text-sm text-gray-600 mt-1">Intelligent recommendations and predictions</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-sm text-yellow-800 font-medium">
          AI insights engine is under development. Advanced analytics coming in next increment.
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
