import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-sticky bg-surface-0/80 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2 group focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-0 rounded-lg">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-accent-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-glow-brand">
            <Camera className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="font-display text-xl font-semibold text-ink-0 tracking-tight">ObservAI</span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-6">
          <a href="#features" className="text-sm font-medium text-ink-3 hover:text-ink-0 transition-colors focus:outline-none focus:text-ink-0">Features</a>
          <a href="#integrations" className="text-sm font-medium text-ink-3 hover:text-ink-0 transition-colors focus:outline-none focus:text-ink-0">Integrations</a>
          <Link to="/login" className="text-sm font-medium text-ink-3 hover:text-ink-0 transition-colors focus:outline-none focus:text-ink-0">Login</Link>
          <Link
            to="/register"
            className="px-4 sm:px-6 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white text-sm font-semibold rounded-xl hover:shadow-glow-brand transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-0"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
