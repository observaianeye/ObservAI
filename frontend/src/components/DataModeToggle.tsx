import { Database, Radio, Lock } from 'lucide-react';
import { useDataMode } from '../contexts/DataModeContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function DataModeToggle() {
  const { dataMode, setDataMode, isModeLocked } = useDataMode();
  const { t } = useLanguage();

  return (
    <div className="inline-flex items-center bg-surface-2/70 border border-white/[0.08] rounded-xl overflow-hidden backdrop-blur-sm p-0.5 gap-0.5">
      <button
        onClick={() => setDataMode('demo')}
        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
          dataMode === 'demo'
            ? 'bg-violet-500/20 text-violet-200 border border-violet-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
            : 'text-ink-3 hover:text-ink-1 hover:bg-white/[0.04] border border-transparent'
        }`}
      >
        <Database className="w-3.5 h-3.5" />
        <span>{t('common.demo')}</span>
      </button>
      <button
        onClick={() => setDataMode('live')}
        disabled={isModeLocked}
        title={isModeLocked ? t('dataMode.lockedTitle') : undefined}
        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
          dataMode === 'live'
            ? 'bg-success-500/15 text-success-300 border border-success-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
            : isModeLocked
              ? 'text-ink-4 cursor-not-allowed border border-transparent'
              : 'text-ink-3 hover:text-ink-1 hover:bg-white/[0.04] border border-transparent'
        }`}
      >
        {isModeLocked ? <Lock className="w-3.5 h-3.5" /> : <Radio className="w-3.5 h-3.5" />}
        <span>{t('common.live')}</span>
        {dataMode === 'live' && (
          <span className="relative flex h-1.5 w-1.5 ml-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-300 opacity-70" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success-300" />
          </span>
        )}
      </button>
    </div>
  );
}
