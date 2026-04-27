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
  const totalGender = gender.male + gender.female + gender.unknown;
  const malePct = totalGender ? Math.round((gender.male / totalGender) * 100) : 0;
  const femalePct = totalGender ? Math.round((gender.female / totalGender) * 100) : 0;
  const unknownPct = totalGender ? Math.max(0, 100 - malePct - femalePct) : 0;

  const C = 2 * Math.PI * 22;
  const maleLen = (malePct / 100) * C;
  const femaleLen = (femalePct / 100) * C;
  const maleOffset = C - maleLen;
  const femaleRotation = (malePct / 100) * 360 - 90;

  const ageVals = AGE_ORDER.map((k) => age?.[k] ?? 0);
  const totalAge = ageVals.reduce((a, b) => a + b, 0);
  const maxAge = Math.max(1, ...ageVals);
  const ageToneFor = (i: number) => {
    if (i < 3) return ['bg-brand-500/40', 'bg-brand-500/70', 'bg-brand-500'][i];
    if (i === 3) return 'bg-brand-400';
    if (i === 4) return 'bg-accent-400';
    if (i === 5) return 'bg-accent-500/70';
    return 'bg-accent-500/40';
  };

  if (loading) {
    return (
      <GlassCard variant="neon" className="p-5 h-full">
        <div className="h-[220px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-400" />
        </div>
      </GlassCard>
    );
  }

  if (totalGender === 0 && totalAge === 0) {
    return (
      <GlassCard variant="neon" className="p-5 h-full">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-[0.18em] font-mono mb-2">
          {t('charts.demographics.title')}
        </p>
        <div className="h-[180px] flex flex-col items-center justify-center text-ink-3">
          <p className="text-sm font-medium">{t('charts.empty.title')}</p>
          <p className="text-xs mt-1 text-ink-4">{t('charts.empty.live')}</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="neon" className="p-5 h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-[0.18em] font-mono">
          {t('charts.demographics.title')}
        </p>
        <span className="text-[10px] text-ink-4 font-mono">
          {totalGender || totalAge} · {t('charts.demographics.live')}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <svg viewBox="0 0 60 60" className="w-20 h-20 -rotate-90 flex-shrink-0">
          <circle cx="30" cy="30" r="22" fill="none" stroke="#111a33" strokeWidth="9" />
          {malePct > 0 && (
            <circle
              cx="30" cy="30" r="22" fill="none"
              stroke="#1d6bff" strokeWidth="9"
              strokeDasharray={C} strokeDashoffset={maleOffset} strokeLinecap="round"
            />
          )}
          {femalePct > 0 && (
            <circle
              cx="30" cy="30" r="22" fill="none"
              stroke="#9a4dff" strokeWidth="9"
              strokeDasharray={`${femaleLen} ${C}`} strokeLinecap="round"
              transform={`rotate(${femaleRotation} 30 30)`}
            />
          )}
        </svg>
        <div className="space-y-1.5 text-xs flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-brand-500" />
            <span className="text-ink-2 truncate">{t('charts.gender.male')}</span>
            <span className="text-ink-4 font-mono ml-auto tabular-nums">{malePct}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-violet-500" />
            <span className="text-ink-2 truncate">{t('charts.gender.female')}</span>
            <span className="text-ink-4 font-mono ml-auto tabular-nums">{femalePct}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-ink-4" />
            <span className="text-ink-2 truncate">{t('charts.gender.unknown')}</span>
            <span className="text-ink-4 font-mono ml-auto tabular-nums">{unknownPct}%</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="text-[10px] uppercase tracking-widest text-ink-4 font-mono">
          {t('charts.demographics.age')}
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
          {AGE_ORDER.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
});

export default DemographicsCard;
