import { useEffect, useState } from 'react';
import { wordApi } from './api';
import type { Entry, SearchResultWord, WordResponse } from './types';
import { PatternBand } from './PatternDefs';

function EntryLine({ e }: { e: Entry }) {
  return (
    <div className="entry-line">
      <span className="entry-raw">{e.raw}</span>
      {e.children && e.children.length > 0 && (
        <ul className="entry-children">
          {e.children.map((c) => (
            <li key={c.id} className="entry-raw child">
              {c.raw}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function WordDetail({
  result,
  onBack,
}: {
  result: SearchResultWord;
  onBack: () => void;
}) {
  const [data, setData] = useState<WordResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!result.normTerm) return;
    wordApi(result.normTerm).then(setData, () => setError('Could not load word details.'));
  }, [result.normTerm]);

  const textbook = data?.occurrences.filter((o) => o.source_type !== 'lesson') ?? [];
  const lessons = data?.occurrences.filter((o) => o.source_type === 'lesson') ?? [];

  return (
    <article className="word-detail">
      <button className="back" onClick={onBack}>
        ← results
      </button>
      <h2 className="detail-term stamp">
        {result.term}
        {result.reading && result.reading !== result.term && (
          <span className="detail-reading">{result.reading}</span>
        )}
      </h2>
      <PatternBand className="detail-band" />
      {result.gloss && <p className="detail-gloss">{result.gloss}</p>}
      {error && <p className="error">{error}</p>}

      {textbook.length > 0 && (
        <section>
          <h2>Textbook</h2>
          <ul>
            {textbook.map((o) => (
              <li key={o.id} className="occurrence">
                <span className="badge tb">{o.source_ref}</span>
                {o.section && <span className="section">{o.section}</span>}
                <EntryLine e={o} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {lessons.length > 0 && (
        <section>
          <h2>Lessons ({lessons.length})</h2>
          <ul>
            {lessons.map((o) => (
              <li key={o.id} className="occurrence">
                <span className="badge date">{o.source_ref}</span>
                <EntryLine e={o} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && data.mentions.length > 0 && (
        <section>
          <h2>Mentions</h2>
          <ul>
            {data.mentions.map((m) => (
              <li key={m.id} className="occurrence mention">
                <span className="badge date">{m.source_ref}</span>
                <span className="entry-raw">{m.raw}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
