import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle, X, CheckCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

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
  return `${diffDay}d ago`;
}

const SEVERITY_STYLES: Record<string, { icon: any; bg: string; text: string }> = {
  critical: { icon: AlertCircle, bg: 'bg-red-500/10', text: 'text-red-400' },
  high: { icon: AlertTriangle, bg: 'bg-orange-500/10', text: 'text-orange-400' },
  medium: { icon: Info, bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  low: { icon: CheckCircle, bg: 'bg-green-500/10', text: 'text-green-400' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const navigate = useNavigate();

  // ─── Fetch Notifications ──────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/insights?limit=10`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.insights || []);
      }
    } catch {
      // Use demo data on error
      setNotifications(getDemoNotifications());
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/insights/unread-count`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      setUnreadCount(getDemoNotifications().filter(n => !n.isRead).length);
    }
  }, []);

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
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await fetch(`${API_URL}/api/insights/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch { /* ignore */ }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    for (const id of unreadIds) {
      try {
        await fetch(`${API_URL}/api/insights/${id}/read`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch { /* continue */ }
    }
  };

  const goToNotificationsPage = () => {
    setIsOpen(false);
    navigate('/dashboard/notifications');
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const getIcon = (severity: string) => {
    const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.low;
    const Icon = style.icon;
    return <Icon className={`w-5 h-5 ${style.text}`} />;
  };

  const getBg = (severity: string, isRead: boolean) => {
    if (isRead) return 'bg-transparent';
    return SEVERITY_STYLES[severity]?.bg || 'bg-white/5';
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-[#0d0e14]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 z-50 max-h-[500px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-500 hover:text-white rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center">
                  <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4">
                  <Bell className="w-10 h-10 text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      onClick={() => !notification.isRead && markAsRead(notification.id)}
                      className={`p-3 cursor-pointer hover:bg-white/5 transition-colors ${
                        getBg(notification.severity, notification.isRead)
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getIcon(notification.severity)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <p className={`text-xs font-semibold truncate ${
                              notification.isRead ? 'text-gray-500' : 'text-white'
                            }`}>
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0 mt-1 animate-pulse" />
                            )}
                          </div>
                          <p className={`text-xs leading-relaxed line-clamp-2 ${
                            notification.isRead ? 'text-gray-600' : 'text-gray-400'
                          }`}>
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-gray-600 mt-1">{timeAgo(notification.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/10">
              <button
                onClick={goToNotificationsPage}
                className="w-full py-2 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1"
              >
                View All Notifications
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

function getDemoNotifications(): Notification[] {
  const now = new Date();
  return [
    {
      id: 'demo-1',
      cameraId: 'cam-01',
      type: 'crowd_surge',
      severity: 'critical',
      title: 'Crowd Surge Detected',
      message: 'Visitor entry rate is 2.3x the hourly average',
      isRead: false,
      createdAt: new Date(now.getTime() - 3 * 60000).toISOString(),
    },
    {
      id: 'demo-2',
      cameraId: 'cam-01',
      type: 'occupancy_alert',
      severity: 'high',
      title: 'High Occupancy Alert',
      message: 'Current occupancy at 92% capacity (46/50)',
      isRead: false,
      createdAt: new Date(now.getTime() - 8 * 60000).toISOString(),
    },
    {
      id: 'demo-3',
      cameraId: 'cam-01',
      type: 'trend',
      severity: 'medium',
      title: 'Peak Hour Approaching',
      message: 'Peak hour (14:00) approaching — average occupancy 38.5',
      isRead: false,
      createdAt: new Date(now.getTime() - 25 * 60000).toISOString(),
    },
    {
      id: 'demo-4',
      cameraId: 'cam-01',
      type: 'demographic_trend',
      severity: 'low',
      title: 'Demographic Profile Update',
      message: 'Dominant profile today: male, 25-34 age group',
      isRead: true,
      createdAt: new Date(now.getTime() - 60 * 60000).toISOString(),
    },
  ];
}
