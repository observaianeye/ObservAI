import { Package, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';

const spendKpis = [
  { label: 'Total Spend', value: '$16,450', change: '-3.2%', icon: Package },
  { label: 'Categories', value: '12', change: '+1', icon: Package },
  { label: 'Compliance', value: '94%', change: '+2%', icon: CheckCircle },
  { label: 'Cost Savings', value: '$2,340', change: '+$420', icon: TrendingDown }
];

const categoryLeaderboard = [
  { category: 'Coffee Beans', spend: '$4,230', budget: '$4,500', compliance: 94, variance: -6 },
  { category: 'Dairy Products', spend: '$2,890', budget: '$2,800', compliance: 97, variance: +3 },
  { category: 'Pastries', spend: '$2,450', budget: '$2,600', compliance: 94, variance: -6 },
  { category: 'Supplies', spend: '$1,840', budget: '$2,000', compliance: 92, variance: -8 },
  { category: 'Equipment', spend: '$1,560', budget: '$1,500', compliance: 96, variance: +4 }
];

const inventoryAlerts = [
  { item: 'Oat Milk', status: 'critical', stock: '15%', reorderBy: 'Friday' },
  { item: 'Espresso Cups', status: 'low', stock: '28%', reorderBy: 'Next week' },
  { item: 'Sugar Packets', status: 'warning', stock: '45%', reorderBy: 'In 2 weeks' }
];

export default function SpendPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Spend & Inventory</h1>
        <p className="text-sm text-gray-600 mt-1">Monitor costs, budgets, and inventory levels</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {spendKpis.map((kpi, index) => {
          const Icon = kpi.icon;

          return (
            <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-amber-600" />
                </div>
                <span className="text-xs font-medium text-gray-600">{kpi.change}</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900 mb-1">{kpi.value}</div>
              <div className="text-sm text-gray-600">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Category Spending</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 text-xs font-semibold text-gray-700">Category</th>
                  <th className="text-right py-3 text-xs font-semibold text-gray-700">Spend</th>
                  <th className="text-right py-3 text-xs font-semibold text-gray-700">Budget</th>
                  <th className="text-right py-3 text-xs font-semibold text-gray-700">Compliance</th>
                  <th className="text-right py-3 text-xs font-semibold text-gray-700">Variance</th>
                </tr>
              </thead>
              <tbody>
                {categoryLeaderboard.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 text-sm font-medium text-gray-900">{item.category}</td>
                    <td className="py-4 text-sm text-gray-900 text-right">{item.spend}</td>
                    <td className="py-4 text-sm text-gray-600 text-right">{item.budget}</td>
                    <td className="py-4 text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        item.compliance >= 95 ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {item.compliance}%
                      </span>
                    </td>
                    <td className="py-4 text-sm text-right">
                      <span className={item.variance > 0 ? 'text-red-600' : 'text-green-600'}>
                        {item.variance > 0 ? '+' : ''}{item.variance}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventory Alerts</h2>
          <div className="space-y-3">
            {inventoryAlerts.map((alert, index) => {
              const statusConfig = {
                critical: { color: 'red', icon: AlertCircle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
                low: { color: 'amber', icon: AlertCircle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
                warning: { color: 'blue', icon: AlertCircle, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' }
              };

              const config = statusConfig[alert.status as keyof typeof statusConfig];
              const Icon = config.icon;

              return (
                <div key={index} className={`p-4 rounded-lg border ${config.bg} ${config.border}`}>
                  <div className="flex items-start space-x-3">
                    <Icon className={`w-5 h-5 ${config.text} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${config.text} mb-1`}>{alert.item}</p>
                      <p className="text-xs text-gray-600">Stock: {alert.stock}</p>
                      <p className="text-xs text-gray-600">Reorder by: {alert.reorderBy}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button className="w-full mt-4 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
            Generate Purchase Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trend</h2>
          <div className="space-y-4">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, index) => {
              const value = [92, 88, 94, 85, 90, 87][index];
              return (
                <div key={index}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">{month}</span>
                    <span className="text-sm font-medium text-gray-900">${(value * 180).toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Cost Optimization</h3>
              <p className="text-sm text-gray-700 mb-3">
                You've saved $2,340 this month through optimized ordering and reduced waste.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">Bulk ordering discount: $1,200</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">Waste reduction: $740</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">Vendor optimization: $400</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
