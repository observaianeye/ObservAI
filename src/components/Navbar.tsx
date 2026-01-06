import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-sticky bg-gray-900/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2 group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-lg">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-teal-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-white">ObservAI</span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-6">
          <a href="#features" className="text-sm font-medium text-gray-300 hover:text-white transition-colors focus:outline-none focus:text-white">Features</a>
          <a href="#integrations" className="text-sm font-medium text-gray-300 hover:text-white transition-colors focus:outline-none focus:text-white">Integrations</a>
          <Link to="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors focus:outline-none focus:text-white">Login</Link>
          <Link
            to="/register"
            className="px-4 sm:px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            Get Demo
          </Link>
        </div>
      </div>
    </nav>
  );
}
