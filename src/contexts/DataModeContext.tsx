import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type DataMode = 'demo' | 'live';

interface DataModeContextType {
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
  toggleDataMode: () => void;
}

const DataModeContext = createContext<DataModeContextType | undefined>(undefined);

export function DataModeProvider({ children }: { children: ReactNode }) {
  const [dataMode, setDataModeState] = useState<DataMode>('demo');

  useEffect(() => {
    localStorage.setItem('dataMode', dataMode);
  }, [dataMode]);

  const setDataMode = (mode: DataMode) => {
    setDataModeState(mode);
  };

  const toggleDataMode = () => {
    setDataModeState(prev => prev === 'demo' ? 'live' : 'demo');
  };

  return (
    <DataModeContext.Provider value={{ dataMode, setDataMode, toggleDataMode }}>
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
