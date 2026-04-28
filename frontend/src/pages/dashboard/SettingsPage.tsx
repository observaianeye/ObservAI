import { useState, useEffect, useCallback } from 'react';
import {
  Camera, Bell, Globe, Shield, User, Save, RotateCcw,
  Monitor, Wifi, AlertTriangle,
  CheckCircle, ChevronDown, ChevronUp, Sun, Moon,
  Send, Mail, Building2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type { Lang } from '../../i18n/strings';
import { cameraBackendService, type BackendHealth } from '../../services/cameraBackendService';
import { BranchSection } from '../../components/settings/BranchSection';

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

const LANGUAGE_OPTIONS = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
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
  language: 'tr',
  timezone: 'Europe/Istanbul',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  theme: 'dark',
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
    <div className="surface-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <h3 className="text-base font-semibold text-ink-0">{title}</h3>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-ink-3" />
        ) : (
          <ChevronDown className="w-5 h-5 text-ink-3" />
        )}
      </button>
      {isOpen && <div className="px-5 pb-5 border-t border-white/[0.06] pt-4">{children}</div>}
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
        <span className="text-sm font-medium text-ink-1 group-hover:text-ink-0 transition-colors">
          {label}
        </span>
        {description && (
          <p className="text-xs text-ink-3 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-surface-1 ${
          checked ? 'bg-brand-500' : 'bg-ink-5'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
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
          <span className="text-sm font-medium text-ink-1">{label}</span>
          {description && (
            <p className="text-xs text-ink-3 mt-0.5">{description}</p>
          )}
        </div>
        <span className="text-sm font-mono tabular-nums font-semibold text-brand-300 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded">
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
        className="w-full h-2 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-brand-500"
      />
      <div className="flex justify-between text-[10px] font-mono text-ink-4 mt-1 tabular-nums">
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
      <label className="block text-sm font-medium text-ink-1 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-white/[0.08] rounded-lg text-sm bg-surface-2/60 text-ink-0 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-colors"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-surface-2 text-ink-1">{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { lang, setLang, t } = useLanguage();

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
    emailNotifications: true,
    notifySeverity: 'high' as string,
    dailySummaryEnabled: false,
    dailySummaryTime: '09:00',
  });
  const [channelStatus, setChannelStatus] = useState<{
    email: { configured: boolean; connected: boolean };
  } | null>(null);
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

  // Keep regional.language in sync with the active language context
  useEffect(() => {
    if (regional.language !== lang) {
      setRegional(prev => ({ ...prev, language: lang }));
    }
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Save All ────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      saveSettings('camera', camera);
      saveSettings('notifications', notifications);
      saveSettings('regional', regional);

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
      } catch { /* optional */ }

      try {
        await fetch(`${API_URL}/api/notifications/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            emailNotifications: channels.emailNotifications,
            notifySeverity: channels.notifySeverity,
            dailySummaryEnabled: channels.dailySummaryEnabled,
            dailySummaryTime: channels.dailySummaryTime,
          }),
        });
      } catch { /* optional */ }

      setHasChanges(false);
      showToast('success', t('settings.savedOk'));
    } catch {
      showToast('error', t('settings.savedFail'));
    } finally {
      setSaving(false);
    }
  }, [camera, notifications, regional, profile, channels, showToast, t]);

  // ─── Reset All ───────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setCamera(DEFAULT_CAMERA);
    setNotifications(DEFAULT_NOTIFICATIONS);
    setRegional(DEFAULT_REGIONAL);
    showToast('warning', t('settings.resetToDefaults'));
  }, [showToast, t]);

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
          <h1 className="text-2xl font-display font-semibold tracking-tight text-ink-0">{t('settings.title')}</h1>
          <p className="text-sm text-ink-3 mt-1">{t('settings.subtitle')}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleReset}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-ink-1 bg-surface-2/60 border border-white/[0.08] rounded-lg hover:bg-white/[0.04] hover:border-white/[0.12] transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            {t('settings.reset')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-brand-500 to-accent-500 rounded-xl hover:shadow-glow-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            {t('settings.saveChanges')}
          </button>
        </div>
      </div>

      {/* System Status Banner — compact */}
      <div className={`rounded-xl px-4 py-2.5 flex items-center justify-between border ${
        backendHealth?.status === 'ready'
          ? 'bg-success-500/8 border-success-500/20'
          : backendHealth?.status === 'loading'
          ? 'bg-warning-500/8 border-warning-500/20'
          : 'bg-danger-500/8 border-danger-500/20'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          {backendHealth?.status === 'ready' ? (
            <CheckCircle className="w-4 h-4 text-success-400 flex-shrink-0" />
          ) : backendHealth?.status === 'loading' ? (
            <div className="w-4 h-4 border-2 border-warning-500/30 border-t-warning-500 rounded-full animate-spin flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-danger-400 flex-shrink-0" />
          )}
          <p className={`text-xs font-medium truncate ${
            backendHealth?.status === 'ready' ? 'text-success-300'
              : backendHealth?.status === 'loading' ? 'text-warning-300'
              : 'text-danger-300'
          }`}>
            {backendHealth?.status === 'ready'
              ? t('settings.system.online.detail', { fps: backendHealth.fps.toFixed(1) })
              : backendHealth?.status === 'loading'
              ? t('settings.system.loading.phase', { phase: backendHealth.phase })
              : (backendHealth?.error || t('settings.system.offline.detail'))}
          </p>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-[0.18em] bg-success-500/10 text-success-300 flex-shrink-0">
          <Wifi className="w-3 h-3 mr-1" /> {t('common.live')}
        </span>
      </div>

      {/* Branches */}
      <SettingsSection
        title={t('settings.branches.title')}
        icon={Building2}
        iconBg="bg-violet-500/10"
        iconColor="text-violet-300"
      >
        <BranchSection />
      </SettingsSection>

      {/* Camera Settings */}
      <SettingsSection
        title={t('settings.camera.title')}
        icon={Camera}
        iconBg="bg-brand-500/10"
        iconColor="text-brand-300"
      >
        <div className="space-y-1">
          <Slider
            label={t('settings.camera.sensitivity')}
            description={t('settings.camera.sensitivityDesc')}
            value={camera.detectionSensitivity}
            onChange={(v) => updateCamera('detectionSensitivity', v)}
            min={10}
            max={100}
            unit="%"
          />

          <Slider
            label={t('settings.camera.threshold')}
            description={t('settings.camera.thresholdDesc')}
            value={Math.round(camera.confidenceThreshold * 100)}
            onChange={(v) => updateCamera('confidenceThreshold', v / 100)}
            min={10}
            max={95}
            unit="%"
          />

          <Slider
            label={t('settings.camera.frameSkip')}
            description={t('settings.camera.frameSkipDesc')}
            value={camera.frameSkip}
            onChange={(v) => updateCamera('frameSkip', v)}
            min={1}
            max={5}
          />

          <Select
            label={t('settings.camera.resolution')}
            value={camera.inputResolution}
            onChange={(v) => updateCamera('inputResolution', v as CameraSettings['inputResolution'])}
            options={[
              { value: '320', label: t('settings.camera.resolution320') },
              { value: '416', label: t('settings.camera.resolution416') },
              { value: '640', label: t('settings.camera.resolution640') },
            ]}
          />

          <Slider
            label={t('settings.camera.maxDetect')}
            description={t('settings.camera.maxDetectDesc')}
            value={camera.maxDetections}
            onChange={(v) => updateCamera('maxDetections', v)}
            min={5}
            max={100}
          />

          <div className="border-t border-white/[0.06] mt-3 pt-3 space-y-1">
            <Toggle
              label={t('settings.camera.bbox')}
              description={t('settings.camera.bboxDesc')}
              checked={camera.showBoundingBoxes}
              onChange={(v) => updateCamera('showBoundingBoxes', v)}
            />
            <Toggle
              label={t('settings.camera.demographics')}
              description={t('settings.camera.demographicsDesc')}
              checked={camera.showDemographics}
              onChange={(v) => updateCamera('showDemographics', v)}
            />
            <Toggle
              label={t('settings.camera.zone')}
              description={t('settings.camera.zoneDesc')}
              checked={camera.showZoneOverlay}
              onChange={(v) => updateCamera('showZoneOverlay', v)}
            />
          </div>
        </div>
      </SettingsSection>

      {/* Notification Settings */}
      <SettingsSection
        title={t('settings.notif.title')}
        icon={Bell}
        iconBg="bg-success-500/10"
        iconColor="text-success-400"
      >
        <div className="space-y-1">
          <Toggle
            label={t('settings.notif.push')}
            description={t('settings.notif.pushDesc')}
            checked={notifications.enablePush}
            onChange={(v) => updateNotifications('enablePush', v)}
          />
          <Toggle
            label={t('settings.notif.sound')}
            description={t('settings.notif.soundDesc')}
            checked={notifications.enableSound}
            onChange={(v) => updateNotifications('enableSound', v)}
          />

          <div className="border-t border-white/[0.06] mt-3 pt-3">
            <p className="text-[10px] font-mono font-semibold text-ink-3 uppercase tracking-[0.18em] mb-2">{t('settings.notif.alertTypes')}</p>
            <Toggle
              label={t('settings.notif.surge')}
              description={t('settings.notif.surgeDesc')}
              checked={notifications.crowdSurgeAlerts}
              onChange={(v) => updateNotifications('crowdSurgeAlerts', v)}
            />
            <Toggle
              label={t('settings.notif.occupancy')}
              description={t('settings.notif.occupancyDesc')}
              checked={notifications.occupancyAlerts}
              onChange={(v) => updateNotifications('occupancyAlerts', v)}
            />
            <Toggle
              label={t('settings.notif.demoTrend')}
              description={t('settings.notif.demoTrendDesc')}
              checked={notifications.demographicTrends}
              onChange={(v) => updateNotifications('demographicTrends', v)}
            />
            <Toggle
              label={t('settings.notif.system')}
              description={t('settings.notif.systemDesc')}
              checked={notifications.systemAlerts}
              onChange={(v) => updateNotifications('systemAlerts', v)}
            />
          </div>

          <div className="border-t border-white/[0.06] mt-3 pt-3">
            <Slider
              label={t('settings.notif.occupancyThreshold')}
              description={t('settings.notif.occupancyThresholdDesc')}
              value={notifications.occupancyThreshold}
              onChange={(v) => updateNotifications('occupancyThreshold', v)}
              min={50}
              max={100}
              unit="%"
            />
          </div>

          <div className="border-t border-white/[0.06] mt-3 pt-3">
            <Toggle
              label={t('settings.notif.quiet')}
              description={t('settings.notif.quietDesc')}
              checked={notifications.quietHoursEnabled}
              onChange={(v) => updateNotifications('quietHoursEnabled', v)}
            />
            {notifications.quietHoursEnabled && (
              <div className="flex items-center space-x-3 mt-2 ml-1">
                <div>
                  <label className="block text-xs text-ink-3 mb-1">{t('settings.notif.from')}</label>
                  <input
                    type="time"
                    value={notifications.quietHoursStart}
                    onChange={(e) => updateNotifications('quietHoursStart', e.target.value)}
                    className="px-2 py-1.5 border border-white/[0.08] bg-surface-2/60 text-ink-0 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
                <span className="text-ink-4 mt-5">—</span>
                <div>
                  <label className="block text-xs text-ink-3 mb-1">{t('settings.notif.to')}</label>
                  <input
                    type="time"
                    value={notifications.quietHoursEnd}
                    onChange={(e) => updateNotifications('quietHoursEnd', e.target.value)}
                    className="px-2 py-1.5 border border-white/[0.08] bg-surface-2/60 text-ink-0 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Notification Channels ── */}
          <div className="border-t border-white/[0.06] mt-3 pt-3">
            <p className="text-[10px] font-mono font-semibold text-ink-3 uppercase tracking-[0.18em] mb-3">{t('settings.channels.title')}</p>

            <div className="mb-4">
              <label className="block text-sm text-ink-1 mb-1">{t('settings.channels.severity')}</label>
              <p className="text-xs text-ink-3 mb-2">{t('settings.channels.severityDesc')}</p>
              <select
                value={channels.notifySeverity}
                onChange={(e) => setChannels(prev => ({ ...prev, notifySeverity: e.target.value }))}
                className="w-full px-3 py-2 border border-white/[0.08] bg-surface-2/60 text-ink-0 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/30"
              >
                <option value="low">{t('settings.channels.severity.low')}</option>
                <option value="medium">{t('settings.channels.severity.medium')}</option>
                <option value="high">{t('settings.channels.severity.high')}</option>
                <option value="critical">{t('settings.channels.severity.critical')}</option>
              </select>
            </div>

            <div className="surface-card p-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-4 h-4 text-warning-400" />
                <span className="text-sm font-medium text-ink-0">{t('settings.channels.email')}</span>
                {channelStatus?.email.connected && (
                  <span className="text-xs text-success-400 ml-auto">{t('settings.channels.emailConnected')}</span>
                )}
                {channelStatus && !channelStatus.email.configured && (
                  <span className="text-xs text-ink-4 ml-auto">{t('settings.channels.emailNotSet')}</span>
                )}
              </div>
              <Toggle
                label={t('settings.channels.emailEnabled')}
                description={t('settings.channels.emailDesc')}
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
                        showToast(data.success ? 'success' : 'error', data.success ? t('settings.channels.testSent') : (data.error || t('settings.channels.testFailed')));
                      } catch { showToast('error', t('settings.channels.connectError')); }
                      setTestingEmail(false);
                    }}
                    disabled={testingEmail}
                    className="px-3 py-2 bg-warning-500 text-white rounded-lg text-xs font-semibold hover:bg-warning-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    {testingEmail ? t('settings.channels.testing') : t('settings.channels.testEmail')}
                  </button>
                </div>
              )}
            </div>

            <div className="surface-card p-4">
              <Toggle
                label={t('settings.channels.summary')}
                description={t('settings.channels.summaryDesc')}
                checked={channels.dailySummaryEnabled}
                onChange={(v) => setChannels(prev => ({ ...prev, dailySummaryEnabled: v }))}
              />
              {channels.dailySummaryEnabled && (
                <div className="mt-2">
                  <label className="block text-xs text-ink-3 mb-1">{t('settings.channels.summaryTime')}</label>
                  <input
                    type="time"
                    value={channels.dailySummaryTime}
                    onChange={(e) => setChannels(prev => ({ ...prev, dailySummaryTime: e.target.value }))}
                    className="px-2 py-1.5 border border-white/[0.08] bg-surface-2/60 text-ink-0 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Regional Settings */}
      <SettingsSection
        title={t('settings.regional.title')}
        icon={Globe}
        iconBg="bg-violet-500/10"
        iconColor="text-violet-400"
      >
        <div className="space-y-1">
          <Select
            label={t('settings.language')}
            value={lang}
            onChange={(v) => {
              const next = (v === 'en' ? 'en' : 'tr') as Lang;
              setLang(next);
              updateRegional('language', next);
              showToast('success', t('settings.languageSaved'));
            }}
            options={LANGUAGE_OPTIONS}
          />
          <Select
            label={t('settings.regional.timezone')}
            value={regional.timezone}
            onChange={(v) => updateRegional('timezone', v)}
            options={TIMEZONES}
          />
          <Select
            label={t('settings.regional.dateFormat')}
            value={regional.dateFormat}
            onChange={(v) => updateRegional('dateFormat', v)}
            options={DATE_FORMATS}
          />
          <div className="py-2">
            <label className="block text-sm font-medium text-ink-1 mb-1.5">{t('settings.regional.timeFormat')}</label>
            <div className="flex items-center bg-surface-2/60 border border-white/[0.08] rounded-lg p-1 w-fit gap-0.5">
              <button
                onClick={() => updateRegional('timeFormat', '12h')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                  regional.timeFormat === '12h'
                    ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30'
                    : 'text-ink-3 hover:text-ink-0 border border-transparent'
                }`}
              >
                12h
              </button>
              <button
                onClick={() => updateRegional('timeFormat', '24h')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
                  regional.timeFormat === '24h'
                    ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30'
                    : 'text-ink-3 hover:text-ink-0 border border-transparent'
                }`}
              >
                24h
              </button>
            </div>
          </div>
          <div className="py-2">
            <label className="block text-sm font-medium text-ink-1 mb-1.5">{t('settings.regional.theme')}</label>
            <div className="flex items-center bg-surface-2/60 border border-white/[0.08] rounded-lg p-1 w-fit gap-0.5">
              <button
                onClick={() => updateRegional('theme', 'light')}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all flex items-center space-x-1.5 ${
                  regional.theme === 'light'
                    ? 'bg-warning-500/20 text-warning-300 border border-warning-500/30'
                    : 'text-ink-3 hover:text-ink-0 border border-transparent'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>{t('settings.regional.theme.light')}</span>
              </button>
              <button
                onClick={() => updateRegional('theme', 'dark')}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all flex items-center space-x-1.5 ${
                  regional.theme === 'dark'
                    ? 'bg-brand-500/20 text-brand-200 border border-brand-500/30'
                    : 'text-ink-3 hover:text-ink-0 border border-transparent'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>{t('settings.regional.theme.dark')}</span>
              </button>
              <button
                onClick={() => updateRegional('theme', 'system')}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all flex items-center space-x-1.5 ${
                  regional.theme === 'system'
                    ? 'bg-ink-5/40 text-ink-1 border border-white/20'
                    : 'text-ink-3 hover:text-ink-0 border border-transparent'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>{t('settings.regional.theme.system')}</span>
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* User Profile */}
      <SettingsSection
        title={t('settings.profile.title')}
        icon={User}
        iconBg="bg-warning-500/10"
        iconColor="text-warning-400"
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-1 mb-1.5">{t('settings.profile.firstName')}</label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-white/[0.08] bg-surface-2/60 text-ink-0 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50"
                placeholder={t('settings.profile.firstNamePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-1 mb-1.5">{t('settings.profile.lastName')}</label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-3 py-2 border border-white/[0.08] bg-surface-2/60 text-ink-0 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50"
                placeholder={t('settings.profile.lastNamePlaceholder')}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-1 mb-1.5">{t('settings.profile.email')}</label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-3 py-2 border border-white/[0.08] rounded-lg text-sm bg-surface-2/40 text-ink-3 cursor-not-allowed"
            />
            <p className="text-xs text-ink-4 mt-1">{t('settings.profile.emailHint')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-1 mb-1.5">{t('settings.profile.role')}</label>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-mono font-semibold uppercase tracking-[0.18em] bg-brand-500/10 text-brand-200 border border-brand-500/25">
              {profile.role}
            </span>
          </div>
        </div>
      </SettingsSection>

      {/* Security */}
      <SettingsSection
        title={t('settings.security.title')}
        icon={Shield}
        iconBg="bg-danger-500/10"
        iconColor="text-danger-400"
        defaultOpen={false}
      >
        <div className="space-y-3">
          <button
            onClick={() => { setShowPasswordForm(!showPasswordForm); setPasswordError(''); setPasswordSuccess(false); }}
            className="w-full px-4 py-2.5 bg-surface-2/60 text-ink-1 rounded-lg text-sm font-medium hover:bg-white/[0.04] transition-colors border border-white/[0.08] text-left"
          >
            {showPasswordForm ? t('settings.security.cancelChange') : t('settings.security.changePwd')}
          </button>

          {showPasswordForm && (
            <div className="space-y-3 p-4 bg-surface-2/60 rounded-lg border border-white/[0.08]">
              <div>
                <label className="block text-xs font-medium text-ink-3 mb-1">{t('settings.security.currentPwd')}</label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm(p => ({ ...p, current: e.target.value }))}
                  className="w-full px-3 py-2 border border-white/[0.08] rounded-lg text-sm bg-surface-1/60 text-ink-0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-3 mb-1">{t('settings.security.newPwd')}</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-white/[0.08] rounded-lg text-sm bg-surface-1/60 text-ink-0"
                  placeholder={t('settings.security.newPwdHint')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-3 mb-1">{t('settings.security.confirmPwd')}</label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                  className="w-full px-3 py-2 border border-white/[0.08] rounded-lg text-sm bg-surface-1/60 text-ink-0"
                />
              </div>
              {passwordError && <p className="text-xs text-danger-400">{passwordError}</p>}
              {passwordSuccess && <p className="text-xs text-success-400">{t('settings.security.pwdSuccess')}</p>}
              <button
                onClick={async () => {
                  setPasswordError('');
                  if (passwordForm.newPassword !== passwordForm.confirm) {
                    setPasswordError(t('settings.security.pwdMismatch'));
                    return;
                  }
                  if (passwordForm.newPassword.length < 8) {
                    setPasswordError(t('settings.security.pwdTooShort'));
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
                      setPasswordError(data.error || t('settings.security.pwdFailed'));
                    }
                  } catch {
                    setPasswordError(t('settings.channels.connectError'));
                  }
                }}
                className="w-full px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-xl text-sm font-semibold hover:shadow-glow-brand transition-all"
              >
                {t('settings.security.updatePwd')}
              </button>
            </div>
          )}

          <div className="relative">
            <button className="w-full px-4 py-2.5 bg-surface-2/40 text-ink-4 rounded-lg text-sm font-medium border border-white/[0.06] text-left cursor-not-allowed" disabled>
              {t('settings.security.twoFactor')}
            </button>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase tracking-[0.18em] text-ink-4 bg-surface-1/80 border border-white/[0.08] px-2 py-0.5 rounded">{t('common.comingSoon')}</span>
          </div>
          <div className="relative">
            <button className="w-full px-4 py-2.5 bg-surface-2/40 text-ink-4 rounded-lg text-sm font-medium border border-white/[0.06] text-left cursor-not-allowed" disabled>
              {t('settings.security.apiKeys')}
            </button>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase tracking-[0.18em] text-ink-4 bg-surface-1/80 border border-white/[0.08] px-2 py-0.5 rounded">{t('common.comingSoon')}</span>
          </div>
        </div>
      </SettingsSection>

      {/* About */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink-0">{t('settings.about.title')}</h3>
            <p className="text-xs text-ink-3 mt-0.5">{t('settings.about.subtitle')}</p>
          </div>
          <span className="text-xs text-ink-4 font-mono">v1.0.0-beta</span>
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
