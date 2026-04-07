import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Camera, Bell, Globe, Shield, User, Save, RotateCcw,
  Eye, EyeOff, Sliders, Monitor, Wifi, WifiOff, AlertTriangle,
  CheckCircle, ChevronDown, ChevronUp, Volume2, VolumeX, Sun, Moon,
  Send, Mail, MessageSquare
} from 'lucide-react';
import { useDataMode } from '../../contexts/DataModeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { cameraBackendService, type BackendHealth } from '../../services/cameraBackendService';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CameraSettings {
  detectionSensitivity: number;
  frameSkip: number;
  inputResolution: '320' | '416' | '640';
  showBoundingBoxes: boolean;
  showDemographics: boolean;
  showZoneOverlay: boolean;
  confidenceThreshold: number;
  maxDetections: number;
}

interface NotificationSettings {
  enablePush: boolean;
  enableSound: boolean;
  crowdSurgeAlerts: boolean;
  occupancyAlerts: boolean;
  demographicTrends: boolean;
  systemAlerts: boolean;
  occupancyThreshold: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface RegionalSettings {
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  theme: 'light' | 'dark' | 'system';
}

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
];

const TIMEZONES = [
  { value: 'Europe/Istanbul', label: 'Istanbul (GMT+3)' },
  { value: 'Europe/London', label: 'London (GMT+0)' },
  { value: 'Europe/Berlin', label: 'Berlin (GMT+1)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CAMERA: CameraSettings = {
  detectionSensitivity: 50,
  frameSkip: 2,
  inputResolution: '640',
  showBoundingBoxes: true,
  showDemographics: true,
  showZoneOverlay: true,
  confidenceThreshold: 0.5,
  maxDetections: 50,
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enablePush: true,
  enableSound: true,
  crowdSurgeAlerts: true,
  occupancyAlerts: true,
  demographicTrends: false,
  systemAlerts: true,
  occupancyThreshold: 80,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

const DEFAULT_REGIONAL: RegionalSettings = {
  language: 'en',
  timezone: 'Europe/Istanbul',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  theme: 'light',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadSettings<T>(key: string, defaults: T): T {
  try {
    const stored = localStorage.getItem(`observai_settings_${key}`);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch { /* use defaults */ }
  return defaults;
}

function saveSettings<T>(key: string, value: T): void {
  localStorage.setItem(`observai_settings_${key}`, JSON.stringify(value));
}

// ─── Section Wrapper ─────────────────────────────────────────────────────────

function SettingsSection({
  title,
  icon: Icon,
  iconBg,
  iconColor,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-[#0f1117]/80 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="px-5 pb-5 border-t border-white/10 pt-4">{children}</div>}
    </div>
  );
}

// ─── Toggle Component ────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start justify-between cursor-pointer group py-2">
      <div className="flex-1 mr-4">
        <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
          {label}
        </span>
        {description && (
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          checked ? 'bg-blue-600' : 'bg-gray-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}

// ─── Slider Component ────────────────────────────────────────────────────────

function Slider({
  value,
  onChange,
  min,
  max,
  step,
  label,
  unit,
  description,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit?: string;
  description?: string;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-medium text-gray-300">{label}</span>
          {description && (
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
        <span className="text-sm font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
          {value}{unit || ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step || 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{min}{unit || ''}</span>
        <span>{max}{unit || ''}</span>
      </div>
    </div>
  );
}

// ─── Select Component ────────────────────────────────────────────────────────

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="py-2">
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { dataMode, setDataMode } = useDataMode();
  const { user } = useAuth();
  const { showToast } = useToast();

  // State
  const [camera, setCamera] = useState<CameraSettings>(() => loadSettings('camera', DEFAULT_CAMERA));
  const [notifications, setNotifications] = useState<NotificationSettings>(() => loadSettings('notifications', DEFAULT_NOTIFICATIONS));
  const [regional, setRegional] = useState<RegionalSettings>(() => loadSettings('regional', DEFAULT_REGIONAL));
  const [profile, setProfile] = useState<UserProfile>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    role: user?.role || 'VIEWER',
  });
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPassword: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Notification channels state (synced with backend)
  const [channels, setChannels] = useState({
    telegramChatId: '',
    telegramNotifications: false,
    emailNotifications: true,
    notifySeverity: 'high' as string,
    dailySummaryEnabled: false,
    dailySummaryTime: '09:00',
  });
  const [channelStatus, setChannelStatus] = useState<{
    telegram: { configured: boolean; botValid: boolean; botName: string | null };
    email: { configured: boolean; connected: boolean };
  } | null>(null);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  // Track changes
  useEffect(() => {
    setHasChanges(true);
  }, [camera, notifications, regional, profile]);

  // Backend health monitoring
  useEffect(() => {
    const unsubscribe = cameraBackendService.onBackendStatus((health) => {
      setBackendHealth(health);
    });
    cameraBackendService.checkHealth();
    return unsubscribe;
  }, []);

  // Load notification channel settings from backend
  useEffect(() => {
    async function loadChannels() {
      try {
        const [settingsRes, statusRes] = await Promise.all([
          fetch(`${API_URL}/api/notifications/settings`, { credentials: 'include' }),
          fetch(`${API_URL}/api/notifications/channels/status`, { credentials: 'include' }),
        ]);
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setChannels({
            telegramChatId: data.telegramChatId || '',
            telegramNotifications: data.telegramNotifications ?? false,
            emailNotifications: data.emailNotifications ?? true,
            notifySeverity: data.notifySeverity || 'high',
            dailySummaryEnabled: data.dailySummaryEnabled ?? false,
            dailySummaryTime: data.dailySummaryTime || '09:00',
          });
        }
        if (statusRes.ok) {
          setChannelStatus(await statusRes.json());
        }
      } catch { /* backend may not be running */ }
    }
    loadChannels();
  }, []);

  // Update profile when auth changes
  useEffect(() => {
    if (user) {
      setProfile({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        role: user.role || 'VIEWER',
      });
    }
  }, [user]);

  // ─── Save All ────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Save to localStorage
      saveSettings('camera', camera);
      saveSettings('notifications', notifications);
      saveSettings('regional', regional);

      // Try to save profile to backend
      try {
        await fetch(`${API_URL}/api/users/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            firstName: profile.firstName,
            lastName: profile.lastName,
          }),
        });
      } catch {
        // Profile save to backend is optional
      }

      // Save notification channels to backend
      try {
        await fetch(`${API_URL}/api/notifications/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            telegramChatId: channels.telegramChatId || null,
            telegramNotifications: channels.telegramNotifications,
            emailNotifications: channels.emailNotifications,
            notifySeverity: channels.notifySeverity,
            dailySummaryEnabled: channels.dailySummaryEnabled,
            dailySummaryTime: channels.dailySummaryTime,
          }),
        });
      } catch {
        // Notification save to backend is optional
      }

      setHasChanges(false);
      showToast('success', 'Settings saved successfully');
    } catch {
      showToast('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [camera, notifications, regional, profile, showToast]);

  // ─── Reset All ───────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setCamera(DEFAULT_CAMERA);
    setNotifications(DEFAULT_NOTIFICATIONS);
    setRegional(DEFAULT_REGIONAL);
    showToast('warning', 'Settings reset to defaults');
  }, [showToast]);

  // ─── Camera Setting Updaters ─────────────────────────────────────────

  const updateCamera = <K extends keyof CameraSettings>(key: K, value: CameraSettings[K]) => {
    setCamera(prev => ({ ...prev, [key]: value }));
  };

  const updateNotifications = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const updateRegional = <K extends keyof RegionalSettings>(key: K, value: RegionalSettings[K]) => {
    setRegional(prev => ({ ...prev, [key]: value }));
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-gray-400 mt-1">Configure system preferences and analytics parameters</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleReset}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      {/* System Status Banner */}
      <div className={`rounded-xl p-4 flex items-center space-x-3 ${
        backendHealth?.status === 'ready'
          ? 'bg-green-500/10 border border-green-500/20'
          : backendHealth?.status === 'loading'
          ? 'bg-yellow-500/10 border border-yellow-500/20'
          : 'bg-red-500/10 border border-red-500/20'
      }`}>
        {backendHealth?.status === 'ready' ? (
          <>
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-300">System Online</p>
              <p className="text-xs text-green-400">
                Python backend connected &middot; {backendHealth.fps.toFixed(1)} FPS &middot; Model loaded
              </p>
            </div>
          </>
        ) : backendHealth?.status === 'loading' ? (
          <>
            <div className="w-5 h-5 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-300">System Loading</p>
              <p className="text-xs text-yellow-400">Phase: {backendHealth.phase}</p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-300">System Offline</p>
              <p className="text-xs text-red-400">
                {backendHealth?.error || 'Python backend is not reachable'}
              </p>
            </div>
          </>
        )}
        <div className="ml-auto flex items-center space-x-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            dataMode === 'live'
              ? 'bg-green-500/10 text-green-400'
              : 'bg-blue-500/10 text-blue-400'
          }`}>
            {dataMode === 'live' ? (
              <><Wifi className="w-3 h-3 mr-1" /> Live</>
            ) : (
              <><Monitor className="w-3 h-3 mr-1" /> Demo</>
            )}
          </span>
        </div>
      </div>

      {/* Data Mode Switch */}
      <div className="bg-[#0f1117]/80 backdrop-blur-xl rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center">
              <Monitor className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Data Mode</h3>
              <p className="text-xs text-gray-400">
                Switch between live camera data and demo simulation data
              </p>
            </div>
          </div>
          <div className="flex items-center bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setDataMode('demo')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                dataMode === 'demo'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Demo
            </button>
            <button
              onClick={() => setDataMode('live')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                dataMode === 'live'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Live
            </button>
          </div>
        </div>
      </div>

      {/* Camera Settings */}
      <SettingsSection
        title="Camera & Detection"
        icon={Camera}
        iconBg="bg-blue-500/10"
        iconColor="text-blue-400"
      >
        <div className="space-y-1">
          <Slider
            label="Detection Sensitivity"
            description="Higher values detect more objects but may include false positives"
            value={camera.detectionSensitivity}
            onChange={(v) => updateCamera('detectionSensitivity', v)}
            min={10}
            max={100}
            unit="%"
          />

          <Slider
            label="Confidence Threshold"
            description="Minimum confidence score to show a detection"
            value={Math.round(camera.confidenceThreshold * 100)}
            onChange={(v) => updateCamera('confidenceThreshold', v / 100)}
            min={10}
            max={95}
            unit="%"
          />

          <Slider
            label="Frame Skip"
            description="Process every Nth frame for AI inference (higher = better performance)"
            value={camera.frameSkip}
            onChange={(v) => updateCamera('frameSkip', v)}
            min={1}
            max={5}
          />

          <Select
            label="Input Resolution"
            value={camera.inputResolution}
            onChange={(v) => updateCamera('inputResolution', v as CameraSettings['inputResolution'])}
            options={[
              { value: '320', label: '320px (Fast, lower accuracy)' },
              { value: '416', label: '416px (Balanced)' },
              { value: '640', label: '640px (Best accuracy, slower)' },
            ]}
          />

          <Slider
            label="Max Detections"
            description="Maximum number of people to track simultaneously"
            value={camera.maxDetections}
            onChange={(v) => updateCamera('maxDetections', v)}
            min={5}
            max={100}
          />

          <div className="border-t border-white/10 mt-3 pt-3 space-y-1">
            <Toggle
              label="Show Bounding Boxes"
              description="Display detection rectangles on the video feed"
              checked={camera.showBoundingBoxes}
              onChange={(v) => updateCamera('showBoundingBoxes', v)}
            />
            <Toggle
              label="Show Demographics"
              description="Display age and gender labels on detected people"
              checked={camera.showDemographics}
              onChange={(v) => updateCamera('showDemographics', v)}
            />
            <Toggle
              label="Show Zone Overlay"
              description="Display zone boundaries on the video feed"
              checked={camera.showZoneOverlay}
              onChange={(v) => updateCamera('showZoneOverlay', v)}
            />
          </div>
        </div>
      </SettingsSection>

      {/* Notification Settings */}
      <SettingsSection
        title="Notifications"
        icon={Bell}
        iconBg="bg-green-500/10"
        iconColor="text-green-400"
      >
        <div className="space-y-1">
          <Toggle
            label="Push Notifications"
            description="Receive browser push notifications for alerts"
            checked={notifications.enablePush}
            onChange={(v) => updateNotifications('enablePush', v)}
          />
          <Toggle
            label="Alert Sounds"
            description="Play a sound when a new alert arrives"
            checked={notifications.enableSound}
            onChange={(v) => updateNotifications('enableSound', v)}
          />

          <div className="border-t border-white/10 mt-3 pt-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Alert Types</p>
            <Toggle
              label="Crowd Surge Alerts"
              description="When visitor rate exceeds 2x the average"
              checked={notifications.crowdSurgeAlerts}
              onChange={(v) => updateNotifications('crowdSurgeAlerts', v)}
            />
            <Toggle
              label="Occupancy Alerts"
              description="When zone capacity exceeds threshold"
              checked={notifications.occupancyAlerts}
              onChange={(v) => updateNotifications('occupancyAlerts', v)}
            />
            <Toggle
              label="Demographic Trend Alerts"
              description="When significant demographic shifts are detected"
              checked={notifications.demographicTrends}
              onChange={(v) => updateNotifications('demographicTrends', v)}
            />
            <Toggle
              label="System Alerts"
              description="Backend status changes, connection issues"
              checked={notifications.systemAlerts}
              onChange={(v) => updateNotifications('systemAlerts', v)}
            />
          </div>

          <div className="border-t border-white/10 mt-3 pt-3">
            <Slider
              label="Occupancy Alert Threshold"
              description="Alert when zone occupancy exceeds this percentage"
              value={notifications.occupancyThreshold}
              onChange={(v) => updateNotifications('occupancyThreshold', v)}
              min={50}
              max={100}
              unit="%"
            />
          </div>

          <div className="border-t border-white/10 mt-3 pt-3">
            <Toggle
              label="Quiet Hours"
              description="Suppress non-critical notifications during specified hours"
              checked={notifications.quietHoursEnabled}
              onChange={(v) => updateNotifications('quietHoursEnabled', v)}
            />
            {notifications.quietHoursEnabled && (
              <div className="flex items-center space-x-3 mt-2 ml-1">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">From</label>
                  <input
                    type="time"
                    value={notifications.quietHoursStart}
                    onChange={(e) => updateNotifications('quietHoursStart', e.target.value)}
                    className="px-2 py-1.5 border border-white/10 bg-white/5 text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <span className="text-gray-400 mt-5">---</span>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">To</label>
                  <input
                    type="time"
                    value={notifications.quietHoursEnd}
                    onChange={(e) => updateNotifications('quietHoursEnd', e.target.value)}
                    className="px-2 py-1.5 border border-white/10 bg-white/5 text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Notification Channels ── */}
          <div className="border-t border-white/10 mt-3 pt-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Notification Channels</p>

            {/* Minimum Severity */}
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-1">Minimum Alert Severity</label>
              <p className="text-xs text-gray-500 mb-2">Only alerts at or above this level trigger Telegram/Email</p>
              <select
                value={channels.notifySeverity}
                onChange={(e) => setChannels(prev => ({ ...prev, notifySeverity: e.target.value }))}
                className="w-full px-3 py-2 border border-white/10 bg-white/5 text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low (all alerts)</option>
                <option value="medium">Medium+</option>
                <option value="high">High+ (recommended)</option>
                <option value="critical">Critical only</option>
              </select>
            </div>

            {/* Telegram */}
            <div className="bg-white/5 rounded-lg p-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-white">Telegram</span>
                {channelStatus?.telegram.botValid && (
                  <span className="text-xs text-emerald-400 ml-auto">@{channelStatus.telegram.botName}</span>
                )}
                {channelStatus && !channelStatus.telegram.configured && (
                  <span className="text-xs text-gray-500 ml-auto">Bot token not set</span>
                )}
              </div>
              <Toggle
                label="Enable Telegram Notifications"
                description="Receive alerts via Telegram bot"
                checked={channels.telegramNotifications}
                onChange={(v) => setChannels(prev => ({ ...prev, telegramNotifications: v }))}
              />
              {channels.telegramNotifications && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-400 mb-1">Telegram Chat ID</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={channels.telegramChatId}
                      onChange={(e) => setChannels(prev => ({ ...prev, telegramChatId: e.target.value }))}
                      placeholder="e.g. 123456789"
                      className="flex-1 px-3 py-2 border border-white/10 bg-white/5 text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
                    />
                    <button
                      onClick={async () => {
                        setTestingTelegram(true);
                        try {
                          const res = await fetch(`${API_URL}/api/notifications/test/telegram`, {
                            method: 'POST', credentials: 'include',
                          });
                          const data = await res.json();
                          showToast(data.success ? 'success' : 'error', data.success ? 'Test message sent!' : (data.error || 'Failed'));
                        } catch { showToast('error', 'Connection error'); }
                        setTestingTelegram(false);
                      }}
                      disabled={!channels.telegramChatId || testingTelegram}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      {testingTelegram ? '...' : 'Test'}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">Send /start to the bot, then enter your chat ID here</p>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="bg-white/5 rounded-lg p-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-white">Email</span>
                {channelStatus?.email.connected && (
                  <span className="text-xs text-emerald-400 ml-auto">SMTP connected</span>
                )}
                {channelStatus && !channelStatus.email.configured && (
                  <span className="text-xs text-gray-500 ml-auto">SMTP not configured</span>
                )}
              </div>
              <Toggle
                label="Enable Email Notifications"
                description="Receive critical alerts via email"
                checked={channels.emailNotifications}
                onChange={(v) => setChannels(prev => ({ ...prev, emailNotifications: v }))}
              />
              {channels.emailNotifications && (
                <div className="mt-2">
                  <button
                    onClick={async () => {
                      setTestingEmail(true);
                      try {
                        const res = await fetch(`${API_URL}/api/notifications/test/email`, {
                          method: 'POST', credentials: 'include',
                        });
                        const data = await res.json();
                        showToast(data.success ? 'success' : 'error', data.success ? 'Test email sent!' : (data.error || 'Failed'));
                      } catch { showToast('error', 'Connection error'); }
                      setTestingEmail(false);
                    }}
                    disabled={testingEmail}
                    className="px-3 py-2 bg-orange-600 text-white rounded-lg text-xs hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    {testingEmail ? 'Sending...' : 'Send Test Email'}
                  </button>
                </div>
              )}
            </div>

            {/* Daily Summary */}
            <div className="bg-white/5 rounded-lg p-4">
              <Toggle
                label="Daily Summary Email"
                description="Receive a daily analytics summary at a set time"
                checked={channels.dailySummaryEnabled}
                onChange={(v) => setChannels(prev => ({ ...prev, dailySummaryEnabled: v }))}
              />
              {channels.dailySummaryEnabled && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-400 mb-1">Summary Time</label>
                  <input
                    type="time"
                    value={channels.dailySummaryTime}
                    onChange={(e) => setChannels(prev => ({ ...prev, dailySummaryTime: e.target.value }))}
                    className="px-2 py-1.5 border border-white/10 bg-white/5 text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Regional Settings */}
      <SettingsSection
        title="Regional & Display"
        icon={Globe}
        iconBg="bg-purple-500/10"
        iconColor="text-purple-400"
      >
        <div className="space-y-1">
          <Select
            label="Language"
            value={regional.language}
            onChange={(v) => updateRegional('language', v)}
            options={LANGUAGES}
          />
          <Select
            label="Timezone"
            value={regional.timezone}
            onChange={(v) => updateRegional('timezone', v)}
            options={TIMEZONES}
          />
          <Select
            label="Date Format"
            value={regional.dateFormat}
            onChange={(v) => updateRegional('dateFormat', v)}
            options={DATE_FORMATS}
          />
          <div className="py-2">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Time Format</label>
            <div className="flex items-center bg-white/5 rounded-lg p-1 w-fit">
              <button
                onClick={() => updateRegional('timeFormat', '12h')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  regional.timeFormat === '12h'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                12h
              </button>
              <button
                onClick={() => updateRegional('timeFormat', '24h')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  regional.timeFormat === '24h'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                24h
              </button>
            </div>
          </div>
          <div className="py-2">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Theme</label>
            <div className="flex items-center bg-white/5 rounded-lg p-1 w-fit">
              <button
                onClick={() => updateRegional('theme', 'light')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center space-x-1.5 ${
                  regional.theme === 'light'
                    ? 'bg-yellow-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Light</span>
              </button>
              <button
                onClick={() => updateRegional('theme', 'dark')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center space-x-1.5 ${
                  regional.theme === 'dark'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Dark</span>
              </button>
              <button
                onClick={() => updateRegional('theme', 'system')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center space-x-1.5 ${
                  regional.theme === 'system'
                    ? 'bg-gray-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>System</span>
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* User Profile */}
      <SettingsSection
        title="User Profile"
        icon={User}
        iconBg="bg-orange-500/10"
        iconColor="text-orange-400"
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">First Name</label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-white/10 bg-white/5 text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Last Name</label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-3 py-2 border border-white/10 bg-white/5 text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter last name"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed from settings</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Role</label>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400">
              {profile.role}
            </span>
          </div>
        </div>
      </SettingsSection>

      {/* Security */}
      <SettingsSection
        title="Security"
        icon={Shield}
        iconBg="bg-red-500/10"
        iconColor="text-red-400"
        defaultOpen={false}
      >
        <div className="space-y-3">
          <button
            onClick={() => { setShowPasswordForm(!showPasswordForm); setPasswordError(''); setPasswordSuccess(false); }}
            className="w-full px-4 py-2.5 bg-white/5 text-gray-300 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors border border-white/10 text-left"
          >
            {showPasswordForm ? 'Cancel Password Change' : 'Change Password'}
          </button>

          {showPasswordForm && (
            <div className="space-y-3 p-4 bg-white/5 rounded-lg border border-white/10">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm(p => ({ ...p, current: e.target.value }))}
                  className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 text-white"
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                  className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 text-white"
                />
              </div>
              {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
              {passwordSuccess && <p className="text-xs text-green-400">Password changed successfully!</p>}
              <button
                onClick={async () => {
                  setPasswordError('');
                  if (passwordForm.newPassword !== passwordForm.confirm) {
                    setPasswordError('Passwords do not match');
                    return;
                  }
                  if (passwordForm.newPassword.length < 8) {
                    setPasswordError('Password must be at least 8 characters');
                    return;
                  }
                  try {
                    const res = await fetch(`${API_URL}/api/auth/change-password`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.newPassword })
                    });
                    if (res.ok) {
                      setPasswordSuccess(true);
                      setPasswordForm({ current: '', newPassword: '', confirm: '' });
                    } else {
                      const data = await res.json();
                      setPasswordError(data.error || 'Failed to change password');
                    }
                  } catch {
                    setPasswordError('Connection error');
                  }
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Update Password
              </button>
            </div>
          )}

          <div className="relative">
            <button className="w-full px-4 py-2.5 bg-white/5 text-gray-500 rounded-lg text-sm font-medium border border-white/10 text-left cursor-not-allowed" disabled>
              Enable Two-Factor Authentication
            </button>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">Coming Soon</span>
          </div>
          <div className="relative">
            <button className="w-full px-4 py-2.5 bg-white/5 text-gray-500 rounded-lg text-sm font-medium border border-white/10 text-left cursor-not-allowed" disabled>
              Manage API Keys
            </button>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">Coming Soon</span>
          </div>
        </div>
      </SettingsSection>

      {/* About */}
      <div className="bg-[#0f1117]/80 backdrop-blur-xl rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">ObservAI</h3>
            <p className="text-xs text-gray-400 mt-0.5">AI-Powered Real-Time Customer Analytics Platform</p>
          </div>
          <span className="text-xs text-gray-500 font-mono">v1.0.0-beta</span>
        </div>
      </div>

      {/* Bottom spacer for scroll */}
      <div className="h-4" />
    </div>
  );
}
