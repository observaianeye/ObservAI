import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type UserRole = 'ADMIN' | 'MANAGER' | 'ANALYST' | 'VIEWER';
type AccountType = 'TRIAL' | 'PAID';

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
  isTrialUser: boolean;
  isTrialExpired: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Per-browser caches that hold the previous account's camera selections, zone
// drawings, and streaming state. They live outside React state, so without
// explicit cleanup the next user that signs in on the same device sees the
// previous user's data. Keep this list in sync with any new client-side cache.
const ACCOUNT_SCOPED_LOCAL_KEYS = [
  'cameraZones',
  'zoneLabelingBackground',
  'lastCameraSource',
  'ipCameras',
  'iphoneRemoteUrl',
  'cameraStreamingActive',
];

function clearAccountScopedLocalState() {
  for (const key of ACCOUNT_SCOPED_LOCAL_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore quota / private mode */ }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const userData = await response.json();
        setUser((prev) => {
          // Browser session got swapped to a different account out-of-band
          // (e.g. session token rotated, prior account expired) — drop the
          // previous account's local caches before showing the new one.
          if (prev && prev.id !== userData.id) clearAccountScopedLocalState();
          return userData;
        });
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
        // Wipe any leftover camera/zone state from a prior account on this
        // browser before the new user's pages mount and read it.
        if (!user || user.id !== userData.id) clearAccountScopedLocalState();
        setUser(userData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

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
      // Camera selection, drawn zones, and streaming state are per-account —
      // wipe them so the next user on this browser starts clean.
      clearAccountScopedLocalState();
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
        isTrialUser,
        isTrialExpired,
        login,
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
