import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import { useLanguage } from '../contexts/LanguageContext';
import markSvg from '../assets/mark.svg';

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) setError(t('auth.reset.error.invalidToken'));
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) return setError(t('auth.reset.error.mismatch'));
    if (password.length < 8) return setError(t('auth.reset.error.short'));
    if (!token) return setError(t('auth.reset.error.missingToken'));

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setError(data.error || t('auth.reset.error.failed'));
      }
    } catch {
      setError(t('auth.reset.connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 text-ink-1 flex flex-col lg:grid lg:grid-cols-12">
      <aside className="hidden lg:block lg:col-span-6 xl:col-span-7 relative">
        <AuthBrandPanel
          heading={t('auth.reset.brandHeading')}
          subheading={t('auth.reset.brandSubheading')}
        />
        <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />
      </aside>

      <main className="relative lg:col-span-6 xl:col-span-5 flex items-center justify-center px-6 py-10 lg:py-16">
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 py-5 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <img src={markSvg} alt="ObservAI" className="w-8 h-8" />
            <span className="font-display font-bold text-ink-0">ObservAI</span>
          </Link>
          <Link to="/login" className="text-sm text-brand-300 hover:text-brand-200">{t('auth.reset.loginShort')}</Link>
        </div>

        <div className="absolute inset-0 lg:hidden bg-radial-aurora opacity-60 pointer-events-none" aria-hidden />
        <div className="absolute inset-0 lg:hidden grid-floor opacity-50 pointer-events-none" aria-hidden />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full max-w-md"
        >
          <div className="surface-card-elevated p-8 lg:p-10">
            <div className="mb-8">
              <h1 className="font-display text-2xl lg:text-3xl font-semibold text-ink-0">
                {t('auth.reset.titleHeading')}
              </h1>
              <p className="mt-2 text-sm text-ink-3">{t('auth.reset.subtitleHint')}</p>
            </div>

            {!token ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-danger-500/15 border border-danger-500/30 mb-4">
                  <AlertCircle className="w-7 h-7 text-danger-400" />
                </div>
                <h3 className="text-lg font-semibold text-ink-0 mb-2">{t('auth.reset.invalidHeading')}</h3>
                <p className="text-sm text-ink-2 mb-6 leading-relaxed">
                  {t('auth.reset.invalidBody')}
                </p>
                <Link to="/forgot-password" className="text-brand-300 hover:text-brand-200 font-medium transition-colors">
                  {t('auth.reset.requestNew')}
                </Link>
              </div>
            ) : !success ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <PasswordField
                  label={t('auth.reset.password')}
                  value={password}
                  onChange={setPassword}
                  show={showPw}
                  onToggleShow={() => setShowPw((s) => !s)}
                  placeholder={t('auth.reset.passwordPlaceholder2')}
                  showLabel={t('auth.login.showPassword')}
                  hideLabel={t('auth.login.hidePassword')}
                />
                <PasswordField
                  label={t('auth.register.confirmPassword')}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  show={showPw}
                  onToggleShow={() => setShowPw((s) => !s)}
                  placeholder={t('auth.reset.confirmPasswordPlaceholder2')}
                  showLabel={t('auth.login.showPassword')}
                  hideLabel={t('auth.login.hidePassword')}
                />

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 text-white font-semibold shadow-glow-brand hover:shadow-glow-accent transition-shadow flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      {t('auth.reset.submitCTA')}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-success-500/15 border border-success-500/30 mb-4">
                  <CheckCircle className="w-7 h-7 text-success-400" />
                </div>
                <h3 className="text-lg font-semibold text-ink-0 mb-2">{t('auth.reset.successHeading')}</h3>
                <p className="text-sm text-ink-2 mb-6 leading-relaxed">
                  {t('auth.reset.successBody')}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-danger-500/10 border border-danger-500/40">
                <p className="text-sm text-danger-400 text-center">{error}</p>
              </div>
            )}

            {token && !success && (
              <div className="mt-6 text-center">
                <Link to="/login" className="text-sm text-brand-300 hover:text-brand-200 font-medium transition-colors">
                  {t('auth.reset.backToLogin')}
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function PasswordField({
  label, value, onChange, show, onToggleShow, placeholder, showLabel, hideLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-mono text-brand-300 uppercase tracking-[0.14em]">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          minLength={8}
          className="w-full bg-surface-1 border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-11 text-sm text-ink-0 placeholder-ink-4 focus:outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20 transition-all"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-1 transition-colors"
          aria-label={show ? hideLabel : showLabel}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
