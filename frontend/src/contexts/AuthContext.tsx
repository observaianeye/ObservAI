import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type UserRole = 'manager' | 'employee';

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthReady: boolean;
  userRole: UserRole;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  useDemoAccount: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_MANAGER_EMAIL = 'admin@observai.com';
const DEMO_MANAGER_PASSWORD = 'demo1234';
const DEMO_EMPLOYEE_EMAIL = 'employee@observai.com';
const DEMO_EMPLOYEE_PASSWORD = 'employee123';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isDemoAuthed') === 'true';
  });

  const [userRole, setUserRole] = useState<UserRole>(() => {
    return (localStorage.getItem('userRole') as UserRole) || 'manager';
  });

  // Mark auth as ready after initial mount
  useEffect(() => {
    setIsAuthReady(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('isDemoAuthed', isAuthenticated.toString());
    localStorage.setItem('userRole', userRole);
  }, [isAuthenticated, userRole]);

  const login = (email: string, password: string): boolean => {
    if (email === DEMO_MANAGER_EMAIL && password === DEMO_MANAGER_PASSWORD) {
      setIsAuthenticated(true);
      setUserRole('manager');
      // Immediately persist to localStorage
      localStorage.setItem('isDemoAuthed', 'true');
      localStorage.setItem('userRole', 'manager');
      return true;
    }
    if (email === DEMO_EMPLOYEE_EMAIL && password === DEMO_EMPLOYEE_PASSWORD) {
      setIsAuthenticated(true);
      setUserRole('employee');
      // Immediately persist to localStorage
      localStorage.setItem('isDemoAuthed', 'true');
      localStorage.setItem('userRole', 'employee');
      return true;
    }
    return false;
  };

  const useDemoAccount = (): boolean => {
    setIsAuthenticated(true);
    setUserRole('manager');
    // Immediately persist to localStorage
    localStorage.setItem('isDemoAuthed', 'true');
    localStorage.setItem('userRole', 'manager');
    return true;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserRole('manager');
    localStorage.removeItem('isDemoAuthed');
    localStorage.removeItem('userRole');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAuthReady, userRole, login, logout, useDemoAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
