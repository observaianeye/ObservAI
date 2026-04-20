import { useNavigate } from 'react-router-dom';
import { TrendingUp, Users, ArrowRight, Sparkles, Play } from 'lucide-react';
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
    <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-surface-0">
      <div className="absolute inset-0 grid-floor opacity-60" />
      <div className="absolute inset-0 scan-bar pointer-events-none" />

      <div className="absolute top-20 left-10 w-72 h-72 bg-brand-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="inline-flex items-center space-x-2 px-4 py-2 surface-card rounded-full shadow-sm">
              <Sparkles className="w-4 h-4 text-brand-300" strokeWidth={1.5} />
              <span className="text-sm font-semibold text-ink-1">AI-Powered Restaurant Analytics</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-7xl font-semibold text-ink-0 leading-[1.1] tracking-tight">
              AI that sees.<br />
              <span className="text-gradient-brand animate-gradient">
                Data that thinks.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-ink-2 leading-relaxed max-w-xl" style={{ lineHeight: '1.7' }}>
              ObservAI is an AI-driven management system for restaurants and cafés that combines computer vision analytics, predictive insights, and operational intelligence. Monitor customer flow, optimize staffing, track inventory, and maximize profitability—all in one intuitive platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/register')}
                className="group inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-base bg-gradient-to-r from-brand-500 to-accent-500 text-white font-semibold rounded-xl hover:shadow-glow-brand-strong transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-0"
              >
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="group inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-base surface-card text-ink-0 font-semibold rounded-xl hover:border-brand-500/30 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-0"
              >
                <Play className="mr-2 w-5 h-5" strokeWidth={1.5} />
                Watch Demo
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-4">
              <div className="text-center">
                <div className="font-display text-2xl sm:text-3xl font-semibold text-ink-0 mb-1">24/7</div>
                <div className="text-xs sm:text-sm font-medium text-ink-3 font-mono">Monitoring</div>
              </div>
              <div className="text-center">
                <div className="font-display text-2xl sm:text-3xl font-semibold text-ink-0 mb-1">Real-time</div>
                <div className="text-xs sm:text-sm font-medium text-ink-3 font-mono">Insights</div>
              </div>
              <div className="text-center">
                <div className="font-display text-2xl sm:text-3xl font-semibold text-ink-0 mb-1">AI-Powered</div>
                <div className="text-xs sm:text-sm font-medium text-ink-3 font-mono">Analytics</div>
              </div>
            </div>
          </div>

          <div
            className="relative space-y-4 cursor-pointer group animate-fade-in"
            style={{ animationDelay: '200ms' }}
            onClick={() => navigate('/login')}
          >
            <div className="surface-card rounded-2xl p-4 sm:p-6 shadow-xl transform group-hover:scale-[1.02] group-hover:shadow-glow-brand transition-all duration-500">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="font-display text-base sm:text-lg font-semibold text-ink-0">Live Analytics Preview</h3>
                <div className="flex items-center space-x-1 text-xs text-success font-semibold font-mono">
                  <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                  <span>Live</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 sm:p-4 transform group-hover:scale-105 transition-all duration-300">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-success" strokeWidth={1.5} />
                    <span className="text-xs font-semibold text-ink-3">Revenue</span>
                  </div>
                  <div className="font-display font-mono text-xl sm:text-2xl font-semibold text-ink-0">${revenue.toLocaleString()}</div>
                  <div className="text-xs text-success font-semibold font-mono mt-1">+12.5%</div>
                </div>

                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 sm:p-4 transform group-hover:scale-105 transition-all duration-300" style={{ transitionDelay: '50ms' }}>
                  <div className="flex items-center space-x-2 mb-2">
                    <Users className="w-4 h-4 text-brand-300" strokeWidth={1.5} />
                    <span className="text-xs font-semibold text-ink-3">Visitors</span>
                  </div>
                  <div className="font-display font-mono text-xl sm:text-2xl font-semibold text-ink-0">{visitors.toLocaleString()}</div>
                  <div className="text-xs text-brand-300 font-semibold font-mono mt-1">+8.2%</div>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 transform group-hover:scale-105 transition-all duration-300" style={{ transitionDelay: '100ms' }}>
                <LineChart
                  data={demoData}
                  height={140}
                  color="#1d6bff"
                  animate={true}
                />
              </div>

              <button className="mt-4 sm:mt-6 w-full py-3 px-6 text-base bg-gradient-to-r from-brand-500 via-accent-500 to-violet-500 text-white font-semibold rounded-xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-0">
                Explore Dashboard
              </button>
            </div>

            <div className="text-center text-xs text-ink-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-mono">
              Click to explore · Sign in required
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
