import type { User } from './user';

/**
 * Auth API types — mirrors auth-service `AuthResponse`, `LoginRequest`,
 * `RegisterRequest` and the password-reset DTOs.
 */

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: User['role'];
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export interface UpdateProfilePayload {
  name: string;
  email: string;
  phone?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/** Response body of POST /api/auth/forgot-password (one-time token + link). */
export interface PasswordResetResponse {
  token: string;
  resetUrl: string;
  expiresAt: string;
}
