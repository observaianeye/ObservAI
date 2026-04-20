import { Link } from 'react-router-dom';
import { Camera, Eye, Users, TrendingUp, Video, MapPin, ArrowRight } from 'lucide-react';

function HomeNavbar() {
  return (
    <nav className="sticky top-0 z-50 bg-surface-0/80 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2 group">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-accent-500 rounded-xl flex items-center justify-center transform group-hover:scale-110 transition-transform shadow-glow-brand">
            <Camera className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="font-display text-xl font-semibold text-ink-0 tracking-tight">ObservAI</span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-6">
          <a href="#features" className="hidden sm:inline text-sm font-semibold text-ink-2 hover:text-ink-0 transition-colors">Features</a>
          <a href="#how-it-works" className="hidden sm:inline text-sm font-semibold text-ink-2 hover:text-ink-0 transition-colors">How It Works</a>
          <Link to="/login" className="text-sm font-semibold text-ink-2 hover:text-ink-0 transition-colors">Login</Link>
          <Link
            to="/register"
            className="px-4 sm:px-6 py-2 text-sm bg-gradient-to-r from-brand-500 to-accent-500 text-white font-semibold rounded-xl hover:shadow-glow-brand transform hover:scale-105 transition-all"
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
    <div className="min-h-screen bg-surface-0">
      <HomeNavbar />

      <section className="relative pt-20 pb-24 bg-surface-0 grid-floor overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 px-4 py-2 surface-card rounded-full mb-6">
              <Video className="w-4 h-4 text-brand-300" strokeWidth={1.5} />
              <span className="text-sm font-semibold text-brand-300 font-mono">Camera Analytics Platform</span>
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-semibold text-ink-0 mb-6 tracking-tight">
              Visitor Intelligence
              <br />
              <span className="text-gradient-brand">Powered by Vision AI</span>
            </h1>
            <p className="text-xl text-ink-2 max-w-3xl mx-auto mb-8">
              Transform your cameras into powerful analytics tools. Track visitors, analyze behavior, and optimize your space with real-time insights.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                to="/login"
                className="px-8 py-4 bg-gradient-to-r from-brand-500 to-accent-500 text-white font-semibold rounded-xl hover:shadow-glow-brand-strong transform hover:scale-105 transition-all flex items-center space-x-2"
              >
                <span>Try Demo Dashboard</span>
                <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
              </Link>
              <a
                href="#features"
                className="px-8 py-4 surface-card text-ink-0 font-semibold rounded-xl hover:border-brand-500/30 hover:shadow-glow-brand transition-all"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-surface-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl font-semibold text-ink-0 mb-4 tracking-tight">Camera Analytics Features</h2>
            <p className="text-lg text-ink-3 max-w-2xl mx-auto">
              Everything you need to understand visitor behavior and optimize your space
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="surface-card rounded-2xl p-8 hover:border-brand-500/30 hover:shadow-glow-brand transition-all">
              <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-accent-500 rounded-xl flex items-center justify-center mb-4 shadow-glow-brand">
                <Users className="w-7 h-7 text-white" strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-xl font-semibold text-ink-0 mb-3">Visitor Counting</h3>
              <p className="text-ink-3">Real-time tracking of foot traffic with gender and age demographics</p>
            </div>

            <div className="surface-card rounded-2xl p-8 hover:border-warning/30 transition-all">
              <div className="w-14 h-14 bg-gradient-to-br from-warning to-danger rounded-xl flex items-center justify-center mb-4">
                <Eye className="w-7 h-7 text-white" strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-xl font-semibold text-ink-0 mb-3">Heatmap Overlay</h3>
              <p className="text-ink-3">Visualize high-traffic areas and customer movement patterns</p>
            </div>

            <div className="surface-card rounded-2xl p-8 hover:border-success/30 transition-all">
              <div className="w-14 h-14 bg-gradient-to-br from-success to-accent-500 rounded-xl flex items-center justify-center mb-4">
                <MapPin className="w-7 h-7 text-white" strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-xl font-semibold text-ink-0 mb-3">Zone Labeling</h3>
              <p className="text-ink-3">Define entrance/exit zones for accurate flow tracking</p>
            </div>

            <div className="surface-card rounded-2xl p-8 hover:border-violet-500/30 transition-all">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-danger rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-7 h-7 text-white" strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-xl font-semibold text-ink-0 mb-3">Dwell Time Analysis</h3>
              <p className="text-ink-3">Measure how long visitors stay in different areas</p>
            </div>

            <div className="surface-card rounded-2xl p-8 hover:border-warning/30 transition-all">
              <div className="w-14 h-14 bg-gradient-to-br from-warning to-accent-500 rounded-xl flex items-center justify-center mb-4">
                <Video className="w-7 h-7 text-white" strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-xl font-semibold text-ink-0 mb-3">Live Camera Feed</h3>
              <p className="text-ink-3">Monitor multiple cameras in real-time with analytics overlay</p>
            </div>

            <div className="surface-card rounded-2xl p-8 hover:border-brand-500/30 transition-all">
              <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-violet-500 rounded-xl flex items-center justify-center mb-4 shadow-glow-brand">
                <TrendingUp className="w-7 h-7 text-white" strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-xl font-semibold text-ink-0 mb-3">Historical Analytics</h3>
              <p className="text-ink-3">Review past trends and export data for deeper analysis</p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 bg-surface-0 grid-floor opacity-90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl font-semibold text-ink-0 mb-4 tracking-tight">How It Works</h2>
            <p className="text-lg text-ink-3 max-w-2xl mx-auto">
              Get started with camera analytics in minutes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-accent-500 text-white rounded-2xl flex items-center justify-center font-display font-mono text-2xl font-semibold mx-auto mb-4 shadow-glow-brand">1</div>
              <h3 className="font-display text-xl font-semibold text-ink-0 mb-2">Connect Cameras</h3>
              <p className="text-ink-3">Link your existing cameras to the ObservAI platform</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-accent-500 to-violet-500 text-white rounded-2xl flex items-center justify-center font-display font-mono text-2xl font-semibold mx-auto mb-4">2</div>
              <h3 className="font-display text-xl font-semibold text-ink-0 mb-2">Define Zones</h3>
              <p className="text-ink-3">Label entrance/exit zones for accurate tracking</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-success to-accent-500 text-white rounded-2xl flex items-center justify-center font-display font-mono text-2xl font-semibold mx-auto mb-4">3</div>
              <h3 className="font-display text-xl font-semibold text-ink-0 mb-2">Get Insights</h3>
              <p className="text-ink-3">View real-time analytics and optimize your space</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-20 bg-gradient-to-br from-brand-500 via-accent-500 to-violet-500 text-white overflow-hidden">
        <div className="absolute inset-0 grid-floor opacity-20" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center relative">
          <h2 className="font-display text-4xl font-semibold mb-4 tracking-tight">Ready to Get Started?</h2>
          <p className="text-xl text-ink-0/90 mb-8 max-w-2xl mx-auto">
            Try our demo dashboard and see how camera analytics can transform your business
          </p>
          <Link
            to="/login"
            className="inline-flex items-center space-x-2 px-8 py-4 bg-white text-brand-500 font-semibold rounded-xl hover:shadow-2xl transform hover:scale-105 transition-all"
          >
            <span>Access Demo Dashboard</span>
            <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
          </Link>
        </div>
      </section>

      <footer className="bg-surface-0 border-t border-white/[0.08] text-ink-3 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-accent-500 rounded-xl flex items-center justify-center shadow-glow-brand">
                <Camera className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
              <span className="font-display text-lg font-semibold text-ink-0 tracking-tight">ObservAI</span>
            </div>
            <p className="text-sm font-mono">&copy; 2025 ObservAI. Camera Analytics Platform.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
