import { useEffect, useState } from 'react';
import { grammarPointApi } from './api';
import { parseFurigana } from './lib/furigana';
import type { GrammarContentBlock, GrammarDetailResponse, SearchResultWord } from './types';

function Furigana({ text }: { text: string }) {
  return (
    <>
      {parseFurigana(text).map((seg, i) =>
        seg.ruby ? (
          <ruby key={i}>
            {seg.base}
            <rt>{seg.ruby}</rt>
          </ruby>
        ) : (
          <span key={i}>{seg.base}</span>
        ),
      )}
    </>
  );
}

function Block({ b }: { b: GrammarContentBlock }) {
  if (b.type === 'heading') {
    if (b.text === 'Table of Contents') return null; // scraped artifact, meaningless here
    return b.level === 2 ? <h2>{b.text}</h2> : <h3>{b.text}</h3>;
  }
  if (b.type === 'paragraph')
    return (
      <p className="grammar-para">
        <Furigana text={b.text ?? ''} />
      </p>
    );
  if (b.type === 'formula') return <p className="grammar-formula">{b.text}</p>;
  return (
    <div className="grammar-example">
      <p className="example-ja">
        <Furigana text={b.japanese ?? ''} />
      </p>
      {b.english && <p className="example-en">{b.english}</p>}
    </div>
  );
}

export default function GrammarDetail({
  slug,
  onBack,
  onOpenWord,
}: {
  slug: string;
  onBack: () => void;
  onOpenWord: (word: SearchResultWord) => void;
}) {
  const [data, setData] = useState<GrammarDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    grammarPointApi(slug).then(setData, () => setError('Could not load this grammar point.'));
  }, [slug]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <article className="word-detail" />;

  return (
    <article className="word-detail grammar-detail">
      <button className="back" onClick={onBack}>
        ← results
      </button>
      <h2 className="detail-term stamp">
        {data.point.title}
        {data.point.jlptLevel && <span className="badge ref jlpt">{data.point.jlptLevel}</span>}
      </h2>
      <p className="detail-gloss">{data.point.description}</p>

      {data.lessonNotes.length > 0 && (
        <section>
          <h2>From your lessons</h2>
          <ul>
            {data.lessonNotes.map((n) => (
              <li key={n.normTerm} className="occurrence lesson-note-link">
                <button
                  type="button"
                  className="linkish"
                  onClick={() =>
                    onOpenWord({
                      normTerm: n.normTerm, term: n.term, reading: n.reading,
                      gloss: n.gloss, kind: n.kind, occurrenceCount: 0, lessonCount: 0,
                      sources: [], score: 0,
                    })
                  }
                >
                  {n.term}
                  {n.gloss ? ` — ${n.gloss}` : ''}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.content?.content.map((b, i) => <Block key={i} b={b} />)}
    </article>
  );
}
