import { useEffect, useRef } from 'react';
import {
  PALETTES,
  PATTERNS,
  getPalette,
  getPattern,
  getTheme,
  setPalette,
  setPattern,
  setTheme,
  useSettingValue,
} from './settings';

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const palette = useSettingValue(getPalette);
  const theme = useSettingValue(getTheme);
  const pattern = useSettingValue(getPattern);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element;
      if (t.closest('.settings-toggle')) return; // the ⚙ button toggles itself
      if (ref.current && !ref.current.contains(t)) onClose();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [onClose]);

  return (
    <div id="settings-panel" className="settings-panel" role="dialog" aria-label="Settings" tabIndex={-1} ref={ref}>
      <section>
        <h3>テーマ Theme</h3>
        <div className="chips">
          {PALETTES.map((p) => (
            <button
              type="button"
              key={p.id}
              className="chip"
              aria-pressed={palette === p.id}
              onClick={() => setPalette(p.id)}
            >
              <span className="dots">
                {p.dots.map((c, i) => (
                  <i key={i} style={{ background: c }} />
                ))}
              </span>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>外観 Appearance</h3>
        <div className="chips">
          <button type="button" className="chip" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
            ☀ Light
          </button>
          <button type="button" className="chip" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
            ☾ Dark
          </button>
        </div>
      </section>

      <section>
        <h3>文様 Pattern</h3>
        <div className="chips">
          {PATTERNS.map((p) => (
            <button
              type="button"
              key={p.id}
              className="chip"
              aria-pressed={pattern === p.id}
              onClick={() => setPattern(p.id)}
            >
              {p.id !== 'none' && (
                <svg className="chip-pattern" aria-hidden="true">
                  <rect width="100%" height="100%" fill={`url(#p-${p.id})`} />
                </svg>
              )}
              {p.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
