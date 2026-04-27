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

interface DashboardFilterContextType {
  branches: Branch[];
  selectedBranch: Branch | null;
  setSelectedBranch: (branch: Branch | null) => void;
  fetchBranches: () => Promise<void>;
  isLoading: boolean;
}

const DashboardFilterContext = createContext<DashboardFilterContextType | undefined>(undefined);

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const { user, isAuthReady } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranchState] = useState<Branch | null>(null);
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

  return (
    <DashboardFilterContext.Provider
      value={{
        branches,
        selectedBranch,
        setSelectedBranch,
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
