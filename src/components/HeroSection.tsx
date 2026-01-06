import { useNavigate } from 'react-router-dom';
import { TrendingUp, Users, Eye, ArrowRight, Sparkles, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import LineChart from './charts/LineChart';

const demoData = [
  { label: 'Mon', value: 120 },
  { label: 'Tue', value: 145 },
  { label: 'Wed', value: 138 },
  { label: 'Thu', value: 165 },
  { label: 'Fri', value: 189 },
  { label: 'Sat', value: 210 },
  { label: 'Sun', value: 195 }
];

export default function HeroSection() {
  const navigate = useNavigate();
  const [revenue, setRevenue] = useState(12453);
  const [visitors, setVisitors] = useState(1247);

  useEffect(() => {
    const interval = setInterval(() => {
      setRevenue(prev => prev + Math.floor(Math.random() * 50) - 10);
      setVisitors(prev => prev + Math.floor(Math.random() * 5) - 2);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-teal-50/30" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLW9wYWNpdHk9IjAuMDMiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-40" />

      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="inline-flex items-center space-x-2 px-4 py-2 glass rounded-full shadow-sm hover-lift">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-700">AI-Powered Restaurant Analytics</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-gray-900 leading-[1.1]">
              AI that sees.<br />
              <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-teal-600 bg-clip-text text-transparent animate-gradient">
                Data that thinks.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 leading-relaxed max-w-xl" style={{ lineHeight: '1.7' }}>
              ObservAI is an AI-driven management system for restaurants and cafés that combines computer vision analytics, predictive insights, and operational intelligence. Monitor customer flow, optimize staffing, track inventory, and maximize profitability—all in one intuitive platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/register')}
                className="group inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-base bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold rounded-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="group inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-base glass text-gray-900 font-semibold rounded-xl hover-lift focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
              >
                <Play className="mr-2 w-5 h-5" />
                Watch Demo
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-4">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">24/7</div>
                <div className="text-xs sm:text-sm font-medium text-gray-600">Monitoring</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Real-time</div>
                <div className="text-xs sm:text-sm font-medium text-gray-600">Insights</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">AI-Powered</div>
                <div className="text-xs sm:text-sm font-medium text-gray-600">Analytics</div>
              </div>
            </div>
          </div>

          <div
            className="relative space-y-4 cursor-pointer group animate-fade-in"
            style={{ animationDelay: '200ms' }}
            onClick={() => navigate('/login')}
          >
            <div className="glass rounded-2xl p-4 sm:p-6 shadow-xl transform group-hover:scale-[1.02] group-hover:shadow-2xl transition-all duration-500">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Live Analytics Preview</h3>
                <div className="flex items-center space-x-1 text-xs text-green-600 font-semibold">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Live</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="glass rounded-xl p-3 sm:p-4 transform group-hover:scale-105 transition-all duration-300">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-semibold text-gray-600">Revenue</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900">${revenue.toLocaleString()}</div>
                  <div className="text-xs text-green-600 font-semibold mt-1">+12.5%</div>
                </div>

                <div className="glass rounded-xl p-3 sm:p-4 transform group-hover:scale-105 transition-all duration-300" style={{ transitionDelay: '50ms' }}>
                  <div className="flex items-center space-x-2 mb-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold text-gray-600">Visitors</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900">{visitors.toLocaleString()}</div>
                  <div className="text-xs text-blue-600 font-semibold mt-1">+8.2%</div>
                </div>
              </div>

              <div className="bg-white/50 rounded-xl p-4 transform group-hover:scale-105 transition-all duration-300" style={{ transitionDelay: '100ms' }}>
                <LineChart
                  data={demoData}
                  height={140}
                  color="rgb(59, 130, 246)"
                  animate={true}
                />
              </div>

              <button className="mt-4 sm:mt-6 w-full py-3 px-6 text-base bg-gradient-to-r from-blue-500 via-violet-500 to-teal-500 text-white font-semibold rounded-xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                Explore Dashboard
              </button>
            </div>

            <div className="text-center text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Click to explore · Sign in required
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
