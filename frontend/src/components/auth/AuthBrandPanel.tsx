import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Activity, Clock, Gauge, ShieldCheck, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import markSvg from '../../assets/mark.svg';

/**
 * Editorial auth brand panel — mirrors the Landing hero visual language:
 *   aurora mesh + conic orb + grid floor + tape-cornered camera feed with
 *   silhouettes, bounding-box pulses, and a scan beam.
 *
 * Copy is i18n-backed (ds.auth.brand.*). Counters tick deterministically
 * (no Math.random) so recordings stay stable.
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
    const id = window.setInterval(() => setTick((x) => x + 1), 1500);
    return () => window.clearInterval(id);
  }, [reduce]);

  const visitors = 3 + (tick % 3);
  const dwell = (4.2 + (tick % 5) * 0.1).toFixed(1);
  const fps = 58 + (tick % 5);

  return (
    <div className="relative h-full w-full overflow-hidden bg-navy">
      {/* Atmospheric layers */}
      <div className="absolute inset-0 aurora-bg drift opacity-90" aria-hidden />
      <div className="absolute inset-0 grid-floor-flat grid-floor-fade opacity-50" aria-hidden />
      <div
        className="absolute top-1/3 -left-20 w-[520px] h-[520px] conic-orb opacity-40"
        aria-hidden
      />

      <div className="relative z-10 h-full w-full flex flex-col justify-between p-10 lg:p-14">
        {/* Top: logo + tagline */}
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <img src={markSvg} alt="" className="w-10 h-10 object-contain" />
            <span className="text-xl font-display font-bold tracking-tight text-ink-0">ObservAI</span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-14 max-w-md"
          >
            <div className="ds-pill ds-pill-brand mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-300 live-dot" />
              {heading || t('ds.auth.brand.pill')}
            </div>
            <h2
              className="headline-xl text-ink-0"
              style={{ fontSize: 'clamp(2rem, 4.5vw, 3.25rem)' }}
            >
              {t('ds.auth.brand.title.pre')}
              <span className="italic tg-violet">{t('ds.auth.brand.title.italic')}</span>
              {t('ds.auth.brand.title.post')}
            </h2>
            <p className="mt-4 text-ink-2 leading-relaxed">
              {subheading || t('ds.auth.brand.subtitle')}
            </p>
          </motion.div>
        </div>

        {/* Middle: live preview mock (tape-corner, silhouettes, scan) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-8 ds-card-bright rounded-2xl p-3 mock-shadow"
        >
          <div className="flex items-center justify-between px-2 pb-2 text-[11px] text-ink-3 font-mono">
            <div className="flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-danger-500/70" />
                <span className="w-2 h-2 rounded-full bg-warning-500/70" />
                <span className="w-2 h-2 rounded-full bg-success-500/70" />
              </span>
              <span className="ml-2">{t('ds.auth.brand.mock.url')}</span>
            </div>
            <span className="ds-pill ds-pill-live text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-success-400 live-dot" />
              LIVE
            </span>
          </div>

          <div className="relative aspect-[16/9] rounded-xl overflow-hidden tape-corner border border-white/10">
            <span className="tape-span" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(600px 300px at 30% 40%, #26314a, #0b1226 60%), linear-gradient(180deg, #0e1836 0%, #070d1e 100%)',
              }}
            />
            <div
              className="absolute inset-x-0 bottom-0 h-2/5"
              style={{
                background:
                  'repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 2px, transparent 2px 80px), linear-gradient(180deg, transparent, rgba(255,255,255,.04))',
                transform: 'perspective(500px) rotateX(55deg)',
                transformOrigin: 'bottom',
              }}
            />

            {/* Zones */}
            <div
              className="absolute left-[8%] top-[22%] w-[38%] h-[54%] rounded-lg"
              style={{ border: '1.5px dashed rgba(6,161,230,.5)', background: 'rgba(6,161,230,.06)' }}
            >
              <div className="absolute -top-2.5 left-0 ds-pill ds-pill-accent text-[9px]">
                {t('ds.hero.mock.zone.entry')}
              </div>
            </div>
            <div
              className="absolute right-[6%] top-[30%] w-[32%] h-[44%] rounded-lg"
              style={{
                border: '1.5px dashed rgba(154,77,255,.55)',
                background: 'rgba(154,77,255,.06)',
              }}
            >
              <div className="absolute -top-2.5 right-0 ds-pill ds-pill-violet text-[9px]">
                {t('ds.hero.mock.zone.tables')}
              </div>
            </div>

            {/* Silhouettes + bounding boxes */}
            <PanelSilhouette x="20%" y="40%" w={50} h={110} tone="accent" delay="0s" />
            <PanelSilhouette x="50%" y="34%" w={54} h={122} tone="violet" delay="0.4s" />
            <PanelSilhouette x="74%" y="46%" w={48} h={100} tone="accent" delay="0.9s" />

            <div className="scan-beam" />

            <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between text-[10px] font-mono">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-danger-500 live-dot" />
                <span className="text-ink-1">{t('ds.auth.brand.mock.rec')}</span>
              </div>
              <div className="text-ink-3 tabular-nums">{String(14 + ((tick % 59) / 60)).slice(0, 5)}</div>
            </div>
            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] font-mono">
              <div className="flex gap-3">
                <span className="text-accent-200">{t('ds.hero.mock.feed.people', { n: visitors })}</span>
                <span className="text-ink-3">{t('ds.hero.mock.feed.zones', { n: 2 })}</span>
              </div>
              <div className="text-ink-3">{t('ds.auth.brand.mock.perf')}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
            <MiniMetric icon={Users} tone="brand" label={t('auth.brand.metricVisitors')} value={`${visitors}`} />
            <MiniMetric icon={Clock} tone="accent" label={t('auth.brand.metricDwell')} value={`${dwell}m`} />
            <MiniMetric icon={Gauge} tone="violet" label={t('auth.brand.metricFps')} value={`${fps}`} />
          </div>
        </motion.div>

        {/* Bottom: trust strip — mono caps */}
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-mono uppercase tracking-[0.15em] text-ink-3">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-success-400" />
            {t('ds.auth.brand.trust.kvkk')}
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-accent-300" />
            {t('ds.auth.brand.trust.trt')}
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-brand-300" />
            {t('ds.auth.brand.trust.local')}
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelSilhouette({
  x,
  y,
  w,
  h,
  tone,
  delay,
}: {
  x: string;
  y: string;
  w: number;
  h: number;
  tone: 'accent' | 'violet';
  delay: string;
}) {
  const bbox = tone === 'accent' ? 'border-accent-400/70 bbox-accent' : 'border-violet-400/70 bbox-violet';
  const silCls = tone === 'accent' ? 'text-accent-200/70' : 'text-violet-300/70';
  return (
    <div className="absolute" style={{ left: x, top: y, width: `${w}px`, height: `${h}px` }}>
      <div className={`absolute inset-0 border-2 rounded ${bbox}`} style={{ animationDelay: delay }} />
      <svg viewBox="0 0 50 120" className={`absolute inset-0 w-full h-full ${silCls}`}>
        <circle cx="25" cy="20" r="10" fill="currentColor" opacity=".5" />
        <rect x="14" y="32" width="22" height="50" rx="6" fill="currentColor" opacity=".55" />
        <rect x="15" y="82" width="8" height="30" rx="3" fill="currentColor" opacity=".5" />
        <rect x="27" y="82" width="8" height="30" rx="3" fill="currentColor" opacity=".5" />
      </svg>
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
      <div className="text-sm font-display font-semibold text-ink-0 mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
