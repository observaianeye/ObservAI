import { Mail, Check, AlertCircle } from 'lucide-react';

interface Props {
  email?: boolean;
  notifiedAt?: string | null;
  compact?: boolean;
}

export function NotificationStatusBadge({ email, notifiedAt, compact }: Props) {
  if (compact) {
    return (
      <div className="flex items-center gap-1 text-[10px]">
        <span
          className={`inline-flex items-center justify-center w-5 h-5 rounded-full border ${
            email ? 'bg-success-500/15 border-success-500/40 text-success-300' : 'bg-white/[0.03] border-white/[0.08] text-ink-4'
          }`}
          title={email ? 'Email gonderildi' : 'Email gonderilmedi'}
        >
          <Mail className="w-2.5 h-2.5" />
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs text-ink-3">
      <ChannelChip on={!!email} icon={Mail} label="Email" />
      {notifiedAt && email && (
        <span className="text-ink-4 text-[10px]">
          · {new Date(notifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      {!email && <span className="text-warning-300 text-[10px] inline-flex items-center gap-1"><AlertCircle className="w-3 h-3" /> henuz gonderilmedi</span>}
    </div>
  );
}

function ChannelChip({ on, icon: Icon, label }: { on: boolean; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${
        on
          ? 'bg-success-500/10 text-success-300 border-success-500/30'
          : 'bg-white/[0.03] text-ink-4 border-white/[0.08]'
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
      {on && <Check className="w-3 h-3" strokeWidth={2.5} />}
    </span>
  );
}
