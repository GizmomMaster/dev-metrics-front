import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { createRefreshCoordinator } from './refreshCoordinator';

export const TOKEN_KEY = 'dm_token';
export const REFRESH_TOKEN_KEY = 'dm_refresh_token';

// Имя Web Lock, общего для всех вкладок одного origin.
const REFRESH_LOCK_NAME = 'dm-token-refresh';

// Маршрут формы входа в терминах HashRouter (см. App.tsx).
const LOGIN_HASH = '#/login';

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

/**
 * Выполняет fn под блокировкой, общей для всех вкладок.
 *
 * refreshCoordinator исключает параллельные обмены только внутри одной вкладки,
 * а localStorage с токенами у вкладок общий: две вкладки, одновременно получившие
 * 401, предъявили бы один и тот же одноразовый refresh-токен — и сервер оборвал
 * бы все сессии (см. refreshCoordinator.ts). Web Locks есть только в secure
 * context (HTTPS или localhost); без него остаётся защита в пределах вкладки.
 */
function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) return fn();
  return navigator.locks.request(REFRESH_LOCK_NAME, fn);
}

// Одновременных обменов быть не должно — почему именно, см. refreshCoordinator.ts.
const refreshCoordinator = createRefreshCoordinator<string>({
  performRefresh: () => {
    const accessTokenBefore = localStorage.getItem(TOKEN_KEY);

    return withCrossTabLock(async () => {
      // Пока ждали блокировку, обмен могла выполнить другая вкладка — тогда
      // в хранилище уже свежая пара, а наш refresh-токен отозван. Второй обмен
      // с ним сервер счёл бы повторным использованием.
      const accessTokenNow = localStorage.getItem(TOKEN_KEY);
      if (accessTokenNow && accessTokenNow !== accessTokenBefore) return accessTokenNow;

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
    });
  },
});

/** Обновляет access-токен с соблюдением всех гарантий координатора. */
export const refreshAccessToken = () => refreshCoordinator.refresh();

/**
 * Сбрасывает сессию и открывает форму входа.
 *
 * Роутер — HashRouter, поэтому форма входа живёт в hash, а не в pathname.
 * Перезагрузка нужна, чтобы вместе с токенами ушли и состояние AuthContext,
 * и кэш react-query с данными прежней сессии.
 */
export function redirectToLogin() {
  clearTokens();
  // Уже на форме входа — повторный переход только сбросил бы введённое.
  if (window.location.hash === LOGIN_HASH) return;
  window.location.hash = LOGIN_HASH;
  window.location.reload();
}

// 401 от /Auth/* — это ответ про сами учётные данные (например, неверный пароль),
// а не истёкший access-токен: обновлять токен и уводить на форму входа нельзя,
// иначе страница входа перезагрузится и потеряет сообщение об ошибке.
function isAuthEndpoint(request: InternalAxiosRequestConfig): boolean {
  return request.url?.startsWith('/Auth/') ?? false;
}

function bearerToken(request: InternalAxiosRequestConfig): string | null {
  const header = request.headers.Authorization;
  return typeof header === 'string' && header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetriableRequest | undefined;

    if (request && isAuthEndpoint(request)) return Promise.reject(error);

    if (error.response?.status !== 401 || !request || request._retriedAfterRefresh) {
      if (error.response?.status === 401) redirectToLogin();
      return Promise.reject(error);
    }

    try {
      // Запрос мог уйти со старым токеном, а ответ прийти, когда обмен уже
      // выполнен (этой или другой вкладкой) — тогда достаточно повторить его
      // со свежим токеном, не тратя ещё один одноразовый refresh-токен.
      const currentToken = localStorage.getItem(TOKEN_KEY);
      const accessToken =
        currentToken && currentToken !== bearerToken(request) ? currentToken : await refreshCoordinator.refresh();
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
