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
  Settings
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import HelpCenter from '../HelpCenter';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const managerMenuItems = [
  { path: '/dashboard', label: 'Analytics Dashboard', icon: LayoutDashboard },
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
  const { userRole } = useAuth();
  const [showHelpCenter, setShowHelpCenter] = useState(false);

  const menuItems = userRole === 'manager' ? managerMenuItems : employeeMenuItems;

  return (
    <>
      {showHelpCenter && <HelpCenter onClose={() => setShowHelpCenter(false)} />}

      <aside
        className={`
          w-64 bg-white border-r border-gray-200 flex flex-col fixed left-0 top-0 h-screen z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-teal-500 rounded-lg flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-900">ObservAI</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3">
          {userRole === 'employee' && (
            <div className="px-3 py-2 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee Portal</p>
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
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <button
              onClick={() => setShowHelpCenter(true)}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <HelpCircle className="w-5 h-5 text-gray-500" />
              <span>Help Center</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-lg p-4 border border-blue-200">
            <p className="text-xs font-bold text-gray-900 mb-1">
              Quick Tip
            </p>
            <p className="text-xs text-gray-600 mb-3">
              Click the Help Center button above for tutorials and FAQs
            </p>
            <button
              onClick={() => setShowHelpCenter(true)}
              className="w-full px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open Help Center
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
