import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2, Send, Mail, UserCheck, UserX } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { StaffRecord } from './StaffForm';

interface Props {
  staff: StaffRecord[];
  loading: boolean;
  onEdit: (s: StaffRecord) => void;
  onDelete: (id: string) => void;
  onSendTest: (s: StaffRecord) => void;
}

export function StaffList({ staff, loading, onEdit, onDelete, onSendTest }: Props) {
  const { t } = useLanguage();

  const roleLabel = (role: string) => {
    const key = `staffList.role.${role}`;
    const val = t(key);
    return val === key ? role : val;
  };

  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="inline-block w-6 h-6 rounded-full border-2 border-brand-400/30 border-t-brand-400 animate-spin" />
        <p className="text-sm text-ink-3 mt-3">{t('common.loading')}</p>
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="surface-card rounded-2xl p-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500/10 mb-4">
          <UserCheck className="w-7 h-7 text-brand-300" strokeWidth={1.5} />
        </div>
        <p className="text-ink-2 font-medium">{t('staffList.empty.title')}</p>
        <p className="text-sm text-ink-4 mt-1">{t('staffList.empty.hint')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence>
        {staff.map((s, i) => (
          <motion.div
            key={s.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ delay: i * 0.04, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -2 }}
            className={`relative group surface-card rounded-2xl p-5 ${!s.isActive ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-500/40 to-accent-500/30 flex items-center justify-center font-semibold text-white">
                  {s.firstName[0]}{s.lastName[0]}
                </div>
                <div>
                  <div className="font-semibold text-ink-0">{s.firstName} {s.lastName}</div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-4 font-mono">{roleLabel(s.role)}</div>
                </div>
              </div>
              {!s.isActive ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-danger-500/10 text-danger-300 border border-danger-500/30">
                  <UserX className="w-3 h-3" /> {t('staffList.status.inactive')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-success-500/10 text-success-300 border border-success-500/30">
                  <UserCheck className="w-3 h-3" /> {t('staffList.status.active')}
                </span>
              )}
            </div>

            <div className="space-y-1 text-xs text-ink-3 mb-4">
              {s.email ? (
                <div className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 text-ink-4" /> {s.email}</div>
              ) : (
                <div className="text-warning-300 text-[11px]">{t('staffList.emailMissing')}</div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(s)}
                className="flex-1 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-ink-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                {t('staffList.action.edit')}
              </button>
              {s.email && (
                <button
                  onClick={() => onSendTest(s)}
                  title={t('staffList.action.sendTest')}
                  className="px-3 py-1.5 bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 text-brand-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              )}
              <button
                onClick={() => onDelete(s.id)}
                title={t('staffList.action.deactivate')}
                className="px-3 py-1.5 text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors border border-white/[0.08]"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
