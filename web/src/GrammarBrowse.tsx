import { useEffect, useMemo, useState } from 'react';
import { grammarPointsApi } from './api';
import type { GrammarPointSummary } from './types';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', null] as const;

export default function GrammarBrowse({ onOpen }: { onOpen: (slug: string) => void }) {
  const [points, setPoints] = useState<GrammarPointSummary[]>([]);
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
  const filtered = category ? points.filter((p) => p.categories.includes(category)) : points;

  if (error) return <p className="error">{error}</p>;

  return (
    <div className="grammar-browse">
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
      {LEVELS.map((level) => {
        const group = filtered.filter((p) => p.jlptLevel === level);
        if (group.length === 0) return null;
        return (
          <section key={level ?? 'other'} className="jlpt-group">
            <h2 className="jlpt-heading">{level ?? 'その他'}</h2>
            <ul className="entry-list">
              {group.map((p) => (
                <li key={p.slug}>
                  <button
                    type="button"
                    className={
                      p.source === 'lessons' ? 'entry-card entry-card--lessons' : 'entry-card'
                    }
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
                        <span className={`stamp-tag ${p.jlptLevel.toLowerCase()}`}>
                          {p.jlptLevel}
                        </span>
                      )}
                      {p.categories[0] && <span className="entry-cat">{p.categories[0]}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
