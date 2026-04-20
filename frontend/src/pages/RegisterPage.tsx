import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import markSvg from '../assets/mark.svg';

export default function RegisterPage() {
  const { checkAuth } = useAuth();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    password: '',
    confirmPassword: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.register.error.mismatch'));
      return;
    }
    if (formData.password.length < 8) {
      setError(t('auth.register.error.short'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          company: formData.company,
          password: formData.password,
        }),
      });

      if (response.ok) {
        await checkAuth();
        navigate('/dashboard');
      } else {
        const data = await response.json();
        setError(data.error || t('auth.register.error.failed'));
      }
    } catch (err) {
      console.error(err);
      setError(t('auth.register.error.unexpected'));
    } finally {
      setIsLoading(false);
    }
  };

  const setField = (k: keyof typeof formData, v: string) => setFormData((f) => ({ ...f, [k]: v }));

  const pwStrength = passwordStrength(formData.password, t);

  return (
    <div className="min-h-screen bg-surface-0 text-ink-1 flex flex-col lg:grid lg:grid-cols-12">
      <aside className="hidden lg:block lg:col-span-6 xl:col-span-7 relative">
        <AuthBrandPanel
          heading={t('auth.register.brandHeading')}
          subheading={t('auth.register.brandSubheading')}
        />
        <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />
      </aside>

      <main className="relative lg:col-span-6 xl:col-span-5 flex items-center justify-center px-6 py-10 lg:py-16">
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 py-5 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <img src={markSvg} alt="ObservAI" className="w-8 h-8" />
            <span className="font-display font-bold text-ink-0">ObservAI</span>
          </Link>
          <Link to="/login" className="text-sm text-brand-300 hover:text-brand-200">{t('auth.register.loginLink')}</Link>
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
                {t('auth.register.title')}
              </h1>
              <p className="mt-2 text-sm text-ink-3">
                {t('auth.register.subtitle')}
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <Field label={t('auth.register.name')} icon={User} type="text" placeholder={t('auth.register.namePlaceholder')}
                     value={formData.name} onChange={(v) => setField('name', v)} autoComplete="name" required />
              <Field label={t('auth.login.email')} icon={Mail} type="email" placeholder={t('auth.login.emailPlaceholder')}
                     value={formData.email} onChange={(v) => setField('email', v)} autoComplete="email" required />
              <Field label={t('auth.register.company')} icon={Building} type="text" placeholder={t('auth.register.companyPlaceholder')}
                     value={formData.company} onChange={(v) => setField('company', v)} autoComplete="organization" required />

              <div className="space-y-2">
                <label className="text-[11px] font-mono text-brand-300 uppercase tracking-[0.14em]">{t('auth.login.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setField('password', e.target.value)}
                    placeholder={t('auth.register.passwordPlaceholder')}
                    autoComplete="new-password"
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
                {formData.password && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full transition-all ${pwStrength.barClass}`}
                        style={{ width: `${pwStrength.pct}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-mono uppercase tracking-wider ${pwStrength.textClass}`}>
                      {pwStrength.label}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-mono text-brand-300 uppercase tracking-[0.14em]">{t('auth.register.confirmPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4" />
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setField('confirmPassword', e.target.value)}
                    placeholder={t('auth.register.confirmPasswordPlaceholder')}
                    autoComplete="new-password"
                    required
                    className="w-full bg-surface-1 border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-11 text-sm text-ink-0 placeholder-ink-4 focus:outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-1 transition-colors"
                    aria-label={showConfirmPw ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
                  >
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 text-white font-semibold shadow-glow-brand hover:shadow-glow-accent transition-shadow flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    {t('auth.register.submit')}
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

            <ul className="mt-6 grid grid-cols-1 gap-2 text-xs text-ink-3">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-success-400" /> {t('auth.register.perk1')}</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-success-400" /> {t('auth.register.perk2')}</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-success-400" /> {t('auth.register.perk3')}</li>
            </ul>

            <p className="mt-6 text-center text-sm text-ink-3">
              {t('auth.register.haveAccount')}{' '}
              <Link to="/login" className="text-brand-300 hover:text-brand-200 font-medium transition-colors">
                {t('auth.register.loginLink')}
              </Link>
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function Field({
  label, icon: Icon, type, placeholder, value, onChange, autoComplete, required,
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

function passwordStrength(pw: string, t: (k: string) => string) {
  if (!pw) return { pct: 0, label: '', barClass: '', textClass: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { pct: 20, label: t('auth.register.strength.weak'), barClass: 'bg-danger-500', textClass: 'text-danger-400' };
  if (score <= 2) return { pct: 40, label: t('auth.register.strength.medium'), barClass: 'bg-warning-500', textClass: 'text-warning-400' };
  if (score <= 3) return { pct: 65, label: t('auth.register.strength.good'), barClass: 'bg-accent-500', textClass: 'text-accent-300' };
  if (score <= 4) return { pct: 85, label: t('auth.register.strength.strong'), barClass: 'bg-success-500', textClass: 'text-success-400' };
  return { pct: 100, label: t('auth.register.strength.veryStrong'), barClass: 'bg-success-400', textClass: 'text-success-400' };
}
