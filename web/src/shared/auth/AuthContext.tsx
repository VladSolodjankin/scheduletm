import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { setUnauthorizedHandler } from '../api/client';
import type { WebUserRole } from '../types/roles';

type AuthUser = {
  id: string;
  email: string;
  role: WebUserRole;
  fullName?: string;
  avatarUrl?: string;
};

type AuthContextValue = {
  accessToken: string;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuthSession: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'scheduletm_access_token';
const USER_KEY = 'scheduletm_auth_user';

export function AuthProvider({ children }: PropsWithChildren) {
  const [accessToken, setAccessTokenState] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? '');
  const [user, setUserState] = useState<AuthUser | null>(() => {
    const storedUser = localStorage.getItem(USER_KEY);
    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser) as AuthUser;
    } catch {
      return null;
    }
  });

  const setAuthSession = (token: string, nextUser: AuthUser) => {
    setAccessTokenState(token);
    setUserState(nextUser);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  };

  const clearAuth = () => {
    setAccessTokenState('');
    setUserState(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuth();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  const value = useMemo(() => ({
    accessToken,
    user,
    isAuthenticated: Boolean(accessToken),
    setAuthSession,
    clearAuth
  }), [accessToken, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
