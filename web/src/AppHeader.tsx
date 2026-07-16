import { useEffect, useState } from 'react';
import SettingsPanel from './SettingsPanel';
import ThemeToggle from './ThemeToggle';

interface Status {
  entryCount: number;
  wordCount: number;
}

export default function AppHeader({
  mode,
  onModeChange,
  settingsOpen,
  onSettingsToggle,
  onSettingsClose,
  settingsBtnRef,
}: {
  mode: 'vocab' | 'grammar';
  onModeChange: (m: 'vocab' | 'grammar') => void;
  settingsOpen: boolean;
  onSettingsToggle: () => void;
  onSettingsClose: () => void;
  settingsBtnRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/status', { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Status>) : null))
      .then((s) => s && setStatus(s))
      .catch(() => {
        /* subtitle simply stays absent */
      });
    return () => ctrl.abort();
  }, []);

  return (
    <header className="app-header">
      <nav className="mode-switch" aria-label="App section">
        <button
          type="button"
          className={mode === 'vocab' ? 'mode-btn active' : 'mode-btn'}
          aria-pressed={mode === 'vocab'}
          onClick={() => onModeChange('vocab')}
        >
          語彙
        </button>
        <span className="mode-divider" aria-hidden="true">
          ・
        </span>
        <button
          type="button"
          className={mode === 'grammar' ? 'mode-btn active' : 'mode-btn'}
          aria-pressed={mode === 'grammar'}
          onClick={() => onModeChange('grammar')}
        >
          文法
        </button>
      </nav>
      {status && (
        <p className="app-subtitle">
          {status.wordCount.toLocaleString('en-US')} words ·{' '}
          {status.entryCount.toLocaleString('en-US')} entries
        </p>
      )}
      <div className="header-buttons">
        <button
          ref={settingsBtnRef}
          type="button"
          className="icon-btn settings-toggle"
          aria-label="Settings"
          aria-expanded={settingsOpen}
          aria-controls="settings-panel"
          title="Settings"
          onClick={onSettingsToggle}
        >
          <span className="glyph">⚙</span>
        </button>
        <ThemeToggle />
      </div>
      {settingsOpen && <SettingsPanel onClose={onSettingsClose} />}
    </header>
  );
}
