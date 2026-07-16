import { useEffect, useMemo, useState } from 'react';
import { grammarPointsApi } from './api';
import type { GrammarPointSummary } from './types';

const LEVEL_TABS = [
  { key: 'all', label: 'All levels' },
  { key: 'N5', label: 'N5' },
  { key: 'N4', label: 'N4' },
  { key: 'N3', label: 'N3' },
  { key: 'N2', label: 'N2' },
  { key: 'lessons', label: 'Lessons' },
] as const;
type LevelKey = (typeof LEVEL_TABS)[number]['key'];

export default function GrammarBrowse({ onOpen }: { onOpen: (slug: string) => void }) {
  const [points, setPoints] = useState<GrammarPointSummary[]>([]);
  const [level, setLevel] = useState<LevelKey>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    grammarPointsApi(ctrl.signal).then(setPoints, (err) => {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError('Couldn’t load grammar points — is the server running?');
      }
    });
    return () => ctrl.abort();
  }, []);

  const categories = useMemo(
    () => [...new Set(points.flatMap((p) => p.categories))].sort(),
    [points],
  );

  const filtered = points
    .filter((p) =>
      level === 'all' ? true : level === 'lessons' ? p.source === 'lessons' : p.jlptLevel === level,
    )
    .filter((p) => (category ? p.categories.includes(category) : true));

  if (error) return <p className="error">{error}</p>;

  return (
    <div className="grammar-browse">
      <p className="filter-label">JLPT level</p>
      <nav className="sort-tabs" aria-label="JLPT level">
        {LEVEL_TABS.map((l) => (
          <button
            type="button"
            key={l.key}
            className={level === l.key ? 'tab active' : 'tab'}
            aria-pressed={level === l.key}
            onClick={() => setLevel(l.key)}
          >
            {l.label}
          </button>
        ))}
      </nav>
      <p className="filter-label">Categories</p>
      <nav className="sort-tabs category-chips" aria-label="Category filter">
        <button
          type="button"
          className={category === null ? 'tab active' : 'tab'}
          onClick={() => setCategory(null)}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            type="button"
            key={c}
            className={category === c ? 'tab active' : 'tab'}
            onClick={() => setCategory(category === c ? null : c)}
          >
            {c}
          </button>
        ))}
      </nav>
      <ul className="entry-list">
        {filtered.map((p) => (
          <li key={p.slug}>
            <button
              type="button"
              className={p.source === 'lessons' ? 'entry-card entry-card--lessons' : 'entry-card'}
              onClick={() => onOpen(p.slug)}
            >
              {p.source === 'lessons' && (
                <span className="entry-marker" aria-label="Custom lesson point">
                  レッスン
                </span>
              )}
              <span className="entry-headword">{p.title}</span>
              <span className="entry-gloss">{p.description}</span>
              <span className="entry-tags">
                {p.jlptLevel && (
                  <span className={`stamp-tag ${p.jlptLevel.toLowerCase()}`}>{p.jlptLevel}</span>
                )}
                {p.categories[0] && <span className="entry-cat">{p.categories[0]}</span>}
              </span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="empty">No grammar points match these filters</li>}
      </ul>
    </div>
  );
}
