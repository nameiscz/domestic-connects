import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/**
 * Light/dark theme state for the app. The resolved theme is applied to
 * <html data-bs-theme="...">, which flips Bootstrap's official dark mode plus
 * the design-system tokens in index.css.
 *
 * - Defaults to the OS preference (prefers-color-scheme).
 * - A manual toggle persists the choice in localStorage under `dc_theme`
 *   (the same key the index.html pre-paint script reads).
 */
const STORAGE_KEY = 'dc_theme';

const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const readStoredTheme = (): Theme | null => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
};

const initialTheme = (): Theme =>
  readStoredTheme() || (systemPrefersDark() ? 'dark' : 'light');

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  // Keep <html data-bs-theme> in sync with the resolved theme.
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage unavailable (private mode) — the theme still switches.
      }
      return next;
    });
  }, []);

  return { theme, isDark: theme === 'dark', toggle };
}
