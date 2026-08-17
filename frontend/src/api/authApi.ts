import type { AxiosRequestConfig } from 'axios';
import axiosInstance from './axiosInstance';
import type {
  ApiResponse,
  AuthResponse,
  ForgotPasswordPayload,
  LoginPayload,
  PasswordResetResponse,
  RegisterPayload,
  ResetPasswordPayload,
} from '../types';

/** Auth-service endpoints, routed through the gateway at /api/auth/** */
export const authApi = {
  /** POST /api/auth/login */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await axiosInstance.post<AuthResponse>('/api/auth/login', payload);
    return data;
  },

  /** POST /api/auth/register — creates a session immediately (no email verification). */
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await axiosInstance.post<AuthResponse>('/api/auth/register', payload);
    return data;
  },

  /** POST /api/auth/refresh */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    const { data } = await axiosInstance.post<AuthResponse>('/api/auth/refresh', {
      refreshToken,
    });
    return data;
  },

  /** POST /api/auth/forgot-password — returns the one-time token + reset link. */
  async forgotPassword(payload: ForgotPasswordPayload): Promise<PasswordResetResponse> {
    const { data } = await axiosInstance.post<ApiResponse<PasswordResetResponse>>(
      '/api/auth/forgot-password',
      payload
    );
    return data.data;
  },

  /** POST /api/auth/reset-password */
  async resetPassword(payload: ResetPasswordPayload): Promise<void> {
    await axiosInstance.post<ApiResponse<null>>('/api/auth/reset-password', payload);
  },

  /** GET /api/auth/workers — active worker directory (employer/admin only). */
  async getWorkers(config?: AxiosRequestConfig): Promise<AuthResponse['user'][]> {
    const { data } = await axiosInstance.get<ApiResponse<AuthResponse['user'][]>>(
      '/api/auth/workers',
      config
    );
    return data.data;
  },
};
