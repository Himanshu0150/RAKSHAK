import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginApi, verifySessionApi, logoutApi } from '../services/apiService';

export interface User {
  investigator_id: string;
  email: string;
  full_name: string;
  badge_number: string;
  role: string;
  authorized_cases?: string[];
}

export function hasTabPermission(user: User | null, tab: string): boolean {
  if (!user) return true;
  const roleLower = (user.role || '').toLowerCase();
  
  if (roleLower.includes('lead')) {
    return true; // Tier 1: Full system access
  }
  
  if (roleLower.includes('specialist')) {
    // Tier 2: Analytical tools enabled, System Data Health restricted
    return tab !== 'data_health';
  }
  
  if (roleLower.includes('field') || roleLower.includes('agent')) {
    // Tier 3: Field Agent access restricted to field operational views
    const fieldAllowed = ['dashboard', 'investigate', 'cases', 'entities', 'timeline', 'telecom', 'evidence_vault', 'ai_copilot'];
    return fieldAllowed.includes(tab);
  }
  
  return true;
}

export function isCaseAuthorized(user: User | null, caseId: string | null): boolean {
  if (!user || !caseId) return true;
  const roleLower = (user.role || '').toLowerCase();
  if (roleLower.includes('lead') || roleLower.includes('admin')) return true;
  if (!user.authorized_cases || user.authorized_cases.length === 0 || user.authorized_cases.includes('*')) return true;
  return user.authorized_cases.includes(caseId);
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { investigatorId?: string; email?: string; password?: string; rememberDevice?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  hasTabPermission: (tab: string) => boolean;
  isCaseAuthorized: (caseId: string | null) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const TOKEN_KEY = 'sherlock_auth_token';
export const ACTIVE_CASE_KEY = 'sherlock_active_case_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session on mount
  useEffect(() => {
    async function initAuth() {
      const storedToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        const verifiedUser = await verifySessionApi(storedToken);
        if (verifiedUser) {
          setToken(storedToken);
          setUser(verifiedUser);
          // Keep token in localStorage for persistence
          localStorage.setItem(TOKEN_KEY, storedToken);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(ACTIVE_CASE_KEY);
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    }
    initAuth();
  }, []);

  // Multi-tab logout / login session synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        if (!e.newValue) {
          // Token removed in another tab (logout)
          setToken(null);
          setUser(null);
          localStorage.removeItem(ACTIVE_CASE_KEY);
        } else if (e.newValue !== token) {
          // Token changed in another tab (new login)
          verifySessionApi(e.newValue).then(verifiedUser => {
            if (verifiedUser) {
              setToken(e.newValue);
              setUser(verifiedUser);
            } else {
              setToken(null);
              setUser(null);
              localStorage.removeItem(ACTIVE_CASE_KEY);
            }
          });
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [token]);

  const login = async (credentials: { investigatorId?: string; email?: string; password?: string; rememberDevice?: boolean }) => {
    const data = await loginApi(credentials);
    const authToken = data.token;
    const authUser = data.user;

    setToken(authToken);
    setUser(authUser);

    // Save token in localStorage for cross-session and cross-tab persistence
    localStorage.setItem(TOKEN_KEY, authToken);
    sessionStorage.removeItem(TOKEN_KEY);
  };

  const logout = async () => {
    if (token) {
      await logoutApi(token);
    }
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACTIVE_CASE_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        hasTabPermission: (tab: string) => hasTabPermission(user, tab),
        isCaseAuthorized: (caseId: string | null) => isCaseAuthorized(user, caseId)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

