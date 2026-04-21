import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudRain, Sun, CloudSnow, Wind, Droplet, type LucideIcon } from 'lucide-react';
import { useDashboardFilter } from '../../contexts/DashboardFilterContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CACHE_TTL_MS = 10 * 60 * 1000;

interface WeatherData {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  precipitation?: number;
  humidity?: number;
  time?: string;
  branch: { id: string; name: string; city: string };
}

// Open-Meteo weather codes (subset) → label + icon
function weatherMeta(code: number): { label: string; Icon: LucideIcon; accent: string } {
  if ([0, 1].includes(code)) return { label: 'Acik', Icon: Sun, accent: '#f59e0b' };
  if ([2, 3].includes(code)) return { label: 'Parcali', Icon: Cloud, accent: '#94a3b8' };
  if ([45, 48].includes(code)) return { label: 'Sisli', Icon: Cloud, accent: '#64748b' };
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { label: 'Yagmurlu', Icon: CloudRain, accent: '#3b82f6' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Karli', Icon: CloudSnow, accent: '#60a5fa' };
  if ([95, 96, 99].includes(code)) return { label: 'Firtinali', Icon: CloudRain, accent: '#a855f7' };
  return { label: 'Bulutlu', Icon: Cloud, accent: '#94a3b8' };
}

export function WeatherWidget() {
  const { selectedBranch } = useDashboardFilter();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBranch) { setWeather(null); return; }

    // Simple localStorage cache
    const cacheKey = `weather:${selectedBranch.id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.expiresAt > Date.now()) {
          setWeather(parsed.data);
          return;
        }
      } catch { /* ignore */ }
    }

    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/branches/${selectedBranch.id}/weather`, { credentials: 'include' })
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
        localStorage.setItem(cacheKey, JSON.stringify({
          data: payload,
          expiresAt: Date.now() + CACHE_TTL_MS,
        }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Hava durumu alinamadi'))
      .finally(() => setLoading(false));
  }, [selectedBranch?.id]);

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
          <WeatherContent w={weather} />
        </motion.div>
      ) : loading ? (
        <div className="surface-card rounded-xl p-4 text-xs text-ink-3">
          Hava durumu yukleniyor...
        </div>
      ) : error ? (
        <div className="surface-card rounded-xl p-4 text-xs text-danger-300">
          {error}
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function WeatherContent({ w }: { w: WeatherData }) {
  const meta = weatherMeta(w.weatherCode);
  const { Icon, label, accent } = meta;
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
          <div className="flex items-center gap-1" title="Ruzgar">
            <Wind className="w-3.5 h-3.5" />
            <span className="font-mono">{Math.round(w.windSpeed)} km/s</span>
          </div>
          {typeof w.precipitation === 'number' && (
            <div className="flex items-center gap-1" title="Yagis ihtimali">
              <Droplet className="w-3.5 h-3.5" />
              <span className="font-mono">%{w.precipitation}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
