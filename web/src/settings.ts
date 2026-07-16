import { useEffect, useState } from 'react';

// Keep the id lists in sync with the pre-paint whitelist in web/index.html.
export const PALETTES = [
  { id: 'ruri', label: '瑠璃と月', dots: ['#f1f4f9', '#3d5aa5', '#7a7128'] },
  { id: 'wakakusa', label: '若草', dots: ['#f4f6ec', '#47795b', '#80702a'] },
  { id: 'kikyo', label: '桔梗', dots: ['#f4f2f8', '#6257a8', '#776a26'] },
  { id: 'ponyo', label: 'ポニョ', dots: ['#faf1ea', '#ce3626', '#287a7c'] },
  { id: 'jisho', label: '辞書', dots: ['#ffffff', '#c73e3a', '#3d5a80'] },
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode etc. — the setting still applies for this session */
  }
}

function emit(): void {
  window.dispatchEvent(new Event('settingschange'));
}

const root = () => document.documentElement.dataset;

export function getPalette(): PaletteId {
  const v = root().palette;
  return PALETTES.some((p) => p.id === v) ? (v as PaletteId) : 'ruri';
}
export function setPalette(id: PaletteId): void {
  root().palette = id;
  save('palette', id);
  emit();
}

export function getTheme(): 'light' | 'dark' {
  return root().theme === 'dark' ? 'dark' : 'light';
}
export function setTheme(t: 'light' | 'dark'): void {
  if (t === 'dark') root().theme = 'dark';
  else delete root().theme;
  save('theme', t);
  emit();
}

/**
 * Subscribe a component to a settings getter; re-renders on every change.
 * Pass a module-level getter (e.g. getTheme), not an inline closure — inline
 * functions re-subscribe on every render.
 */
export function useSettingValue<T>(get: () => T): T {
  const [v, setV] = useState(get);
  useEffect(() => {
    const on = () => setV(get());
    window.addEventListener('settingschange', on);
    return () => window.removeEventListener('settingschange', on);
  }, [get]);
  return v;
}
