import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users } from 'lucide-react';
import GlassLineChart from '../../components/charts/GlassLineChart';
import GlassBarChart from '../../components/charts/GlassBarChart';
import GlassDonutChart from '../../components/charts/GlassDonutChart';
import GlassScatterChart from '../../components/charts/GlassScatterChart';
import GlassTreemapChart from '../../components/charts/GlassTreemapChart';

const salesKpis = [
  { label: 'Total Revenue', value: '$45,231', change: '+12.5%', trend: 'up', icon: DollarSign },
  { label: 'Orders', value: '6,059', change: '+8.1%', trend: 'up', icon: ShoppingCart },
  { label: 'Avg Order Value', value: '$7.46', change: '-0.2%', trend: 'down', icon: DollarSign },
  { label: 'Conversion Rate', value: '73.6%', change: '+2.3%', trend: 'up', icon: Users }
];

const bestSellers = [
  { rank: 1, item: 'Iced Latte', revenue: '$8,430', orders: 1123, trend: 'up' },
  { rank: 2, item: 'Cappuccino', revenue: '$6,890', orders: 987, trend: 'same' },
  { rank: 3, item: 'Croissant', revenue: '$5,240', orders: 756, trend: 'up' },
  { rank: 4, item: 'Espresso', revenue: '$4,120', orders: 645, trend: 'down' },
  { rank: 5, item: 'Cold Brew', revenue: '$3,890', orders: 534, trend: 'up' }
];

const hourlyData = [
  { label: '6AM', value: 245 },
  { label: '8AM', value: 420 },
  { label: '10AM', value: 680 },
  { label: '12PM', value: 920 },
  { label: '2PM', value: 780 },
  { label: '4PM', value: 650 },
  { label: '6PM', value: 480 },
  { label: '8PM', value: 320 }
];

const categoryData = [
  { label: 'Beverages', value: 18500, color: 'rgb(59, 130, 246)' },
  { label: 'Food', value: 15200, color: 'rgb(139, 92, 246)' },
  { label: 'Desserts', value: 8300, color: 'rgb(236, 72, 153)' },
  { label: 'Merchandise', value: 3231, color: 'rgb(34, 197, 94)' }
];

const bestSellersData = bestSellers.map(item => ({
  label: item.item,
  value: parseInt(item.revenue.replace('$', '').replace(',', '')),
  color: item.trend === 'up' ? 'rgb(34, 197, 94)' : item.trend === 'down' ? 'rgb(239, 68, 68)' : 'rgb(107, 114, 128)'
}));

const priceVsVolumeData = [
  { x: 3.5, y: 1123, label: 'Iced Latte', size: 8, color: 'rgba(59, 130, 246, 0.7)' },
  { x: 4.2, y: 987, label: 'Cappuccino', size: 7, color: 'rgba(34, 197, 94, 0.7)' },
  { x: 4.8, y: 756, label: 'Croissant', size: 6, color: 'rgba(251, 146, 60, 0.7)' },
  { x: 3.2, y: 645, label: 'Espresso', size: 6, color: 'rgba(168, 85, 247, 0.7)' },
  { x: 5.5, y: 534, label: 'Cold Brew', size: 5, color: 'rgba(236, 72, 153, 0.7)' },
  { x: 6.2, y: 423, label: 'Sandwich', size: 5, color: 'rgba(14, 165, 233, 0.7)' },
  { x: 2.8, y: 890, label: 'Regular Coffee', size: 7, color: 'rgba(99, 102, 241, 0.7)' }
];

const productCategoryTreemap = [
  { label: 'Iced Latte', value: 8430 },
  { label: 'Cappuccino', value: 6890 },
  { label: 'Croissant', value: 5240 },
  { label: 'Espresso', value: 4120 },
  { label: 'Cold Brew', value: 3890 },
  { label: 'Sandwich', value: 3650 },
  { label: 'Muffin', value: 2890 },
  { label: 'Regular Coffee', value: 2820 },
  { label: 'Matcha Latte', value: 2340 },
  { label: 'Pastries', value: 2180 },
  { label: 'Bagel', value: 1980 },
  { label: 'Tea', value: 1801 }
];

export default function SalesPage() {

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Sales Analytics</h1>
        <p className="text-sm text-gray-600 mt-1">Track revenue, orders, and performance metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {salesKpis.map((kpi, index) => {
          const Icon = kpi.icon;
          const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown;

          return (
            <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <div className={`flex items-center space-x-1 text-xs font-medium ${
                  kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  <TrendIcon className="w-3 h-3" />
                  <span>{kpi.change}</span>
                </div>
              </div>
              <div className="text-2xl font-semibold text-gray-900 mb-1">{kpi.value}</div>
              <div className="text-sm text-gray-600">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      <div className="space-y-6">
        <GlassLineChart
          data={hourlyData}
          height={350}
          color="rgb(59, 130, 246)"
          gradient={true}
          animate={true}
          showGrid={true}
          showTooltip={true}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassBarChart
            data={bestSellersData}
            height={350}
            animate={true}
            showValues={true}
            horizontal={true}
          />

          <GlassDonutChart
            data={categoryData}
            size={300}
            innerRadius={0.6}
            animate={true}
            showLegend={true}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Price vs Volume Analysis</h2>
            <p className="text-sm text-gray-600 mb-4">Shows relationship between product price and sales volume</p>
            <div className="flex justify-center">
              <GlassScatterChart
                data={priceVsVolumeData}
                width={550}
                height={400}
                animate={true}
                showGrid={true}
                showTooltip={true}
                xLabel="Price ($)"
                yLabel="Units Sold"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Revenue Distribution</h2>
            <p className="text-sm text-gray-600 mb-4">Treemap showing revenue contribution by product</p>
            <div className="flex justify-center">
              <GlassTreemapChart
                data={productCategoryTreemap}
                width={550}
                height={400}
                animate={true}
                showTooltip={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
