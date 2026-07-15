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
            <ul className="results">
              {group.map((p) => (
                <li key={p.slug} className="result" onClick={() => onOpen(p.slug)}>
                  <span className="term">{p.title}</span>
                  <span className="gloss">{p.description}</span>
                  <span className="badges">
                    <span className="badge ref">参 {p.source === 'lessons' ? 'Custom' : 'Tofugu'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
