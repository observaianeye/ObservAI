import { useState, useEffect } from 'react';
import { Bell, X, AlertCircle, TrendingDown, Camera, Package, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface Alert {
  id: string;
  date: string;
  source: string;
  severity: 'high' | 'medium' | 'low';
  category: 'sales' | 'camera' | 'inventory' | 'labor';
  message: string;
  link: string;
  acknowledged: boolean;
}

const demoAlerts: Alert[] = [
  {
    id: '1',
    date: '2 hours ago',
    source: 'Spend Analytics',
    severity: 'high',
    category: 'inventory',
    message: 'Material cost variance detected in Milk (+15% over budget)',
    link: '/dashboard/spend',
    acknowledged: false
  },
  {
    id: '2',
    date: '3 hours ago',
    source: 'Camera System',
    severity: 'medium',
    category: 'camera',
    message: 'Queue time > 3 min between 14:00–16:00 at counter',
    link: '/dashboard/camera',
    acknowledged: false
  },
  {
    id: '3',
    date: '5 hours ago',
    source: 'Inventory',
    severity: 'high',
    category: 'inventory',
    message: 'Low stock: Oat Milk < 15% (reorder recommended)',
    link: '/dashboard/inventory',
    acknowledged: false
  },
  {
    id: '4',
    date: '1 day ago',
    source: 'Sales',
    severity: 'medium',
    category: 'sales',
    message: 'AOV decreased by 8% compared to last week',
    link: '/dashboard/sales',
    acknowledged: false
  },
  {
    id: '5',
    date: '1 day ago',
    source: 'Labor',
    severity: 'low',
    category: 'labor',
    message: 'Overtime hours exceeded 15% for 2 staff members',
    link: '/dashboard/labor',
    acknowledged: false
  }
];

const categoryIcons = {
  sales: TrendingDown,
  camera: Camera,
  inventory: Package,
  labor: Users
};

const severityColors = {
  high: { bg: 'bg-danger-500/10', text: 'text-danger-300', border: 'border-danger-500/30' },
  medium: { bg: 'bg-warning-500/10', text: 'text-warning-300', border: 'border-warning-500/30' },
  low: { bg: 'bg-brand-500/10', text: 'text-brand-300', border: 'border-brand-500/30' }
};

export default function GlobalAlerts() {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'sales' | 'camera' | 'inventory' | 'labor'>('all');
  const [alerts, setAlerts] = useState<Alert[]>(demoAlerts);
  const isDashboard = location.pathname.startsWith('/dashboard');
  const shouldShow = isAuthenticated && isDashboard;


  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleAcknowledge = (id: string) => {
    setAlerts(alerts.map(alert =>
      alert.id === id ? { ...alert, acknowledged: true } : alert
    ));
  };

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  const filteredAlerts = activeTab === 'all'
    ? alerts
    : alerts.filter(alert => alert.category === activeTab);

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  if (!shouldShow) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={handleClick}
          className="fixed bottom-24 right-4 z-50 w-14 h-14 bg-gradient-to-br from-brand-500 to-accent-500 text-white rounded-full shadow-glow-brand hover:shadow-glow-brand-strong transition-all flex items-center justify-center cursor-pointer"
          aria-label={t('alerts.label')}
        >
          <Bell className="w-6 h-6" strokeWidth={1.5} />
          {unacknowledgedCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger-500 text-white text-xs font-semibold rounded-full flex items-center justify-center font-mono">
              {unacknowledgedCount}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            role="dialog"
            aria-label={t('alerts.panel')}
            className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-surface-1/90 backdrop-blur-xl shadow-2xl border-l border-white/[0.08] z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-brand-300" strokeWidth={1.5} />
                <h2 className="font-display text-lg font-semibold text-ink-0">{t('alerts.title')}</h2>
                {unacknowledgedCount > 0 && (
                  <span className="px-2 py-0.5 bg-danger-500/15 text-danger-300 text-xs font-semibold rounded-full border border-danger-500/30 font-mono">
                    {unacknowledgedCount} {t('alerts.new')}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-ink-4 hover:text-ink-0 hover:bg-white/[0.04] rounded-lg transition-colors"
                aria-label={t('alerts.close')}
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex space-x-1 p-3 border-b border-white/[0.08] overflow-x-auto custom-scrollbar">
              {(['all', 'sales', 'camera', 'inventory', 'labor'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-xl transition-colors whitespace-nowrap ${activeTab === tab
                    ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30'
                    : 'text-ink-4 hover:bg-white/[0.04] hover:text-ink-1 border border-transparent'
                    }`}
                >
                  {t(`alerts.tab.${tab}`)}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-ink-4 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-sm text-ink-4">{t('alerts.empty')}</p>
                </div>
              ) : (
                filteredAlerts.map(alert => {
                  const Icon = categoryIcons[alert.category];
                  const colors = severityColors[alert.severity];

                  return (
                    <div
                      key={alert.id}
                      className={`border rounded-xl p-4 ${colors.border} ${colors.bg} ${alert.acknowledged ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center border ${colors.border}`}>
                            <Icon className={`w-4 h-4 ${colors.text}`} strokeWidth={1.5} />
                          </div>
                          <span className={`px-2 py-0.5 ${colors.bg} ${colors.text} text-xs font-medium rounded-lg border ${colors.border}`}>
                            {alert.source}
                          </span>
                        </div>
                        <span className="text-xs text-ink-4 font-mono">{alert.date}</span>
                      </div>

                      <p className="text-sm text-ink-1 mb-3">{alert.message}</p>

                      <div className="flex items-center space-x-2">
                        <Link
                          to={alert.link}
                          onClick={() => setIsOpen(false)}
                          className="flex-1 px-3 py-1.5 bg-white/[0.04] text-ink-1 text-xs font-medium rounded-lg border border-white/[0.08] hover:bg-white/[0.08] transition-colors text-center"
                        >
                          {t('alerts.viewDetails')}
                        </Link>
                        {!alert.acknowledged && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            className="px-3 py-1.5 bg-brand-500/15 text-brand-300 text-xs font-medium rounded-lg border border-brand-500/30 hover:bg-brand-500/25 transition-colors"
                          >
                            {t('alerts.acknowledge')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
