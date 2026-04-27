import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle, X, CheckCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useLanguage } from '../contexts/LanguageContext';
import { useDashboardFilter } from '../contexts/DashboardFilterContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  cameraId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTimeAgo(t: (key: string, vars?: Record<string, string | number>) => string) {
  return (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t('common.justNow');
    if (diffMin < 60) return t('common.minutesAgo', { n: diffMin });
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return t('common.hoursAgo', { n: diffHour });
    const diffDay = Math.floor(diffHour / 24);
    return t('common.daysAgo', { n: diffDay });
  };
}

const SEVERITY_STYLES: Record<string, { icon: any; bg: string; text: string; ring: string }> = {
  critical: { icon: AlertCircle, bg: 'bg-danger-500/10', text: 'text-danger-400', ring: 'ring-danger-500/30' },
  high: { icon: AlertTriangle, bg: 'bg-warning-500/10', text: 'text-warning-400', ring: 'ring-warning-500/30' },
  medium: { icon: Info, bg: 'bg-accent-500/10', text: 'text-accent-300', ring: 'ring-accent-500/30' },
  low: { icon: CheckCircle, bg: 'bg-success-500/10', text: 'text-success-400', ring: 'ring-success-500/30' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { selectedBranch } = useDashboardFilter();
  const timeAgo = makeTimeAgo(t);

  // ─── Fetch Notifications ──────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    try {
      const branchQs = selectedBranch ? `&branchId=${encodeURIComponent(selectedBranch.id)}` : '';
      const res = await fetch(`${API_URL}/api/insights?limit=10${branchQs}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.insights || []);
      }
    } catch {
      // Use demo data on error
      setNotifications(getDemoNotifications(t));
    }
  }, [t, selectedBranch?.id]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const branchQs = selectedBranch ? `?branchId=${encodeURIComponent(selectedBranch.id)}` : '';
      const res = await fetch(`${API_URL}/api/insights/unread-count${branchQs}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      setUnreadCount(getDemoNotifications(t).filter(n => !n.isRead).length);
    }
  }, [t, selectedBranch?.id]);

  // ─── Initialize ────────────────────────────────────────────────────────

  useEffect(() => {
    fetchUnreadCount();

    // Poll unread count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    // Socket.IO for real-time updates
    try {
      const socket = io(WS_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 5000,
      });

      socket.on('zone_alert', () => {
        setUnreadCount(prev => prev + 1);
        // If panel is open, refresh the list
        if (isOpen) fetchNotifications();
      });

      socketRef.current = socket;
    } catch {
      // Socket not available
    }

    return () => {
      clearInterval(interval);
      socketRef.current?.disconnect();
    };
  }, [fetchUnreadCount, fetchNotifications, isOpen]);

  // ─── Open Panel → Fetch Full List ──────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  }, [isOpen, fetchNotifications]);

  // ─── Actions ──────────────────────────────────────────────────────────

  const markAsRead = async (id: string) => {
    if (id.startsWith('demo-')) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      return;
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      const res = await fetch(`${API_URL}/api/insights/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      fetchUnreadCount();
    } catch {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: false } : n));
      setUnreadCount(prev => prev + 1);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length === 0) return;
    const previous = notifications;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);

    const results = await Promise.allSettled(
      unreadIds
        .filter(id => !id.startsWith('demo-'))
        .map(id =>
          fetch(`${API_URL}/api/insights/${id}/read`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }).then(r => {
            if (!r.ok) throw new Error(`status ${r.status}`);
          })
        )
    );

    if (results.some(r => r.status === 'rejected')) {
      setNotifications(previous);
    }
    fetchUnreadCount();
  };

  const goToNotificationsPage = () => {
    setIsOpen(false);
    navigate('/dashboard/notifications');
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const getIcon = (severity: string) => {
    const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.low;
    const Icon = style.icon;
    return (
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.bg} ring-1 ${style.ring}`}>
        <Icon className={`w-4 h-4 ${style.text}`} />
      </div>
    );
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-ink-3 hover:text-ink-0 hover:bg-white/[0.04] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        aria-label={t('notif.ariaOpen')}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-gradient-to-br from-danger-500 to-warning-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.45)] ring-2 ring-surface-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-96 surface-card-elevated z-50 max-h-[520px] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <div>
                <h3 className="text-sm font-semibold text-ink-0">{t('notif.title')}</h3>
                <p className="text-[11px] text-ink-3 mt-0.5">
                  {unreadCount > 0 ? `${unreadCount} ${t('notif.unreadSuffix')}` : t('notif.allRead')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[10px] font-semibold text-brand-300 hover:text-brand-200 transition-colors flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3" />
                    {t('notif.markAllRead')}
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-ink-4 hover:text-ink-0 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="p-10 text-center">
                  <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-surface-2/70 border border-white/[0.08] flex items-center justify-center mb-3">
                    <Bell className="w-5 h-5 text-ink-4" />
                  </div>
                  <p className="text-sm text-ink-3">{t('notif.empty')}</p>
                  <p className="text-xs text-ink-4 mt-1">{t('notif.emptySubtitle')}</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => !notification.isRead && markAsRead(notification.id)}
                      className={`p-3.5 cursor-pointer hover:bg-white/[0.04] transition-colors ${
                        notification.isRead ? '' : 'bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">{getIcon(notification.severity)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <p
                              className={`text-xs font-semibold truncate ${
                                notification.isRead ? 'text-ink-3' : 'text-ink-0'
                              }`}
                            >
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <div className="w-1.5 h-1.5 bg-brand-400 rounded-full flex-shrink-0 mt-1 animate-pulse" />
                            )}
                          </div>
                          <p
                            className={`text-xs leading-relaxed line-clamp-2 ${
                              notification.isRead ? 'text-ink-4' : 'text-ink-2'
                            }`}
                          >
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-ink-4 mt-1 font-mono uppercase tracking-wider">
                            {timeAgo(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-white/[0.06] bg-surface-1/40">
              <button
                onClick={goToNotificationsPage}
                className="w-full py-2 text-xs font-semibold text-brand-300 hover:text-brand-200 transition-colors flex items-center justify-center gap-1.5 rounded-lg hover:bg-white/[0.04]"
              >
                {t('notif.viewAll')}
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Demo Data ───────────────────────────────────────────────────────────────

function getDemoNotifications(t: (key: string, vars?: Record<string, string | number>) => string): Notification[] {
  const now = new Date();
  return [
    {
      id: 'demo-1',
      cameraId: 'cam-01',
      type: 'crowd_surge',
      severity: 'critical',
      title: t('notif.demo.surgeTitle'),
      message: t('notif.demo.surgeBody'),
      isRead: false,
      createdAt: new Date(now.getTime() - 3 * 60000).toISOString(),
    },
    {
      id: 'demo-2',
      cameraId: 'cam-01',
      type: 'occupancy_alert',
      severity: 'high',
      title: t('notif.demo.occupancyTitle'),
      message: t('notif.demo.occupancyBody'),
      isRead: false,
      createdAt: new Date(now.getTime() - 8 * 60000).toISOString(),
    },
    {
      id: 'demo-3',
      cameraId: 'cam-01',
      type: 'trend',
      severity: 'medium',
      title: t('notif.demo.trendTitle'),
      message: t('notif.demo.trendBody'),
      isRead: false,
      createdAt: new Date(now.getTime() - 25 * 60000).toISOString(),
    },
    {
      id: 'demo-4',
      cameraId: 'cam-01',
      type: 'demographic_trend',
      severity: 'low',
      title: t('notif.demo.demographicTitle'),
      message: t('notif.demo.demographicBody'),
      isRead: true,
      createdAt: new Date(now.getTime() - 60 * 60000).toISOString(),
    },
  ];
}
