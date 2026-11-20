import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark';
type ThemePreference = Theme | 'system';

type ThemeContextType = {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'jcwms-theme';

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

// --- FOUC fix ---
// Apply the initial theme class synchronously at module evaluation time,
// before React mounts. Previously the `dark` class was only applied in a
// useEffect — which runs *after* first paint — so dark-mode users saw a
// white flash on every reload. Because `main.tsx` imports `App.tsx`,
// which imports `ThemeProvider` (and therefore this module), this side
// effect runs before `root.render(...)`.
if (typeof window !== 'undefined') {
  const initial = getInitialPreference();
  const resolved = initial === 'system' ? getSystemTheme() : initial;
  const root = document.documentElement;
  if (resolved === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getInitialPreference);
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);

  const theme: Theme = preference === 'system' ? systemTheme : preference;

  // Track OS theme changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else {
      // Safari < 14 fallback.
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    }
  }, []);

  // Keep the `dark` class in sync with the resolved theme.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  // Persist the *preference* (not the resolved theme).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, preference);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferenceState((prev) => {
      const currentTheme: Theme = prev === 'system' ? getSystemTheme() : prev;
      return currentTheme === 'dark' ? 'light' : 'dark';
    });
  }, []);

  // Memoize the context value: previously a new object was created on
  // every render, causing every consumer to re-render unnecessarily.
  const value = useMemo<ThemeContextType>(
    () => ({ theme, preference, setPreference, toggleTheme }),
    [theme, preference, setPreference, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}