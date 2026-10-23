import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { createRefreshCoordinator } from './refreshCoordinator';

export const TOKEN_KEY = 'dm_token';
export const REFRESH_TOKEN_KEY = 'dm_refresh_token';

const api = axios.create({
  baseURL: '/api',
});

export function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Помечаем запрос, уже прошедший через обновление токена, чтобы не зациклиться:
// если и повтор вернул 401, обновление не помогло и надо уходить на форму входа.
type RetriableRequest = InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean };

// Одновременных обменов быть не должно — почему именно, см. refreshCoordinator.ts.
const refreshCoordinator = createRefreshCoordinator<string>({
  performRefresh: async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) throw new Error('no refresh token');

    // Голый axios, а не api: интерцепторы этого клиента не должны применяться
    // к самому обмену, иначе 401 от /refresh снова ушёл бы в обновление.
    const response = await axios.post<{ accessToken: string; refreshToken: string }>(
      '/api/Auth/refresh',
      { refreshToken }
    );
    storeTokens(response.data.accessToken, response.data.refreshToken);
    return response.data.accessToken;
  },
});

function redirectToLogin() {
  clearTokens();
  // Уже на форме входа — повторный переход только сбросил бы введённое.
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetriableRequest | undefined;

    if (error.response?.status !== 401 || !request || request._retriedAfterRefresh) {
      if (error.response?.status === 401) redirectToLogin();
      return Promise.reject(error);
    }

    try {
      const accessToken = await refreshCoordinator.refresh();
      request._retriedAfterRefresh = true;
      request.headers.Authorization = `Bearer ${accessToken}`;
      return api(request);
    } catch {
      // Refresh-токен истёк, отозван или отсутствует — сессию не продлить.
      redirectToLogin();
      return Promise.reject(error);
    }
  }
);

export default api;
