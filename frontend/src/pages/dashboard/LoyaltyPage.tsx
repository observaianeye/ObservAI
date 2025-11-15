import { Heart, Users, Repeat, TrendingUp } from 'lucide-react';

const loyaltyKpis = [
  { label: 'Active Members', value: '3,842', change: '+234', icon: Users },
  { label: 'Retention Rate', value: '78.5%', change: '+3.2%', icon: Heart },
  { label: 'Repeat Customers', value: '64%', change: '+5.1%', icon: Repeat },
  { label: 'Avg Visits/Month', value: '4.2', change: '+0.3', icon: TrendingUp }
];

const customerSegments = [
  { segment: 'Platinum', count: 248, revenue: '$18,940', avgSpend: '$76.37', color: 'purple' },
  { segment: 'Gold', count: 592, revenue: '$28,450', avgSpend: '$48.05', color: 'amber' },
  { segment: 'Silver', count: 1156, revenue: '$34,210', avgSpend: '$29.60', color: 'gray' },
  { segment: 'Bronze', count: 1846, revenue: '$25,630', avgSpend: '$13.89', color: 'orange' }
];

const frequencyData = [
  { visits: '1-2', customers: 1245, percentage: 32 },
  { visits: '3-5', customers: 1486, percentage: 39 },
  { visits: '6-10', customers: 756, percentage: 20 },
  { visits: '11+', customers: 355, percentage: 9 }
];

export default function LoyaltyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Loyalty Insights</h1>
        <p className="text-sm text-gray-600 mt-1">Track customer retention, frequency, and engagement</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loyaltyKpis.map((kpi, index) => {
          const Icon = kpi.icon;

          return (
            <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-pink-50 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-pink-600" />
                </div>
                <span className="text-xs font-medium text-green-600">{kpi.change}</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900 mb-1">{kpi.value}</div>
              <div className="text-sm text-gray-600">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Segments</h2>
          <div className="space-y-4">
            {customerSegments.map((segment, index) => {
              const colorMap = {
                purple: 'bg-purple-500',
                amber: 'bg-amber-500',
                gray: 'bg-gray-400',
                orange: 'bg-orange-500'
              };

              return (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${colorMap[segment.color as keyof typeof colorMap]}`} />
                      <span className="text-sm font-semibold text-gray-900">{segment.segment}</span>
                      <span className="text-xs text-gray-500">{segment.count} members</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{segment.revenue}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Avg Spend</span>
                    <span className="text-xs font-medium text-gray-900">{segment.avgSpend}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Visit Frequency (Monthly)</h2>
          <div className="space-y-6">
            {frequencyData.map((item, index) => (
              <div key={index}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-900">{item.visits} visits</span>
                  <span className="text-sm text-gray-600">{item.customers} customers ({item.percentage}%)</span>
                </div>
                <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-pink-600 rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-pink-50 rounded-lg">
            <p className="text-xs font-medium text-pink-900 mb-1">Retention Health</p>
            <p className="text-2xl font-semibold text-pink-700">78.5%</p>
            <p className="text-xs text-pink-600 mt-1">Above industry average</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Churn Risk Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-xs font-medium text-red-900 mb-1">High Risk</p>
            <p className="text-2xl font-semibold text-red-700 mb-1">142</p>
            <p className="text-xs text-red-600">No visit in 45+ days</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs font-medium text-amber-900 mb-1">Medium Risk</p>
            <p className="text-2xl font-semibold text-amber-700 mb-1">287</p>
            <p className="text-xs text-amber-600">No visit in 30-44 days</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-xs font-medium text-green-900 mb-1">Low Risk</p>
            <p className="text-2xl font-semibold text-green-700 mb-1">3,413</p>
            <p className="text-xs text-green-600">Active within 30 days</p>
          </div>
        </div>
      </div>
    </div>
  );
}
