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
  Bell,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import HelpCenter from '../HelpCenter';
import Diagnostics from '../Diagnostics';
import markSvg from '../../assets/mark.svg';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

type MenuGroup = {
  labelKey: string;
  items: { path: string; labelKey: string; icon: React.ComponentType<{ className?: string }> }[];
};

const menuGroups: MenuGroup[] = [
  {
    labelKey: 'nav.izleme',
    items: [
      { path: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { path: '/dashboard/camera-selection', labelKey: 'nav.cameras', icon: Video },
      { path: '/dashboard/zone-labeling', labelKey: 'nav.zones', icon: Camera },
    ],
  },
  {
    labelKey: 'nav.operasyon',
    items: [
      { path: '/dashboard/tables', labelKey: 'nav.tables', icon: LayoutGrid },
      { path: '/dashboard/staffing', labelKey: 'nav.staffing', icon: Users },
    ],
  },
  {
    labelKey: 'nav.analiz',
    items: [
      { path: '/dashboard/trends', labelKey: 'nav.trends', icon: BarChart3 },
      { path: '/dashboard/ai-insights', labelKey: 'nav.aiInsights', icon: Sparkles },
      { path: '/dashboard/historical', labelKey: 'nav.historical', icon: TrendingUp },
    ],
  },
  {
    labelKey: 'nav.hesap',
    items: [
      { path: '/dashboard/notifications', labelKey: 'nav.notifications', icon: Bell },
      { path: '/dashboard/settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
];

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const userRole = user?.role?.toLowerCase() || 'manager';
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  return (
    <>
      {showHelpCenter && <HelpCenter onClose={() => setShowHelpCenter(false)} />}
      {showDiagnostics && <Diagnostics onClose={() => setShowDiagnostics(false)} />}

      <aside
        className={`
          w-64 bg-surface-1/85 backdrop-blur-xl border-r border-white/[0.06] flex flex-col fixed left-0 top-0 h-screen z-50
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Accent seam */}
        <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-brand-500/20 to-transparent" aria-hidden />

        <div className="h-16 flex items-center justify-between px-5 border-b border-white/[0.06] relative">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden ring-1 ring-white/10 shadow-glow-brand bg-surface-0 flex items-center justify-center">
              <img src={markSvg} alt="ObservAI" className="w-7 h-7 object-contain" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight text-ink-0">
              ObservAI
            </span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label={t('nav.closeMenu')}
          >
            <X className="w-5 h-5 text-ink-3" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-5 px-3 custom-scrollbar">
          {userRole === 'employee' && (
            <div className="px-3 py-1.5 mb-3 rounded-lg bg-brand-500/10 border border-brand-500/20">
              <p className="text-[10px] font-mono font-semibold text-brand-300 uppercase tracking-[0.18em]">
                {t('nav.employeePortal')}
              </p>
            </div>
          )}

          <div className="space-y-5">
            {menuGroups.map((group) => (
              <div key={group.labelKey}>
                <p className="px-3 mb-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-ink-4">
                  {t(group.labelKey)}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => onClose && onClose()}
                        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-brand-500/12 text-brand-200 border border-brand-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                            : 'text-ink-2 hover:bg-white/[0.04] hover:text-ink-0 border border-transparent'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r-full bg-gradient-to-b from-brand-400 to-accent-400 shadow-glow-brand" />
                        )}
                        <Icon
                          className={`w-[18px] h-[18px] transition-colors ${
                            isActive ? 'text-brand-300' : 'text-ink-3 group-hover:text-ink-1'
                          }`}
                        />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-white/[0.05]">
              <button
                onClick={() => setShowHelpCenter(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-2 hover:bg-white/[0.04] hover:text-ink-0 transition-colors border border-transparent"
              >
                <HelpCircle className="w-[18px] h-[18px] text-ink-3" />
                <span>{t('nav.helpCenter')}</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <div className="relative surface-card p-4 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-brand-500/10 blur-2xl pointer-events-none" aria-hidden />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-mono font-semibold text-ink-3 uppercase tracking-[0.18em]">
                  {t('nav.systemStatus')}
                </p>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-70" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success-400" />
                </span>
              </div>
              <p className="text-xs text-ink-2 mb-3">
                {t('nav.allOperational')}
              </p>
              <button
                onClick={() => setShowDiagnostics(true)}
                className="w-full px-3 py-2 bg-surface-2/70 border border-white/[0.08] text-ink-1 text-xs font-semibold rounded-lg hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-200 transition-all flex items-center justify-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5" />
                {t('nav.diagnostics')}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
