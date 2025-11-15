import { Sparkles, TrendingUp, Users, DollarSign, Package, Clock } from 'lucide-react';

const suggestions = [
  {
    category: 'Pricing',
    icon: DollarSign,
    priority: 'high',
    title: 'Increase iced latte price by 8%',
    description: 'Demand is 23% above forecast. Competitors average $0.50 higher.',
    impact: '+$840/mo revenue',
    confidence: 92
  },
  {
    category: 'Staffing',
    icon: Users,
    priority: 'high',
    title: 'Add barista 2:00 PM - 4:00 PM weekdays',
    description: 'Queue time peaks at 4.2 min during this window, above 3 min target.',
    impact: '-35% wait time',
    confidence: 88
  },
  {
    category: 'Promotion',
    icon: Sparkles,
    priority: 'medium',
    title: 'Bundle iced latte + cookie at 10% discount',
    description: 'Afternoon AOV drops 18%. Bundle targets low-spend window.',
    impact: '+$620/mo revenue',
    confidence: 85
  },
  {
    category: 'Inventory',
    icon: Package,
    priority: 'high',
    title: 'Restock oat milk before Friday',
    description: 'Current stock at 15%. Friday demand forecast +40% vs average.',
    impact: 'Prevent stockout',
    confidence: 95
  },
  {
    category: 'Menu',
    icon: TrendingUp,
    priority: 'medium',
    title: 'Promote cold brew during 12-2 PM',
    description: 'Cold brew margin 68% vs latte 58%. Lunch traffic underutilizes it.',
    impact: '+$420/mo profit',
    confidence: 78
  },
  {
    category: 'Operations',
    icon: Clock,
    priority: 'low',
    title: 'Prep pastries 30 min earlier',
    description: 'Morning rush starts 8:15 AM. Early prep reduces wait by 45 sec.',
    impact: '-15% morning wait',
    confidence: 72
  }
];

const priorityConfig = {
  high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100' },
  low: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100' }
};

export default function AIPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">AI Suggestions</h1>
        <p className="text-sm text-gray-600 mt-1">Automated insights and optimization recommendations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-200 p-6">
          <p className="text-sm font-medium text-gray-700 mb-2">High Priority</p>
          <p className="text-4xl font-semibold text-red-700">3</p>
          <p className="text-xs text-gray-600 mt-1">Requires immediate action</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Medium Priority</p>
          <p className="text-4xl font-semibold text-amber-700">2</p>
          <p className="text-xs text-gray-600 mt-1">Review this week</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Total Impact</p>
          <p className="text-4xl font-semibold text-blue-700">$2,720</p>
          <p className="text-xs text-gray-600 mt-1">Potential monthly gain</p>
        </div>
      </div>

      <div className="space-y-4">
        {suggestions.map((suggestion, index) => {
          const Icon = suggestion.icon;
          const config = priorityConfig[suggestion.priority as keyof typeof priorityConfig];

          return (
            <div
              key={index}
              className={`bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-all`}
            >
              <div className="flex items-start space-x-4">
                <div className={`w-12 h-12 ${config.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-6 h-6 ${config.text}`} />
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">{suggestion.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${config.badge} ${config.text} uppercase`}>
                          {suggestion.priority}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">{suggestion.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">{suggestion.impact}</p>
                      <p className="text-xs text-gray-500">{suggestion.confidence}% confidence</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 mb-4">{suggestion.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span className="text-xs text-gray-600">AI Generated</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
                        Dismiss
                      </button>
                      <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Learning Status</h3>
            <p className="text-sm text-gray-700 mb-3">
              ObservAI has analyzed 30 days of data across camera feeds, POS transactions, inventory, and staff schedules.
              Confidence in recommendations increases with more data.
            </p>
            <div className="flex items-center space-x-6">
              <div>
                <p className="text-xs text-gray-600">Data Points</p>
                <p className="text-lg font-semibold text-gray-900">284,459</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Model Accuracy</p>
                <p className="text-lg font-semibold text-gray-900">87.4%</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Suggestions Applied</p>
                <p className="text-lg font-semibold text-gray-900">12</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
