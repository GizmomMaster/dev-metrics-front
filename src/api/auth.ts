import axios from 'axios';
import api, { REFRESH_TOKEN_KEY, TOKEN_KEY, clearTokens, refreshAccessToken } from './client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/Auth/login', data);
  return response.data;
};

// Голый axios, а не api: интерцептор api при 401 обменял бы refresh-токен и
// повторил запрос с тем же телом — то есть с уже отозванным токеном. Сервер
// счёл бы это повторным использованием, а выданный взамен токен остался бы
// неотозванным.
const postLogout = (accessToken: string | null, refreshToken: string) =>
  axios.post(
    '/api/Auth/logout',
    { refreshToken },
    { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined }
  );

export const logout = async (): Promise<void> => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  try {
    // Токен передаётся явно, чтобы сервер его отозвал: до 2026-08-02 /Auth/logout
    // ничего не делал, и выданный refresh-токен оставался годным до истечения
    // срока, сколько бы раз пользователь ни «выходил».
    if (!refreshToken) return;
    try {
      await postLogout(localStorage.getItem(TOKEN_KEY), refreshToken);
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
      // Access-токен истёк — обновляем пару и отзываем уже новый refresh-токен:
      // старый обмен только что погасил.
      const accessToken = await refreshAccessToken();
      await postLogout(accessToken, localStorage.getItem(REFRESH_TOKEN_KEY) ?? '');
    }
  } finally {
    clearTokens();
  }
};
