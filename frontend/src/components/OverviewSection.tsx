import { Camera, TrendingUp, Package, Sparkles, Users, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

const modules = [
  {
    icon: Camera,
    title: 'Camera Analytics',
    description: 'Real-time visitor counting, demographics, and behavior tracking',
    href: '/dashboard/camera'
  },
  {
    icon: BarChart3,
    title: 'Sales Analytics',
    description: 'Deep insights into revenue, profit margins, and sales trends',
    href: '/dashboard/sales'
  },
  {
    icon: Package,
    title: 'Inventory & Spend',
    description: 'Smart stock management with automated alerts and cost tracking',
    href: '/dashboard/spend'
  },
  {
    icon: Users,
    title: 'Labor Management',
    description: 'Scheduling, hours tracking, and staff performance analytics',
    href: '/dashboard/labor'
  },
  {
    icon: Sparkles,
    title: 'AI Suggestions',
    description: 'Data-driven recommendations for pricing, staffing, and operations',
    href: '/dashboard/ai'
  },
  {
    icon: TrendingUp,
    title: 'P&L Insights',
    description: 'Financial metrics, cost breakdowns, and profitability tracking',
    href: '/dashboard/pnl'
  }
];

export default function OverviewSection() {
  return (
    <section className="relative py-20 px-6 bg-white border-t border-gray-200">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
            Your Entire Operation. <span className="text-blue-600">One Smart Dashboard.</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            ObservAI combines computer vision, POS integration, and AI intelligence
            to transform your café or restaurant into a data-driven powerhouse.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module, index) => {
            const Icon = module.icon;

            return (
              <Link
                key={index}
                to={module.href}
                className="group bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-gray-300 transition-all duration-200"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                      {module.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-snug">
                      {module.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-200">
            <Sparkles className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-700">Powered by advanced machine learning and computer vision</span>
          </div>
        </div>
      </div>
    </section>
  );
}
