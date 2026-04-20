import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Activity,
  BarChart3,
  Bell,
  Brain,
  Camera,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  Clock,
  Coffee,
  Eye,
  Gauge,
  LayoutGrid,
  LineChart,
  Lock,
  MapPin,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
  Users,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import markSvg from '../assets/mark.svg';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

/* ----------------------------------------------------------------------------------
 * Decorative live-feed mockup for the hero. Shows the core product story at a glance:
 *  — camera frame with pulsing bounding boxes
 *  — live visitor / dwell counters that tick upward
 *  — realistic demographic split bar
 *
 * All data is synthetic and deterministic enough that the page looks the same in
 * recordings. We avoid random() on the render path so Instagram/YouTube captures
 * don't flicker between takes.
 * ----------------------------------------------------------------------------------*/
function LivePreviewMockup({ t }: { t: TFn }) {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1100);
    return () => window.clearInterval(id);
  }, [reduce]);

  const boxes = useMemo(
    () => [
      { id: 1, x: 12, y: 54, w: 14, h: 26, label: 'K | 25-34 | 42s', tone: 'violet' as const },
      { id: 2, x: 32, y: 48, w: 13, h: 30, label: 'E | 35-44 | 11s', tone: 'accent' as const },
      { id: 3, x: 58, y: 50, w: 14, h: 30, label: 'K | 18-24 | 03s', tone: 'violet' as const },
      { id: 4, x: 76, y: 44, w: 13, h: 34, label: 'E | 25-34 | 27s', tone: 'accent' as const },
    ],
    [],
  );

  // Tick-driven counters give the mock a pulse without looking fake.
  const visitors = 3 + (tick % 4);
  const avgDwell = 3.4 + ((tick % 6) * 0.1);
  const maleShare = 54 + ((tick % 3) - 1);
  const femaleShare = 100 - maleShare;

  return (
    <div className="relative w-full max-w-xl mx-auto">
      {/* Aurora glow behind the preview. */}
      <div className="absolute -inset-10 bg-radial-aurora blur-2xl opacity-80 pointer-events-none" aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="relative rounded-3xl gradient-border bg-surface-1/80 backdrop-blur-xl shadow-elevated overflow-hidden"
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-surface-2/60">
          <div className="flex items-center gap-2 text-ink-2 text-xs font-mono">
            <span className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-danger-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-warning-500/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-success-500/70" />
            </span>
            <span className="ml-2 text-ink-3">observai.local/dashboard</span>
          </div>
          <div className="flex items-center gap-1.5 pill-live">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-70" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-400" />
            </span>
            LIVE
          </div>
        </div>

        {/* Camera feed + overlays */}
        <div className="relative aspect-video bg-gradient-to-br from-surface-3 via-surface-2 to-surface-1 overflow-hidden">
          {/* Mock scene grid — subtle floor / depth cue */}
          <div className="absolute inset-0 bg-grid-faint bg-grid-sm opacity-[0.18] animate-grid-flow" aria-hidden />
          {/* Fake wall/floor shapes to sell the scene without needing an image */}
          <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/40 via-surface-2/30 to-transparent" />
          <div className="absolute left-0 right-0 top-0 h-[42%] bg-gradient-to-b from-brand-900/25 via-transparent to-transparent" />

          {/* Scan bar */}
          <div className="scan-bar" aria-hidden />

          {/* Bounding boxes */}
          {boxes.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.12 }}
              className="absolute"
              style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
            >
              <div
                className={`w-full h-full rounded-md border-2 ${
                  b.tone === 'violet' ? 'border-violet-400' : 'border-accent-400'
                } animate-bbox-pulse`}
              />
              <div
                className={`absolute -top-6 left-0 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  b.tone === 'violet'
                    ? 'bg-violet-500/85 text-white'
                    : 'bg-accent-500/90 text-white'
                }`}
              >
                {b.label}
              </div>
            </motion.div>
          ))}

          {/* Detection counter chip */}
          <div className="absolute right-3 bottom-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <Eye className="w-3.5 h-3.5 text-accent-300" />
            <span className="text-xs font-mono text-ink-1">
              {visitors} <span className="text-ink-3">{t('landing.mockup.detected')}</span>
            </span>
          </div>
        </div>

        {/* Metrics row — mimics the real dashboard widgets */}
        <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/[0.06] bg-surface-2/40">
          <Metric label={t('landing.mockup.current')} value={`${visitors}`} sub={t('landing.mockup.currentSub')} icon={Users} tone="brand" />
          <Metric label={t('landing.mockup.dwell')} value={avgDwell.toFixed(1)} sub={t('landing.mockup.dwellSub')} icon={Clock} tone="accent" />
          <Metric label={t('landing.mockup.throughput')} value={`${28 + (tick % 3)}`} sub={t('landing.mockup.throughputSub')} icon={Gauge} tone="violet" />
        </div>

        {/* Demographic split */}
        <div className="px-4 py-4 border-t border-white/[0.06] bg-surface-1/60">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-ink-3 uppercase tracking-wider font-mono">{t('landing.mockup.gender')}</span>
            <span className="text-ink-2 font-mono">{maleShare}% / {femaleShare}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${maleShare}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-accent-500 to-brand-400"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${femaleShare}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
              className="h-full bg-gradient-to-r from-violet-500 to-violet-400"
            />
          </div>
        </div>
      </motion.div>

      {/* Floating AI insight card — extra visual drama */}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.7 }}
        className="hidden sm:flex absolute -right-4 -bottom-6 w-56 items-start gap-3 p-3 rounded-2xl surface-card-elevated"
      >
        <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-brand-300" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-brand-300 font-mono">{t('landing.mockup.aiInsight')}</div>
          <div className="text-xs text-ink-1 mt-1 leading-snug">
            {t('landing.mockup.aiInsightBody')}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'brand' | 'accent' | 'violet';
}) {
  const toneColor =
    tone === 'brand' ? 'text-brand-300' : tone === 'accent' ? 'text-accent-300' : 'text-violet-400';
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-3 font-mono">
        <Icon className={`w-3 h-3 ${toneColor}`} />
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-lg font-display font-semibold text-ink-0">{value}</span>
        <span className="text-[11px] text-ink-3">{sub}</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------------
 * Page
 * ----------------------------------------------------------------------------------*/
export default function LandingPage() {
  const { t } = useLanguage();
  return (
    <div className="relative min-h-screen bg-surface-0 text-ink-1 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-radial-aurora opacity-70 pointer-events-none" aria-hidden />
      <div
        className="absolute inset-0 opacity-60 pointer-events-none grid-floor"
        aria-hidden
      />
      <div
        className="absolute -top-32 -left-32 w-[640px] h-[640px] rounded-full bg-brand-500/10 blur-3xl animate-aurora-drift pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute top-40 -right-40 w-[640px] h-[640px] rounded-full bg-violet-500/10 blur-3xl animate-aurora-drift pointer-events-none"
        aria-hidden
      />

      <Navbar t={t} />

      <main className="relative">
        <Hero t={t} />
        <StatsStrip t={t} />
        <Features t={t} />
        <LiveDataShowcase t={t} />
        <TableIntelligence t={t} />
        <HowItWorks t={t} />
        <WhyObservAI t={t} />
        <CTASection t={t} />
      </main>

      <Footer t={t} />
    </div>
  );
}

function Navbar({ t }: { t: TFn }) {
  return (
    <nav className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5">
      <Link to="/" className="flex items-center gap-2.5 group">
        <div className="relative">
          <img src={markSvg} alt="ObservAI" className="w-9 h-9 object-contain" />
          <div className="absolute inset-0 rounded-lg shadow-glow-brand opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <span className="text-xl font-display font-bold tracking-tight">ObservAI</span>
      </Link>

      <div className="hidden md:flex items-center gap-8 text-sm text-ink-2">
        <a href="#features" className="hover:text-ink-0 transition-colors">{t('landing.nav.features')}</a>
        <a href="#live" className="hover:text-ink-0 transition-colors">{t('landing.nav.live')}</a>
        <a href="#how" className="hover:text-ink-0 transition-colors">{t('landing.nav.how')}</a>
        <a href="#why" className="hover:text-ink-0 transition-colors">{t('landing.nav.why')}</a>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/login"
          className="hidden sm:inline-flex text-sm font-medium text-ink-2 hover:text-ink-0 transition-colors px-3 py-2"
        >
          {t('landing.nav.login')}
        </Link>
        <Link
          to="/register"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-500 text-white font-medium text-sm shadow-glow-brand hover:bg-brand-400 transition-colors"
        >
          {t('landing.nav.start')}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </nav>
  );
}

function Hero({ t }: { t: TFn }) {
  return (
    <section className="relative z-10 px-6 md:px-10 pt-8 md:pt-16 pb-24">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="lg:col-span-7"
        >
          <div className="pill-brand mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            {t('landing.hero.badge')}
          </div>

          <h1 className="font-display text-display-xl text-gradient-brand mb-6">
            {t('landing.hero.title1')} <br className="hidden md:block" />{t('landing.hero.title2')}
          </h1>

          <p className="text-lg text-ink-2 max-w-xl mb-10 leading-relaxed">
            {t('landing.hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link
              to="/register"
              className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-brand-500 to-accent-500 text-white font-semibold shadow-glow-brand hover:shadow-glow-accent transition-shadow"
            >
              {t('landing.hero.cta.trial')}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/demo"
              className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white/5 border border-white/10 text-ink-1 hover:bg-white/10 transition-colors backdrop-blur-sm"
            >
              <PlayCircle className="w-4 h-4 text-accent-300" />
              {t('landing.hero.cta.demo')}
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-3">
            <TrustItem icon={ShieldCheck} label={t('landing.hero.trust.gdpr')} />
            <TrustItem icon={Zap} label={t('landing.hero.trust.fps')} />
            <TrustItem icon={Lock} label={t('landing.hero.trust.local')} />
          </div>
        </motion.div>

        <div className="lg:col-span-5">
          <LivePreviewMockup t={t} />
        </div>
      </div>
    </section>
  );
}

function TrustItem({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-accent-300" />
      <span>{label}</span>
    </div>
  );
}

function StatsStrip({ t }: { t: TFn }) {
  const stats = [
    { value: '50+', label: t('landing.stats.fps'), icon: Gauge },
    { value: '%99.4', label: t('landing.stats.accuracy'), icon: CheckCircle2 },
    { value: '2', label: t('landing.stats.languages'), icon: Eye },
    { value: '<100ms', label: t('landing.stats.latency'), icon: Zap },
  ];
  return (
    <section className="relative z-10 px-6 md:px-10">
      <div className="max-w-7xl mx-auto surface-card-elevated px-6 md:px-10 py-6 md:py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center text-brand-300">
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display text-2xl md:text-3xl font-semibold text-ink-0">{s.value}</div>
              <div className="text-sm text-ink-3 mt-0.5">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Features({ t }: { t: TFn }) {
  const features = [
    {
      icon: Users,
      title: t('landing.features.demo.title'),
      desc: t('landing.features.demo.desc'),
      tone: 'brand' as const,
    },
    {
      icon: MapPin,
      title: t('landing.features.zone.title'),
      desc: t('landing.features.zone.desc'),
      tone: 'accent' as const,
    },
    {
      icon: Clock,
      title: t('landing.features.dwell.title'),
      desc: t('landing.features.dwell.desc'),
      tone: 'violet' as const,
    },
    {
      icon: Brain,
      title: t('landing.features.ai.title'),
      desc: t('landing.features.ai.desc'),
      tone: 'brand' as const,
    },
    {
      icon: Bell,
      title: t('landing.features.notif.title'),
      desc: t('landing.features.notif.desc'),
      tone: 'accent' as const,
    },
    {
      icon: LineChart,
      title: t('landing.features.trend.title'),
      desc: t('landing.features.trend.desc'),
      tone: 'violet' as const,
    },
  ];

  return (
    <section id="features" className="relative z-10 px-6 md:px-10 py-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeading
          eyebrow={t('landing.features.eyebrow')}
          title={t('landing.features.title')}
          lead={t('landing.features.lead')}
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="group relative p-6 rounded-2xl surface-card hover:border-white/[0.12] transition-colors"
            >
              <FeatureIcon icon={f.icon} tone={f.tone} />
              <h3 className="mt-4 text-lg font-semibold text-ink-0">{f.title}</h3>
              <p className="mt-2 text-sm text-ink-2 leading-relaxed">{f.desc}</p>
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-br from-brand-500/5 to-transparent" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureIcon({
  icon: Icon,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: 'brand' | 'accent' | 'violet';
}) {
  const bg =
    tone === 'brand'
      ? 'bg-brand-500/15 border-brand-500/30 text-brand-300'
      : tone === 'accent'
      ? 'bg-accent-500/15 border-accent-500/30 text-accent-300'
      : 'bg-violet-500/15 border-violet-500/30 text-violet-400';
  return (
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${bg}`}>
      <Icon className="w-5 h-5" />
    </div>
  );
}

function LiveDataShowcase({ t }: { t: TFn }) {
  const items = [
    { icon: Camera, label: t('landing.liveData.item1'), metric: t('landing.liveData.metric1'), tone: 'brand' as const },
    { icon: Activity, label: t('landing.liveData.item2'), metric: t('landing.liveData.metric2'), tone: 'accent' as const },
    { icon: Users, label: t('landing.liveData.item3'), metric: t('landing.liveData.metric3'), tone: 'violet' as const },
    { icon: TrendingUp, label: t('landing.liveData.item4'), metric: t('landing.liveData.metric4'), tone: 'brand' as const },
  ];
  return (
    <section id="live" className="relative z-10 px-6 md:px-10 py-24">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <div className="pill-brand mb-5">
              <Activity className="w-3.5 h-3.5" />
              {t('landing.liveData.pill')}
            </div>
            <h2 className="font-display text-display-lg text-gradient-cool mb-5">
              {t('landing.liveData.title1')}<br />{t('landing.liveData.title2')}
            </h2>
            <p className="text-ink-2 leading-relaxed mb-8">
              {t('landing.liveData.lead')}
            </p>
            <div className="space-y-3">
              {items.map((it) => (
                <div
                  key={it.label}
                  className="flex items-center justify-between gap-4 p-3 rounded-xl bg-surface-1/60 border border-white/[0.06]"
                >
                  <div className="flex items-center gap-3">
                    <FeatureIcon icon={it.icon} tone={it.tone} />
                    <span className="text-sm text-ink-1">{it.label}</span>
                  </div>
                  <span className="text-xs font-mono text-ink-3">{it.metric}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7">
            <DashboardMosaic t={t} />
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardMosaic({ t }: { t: TFn }) {
  return (
    <div className="relative">
      <div className="absolute -inset-8 bg-radial-aurora blur-3xl opacity-60 pointer-events-none" aria-hidden />
      <div className="relative grid grid-cols-6 grid-rows-4 gap-3 h-[420px]">
        {/* Main camera panel */}
        <div className="col-span-4 row-span-3 surface-card-elevated p-3 overflow-hidden relative">
          <div className="flex items-center justify-between text-xs text-ink-3 font-mono mb-2">
            <span>CAMERA 01 / ENTRANCE</span>
            <span className="pill-live">LIVE</span>
          </div>
          <div className="relative h-[calc(100%-28px)] rounded-lg overflow-hidden bg-gradient-to-br from-surface-3 to-surface-1">
            <div className="absolute inset-0 bg-grid-faint bg-grid-sm opacity-30 animate-grid-flow" />
            <div className="scan-bar" />
            {/* Stylized silhouettes */}
            {[0.18, 0.32, 0.5, 0.72].map((left, i) => (
              <div
                key={i}
                className="absolute bottom-4 w-10 h-20 rounded-t-[50%] bg-gradient-to-t from-accent-500/35 to-brand-400/60"
                style={{ left: `${left * 100}%` }}
              />
            ))}
            {/* Bboxes */}
            {[0.14, 0.28, 0.46, 0.68].map((x, i) => (
              <div
                key={i}
                className={`absolute bottom-2 w-14 h-28 rounded-md border-2 ${
                  i % 2 === 0 ? 'border-accent-400' : 'border-violet-400'
                } animate-bbox-pulse`}
                style={{ left: `${x * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* Visitor count */}
        <div className="col-span-2 row-span-1 surface-card-elevated p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-xs text-ink-3 uppercase tracking-wider font-mono">
            <Users className="w-3.5 h-3.5 text-brand-300" /> {t('landing.mosaic.current')}
          </div>
          <div className="font-display text-3xl text-gradient-cool">12</div>
          <div className="text-xs text-success-400">{t('landing.mosaic.currentDelta')}</div>
        </div>

        {/* Dwell */}
        <div className="col-span-2 row-span-1 surface-card-elevated p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-xs text-ink-3 uppercase tracking-wider font-mono">
            <Clock className="w-3.5 h-3.5 text-accent-300" /> {t('landing.mosaic.dwell')}
          </div>
          <div className="font-display text-3xl text-gradient-cool">4.8 <span className="text-sm text-ink-3">{t('landing.mosaic.dwellUnit')}</span></div>
          <div className="text-xs text-ink-3">{t('landing.mosaic.dwellLabel')}</div>
        </div>

        {/* Demographic bar */}
        <div className="col-span-2 row-span-1 surface-card-elevated p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-ink-3 uppercase tracking-wider font-mono">
            <BarChart3 className="w-3.5 h-3.5 text-violet-400" /> {t('landing.mosaic.gender')}
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
            <div className="h-full bg-gradient-to-r from-accent-500 to-brand-400" style={{ width: '56%' }} />
            <div className="h-full bg-gradient-to-r from-violet-500 to-violet-400" style={{ width: '44%' }} />
          </div>
          <div className="flex justify-between text-xs text-ink-3 font-mono">
            <span>{t('landing.mosaic.male')} 56%</span>
            <span>{t('landing.mosaic.female')} 44%</span>
          </div>
        </div>

        {/* Heatmap tile */}
        <div className="col-span-4 row-span-1 surface-card-elevated p-3 overflow-hidden">
          <div className="flex items-center justify-between text-xs text-ink-3 font-mono mb-2">
            <span>{t('landing.mosaic.heatmap')}</span>
            <span>7x7</span>
          </div>
          <div className="grid grid-cols-14 gap-[3px] h-[calc(100%-24px)]">
            {Array.from({ length: 42 }).map((_, i) => {
              // Deterministic pseudo-random intensity so the visual is stable in screenshots.
              const seed = ((i * 13) % 7) / 7;
              const intensity = Math.min(1, 0.12 + seed + (i % 5 === 0 ? 0.3 : 0));
              return (
                <div
                  key={i}
                  className="rounded-sm"
                  style={{
                    background: `linear-gradient(180deg, rgba(29,107,255,${intensity * 0.9}) 0%, rgba(154,77,255,${intensity * 0.6}) 100%)`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------------
 * TableIntelligence — animated showcase of the new Table Occupancy page.
 * Mirrors the Restaurant Vision AI screenshots that prompted this feature:
 * floor plan with status colors, plus a focus card cycling through "STATE",
 * "SEATED", "ORDERED", "FOOD", "DINERS", "SERVER", "TYPE" rows.
 * ----------------------------------------------------------------------------------*/
const SHOWCASE_TABLES = [
  { id: 11, x: 8,  y: 18, w: 16, h: 22, status: 'occupied' as const, diners: 4, stage: 'food', server: 'Mert',  type: 'Inside',  seated: '12:42', ordered: '12:48', food: '13:01' },
  { id: 12, x: 28, y: 18, w: 14, h: 22, status: 'empty' as const,    diners: 0, stage: 'empty', server: '—',     type: 'Inside',  seated: '—',     ordered: '—',     food: '—'     },
  { id: 15, x: 46, y: 18, w: 14, h: 22, status: 'occupied' as const, diners: 2, stage: 'ordered', server: 'Ada',  type: 'Window',  seated: '13:05', ordered: '13:12', food: '—'     },
  { id: 16, x: 64, y: 18, w: 14, h: 22, status: 'needs_cleaning' as const, diners: 0, stage: 'cleaning', server: 'Hakan', type: 'Window',  seated: '11:50', ordered: '11:55', food: '12:10' },
  { id: 22, x: 8,  y: 50, w: 16, h: 22, status: 'occupied' as const, diners: 3, stage: 'eating', server: 'Hakan', type: 'Patio',   seated: '13:18', ordered: '13:24', food: '13:38' },
  { id: 18, x: 28, y: 50, w: 14, h: 22, status: 'occupied' as const, diners: 1, stage: 'seated', server: 'Ada',   type: 'Bar',     seated: '13:42', ordered: '—',     food: '—'     },
  { id: 24, x: 46, y: 50, w: 14, h: 22, status: 'empty' as const,    diners: 0, stage: 'empty', server: '—',     type: 'Patio',   seated: '—',     ordered: '—',     food: '—'     },
  { id: 27, x: 64, y: 50, w: 14, h: 22, status: 'occupied' as const, diners: 2, stage: 'ordered', server: 'Mert', type: 'Inside',  seated: '13:20', ordered: '13:28', food: '—'     },
];

const SHOWCASE_STATUS_STYLES = {
  empty:           { fill: 'bg-success-500/15', border: 'border-success-500/40', dot: 'bg-success-400', text: 'text-success-300' },
  occupied:        { fill: 'bg-brand-500/15',   border: 'border-brand-500/50',   dot: 'bg-brand-400',   text: 'text-brand-200' },
  needs_cleaning:  { fill: 'bg-warning-500/15', border: 'border-warning-500/50', dot: 'bg-warning-400', text: 'text-warning-300' },
} as const;

function TableIntelligence({ t }: { t: TFn }) {
  const reduce = useReducedMotion();
  const occupiedIndices = SHOWCASE_TABLES.map((tb, i) => tb.status === 'occupied' ? i : -1).filter(i => i >= 0);
  const [focusIdx, setFocusIdx] = useState(occupiedIndices[0] ?? 0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setFocusIdx(prev => {
        const cur = occupiedIndices.indexOf(prev);
        const next = occupiedIndices[(cur + 1) % occupiedIndices.length];
        return next ?? 0;
      });
    }, 2800);
    return () => window.clearInterval(id);
  }, [reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const focused = SHOWCASE_TABLES[focusIdx];
  const focusedLabel =
    focused.status === 'occupied' ? t('landing.mosaic.stateOccupied') :
    focused.status === 'needs_cleaning' ? t('landing.mosaic.stateCleaning') :
    t('landing.mosaic.stateEmpty');

  const occupied = SHOWCASE_TABLES.filter(tb => tb.status === 'occupied').length;
  const occupancyPct = Math.round((occupied / SHOWCASE_TABLES.length) * 100);

  return (
    <section className="relative z-10 px-6 md:px-10 py-24">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5 lg:order-2">
            <div className="pill-brand mb-5">
              <LayoutGrid className="w-3.5 h-3.5" />
              {t('landing.tableIntel.pill')}
            </div>
            <h2 className="font-display text-display-lg text-gradient-cool mb-5">
              {t('landing.tableIntel.title1')}<br />{t('landing.tableIntel.title2')}
            </h2>
            <p className="text-ink-2 leading-relaxed mb-8">
              {t('landing.tableIntel.lead')}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <ShowcaseStat label={t('landing.tableIntel.occupancy')} value={`${occupancyPct}%`} tone="brand" />
              <ShowcaseStat label={t('landing.tableIntel.turnover')} value="3.2x" tone="accent" />
              <ShowcaseStat label={t('landing.tableIntel.avgStay')} value="42dk" tone="violet" />
            </div>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-ink-1 hover:bg-white/10 transition-colors text-sm"
            >
              {t('landing.tableIntel.cta')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="lg:col-span-7 lg:order-1">
            <div className="relative">
              <div className="absolute -inset-8 bg-radial-aurora blur-3xl opacity-50 pointer-events-none" aria-hidden />

              <div className="relative surface-card-elevated p-4 rounded-3xl">
                {/* Floor plan canvas */}
                <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-gradient-to-br from-surface-3 via-surface-2 to-surface-1 border border-white/[0.06]">
                  {/* Grid floor */}
                  <div className="absolute inset-0 bg-grid-faint bg-grid-sm opacity-30" aria-hidden />

                  {/* Heatmap glow under occupied tables */}
                  {SHOWCASE_TABLES.filter(t => t.status === 'occupied').map(t => (
                    <div
                      key={`heat-${t.id}`}
                      className="absolute pointer-events-none rounded-full blur-2xl"
                      style={{
                        left: `${t.x + t.w / 2}%`,
                        top: `${t.y + t.h / 2}%`,
                        transform: 'translate(-50%, -50%)',
                        width: `${t.w * 1.6}%`,
                        height: `${t.h * 1.6}%`,
                        background: `radial-gradient(circle, rgba(255,90,80,0.32) 0%, transparent 70%)`,
                      }}
                    />
                  ))}

                  {/* Tables */}
                  {SHOWCASE_TABLES.map((t, i) => {
                    const s = SHOWCASE_STATUS_STYLES[t.status];
                    const isFocused = i === focusIdx;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setFocusIdx(i)}
                        className={`absolute rounded-xl border ${s.fill} ${s.border} backdrop-blur-sm transition-all flex flex-col items-center justify-center text-center p-1 ${
                          isFocused ? 'ring-2 ring-accent-400 z-10 scale-105' : ''
                        }`}
                        style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%` }}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${t.status === 'needs_cleaning' ? 'animate-pulse' : ''}`} />
                          <span className="text-xs font-bold text-ink-1">T{t.id}</span>
                        </div>
                        {t.status === 'occupied' && (
                          <span className="text-[10px] text-ink-2 mt-0.5">{t.diners}p</span>
                        )}
                      </button>
                    );
                  })}

                  {/* Floating focus tag */}
                  <motion.div
                    key={focused.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-mono text-ink-1"
                  >
                    Focus: TABLE {focused.id}
                  </motion.div>
                </div>

                {/* State detail row */}
                <motion.div
                  key={`detail-${focused.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  <DetailChip label="STATE"   value={focusedLabel}                                  tone={focused.status === 'occupied' ? 'brand' : focused.status === 'needs_cleaning' ? 'warning' : 'success'} />
                  <DetailChip label="SEATED"  value={focused.seated}  icon={Coffee}                tone="brand" />
                  <DetailChip label="ORDERED" value={focused.ordered} icon={UtensilsCrossed}      tone={focused.ordered === '—' ? 'muted' : 'accent'} />
                  <DetailChip label="FOOD"    value={focused.food}    icon={ChefHat}              tone={focused.food === '—' ? 'muted' : 'violet'} />
                  <DetailChip label="DINERS"  value={String(focused.diners)} icon={Users}         tone="brand" />
                  <DetailChip label="SERVER"  value={focused.server}                              tone="muted" />
                  <DetailChip label="TYPE"    value={focused.type}                                tone="muted" />
                  <DetailChip label="STAGE"   value={focused.stage.toUpperCase()}                 tone="violet" />
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShowcaseStat({ label, value, tone }: { label: string; value: string; tone: 'brand' | 'accent' | 'violet' }) {
  const accent = tone === 'brand' ? 'text-brand-300' : tone === 'accent' ? 'text-accent-300' : 'text-violet-400';
  return (
    <div className="surface-card p-3">
      <div className={`text-xl font-display font-semibold ${accent}`}>{value}</div>
      <div className="text-[11px] text-ink-3 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function DetailChip({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone: 'brand' | 'accent' | 'violet' | 'success' | 'warning' | 'muted';
}) {
  const toneMap = {
    brand:   'bg-brand-500/10 border-brand-500/25 text-brand-200',
    accent:  'bg-accent-500/10 border-accent-500/25 text-accent-200',
    violet:  'bg-violet-500/10 border-violet-500/25 text-violet-300',
    success: 'bg-success-500/10 border-success-500/25 text-success-300',
    warning: 'bg-warning-500/10 border-warning-500/25 text-warning-300',
    muted:   'bg-white/[0.03] border-white/[0.08] text-ink-2',
  } as const;
  return (
    <div className={`px-3 py-2 rounded-lg border ${toneMap[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider opacity-80">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

function HowItWorks({ t }: { t: TFn }) {
  const steps = [
    { step: '01', title: t('landing.how.step1.title'), desc: t('landing.how.step1.desc'), icon: Camera },
    { step: '02', title: t('landing.how.step2.title'), desc: t('landing.how.step2.desc'), icon: MapPin },
    { step: '03', title: t('landing.how.step3.title'), desc: t('landing.how.step3.desc'), icon: Brain },
    { step: '04', title: t('landing.how.step4.title'), desc: t('landing.how.step4.desc'), icon: BarChart3 },
    { step: '05', title: t('landing.how.step5.title'), desc: t('landing.how.step5.desc'), icon: Sparkles },
  ];
  return (
    <section id="how" className="relative z-10 px-6 md:px-10 py-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeading
          eyebrow={t('landing.how.eyebrow')}
          title={t('landing.how.title')}
          lead={t('landing.how.lead')}
        />
        <div className="relative mt-14">
          <div className="hidden md:block absolute top-8 left-6 right-6 h-px bg-gradient-to-r from-brand-500/0 via-brand-500/40 to-violet-500/0" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative"
              >
                <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-surface-2 to-surface-1 border border-white/[0.08] shadow-card mx-auto">
                  <s.icon className="w-6 h-6 text-brand-300" />
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-brand-500 text-[10px] font-mono text-white shadow-glow-brand">
                    {s.step}
                  </span>
                </div>
                <h4 className="mt-5 text-center font-semibold text-ink-0">{s.title}</h4>
                <p className="mt-1 text-center text-sm text-ink-3 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyObservAI({ t }: { t: TFn }) {
  const cols = [
    {
      title: t('landing.why.col1.title'),
      items: [t('landing.why.col1.item1'), t('landing.why.col1.item2'), t('landing.why.col1.item3')],
    },
    {
      title: t('landing.why.col2.title'),
      items: [t('landing.why.col2.item1'), t('landing.why.col2.item2'), t('landing.why.col2.item3')],
    },
    {
      title: t('landing.why.col3.title'),
      items: [t('landing.why.col3.item1'), t('landing.why.col3.item2'), t('landing.why.col3.item3')],
    },
  ];
  return (
    <section id="why" className="relative z-10 px-6 md:px-10 py-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeading
          eyebrow={t('landing.why.eyebrow')}
          title={t('landing.why.title')}
          lead={t('landing.why.lead')}
        />
        <div className="grid md:grid-cols-3 gap-5 mt-12">
          {cols.map((c, i) => (
            <div key={c.title} className="surface-card p-6">
              <div className="flex items-center gap-2 text-brand-300 text-xs font-mono uppercase tracking-wider">
                <span className="font-display font-semibold text-ink-0 text-sm tracking-normal normal-case">
                  {c.title}
                </span>
              </div>
              <ul className="mt-4 space-y-3">
                {c.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm text-ink-2">
                    <CheckCircle2 className="w-4 h-4 text-success-400 shrink-0 mt-0.5" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
              {i === 0 && (
                <div className="mt-5 p-3 rounded-lg bg-success-500/10 border border-success-500/20 text-xs text-success-400">
                  {t('landing.why.kvkkPill')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection({ t }: { t: TFn }) {
  return (
    <section className="relative z-10 px-6 md:px-10 pb-24">
      <div className="max-w-7xl mx-auto relative overflow-hidden rounded-3xl surface-card-elevated px-8 md:px-12 py-12 md:py-16">
        <div className="absolute inset-0 bg-radial-aurora opacity-80 pointer-events-none" aria-hidden />
        <div className="relative grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="pill-live mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              {t('landing.cta.pill')}
            </div>
            <h3 className="font-display text-display-md text-gradient-brand mb-4">
              {t('landing.cta.title')}
            </h3>
            <p className="text-ink-2 leading-relaxed max-w-md">
              {t('landing.cta.lead')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:justify-end items-stretch sm:items-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-brand-500 to-accent-500 text-white font-semibold shadow-glow-brand hover:shadow-glow-accent transition-shadow"
            >
              {t('landing.cta.start')}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white/5 border border-white/10 text-ink-1 hover:bg-white/10 transition-colors"
            >
              {t('landing.cta.demo')}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return (
    <div className="text-center max-w-3xl mx-auto">
      <div className="inline-flex items-center justify-center mb-4 pill-brand">{eyebrow}</div>
      <h2 className="font-display text-display-lg text-gradient-cool mb-4">{title}</h2>
      <p className="text-ink-2 text-lg leading-relaxed">{lead}</p>
    </div>
  );
}

function Footer({ t }: { t: TFn }) {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] px-6 md:px-10 py-10 mt-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <img src={markSvg} alt="ObservAI" className="w-8 h-8" />
          <div>
            <div className="font-display font-semibold text-ink-0">ObservAI</div>
            <div className="text-xs text-ink-3">{t('landing.footer.tagline')}</div>
          </div>
        </div>
        <div className="text-xs text-ink-3 font-mono">
          © 2026 ObservAI. {t('landing.footer.rights')}
        </div>
      </div>
    </footer>
  );
}
