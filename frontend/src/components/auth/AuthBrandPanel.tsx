import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Activity, Clock, Eye, Gauge, ShieldCheck, Sparkles, Users, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import markSvg from '../../assets/mark.svg';

/**
 * Branded left panel shared by Login, Register, ForgotPassword and ResetPassword.
 *
 * Serves three purposes:
 *  1. Tells a new user in one glance what ObservAI is.
 *  2. Gives a visual anchor so the auth flow feels like part of the dashboard.
 *  3. Doubles as a photogenic asset for Instagram/YouTube captures.
 *
 * The mock metrics tick on a timer but with deterministic arithmetic so recordings
 * stay stable — no Math.random() in the render path.
 */
export default function AuthBrandPanel({
  heading,
  subheading,
}: {
  heading?: string;
  subheading?: string;
}) {
  const { t } = useLanguage();
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1500);
    return () => window.clearInterval(id);
  }, [reduce]);

  const boxes = useMemo(
    () => [
      { id: 1, x: 10, y: 52, w: 14, h: 30, tone: 'violet' as const, label: 'K | 25-34' },
      { id: 2, x: 34, y: 48, w: 13, h: 32, tone: 'accent' as const, label: 'E | 35-44' },
      { id: 3, x: 58, y: 50, w: 14, h: 30, tone: 'accent' as const, label: 'E | 18-24' },
      { id: 4, x: 78, y: 46, w: 12, h: 32, tone: 'violet' as const, label: 'K | 25-34' },
    ],
    [],
  );

  const visitors = 8 + (tick % 4);
  const dwell = (4.2 + ((tick % 5) * 0.1)).toFixed(1);
  const fps = 48 + (tick % 5);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Layered atmospheric background */}
      <div className="absolute inset-0 bg-surface-0" aria-hidden />
      <div className="absolute inset-0 bg-radial-aurora opacity-80" aria-hidden />
      <div className="absolute inset-0 grid-floor opacity-60" aria-hidden />
      <div className="absolute -top-32 -left-24 w-96 h-96 bg-brand-500/20 blur-3xl rounded-full animate-aurora-drift" aria-hidden />
      <div className="absolute bottom-0 -right-24 w-96 h-96 bg-violet-500/20 blur-3xl rounded-full animate-aurora-drift" aria-hidden />

      <div className="relative z-10 h-full w-full flex flex-col justify-between p-10 lg:p-14">
        {/* Top: logo + tagline */}
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <img src={markSvg} alt="ObservAI" className="w-10 h-10 object-contain" />
            <span className="text-xl font-display font-bold tracking-tight text-ink-0">ObservAI</span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-14 max-w-md"
          >
            <div className="pill-brand mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              {heading || t('auth.brand.pill')}
            </div>
            <h2 className="font-display text-3xl lg:text-4xl text-gradient-brand leading-tight">
              {t('auth.brand.headline')}
            </h2>
            <p className="mt-4 text-ink-2 leading-relaxed">
              {subheading || t('auth.brand.copy')}
            </p>
          </motion.div>
        </div>

        {/* Middle: live preview card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-10 surface-card-elevated rounded-2xl p-3"
        >
          <div className="flex items-center justify-between px-1 pb-2 text-xs text-ink-3 font-mono">
            <span>CAMERA 01 / ENTRANCE</span>
            <span className="pill-live text-[10px] px-2 py-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-70" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-400" />
              </span>
              LIVE
            </span>
          </div>

          <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-gradient-to-br from-surface-3 via-surface-2 to-surface-1">
            <div className="absolute inset-0 bg-grid-faint bg-grid-sm opacity-[0.18] animate-grid-flow" />
            <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/40 via-surface-2/30 to-transparent" />
            <div className="scan-bar" />
            {boxes.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                className="absolute"
                style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
              >
                <div
                  className={`w-full h-full rounded-md border-2 ${
                    b.tone === 'violet' ? 'border-violet-400' : 'border-accent-400'
                  } animate-bbox-pulse`}
                />
                <div
                  className={`absolute -top-5 left-0 text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    b.tone === 'violet' ? 'bg-violet-500/90 text-white' : 'bg-accent-500/90 text-white'
                  }`}
                >
                  {b.label}
                </div>
              </motion.div>
            ))}
            <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
              <Eye className="w-3 h-3 text-accent-300" />
              <span className="text-[11px] font-mono text-ink-1">{visitors}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
            <MiniMetric icon={Users} tone="brand" label={t('auth.brand.metricVisitors')} value={`${visitors}`} />
            <MiniMetric icon={Clock} tone="accent" label={t('auth.brand.metricDwell')} value={`${dwell}m`} />
            <MiniMetric icon={Gauge} tone="violet" label={t('auth.brand.metricFps')} value={`${fps}`} />
          </div>
        </motion.div>

        {/* Bottom: trust strip */}
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-3">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-success-400" /> KVKK / GDPR
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-accent-300" /> TensorRT FP16
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-brand-300" /> {t('auth.brand.trust.local')}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: 'brand' | 'accent' | 'violet';
  label: string;
  value: string;
}) {
  const toneColor =
    tone === 'brand' ? 'text-brand-300' : tone === 'accent' ? 'text-accent-300' : 'text-violet-400';
  return (
    <div className="rounded-lg bg-surface-1/70 border border-white/[0.06] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-ink-3 font-mono">
        <Icon className={`w-3 h-3 ${toneColor}`} />
        {label}
      </div>
      <div className="text-sm font-display font-semibold text-ink-0 mt-0.5">{value}</div>
    </div>
  );
}
