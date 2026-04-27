import { memo, useEffect, useState } from 'react';
import { analyticsDataService, AnalyticsData } from '../../services/analyticsDataService';
import { useLanguage } from '../../contexts/LanguageContext';
import { GlassCard } from '../ui/GlassCard';

const AGE_ORDER = ['0-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;

const DemographicsCard = memo(function DemographicsCard() {
  const { t } = useLanguage();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = (d: AnalyticsData) => setData(d);
    const load = async () => {
      const d = await analyticsDataService.getData();
      setData(d);
      setLoading(false);
    };
    load();
    const unsub = analyticsDataService.startRealtimeUpdates(handle);
    return () => unsub();
  }, []);

  const gender = data?.gender ?? { male: 0, female: 0, unknown: 0 };
  const age = data?.age;
  const genderByAge = data?.genderByAge ?? {};
  const totalGender = gender.male + gender.female + gender.unknown;
  const malePct = totalGender ? Math.round((gender.male / totalGender) * 100) : 0;
  const femalePct = totalGender ? Math.round((gender.female / totalGender) * 100) : 0;
  const unknownPct = totalGender ? Math.max(0, 100 - malePct - femalePct) : 0;

  // Donut geometry — circumference of r=22 stroke. We use butt caps (not round)
  // so the male/female arcs join flush at 100% with no visual gap.
  const C = 2 * Math.PI * 22;
  const maleLen = (gender.male / Math.max(1, totalGender)) * C;
  const femaleLen = (gender.female / Math.max(1, totalGender)) * C;
  const unknownLen = (gender.unknown / Math.max(1, totalGender)) * C;

  const ageVals = AGE_ORDER.map((k) => age?.[k] ?? 0);
  const totalAge = ageVals.reduce((a, b) => a + b, 0);
  const maxAge = Math.max(1, ...ageVals);

  if (loading) {
    return (
      <GlassCard variant="neon" className="p-5">
        <div className="h-[180px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-400" />
        </div>
      </GlassCard>
    );
  }

  if (totalGender === 0 && totalAge === 0) {
    return (
      <GlassCard variant="neon" className="p-5">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-[0.18em] font-mono mb-2">
          {t('charts.demographics.title')}
        </p>
        <div className="h-[140px] flex flex-col items-center justify-center text-ink-3">
          <p className="text-sm font-medium">{t('charts.empty.title')}</p>
          <p className="text-xs mt-1 text-ink-4">{t('charts.empty.live')}</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="neon" className="p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-[0.18em] font-mono">
          {t('charts.demographics.title')}
        </p>
      </div>

      {/* Gender donut + legend */}
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 60 60" className="w-16 h-16 -rotate-90 flex-shrink-0">
          {/* Track */}
          <circle cx="30" cy="30" r="22" fill="none" stroke="#111a33" strokeWidth="9" />
          {/* Male arc — starts at top (12 o'clock after -90 rotation) */}
          {gender.male > 0 && (
            <circle
              cx="30" cy="30" r="22" fill="none"
              stroke="#1d6bff" strokeWidth="9"
              strokeDasharray={`${maleLen} ${C}`}
              strokeDashoffset="0"
            >
              <title>{`${t('charts.gender.male')}: ${gender.male} (${malePct}%)`}</title>
            </circle>
          )}
          {/* Female arc — offset by male length, butt caps so it joins flush */}
          {gender.female > 0 && (
            <circle
              cx="30" cy="30" r="22" fill="none"
              stroke="#9a4dff" strokeWidth="9"
              strokeDasharray={`${femaleLen} ${C}`}
              strokeDashoffset={-maleLen}
            >
              <title>{`${t('charts.gender.female')}: ${gender.female} (${femalePct}%)`}</title>
            </circle>
          )}
          {/* Unknown arc — only when present */}
          {gender.unknown > 0 && (
            <circle
              cx="30" cy="30" r="22" fill="none"
              stroke="#64748b" strokeWidth="9"
              strokeDasharray={`${unknownLen} ${C}`}
              strokeDashoffset={-(maleLen + femaleLen)}
            >
              <title>{`${t('charts.gender.unknown')}: ${gender.unknown} (${unknownPct}%)`}</title>
            </circle>
          )}
        </svg>
        <div className="space-y-1 text-[11px] flex-1 min-w-0">
          <div className="flex items-center gap-2" title={`${gender.male} ${t('charts.gender.male')}`}>
            <span className="w-2 h-2 rounded-sm bg-brand-500" />
            <span className="text-ink-2 truncate">{t('charts.gender.male')}</span>
            <span className="text-ink-4 font-mono ml-auto tabular-nums">{malePct}%</span>
          </div>
          <div className="flex items-center gap-2" title={`${gender.female} ${t('charts.gender.female')}`}>
            <span className="w-2 h-2 rounded-sm bg-violet-500" />
            <span className="text-ink-2 truncate">{t('charts.gender.female')}</span>
            <span className="text-ink-4 font-mono ml-auto tabular-nums">{femalePct}%</span>
          </div>
          {gender.unknown > 0 && (
            <div className="flex items-center gap-2" title={`${gender.unknown} ${t('charts.gender.unknown')}`}>
              <span className="w-2 h-2 rounded-sm bg-ink-4" />
              <span className="text-ink-2 truncate">{t('charts.gender.unknown')}</span>
              <span className="text-ink-4 font-mono ml-auto tabular-nums">{unknownPct}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Age distribution — stacked bars: blue = male, violet = female. Tooltip
          shows male/female/total per bucket. Falls back to a single-tone bar
          when genderByAge is empty (Python pipeline didn't emit per-bucket split). */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-ink-4 font-mono">
          <span>{t('charts.demographics.age')}</span>
          <span className="flex items-center gap-2 normal-case tracking-normal">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-brand-500" />{t('charts.gender.male')}</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-violet-500" />{t('charts.gender.female')}</span>
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1 items-end h-10">
          {AGE_ORDER.map((label, i) => {
            const v = ageVals[i];
            const bucket = genderByAge[label] ?? { male: 0, female: 0, unknown: 0 };
            const bucketTotal = bucket.male + bucket.female + bucket.unknown;
            const barH = (v / maxAge) * 100;
            // If no genderByAge data, render as single brand-tone bar.
            const useSplit = bucketTotal > 0;
            const malePart = useSplit ? (bucket.male / bucketTotal) * 100 : 0;
            const femalePart = useSplit ? (bucket.female / bucketTotal) * 100 : 0;
            return (
              <div
                key={label}
                className="relative h-full flex flex-col-reverse"
                title={
                  useSplit
                    ? `${label}: ${v} (${t('charts.gender.male')}:${bucket.male} · ${t('charts.gender.female')}:${bucket.female})`
                    : `${label}: ${v}`
                }
              >
                <div
                  className="rounded-sm overflow-hidden flex flex-col-reverse"
                  style={{ height: `${barH}%`, minHeight: v > 0 ? '4px' : '2px' }}
                >
                  {useSplit ? (
                    <>
                      <div className="bg-brand-500 transition-[height] duration-500" style={{ height: `${malePart}%` }} />
                      <div className="bg-violet-500 transition-[height] duration-500" style={{ height: `${femalePart}%` }} />
                    </>
                  ) : (
                    <div className="bg-brand-500/70 h-full" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 gap-1 text-[9px] text-ink-4 text-center font-mono">
          {AGE_ORDER.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
});

export default DemographicsCard;
