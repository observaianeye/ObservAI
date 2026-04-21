import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type UserRole = 'ADMIN' | 'MANAGER' | 'ANALYST' | 'VIEWER';
type AccountType = 'TRIAL' | 'PAID' | 'DEMO';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  accountType: AccountType;
  trialExpiresAt: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  isDemoUser: boolean;
  isTrialUser: boolean;
  isTrialExpired: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  demoLogin: () => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsAuthReady(true);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string, rememberMe?: boolean): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const demoLogin = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/demo-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Demo login failed:', error);
      return false;
    }
  };

  const isDemoUser = user?.accountType === 'DEMO';
  const isTrialUser = user?.accountType === 'TRIAL';
  const isTrialExpired = isTrialUser && user?.trialExpiresAt
    ? new Date(user.trialExpiresAt) < new Date()
    : false;

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
      // Clear remembered email on explicit logout (user manually logged out)
      // This ensures fresh login next time unless they check remember me again
      localStorage.removeItem('rememberedEmail');
      localStorage.removeItem('rememberMe');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAuthReady,
        isDemoUser,
        isTrialUser,
        isTrialExpired,
        login,
        demoLogin,
        logout,
        checkAuth
      }}
    >
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
