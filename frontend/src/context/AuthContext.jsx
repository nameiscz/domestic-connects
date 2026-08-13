import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axiosInstance from '../api/axiosInstance';

/**
 * AuthContext — session state for the whole app.
 *
 * currentUser: { id, name, email, role, token } persisted in localStorage
 * under the key `dc_user` (axiosInstance reads the token from the same key).
 *
 * Exposes:
 *   - login(email, password)   → calls POST /api/auth/login, persists the session
 *   - register(...)            → calls POST /api/auth/register and creates a
 *                                session immediately (no email verification)
 *   - logout()                 → clears the session
 *   - isAuthenticated          → convenience boolean
 */

const AuthContext = createContext(null);

const STORAGE_KEY = 'dc_user';

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Maps the backend AuthResponse (accessToken + user{...}) into the
// { id, name, role, token } shape the app (and axios) expects.
function toCurrentUser(data) {
  return {
    id: data?.user?.id,
    name: data?.user?.name,
    email: data?.user?.email,
    role: data?.user?.role,
    token: data?.accessToken,
  };
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(readStoredUser);

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

  const login = async (email, password) => {
    const { data } = await axiosInstance.post('/api/auth/login', { email, password });
    const user = toCurrentUser(data);
    setCurrentUser(user);
    return user;
  };

  const register = async ({ name, email, password, role }) => {
    const { data } = await axiosInstance.post('/api/auth/register', {
      name,
      email,
      password,
      role,
    });
    // Accounts can sign in right away (no email verification), so a session
    // is created immediately and the user lands on their dashboard.
    const user = toCurrentUser(data);
    setCurrentUser(user);
    return user;
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const value = useMemo(
    () => ({
      currentUser,
      isAuthenticated: Boolean(currentUser),
      login,
      register,
      logout,
    }),
    [currentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Co-locating the context and its hook is the canonical React pattern; the
// provider re-renders consumers so fast refresh is unaffected.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}
