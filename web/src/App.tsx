import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { browseSentences, browseWords, searchApi } from './api';
import type { Entry, SearchResultWord } from './types';
import AppHeader from './AppHeader';
import GrammarBrowse from './GrammarBrowse';
import GrammarDetail from './GrammarDetail';
import SentenceTimeline from './SentenceTimeline';
import WordDetail from './WordDetail';

type OpenView =
  | { type: 'word'; word: SearchResultWord }
  | { type: 'grammar'; slug: string }
  | null;

const KINDS = [
  { key: 'all', label: 'All' },
  { key: 'vocab', label: 'Vocab' },
  { key: 'grammar', label: 'Grammar' },
  { key: 'sentence', label: 'Sentences' },
];

const WORD_SORTS = [
  { key: 'recent', label: 'Recent' },
  { key: 'reading', label: 'あいうえお' },
  { key: 'frequency', label: 'Most seen' },
  { key: 'chapter', label: 'Chapter' },
];

function sourceBadges(r: SearchResultWord): { text: string; tb: boolean }[] {
  if (r.kind === 'grammar-point') {
    return r.sources.map((s) => ({ text: `参 ${s.sourceRef}`, tb: true }));
  }
  const badges = r.sources
    .filter((s) => s.sourceType !== 'lesson')
    .map((s) => ({ text: s.sourceRef, tb: true }));
  if (r.lessonCount === 1) {
    const d = r.sources.find((s) => s.sourceType === 'lesson');
    if (d) badges.push({ text: d.sourceRef, tb: false });
  } else if (r.lessonCount > 1) {
    badges.push({ text: `×${r.lessonCount} lessons`, tb: false });
  }
  return badges;
}

function WordRows({
  rows,
  highlight,
  onHover,
  onOpen,
}: {
  rows: SearchResultWord[];
  highlight: number;
  onHover: (i: number | null) => void;
  onOpen: (r: SearchResultWord) => void;
}) {
  return (
    <>
      {rows.map((r, i) => (
        <li
          key={`${r.normTerm ?? r.term}-${i}`}
          className={i === highlight ? 'result selected' : 'result'}
          style={{ '--i': Math.min(i, 12) } as React.CSSProperties}
          onClick={() => onOpen(r)}
          onMouseEnter={() => onHover(i)}
        >
          <span className="term">{r.term}</span>
          {r.reading && r.reading !== r.term && <span className="reading">{r.reading}</span>}
          <span className="gloss">{r.gloss ?? ''}</span>
          <span className="badges">
            {sourceBadges(r).map((b) => (
              <span key={b.text} className={b.tb ? 'badge tb' : 'badge'}>
                {b.text}
              </span>
            ))}
          </span>
        </li>
      ))}
    </>
  );
}

function useWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

export default function App() {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [results, setResults] = useState<SearchResultWord[]>([]);
  const [sort, setSort] = useState('recent');
  const [words, setWords] = useState<SearchResultWord[]>([]);
  const [sentences, setSentences] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState<OpenView>(null);
  const [mode, setMode] = useState<'vocab' | 'grammar'>('vocab');
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const wide = useWide();
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const kindRef = useRef(kind);
  const sortRef = useRef(sort);
  const tabsRef = useRef<HTMLElement>(null);
  const indRef = useRef<HTMLElement>(null);
  const [wave, setWave] = useState(0);

  useLayoutEffect(() => {
    const move = () => {
      const btn = tabsRef.current?.querySelector<HTMLButtonElement>('.tab.active');
      if (btn && indRef.current) {
        indRef.current.style.left = `${btn.offsetLeft}px`;
        indRef.current.style.width = `${btn.offsetWidth}px`;
      }
    };
    move();
    // Re-measure once the bundled Noto Sans JP finishes loading (tab widths shift).
    document.fonts?.ready.then(move);
    window.addEventListener('resize', move);
    return () => window.removeEventListener('resize', move);
  }, [kind, mode]);

  const closeSettings = () => {
    setSettingsOpen(false);
    settingsBtnRef.current?.focus();
  };

  const openResult = (r: SearchResultWord) => {
    setHover(null);
    setView(
      r.kind === 'grammar-point' && r.slug
        ? { type: 'grammar', slug: r.slug }
        : { type: 'word', word: r },
    );
  };

  // Reads no state so it stays fresh inside the []-deps menu effect.
  const switchMode = (m: 'vocab' | 'grammar') => {
    setMode(m);
    setView(null);
    setHover(null);
    // Grammar mode has no kind tabs: pin search to grammar. Vocab returns to All.
    setKind(m === 'grammar' ? 'grammar' : 'all');
  };

  const searching = q.trim().length > 0;
  const browsing = !searching && mode === 'vocab' && kind !== 'all';
  // Chapter sort only exists for vocab; fall back when the Grammar tab is active.
  const effectiveSort = kind === 'grammar' && sort === 'chapter' ? 'recent' : sort;
  kindRef.current = kind;
  sortRef.current = effectiveSort;

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (!searching) {
        setResults([]);
        setError(null);
        return;
      }
      try {
        setResults(await searchApi(q, kind, ctrl.signal));
        setSel(0);
        setHover(null);
        setError(null);
        setWave((w) => w + 1);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Search failed — is the server running?');
        }
      }
    }, 100);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, kind, searching]);

  useEffect(() => {
    if (!browsing) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        if (kind === 'sentence') {
          const data = await browseSentences(0, ctrl.signal);
          setSentences(data.results);
          setTotal(data.total);
        } else {
          const data = await browseWords(kind, effectiveSort, 0, ctrl.signal);
          setWords(data.results);
          setTotal(data.total);
        }
        setWave((w) => w + 1);
        setPage(0);
        setSel(0);
        setHover(null);
        setError(null);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Couldn’t load the list — is the server running?');
        }
      }
    })();
    return () => ctrl.abort();
  }, [browsing, kind, effectiveSort]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const reqKind = kind;
    const reqSort = effectiveSort;
    const reqPage = page + 1;
    try {
      if (reqKind === 'sentence') {
        const data = await browseSentences(reqPage);
        if (kindRef.current !== reqKind) return;
        setSentences((s) => [...s, ...data.results]);
      } else {
        const data = await browseWords(reqKind, reqSort, reqPage);
        if (kindRef.current !== reqKind || sortRef.current !== reqSort) return;
        setWords((w) => [...w, ...data.results]);
      }
      setPage(reqPage);
      setError(null);
    } catch {
      setError('Couldn’t load more — is the server running?');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (settingsOpen) closeSettings();
        else if (view) setView(null);
        else {
          setQ('');
          inputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, settingsOpen]);

  // Native menu actions + duplicate keyboard shortcuts (so the browser dev
  // flow behaves the same as the packaged desktop shell).
  useEffect(() => {
    const act = (id: string) => {
      if (id === 'view:grammar') {
        switchMode('grammar'); // the Grammar menu item / ⌘3 opens grammar mode
      } else if (id.startsWith('view:')) {
        switchMode('vocab');
        setKind(id.slice(5));
      } else if (id === 'focus-search') {
        inputRef.current?.focus();
      } else if (id === 'toggle-settings') {
        setSettingsOpen((o) => !o);
      }
    };
    window.desktop?.onMenuAction(act);
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (!e.metaKey || e.ctrlKey || e.altKey) return;
      const views: Record<string, string> = { '1': 'all', '2': 'vocab', '3': 'grammar', '4': 'sentence' };
      if (views[e.key]) {
        e.preventDefault();
        act(`view:${views[e.key]}`);
      } else if (e.key === 'f') {
        e.preventDefault();
        act('focus-search');
      } else if (e.key === ',') {
        e.preventDefault();
        act('toggle-settings');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navRows = searching ? results : browsing && kind !== 'sentence' ? words : [];
  const highlight = hover ?? sel;

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const repoint = (idx: number) => {
      if (!(wide && view?.type === 'word')) return;
      const next = navRows[idx];
      if (next && next.kind !== 'grammar-point') setView({ type: 'word', word: next });
      else if (next?.kind === 'grammar-point' && next.slug) setView({ type: 'grammar', slug: next.slug });
    };
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = Math.min(highlight + 1, navRows.length - 1);
      setSel(nextIdx);
      setHover(null);
      repoint(nextIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIdx = Math.max(highlight - 1, 0);
      setSel(nextIdx);
      setHover(null);
      repoint(nextIdx);
    } else if (e.key === 'Enter' && navRows[highlight]) {
      openResult(navRows[highlight]);
    }
  };

  const loaded = kind === 'sentence' ? sentences.length : words.length;

  const listPane = searching ? (
    <ul className="results cascade" key={wave} onMouseLeave={() => setHover(null)}>
      <WordRows rows={results} highlight={highlight} onHover={setHover} onOpen={openResult} />
      {results.length === 0 && !error && <li className="empty">No matches for “{q}”</li>}
    </ul>
  ) : mode === 'grammar' ? (
    <GrammarBrowse onOpen={(slug) => setView({ type: 'grammar', slug })} />
  ) : browsing ? (
    <>
      {kind === 'sentence' ? (
        <SentenceTimeline entries={sentences} />
      ) : (
        <ul className="results cascade" key={wave} onMouseLeave={() => setHover(null)}>
          <WordRows rows={words} highlight={highlight} onHover={setHover} onOpen={openResult} />
        </ul>
      )}
      {loaded < total && (
        <button type="button" className="load-more" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : `Load more (${loaded} of ${total})`}
        </button>
      )}
    </>
  ) : (
    <ul className="results" />
  );

  const detailPane = view ? (
    view.type === 'word' ? (
      <WordDetail
        key={view.word.normTerm ?? view.word.term}
        result={view.word}
        onBack={() => setView(null)}
        onOpenGrammar={(slug) => setView({ type: 'grammar', slug })}
      />
    ) : (
      <GrammarDetail
        key={view.slug}
        slug={view.slug}
        onBack={() => setView(null)}
        onOpenWord={(word) => setView({ type: 'word', word })}
      />
    )
  ) : null;

  return (
    <div className={mode === 'grammar' ? 'app app--grammar' : 'app'}>
      <AppHeader
        mode={mode}
        onModeChange={switchMode}
        settingsOpen={settingsOpen}
        onSettingsToggle={() => setSettingsOpen((o) => !o)}
        onSettingsClose={closeSettings}
        settingsBtnRef={settingsBtnRef}
      />
      <header className="search-header">
        <div className="header-row">
          <svg
            className="search-glass"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.8-4.8" />
          </svg>
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={mode === 'grammar' ? 'Search grammar points…' : '上手・じょうず・skilled'}
            className="search-input"
            spellCheck={false}
          />
          {searching && (
            <button
              type="button"
              className="search-clear"
              aria-label="Clear search"
              onClick={() => {
                setQ('');
                inputRef.current?.focus();
              }}
            >
              ✕
            </button>
          )}
        </div>
        {mode === 'vocab' && (
          <nav className="filter-tabs" ref={tabsRef}>
            {KINDS.map((k) => (
              <button
                type="button"
                key={k.key}
                className={kind === k.key ? 'tab active' : 'tab'}
                aria-pressed={kind === k.key}
                onClick={() => {
                  setKind(k.key);
                  setView(null); // match the ⌘1-4 menu path: leaving a section closes its detail
                }}
              >
                {k.label}
              </button>
            ))}
            <i className="tab-indicator" ref={indRef} aria-hidden="true" />
          </nav>
        )}
        {browsing && kind !== 'sentence' && (
          <nav className="sort-tabs" aria-label="Sort order">
            {WORD_SORTS.filter((s) => !(kind === 'grammar' && s.key === 'chapter')).map((s) => (
              <button
                type="button"
                key={s.key}
                className={effectiveSort === s.key ? 'tab active' : 'tab'}
                aria-pressed={effectiveSort === s.key}
                onClick={() => setSort(s.key)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      {wide ? (
        <div className={detailPane ? 'split has-detail' : 'split'}>
          <div className="split-list">{listPane}</div>
          {detailPane && <div className="split-detail">{detailPane}</div>}
        </div>
      ) : detailPane ? (
        detailPane
      ) : (
        listPane
      )}
    </div>
  );
}
