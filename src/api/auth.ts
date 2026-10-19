import api, { REFRESH_TOKEN_KEY, clearTokens } from './client';

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

export const logout = async (): Promise<void> => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  try {
    // Токен передаётся явно, чтобы сервер его отозвал: до 2026-08-02 /Auth/logout
    // ничего не делал, и выданный refresh-токен оставался годным до истечения
    // срока, сколько бы раз пользователь ни «выходил».
    await api.post('/Auth/logout', { refreshToken: refreshToken ?? '' });
  } finally {
    clearTokens();
  }
};
