import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export type DataMode = 'demo' | 'live';

interface DataModeContextType {
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
  toggleDataMode: () => void;
  isModeLocked: boolean;
}

const DataModeContext = createContext<DataModeContextType | undefined>(undefined);

export function DataModeProvider({ children }: { children: ReactNode }) {
  const { isDemoUser } = useAuth();
  const [dataMode, setDataModeState] = useState<DataMode>(() => {
    const saved = localStorage.getItem('dataMode');
    return (saved === 'demo' || saved === 'live') ? saved : 'live';
  });

  // Force demo mode for demo users
  useEffect(() => {
    if (isDemoUser && dataMode !== 'demo') {
      setDataModeState('demo');
    }
  }, [isDemoUser, dataMode]);

  useEffect(() => {
    localStorage.setItem('dataMode', dataMode);
  }, [dataMode]);

  const setDataMode = (mode: DataMode) => {
    if (isDemoUser && mode === 'live') return; // Block live mode for demo users
    setDataModeState(mode);
  };

  const toggleDataMode = () => {
    if (isDemoUser) return; // Block toggle for demo users
    setDataModeState(prev => prev === 'demo' ? 'live' : 'demo');
  };

  return (
    <DataModeContext.Provider value={{ dataMode, setDataMode, toggleDataMode, isModeLocked: isDemoUser }}>
      {children}
    </DataModeContext.Provider>
  );
}

export function useDataMode() {
  const context = useContext(DataModeContext);
  if (!context) {
    throw new Error('useDataMode must be used within DataModeProvider');
  }
  return context;
}
