import { useState, useEffect, useCallback } from 'react';
import {
  Bell, Shield, User, Save,
  AlertTriangle, CheckCircle, Wifi,
  ChevronDown, ChevronUp,
  Send, Mail, Building2, Globe
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type { Lang } from '../../i18n/strings';
import { cameraBackendService, type BackendHealth } from '../../services/cameraBackendService';
import { BranchSection } from '../../components/settings/BranchSection';

// Issue #7: settings dramatically simplified. Removed: camera detection
// sliders (Python YAML-driven, never wired), regional timezone/dateFormat/
// timeFormat/theme (UI prefs that never applied anything), legacy push/sound/
// quiet-hours/per-type alert toggles (NotificationsPage already owns these),
// "coming soon" 2FA + API keys placeholders. Kept: Branches, Profile,
// password change, language, email channel + severity threshold + daily
// summary, About.

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const LANGUAGE_OPTIONS = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
];

function SettingsSection({
  title, icon: Icon, iconBg, iconColor, children, defaultOpen = true,
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
        {isOpen ? <ChevronUp className="w-5 h-5 text-ink-3" /> : <ChevronDown className="w-5 h-5 text-ink-3" />}
      </button>
      {isOpen && <div className="px-5 pb-5 border-t border-white/[0.06] pt-4">{children}</div>}
    </div>
  );
}

function Toggle({
  checked, onChange, label, description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start justify-between cursor-pointer group py-2">
      <div className="flex-1 mr-4">
        <span className="text-sm font-medium text-ink-1 group-hover:text-ink-0 transition-colors">{label}</span>
        {description && <p className="text-xs text-ink-3 mt-0.5">{description}</p>}
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

function Select({
  value, onChange, options, label,
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

export default function SettingsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { lang, setLang, t } = useLanguage();

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

  useEffect(() => { setHasChanges(true); }, [profile, channels]);

  useEffect(() => {
    const unsubscribe = cameraBackendService.onBackendStatus((health) => setBackendHealth(health));
    cameraBackendService.checkHealth();
    return unsubscribe;
  }, []);

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
        if (statusRes.ok) setChannelStatus(await statusRes.json());
      } catch { /* backend may not be running */ }
    }
    loadChannels();
  }, []);

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

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      try {
        await fetch(`${API_URL}/api/users/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ firstName: profile.firstName, lastName: profile.lastName }),
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
  }, [profile, channels, showToast, t]);

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

      {/* System Status Banner */}
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

      {/* Language */}
      <SettingsSection
        title={t('settings.regional.title')}
        icon={Globe}
        iconBg="bg-violet-500/10"
        iconColor="text-violet-400"
      >
        <Select
          label={t('settings.language')}
          value={lang}
          onChange={(v) => {
            const next = (v === 'en' ? 'en' : 'tr') as Lang;
            setLang(next);
            showToast('success', t('settings.languageSaved'));
          }}
          options={LANGUAGE_OPTIONS}
        />
      </SettingsSection>

      {/* Notifications: severity + email + daily summary */}
      <SettingsSection
        title={t('settings.notif.title')}
        icon={Bell}
        iconBg="bg-success-500/10"
        iconColor="text-success-400"
      >
        <div className="space-y-3">
          <div>
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

          <div className="surface-card p-4">
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

      {/* Security: password change only */}
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
        </div>
      </SettingsSection>

      {/* About */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink-0">{t('settings.about.title')}</h3>
            <p className="text-xs text-ink-3 mt-0.5">{t('settings.about.subtitle')}</p>
          </div>
          <span className="text-xs text-ink-4 font-mono">v1.0.0</span>
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
