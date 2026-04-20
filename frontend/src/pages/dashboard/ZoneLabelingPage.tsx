import ZoneCanvas from '../../components/camera/ZoneCanvas';
import { useLanguage } from '../../contexts/LanguageContext';

export default function ZoneLabelingPage() {
  const { t } = useLanguage();
  const steps = [1, 2, 3, 4, 5] as const;
  return (
    <div className="p-6">
      <ZoneCanvas />

      <div className="mt-6 rounded-xl border border-brand-500/25 p-6 backdrop-blur-md bg-surface-1/60 surface-card">
        <h3 className="font-display text-lg font-semibold text-ink-0 mb-4 tracking-tight">{t('zones.howTo.title')}</h3>
        <div className="space-y-3 text-sm text-ink-2">
          {steps.map((n) => (
            <div key={n} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-brand-500/15 text-brand-300 border border-brand-500/30 rounded-full flex items-center justify-center text-xs font-bold font-mono">
                {n}
              </span>
              <p className="leading-relaxed" dangerouslySetInnerHTML={{ __html: t(`zones.howTo.step${n}`) }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
