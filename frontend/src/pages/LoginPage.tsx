import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import markSvg from '../assets/mark.svg';

/* Login — applies the ObservAI Design System editorial language:
 *   • btn-primary gradient with traveling shine on hover
 *   • Instrument Serif italic accent in the title ("Welcome back")
 *   • ds-pill-brand technology badge above the heading
 *   • aurora + grid-floor mobile backdrop matching the landing hero
 */

export default function LoginPage() {
  const [email, setEmail] = useState(() => localStorage.getItem('rememberedEmail') || '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('rememberMe') === 'true');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, demoLogin } = useAuth();
  const { t } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const success = await login(email, password, rememberMe);
    if (success) {
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberedEmail');
        localStorage.removeItem('rememberMe');
      }
      navigate('/dashboard');
    } else {
      setError(t('auth.login.error.invalid'));
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    setError('');
    const success = await demoLogin();
    if (success) navigate('/dashboard');
    else {
      setError(t('auth.login.error.demo'));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 text-ink-1 flex flex-col lg:grid lg:grid-cols-12">
      {/* Left: branded panel (hidden on mobile to keep focus on form) */}
      <aside className="hidden lg:block lg:col-span-6 xl:col-span-7 relative">
        <AuthBrandPanel />
        {/* Hard divider to separate from the form area */}
        <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />
      </aside>

      {/* Right: form */}
      <main className="relative lg:col-span-6 xl:col-span-5 flex items-center justify-center px-6 py-10 lg:py-16">
        {/* Mobile: show a compact header with logo + tagline */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 py-5 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <img src={markSvg} alt="ObservAI" className="w-8 h-8" />
            <span className="font-display font-bold text-ink-0">ObservAI</span>
          </Link>
          <Link to="/register" className="text-sm text-brand-300 hover:text-brand-200">{t('auth.login.signupLink')}</Link>
        </div>

        {/* Aurora backdrop for mobile — matches the landing hero */}
        <div className="absolute inset-0 lg:hidden aurora-bg drift opacity-80 pointer-events-none" aria-hidden />
        <div className="absolute inset-0 lg:hidden grid-floor-flat grid-floor-fade opacity-50 pointer-events-none" aria-hidden />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full max-w-md"
        >
          <div className="surface-card-elevated p-8 lg:p-10">
            <div className="mb-8">
              <div className="ds-pill ds-pill-brand mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-300 live-dot" />
                {t('ds.auth.login.pill')}
              </div>
              <h1
                className="headline-xl text-ink-0"
                style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}
              >
                {t('ds.auth.login.title.pre')}
                <span className="italic tg-violet">{t('ds.auth.login.title.italic')}</span>
                {t('ds.auth.login.title.post')}
              </h1>
              <p className="mt-3 text-sm text-ink-3 leading-relaxed">
                {t('ds.auth.login.subtitle')}
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <Field
                label={t('auth.login.email')}
                icon={Mail}
                type="email"
                placeholder={t('auth.login.emailPlaceholder')}
                value={email}
                onChange={(v) => setEmail(v)}
                autoComplete="email"
                required
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-brand-300 uppercase tracking-[0.14em]">
                    {t('auth.login.password')}
                  </label>
                  <Link to="/forgot-password" className="text-xs text-accent-300 hover:text-accent-200 transition-colors">
                    {t('auth.login.forgot')}
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    required
                    className="w-full bg-surface-1 border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-11 text-sm text-ink-0 placeholder-ink-4 focus:outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-1 transition-colors"
                    aria-label={showPw ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-ink-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-surface-1 border border-white/10 text-brand-500 focus:ring-brand-500/40"
                />
                {t('auth.login.remember')}
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {t('auth.login.submit')}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-danger-500/10 border border-danger-500/40">
                <p className="text-sm text-danger-400 text-center">{error}</p>
              </div>
            )}

            <div className="relative my-6 flex items-center">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="px-3 text-[10px] uppercase tracking-[0.18em] text-ink-3 font-mono">{t('auth.login.or')}</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <button
              onClick={handleDemoLogin}
              type="button"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/15 hover:border-violet-500/50 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Activity className="w-4 h-4" />
              {t('auth.login.demo')}
            </button>

            <p className="mt-6 text-center text-sm text-ink-3">
              {t('auth.login.noAccount')}{' '}
              <Link to="/register" className="text-brand-300 hover:text-brand-200 font-medium transition-colors">
                {t('auth.login.startTrial')}
              </Link>
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  type: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-mono text-brand-300 uppercase tracking-[0.14em]">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="w-full bg-surface-1 border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-4 text-sm text-ink-0 placeholder-ink-4 focus:outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20 transition-all"
        />
      </div>
    </div>
  );
}
