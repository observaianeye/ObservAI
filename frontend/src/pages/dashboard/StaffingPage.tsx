import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, CalendarDays, Sparkles, Plus, Send, TrendingUp, TrendingDown, Circle, Building2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { useDashboardFilter } from '../../contexts/DashboardFilterContext';
import { StaffForm, type StaffRecord } from '../../components/staffing/StaffForm';
import { StaffList } from '../../components/staffing/StaffList';
import { ShiftCalendar, type Assignment } from '../../components/staffing/ShiftCalendar';
import { extractFieldErrors } from '../../lib/api/errors';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const FETCH_TIMEOUT_MS = 8000;

type Tab = 'staff' | 'schedule' | 'recommendations';

interface Recommendation {
  hour: number;
  avgCustomers: number;
  staffCount: number;
  ratio: number;
  status: 'optimal' | 'understaffed' | 'overstaffed';
  optimal: number;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

// Wrap fetch with abortable timeout so a hung backend can't keep a panel
// stuck on "Loading..." forever — surfaces an error instead.
async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { credentials: 'include', ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default function StaffingPage() {
  const { t, lang } = useLanguage();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const { showToast } = useToast();
  const { selectedBranch } = useDashboardFilter();
  const branchId = selectedBranch?.id || '';
  const [tab, setTab] = useState<Tab>('staff');

  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRecord | null>(null);
  const [staffError, setStaffError] = useState<string>('');

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recSummary, setRecSummary] = useState<{ totalHoursOff?: number; efficiency?: number; message?: string } | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recMeta, setRecMeta] = useState<{ needsMoreData: boolean; daysCollected?: number; daysRemaining?: number; reason?: string }>({ needsMoreData: false });
  const [notifSummary, setNotifSummary] = useState<{ emailSent: number; attempted: number }>({ emailSent: 0, attempted: 0 });

  const cameraId = selectedBranch?.cameras?.find((c) => c.isActive)?.id
    || selectedBranch?.cameras?.[0]?.id
    || '';

  // ── Staff CRUD ─────────────────────────────────────────────────────────
  const loadStaff = useCallback(async () => {
    if (!branchId) {
      setStaff([]);
      setStaffLoading(false);
      setStaffError('');
      return;
    }
    setStaffLoading(true);
    setStaffError('');
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/staff?branchId=${encodeURIComponent(branchId)}`);
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff || []);
      } else {
        setStaff([]);
        setStaffError(t('staffing.error.fetchFailed'));
      }
    } catch (err: any) {
      console.error('[staffing] load staff failed:', err);
      setStaff([]);
      setStaffError(err?.name === 'AbortError' ? t('staffing.error.timeout') : t('staffing.error.fetchFailed'));
    } finally {
      setStaffLoading(false);
    }
  }, [branchId, t]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const handleSaveStaff = async (payload: Partial<StaffRecord>) => {
    if (!editing && !branchId) {
      throw new Error(t('staffing.toast.selectBranchFirst'));
    }
    const method = editing ? 'PATCH' : 'POST';
    const url = editing ? `${API_URL}/api/staff/${editing.id}` : `${API_URL}/api/staff`;
    const body = editing ? payload : { ...payload, branchId };
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // Yan #1.4 follow-up: when the backend returns Zod issues, surface the
      // first field-level message instead of the generic "Invalid body" so the
      // user sees something actionable like "First name must contain at least
      // 1 character" rather than a meaningless toast.
      const fieldErrors = extractFieldErrors(data);
      const firstFieldMessage = fieldErrors ? Object.values(fieldErrors)[0] : null;
      throw new Error(firstFieldMessage || data.error || t('staffing.error.staffSaveFailed'));
    }
    showToast('success', editing ? t('staffing.toast.staffUpdated') : t('staffing.toast.staffSaved'));
    setFormOpen(false);
    setEditing(null);
    loadStaff();
  };

  // Faz 11: hard delete (DELETE ?hard=1) so removed staff disappears from the
  // list instead of lingering as an "Inactive" ghost. Confirm dialog quotes
  // the staff member's name and warns that StaffAssignment rows cascade with
  // them — the backend onDelete:Cascade enforces that, but the UX needs to
  // call it out so a manager doesn't lose tomorrow's shift roster by accident.
  const handleDeleteStaff = async (id: string) => {
    const target = staff.find((s) => s.id === id);
    const name = target ? `${target.firstName} ${target.lastName}`.trim() : id;
    if (!confirm(t('staffing.confirm.delete', { name }))) return;
    try {
      const res = await fetch(`${API_URL}/api/staff/${id}?hard=1`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast('error', data?.error || t('staffing.error.staffDeleteFailed'));
        return;
      }
      showToast('success', t('staffing.toast.staffDeleted'));
      // Optimistic local removal so the card disappears even if loadStaff hits
      // a transient network blip.
      setStaff((prev) => prev.filter((s) => s.id !== id));
      loadStaff();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('staffing.error.staffDeleteFailed'));
    }
  };

  const handleSendTest = async (s: StaffRecord) => {
    try {
      const res = await fetch(`${API_URL}/api/notifications/test-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          staffId: s.id,
          preview: {
            date: new Date().toLocaleDateString(locale),
            shiftStart: '09:00',
            shiftEnd: '17:00',
            role: s.role,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || t('staffing.toast.testEmailFailed'));
        return;
      }
      const em = data.result?.email;
      if (em?.sent) {
        showToast('success', t('staffing.toast.testEmailSent'));
      } else {
        showToast('warning', `${t('staffing.toast.emailResendFailed')}: ${em?.error ?? t('staffing.toast.emailUnknownErr')}`);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('staffing.toast.networkError'));
    }
  };

  // ── Assignments ──────────────────────────────────────────────────────────
  const loadAssignments = useCallback(async () => {
    if (!branchId) return;
    setAssignmentsLoading(true);
    try {
      const from = new Date(weekStart);
      const to = new Date(weekStart); to.setDate(to.getDate() + 7);
      const qs = new URLSearchParams({
        branchId,
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      });
      const res = await fetchWithTimeout(`${API_URL}/api/staff-assignments?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      }
    } catch (err) {
      console.error('[staffing] load assignments:', err);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [branchId, weekStart]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  const handleCreateAssignment = async (payload: { staffId: string; date: string; shiftStart: string; shiftEnd: string; role?: string; notifyNow: boolean }) => {
    if (!branchId) throw new Error(t('staffing.toast.selectBranchFirst'));
    const res = await fetch(`${API_URL}/api/staff-assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...payload, branchId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || t('staffing.error.shiftCreateFailed'));
    }
    const data = await res.json();
    const em = data.notification?.email;
    if (payload.notifyNow) {
      showToast(em?.sent ? 'success' : 'warning',
        em?.sent
          ? t('staffing.toast.shiftWithEmail')
          : t('staffing.toast.shiftWithEmailFail', { err: em?.error ?? t('staffing.toast.emailMissingAddr') }));
    } else {
      showToast('success', t('staffing.toast.shiftCreated'));
    }
    loadAssignments();
  };

  const handleDeleteAssignment = async (id: string) => {
    const res = await fetch(`${API_URL}/api/staff-assignments/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      showToast('warning', t('staffing.toast.shiftDeleted'));
      loadAssignments();
    }
  };

  const handleResendNotify = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/staff-assignments/${id}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('staffing.toast.emailResendFailed'));
      const ok = data.result?.email?.sent;
      showToast(ok ? 'success' : 'warning', ok ? t('staffing.toast.emailResent') : t('staffing.toast.emailResendFailed'));
      loadAssignments();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('staffing.toast.networkError'));
    }
  };

  // ── Recommendations (existing endpoint) ─────────────────────────────────
  const loadRecommendations = useCallback(async () => {
    if (!branchId) return;
    setRecLoading(true);
    try {
      const qs = cameraId ? `?cameraId=${encodeURIComponent(cameraId)}` : '';
      const res = await fetchWithTimeout(`${API_URL}/api/staffing/${branchId}/recommendations${qs}`);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
        setRecSummary(data.summary || null);
        setRecMeta({
          needsMoreData: !!data.needsMoreData,
          daysCollected: data.daysCollected,
          daysRemaining: data.daysRemaining,
          reason: data.reason,
        });
      } else {
        setRecommendations([]);
        setRecMeta({ needsMoreData: true, reason: 'fetch_error' });
      }
    } catch (err) {
      console.error('[staffing] recommendations:', err);
      setRecMeta({ needsMoreData: true, reason: 'network_error' });
    } finally {
      setRecLoading(false);
    }
  }, [branchId, cameraId]);

  useEffect(() => {
    if (tab === 'recommendations') loadRecommendations();
  }, [tab, loadRecommendations]);

  // ── Notification summary (real KPI from NotificationLog) ──────────────
  const loadNotifSummary = useCallback(async () => {
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/notifications/summary?days=7`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifSummary({
        emailSent: data.totals?.email?.sent ?? 0,
        attempted: data.totals?.all?.attempted ?? 0,
      });
    } catch (err) {
      console.error('[staffing] notif summary:', err);
    }
  }, []);

  useEffect(() => { loadNotifSummary(); }, [loadNotifSummary, assignments.length]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active = staff.filter((s) => s.isActive).length;
    const withEmail = staff.filter((s) => s.isActive && s.email).length;
    const thisWeek = assignments.length;
    // Real KPI comes from NotificationLog (7-day window): successful email
    // sends. Falls back to the per-assignment flag count when the summary
    // endpoint hasn't loaded yet.
    const notifiedFallback = assignments.filter((a) => a.notifiedViaEmail).length;
    const notified = notifSummary.attempted > 0 ? notifSummary.emailSent : notifiedFallback;
    return { active, withEmail, thisWeek, notified };
  }, [staff, assignments, notifSummary]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gradient-brand tracking-tight">{t('nav.staffing')}</h1>
          <p className="text-sm text-ink-3 mt-1">
            {t('staffing.subtitle.team')}
          </p>
        </div>
        {tab === 'staff' && branchId && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            data-testid="add-staff-trigger"
            onClick={() => { setEditing(null); setFormOpen(true); }}
            className="px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-xl font-semibold hover:shadow-glow-brand flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('staffing.addStaff')}
          </motion.button>
        )}
      </div>

      {selectedBranch ? (
        <div className="surface-card rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-ink-2">
          <Building2 className="w-4 h-4 text-brand-300" strokeWidth={1.5} />
          <span>
            <span className="text-ink-3">{t('staffing.activeBranch')}:</span>{' '}
            <span className="font-semibold text-ink-0">{selectedBranch.name}</span>
            <span className="text-ink-4"> &middot; {selectedBranch.city}</span>
          </span>
        </div>
      ) : (
        <div className="surface-card rounded-xl px-4 py-3 flex items-center gap-3 text-sm border border-warning-500/30 bg-warning-500/5">
          <Building2 className="w-4 h-4 text-warning-300" strokeWidth={1.5} />
          <span className="text-warning-200">
            {t('staffing.selectBranchHint')}
          </span>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Users}
          label={t('staffing.kpi.activeStaff')}
          value={String(kpis.active)}
          accent="brand"
        />
        <KpiCard
          icon={Send}
          label={t('staffing.kpi.emailConfigured')}
          value={`${kpis.withEmail}/${kpis.active}`}
          accent="violet"
        />
        <KpiCard
          icon={CalendarDays}
          label={t('staffing.kpi.shiftsThisWeek')}
          value={String(kpis.thisWeek)}
          accent="accent"
        />
        <KpiCard
          icon={Circle}
          label={t('staffing.kpi.notifsSent7d')}
          value={notifSummary.attempted > 0 ? String(kpis.notified) : `${kpis.notified}/${kpis.thisWeek}`}
          accent="success"
        />
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-1/60 border border-white/[0.08]">
        <TabButton active={tab === 'staff'} onClick={() => setTab('staff')} icon={<Users className="w-4 h-4" />} label={t('staffing.tab.staff')} />
        <TabButton active={tab === 'schedule'} onClick={() => setTab('schedule')} icon={<CalendarDays className="w-4 h-4" />} label={t('staffing.tab.shifts')} />
        <TabButton active={tab === 'recommendations'} onClick={() => setTab('recommendations')} icon={<Sparkles className="w-4 h-4" />} label={t('staffing.tab.recommendations')} />
      </div>

      <AnimatePresence mode="wait">
        {tab === 'staff' && (
          <motion.div key="staff" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {staffError && !staffLoading ? (
              <div className="surface-card rounded-2xl p-6 border border-danger-500/30 bg-danger-500/5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-danger-400 mt-0.5" strokeWidth={1.5} />
                  <div className="flex-1">
                    <p className="text-danger-300 font-medium">{staffError}</p>
                    <button
                      onClick={loadStaff}
                      className="mt-3 px-3 py-1.5 bg-danger-500/15 text-danger-200 border border-danger-500/30 rounded-lg text-sm font-medium hover:bg-danger-500/25 transition-colors"
                    >
                      {t('common.retry')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <StaffList
                staff={staff}
                loading={staffLoading}
                onEdit={(s) => { setEditing(s); setFormOpen(true); }}
                onDelete={handleDeleteStaff}
                onSendTest={handleSendTest}
              />
            )}
          </motion.div>
        )}

        {tab === 'schedule' && (
          <motion.div key="schedule" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <ShiftCalendar
              staff={staff}
              assignments={assignments}
              loading={assignmentsLoading}
              branchId={branchId}
              weekStart={weekStart}
              onWeekChange={setWeekStart}
              onCreate={handleCreateAssignment}
              onDelete={handleDeleteAssignment}
              onResendNotify={handleResendNotify}
            />
          </motion.div>
        )}

        {tab === 'recommendations' && (
          <motion.div key="recs" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-4">
            {recSummary?.message && (
              <div className="surface-card rounded-xl p-4 text-sm text-ink-2">{recSummary.message}</div>
            )}
            {recLoading ? (
              <div className="text-center py-10 text-ink-3">
                {t('common.loading')}
              </div>
            ) : recommendations.length === 0 ? (
              <div className="surface-card rounded-xl p-10 text-center">
                <Sparkles className="w-8 h-8 text-brand-300 mx-auto mb-3" />
                <p className="text-ink-2 font-medium">
                  {recMeta.reason === 'no_branch'
                    ? t('staffing.recs.empty.noBranch')
                    : recMeta.reason === 'no_cameras'
                      ? t('staffing.recs.empty.noCameras')
                      : t('staffing.recs.empty.notEnough')}
                </p>
                {typeof recMeta.daysCollected === 'number' && typeof recMeta.daysRemaining === 'number' && recMeta.daysRemaining > 0 && (
                  <div className="mt-4 max-w-sm mx-auto">
                    <div className="flex items-center justify-between text-xs text-ink-4 mb-1">
                      <span>{t('staffing.recs.daysCollected', { n: recMeta.daysCollected })}</span>
                      <span>{t('staffing.recs.daysLeft', { n: recMeta.daysRemaining })}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-brand-500 to-accent-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, ((recMeta.daysCollected ?? 0) / 3) * 100)}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-ink-4 mt-3">{t('staffing.recs.runHint')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recommendations.map((r) => (
                  <motion.div
                    key={r.hour}
                    layout
                    className={`surface-card rounded-xl p-4 border ${
                      r.status === 'optimal'
                        ? 'border-success-500/20'
                        : r.status === 'understaffed'
                          ? 'border-danger-500/30'
                          : 'border-warning-500/25'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-ink-4 font-mono">{t('staffing.recs.col.hour')}</div>
                        <div className="text-2xl font-bold text-ink-0">{String(r.hour).padStart(2, '0')}:00</div>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-ink-4">{t('staffing.recs.col.avgCustomers')}</div>
                        <div className="text-ink-1 font-semibold">{Math.round(r.avgCustomers)}</div>
                      </div>
                      <div>
                        <div className="text-ink-4">{t('staffing.recs.col.nowOptimal')}</div>
                        <div className="text-ink-1 font-semibold">{r.staffCount} / {r.optimal}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <StaffForm
        open={formOpen}
        initial={editing}
        branchId={branchId || null}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={handleSaveStaff}
      />
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
        active ? 'text-white' : 'text-ink-2 hover:text-ink-0'
      }`}
    >
      {active && (
        <motion.div
          layoutId="staffingTabBg"
          className="absolute inset-0 rounded-lg bg-gradient-to-r from-brand-500 to-accent-500 shadow-glow-brand"
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        />
      )}
      <span className="relative flex items-center gap-2">{icon}{label}</span>
    </motion.button>
  );
}

function StatusBadge({ status }: { status: 'optimal' | 'understaffed' | 'overstaffed' }) {
  const { t } = useLanguage();
  const map = {
    optimal: { bg: 'bg-success-500/15 text-success-300 border-success-500/30', labelKey: 'staffing.recs.statusBadge.optimal', icon: <Circle className="w-3 h-3" /> },
    understaffed: { bg: 'bg-danger-500/15 text-danger-300 border-danger-500/30', labelKey: 'staffing.recs.statusBadge.understaffed', icon: <TrendingDown className="w-3 h-3" /> },
    overstaffed: { bg: 'bg-warning-500/15 text-warning-300 border-warning-500/30', labelKey: 'staffing.recs.statusBadge.overstaffed', icon: <TrendingUp className="w-3 h-3" /> },
  } as const;
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${s.bg}`}>
      {s.icon} {t(s.labelKey)}
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent: 'brand' | 'violet' | 'accent' | 'success' }) {
  const styles = {
    brand: 'bg-brand-500/10 text-brand-300 border-brand-500/20',
    violet: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    accent: 'bg-accent-500/10 text-accent-300 border-accent-500/20',
    success: 'bg-success-500/10 text-success-300 border-success-500/20',
  } as const;
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${styles[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-4 font-medium">{label}</div>
          <div className="text-xl font-bold text-ink-0">{value}</div>
        </div>
      </div>
    </div>
  );
}
