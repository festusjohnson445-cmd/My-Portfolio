import { useEffect, useState } from 'react';
import type { StoredThemePreset } from './portfolioSupabase';

export type UserColorMode = 'light' | 'dark';

const STORAGE_KEY_USER_COLOR_MODE = 'fesline_user_color_mode';
const EVENT_USER_COLOR_MODE_CHANGED = 'fesline_user_color_mode_changed';

export function getUserColorMode(): UserColorMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const val = localStorage.getItem(STORAGE_KEY_USER_COLOR_MODE);
    return val === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyUserColorModeToDom(mode: UserColorMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('user-dark-mode', 'dark');
  } else {
    root.classList.remove('user-dark-mode', 'dark');
  }
}

export function setUserColorMode(mode: UserColorMode): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_USER_COLOR_MODE, mode);
    } catch {}
    applyUserColorModeToDom(mode);
    window.dispatchEvent(new CustomEvent(EVENT_USER_COLOR_MODE_CHANGED, { detail: mode }));
  }
}

export function useUserColorMode(): [UserColorMode, (next?: UserColorMode) => void] {
  const [mode, setMode] = useState<UserColorMode>(() => {
    const initial = getUserColorMode();
    applyUserColorModeToDom(initial);
    return initial;
  });

  useEffect(() => {
    applyUserColorModeToDom(mode);
  }, [mode]);

  useEffect(() => {
    const onChange = () => {
      const current = getUserColorMode();
      setMode(current);
      applyUserColorModeToDom(current);
    };
    window.addEventListener(EVENT_USER_COLOR_MODE_CHANGED, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT_USER_COLOR_MODE_CHANGED, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const toggle = (explicit?: UserColorMode) => {
    const next: UserColorMode = explicit || (mode === 'dark' ? 'light' : 'dark');
    setUserColorMode(next);
    setMode(next);
  };

  return [mode, toggle];
}

export function resolveEffectiveTheme(
  baseTheme: StoredThemePreset,
  userMode: UserColorMode
): StoredThemePreset {
  if (userMode === 'dark') {
    return {
      ...baseTheme,
      pageBg: '#0b111e',
      surfaceBg: '#162033',
      cardBg: '#1e293b',
      textColor: '#f1f5f9',
      mutedTextColor: '#94a3b8',
      borderColor: '#334155',
      footerBg: '#0f172a',
      navbarBg: 'rgba(15, 23, 42, 0.96)',
      isDark: true,
    };
  }
  return baseTheme;
}
