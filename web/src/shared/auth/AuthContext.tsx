import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

type AuthContextValue = {
  accessToken: string;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'scheduletm_access_token';

export function AuthProvider({ children }: PropsWithChildren) {
  const [accessToken, setAccessTokenState] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? '');

  const setAccessToken = (token: string) => {
    setAccessTokenState(token);
    localStorage.setItem(TOKEN_KEY, token);
  };

  const clearAuth = () => {
    setAccessTokenState('');
    localStorage.removeItem(TOKEN_KEY);
  };

  const value = useMemo(() => ({ accessToken, setAccessToken, clearAuth }), [accessToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
