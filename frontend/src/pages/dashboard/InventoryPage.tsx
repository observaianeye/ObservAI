import { Package, AlertTriangle, TrendingDown, DollarSign } from 'lucide-react';

export default function InventoryPage() {
  const inventoryItems = [
    { id: 1, name: 'Tomatoes', category: 'Produce', stock: 25, unit: 'lbs', reorderPoint: 30, cost: 2.5, status: 'low' },
    { id: 2, name: 'Ground Beef', category: 'Meat', stock: 150, unit: 'lbs', reorderPoint: 100, cost: 4.99, status: 'good' },
    { id: 3, name: 'Mozzarella Cheese', category: 'Dairy', stock: 45, unit: 'lbs', reorderPoint: 40, cost: 3.75, status: 'good' },
    { id: 4, name: 'Pizza Dough', category: 'Bakery', stock: 80, unit: 'units', reorderPoint: 100, cost: 1.25, status: 'low' },
    { id: 5, name: 'Lettuce', category: 'Produce', stock: 15, unit: 'heads', reorderPoint: 20, cost: 1.5, status: 'critical' },
    { id: 6, name: 'Olive Oil', category: 'Pantry', stock: 120, unit: 'gallons', reorderPoint: 50, cost: 12.99, status: 'good' },
  ];

  const lowStockItems = inventoryItems.filter(item => item.status === 'low' || item.status === 'critical');
  const totalInventoryValue = inventoryItems.reduce((sum, item) => sum + (item.stock * item.cost), 0);
  const monthlySpend = 12458.50;

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1" style={{ lineHeight: '1.6' }}>Track stock levels and optimize costs</p>
        </div>
        <button className="px-6 py-3 text-base bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
          Add Item
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm font-semibold text-gray-600 mb-1">Total Items</p>
          <p className="text-3xl font-bold text-gray-900">{inventoryItems.length}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <p className="text-sm font-semibold text-gray-600 mb-1">Low Stock Alerts</p>
          <p className="text-3xl font-bold text-gray-900">{lowStockItems.length}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm font-semibold text-gray-600 mb-1">Inventory Value</p>
          <p className="text-3xl font-bold text-gray-900">${totalInventoryValue.toFixed(0)}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-violet-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-violet-600" />
            </div>
          </div>
          <p className="text-sm font-semibold text-gray-600 mb-1">Monthly Spend</p>
          <p className="text-3xl font-bold text-gray-900">${monthlySpend.toLocaleString()}</p>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 mb-2">Low Stock Alerts</h3>
              <p className="text-sm text-red-700 mb-4" style={{ lineHeight: '1.6' }}>
                {lowStockItems.length} items are running low and need to be reordered soon.
              </p>
              <div className="space-y-2">
                {lowStockItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-600">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{item.stock} {item.unit}</p>
                      <p className="text-xs text-gray-600">Reorder at {item.reorderPoint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">All Inventory Items</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Item</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Reorder Point</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit Cost</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {inventoryItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-gray-600">{item.category}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-semibold text-gray-900">{item.stock} {item.unit}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-gray-600">{item.reorderPoint} {item.unit}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-semibold text-gray-900">${item.cost.toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-semibold text-gray-900">${(item.stock * item.cost).toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      item.status === 'critical' ? 'bg-red-100 text-red-700' :
                      item.status === 'low' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {item.status === 'critical' ? 'Critical' : item.status === 'low' ? 'Low Stock' : 'Good'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
