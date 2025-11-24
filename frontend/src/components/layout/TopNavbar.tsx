import { Settings, User, ChevronDown, LogOut, Menu } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';
import NotificationCenter from '../NotificationCenter';
import DataModeToggle from '../DataModeToggle';

interface TopNavbarProps {
  onMenuClick?: () => void;
}

export default function TopNavbar({ onMenuClick }: TopNavbarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-[#0a0b10]/95 backdrop-blur-xl border-b border-white/10 fixed top-0 right-0 left-0 lg:left-64 z-20">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between">
        <div className="flex items-center space-x-2 lg:space-x-4 flex-1">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          <select className="px-2 lg:px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs lg:text-sm font-medium text-gray-300 hover:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all backdrop-blur-sm">
            <option className="bg-[#0a0b10] text-gray-300">Ankara Downtown</option>
            <option className="bg-[#0a0b10] text-gray-300">Istanbul Central</option>
            <option className="bg-[#0a0b10] text-gray-300">Izmir Marina</option>
          </select>

          <select className="hidden sm:block px-2 lg:px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs lg:text-sm font-medium text-gray-300 hover:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all backdrop-blur-sm">
            <option className="bg-[#0a0b10] text-gray-300">Last 30 days</option>
            <option className="bg-[#0a0b10] text-gray-300">Last 7 days</option>
            <option className="bg-[#0a0b10] text-gray-300">Last 90 days</option>
            <option className="bg-[#0a0b10] text-gray-300">Custom range</option>
          </select>
        </div>

        <div className="flex items-center space-x-2 lg:space-x-4">
          <DataModeToggle />

          <NotificationCenter />

          <button className="hidden md:flex p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <Settings className="w-5 h-5" />
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-3 pl-4 border-l border-white/10 hover:bg-white/5 rounded-lg px-3 py-1 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(37,99,235,0.5)]">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium text-white">Admin User</div>
                <div className="text-xs text-gray-400">admin@observai.com</div>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-[#0a0b10]/90 backdrop-blur-xl rounded-lg border border-white/10 shadow-2xl py-2">
                <Link
                  to="/"
                  className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span>View Homepage</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
