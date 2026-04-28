import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudRain, Sun, CloudSnow, Wind, Droplet, Car, type LucideIcon } from 'lucide-react';
import { useDashboardFilter } from '../../contexts/DashboardFilterContext';
import { useLanguage } from '../../contexts/LanguageContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CACHE_TTL_MS = 10 * 60 * 1000;
const TRAFFIC_TTL_MS = 5 * 60 * 1000;

interface WeatherData {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  precipitation?: number;
  humidity?: number;
  time?: string;
  branch: { id: string; name: string; city: string };
}

interface TrafficData {
  congestion: number;
  level: 'low' | 'medium' | 'high';
  currentSpeed?: number;
  freeFlowSpeed?: number;
  source: 'tomtom' | 'heuristic';
  localHour: number;
  branch: { id: string; name: string; city: string };
}

type WeatherCondition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

// Open-Meteo weather code → semantic condition. Yan #11: caller resolves
// the i18n string via t('weather.code.<condition>') so TR/EN both render
// in the dashboard's active locale instead of a hardcoded TR string.
export function weatherCodeCondition(code: number): WeatherCondition {
  if ([0, 1].includes(code)) return 'clear';
  if ([2, 3].includes(code)) return 'partly';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'cloudy';
}

function weatherMeta(condition: WeatherCondition): { Icon: LucideIcon; accent: string } {
  switch (condition) {
    case 'clear': return { Icon: Sun, accent: '#f59e0b' };
    case 'partly': return { Icon: Cloud, accent: '#94a3b8' };
    case 'fog': return { Icon: Cloud, accent: '#64748b' };
    case 'rain': return { Icon: CloudRain, accent: '#3b82f6' };
    case 'snow': return { Icon: CloudSnow, accent: '#60a5fa' };
    case 'storm': return { Icon: CloudRain, accent: '#a855f7' };
    case 'cloudy':
    default: return { Icon: Cloud, accent: '#94a3b8' };
  }
}

function trafficAccent(level: 'low' | 'medium' | 'high'): string {
  if (level === 'high') return '#ef4444';
  if (level === 'medium') return '#f59e0b';
  return '#22c55e';
}

export function WeatherWidget() {
  const { selectedBranch } = useDashboardFilter();
  const { lang, t } = useLanguage();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBranch) { setWeather(null); setTraffic(null); return; }

    const wKey = `weather:${selectedBranch.id}`;
    const tKey = `traffic:${selectedBranch.id}`;

    let usedWeatherCache = false;
    const wCached = localStorage.getItem(wKey);
    if (wCached) {
      try {
        const parsed = JSON.parse(wCached);
        if (parsed.expiresAt > Date.now()) {
          setWeather(parsed.data);
          usedWeatherCache = true;
        }
      } catch { /* ignore */ }
    }

    const tCached = localStorage.getItem(tKey);
    if (tCached) {
      try {
        const parsed = JSON.parse(tCached);
        if (parsed.expiresAt > Date.now()) {
          setTraffic(parsed.data);
        }
      } catch { /* ignore */ }
    }

    if (!usedWeatherCache) setLoading(true);
    setError(null);

    const wPromise = fetch(`${API_URL}/api/branches/${selectedBranch.id}/weather`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const current = data.current_weather;
        const payload: WeatherData = {
          temperature: current?.temperature ?? 0,
          windSpeed: current?.windspeed ?? 0,
          weatherCode: current?.weathercode ?? 0,
          precipitation: data.hourly?.precipitation_probability?.[0],
          time: current?.time,
          branch: data.branch,
        };
        setWeather(payload);
        localStorage.setItem(wKey, JSON.stringify({ data: payload, expiresAt: Date.now() + CACHE_TTL_MS }));
      });

    const tPromise = fetch(`${API_URL}/api/branches/${selectedBranch.id}/traffic`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data: TrafficData = await r.json();
        setTraffic(data);
        localStorage.setItem(tKey, JSON.stringify({ data, expiresAt: Date.now() + TRAFFIC_TTL_MS }));
      })
      .catch(() => { /* traffic optional, swallow */ });

    Promise.all([wPromise, tPromise])
      .catch((e) => setError(e instanceof Error ? e.message : t('weather.fetchFail')))
      .finally(() => setLoading(false));
  }, [selectedBranch?.id, t]);

  if (!selectedBranch) return null;

  return (
    <AnimatePresence mode="wait">
      {weather ? (
        <motion.div
          key={weather.branch.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="relative overflow-hidden surface-card rounded-xl p-4"
        >
          <WeatherContent w={weather} traffic={traffic} lang={lang as 'tr' | 'en'} />
        </motion.div>
      ) : loading ? (
        <div className="surface-card rounded-xl p-4 text-xs text-ink-3">
          {t('weather.loading')}
        </div>
      ) : error ? (
        <div className="surface-card rounded-xl p-4 text-xs text-danger-300">
          {error}
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function WeatherContent({ w, traffic, lang: _lang }: { w: WeatherData; traffic: TrafficData | null; lang: 'tr' | 'en' }) {
  const { t } = useLanguage();
  const condition = weatherCodeCondition(w.weatherCode);
  const { Icon, accent } = weatherMeta(condition);
  const label = t(`weather.code.${condition}`);
  const trafficLabel = traffic ? t(`weather.traffic.${traffic.level}`) : null;
  const trafficColor = traffic ? trafficAccent(traffic.level) : null;
  const trafficPct = traffic ? Math.round(traffic.congestion * 100) : null;

  return (
    <>
      <div
        className="pointer-events-none absolute -top-10 -right-6 w-32 h-32 rounded-full blur-3xl opacity-30"
        style={{ background: accent }}
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accent}25` }}>
            <Icon className="w-7 h-7" style={{ color: accent }} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold text-ink-0 leading-none">{Math.round(w.temperature)}°C</div>
            <div className="text-xs text-ink-3 mt-0.5 truncate">{label} · {w.branch.city}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-ink-3 flex-shrink-0">
          <div className="flex items-center gap-1" title={t('weather.wind')}>
            <Wind className="w-3.5 h-3.5" />
            <span className="font-mono">{Math.round(w.windSpeed)} km/s</span>
          </div>
          {typeof w.precipitation === 'number' && (
            <div className="flex items-center gap-1" title={t('weather.rainProbability')}>
              <Droplet className="w-3.5 h-3.5" />
              <span className="font-mono">%{w.precipitation}</span>
            </div>
          )}
        </div>
      </div>

      {trafficLabel && trafficColor !== null && (
        <div className="relative mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${trafficColor}25` }}
            >
              <Car className="w-4 h-4" style={{ color: trafficColor }} strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-ink-1">
                {t('weather.traffic')}: <span style={{ color: trafficColor }}>{trafficLabel}</span>
              </div>
              <div className="text-[10px] text-ink-4 font-mono">
                {trafficPct}%
                {traffic?.currentSpeed && traffic?.freeFlowSpeed && (
                  <> · {traffic.currentSpeed}/{traffic.freeFlowSpeed} km/s</>
                )}
                {traffic?.source === 'heuristic' && <> · {t('weather.traffic.estimate')}</>}
              </div>
            </div>
          </div>
          <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full transition-[width] duration-500"
              style={{ width: `${trafficPct}%`, backgroundColor: trafficColor }}
            />
          </div>
        </div>
      )}
    </>
  );
}
