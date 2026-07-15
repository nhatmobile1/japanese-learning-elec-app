import { useEffect, useRef, useState } from 'react';
import { getTheme, setTheme, useSettingValue } from './settings';

export default function ThemeToggle() {
  const theme = useSettingValue(getTheme);
  const prevTheme = useRef(theme);
  const [petalKey, setPetalKey] = useState(0);

  // One petal on any light→dark transition, whichever control caused it.
  useEffect(() => {
    if (
      prevTheme.current !== 'dark' &&
      theme === 'dark' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setPetalKey((k) => k + 1);
    }
    prevTheme.current = theme;
  }, [theme]);

  return (
    <button
      type="button"
      className="icon-btn moon-btn"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      <span className="glyph">{theme === 'dark' ? '☀' : '☾'}</span>
      <span className="star" aria-hidden="true">
        ✦
      </span>
      {petalKey > 0 && (
        <i
          key={petalKey}
          className="petal"
          aria-hidden="true"
          onAnimationEnd={() => setPetalKey(0)}
        />
      )}
    </button>
  );
}
