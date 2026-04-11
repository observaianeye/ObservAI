import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Sparkles,
  Camera,
  Video,
  HelpCircle,
  X,
  Settings,
  Activity,
  LayoutGrid,
  BarChart3,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import HelpCenter from '../HelpCenter';
import Diagnostics from '../Diagnostics';
import logoImage from '../../assets/logo.jpeg';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const managerMenuItems = [
  { path: '/dashboard', label: 'Analytics Dashboard', icon: LayoutDashboard },
  { path: '/dashboard/tables', label: 'Masa Durumu', icon: LayoutGrid },
  { path: '/dashboard/trends', label: 'Trend Analizi', icon: BarChart3 },
  { path: '/dashboard/staffing', label: 'Personel Planlama', icon: Users },
  { path: '/dashboard/zone-labeling', label: 'Zone Labeling', icon: Camera },
  { path: '/dashboard/camera-selection', label: 'Camera Selection', icon: Video },
  { path: '/dashboard/ai-insights', label: 'AI Insights', icon: Sparkles },
  { path: '/dashboard/historical', label: 'Historical Data', icon: TrendingUp },
  { path: '/dashboard/notifications', label: 'Notifications', icon: HelpCircle },
  { path: '/dashboard/settings', label: 'Settings', icon: Settings }
];

const employeeMenuItems = managerMenuItems;

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || 'manager';
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const menuItems = userRole === 'manager' ? managerMenuItems : employeeMenuItems;

  return (
    <>
      {showHelpCenter && <HelpCenter onClose={() => setShowHelpCenter(false)} />}
      {showDiagnostics && <Diagnostics onClose={() => setShowDiagnostics(false)} />}

      <aside
        className={`
          w-64 bg-[#0a0b10]/90 backdrop-blur-xl border-r border-white/10 flex flex-col fixed left-0 top-0 h-screen z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)] overflow-hidden">
              <img 
                src={logoImage} 
                alt="ObservAI Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">ObservAI</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3">
          {userRole === 'employee' && (
            <div className="px-3 py-2 mb-4">
              <p className="text-xs font-mono font-semibold text-blue-400 uppercase tracking-wider">Employee Portal</p>
            </div>
          )}

          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => onClose && onClose()}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                    ? 'bg-blue-500/10 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)] border border-blue-500/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <button
              onClick={() => setShowHelpCenter(true)}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <HelpCircle className="w-5 h-5 text-gray-500" />
              <span>Help Center</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-lg p-4 border border-white/10 backdrop-blur-sm">
            <p className="text-xs font-bold text-white mb-1 font-mono">
              SYSTEM STATUS
            </p>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-xs text-gray-400">All Systems Operational</p>
            </div>
            <button
              onClick={() => setShowDiagnostics(true)}
              className="w-full px-3 py-2 bg-blue-600/20 border border-blue-500/50 text-blue-400 text-xs font-semibold rounded-lg hover:bg-blue-600/30 transition-all hover:shadow-[0_0_15px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2"
            >
              <Activity className="w-3 h-3" />
              Diagnostics
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
