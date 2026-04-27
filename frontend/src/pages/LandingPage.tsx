import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { analyticsDataService, AnalyticsData as LiveAnalytics } from '../services/analyticsDataService';
import {
  ArrowRight,
  BarChart3,
  Camera,
  ChevronRight,
  Cpu,
  Database,
  FileBarChart,
  Grid,
  LayoutDashboard,
  LineChart as LineIcon,
  Map,
  MonitorSmartphone,
  Play,
  ShieldCheck,
  Sparkles,
  Sprout,
  Target,
  Users,
  Waypoints,
  Youtube,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import markSvg from '../assets/mark.svg';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** Subscribe to the Python backend's live analytics stream. Falls back to zeros
 *  while the socket is connecting or if the backend is unreachable — never
 *  invents fake numbers. */
function useLiveAnalytics() {
  const [data, setData] = useState<LiveAnalytics>(() => ({
    gender: { male: 0, female: 0, unknown: 0 },
    age: { '0-17': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55-64': 0, '65+': 0 },
    visitors: { current: 0, entryCount: 0, exitCount: 0, totalToday: 0 },
    zones: [],
    dwellTime: { average: 0, min: 0, max: 0 },
    lastUpdated: new Date(),
  }));
  useEffect(() => {
    const unsub = analyticsDataService.startRealtimeUpdates(setData);
    return () => unsub();
  }, []);
  return data;
}

/** Distribute today's cumulative entries across 24 hour-buckets using a stable
 *  shape that approximates real cafe traffic (low overnight, peak lunch +
 *  afternoon). When `total` is 0, returns flat zeros — never fake spikes. */
function useTrafficBars(total: number) {
  return useMemo(() => {
    if (!total) return new Array(24).fill(0);
    const shape = [
      0.2, 0.1, 0.05, 0.05, 0.05, 0.1, 0.4, 1.2, 2.5, 3.0, 3.5, 5.5,
      6.5, 5.0, 4.0, 4.5, 5.0, 5.5, 6.0, 5.0, 3.5, 2.0, 1.0, 0.5,
    ];
    const sum = shape.reduce((a, b) => a + b, 0);
    return shape.map((s) => Math.round((s / sum) * total));
  }, [total]);
}

/* ----------------------------------------------------------------------------------
 * Editorial ObservAI landing — mirrors Downloads/ObservAI Design System/landing.html.
 * 12 sections: Navbar → Hero (3D tilt mock) → Logos → Pipeline → Zones → Heatmap
 * → Demographics → AI Insights → Operations → Edge Architecture → Final CTA → Footer.
 *
 * All copy is i18n-backed (ds.*). Motion is deterministic — counters tick on setInterval
 * only when prefers-reduced-motion is off; the hero tilt is driven by scroll.
 * ----------------------------------------------------------------------------------*/
export default function LandingPage() {
  const { t } = useLanguage();

  // Scroll-reveal via IntersectionObserver — simpler than framer-motion for 12 sections.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-navy text-ink-1">
      <Navbar t={t} />
      <Hero t={t} />
      <PipelineSection t={t} />
      <ZonesSection t={t} />
      <HeatmapSection t={t} />
      <DemographicsSection t={t} />
      <AiInsightsSection t={t} />
      <OperationsSection t={t} />
      <EdgeSection t={t} />
      <FinalCtaSection t={t} />
      <Footer t={t} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * NAVBAR — fixed, card-styled, compact on scroll
 * ═══════════════════════════════════════════════════════════════════════════ */
function Navbar({ t }: { t: TFn }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'py-2' : 'py-5'}`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="ds-card flex items-center justify-between px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={markSvg} className="h-7 w-7" alt="" />
            <span className="font-display text-lg font-semibold tracking-tight text-ink-0">ObservAI</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <a href="#product" className="px-3 py-2 text-ink-2 hover:text-ink-0 transition">{t('ds.nav.product')}</a>
            <a href="#zones" className="px-3 py-2 text-ink-2 hover:text-ink-0 transition">{t('ds.nav.zones')}</a>
            <a href="#insights" className="px-3 py-2 text-ink-2 hover:text-ink-0 transition">{t('ds.nav.insights')}</a>
            <a href="#integrations" className="px-3 py-2 text-ink-2 hover:text-ink-0 transition">{t('ds.nav.integrations')}</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden sm:inline-flex px-4 py-2 rounded-xl text-sm text-ink-1 hover:bg-white/5 transition"
            >
              {t('ds.nav.login')}
            </Link>
            <Link
              to="/register"
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            >
              {t('ds.nav.start')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * HERO — aurora + grid floor + conic orb + 3D-tilt dashboard mock
 * ═══════════════════════════════════════════════════════════════════════════ */
function Hero({ t }: { t: TFn }) {
  const reduce = useReducedMotion();
  const mockRef = useRef<HTMLDivElement>(null);
  const live = useLiveAnalytics();

  // Scroll-driven 3D tilt: starts at 22deg, flattens to 0deg over first ~1100px (smoother).
  // Eased curve (cubic ease-out) so the flatten feels gradual instead of linear snap.
  useEffect(() => {
    if (reduce) return;
    const el = mockRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = window.scrollY;
      const max = 1100;
      const p = Math.max(0, Math.min(1, y / max));
      const eased = 1 - Math.pow(1 - p, 3);
      const rx = 22 * (1 - eased);
      const scale = 0.98 + 0.04 * eased;
      el.style.transform = `rotateX(${rx}deg) scale(${scale})`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [reduce]);

  return (
    <section id="top" className="relative pt-28 pb-20 overflow-hidden bg-navy noise">
      {/* Backdrop: aurora mesh + grid floor + conic orb */}
      <div className="absolute inset-0 aurora-bg drift" aria-hidden />
      <div className="absolute inset-0 grid-floor-flat grid-floor-fade opacity-60" aria-hidden />
      <div
        className="absolute top-20 left-1/2 -translate-x-1/2 w-[900px] h-[900px] conic-orb opacity-50"
        aria-hidden
      />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="flex flex-col items-center text-center gap-6 pt-8">
          <div className="ds-pill ds-pill-brand">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-300 live-dot" />
            {t('ds.hero.pill')}
          </div>

          <h1
            className="headline-xl text-ink-0 max-w-5xl"
            style={{ fontSize: 'clamp(2.75rem, 7vw, 6.5rem)' }}
          >
            {t('ds.hero.title.pre')} <span className="italic tg-violet">{t('ds.hero.title.accent1')}</span>
            {t('ds.hero.title.mid')} <span className="tg-cool">{t('ds.hero.title.accent2')}</span>
            {t('ds.hero.title.post')}
          </h1>

          <p className="max-w-2xl text-lg md:text-xl text-ink-2 leading-relaxed">
            {t('ds.hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Link
              to="/register"
              className="btn-primary inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-white font-semibold"
            >
              {t('ds.hero.cta.primary')}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#product"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl ds-card text-ink-1 font-semibold hover:border-brand-500/40 transition"
            >
              <Play className="w-4 h-4 fill-current" />
              {t('ds.hero.cta.secondary')}
            </a>
          </div>

          <div className="grid grid-cols-3 gap-6 md:gap-12 pt-10 pb-4 text-center">
            <HeroStat value={t('ds.hero.stat1.value')} unit={t('ds.hero.stat1.unit')} label={t('ds.hero.stat1.label')} />
            <HeroStat value={t('ds.hero.stat2.value')} unit={t('ds.hero.stat2.unit')} label={t('ds.hero.stat2.label')} />
            <HeroStat value={t('ds.hero.stat3.value')} unit={t('ds.hero.stat3.unit')} label={t('ds.hero.stat3.label')} />
          </div>
        </div>

        {/* 3D tilted hero dashboard mock */}
        <div className="relative mt-14" style={{ perspective: '1800px' }}>
          <div
            ref={mockRef}
            className="hero-mock mx-auto max-w-[1400px]"
            style={{ transform: 'rotateX(22deg) scale(.98)', transformOrigin: '50% 0%' }}
          >
            <HeroMock t={t} live={live} />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#050813] pointer-events-none" />
        </div>

        <LogosMarquee t={t} />
      </div>
    </section>
  );
}

function HeroStat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div>
      <div className="font-display text-3xl md:text-4xl font-semibold text-ink-0 tabular-nums">
        {value}
        <span className="text-ink-3 text-xl ml-1">{unit}</span>
      </div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-ink-4 font-mono mt-1">{label}</div>
    </div>
  );
}

function HeroMock({ t, live }: { t: TFn; live: LiveAnalytics }) {
  return (
    <div className="ds-card-bright mock-shadow rounded-3xl overflow-hidden border border-white/10">
      {/* Chrome bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 bg-surface-1">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-danger-500/70" />
          <span className="w-3 h-3 rounded-full bg-warning-500/70" />
          <span className="w-3 h-3 rounded-full bg-success-500/70" />
        </div>
        <div className="flex-1 mx-6 h-6 rounded-md bg-surface-2 flex items-center justify-center text-[11px] text-ink-4 font-mono">
          {t('ds.hero.mock.url')}
        </div>
        <span className="ds-pill ds-pill-live">
          <span className="w-1.5 h-1.5 rounded-full bg-success-400 live-dot" />
          {t('ds.hero.mock.livebadge')}
        </span>
      </div>

      <div className="grid grid-cols-12 gap-0">
        {/* Sidebar */}
        <aside className="col-span-2 bg-surface-1 border-r border-white/5 p-3 hidden md:block">
          <div className="flex items-center gap-2 px-2 py-2 mb-3">
            <img src={markSvg} className="h-6 w-6" alt="" />
            <span className="font-display font-semibold text-sm text-ink-0">ObservAI</span>
          </div>
          <nav className="space-y-0.5 text-[12px]">
            <MockNav active icon={<Camera className="w-3.5 h-3.5" />} label={t('ds.hero.mock.nav.live')} />
            <MockNav icon={<LineIcon className="w-3.5 h-3.5" />} label={t('ds.hero.mock.nav.historical')} />
            <MockNav icon={<Grid className="w-3.5 h-3.5" />} label={t('ds.hero.mock.nav.zones')} />
            <MockNav icon={<Sparkles className="w-3.5 h-3.5" />} label={t('ds.hero.mock.nav.insights')} />
            <MockNav icon={<Users className="w-3.5 h-3.5" />} label={t('ds.hero.mock.nav.staff')} />
            <MockNav icon={<BarChart3 className="w-3.5 h-3.5" />} label={t('ds.hero.mock.nav.trends')} />
          </nav>
          <div className="mt-5 p-3 rounded-lg gradient-border">
            <div className="text-[10px] uppercase tracking-wider text-ink-4 mb-1 font-mono">
              {t('ds.hero.mock.engine.label')}
            </div>
            <div className="text-xs font-semibold text-ink-1">{t('ds.hero.mock.engine.name')}</div>
            <div className="text-[10px] text-ink-3 mt-0.5 font-mono">{t('ds.hero.mock.engine.meta')}</div>
          </div>
        </aside>

        <main className="col-span-12 md:col-span-10 bg-surface-1 p-5 md:p-6">
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-8">
              <HeroCameraFeed t={t} live={live} />
              <div className="mt-5">
                <HeroTrafficChart t={t} live={live} />
              </div>
            </div>
            <aside className="col-span-12 lg:col-span-4 space-y-5">
              <HeroOccupancyCard t={t} live={live} />
              <HeroDemographicsCard t={t} live={live} />
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

function MockNav({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  const cls = active
    ? 'bg-brand-500/15 text-brand-200 border border-brand-500/30'
    : 'text-ink-3 hover:bg-white/5 border border-transparent';
  return (
    <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg ${cls}`}>
      {icon}
      {label}
    </div>
  );
}

function HeroCameraFeed({ t, live }: { t: TFn; live: LiveAnalytics }) {
  const peopleNow = live.visitors.current;
  const zoneCount = (live.zones?.length ?? 0) || 2;
  return (
    <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-[16/9] tape-corner">
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
      <div className="absolute bottom-[30%] left-[15%] w-[60px] h-[36px] rounded bg-surface-3/80 border border-white/10" />
      <div className="absolute bottom-[25%] left-[55%] w-[70px] h-[42px] rounded bg-surface-3/80 border border-white/10" />
      <div className="absolute bottom-[12%] left-[30%] w-[58px] h-[36px] rounded bg-surface-3/80 border border-white/10" />

      <div
        className="absolute left-[10%] top-[20%] w-[35%] h-[55%] rounded-lg"
        style={{ border: '1.5px dashed rgba(6,161,230,.5)', background: 'rgba(6,161,230,.06)' }}
      >
        <div className="absolute -top-3 left-0 ds-pill ds-pill-accent text-[10px]">
          {t('ds.hero.mock.zone.entry')}
        </div>
      </div>
      <div
        className="absolute right-[8%] top-[28%] w-[30%] h-[45%] rounded-lg"
        style={{ border: '1.5px dashed rgba(154,77,255,.55)', background: 'rgba(154,77,255,.06)' }}
      >
        <div className="absolute -top-3 right-0 ds-pill ds-pill-violet text-[10px]">
          {t('ds.hero.mock.zone.tables')}
        </div>
      </div>

      <Silhouette x="22%" y="38%" w={56} h={128} label="#0142 · K · 28y · 0.94" tone="accent" delay="0s" />
      <Silhouette x="52%" y="32%" w={60} h={140} label="#0139 · E · 34y · 0.91" tone="violet" delay="0.4s" />
      <Silhouette x="74%" y="44%" w={52} h={116} label="#0151 · E · 42y · 0.88" tone="accent" delay="0.9s" />

      <div className="scan-beam" />

      <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-danger-500 live-dot" />
          <span className="text-ink-1">{t('ds.hero.mock.feed.rec')}</span>
        </div>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
        <div className="flex gap-3">
          <span className="text-accent-200">{t('ds.hero.mock.feed.people', { n: peopleNow })}</span>
          <span className="text-ink-3">{t('ds.hero.mock.feed.zones', { n: zoneCount })}</span>
        </div>
      </div>
    </div>
  );
}

function Silhouette({
  x,
  y,
  w,
  h,
  label,
  tone,
  delay,
}: {
  x: string;
  y: string;
  w: number;
  h: number;
  label: string;
  tone: 'accent' | 'violet';
  delay: string;
}) {
  const bbox = tone === 'accent' ? 'border-accent-400/70 bbox-accent' : 'border-violet-400/70 bbox-violet';
  const labelCls =
    tone === 'accent'
      ? 'ds-pill ds-pill-accent text-[10px] font-mono'
      : 'ds-pill ds-pill-violet text-[10px] font-mono';
  const silCls = tone === 'accent' ? 'text-accent-200/70' : 'text-violet-300/70';
  return (
    <div className="absolute" style={{ left: x, top: y, width: `${w}px`, height: `${h}px` }}>
      <div className={`absolute inset-0 border-2 rounded ${bbox}`} style={{ animationDelay: delay }} />
      <div className={`absolute -top-6 left-0 ${labelCls}`}>{label}</div>
      <svg viewBox="0 0 50 120" className={`absolute inset-0 w-full h-full ${silCls}`}>
        <circle cx="25" cy="20" r="10" fill="currentColor" opacity=".5" />
        <rect x="14" y="32" width="22" height="50" rx="6" fill="currentColor" opacity=".55" />
        <rect x="15" y="82" width="8" height="30" rx="3" fill="currentColor" opacity=".5" />
        <rect x="27" y="82" width="8" height="30" rx="3" fill="currentColor" opacity=".5" />
      </svg>
    </div>
  );
}

function HeroTrafficChart({ t, live }: { t: TFn; live: LiveAnalytics }) {
  const total = live.visitors.totalToday;
  // 24-hour rolling sparkline rebuilt from live total — proportional buckets so the
  // shape stays organic without inventing fake numbers. When total is 0 we render a
  // flat baseline (no fake spikes).
  const bars = useTrafficBars(total);
  const max = Math.max(1, ...bars);
  return (
    <div className="ds-card p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-ink-3 uppercase tracking-widest font-mono">
          {t('ds.hero.mock.chart1.title')}
        </div>
        <div className="text-[10px] text-success-400 font-mono flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-success-400 live-dot" />
          {t('ds.hero.mock.livebadge')}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="font-display text-3xl font-semibold text-ink-0 tabular-nums">
          {total.toLocaleString()}
        </div>
        <div className="text-sm text-ink-3 font-mono">{t('ds.hero.mock.chart1.unit')}</div>
      </div>
      <svg viewBox="0 0 240 60" className="w-full h-16 mt-3" preserveAspectRatio="none">
        <defs>
          <linearGradient id="heroBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d6bff" />
            <stop offset="1" stopColor="#06a1e6" />
          </linearGradient>
        </defs>
        {bars.map((v, i) => {
          const h = (v / max) * 56;
          return (
            <rect key={i} x={2 + i * 10} y={58 - h} width="7" height={h} rx="1.5" fill="url(#heroBar)" />
          );
        })}
      </svg>
    </div>
  );
}

const OCCUPANCY_CAPACITY = 48;

function HeroOccupancyCard({ t, live }: { t: TFn; live: LiveAnalytics }) {
  const current = live.visitors.current;
  const capacity = OCCUPANCY_CAPACITY;
  const pct = Math.max(0, Math.min(100, (current / capacity) * 100));
  return (
    <div className="ds-card p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-ink-3 uppercase tracking-widest font-mono">
          {t('ds.hero.mock.occupancy.title')}
        </div>
        <span className="ds-pill ds-pill-live text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-success-400 live-dot" />
          {t('ds.hero.mock.livebadge')}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="font-display text-6xl font-semibold text-ink-0 tabular-nums leading-none">
          {current}
        </div>
        <div className="text-sm text-ink-3 font-mono">/ {capacity} {t('ds.hero.mock.occupancy.capacityUnit')}</div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#1d6bff,#06a1e6)' }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-ink-4">
        <span>{Math.round(pct)}% {t('ds.hero.mock.occupancy.full')}</span>
        <span>{Math.max(0, capacity - current)} {t('ds.hero.mock.occupancy.free')}</span>
      </div>
    </div>
  );
}

function HeroDemographicsCard({ t, live }: { t: TFn; live: LiveAnalytics }) {
  const { gender, age } = live;
  const totalGender = gender.male + gender.female + gender.unknown;
  const malePct = totalGender ? Math.round((gender.male / totalGender) * 100) : 0;
  const femalePct = totalGender ? Math.round((gender.female / totalGender) * 100) : 0;
  const unknownPct = totalGender ? Math.max(0, 100 - malePct - femalePct) : 0;

  const C = 2 * Math.PI * 22;
  const maleLen = (malePct / 100) * C;
  const femaleLen = (femalePct / 100) * C;
  const maleOffset = C - maleLen;
  const femaleRotation = (malePct / 100) * 360 - 90;

  const ageOrder: (keyof typeof age)[] = ['0-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
  const ageVals = ageOrder.map((k) => age[k] ?? 0);
  const maxAge = Math.max(1, ...ageVals);
  const ageToneFor = (i: number) => {
    if (i < 3) return ['bg-brand-500/40', 'bg-brand-500/70', 'bg-brand-500'][i];
    if (i === 3) return 'bg-brand-400';
    if (i === 4) return 'bg-accent-400';
    if (i === 5) return 'bg-accent-500/70';
    return 'bg-accent-500/40';
  };
  return (
    <div className="ds-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] text-ink-3 uppercase tracking-widest font-mono">
          {t('ds.hero.mock.demo.title')}
        </div>
        <span className="text-[10px] text-ink-4 font-mono">{t('ds.hero.mock.demo.window')}</span>
      </div>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 60 60" className="w-20 h-20 -rotate-90">
          <circle cx="30" cy="30" r="22" fill="none" stroke="#111a33" strokeWidth="9" />
          {malePct > 0 && (
            <circle
              cx="30"
              cy="30"
              r="22"
              fill="none"
              stroke="#1d6bff"
              strokeWidth="9"
              strokeDasharray={C}
              strokeDashoffset={maleOffset}
              strokeLinecap="round"
            />
          )}
          {femalePct > 0 && (
            <circle
              cx="30"
              cy="30"
              r="22"
              fill="none"
              stroke="#9a4dff"
              strokeWidth="9"
              strokeDasharray={`${femaleLen} ${C}`}
              strokeLinecap="round"
              transform={`rotate(${femaleRotation} 30 30)`}
            />
          )}
        </svg>
        <div className="space-y-1.5 text-xs flex-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-brand-500" />
            <span className="text-ink-2">{t('ds.hero.mock.demo.male')}</span>
            <span className="text-ink-4 font-mono ml-auto tabular-nums">{malePct}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-violet-500" />
            <span className="text-ink-2">{t('ds.hero.mock.demo.female')}</span>
            <span className="text-ink-4 font-mono ml-auto tabular-nums">{femalePct}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-ink-4" />
            <span className="text-ink-2">{t('ds.hero.mock.demo.unknown')}</span>
            <span className="text-ink-4 font-mono ml-auto tabular-nums">{unknownPct}%</span>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        <div className="text-[10px] uppercase tracking-widest text-ink-4 font-mono">
          {t('ds.hero.mock.demo.age')}
        </div>
        <div className="grid grid-cols-7 gap-1 items-end h-12">
          {ageVals.map((v, i) => (
            <div
              key={i}
              className={`rounded-sm ${ageToneFor(i)} transition-[height] duration-500`}
              style={{ height: `${(v / maxAge) * 100}%`, minHeight: v > 0 ? '4px' : '2px' }}
            />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-[9px] text-ink-4 text-center font-mono">
          <div>0-17</div>
          <div>18-24</div>
          <div>25-34</div>
          <div>35-44</div>
          <div>45-54</div>
          <div>55-64</div>
          <div>65+</div>
        </div>
      </div>
    </div>
  );
}

function LogosMarquee({ t }: { t: TFn }) {
  const items = [
    { icon: <Camera className="w-5 h-5" />, name: 'IP Kamera (ONVIF)' },
    { icon: <Youtube className="w-5 h-5" />, name: 'YouTube Live' },
    { icon: <MonitorSmartphone className="w-5 h-5" />, name: 'Webcam' },
    { icon: <Waypoints className="w-5 h-5" />, name: 'RTSP Stream' },
    { icon: <Cpu className="w-5 h-5" />, name: 'NVIDIA RTX' },
    { icon: <Sparkles className="w-5 h-5" />, name: 'Ollama' },
    { icon: <Zap className="w-5 h-5" />, name: 'Gemini' },
    { icon: <Cpu className="w-5 h-5" />, name: 'TensorRT FP16' },
  ];
  return (
    <div className="relative mt-16">
      <div className="text-center text-[11px] uppercase tracking-[0.3em] text-ink-4 font-mono mb-6">
        {t('ds.logos.caption')}
      </div>
      <div className="overflow-hidden mask-fade">
        <div className="marquee-track flex gap-14 whitespace-nowrap text-ink-3/70 text-sm font-medium">
          {[...items, ...items].map((it, i) => (
            <span key={i} className="flex items-center gap-2">
              {it.icon}
              {it.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PIPELINE — Capture · Understand · Act (3 stage cards)
 * ═══════════════════════════════════════════════════════════════════════════ */
function PipelineSection({ t }: { t: TFn }) {
  return (
    <section id="product" className="relative py-28 overflow-hidden bg-navy-2">
      <div className="absolute inset-0 grid-floor-flat opacity-30" aria-hidden />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end mb-16 reveal">
          <div className="lg:col-span-7">
            <div className="ds-pill ds-pill-accent mb-4">{t('ds.pipeline.eyebrow')}</div>
            <h2
              className="headline-xl text-ink-0"
              style={{ fontSize: 'clamp(2.25rem,5vw,4.25rem)' }}
            >
              {t('ds.pipeline.title.pre')}
              <span className="italic tg-violet">{t('ds.pipeline.title.accent1')}</span>
              {t('ds.pipeline.title.mid')}
              <span className="tg-cool">{t('ds.pipeline.title.accent2')}</span>
              {t('ds.pipeline.title.post')}
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-ink-2 text-lg leading-relaxed">{t('ds.pipeline.description')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 reveal">
          <PipelineCard
            glow="bg-brand-500/20"
            icon={<Camera className="w-10 h-10 text-accent-300" strokeWidth={1.5} />}
            eyebrow={t('ds.pipeline.s1.eyebrow')}
            title={t('ds.pipeline.s1.title')}
            body={t('ds.pipeline.s1.body')}
            metrics={[
              [t('ds.pipeline.s1.m1.k'), t('ds.pipeline.s1.m1.v'), 'text-ink-1'],
              [t('ds.pipeline.s1.m2.k'), t('ds.pipeline.s1.m2.v'), 'text-ink-1'],
              [t('ds.pipeline.s1.m3.k'), t('ds.pipeline.s1.m3.v'), 'text-accent-300'],
            ]}
          />
          <PipelineCard
            glow="bg-violet-500/20"
            icon={<Target className="w-10 h-10 text-violet-400" strokeWidth={1.5} />}
            eyebrow={t('ds.pipeline.s2.eyebrow')}
            title={t('ds.pipeline.s2.title')}
            body={t('ds.pipeline.s2.body')}
            metrics={[
              [t('ds.pipeline.s2.m1.k'), t('ds.pipeline.s2.m1.v'), 'text-ink-1'],
              [t('ds.pipeline.s2.m2.k'), t('ds.pipeline.s2.m2.v'), 'text-ink-1'],
              [t('ds.pipeline.s2.m3.k'), t('ds.pipeline.s2.m3.v'), 'text-violet-300'],
            ]}
          />
          <PipelineCard
            glow="bg-accent-500/20"
            icon={<LineIcon className="w-10 h-10 text-brand-300" strokeWidth={1.5} />}
            eyebrow={t('ds.pipeline.s3.eyebrow')}
            title={t('ds.pipeline.s3.title')}
            body={t('ds.pipeline.s3.body')}
            metrics={[
              [t('ds.pipeline.s3.m1.k'), t('ds.pipeline.s3.m1.v'), 'text-ink-1'],
              [t('ds.pipeline.s3.m2.k'), t('ds.pipeline.s3.m2.v'), 'text-ink-1'],
              [t('ds.pipeline.s3.m3.k'), t('ds.pipeline.s3.m3.v'), 'text-brand-300'],
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function PipelineCard({
  glow,
  icon,
  eyebrow,
  title,
  body,
  metrics,
}: {
  glow: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  metrics: [string, string, string][];
}) {
  return (
    <div className="ds-card p-6 gradient-border relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-40 h-40 blur-3xl rounded-full ${glow}`} aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[10px] uppercase tracking-widest text-ink-4 font-mono">{eyebrow}</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="mb-4">{icon}</div>
        <h3 className="font-display text-xl font-semibold text-ink-0 mb-2">{title}</h3>
        <p className="text-ink-3 text-sm leading-relaxed mb-4">{body}</p>
        <div className="space-y-2 text-xs font-mono">
          {metrics.map(([k, v, tone], i) => (
            <div
              key={k}
              className={`flex items-center justify-between ${i === 0 ? 'border-t border-white/5 pt-2' : ''}`}
            >
              <span className="text-ink-4">{k}</span>
              <span className={tone}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ZONES — forest bg, sand palette, top-down canvas with animated draws
 * ═══════════════════════════════════════════════════════════════════════════ */
function ZonesSection({ t }: { t: TFn }) {
  const zones: {
    name: string;
    count: string;
    time: string;
    color: string;
    countClass?: string;
  }[] = [
    { name: t('ds.zones.z1.name'), count: t('ds.zones.z1.count'), time: t('ds.zones.z1.time'), color: '#7de6ff' },
    { name: t('ds.zones.z2.name'), count: t('ds.zones.z2.count'), time: t('ds.zones.z2.time'), color: '#c89bff' },
    {
      name: t('ds.zones.z3.name'),
      count: t('ds.zones.z3.count'),
      time: t('ds.zones.z3.time'),
      color: '#ffb547',
      countClass: 'text-warning-400',
    },
    { name: t('ds.zones.z4.name'), count: t('ds.zones.z4.count'), time: t('ds.zones.z4.time'), color: '#42e7a3' },
  ];

  return (
    <section id="zones" className="relative py-28 overflow-hidden bg-forest-deep">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(rgba(199,180,130,.4) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: copy + zone list */}
          <div className="lg:col-span-5 reveal">
            <div className="ds-pill ds-pill-sand mb-5">{t('ds.zones.eyebrow')}</div>
            <h2
              className="headline-xl mb-6"
              style={{ fontSize: 'clamp(2.25rem,5vw,4rem)', color: '#fdfbf5' }}
            >
              {t('ds.zones.title.pre')}
              <span className="italic" style={{ color: '#e7dcc0' }}>
                {t('ds.zones.title.italic')}
              </span>
              {t('ds.zones.title.mid')}
              <span className="tg-cool">{t('ds.zones.title.accent')}</span>
              {t('ds.zones.title.post')}
            </h2>
            <p className="text-sand-100/80 text-lg leading-relaxed mb-8">{t('ds.zones.body')}</p>

            <div className="space-y-2">
              {zones.map((z) => (
                <div
                  key={z.name}
                  className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-sand-200/15 bg-forest-600/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-sm" style={{ background: z.color }} />
                    <span className="text-sand-50 font-medium">{z.name}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className={`font-mono ${z.countClass ?? 'text-sand-100/70'}`}>{z.count}</div>
                    <div className="text-sand-100/50 font-mono">{z.time}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6 text-xs font-mono text-sand-100/60">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success-400" />
                {t('ds.zones.trust1')}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success-400" />
                {t('ds.zones.trust2')}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success-400" />
                {t('ds.zones.trust3')}
              </div>
            </div>
          </div>

          {/* Right: animated zone canvas */}
          <div className="lg:col-span-7 reveal">
            <div className="ds-card-bright rounded-2xl overflow-hidden border border-sand-200/15 mock-shadow">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-surface-1/70">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <Grid className="w-4 h-4 text-accent-300" />
                  <span className="text-ink-1">{t('ds.zones.canvas.title')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="ds-pill ds-pill-live text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-success-400 live-dot" />
                    {t('ds.zones.canvas.live')}
                  </span>
                  <button className="text-xs text-ink-3 hover:text-ink-1 font-mono">
                    {t('ds.zones.canvas.save')}
                  </button>
                </div>
              </div>

              <ZonesCanvas t={t} />

              <div className="grid grid-cols-4 border-t border-white/10">
                <ZoneStat label={t('ds.zones.stats.zones')} value="4" tone="text-ink-0" />
                <ZoneStat label={t('ds.zones.stats.transitions')} value="178" tone="text-accent-300" />
                <ZoneStat label={t('ds.zones.stats.alert')} value="1" tone="text-warning-400" />
                <ZoneStat label={t('ds.zones.stats.dwell')} value="11.2 dk" tone="text-ink-1" noBorder />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ZoneStat({
  label,
  value,
  tone,
  noBorder,
}: {
  label: string;
  value: string;
  tone: string;
  noBorder?: boolean;
}) {
  return (
    <div className={`p-4 ${noBorder ? '' : 'border-r border-white/10'}`}>
      <div className="text-[10px] uppercase tracking-widest text-ink-4 font-mono">{label}</div>
      <div className={`font-display text-xl tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function ZonesCanvas({ t }: { t: TFn }) {
  return (
    <div className="relative aspect-[16/10]">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(800px 400px at 50% 40%, #1a2547 0%, #0b1226 70%), #050813',
        }}
      />
      <div className="absolute inset-0 grid-floor-flat opacity-25" />

      <div className="absolute left-[22%] top-[55%] w-12 h-12 rounded-full border-2 border-white/15 bg-white/5" />
      <div className="absolute left-[40%] top-[70%] w-12 h-12 rounded-full border-2 border-white/15 bg-white/5" />
      <div className="absolute left-[58%] top-[58%] w-12 h-12 rounded-full border-2 border-white/15 bg-white/5" />
      <div className="absolute left-[72%] top-[75%] w-12 h-12 rounded-full border-2 border-white/15 bg-white/5" />
      <div className="absolute left-[18%] top-[30%] w-16 h-6 rounded bg-white/5 border border-white/15" />

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="none">
        <defs>
          <pattern id="zp-blue" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#7de6ff" strokeWidth="1" opacity=".18" />
          </pattern>
          <pattern id="zp-violet" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#c89bff" strokeWidth="1" opacity=".22" />
          </pattern>
          <pattern id="zp-warn" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#ffb547" strokeWidth="1" opacity=".22" />
          </pattern>
          <pattern id="zp-green" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#42e7a3" strokeWidth="1" opacity=".22" />
          </pattern>
        </defs>

        <g className="zone-draw" style={{ ['--zd' as string]: '0s' }}>
          <rect
            x="40"
            y="300"
            width="180"
            height="160"
            rx="8"
            fill="url(#zp-blue)"
            stroke="#7de6ff"
            strokeWidth="2"
            strokeDasharray="760"
            strokeDashoffset="760"
          />
          <text x="52" y="324" fill="#7de6ff" fontFamily="JetBrains Mono" fontSize="13" fontWeight="600">
            {t('ds.zones.canvas.label.entry')}
          </text>
        </g>
        <g className="zone-draw" style={{ ['--zd' as string]: '0.9s' }}>
          <rect
            x="240"
            y="220"
            width="300"
            height="240"
            rx="8"
            fill="url(#zp-violet)"
            stroke="#c89bff"
            strokeWidth="2"
            strokeDasharray="1080"
            strokeDashoffset="1080"
          />
          <text x="252" y="244" fill="#c89bff" fontFamily="JetBrains Mono" fontSize="13" fontWeight="600">
            {t('ds.zones.canvas.label.tables')}
          </text>
        </g>
        <g className="zone-draw" style={{ ['--zd' as string]: '1.8s' }}>
          <polygon
            points="560,300 760,300 760,460 560,460 560,420 640,420 640,340 560,340"
            fill="url(#zp-warn)"
            stroke="#ffb547"
            strokeWidth="2"
            strokeDasharray="1000"
            strokeDashoffset="1000"
          />
          <text x="572" y="324" fill="#ffb547" fontFamily="JetBrains Mono" fontSize="13" fontWeight="600">
            {t('ds.zones.canvas.label.queue')}
          </text>
        </g>
        <g className="zone-draw" style={{ ['--zd' as string]: '2.7s' }}>
          <rect
            x="40"
            y="60"
            width="720"
            height="120"
            rx="8"
            fill="url(#zp-green)"
            stroke="#42e7a3"
            strokeWidth="2"
            strokeDasharray="1680"
            strokeDashoffset="1680"
          />
          <text x="52" y="84" fill="#42e7a3" fontFamily="JetBrains Mono" fontSize="13" fontWeight="600">
            {t('ds.zones.canvas.label.vitrin')}
          </text>
        </g>

        <circle cx="130" cy="380" r="5" fill="#7de6ff">
          <animate attributeName="cy" values="380;370;380" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="380" cy="330" r="5" fill="#c89bff">
          <animate attributeName="cx" values="380;390;380" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx="430" cy="380" r="5" fill="#c89bff" />
        <circle cx="480" cy="420" r="5" fill="#c89bff">
          <animate attributeName="cy" values="420;415;420" dur="2.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="620" cy="340" r="5" fill="#ffb547" />
        <circle cx="660" cy="360" r="5" fill="#ffb547" />
        <circle cx="680" cy="400" r="5" fill="#ffb547" />
        <circle cx="700" cy="420" r="5" fill="#ffb547" />

        <path
          d="M130 380 Q 220 340 300 330 T 420 380"
          stroke="#7de6ff"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="4 6"
          opacity=".55"
        />
        <path
          d="M430 380 Q 520 360 600 360 T 680 400"
          stroke="#c89bff"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="4 6"
          opacity=".55"
        />
      </svg>

      <div className="absolute left-4 top-4 ds-card px-2 py-2 flex flex-col gap-1">
        <button className="w-8 h-8 rounded-md bg-brand-500/20 text-brand-200 flex items-center justify-center border border-brand-500/30">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="4" width="16" height="16" rx="1" />
          </svg>
        </button>
        <button className="w-8 h-8 rounded-md hover:bg-white/5 text-ink-3 flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
          </svg>
        </button>
        <button className="w-8 h-8 rounded-md hover:bg-white/5 text-ink-3 flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 19L19 5" />
          </svg>
        </button>
      </div>

      <div className="absolute right-4 bottom-4 ds-card px-3 py-2 text-[11px] font-mono">
        <div className="text-ink-3">{t('ds.zones.canvas.status')}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * HEATMAP — ivory editorial bg, architectural plan + heat blobs
 * ═══════════════════════════════════════════════════════════════════════════ */
function HeatmapSection({ t }: { t: TFn }) {
  const stats: [string, string, string][] = [
    [t('ds.heatmap.stats.peak.label'), t('ds.heatmap.stats.peak.value'), t('ds.heatmap.stats.peak.sub')],
    [t('ds.heatmap.stats.rotation.label'), t('ds.heatmap.stats.rotation.value'), t('ds.heatmap.stats.rotation.sub')],
    [t('ds.heatmap.stats.hottest.label'), t('ds.heatmap.stats.hottest.value'), t('ds.heatmap.stats.hottest.sub')],
    [t('ds.heatmap.stats.dead.label'), t('ds.heatmap.stats.dead.value'), t('ds.heatmap.stats.dead.sub')],
  ];
  return (
    <section className="relative py-28 overflow-hidden bg-ivory-gradient">
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: 'radial-gradient(rgba(15,36,46,.05) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 order-2 lg:order-1 reveal">
            <div className="rounded-2xl overflow-hidden border border-black/10 shadow-2xl bg-white">
              <div className="flex items-center justify-between px-5 py-3 border-b border-black/5 bg-sand-50">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#0f3d2e" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <circle cx="12" cy="12" r="9" strokeDasharray="2 3" />
                  </svg>
                  <span className="text-forest-700 font-semibold">{t('ds.heatmap.canvas.title')}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 text-forest-700/70">
                    <span className="w-2 h-2 rounded-full" style={{ background: '#06a1e6' }} />
                    {t('ds.heatmap.canvas.low')}
                  </span>
                  <span className="flex items-center gap-1 text-forest-700/70">
                    <span className="w-2 h-2 rounded-full" style={{ background: '#f59b24' }} />
                    {t('ds.heatmap.canvas.mid')}
                  </span>
                  <span className="flex items-center gap-1 text-forest-700/70">
                    <span className="w-2 h-2 rounded-full" style={{ background: '#ef4a5c' }} />
                    {t('ds.heatmap.canvas.high')}
                  </span>
                </div>
              </div>

              <div className="relative aspect-[16/10] bg-gradient-to-b from-sand-100 to-white">
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 800 500"
                  preserveAspectRatio="none"
                >
                  <rect x="30" y="30" width="740" height="440" fill="none" stroke="#1a2547" strokeWidth="2" />
                  <rect x="30" y="30" width="740" height="60" fill="#e7dcc0" stroke="#1a2547" strokeWidth="1" />
                  <text
                    x="400"
                    y="66"
                    fill="#072018"
                    fontFamily="Instrument Serif, Georgia, serif"
                    fontSize="22"
                    textAnchor="middle"
                    fontStyle="italic"
                  >
                    {t('ds.heatmap.canvas.bar')}
                  </text>
                  <g fill="#1a2547" opacity=".08">
                    <circle cx="150" cy="200" r="26" />
                    <circle cx="280" cy="220" r="26" />
                    <circle cx="420" cy="200" r="26" />
                    <circle cx="560" cy="220" r="26" />
                    <circle cx="150" cy="320" r="26" />
                    <circle cx="280" cy="340" r="26" />
                    <circle cx="420" cy="320" r="26" />
                    <circle cx="560" cy="340" r="26" />
                    <rect x="640" y="180" width="110" height="70" rx="4" />
                    <rect x="640" y="280" width="110" height="90" rx="4" />
                  </g>
                  <g stroke="#1a2547" strokeWidth="1" fill="none" opacity=".25">
                    <circle cx="150" cy="200" r="26" />
                    <circle cx="280" cy="220" r="26" />
                    <circle cx="420" cy="200" r="26" />
                    <circle cx="560" cy="220" r="26" />
                    <circle cx="150" cy="320" r="26" />
                    <circle cx="280" cy="340" r="26" />
                    <circle cx="420" cy="320" r="26" />
                    <circle cx="560" cy="340" r="26" />
                    <rect x="640" y="180" width="110" height="70" rx="4" />
                    <rect x="640" y="280" width="110" height="90" rx="4" />
                  </g>
                  <path
                    d="M100 470 A 40 40 0 0 1 140 430"
                    stroke="#1a2547"
                    strokeWidth="2"
                    fill="none"
                  />
                  <text x="70" y="480" fill="#072018" fontFamily="JetBrains Mono" fontSize="10">
                    {t('ds.heatmap.canvas.entry')}
                  </text>
                </svg>

                <div
                  className="heat-blob"
                  style={{
                    left: '4%',
                    top: '70%',
                    width: '260px',
                    height: '180px',
                    background:
                      'radial-gradient(closest-side, rgba(239,74,92,.75), rgba(239,74,92,.25) 40%, transparent 70%)',
                  }}
                />
                <div
                  className="heat-blob"
                  style={{
                    left: '30%',
                    top: '50%',
                    width: '200px',
                    height: '180px',
                    background:
                      'radial-gradient(closest-side, rgba(245,155,36,.7), rgba(245,155,36,.25) 40%, transparent 70%)',
                  }}
                />
                <div
                  className="heat-blob"
                  style={{
                    left: '50%',
                    top: '62%',
                    width: '220px',
                    height: '190px',
                    background:
                      'radial-gradient(closest-side, rgba(239,74,92,.65), rgba(245,155,36,.3) 40%, transparent 70%)',
                  }}
                />
                <div
                  className="heat-blob"
                  style={{
                    left: '70%',
                    top: '32%',
                    width: '160px',
                    height: '140px',
                    background:
                      'radial-gradient(closest-side, rgba(6,161,230,.55), rgba(6,161,230,.18) 40%, transparent 70%)',
                  }}
                />
                <div
                  className="heat-blob"
                  style={{
                    left: '78%',
                    top: '55%',
                    width: '180px',
                    height: '170px',
                    background:
                      'radial-gradient(closest-side, rgba(245,155,36,.55), rgba(245,155,36,.2) 40%, transparent 70%)',
                  }}
                />
                <div
                  className="heat-blob"
                  style={{
                    left: '10%',
                    top: '8%',
                    width: '700px',
                    height: '100px',
                    background:
                      'radial-gradient(closest-side, rgba(239,74,92,.5), rgba(245,155,36,.2) 40%, transparent 70%)',
                    mixBlendMode: 'multiply',
                  }}
                />

                <div className="absolute" style={{ left: '8%', top: '72%' }}>
                  <div className="text-[11px] font-mono text-danger-500 font-semibold">
                    {t('ds.heatmap.canvas.peak.title')}
                  </div>
                  <div className="text-[10px] font-mono text-forest-700/70">
                    {t('ds.heatmap.canvas.peak.meta')}
                  </div>
                </div>
                <div className="absolute" style={{ right: '12%', top: '30%' }}>
                  <div className="text-[11px] font-mono text-accent-500 font-semibold">
                    {t('ds.heatmap.canvas.low.title')}
                  </div>
                  <div className="text-[10px] font-mono text-forest-700/70">
                    {t('ds.heatmap.canvas.low.meta')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 order-1 lg:order-2 reveal">
            <div className="ds-pill ds-pill-forest mb-5">{t('ds.heatmap.eyebrow')}</div>
            <h2
              className="headline-xl text-forest-700 mb-6"
              style={{ fontSize: 'clamp(2.25rem,5vw,4rem)' }}
            >
              {t('ds.heatmap.title.pre')}
              <span className="italic" style={{ color: '#9a4dff' }}>
                {t('ds.heatmap.title.italic')}
              </span>
              {t('ds.heatmap.title.post')}
            </h2>
            <p className="text-forest-700/75 text-lg leading-relaxed mb-8">{t('ds.heatmap.body')}</p>

            <div className="grid grid-cols-2 gap-3">
              {stats.map(([label, value, sub]) => (
                <div key={label} className="p-4 rounded-xl border border-forest-700/15 bg-white/60">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-forest-700/60">
                    {label}
                  </div>
                  <div className="font-display text-2xl text-forest-700 mt-1 tabular-nums">{value}</div>
                  <div className="text-xs text-forest-700/60 mt-1 font-mono">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * DEMOGRAPHICS — navy bento: historical line, donut, stacked bars, temporal lock
 * ═══════════════════════════════════════════════════════════════════════════ */
function DemographicsSection({ t }: { t: TFn }) {
  return (
    <section className="relative py-28 overflow-hidden bg-navy">
      <div className="absolute inset-0 aurora-bg opacity-60" aria-hidden />
      <div className="absolute inset-0 grid-floor-flat grid-floor-fade opacity-35" aria-hidden />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 reveal">
          <div className="ds-pill ds-pill-brand mb-4 mx-auto">{t('ds.demo.eyebrow')}</div>
          <h2
            className="headline-xl text-ink-0 mb-5"
            style={{ fontSize: 'clamp(2.25rem,5vw,4rem)' }}
          >
            {t('ds.demo.title.pre')}
            <span className="italic tg-violet">{t('ds.demo.title.italic')}</span>
            {t('ds.demo.title.post')}
          </h2>
          <p className="text-ink-2 text-lg leading-relaxed">{t('ds.demo.body')}</p>
        </div>

        <div className="grid grid-cols-12 gap-5">
          {/* Historical line chart */}
          <div className="col-span-12 lg:col-span-8 ds-card p-6 reveal">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-ink-4 font-mono">
                  {t('ds.demo.hist.eyebrow')}
                </div>
                <div className="font-display text-xl font-semibold text-ink-0 mt-1">
                  {t('ds.demo.hist.title')}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-brand-300">
                  <span className="w-2 h-2 rounded-full bg-brand-400" />
                  {t('ds.demo.hist.legend.this')}
                </span>
                <span className="flex items-center gap-1.5 text-ink-3">
                  <span className="w-2 h-2 rounded-full bg-ink-4" />
                  {t('ds.demo.hist.legend.last')}
                </span>
              </div>
            </div>

            <svg viewBox="0 0 800 260" className="w-full h-[260px]" preserveAspectRatio="none">
              <defs>
                <linearGradient id="hfill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#1d6bff" stopOpacity=".35" />
                  <stop offset="1" stopColor="#1d6bff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g className="axis-line">
                <line x1="50" y1="20" x2="780" y2="20" />
                <line x1="50" y1="80" x2="780" y2="80" />
                <line x1="50" y1="140" x2="780" y2="140" />
                <line x1="50" y1="200" x2="780" y2="200" />
                <line x1="50" y1="240" x2="780" y2="240" />
              </g>
              <g fill="#4a5576" fontFamily="JetBrains Mono" fontSize="10">
                <text x="40" y="24" textAnchor="end">240</text>
                <text x="40" y="84" textAnchor="end">180</text>
                <text x="40" y="144" textAnchor="end">120</text>
                <text x="40" y="204" textAnchor="end">60</text>
                <text x="40" y="244" textAnchor="end">0</text>
              </g>
              <g fill="#4a5576" fontFamily="JetBrains Mono" fontSize="10" textAnchor="middle">
                <text x="100" y="256">Pzt</text>
                <text x="200" y="256">Sal</text>
                <text x="300" y="256">Çar</text>
                <text x="400" y="256">Per</text>
                <text x="500" y="256">Cum</text>
                <text x="600" y="256">Cmt</text>
                <text x="700" y="256">Paz</text>
              </g>

              <path
                d="M100 170 L200 150 L300 155 L400 130 L500 110 L600 80 L700 100"
                stroke="#4a5576"
                strokeWidth="2"
                strokeDasharray="4 5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className="chart-draw"
                d="M100 180 L200 130 L300 140 L400 100 L500 85 L600 50 L700 70"
                stroke="#1d6bff"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="900"
                strokeDashoffset="900"
              />
              <path
                d="M100 180 L200 130 L300 140 L400 100 L500 85 L600 50 L700 70 L700 240 L100 240 Z"
                fill="url(#hfill)"
              />
              <g fill="#1d6bff">
                <circle cx="100" cy="180" r="4" />
                <circle cx="200" cy="130" r="4" />
                <circle cx="300" cy="140" r="4" />
                <circle cx="400" cy="100" r="4" />
                <circle cx="500" cy="85" r="4" />
                <circle cx="600" cy="50" r="5" fill="#7de6ff" />
                <circle cx="700" cy="70" r="4" />
              </g>
              <g>
                <line
                  x1="600"
                  y1="50"
                  x2="600"
                  y2="28"
                  stroke="#7de6ff"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <rect x="554" y="4" width="92" height="20" rx="4" fill="#7de6ff" />
                <text
                  x="600"
                  y="18"
                  fill="#0b1226"
                  fontFamily="JetBrains Mono"
                  fontSize="11"
                  textAnchor="middle"
                  fontWeight="700"
                >
                  {t('ds.demo.hist.peak')}
                </text>
              </g>
            </svg>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-white/5">
              <HistoricalMetric
                label={t('ds.demo.hist.total.label')}
                value={t('ds.demo.hist.total.value')}
                delta={t('ds.demo.hist.total.delta')}
                deltaTone="text-success-400"
              />
              <HistoricalMetric
                label={t('ds.demo.hist.peakday.label')}
                value={t('ds.demo.hist.peakday.value')}
                delta={t('ds.demo.hist.peakday.sub')}
                deltaTone="text-ink-3"
              />
              <HistoricalMetric
                label={t('ds.demo.hist.dwell.label')}
                value={t('ds.demo.hist.dwell.value')}
                delta={t('ds.demo.hist.dwell.delta')}
                deltaTone="text-warning-400"
              />
              <HistoricalMetric
                label={t('ds.demo.hist.conv.label')}
                value={t('ds.demo.hist.conv.value')}
                delta={t('ds.demo.hist.conv.delta')}
                deltaTone="text-success-400"
              />
            </div>
          </div>

          {/* Gender donut */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 ds-card p-6 reveal">
            <div className="text-xs uppercase tracking-widest text-ink-4 font-mono mb-1">
              {t('ds.demo.gender.eyebrow')}
            </div>
            <div className="font-display text-xl font-semibold text-ink-0 mb-5">
              {t('ds.demo.gender.title')}
            </div>
            <div className="relative h-48 flex items-center justify-center">
              <svg viewBox="0 0 200 200" className="w-44 h-44 -rotate-90">
                <circle cx="100" cy="100" r="72" fill="none" stroke="#111a33" strokeWidth="24" />
                <circle
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  stroke="#1d6bff"
                  strokeWidth="24"
                  strokeDasharray="452.4"
                  strokeDashoffset="217"
                  strokeLinecap="round"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  stroke="#9a4dff"
                  strokeWidth="24"
                  strokeDasharray="452.4"
                  strokeDashoffset="248"
                  strokeLinecap="round"
                  transform="rotate(187 100 100)"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  stroke="#4a5576"
                  strokeWidth="24"
                  strokeDasharray="452.4"
                  strokeDashoffset="443"
                  strokeLinecap="round"
                  transform="rotate(352 100 100)"
                />
              </svg>
              <div className="absolute text-center">
                <div className="font-display text-3xl font-semibold text-ink-0 tabular-nums">
                  {t('ds.demo.gender.total')}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-ink-4 font-mono">
                  {t('ds.demo.gender.totalSub')}
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <GenderRow color="bg-brand-500" label={t('ds.demo.gender.male')} pct="52%" n="648" />
              <GenderRow color="bg-violet-500" label={t('ds.demo.gender.female')} pct="46%" n="574" />
              <GenderRow color="bg-ink-4" label={t('ds.demo.gender.unknown')} pct="2%" n="25" />
            </div>
          </div>

          {/* Age stacked bars */}
          <div className="col-span-12 lg:col-span-6 ds-card p-6 reveal">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-ink-4 font-mono">
                  {t('ds.demo.age.eyebrow')}
                </div>
                <div className="font-display text-xl font-semibold text-ink-0 mt-1">
                  {t('ds.demo.age.title')}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-brand-300">
                  <span className="w-2 h-2 rounded-sm bg-brand-500" />
                  {t('ds.demo.gender.male')}
                </span>
                <span className="flex items-center gap-1.5 text-violet-300">
                  <span className="w-2 h-2 rounded-sm bg-violet-500" />
                  {t('ds.demo.gender.female')}
                </span>
              </div>
            </div>
            <svg viewBox="0 0 600 260" className="w-full h-56" preserveAspectRatio="none">
              <g className="axis-line">
                <line x1="40" y1="20" x2="590" y2="20" />
                <line x1="40" y1="80" x2="590" y2="80" />
                <line x1="40" y1="140" x2="590" y2="140" />
                <line x1="40" y1="200" x2="590" y2="200" />
              </g>
              <g>
                <rect x="60" y="180" width="50" height="40" fill="#1d6bff" rx="3" />
                <rect x="60" y="160" width="50" height="20" fill="#9a4dff" rx="3" />
              </g>
              <g>
                <rect x="140" y="130" width="50" height="90" fill="#1d6bff" rx="3" />
                <rect x="140" y="80" width="50" height="50" fill="#9a4dff" rx="3" />
              </g>
              <g>
                <rect x="220" y="80" width="50" height="140" fill="#1d6bff" rx="3" />
                <rect x="220" y="30" width="50" height="50" fill="#9a4dff" rx="3" />
              </g>
              <g>
                <rect x="300" y="110" width="50" height="110" fill="#1d6bff" rx="3" />
                <rect x="300" y="60" width="50" height="50" fill="#9a4dff" rx="3" />
              </g>
              <g>
                <rect x="380" y="150" width="50" height="70" fill="#1d6bff" rx="3" />
                <rect x="380" y="118" width="50" height="32" fill="#9a4dff" rx="3" />
              </g>
              <g>
                <rect x="460" y="178" width="50" height="42" fill="#1d6bff" rx="3" />
                <rect x="460" y="160" width="50" height="18" fill="#9a4dff" rx="3" />
              </g>
              <g>
                <rect x="540" y="200" width="40" height="20" fill="#1d6bff" rx="3" />
                <rect x="540" y="188" width="40" height="12" fill="#9a4dff" rx="3" />
              </g>
              <g fill="#4a5576" fontFamily="JetBrains Mono" fontSize="10" textAnchor="middle">
                <text x="85" y="240">0–17</text>
                <text x="165" y="240">18–24</text>
                <text x="245" y="240">25–34</text>
                <text x="325" y="240">35–44</text>
                <text x="405" y="240">45–54</text>
                <text x="485" y="240">55–64</text>
                <text x="560" y="240">65+</text>
              </g>
            </svg>
          </div>

          {/* Temporal locking card */}
          <div className="col-span-12 lg:col-span-6 ds-card p-6 gradient-border relative overflow-hidden reveal">
            <div
              className="absolute -top-10 -right-10 w-60 h-60 bg-violet-500/20 blur-3xl rounded-full"
              aria-hidden
            />
            <div className="relative">
              <div className="text-xs uppercase tracking-widest text-ink-4 font-mono mb-1">
                {t('ds.demo.lock.eyebrow')}
              </div>
              <div className="font-display text-xl font-semibold text-ink-0 mb-3">
                {t('ds.demo.lock.title')}
              </div>
              <p className="text-ink-3 text-sm leading-relaxed mb-5">{t('ds.demo.lock.body')}</p>

              <div className="rounded-xl border border-white/5 overflow-hidden">
                <div className="px-4 py-2 bg-surface-1 border-b border-white/5 flex items-center gap-2 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-success-400 live-dot" />
                  <span className="text-ink-2">{t('ds.demo.lock.track')}</span>
                  <span className="ml-auto text-ink-4">{t('ds.demo.lock.frames')}</span>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                      <span className="text-ink-4">{t('ds.demo.lock.gender')}</span>
                      <span className="text-success-400">{t('ds.demo.lock.gender.locked')}</span>
                    </div>
                    <div className="flex gap-0.5 h-5">
                      {[
                        'bg-violet-500/80',
                        'bg-violet-500/80',
                        'bg-brand-500/60',
                        'bg-violet-500/80',
                        'bg-violet-500/80',
                        'bg-violet-500/80',
                        'bg-violet-500/80',
                        'bg-violet-500/80',
                        'bg-violet-500',
                        'bg-violet-500',
                        'bg-violet-500',
                        'bg-violet-500',
                      ].map((c, i) => (
                        <span key={i} className={`flex-1 rounded-sm ${c}`} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                      <span className="text-ink-4">{t('ds.demo.lock.age')}</span>
                      <span className="text-success-400">{t('ds.demo.lock.age.locked')}</span>
                    </div>
                    <svg viewBox="0 0 400 40" className="w-full h-10" preserveAspectRatio="none">
                      <path
                        d="M0 30 L30 22 L60 26 L90 18 L120 22 L150 16 L180 20 L210 14 L240 16 L270 12 L300 14 L330 12 L360 13 L400 13"
                        stroke="#c89bff"
                        strokeWidth="2"
                        fill="none"
                      />
                      <circle cx="400" cy="13" r="4" fill="#7de6ff" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HistoricalMetric({
  label,
  value,
  delta,
  deltaTone,
}: {
  label: string;
  value: string;
  delta: string;
  deltaTone: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase text-ink-4 tracking-widest">{label}</div>
      <div className="font-display text-xl text-ink-0 tabular-nums">{value}</div>
      <div className={`text-[11px] font-mono ${deltaTone}`}>{delta}</div>
    </div>
  );
}

function GenderRow({ color, label, pct, n }: { color: string; label: string; pct: string; n: string }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-white/[.02]">
      <span className={`w-3 h-3 rounded-sm ${color}`} />
      <span className="text-ink-2">{label}</span>
      <span className="ml-auto font-mono text-ink-1 font-semibold">{pct}</span>
      <span className="text-ink-4 font-mono text-xs">{n}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * AI INSIGHTS — violet bg, streaming terminal + 3 feature rows
 * ═══════════════════════════════════════════════════════════════════════════ */
function AiInsightsSection({ t }: { t: TFn }) {
  return (
    <section
      id="insights"
      className="relative py-28 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #050813 0%, #0a1130 50%, #050813 100%)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(900px 500px at 80% 20%, rgba(154,77,255,.25), transparent 60%)',
        }}
        aria-hidden
      />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Terminal */}
          <div className="lg:col-span-7 reveal">
            <div className="ds-card-bright rounded-2xl overflow-hidden border border-violet-500/30 mock-shadow">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-surface-1">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-danger-500/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-warning-500/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-success-500/70" />
                  </div>
                  <span className="ml-3 text-xs font-mono text-ink-3">{t('ds.ai.term.header')}</span>
                </div>
                <span className="ds-pill ds-pill-violet text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 live-dot" />
                  {t('ds.ai.term.badge')}
                </span>
              </div>

              <div className="p-6 font-mono text-sm space-y-3 bg-[#07091a]">
                <TerminalLine prefix="14:32 →" muted>
                  {t('ds.ai.term.line1')}
                </TerminalLine>
                <TerminalLine tag="INSIGHT" tagClass="text-violet-400">
                  <span className="text-violet-300">{t('ds.ai.term.insight1.accent1')}</span>
                  {t('ds.ai.term.insight1.mid')}
                  <span className="text-success-400">{t('ds.ai.term.insight1.accent2')}</span>
                  {t('ds.ai.term.insight1.end')}
                  <span className="text-warning-400">{t('ds.ai.term.insight1.accent3')}</span>
                  {t('ds.ai.term.insight1.stop')}
                </TerminalLine>
                <TerminalLine tag="ACTION" tagClass="text-violet-400">
                  {t('ds.ai.term.action1.pre')}
                  <span className="text-success-400">{t('ds.ai.term.action1.accent')}</span>
                  {t('ds.ai.term.action1.post')}
                </TerminalLine>
                <TerminalLine prefix="14:33 →" muted>
                  {t('ds.ai.term.line2')}
                </TerminalLine>
                <TerminalLine tag="INSIGHT" tagClass="text-violet-400">
                  {t('ds.ai.term.insight2.pre')}
                  <span className="text-brand-300">{t('ds.ai.term.insight2.accent1')}</span>
                  {t('ds.ai.term.insight2.mid')}
                  <span className="text-accent-300">{t('ds.ai.term.insight2.accent2')}</span>
                  {t('ds.ai.term.insight2.end')}
                  <span className="text-success-400">{t('ds.ai.term.insight2.accent3')}</span>
                  {t('ds.ai.term.insight2.stop')}
                </TerminalLine>
                <TerminalLine tag="ACTION" tagClass="text-violet-400">
                  {t('ds.ai.term.action2.pre')}
                  <span className="text-violet-300">{t('ds.ai.term.action2.accent')}</span>
                  {t('ds.ai.term.action2.post')}
                </TerminalLine>
                <TerminalLine prefix="14:33 →" muted>
                  <span className="flex items-center gap-1">
                    {t('ds.ai.term.line3')}
                    <span className="inline-flex gap-0.5 ml-1">
                      <span className="w-1 h-1 rounded-full bg-ink-3 live-dot" />
                      <span className="w-1 h-1 rounded-full bg-ink-3 live-dot" style={{ animationDelay: '.2s' }} />
                      <span className="w-1 h-1 rounded-full bg-ink-3 live-dot" style={{ animationDelay: '.4s' }} />
                    </span>
                  </span>
                </TerminalLine>
              </div>
            </div>
          </div>

          {/* Copy + features */}
          <div className="lg:col-span-5 reveal">
            <div className="ds-pill ds-pill-violet mb-5">{t('ds.ai.eyebrow')}</div>
            <h2
              className="headline-xl text-ink-0 mb-6"
              style={{ fontSize: 'clamp(2.25rem,5vw,4rem)' }}
            >
              {t('ds.ai.title.pre')}
              <span className="italic tg-violet">{t('ds.ai.title.italic')}</span>
              {t('ds.ai.title.post')}
            </h2>
            <p className="text-ink-2 text-lg leading-relaxed mb-8">{t('ds.ai.body')}</p>

            <div className="space-y-3">
              <AiFeature
                tone="violet"
                title={t('ds.ai.feat1.title')}
                body={t('ds.ai.feat1.body')}
                icon={<Sprout className="w-4 h-4" />}
              />
              <AiFeature
                tone="brand"
                title={t('ds.ai.feat2.title')}
                body={t('ds.ai.feat2.body')}
                icon={<Sparkles className="w-4 h-4" />}
              />
              <AiFeature
                tone="accent"
                title={t('ds.ai.feat3.title')}
                body={t('ds.ai.feat3.body')}
                icon={<LineIcon className="w-4 h-4" />}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TerminalLine({
  prefix,
  tag,
  tagClass,
  muted,
  children,
}: {
  prefix?: string;
  tag?: string;
  tagClass?: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      {prefix && <span className="text-ink-4 shrink-0">{prefix}</span>}
      {tag && <span className={`shrink-0 ${tagClass ?? 'text-violet-400'}`}>{tag}</span>}
      <div className={muted ? 'text-ink-3' : 'text-ink-1'}>{children}</div>
    </div>
  );
}

function AiFeature({
  tone,
  title,
  body,
  icon,
}: {
  tone: 'brand' | 'accent' | 'violet';
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  const bubble = {
    brand:  'bg-brand-500/15 border-brand-500/30 text-brand-300',
    accent: 'bg-accent-500/15 border-accent-500/30 text-accent-300',
    violet: 'bg-violet-500/15 border-violet-500/30 text-violet-300',
  }[tone];
  return (
    <div className="flex items-start gap-3">
      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${bubble}`}>
        {icon}
      </div>
      <div>
        <div className="font-semibold text-ink-0">{title}</div>
        <div className="text-sm text-ink-3">{body}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * OPERATIONS — 6 feature cards, gradient icons
 * ═══════════════════════════════════════════════════════════════════════════ */
function OperationsSection({ t }: { t: TFn }) {
  const cards: {
    gradient: string;
    hoverBorder: string;
    icon: React.ReactNode;
    title: string;
    body: string;
  }[] = [
    {
      gradient: 'from-brand-500 to-accent-500',
      hoverBorder: 'hover:border-brand-500/30',
      icon: <Camera className="w-5 h-5 text-white" strokeWidth={1.8} />,
      title: t('ds.ops.f1.title'),
      body: t('ds.ops.f1.body'),
    },
    {
      gradient: 'from-violet-500 to-brand-500',
      hoverBorder: 'hover:border-violet-500/30',
      icon: <Grid className="w-5 h-5 text-white" strokeWidth={1.8} />,
      title: t('ds.ops.f2.title'),
      body: t('ds.ops.f2.body'),
    },
    {
      gradient: 'from-accent-500 to-success-500',
      hoverBorder: 'hover:border-accent-500/30',
      icon: <FileBarChart className="w-5 h-5 text-white" strokeWidth={1.8} />,
      title: t('ds.ops.f3.title'),
      body: t('ds.ops.f3.body'),
    },
    {
      gradient: 'from-warning-500 to-danger-500',
      hoverBorder: 'hover:border-warning-500/30',
      icon: <Map className="w-5 h-5 text-white" strokeWidth={1.8} />,
      title: t('ds.ops.f4.title'),
      body: t('ds.ops.f4.body'),
    },
    {
      gradient: 'from-success-500 to-accent-500',
      hoverBorder: 'hover:border-success-500/30',
      icon: <Users className="w-5 h-5 text-white" strokeWidth={1.8} />,
      title: t('ds.ops.f5.title'),
      body: t('ds.ops.f5.body'),
    },
    {
      gradient: 'from-brand-500 to-violet-500',
      hoverBorder: 'hover:border-violet-500/30',
      icon: <ShieldCheck className="w-5 h-5 text-white" strokeWidth={1.8} />,
      title: t('ds.ops.f6.title'),
      body: t('ds.ops.f6.body'),
    },
  ];

  return (
    <section className="relative py-28 overflow-hidden bg-navy-2">
      <div className="absolute inset-0 grid-floor-flat opacity-25" aria-hidden />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-end justify-between mb-14 gap-6 reveal">
          <div className="max-w-3xl">
            <div className="ds-pill ds-pill-accent mb-4">{t('ds.ops.eyebrow')}</div>
            <h2
              className="headline-xl text-ink-0"
              style={{ fontSize: 'clamp(2.25rem,5vw,4rem)' }}
            >
              {t('ds.ops.title.pre')}
              <span className="italic tg-cool">{t('ds.ops.title.italic')}</span>
              {t('ds.ops.title.post')}
            </h2>
          </div>
          <a
            href="#integrations"
            className="text-sm text-ink-3 hover:text-ink-1 font-mono group inline-flex items-center gap-2"
          >
            {t('ds.ops.integrations')}
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <div
              key={c.title}
              className={`ds-card p-6 transition group cursor-default ${c.hoverBorder}`}
            >
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition`}
              >
                {c.icon}
              </div>
              <h3 className="font-display text-lg font-semibold text-ink-0 mb-2">{c.title}</h3>
              <p className="text-ink-3 text-sm leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * EDGE — architecture diagram: Sources → Python core → Outputs, hardware footer
 * ═══════════════════════════════════════════════════════════════════════════ */
function EdgeSection({ t }: { t: TFn }) {
  return (
    <section id="integrations" className="relative py-28 overflow-hidden bg-navy">
      <div className="absolute inset-0 aurora-bg opacity-40" aria-hidden />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 reveal">
          <div className="ds-pill ds-pill-brand mb-4 mx-auto">{t('ds.edge.eyebrow')}</div>
          <h2
            className="headline-xl text-ink-0 mb-5"
            style={{ fontSize: 'clamp(2.25rem,5vw,4rem)' }}
          >
            {t('ds.edge.title.pre')}
            <span className="italic tg-violet">{t('ds.edge.title.italic')}</span>
            {t('ds.edge.title.post')}
          </h2>
          <p className="text-ink-2 text-lg leading-relaxed">{t('ds.edge.body')}</p>
        </div>

        <div className="reveal">
          <div className="ds-card-bright rounded-3xl p-10 border border-white/10 mock-shadow">
            <div className="grid grid-cols-12 gap-6 items-center">
              {/* Sources */}
              <div className="col-span-12 md:col-span-3 space-y-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-4 font-mono mb-2">
                  {t('ds.edge.sources.label')}
                </div>
                <EdgeNode icon={<Camera className="w-5 h-5 text-accent-300" />} title={t('ds.edge.sources.cam')} meta={t('ds.edge.sources.cam.meta')} />
                <EdgeNode icon={<Youtube className="w-5 h-5 text-accent-300" />} title={t('ds.edge.sources.yt')} meta={t('ds.edge.sources.yt.meta')} />
                <EdgeNode icon={<MonitorSmartphone className="w-5 h-5 text-accent-300" />} title={t('ds.edge.sources.web')} meta={t('ds.edge.sources.web.meta')} />
              </div>

              <div className="col-span-12 md:col-span-1 hidden md:block">
                <svg viewBox="0 0 100 200" className="w-full h-48">
                  <path d="M0 30 Q50 30 100 100" stroke="#7de6ff" strokeWidth="1.5" fill="none" strokeDasharray="3 4" />
                  <path d="M0 100 L100 100" stroke="#7de6ff" strokeWidth="1.5" fill="none" strokeDasharray="3 4" />
                  <path d="M0 170 Q50 170 100 100" stroke="#7de6ff" strokeWidth="1.5" fill="none" strokeDasharray="3 4" />
                </svg>
              </div>

              <div className="col-span-12 md:col-span-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-4 font-mono mb-2 text-center">
                  {t('ds.edge.core.label')}
                </div>
                <div className="gradient-border rounded-2xl p-5 relative bg-surface-2/70">
                  <div className="text-center mb-3">
                    <div className="inline-flex items-center gap-2 ds-pill ds-pill-brand">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-300 live-dot" />
                      {t('ds.edge.core.badge')}
                    </div>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <EdgeCoreRow k="Capture" v="30 fps" />
                    <EdgeCoreRow k="Inference" v="60 fps" />
                    <EdgeCoreRow k="InsightFace" v="buffalo_l" />
                    <EdgeCoreRow k="Tracker" v="BoT-SORT" />
                  </div>
                </div>
              </div>

              <div className="col-span-12 md:col-span-1 hidden md:block">
                <svg viewBox="0 0 100 200" className="w-full h-48">
                  <path d="M0 100 L100 40" stroke="#c89bff" strokeWidth="1.5" fill="none" strokeDasharray="3 4" />
                  <path d="M0 100 L100 100" stroke="#c89bff" strokeWidth="1.5" fill="none" strokeDasharray="3 4" />
                  <path d="M0 100 L100 160" stroke="#c89bff" strokeWidth="1.5" fill="none" strokeDasharray="3 4" />
                </svg>
              </div>

              <div className="col-span-12 md:col-span-3 space-y-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-4 font-mono mb-2">
                  {t('ds.edge.outputs.label')}
                </div>
                <EdgeNode
                  icon={<LayoutDashboard className="w-5 h-5 text-violet-300" />}
                  title={t('ds.edge.outputs.fe')}
                  meta={t('ds.edge.outputs.fe.meta')}
                  tone="violet"
                />
                <EdgeNode
                  icon={<Zap className="w-5 h-5 text-violet-300" />}
                  title={t('ds.edge.outputs.be')}
                  meta={t('ds.edge.outputs.be.meta')}
                  tone="violet"
                />
                <EdgeNode
                  icon={<Database className="w-5 h-5 text-violet-300" />}
                  title={t('ds.edge.outputs.db')}
                  meta={t('ds.edge.outputs.db.meta')}
                  tone="violet"
                />
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <HwMetric label={t('ds.edge.hw.gpu')} value={t('ds.edge.hw.gpu.v')} />
              <HwMetric label={t('ds.edge.hw.ep')} value={t('ds.edge.hw.ep.v')} />
              <HwMetric label={t('ds.edge.hw.engine')} value={t('ds.edge.hw.engine.v')} />
              <HwMetric label={t('ds.edge.hw.cold')} value={t('ds.edge.hw.cold.v')} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EdgeNode({
  icon,
  title,
  meta,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  tone?: 'violet';
}) {
  const cls = tone === 'violet' ? 'border-violet-500/20 bg-violet-500/5' : 'border-white/5 bg-surface-1';
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${cls}`}>
      {icon}
      <div>
        <div className="text-sm text-ink-1">{title}</div>
        <div className="text-[10px] text-ink-4 font-mono">{meta}</div>
      </div>
    </div>
  );
}

function EdgeCoreRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-surface-1/60">
      <span className="text-ink-3">{k}</span>
      <span className="text-accent-300">{v}</span>
    </div>
  );
}

function HwMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-ink-4 font-mono">{label}</div>
      <div className="font-display text-lg text-ink-1 tabular-nums">{value}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * FINAL CTA — big conic orb, 2 CTAs, 4 trust pills
 * ═══════════════════════════════════════════════════════════════════════════ */
function FinalCtaSection({ t }: { t: TFn }) {
  return (
    <section id="start" className="relative py-28 overflow-hidden bg-navy">
      <div className="absolute inset-0 conic-orb drift opacity-50" aria-hidden />
      <div className="absolute inset-0 grid-floor-flat grid-floor-fade opacity-40" aria-hidden />
      <div className="relative max-w-5xl mx-auto px-6 text-center reveal">
        <div className="ds-pill ds-pill-brand mb-6 mx-auto">{t('ds.cta.eyebrow')}</div>
        <h2
          className="headline-xl text-ink-0 mb-6"
          style={{ fontSize: 'clamp(2.5rem,6vw,5.5rem)' }}
        >
          {t('ds.cta.title.pre')}
          <span className="italic tg-violet">{t('ds.cta.title.italic')}</span>
          {t('ds.cta.title.post')}
        </h2>
        <p className="text-ink-2 text-lg leading-relaxed max-w-2xl mx-auto mb-10">{t('ds.cta.body')}</p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/register"
            className="btn-primary inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-lg"
          >
            {t('ds.cta.primary')}
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl ds-card text-ink-1 font-semibold text-lg hover:border-brand-500/40 transition"
          >
            {t('ds.cta.secondary')}
          </Link>
        </div>

        <div className="mt-10 flex items-center justify-center gap-6 text-xs font-mono text-ink-4 flex-wrap">
          {[t('ds.cta.trust1'), t('ds.cta.trust2'), t('ds.cta.trust3'), t('ds.cta.trust4')].map((x) => (
            <span key={x} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success-400" />
              {x}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * FOOTER — mega grid with large ObservAI watermark
 * ═══════════════════════════════════════════════════════════════════════════ */
function Footer({ t }: { t: TFn }) {
  return (
    <footer className="relative bg-navy-2 border-t border-white/5 pt-20 pb-10 overflow-hidden">
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full blur-3xl opacity-30"
        style={{ background: 'radial-gradient(closest-side, #1d6bff, transparent)' }}
        aria-hidden
      />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-12 gap-12 mb-16">
          <div className="col-span-12 lg:col-span-6">
            <div className="flex items-center gap-3 mb-4">
              <img src={markSvg} className="h-10 w-10" alt="" />
              <span className="font-display text-2xl font-semibold tracking-tight text-ink-0">ObservAI</span>
            </div>
            <p className="text-ink-3 max-w-md leading-relaxed mb-6">{t('ds.footer.tagline')}</p>
          </div>
          <FooterColumn
            title={t('ds.footer.group.product')}
            items={[
              t('ds.footer.group.product.l1'),
              t('ds.footer.group.product.l2'),
              t('ds.footer.group.product.l3'),
              t('ds.footer.group.product.l4'),
              t('ds.footer.group.product.l5'),
            ]}
          />
          <FooterColumn
            title={t('ds.footer.group.company')}
            items={[
              t('ds.footer.group.company.l1'),
              t('ds.footer.group.company.l2'),
              t('ds.footer.group.company.l3'),
              t('ds.footer.group.company.l4'),
              t('ds.footer.group.company.l5'),
            ]}
          />
          <FooterColumn
            title={t('ds.footer.group.legal')}
            items={[
              t('ds.footer.group.legal.l1'),
              t('ds.footer.group.legal.l2'),
              t('ds.footer.group.legal.l3'),
              t('ds.footer.group.legal.l4'),
            ]}
          />
        </div>

        {/* Giant watermark wordmark */}
        <div className="relative">
          <svg viewBox="0 0 1200 140" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="wm" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#1d6bff" stopOpacity=".3" />
                <stop offset=".5" stopColor="#9a4dff" stopOpacity=".25" />
                <stop offset="1" stopColor="#06a1e6" stopOpacity=".3" />
              </linearGradient>
            </defs>
            <text
              x="600"
              y="116"
              textAnchor="middle"
              fontFamily="Space Grotesk"
              fontWeight="700"
              fontSize="160"
              fill="url(#wm)"
              letterSpacing="-6"
            >
              ObservAI
            </text>
          </svg>
        </div>

        <div className="mt-10 flex items-center justify-between text-xs text-ink-4 font-mono border-t border-white/5 pt-6">
          <div>{t('ds.footer.copyright')}</div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-success-400 live-dot" />
            {t('ds.footer.status')}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="col-span-6 md:col-span-3 lg:col-span-2">
      <div className="text-[11px] uppercase tracking-[0.2em] text-ink-4 font-mono mb-4">{title}</div>
      <ul className="space-y-2.5 text-sm">
        {items.map((it) => (
          <li key={it}>
            <a className="text-ink-2 hover:text-ink-0 transition cursor-default">{it}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
