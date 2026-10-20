import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { login as apiLogin, LoginRequest, logout as apiLogout } from '../api/auth';
import { TOKEN_KEY, redirectToLogin, storeTokens } from '../api/client';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem(TOKEN_KEY));

  const login = useCallback(async (data: LoginRequest) => {
    const response = await apiLogin(data);
    storeTokens(response.accessToken, response.refreshToken);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      // Токены локально стёрты в любом случае — даже если сервер недоступен,
      // оставаться на защищённой странице бессмысленно.
      setIsAuthenticated(false);
      redirectToLogin();
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
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
