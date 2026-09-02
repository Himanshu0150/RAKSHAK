import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginApi, verifySessionApi, logoutApi } from '../services/apiService';

export interface User {
  investigator_id: string;
  email: string;
  full_name: string;
  badge_number: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { investigatorId?: string; email?: string; password?: string; rememberDevice?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'sherlock_auth_token';

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
        } else {
          localStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem(TOKEN_KEY);
        }
      }
      setIsLoading(false);
    }
    initAuth();
  }, []);

  const login = async (credentials: { investigatorId?: string; email?: string; password?: string; rememberDevice?: boolean }) => {
    const data = await loginApi(credentials);
    const authToken = data.token;
    const authUser = data.user;

    setToken(authToken);
    setUser(authUser);

    if (credentials.rememberDevice) {
      localStorage.setItem(TOKEN_KEY, authToken);
    } else {
      sessionStorage.setItem(TOKEN_KEY, authToken);
    }
  };

  const logout = async () => {
    if (token) {
      await logoutApi(token);
    }
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
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
        logout
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
