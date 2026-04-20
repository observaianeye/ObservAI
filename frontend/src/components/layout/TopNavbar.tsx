import { Settings, User, ChevronDown, LogOut, Menu, Home, Calendar, Building2, Globe, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardFilter, DEFAULT_DATE_RANGES } from '../../contexts/DashboardFilterContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useState, useRef, useEffect } from 'react';
import type { Lang } from '../../i18n/strings';
import NotificationCenter from '../NotificationCenter';
import DataModeToggle from '../DataModeToggle';

interface TopNavbarProps {
  onMenuClick?: () => void;
}

export default function TopNavbar({ onMenuClick }: TopNavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, lang, setLang, languages } = useLanguage();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const { branches, selectedBranch, setSelectedBranch, dateRange, setDateRange } = useDashboardFilter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
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
    const branch = branches.find((b) => b.id === value);
    if (branch) setSelectedBranch(branch);
  };

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const days = parseInt(e.target.value);
    if (isNaN(days)) return;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateRange({ start, end, label: t('topbar.lastNDays', { n: days }) });
  };

  const currentDays = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));

  const handleLangChange = (next: Lang) => {
    setLang(next);
    setShowLangMenu(false);
  };

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.email || 'User';
  const initials = displayName
    .split(' ')
    .map((p) => p.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="h-16 bg-surface-1/85 backdrop-blur-xl border-b border-white/[0.06] fixed top-0 right-0 left-0 lg:left-64 z-20">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 lg:gap-3 flex-1 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-ink-3 hover:text-ink-0 hover:bg-white/5 rounded-lg transition-colors"
            aria-label={t('nav.openMenu')}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Branch selector */}
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-4 pointer-events-none" />
            <select
              value={selectedBranch?.id || ''}
              onChange={handleBranchChange}
              className="appearance-none pl-8 pr-8 py-2 bg-surface-2/70 border border-white/[0.08] rounded-xl text-xs lg:text-sm font-medium text-ink-1 hover:border-brand-500/40 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/60 transition-all backdrop-blur-sm"
            >
              {branches.length === 0 && (
                <option value="" className="bg-surface-2 text-ink-3">
                  {t('topbar.noBranches')}
                </option>
              )}
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-surface-2 text-ink-1">
                  {b.name} — {b.city}
                </option>
              ))}
              <option value="__add__" className="bg-surface-2 text-brand-300">
                {t('topbar.addBranch')}
              </option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-4 pointer-events-none" />
          </div>

          {/* Date range selector */}
          <div className="hidden sm:block relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-4 pointer-events-none" />
            <select
              value={currentDays}
              onChange={handleDateRangeChange}
              className="appearance-none pl-8 pr-8 py-2 bg-surface-2/70 border border-white/[0.08] rounded-xl text-xs lg:text-sm font-medium text-ink-1 hover:border-brand-500/40 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/60 transition-all backdrop-blur-sm"
            >
              {DEFAULT_DATE_RANGES.map((r) => (
                <option key={r.days} value={r.days} className="bg-surface-2 text-ink-1">
                  {t('topbar.lastNDays', { n: r.days })}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-4 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          <DataModeToggle />

          {/* Language switcher */}
          <div className="relative" ref={langMenuRef}>
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 text-ink-3 hover:text-ink-0 hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              aria-label={t('topbar.languageSwitch')}
              aria-haspopup="menu"
              aria-expanded={showLangMenu}
            >
              <Globe className="w-4 h-4" />
              <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em]">{lang}</span>
            </button>

            {showLangMenu && (
              <div
                role="menu"
                aria-label={t('topbar.selectLanguage')}
                className="absolute right-0 mt-2 w-44 surface-card-elevated py-1.5 overflow-hidden z-30"
              >
                <p className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-ink-4">
                  {t('topbar.selectLanguage')}
                </p>
                {languages.map((l) => {
                  const active = l.code === lang;
                  return (
                    <button
                      key={l.code}
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => handleLangChange(l.code)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-brand-500/10 text-brand-200'
                          : 'text-ink-2 hover:bg-white/[0.04] hover:text-ink-0'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span aria-hidden>{l.flag}</span>
                        <span className="font-medium">{l.name}</span>
                      </span>
                      {active && <Check className="w-4 h-4 text-brand-300" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <NotificationCenter />

          <button
            onClick={() => navigate('/dashboard/settings')}
            className="hidden md:flex p-2 text-ink-3 hover:text-ink-0 hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            aria-label={t('topbar.settings')}
          >
            <Settings className="w-5 h-5" />
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2.5 pl-3 border-l border-white/[0.08] hover:bg-white/[0.04] rounded-lg pr-2 py-1 transition-colors"
            >
              <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow-glow-brand">
                <span className="text-[11px] font-bold text-white tracking-wider">{initials || <User className="w-4 h-4" />}</span>
              </div>
              <div className="hidden md:block text-left leading-tight">
                <div className="text-sm font-semibold text-ink-0 max-w-[180px] truncate">{displayName}</div>
                <div className="text-[11px] text-ink-3 max-w-[180px] truncate">{user?.email || ''}</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-ink-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-60 surface-card-elevated py-2 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-sm font-semibold text-ink-0 truncate">{displayName}</p>
                  <p className="text-xs text-ink-3 truncate">{user?.email || ''}</p>
                  {user?.role && (
                    <span className="mt-2 inline-flex items-center pill bg-brand-500/12 border border-brand-500/25 text-brand-200 text-[10px] px-2 py-0.5 font-mono uppercase tracking-wider">
                      {user.role}
                    </span>
                  )}
                </div>
                <Link
                  to="/"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-2 hover:bg-white/[0.04] hover:text-ink-0 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  <span>{t('topbar.viewHomepage')}</span>
                </Link>
                <Link
                  to="/dashboard/settings"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-2 hover:bg-white/[0.04] hover:text-ink-0 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>{t('topbar.settings')}</span>
                </Link>
                <div className="my-1 h-px bg-white/[0.05]" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger-400 hover:bg-danger-500/10 hover:text-danger-300 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('topbar.logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
