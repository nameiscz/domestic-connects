import axios from 'axios';
import type { SessionUser } from '../types/user';

/**
 * Shared typed axios instance for all API calls.
 *
 * - baseURL comes from the VITE_API_BASE_URL env var (defaults to the local
 *   API Gateway so the app still works without a .env file).
 * - A request interceptor attaches `Authorization: Bearer <token>` read from
 *   the persisted session in localStorage (key `dc_user` — must match
 *   AuthContext's storage key).
 * - A response interceptor bounces to /login on 401 (expired/invalid token),
 *   unless the failing call was itself an auth request.
 */

const STORAGE_KEY = 'dc_user';

function getStoredSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    return parsed && typeof parsed.token === 'string' ? (parsed as SessionUser) : null;
  } catch {
    return null;
  }
}

const isAuthRequest = (url?: string): boolean =>
  typeof url === 'string' &&
  (url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh'));

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach the Bearer token when available
// ---------------------------------------------------------------------------
axiosInstance.interceptors.request.use((config) => {
  const session = getStoredSession();
  if (session) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — global 401 handling
// ---------------------------------------------------------------------------
axiosInstance.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const axiosError = error as {
      response?: { status?: number };
      config?: { url?: string };
    };

    if (axiosError?.response?.status === 401 && !isAuthRequest(axiosError.config?.url)) {
      // Clear stale session state, then hard-redirect (full reload) so the
      // router, context and axios token are all reset consistently.
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // localStorage unavailable (e.g. privacy mode) — ignore.
      }

      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
