import { Settings, User, ChevronDown, LogOut, Menu, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardFilter, DEFAULT_DATE_RANGES } from '../../contexts/DashboardFilterContext';
import { useState, useRef, useEffect } from 'react';
import NotificationCenter from '../NotificationCenter';
import DataModeToggle from '../DataModeToggle';

interface TopNavbarProps {
  onMenuClick?: () => void;
}

export default function TopNavbar({ onMenuClick }: TopNavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { branches, selectedBranch, setSelectedBranch, dateRange, setDateRange } = useDashboardFilter();

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

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__add__') {
      navigate('/dashboard/settings');
      return;
    }
    const branch = branches.find(b => b.id === value);
    if (branch) setSelectedBranch(branch);
  };

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const days = parseInt(e.target.value);
    if (isNaN(days)) return;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    const match = DEFAULT_DATE_RANGES.find(r => r.days === days);
    setDateRange({ start, end, label: match?.label || `Last ${days} days` });
  };

  const currentDays = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));

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

          {/* Branch selector - dynamic */}
          <select
            value={selectedBranch?.id || ''}
            onChange={handleBranchChange}
            className="px-2 lg:px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs lg:text-sm font-medium text-gray-300 hover:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all backdrop-blur-sm"
          >
            {branches.length === 0 && (
              <option value="" className="bg-[#0a0b10] text-gray-500">No branches</option>
            )}
            {branches.map(b => (
              <option key={b.id} value={b.id} className="bg-[#0a0b10] text-gray-300">
                {b.name} — {b.city}
              </option>
            ))}
            <option value="__add__" className="bg-[#0a0b10] text-blue-400">+ Add Branch</option>
          </select>

          {/* Date range selector - functional */}
          <select
            value={currentDays}
            onChange={handleDateRangeChange}
            className="hidden sm:block px-2 lg:px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs lg:text-sm font-medium text-gray-300 hover:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all backdrop-blur-sm"
          >
            {DEFAULT_DATE_RANGES.map(r => (
              <option key={r.days} value={r.days} className="bg-[#0a0b10] text-gray-300">
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2 lg:space-x-4">
          <DataModeToggle />

          <NotificationCenter />

          <button
            onClick={() => navigate('/dashboard/settings')}
            className="hidden md:flex p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
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
                <div className="text-sm font-medium text-white">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.firstName || user?.email || 'User'}
                </div>
                <div className="text-xs text-gray-400">{user?.email || ''}</div>
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
