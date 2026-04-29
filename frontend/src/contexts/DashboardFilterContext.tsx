import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface Branch {
  id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isDefault: boolean;
  cameras?: { id: string; name: string; isActive: boolean }[];
}

// Yan #38: date range survives page navigation. Previously each dashboard
// page held its own `useState<Range>('1d')`, so jumping Analytics → Tables →
// back to Analytics dropped the user's choice. Persist into localStorage so
// it also survives reload.
//
// Yan #39: 'custom' joins the enum so the user can pick an arbitrary
// from/to window. Custom payload (from/to ISO) lives in a separate
// localStorage key and is only consulted when dateRange === 'custom'.
export type DashboardDateRange = '1d' | '1w' | '1m' | '3m' | 'custom';

export interface CustomDateRange {
  from: string; // ISO
  to: string; // ISO
}

const DATE_RANGE_KEY = 'dashboardDateRange';
const CUSTOM_RANGE_KEY = 'dashboardCustomRange';
const VALID_RANGES: ReadonlyArray<DashboardDateRange> = ['1d', '1w', '1m', '3m', 'custom'];

function readStoredRange(): DashboardDateRange {
  try {
    const stored = localStorage.getItem(DATE_RANGE_KEY);
    // Faz 11: 1h removed — quietly migrate any persisted '1h' choice to '1d'.
    if (stored === '1h') {
      try { localStorage.setItem(DATE_RANGE_KEY, '1d'); } catch { /* ignore */ }
      return '1d';
    }
    if (stored && (VALID_RANGES as readonly string[]).includes(stored)) {
      return stored as DashboardDateRange;
    }
  } catch { /* SSR / privacy mode */ }
  return '1d';
}

function readStoredCustom(): CustomDateRange | null {
  try {
    const raw = localStorage.getItem(CUSTOM_RANGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomDateRange;
    if (typeof parsed?.from !== 'string' || typeof parsed?.to !== 'string') return null;
    if (isNaN(new Date(parsed.from).getTime()) || isNaN(new Date(parsed.to).getTime())) return null;
    if (new Date(parsed.from).getTime() >= new Date(parsed.to).getTime()) return null;
    return parsed;
  } catch { return null; }
}

interface DashboardFilterContextType {
  branches: Branch[];
  selectedBranch: Branch | null;
  setSelectedBranch: (branch: Branch | null) => void;
  dateRange: DashboardDateRange;
  setDateRange: (range: DashboardDateRange) => void;
  customRange: CustomDateRange | null;
  setCustomRange: (range: CustomDateRange | null) => void;
  fetchBranches: () => Promise<void>;
  isLoading: boolean;
}

const DashboardFilterContext = createContext<DashboardFilterContextType | undefined>(undefined);

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const { user, isAuthReady } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranchState] = useState<Branch | null>(null);
  const [dateRange, setDateRangeState] = useState<DashboardDateRange>(readStoredRange);
  const [customRange, setCustomRangeState] = useState<CustomDateRange | null>(readStoredCustom);
  const [isLoading, setIsLoading] = useState(false);

  // Re-resolves branches from server. Picks the previously-saved branch when
  // it still exists, falling back to default → first → none. Always reads
  // from the fresh server response so a deleted branch can't linger as
  // selected, and so a newly-added branch shows up immediately.
  const fetchBranches = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/branches', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as Branch[];
        setBranches(data);
        const savedId = localStorage.getItem('selectedBranchId');
        const persisted = savedId ? data.find((b) => b.id === savedId) : null;
        const next = persisted || data.find((b) => b.isDefault) || data[0] || null;
        setSelectedBranchState(next);
        if (next) {
          localStorage.setItem('selectedBranchId', next.id);
        } else {
          localStorage.removeItem('selectedBranchId');
        }
      } else {
        // 401 or other failure — clear stale state so we don't leak a previous
        // user's branch into the UI.
        setBranches([]);
        setSelectedBranchState(null);
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refetch whenever auth flips. We can't trust a fetch that fires before
  // checkAuth() resolves — the cookie may exist but the user object hasn't
  // landed yet, and a logout/login swap on the same tab needs to drop the
  // previous account's branches before showing the new one.
  useEffect(() => {
    if (!isAuthReady) return;
    if (!user) {
      setBranches([]);
      setSelectedBranchState(null);
      return;
    }
    fetchBranches();
  }, [isAuthReady, user?.id, fetchBranches]);

  const setSelectedBranch = (branch: Branch | null) => {
    setSelectedBranchState(branch);
    if (branch) {
      localStorage.setItem('selectedBranchId', branch.id);
    } else {
      localStorage.removeItem('selectedBranchId');
    }
  };

  const setDateRange = (range: DashboardDateRange) => {
    setDateRangeState(range);
    try { localStorage.setItem(DATE_RANGE_KEY, range); } catch { /* ignore */ }
  };

  const setCustomRange = (range: CustomDateRange | null) => {
    setCustomRangeState(range);
    try {
      if (range) localStorage.setItem(CUSTOM_RANGE_KEY, JSON.stringify(range));
      else localStorage.removeItem(CUSTOM_RANGE_KEY);
    } catch { /* ignore */ }
  };

  return (
    <DashboardFilterContext.Provider
      value={{
        branches,
        selectedBranch,
        setSelectedBranch,
        dateRange,
        setDateRange,
        customRange,
        setCustomRange,
        fetchBranches,
        isLoading,
      }}
    >
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilter() {
  const context = useContext(DashboardFilterContext);
  if (!context) {
    throw new Error('useDashboardFilter must be used within DashboardFilterProvider');
  }
  return context;
}
