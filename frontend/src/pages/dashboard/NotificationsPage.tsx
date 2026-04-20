import {
  Bell,
  BellOff,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Trash2,
  Check,
  CheckCheck,
  Filter,
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  TrendingUp,
  Users,
  Eye,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useLanguage } from '../../contexts/LanguageContext';

interface Notification {
  id: string;
  cameraId: string;
  zoneId: string | null;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  context: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationPreferences {
  enableSound: boolean;
  enableDesktop: boolean;
  severityFilter: ('low' | 'medium' | 'high' | 'critical')[];
  typeFilter: string[];
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

type FilterType = 'all' | 'unread' | 'critical' | 'high' | 'medium' | 'low';
type SortType = 'newest' | 'oldest' | 'severity';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enableSound: true,
  enableDesktop: true,
  severityFilter: ['low', 'medium', 'high', 'critical'],
  typeFilter: [],
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API Error ${res.status}: ${await res.text()}`);
  return res.json();
}

const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-danger-500/10',
    border: 'border-danger-500/30',
    text: 'text-danger-300',
    badge: 'bg-danger-500/20 text-danger-200 border-danger-500/30',
    icon: AlertCircle,
    labelKey: 'notif.sev.critical',
    priority: 4,
  },
  high: {
    bg: 'bg-warning-500/10',
    border: 'border-warning-500/30',
    text: 'text-warning-300',
    badge: 'bg-warning-500/20 text-warning-200 border-warning-500/30',
    icon: AlertTriangle,
    labelKey: 'notif.sev.high',
    priority: 3,
  },
  medium: {
    bg: 'bg-warning-500/10',
    border: 'border-warning-500/30',
    text: 'text-warning-300',
    badge: 'bg-warning-500/20 text-warning-200 border-warning-500/30',
    icon: Info,
    labelKey: 'notif.sev.medium',
    priority: 2,
  },
  low: {
    bg: 'bg-brand-500/10',
    border: 'border-brand-500/30',
    text: 'text-brand-300',
    badge: 'bg-brand-500/20 text-brand-200 border-brand-500/30',
    icon: CheckCircle,
    labelKey: 'notif.sev.low',
    priority: 1,
  },
} as const;

const TYPE_ICONS: Record<string, any> = {
  crowd_surge: Zap,
  occupancy_alert: Users,
  wait_time_alert: Clock,
  trend: TrendingUp,
  demographic_trend: Users,
  recommendation: Sparkles,
};

function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
  expanded,
  onToggleExpand,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { t, lang } = useLanguage();
  const config = SEVERITY_CONFIG[notification.severity] || SEVERITY_CONFIG.low;
  const SeverityIcon = config.icon;
  const TypeIcon = TYPE_ICONS[notification.type] || Info;

  const typeLabelKey = `notif.typeLabel.${notification.type}`;
  const typeLabel = t(typeLabelKey) === typeLabelKey
    ? notification.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    : t(typeLabelKey);

  const timeAgo = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t('notif.page.justNow');
    if (diffMin < 60) return t('notif.page.minAgo', { n: diffMin });
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return t('notif.page.hourAgo', { n: diffHour });
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return t('notif.page.dayAgo', { n: diffDay });
    return date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US');
  };

  return (
    <div
      className={`rounded-xl border transition-colors duration-180 ${
        notification.isRead
          ? 'bg-white/[0.02] border-white/[0.06] opacity-70'
          : `${config.bg} ${config.border}`
      } hover:border-white/[0.14]`}
    >
      <div
        className="p-4 cursor-pointer flex items-start gap-4"
        onClick={onToggleExpand}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          notification.isRead ? 'bg-white/[0.05]' : config.bg
        }`}>
          <SeverityIcon className={`w-5 h-5 ${notification.isRead ? 'text-ink-4' : config.text}`} strokeWidth={1.5} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className={`font-display text-sm font-semibold ${
              notification.isRead ? 'text-ink-3' : 'text-ink-0'
            }`}>
              {notification.title}
            </h3>
            {!notification.isRead && (
              <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0 animate-pulse" />
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${config.badge}`}>
              {t(config.labelKey)}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-ink-3 border border-white/[0.08]">
              <TypeIcon className="w-3 h-3 inline mr-1" strokeWidth={1.5} />
              {typeLabel}
            </span>
          </div>
          <p className={`text-sm leading-relaxed ${
            notification.isRead ? 'text-ink-4' : 'text-ink-2'
          }`}>
            {notification.message}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-ink-4 font-mono">
              <Clock className="w-3 h-3 inline mr-1" strokeWidth={1.5} />
              {timeAgo(notification.createdAt)}
            </span>
            {notification.cameraId && (
              <span className="text-xs text-ink-4 font-mono">
                {t('notif.page.cameraLabel', { id: notification.cameraId.slice(0, 8) })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!notification.isRead && (
            <button
              onClick={e => { e.stopPropagation(); onMarkRead(notification.id); }}
              className="p-2 text-ink-4 hover:text-brand-300 hover:bg-brand-500/10 rounded-lg transition-colors"
              title={t('notif.page.markRead')}
            >
              <Check className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete(notification.id); }}
            className="p-2 text-ink-4 hover:text-danger-300 hover:bg-danger-500/10 rounded-lg transition-colors"
            title={t('notif.page.delete')}
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-ink-4" strokeWidth={1.5} />
          ) : (
            <ChevronDown className="w-4 h-4 text-ink-4" strokeWidth={1.5} />
          )}
        </div>
      </div>

      {expanded && notification.context && (
        <div className="px-4 pb-4 pt-0 ml-14">
          <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.08]">
            <h4 className="text-xs font-semibold text-ink-3 mb-2 uppercase tracking-wider">{t('notif.page.details')}</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(notification.context).map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="text-ink-4">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                  <span className="text-ink-2 font-medium font-mono">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreferencesPanel({
  prefs,
  onUpdate,
  onClose,
}: {
  prefs: NotificationPreferences;
  onUpdate: (p: NotificationPreferences) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [local, setLocal] = useState(prefs);

  const toggleSeverity = (sev: 'low' | 'medium' | 'high' | 'critical') => {
    setLocal(prev => ({
      ...prev,
      severityFilter: prev.severityFilter.includes(sev)
        ? prev.severityFilter.filter(s => s !== sev)
        : [...prev.severityFilter, sev],
    }));
  };

  const save = () => {
    onUpdate(local);
    onClose();
  };

  return (
    <div className="surface-card rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-ink-0 flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-400" strokeWidth={1.5} />
          {t('notif.prefs.title')}
        </h3>
        <button onClick={onClose} className="text-ink-4 hover:text-ink-0 text-sm transition-colors">{t('notif.prefs.close')}</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] cursor-pointer hover:border-white/[0.14] transition-colors">
          <input
            type="checkbox"
            checked={local.enableSound}
            onChange={() => setLocal(p => ({ ...p, enableSound: !p.enableSound }))}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500/50"
          />
          <Volume2 className="w-4 h-4 text-ink-3" strokeWidth={1.5} />
          <span className="text-sm text-ink-2">{t('notif.prefs.sound')}</span>
        </label>
        <label className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] cursor-pointer hover:border-white/[0.14] transition-colors">
          <input
            type="checkbox"
            checked={local.enableDesktop}
            onChange={() => setLocal(p => ({ ...p, enableDesktop: !p.enableDesktop }))}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500/50"
          />
          <Bell className="w-4 h-4 text-ink-3" strokeWidth={1.5} />
          <span className="text-sm text-ink-2">{t('notif.prefs.desktop')}</span>
        </label>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-ink-3 mb-2">{t('notif.prefs.severityFilter')}</h4>
        <div className="flex flex-wrap gap-2">
          {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
            const c = SEVERITY_CONFIG[sev];
            const active = local.severityFilter.includes(sev);
            return (
              <button
                key={sev}
                onClick={() => toggleSeverity(sev)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  active ? c.badge : 'bg-white/[0.04] text-ink-4 border-white/[0.08]'
                }`}
              >
                {t(c.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
        <label className="flex items-center gap-3 cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={local.quietHoursEnabled}
            onChange={() => setLocal(p => ({ ...p, quietHoursEnabled: !p.quietHoursEnabled }))}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500/50"
          />
          <BellOff className="w-4 h-4 text-ink-3" strokeWidth={1.5} />
          <span className="text-sm text-ink-2">{t('notif.prefs.quietHours')}</span>
        </label>
        {local.quietHoursEnabled && (
          <div className="flex items-center gap-3 ml-7">
            <input
              type="time"
              value={local.quietHoursStart}
              onChange={e => setLocal(p => ({ ...p, quietHoursStart: e.target.value }))}
              className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-ink-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50 font-mono"
            />
            <span className="text-ink-4 text-sm">{t('notif.prefs.to')}</span>
            <input
              type="time"
              value={local.quietHoursEnd}
              onChange={e => setLocal(p => ({ ...p, quietHoursEnd: e.target.value }))}
              className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-ink-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50 font-mono"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm text-ink-3 hover:text-ink-0 hover:bg-white/[0.04] transition-colors"
        >
          {t('notif.prefs.cancel')}
        </button>
        <button
          onClick={save}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-brand-500 to-accent-500 hover:shadow-glow-brand transition-all"
        >
          {t('notif.prefs.save')}
        </button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    try {
      const saved = localStorage.getItem('observai_notification_prefs');
      return saved ? JSON.parse(saved) : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });
  const socketRef = useRef<Socket | null>(null);

  const getDemoNotifications = useCallback((): Notification[] => {
    const now = new Date();
    return [
      {
        id: 'demo-1',
        cameraId: 'cam-ankara-01',
        zoneId: 'entrance',
        type: 'crowd_surge',
        severity: 'critical',
        title: t('notif.demoTitle.crowd_surge'),
        message: t('notif.demoMsg.crowd_surge'),
        context: { avgEntriesLastHour: 5.4, avgEntriesLast5Min: 12.5, surgeRatio: 2.3 },
        isRead: false,
        createdAt: new Date(now.getTime() - 3 * 60000).toISOString(),
      },
      {
        id: 'demo-2',
        cameraId: 'cam-ankara-01',
        zoneId: null,
        type: 'occupancy_alert',
        severity: 'high',
        title: t('notif.demoTitle.occupancy_alert'),
        message: t('notif.demoMsg.occupancy_alert'),
        context: { currentCount: 46, capacity: 50, occupancyPct: 92 },
        isRead: false,
        createdAt: new Date(now.getTime() - 8 * 60000).toISOString(),
      },
      {
        id: 'demo-3',
        cameraId: 'cam-ankara-01',
        zoneId: null,
        type: 'trend',
        severity: 'medium',
        title: t('notif.demoTitle.trend'),
        message: t('notif.demoMsg.trend'),
        context: { peakHour: 14, avgOccupancy: 38.5 },
        isRead: false,
        createdAt: new Date(now.getTime() - 25 * 60000).toISOString(),
      },
      {
        id: 'demo-4',
        cameraId: 'cam-ankara-01',
        zoneId: null,
        type: 'demographic_trend',
        severity: 'low',
        title: t('notif.demoTitle.demographic_trend'),
        message: t('notif.demoMsg.demographic_trend'),
        context: { dominantGender: 'male', dominantAgeGroup: '25-34', genderDistribution: { male: 65, female: 35 } },
        isRead: true,
        createdAt: new Date(now.getTime() - 60 * 60000).toISOString(),
      },
      {
        id: 'demo-5',
        cameraId: 'cam-ankara-01',
        zoneId: 'checkout',
        type: 'wait_time_alert',
        severity: 'high',
        title: t('notif.demoTitle.wait_time_alert'),
        message: t('notif.demoMsg.wait_time_alert'),
        context: { avgWaitTime: 480, waitMinutes: 8, queueCount: 12 },
        isRead: true,
        createdAt: new Date(now.getTime() - 90 * 60000).toISOString(),
      },
      {
        id: 'demo-6',
        cameraId: 'cam-ankara-01',
        zoneId: null,
        type: 'recommendation',
        severity: 'low',
        title: t('notif.demoTitle.recommendation'),
        message: t('notif.demoMsg.recommendation'),
        context: { source: 'gemini', totalVisitors: 234 },
        isRead: true,
        createdAt: new Date(now.getTime() - 120 * 60000).toISOString(),
      },
    ];
  }, [t]);

  const fetchNotifications = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await fetchJSON<{ insights: Notification[]; total: number }>(
        '/api/insights?limit=100'
      );
      setNotifications(data.insights || []);

      const unreadData = await fetchJSON<{ unreadCount: number }>('/api/insights/unread-count');
      setUnreadCount(unreadData.unreadCount);
    } catch (err) {
      console.error('[Notifications] Fetch error:', err);
      const demo = getDemoNotifications();
      setNotifications(demo);
      setUnreadCount(demo.filter(n => !n.isRead).length);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getDemoNotifications]);

  useEffect(() => {
    fetchNotifications();

    try {
      const socket = io(WS_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 3000,
      });

      socket.on('zone_alert', (data: any) => {
        const newNotification: Notification = {
          id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          cameraId: data.cameraId || 'unknown',
          zoneId: data.zoneId || null,
          type: data.type || 'occupancy_alert',
          severity: data.severity || 'medium',
          title: data.title || 'Zone Alert',
          message: data.message || 'A zone alert was triggered.',
          context: data.context || null,
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        setNotifications(prev => [newNotification, ...prev]);
        setUnreadCount(prev => prev + 1);

        if (preferences.enableSound) {
          try {
            const audioCtx = new AudioContext();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = data.severity === 'critical' ? 880 : 660;
            gain.gain.value = 0.1;
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
          } catch { /* audio not available */ }
        }
      });

      socketRef.current = socket;
    } catch {
      console.warn('[Notifications] Socket.IO connection failed');
    }

    return () => {
      socketRef.current?.disconnect();
    };
  }, [fetchNotifications, preferences.enableSound]);

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await fetchJSON(`/api/insights/${id}/read`, { method: 'PATCH' });
    } catch {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: false } : n));
      setUnreadCount(prev => prev + 1);
    }
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    for (const id of unreadIds) {
      try {
        await fetchJSON(`/api/insights/${id}/read`, { method: 'PATCH' });
      } catch { /* continue */ }
    }
  };

  const deleteNotification = async (id: string) => {
    const was = notifications.find(n => n.id === id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (was && !was.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await fetchJSON(`/api/insights/${id}`, { method: 'DELETE' });
    } catch {
      if (was) {
        setNotifications(prev => [was, ...prev]);
        if (!was.isRead) setUnreadCount(prev => prev + 1);
      }
    }
  };

  const updatePreferences = (newPrefs: NotificationPreferences) => {
    setPreferences(newPrefs);
    localStorage.setItem('observai_notification_prefs', JSON.stringify(newPrefs));
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'critical') return n.severity === 'critical';
    if (filter === 'high') return n.severity === 'high';
    if (filter === 'medium') return n.severity === 'medium';
    if (filter === 'low') return n.severity === 'low';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortBy === 'severity') {
      return (SEVERITY_CONFIG[b.severity]?.priority || 0) - (SEVERITY_CONFIG[a.severity]?.priority || 0);
    }
    return 0;
  });

  const stats = {
    total: notifications.length,
    unread: unreadCount,
    critical: notifications.filter(n => n.severity === 'critical').length,
    high: notifications.filter(n => n.severity === 'high').length,
    medium: notifications.filter(n => n.severity === 'medium').length,
    low: notifications.filter(n => n.severity === 'low').length,
  };

  const filterButtons: { key: FilterType; labelKey: string }[] = [
    { key: 'all', labelKey: 'notif.filter.all' },
    { key: 'unread', labelKey: 'notif.filter.unread' },
    { key: 'critical', labelKey: 'notif.filter.critical' },
    { key: 'high', labelKey: 'notif.filter.high' },
    { key: 'medium', labelKey: 'notif.filter.medium' },
    { key: 'low', labelKey: 'notif.filter.low' },
  ];

  const statCards = [
    { labelKey: 'notif.stats.total', value: stats.total, icon: Bell, color: 'text-ink-3', bg: 'bg-white/[0.04]' },
    { labelKey: 'notif.stats.unread', value: stats.unread, icon: Eye, color: 'text-brand-300', bg: 'bg-brand-500/10' },
    { labelKey: 'notif.stats.critical', value: stats.critical, icon: AlertCircle, color: 'text-danger-300', bg: 'bg-danger-500/10' },
    { labelKey: 'notif.stats.high', value: stats.high, icon: AlertTriangle, color: 'text-warning-300', bg: 'bg-warning-500/10' },
    { labelKey: 'notif.stats.medium', value: stats.medium, icon: Info, color: 'text-warning-300', bg: 'bg-warning-500/10' },
    { labelKey: 'notif.stats.low', value: stats.low, icon: CheckCircle, color: 'text-success-300', bg: 'bg-success-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gradient-brand tracking-tight flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center border border-brand-500/30">
              <Bell className="w-5 h-5 text-brand-300" strokeWidth={1.5} />
            </span>
            {t('notif.page.title')}
            {unreadCount > 0 && (
              <span className="ml-2 px-2.5 py-0.5 text-sm font-bold bg-brand-500/20 text-brand-200 border border-brand-500/30 rounded-full font-mono">
                {t('notif.page.newSuffix', { n: unreadCount })}
              </span>
            )}
          </h1>
          <p className="text-sm text-ink-3 mt-1">
            {t('notif.page.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchNotifications(false)}
            disabled={refreshing}
            className="p-2 text-ink-3 hover:text-ink-0 hover:bg-white/[0.04] rounded-xl transition-colors disabled:opacity-50"
            title={t('notif.page.refresh')}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-brand-300 hover:text-brand-200 hover:bg-brand-500/10 rounded-xl transition-colors"
            >
              <CheckCheck className="w-4 h-4" strokeWidth={1.5} />
              {t('notif.page.markAllRead')}
            </button>
          )}
          <button
            onClick={() => setShowPrefs(!showPrefs)}
            className={`p-2 rounded-xl transition-colors ${
              showPrefs
                ? 'text-brand-300 bg-brand-500/10'
                : 'text-ink-3 hover:text-ink-0 hover:bg-white/[0.04]'
            }`}
            title={t('notif.page.prefs')}
          >
            <Settings className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {showPrefs && (
        <PreferencesPanel
          prefs={preferences}
          onUpdate={updatePreferences}
          onClose={() => setShowPrefs(false)}
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(stat => (
          <div
            key={stat.labelKey}
            className={`${stat.bg} rounded-xl border border-white/[0.06] p-3 flex items-center gap-3`}
          >
            <stat.icon className={`w-5 h-5 ${stat.color} flex-shrink-0`} strokeWidth={1.5} />
            <div>
              <p className="font-display text-lg font-bold text-ink-0 font-mono">{stat.value}</p>
              <p className="text-xs text-ink-4">{t(stat.labelKey)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filterButtons.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                filter === f.key
                  ? 'bg-brand-500/20 text-brand-200 border-brand-500/30'
                  : 'bg-white/[0.04] text-ink-3 border-white/[0.08] hover:border-white/[0.14]'
              }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-ink-4" strokeWidth={1.5} />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortType)}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-ink-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            <option value="newest">{t('notif.sort.newest')}</option>
            <option value="oldest">{t('notif.sort.oldest')}</option>
            <option value="severity">{t('notif.sort.severity')}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-4 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/[0.05] rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/[0.05] rounded w-1/3" />
                  <div className="h-3 bg-white/[0.05] rounded w-2/3" />
                  <div className="h-3 bg-white/[0.05] rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="surface-card rounded-xl p-12 text-center">
          <Bell className="w-16 h-16 text-ink-4 mx-auto mb-4" strokeWidth={1.5} />
          <h3 className="font-display text-lg font-semibold text-ink-0 mb-2">
            {filter === 'all' ? t('notif.emptyState.none') : t('notif.emptyState.noMatch')}
          </h3>
          <p className="text-sm text-ink-4 max-w-md mx-auto">
            {filter === 'all'
              ? t('notif.emptyState.allCaught')
              : t('notif.emptyState.filterHint', { filter: t(`notif.filter.${filter}`) })}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(notification => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={markAsRead}
              onDelete={deleteNotification}
              expanded={expandedId === notification.id}
              onToggleExpand={() =>
                setExpandedId(prev => (prev === notification.id ? null : notification.id))
              }
            />
          ))}
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <p className="text-xs text-ink-4 text-center">
          {t('notif.footer', { sorted: sorted.length, total: notifications.length })}
        </p>
      )}
    </div>
  );
}
