import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../api/authApi';
import type { AuthResponse, ChangePasswordPayload, RegisterPayload, SessionUser, UpdateProfilePayload } from '../types';

/**
 * AuthContext — session state for the whole app.
 *
 * currentUser: SessionUser ({ id, name, email, role, token }) persisted in
 * localStorage under the key `dc_user` (axiosInstance reads the token from
 * the same key).
 *
 * Exposes:
 *   - login(email, password)   → POST /api/auth/login, persists the session
 *   - register(payload)        → POST /api/auth/register and creates a
 *                                session immediately (no email verification)
 *   - logout()                 → clears the session
 *   - isAuthenticated          → convenience boolean
 *   - isLoading                → true while login/register is in flight
 */

export interface AuthContextType {
  currentUser: SessionUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (payload: RegisterPayload) => Promise<SessionUser>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<SessionUser>;
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'dc_user';

function readStoredUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    // Fail closed: a corrupt/foreign value must never masquerade as a session.
    if (
      !parsed ||
      typeof parsed.token !== 'string' ||
      typeof parsed.id !== 'number' ||
      typeof parsed.role !== 'string'
    ) {
      return null;
    }
    return parsed as SessionUser;
  } catch {
    return null;
  }
}

// Maps the backend AuthResponse (accessToken + user{...}) into the
// { id, name, email, role, token } shape the app (and axios) expects.
function toSessionUser(data: AuthResponse): SessionUser {
  return {
    id: data.user.id,
    name: data.user.name,
    email: data.user.email,
    role: data.user.role,
    active: data.user.active,
    token: data.accessToken,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(readStoredUser);
  const [isLoading, setIsLoading] = useState(false);

  // Keep localStorage in sync with state (single source of truth).
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures (private mode, quota, etc.).
    }
  }, [currentUser]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await authApi.login({ email, password });
      const user = toSessionUser(data);
      setCurrentUser(user);
      return user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const data = await authApi.register(payload);
      const user = toSessionUser(data);
      setCurrentUser(user);
      return user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  // Forgot-password flow: the backend emails the user a one-time reset link
  // (POST /api/auth/forgot-password) which points at the frontend
  // /reset-password?token=… page; the new password is submitted together with
  // that token (POST /api/auth/reset-password). Neither call creates a session.
  const forgotPassword = useCallback(async (email: string) => {
    await authApi.forgotPassword({ email });
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    await authApi.resetPassword({ token, newPassword });
  }, []);

  const updateProfile = useCallback(async (payload: UpdateProfilePayload) => {
    setIsLoading(true);
    try {
      const data = await authApi.updateProfile(payload);
      const user = toSessionUser(data);
      setCurrentUser(user);
      return user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    await authApi.changePassword(payload);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      currentUser,
      isAuthenticated: Boolean(currentUser),
      isLoading,
      login,
      register,
      logout,
      forgotPassword,
      resetPassword,
      updateProfile,
      changePassword,
    }),
    [currentUser, isLoading, login, register, logout, forgotPassword, resetPassword, updateProfile, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Co-locating the context and its hook is the canonical React pattern; the
// provider re-renders consumers so fast refresh is unaffected.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}
