'use client';

import { useEffect } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export const THEME_KEY = 'theme_mode';
export const THEME_EVENT = 'app-theme-changed';

export function readThemeMode(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch { return 'system'; }
}

export function applyTheme(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d1117' : '#f6f8fa');
}

export function setThemeMode(mode: ThemeMode) {
  try { localStorage.setItem(THEME_KEY, mode); } catch {}
  applyTheme(mode);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function ThemeController() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyTheme(readThemeMode());
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('storage', sync);
    window.addEventListener(THEME_EVENT, sync);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('storage', sync); window.removeEventListener(THEME_EVENT, sync); };
  }, []);
  return null;
}
