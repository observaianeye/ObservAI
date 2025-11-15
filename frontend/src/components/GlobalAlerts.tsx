import { useState, useEffect, useRef } from 'react';
import { Bell, X, AlertCircle, TrendingDown, Camera, Package, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' }
};

// Collision detection utility
function checkCollision(pos1: { x: number; y: number }, pos2: { x: number; y: number }, size: number = 64, margin: number = 10) {
  const distance = Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
  return distance < (size + margin);
}

export default function GlobalAlerts() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'sales' | 'camera' | 'inventory' | 'labor'>('all');
  const [alerts, setAlerts] = useState<Alert[]>(demoAlerts);
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('alertsPosition');
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 170, y: window.innerHeight - 90 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);

  const isDashboard = location.pathname.startsWith('/dashboard');
  const shouldShow = isAuthenticated && isDashboard;

  if (!shouldShow) return null;

  useEffect(() => {
    localStorage.setItem('alertsPosition', JSON.stringify(position));
    // Broadcast position change for collision detection
    window.dispatchEvent(new CustomEvent('alertsPositionChange', { detail: position }));
  }, [position]);

  // Listen for chatbot position to avoid collision
  useEffect(() => {
    const handleChatbotPosition = (e: Event) => {
      const customEvent = e as CustomEvent;
      const chatbotPos = customEvent.detail;
      if (checkCollision(position, chatbotPos)) {
        // Move alerts to avoid collision
        setPosition({ x: window.innerWidth - 170, y: window.innerHeight - 170 });
      }
    };
    window.addEventListener('chatbotPositionChange', handleChatbotPosition);
    return () => window.removeEventListener('chatbotPositionChange', handleChatbotPosition);
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isOpen) return; // Don't drag when panel is open
    e.preventDefault();
    setHasDragged(false);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragStartPos.x === 0 && dragStartPos.y === 0) return;

      const distanceMoved = Math.sqrt(
        Math.pow(e.clientX - dragStartPos.x, 2) +
        Math.pow(e.clientY - dragStartPos.y, 2)
      );

      if (distanceMoved > 5 && !hasDragged) {
        setIsDragging(true);
        setHasDragged(true);
      }

      if (isDragging) {
        const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 64));
        const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 64));
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setDragStartPos({ x: 0, y: 0 });
      }
    };

    if (dragStartPos.x !== 0 || dragStartPos.y !== 0) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, dragStartPos, hasDragged]);

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
    if (!hasDragged) {
      setIsOpen(!isOpen);
    }
    setHasDragged(false);
  };

  const filteredAlerts = activeTab === 'all'
    ? alerts
    : alerts.filter(alert => alert.category === activeTab);

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <>
      {!isOpen && (
        <button
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          style={{ left: `${position.x}px`, top: `${position.y}px` }}
          className={`fixed z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center ${
            isDragging ? 'cursor-grabbing' : 'cursor-pointer'
          }`}
          aria-label="Alerts"
        >
          <Bell className="w-6 h-6" />
          {unacknowledgedCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center">
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
            aria-label="Alerts Panel"
            className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
                {unacknowledgedCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                    {unacknowledgedCount} new
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                aria-label="Close alerts"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex space-x-1 p-3 border-b border-gray-200 overflow-x-auto">
              {(['all', 'sales', 'camera', 'inventory', 'labor'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No alerts in this category</p>
                </div>
              ) : (
                filteredAlerts.map(alert => {
                  const Icon = categoryIcons[alert.category];
                  const colors = severityColors[alert.severity];

                  return (
                    <div
                      key={alert.id}
                      className={`border rounded-lg p-4 ${colors.border} ${alert.acknowledged ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center`}>
                            <Icon className={`w-4 h-4 ${colors.text}`} />
                          </div>
                          <span className={`px-2 py-0.5 ${colors.bg} ${colors.text} text-xs font-medium rounded`}>
                            {alert.source}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">{alert.date}</span>
                      </div>

                      <p className="text-sm text-gray-900 mb-3">{alert.message}</p>

                      <div className="flex items-center space-x-2">
                        <Link
                          to={alert.link}
                          onClick={() => setIsOpen(false)}
                          className="flex-1 px-3 py-1.5 bg-gray-50 text-gray-900 text-xs font-medium rounded hover:bg-gray-100 transition-colors text-center"
                        >
                          View Details
                        </Link>
                        {!alert.acknowledged && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded hover:bg-blue-100 transition-colors"
                          >
                            Acknowledge
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
