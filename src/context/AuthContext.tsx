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
    } catch {
      // Сервер недоступен или отозвать токен не удалось. Токены локально уже
      // стёрты (см. apiLogout), а пробросить ошибку некуда — вызывающий код
      // её не ждёт, и она ушла бы в консоль необработанным отказом.
    }
    // Оставаться на защищённой странице без токенов бессмысленно.
    setIsAuthenticated(false);
    redirectToLogin();
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
