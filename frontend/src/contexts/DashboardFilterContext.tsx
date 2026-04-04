import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

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

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

interface DashboardFilterContextType {
  branches: Branch[];
  selectedBranch: Branch | null;
  setSelectedBranch: (branch: Branch | null) => void;
  fetchBranches: () => Promise<void>;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  isLoading: boolean;
}

const DashboardFilterContext = createContext<DashboardFilterContextType | undefined>(undefined);

const DEFAULT_DATE_RANGES: { label: string; days: number }[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function getDateRange(days: number): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const match = DEFAULT_DATE_RANGES.find(r => r.days === days);
  return { start, end, label: match?.label || `Last ${days} days` };
}

export { DEFAULT_DATE_RANGES };

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranchState] = useState<Branch | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange(7));
  const [isLoading, setIsLoading] = useState(false);

  const fetchBranches = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/branches');
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
        // Auto-select default branch or first branch
        if (data.length > 0 && !selectedBranch) {
          const defaultBranch = data.find((b: Branch) => b.isDefault) || data[0];
          setSelectedBranchState(defaultBranch);
        }
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchBranches();
  }, []);

  const setSelectedBranch = (branch: Branch | null) => {
    setSelectedBranchState(branch);
    if (branch) {
      localStorage.setItem('selectedBranchId', branch.id);
    }
  };

  return (
    <DashboardFilterContext.Provider
      value={{
        branches,
        selectedBranch,
        setSelectedBranch,
        fetchBranches,
        dateRange,
        setDateRange,
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
