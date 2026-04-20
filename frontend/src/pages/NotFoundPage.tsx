import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Home, Search } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import markSvg from '../assets/mark.svg';

export default function NotFoundPage() {
  const { t } = useLanguage();

  return (
    <div className="relative min-h-screen bg-surface-0 text-ink-1 overflow-hidden flex items-center justify-center px-6">
      {/* Background atmosphere */}
      <div className="absolute inset-0 bg-radial-aurora opacity-70 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 grid-floor opacity-60 pointer-events-none" aria-hidden />
      <div className="absolute -top-24 -left-24 w-[500px] h-[500px] bg-brand-500/15 blur-3xl rounded-full animate-aurora-drift pointer-events-none" aria-hidden />
      <div className="absolute -bottom-32 -right-24 w-[500px] h-[500px] bg-violet-500/15 blur-3xl rounded-full animate-aurora-drift pointer-events-none" aria-hidden />

      <Link to="/" className="absolute top-6 left-6 flex items-center gap-2.5 group">
        <img src={markSvg} alt="ObservAI" className="w-8 h-8 object-contain" />
        <span className="font-display font-bold text-ink-0">ObservAI</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center max-w-xl"
      >
        {/* 404 mock "lost camera signal" card */}
        <div className="relative mx-auto w-full max-w-md mb-10">
          <div className="absolute -inset-6 bg-radial-aurora blur-2xl opacity-70 pointer-events-none" />
          <div className="relative surface-card-elevated p-4">
            <div className="flex items-center justify-between text-xs text-ink-3 font-mono mb-3 px-1">
              <span>{t('notfound.cameraLabel')}</span>
              <span className="inline-flex items-center gap-1.5 pill bg-danger-500/10 border-danger-500/30 text-danger-400 text-[10px] px-2 py-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger-400 opacity-70" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-danger-400" />
                </span>
                {t('notfound.noSignal')}
              </span>
            </div>
            <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-surface-3 via-surface-2 to-surface-1 flex items-center justify-center">
              <div className="absolute inset-0 bg-grid-faint bg-grid-sm opacity-[0.14] animate-grid-flow" />
              <div className="scan-bar" aria-hidden />
              <div className="relative flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-surface-2/70 border border-white/10 flex items-center justify-center">
                  <Camera className="w-7 h-7 text-ink-3" />
                </div>
                <div className="font-mono text-xs tracking-[0.2em] text-ink-3 uppercase">{t('notfound.streamLost')}</div>
              </div>
            </div>
          </div>
        </div>

        <h1 className="font-display text-8xl font-semibold text-gradient-brand mb-3">{t('notfound.title')}</h1>
        <h2 className="font-display text-2xl font-semibold text-ink-0 mb-3">{t('notfound.heading')}</h2>
        <p className="text-ink-2 leading-relaxed mb-8 max-w-md mx-auto">
          {t('notfound.subtitle')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-brand-500 to-accent-500 text-white font-semibold shadow-glow-brand hover:shadow-glow-accent transition-shadow"
          >
            <Home className="w-4 h-4" />
            {t('notfound.backHome')}
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white/5 border border-white/10 text-ink-1 hover:bg-white/10 transition-colors"
          >
            <Search className="w-4 h-4 text-accent-300" />
            {t('notfound.backDashboard')}
          </Link>
        </div>

        <div className="mt-10 inline-flex items-center gap-2 text-xs text-ink-3">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>
            {t('notfound.helpLead')}{' '}
            <Link to="/dashboard/camera-selection" className="text-brand-300 hover:text-brand-200">
              {t('notfound.helpLink')}
            </Link>
          </span>
        </div>
      </motion.div>
    </div>
  );
}
