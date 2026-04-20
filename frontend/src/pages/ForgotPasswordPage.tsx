import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Loader2, Mail, ShieldCheck } from 'lucide-react';
import AuthBrandPanel from '../components/auth/AuthBrandPanel';
import { useLanguage } from '../contexts/LanguageContext';
import markSvg from '../assets/mark.svg';

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (response.ok) setSuccess(true);
      else setError(data.error || t('auth.forgot.error'));
    } catch {
      setError(t('auth.forgot.connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 text-ink-1 flex flex-col lg:grid lg:grid-cols-12">
      <aside className="hidden lg:block lg:col-span-6 xl:col-span-7 relative">
        <AuthBrandPanel
          heading={t('auth.forgot.heading')}
          subheading={t('auth.forgot.subheading')}
        />
        <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />
      </aside>

      <main className="relative lg:col-span-6 xl:col-span-5 flex items-center justify-center px-6 py-10 lg:py-16">
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 py-5 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <img src={markSvg} alt="ObservAI" className="w-8 h-8" />
            <span className="font-display font-bold text-ink-0">ObservAI</span>
          </Link>
          <Link to="/login" className="text-sm text-brand-300 hover:text-brand-200">{t('auth.forgot.loginShort')}</Link>
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
                {t('auth.forgot.title')}
              </h1>
              <p className="mt-2 text-sm text-ink-3">
                {t('auth.forgot.subtitle')}
              </p>
            </div>

            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-mono text-brand-300 uppercase tracking-[0.14em]">
                    {t('auth.forgot.email')}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('auth.forgot.emailPlaceholder')}
                      required
                      autoComplete="email"
                      className="w-full bg-surface-1 border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-4 text-sm text-ink-0 placeholder-ink-4 focus:outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 text-white font-semibold shadow-glow-brand hover:shadow-glow-accent transition-shadow flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('auth.forgot.submitCTA')}
                </button>
              </form>
            ) : (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-success-500/15 border border-success-500/30 mb-4">
                  <CheckCircle className="w-7 h-7 text-success-400" />
                </div>
                <h3 className="text-lg font-semibold text-ink-0 mb-2">{t('auth.forgot.successTitle')}</h3>
                <p className="text-sm text-ink-2 mb-2 leading-relaxed">
                  {t('auth.forgot.successBody').split('{email}').map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && <span className="text-ink-0 font-medium">{email}</span>}
                    </span>
                  ))}
                </p>
                <p className="mt-4 text-xs text-ink-3 inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-success-400" />
                  {t('auth.forgot.devNote')}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-danger-500/10 border border-danger-500/40">
                <p className="text-sm text-danger-400 text-center">{error}</p>
              </div>
            )}

            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-brand-300 hover:text-brand-200 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('auth.forgot.backToLogin')}
              </Link>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
