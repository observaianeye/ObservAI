import { Link } from 'react-router-dom';
import { Camera, Eye, Users, TrendingUp, Video, MapPin, ArrowRight } from 'lucide-react';

function HomeNavbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2 group">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center transform group-hover:scale-110 transition-transform">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">ObservAI</span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-6">
          <a href="#features" className="hidden sm:inline text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors">Features</a>
          <a href="#how-it-works" className="hidden sm:inline text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors">How It Works</a>
          <Link to="/login" className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors">Login</Link>
          <Link
            to="/register"
            className="px-4 sm:px-6 py-2 text-sm bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all"
          >
            <span className="hidden sm:inline">Start Free Trial</span>
            <span className="sm:hidden">Sign Up</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <HomeNavbar />

      <section className="relative pt-20 pb-24 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLW9wYWNpdHk9IjAuMDMiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-40"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-100 rounded-full mb-6">
              <Video className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">Camera Analytics Platform</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Visitor Intelligence
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Powered by Vision AI</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Transform your cameras into powerful analytics tools. Track visitors, analyze behavior, and optimize your space with real-time insights.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                to="/login"
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:shadow-xl transform hover:scale-105 transition-all flex items-center space-x-2"
              >
                <span>Try Demo Dashboard</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#features"
                className="px-8 py-4 bg-white border-2 border-gray-300 text-gray-900 font-semibold rounded-xl hover:border-blue-600 transition-all"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Camera Analytics Features</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Everything you need to understand visitor behavior and optimize your space
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 border border-blue-200">
              <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Visitor Counting</h3>
              <p className="text-gray-600">Real-time tracking of foot traffic with gender and age demographics</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-8 border border-orange-200">
              <div className="w-14 h-14 bg-orange-600 rounded-xl flex items-center justify-center mb-4">
                <Eye className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Heatmap Overlay</h3>
              <p className="text-gray-600">Visualize high-traffic areas and customer movement patterns</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-2xl p-8 border border-green-200">
              <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center mb-4">
                <MapPin className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Zone Labeling</h3>
              <p className="text-gray-600">Define entrance/exit zones for accurate flow tracking</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border border-purple-200">
              <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Dwell Time Analysis</h3>
              <p className="text-gray-600">Measure how long visitors stay in different areas</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-8 border border-yellow-200">
              <div className="w-14 h-14 bg-yellow-600 rounded-xl flex items-center justify-center mb-4">
                <Video className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Live Camera Feed</h3>
              <p className="text-gray-600">Monitor multiple cameras in real-time with analytics overlay</p>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-8 border border-indigo-200">
              <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Historical Analytics</h3>
              <p className="text-gray-600">Review past trends and export data for deeper analysis</p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Get started with camera analytics in minutes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4">1</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Connect Cameras</h3>
              <p className="text-gray-600">Link your existing cameras to the ObservAI platform</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-cyan-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4">2</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Define Zones</h3>
              <p className="text-gray-600">Label entrance/exit zones for accurate tracking</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4">3</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Get Insights</h3>
              <p className="text-gray-600">View real-time analytics and optimize your space</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-blue-600 to-cyan-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Try our demo dashboard and see how camera analytics can transform your business
          </p>
          <Link
            to="/login"
            className="inline-flex items-center space-x-2 px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:shadow-2xl transform hover:scale-105 transition-all"
          >
            <span>Access Demo Dashboard</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">ObservAI</span>
            </div>
            <p className="text-sm">&copy; 2025 ObservAI. Camera Analytics Platform.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
