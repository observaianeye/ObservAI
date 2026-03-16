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
  VolumeX,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── API Helpers ─────────────────────────────────────────────────────────────

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

// ─── Severity Helpers ────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: {
    color: 'red',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    icon: AlertCircle,
    label: 'Critical',
    priority: 4,
  },
  high: {
    color: 'orange',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    icon: AlertTriangle,
    label: 'High',
    priority: 3,
  },
  medium: {
    color: 'yellow',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    icon: Info,
    label: 'Medium',
    priority: 2,
  },
  low: {
    color: 'blue',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: CheckCircle,
    label: 'Low',
    priority: 1,
  },
};

const TYPE_ICONS: Record<string, any> = {
  crowd_surge: Zap,
  occupancy_alert: Users,
  wait_time_alert: Clock,
  trend: TrendingUp,
  demographic_trend: Users,
  recommendation: Sparkles,
};

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    crowd_surge: 'Crowd Surge',
    occupancy_alert: 'Occupancy Alert',
    wait_time_alert: 'Wait Time',
    trend: 'Trend',
    demographic_trend: 'Demographics',
    recommendation: 'AI Recommendation',
  };
  return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// ─── NotificationCard ────────────────────────────────────────────────────────

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
  const config = SEVERITY_CONFIG[notification.severity] || SEVERITY_CONFIG.low;
  const SeverityIcon = config.icon;
  const TypeIcon = TYPE_ICONS[notification.type] || Info;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        notification.isRead
          ? 'bg-white/[0.02] border-white/5 opacity-70'
          : `${config.bg} ${config.border}`
      } hover:border-white/20`}
    >
      <div
        className="p-4 cursor-pointer flex items-start gap-4"
        onClick={onToggleExpand}
      >
        {/* Severity Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          notification.isRead ? 'bg-white/5' : config.bg
        }`}>
          <SeverityIcon className={`w-5 h-5 ${notification.isRead ? 'text-gray-500' : config.text}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className={`text-sm font-semibold ${
              notification.isRead ? 'text-gray-400' : 'text-white'
            }`}>
              {notification.title}
            </h3>
            {!notification.isRead && (
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 animate-pulse" />
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${config.badge}`}>
              {config.label.toUpperCase()}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
              <TypeIcon className="w-3 h-3 inline mr-1" />
              {getTypeLabel(notification.type)}
            </span>
          </div>
          <p className={`text-sm leading-relaxed ${
            notification.isRead ? 'text-gray-500' : 'text-gray-300'
          }`}>
            {notification.message}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-500">
              <Clock className="w-3 h-3 inline mr-1" />
              {timeAgo(notification.createdAt)}
            </span>
            {notification.cameraId && (
              <span className="text-xs text-gray-500">
                Camera: {notification.cameraId.slice(0, 8)}...
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!notification.isRead && (
            <button
              onClick={e => { e.stopPropagation(); onMarkRead(notification.id); }}
              className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
              title="Mark as read"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete(notification.id); }}
            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>

      {/* Expanded Context */}
      {expanded && notification.context && (
        <div className="px-4 pb-4 pt-0 ml-14">
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(notification.context).map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="text-gray-500">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                  <span className="text-gray-300 font-medium">
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

// ─── Preferences Panel ───────────────────────────────────────────────────────

function PreferencesPanel({
  prefs,
  onUpdate,
  onClose,
}: {
  prefs: NotificationPreferences;
  onUpdate: (p: NotificationPreferences) => void;
  onClose: () => void;
}) {
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
    <div className="bg-white/[0.03] rounded-xl border border-white/10 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          Notification Preferences
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">Close</button>
      </div>

      {/* Sound & Desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
          <input
            type="checkbox"
            checked={local.enableSound}
            onChange={() => setLocal(p => ({ ...p, enableSound: !p.enableSound }))}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
          />
          <Volume2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">Sound alerts</span>
        </label>
        <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
          <input
            type="checkbox"
            checked={local.enableDesktop}
            onChange={() => setLocal(p => ({ ...p, enableDesktop: !p.enableDesktop }))}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
          />
          <Bell className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">Desktop notifications</span>
        </label>
      </div>

      {/* Severity Filter */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 mb-2">Show notifications for:</h4>
        <div className="flex flex-wrap gap-2">
          {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
            const c = SEVERITY_CONFIG[sev];
            const active = local.severityFilter.includes(sev);
            return (
              <button
                key={sev}
                onClick={() => toggleSeverity(sev)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  active ? c.badge : 'bg-white/5 text-gray-500 border-white/10'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
        <label className="flex items-center gap-3 cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={local.quietHoursEnabled}
            onChange={() => setLocal(p => ({ ...p, quietHoursEnabled: !p.quietHoursEnabled }))}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
          />
          <BellOff className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">Quiet hours (mute notifications)</span>
        </label>
        {local.quietHoursEnabled && (
          <div className="flex items-center gap-3 ml-7">
            <input
              type="time"
              value={local.quietHoursStart}
              onChange={e => setLocal(p => ({ ...p, quietHoursStart: e.target.value }))}
              className="px-2 py-1 rounded bg-white/5 border border-white/10 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <span className="text-gray-500 text-sm">to</span>
            <input
              type="time"
              value={local.quietHoursEnd}
              onChange={e => setLocal(p => ({ ...p, quietHoursEnd: e.target.value }))}
              className="px-2 py-1 rounded bg-white/5 border border-white/10 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={save}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function NotificationsPage() {
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

  // ─── Data Fetching ──────────────────────────────────────────────────────

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
      // On error, show demo notifications
      setNotifications(getDemoNotifications());
      setUnreadCount(getDemoNotifications().filter(n => !n.isRead).length);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ─── Socket.IO Real-time ──────────────────────────────────────────────

  useEffect(() => {
    fetchNotifications();

    // Connect to Socket.IO for real-time zone alerts
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

        // Play sound if enabled
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

  // ─── Actions ──────────────────────────────────────────────────────────

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await fetchJSON(`/api/insights/${id}/read`, { method: 'PATCH' });
    } catch {
      // Revert on error
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: false } : n));
      setUnreadCount(prev => prev + 1);
    }
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    // Optimistic
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    // Mark each one (batch endpoint not available, so sequential)
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
      // Revert
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

  // ─── Filtering & Sorting ─────────────────────────────────────────────

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

  // ─── Stats ────────────────────────────────────────────────────────────

  const stats = {
    total: notifications.length,
    unread: unreadCount,
    critical: notifications.filter(n => n.severity === 'critical').length,
    high: notifications.filter(n => n.severity === 'high').length,
    medium: notifications.filter(n => n.severity === 'medium').length,
    low: notifications.filter(n => n.severity === 'low').length,
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 px-2.5 py-0.5 text-sm font-bold bg-blue-600/20 text-blue-300 rounded-full">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time alerts, AI insights, and system notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchNotifications(false)}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
          <button
            onClick={() => setShowPrefs(!showPrefs)}
            className={`p-2 rounded-lg transition-colors ${
              showPrefs
                ? 'text-blue-400 bg-blue-500/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title="Notification preferences"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Preferences Panel */}
      {showPrefs && (
        <PreferencesPanel
          prefs={preferences}
          onUpdate={updatePreferences}
          onClose={() => setShowPrefs(false)}
        />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Bell, color: 'text-gray-400', bg: 'bg-white/5' },
          { label: 'Unread', value: stats.unread, icon: Eye, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Critical', value: stats.critical, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'High', value: stats.high, icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Medium', value: stats.medium, icon: Info, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Low', value: stats.low, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
        ].map(stat => (
          <div
            key={stat.label}
            className={`${stat.bg} rounded-xl border border-white/5 p-3 flex items-center gap-3`}
          >
            <stat.icon className={`w-5 h-5 ${stat.color} flex-shrink-0`} />
            <div>
              <p className="text-lg font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all' as FilterType, label: 'All' },
            { key: 'unread' as FilterType, label: 'Unread' },
            { key: 'critical' as FilterType, label: 'Critical' },
            { key: 'high' as FilterType, label: 'High' },
            { key: 'medium' as FilterType, label: 'Medium' },
            { key: 'low' as FilterType, label: 'Low' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                filter === f.key
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortType)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="severity">By severity</option>
          </select>
        </div>
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white/[0.02] rounded-xl border border-white/5 p-4 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/5 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-3 bg-white/5 rounded w-2/3" />
                  <div className="h-3 bg-white/5 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white/[0.02] rounded-xl border border-white/5 p-12 text-center">
          <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {filter === 'all' ? 'No Notifications' : 'No Matching Notifications'}
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {filter === 'all'
              ? 'You\'re all caught up! New alerts will appear here when the system detects events like crowd surges, high occupancy, or trend changes.'
              : `No notifications match the "${filter}" filter. Try a different filter or check back later.`}
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

      {/* Footer Info */}
      {!loading && sorted.length > 0 && (
        <p className="text-xs text-gray-600 text-center">
          Showing {sorted.length} of {notifications.length} notification{notifications.length !== 1 ? 's' : ''}.
          Notifications are auto-generated by AI insight engine and real-time zone alerts.
        </p>
      )}
    </div>
  );
}

// ─── Demo Data ───────────────────────────────────────────────────────────────

function getDemoNotifications(): Notification[] {
  const now = new Date();
  return [
    {
      id: 'demo-1',
      cameraId: 'cam-ankara-01',
      zoneId: 'entrance',
      type: 'crowd_surge',
      severity: 'critical',
      title: 'Crowd Surge Detected',
      message: 'Visitor entry rate in the last 5 minutes is 2.3x the hourly average. Current rate: 12.5/snapshot vs average 5.4/snapshot.',
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
      title: 'High Occupancy Alert',
      message: 'Current occupancy is at 92% capacity (46/50). Consider managing crowd flow.',
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
      title: 'Peak Hour Approaching',
      message: 'Peak hour (14:00) is approaching with average occupancy of 38.5. Consider preparing additional staff.',
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
      title: 'Demographic Profile Update',
      message: 'Today\'s dominant visitor profile: male, 25-34. Gender split: {"male":65,"female":35}.',
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
      title: 'Long Wait Time Detected',
      message: 'Average wait time has reached 8 minutes. Queue count: 12.',
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
      title: 'AI Recommendation',
      message: 'With 234 visitors today, consider extending peak-hour staffing to maintain service quality.',
      context: { source: 'gemini', totalVisitors: 234 },
      isRead: true,
      createdAt: new Date(now.getTime() - 120 * 60000).toISOString(),
    },
  ];
}
