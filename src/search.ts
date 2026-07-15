import type Database from 'better-sqlite3';
import { foldForSearch } from './lib/japanese.js';

export interface SearchResultWord {
  normTerm: string | null;
  term: string;
  reading: string | null;
  gloss: string | null;
  kind: string;
  occurrenceCount: number;
  lessonCount: number;
  sources: { sourceType: string; sourceRef: string }[];
  score: number;
  slug?: string;
}

interface Row {
  id: number;
  term: string | null;
  reading: string | null;
  gloss: string | null;
  raw: string;
  kind: string;
  source_type: string;
  source_ref: string;
  norm_term: string | null;
  term_f: string | null;
  reading_f: string | null;
  gloss_f: string | null;
  w_term: string | null;
  w_reading: string | null;
  w_gloss: string | null;
  occurrence_count: number | null;
  lesson_count: number | null;
  sources: string | null;
  last_seen: string | null;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

function glossWords(glossF: string | null): string[] {
  return glossF ? glossF.split(/[;,/()]|\s+/).filter(Boolean) : [];
}

function scoreRow(r: Row, qJa: string, qEn: string, now: Date): number {
  let s: number;
  if (r.term_f === qJa || r.reading_f === qJa) s = 1000;
  else if (r.gloss_f === qEn) s = 900;
  else if (r.term_f?.startsWith(qJa) || r.reading_f?.startsWith(qJa)) s = 600;
  else if (glossWords(r.gloss_f).some((w) => w.startsWith(qEn))) s = 500;
  else if (r.term_f?.includes(qJa) || r.reading_f?.includes(qJa)) s = 300;
  else if (r.gloss_f?.includes(qEn)) s = 200;
  else s = 100; // matched only in raw text

  s += Math.min(r.occurrence_count ?? 1, 10);
  if (r.last_seen && now.getTime() - Date.parse(r.last_seen) < 90 * 86400e3) s += 5;
  return s;
}

interface GrammarPointRow {
  slug: string; title: string; description: string;
  source: string; title_f: string; desc_f: string;
}

function scoreGrammarPoint(r: GrammarPointRow, qJa: string, qEn: string): number {
  if (r.title_f === qJa) return 1000;
  if (r.title_f.startsWith(qJa) || r.title_f.startsWith('〜' + qJa)) return 600;
  if (r.slug === qEn) return 600;
  if (r.slug.includes(qEn)) return 450;
  if (r.title_f.includes(qJa)) return 400;
  return 200; // matched in description
}

function searchGrammarPoints(
  db: Database.Database,
  qJa: string,
  qEn: string,
): SearchResultWord[] {
  const likeJa = `%${escapeLike(qJa)}%`;
  const likeEn = `%${escapeLike(qEn)}%`;
  const rows = db
    .prepare(
      `SELECT slug, title, description, source, title_f, desc_f FROM grammar_points
       WHERE title_f LIKE @ja ESCAPE '\\'
          OR slug LIKE @en ESCAPE '\\'
          OR desc_f LIKE @en ESCAPE '\\'`,
    )
    .all({ ja: likeJa, en: likeEn }) as GrammarPointRow[];
  return rows.map((r) => ({
    normTerm: null,
    term: r.title,
    reading: null,
    gloss: r.description,
    kind: 'grammar-point',
    occurrenceCount: 0,
    lessonCount: 0,
    sources: [
      { sourceType: 'reference', sourceRef: r.source === 'lessons' ? 'Custom' : 'Tofugu' },
    ],
    score: scoreGrammarPoint(r, qJa, qEn),
    slug: r.slug,
  }));
}

export function search(
  db: Database.Database,
  q: string,
  kind = 'all',
  now = new Date(),
): SearchResultWord[] {
  const qJa = foldForSearch(q);
  const qEn = q.normalize('NFKC').toLowerCase().trim();
  if (!qJa) return [];

  const likeJa = `%${escapeLike(qJa)}%`;
  const likeEn = `%${escapeLike(qEn)}%`;
  const rows = db
    .prepare(
      `SELECT e.id, e.term, e.reading, e.gloss, e.raw, e.kind, e.source_type, e.source_ref,
              e.norm_term, e.term_f, e.reading_f, e.gloss_f,
              w.term AS w_term, w.reading AS w_reading, w.gloss AS w_gloss,
              w.occurrence_count, w.lesson_count, w.sources, w.last_seen
       FROM entries e
       LEFT JOIN words w ON w.norm_term = e.norm_term
       WHERE (@kind = 'all' OR e.kind = @kind)
         AND (e.term_f LIKE @ja ESCAPE '\\'
           OR e.reading_f LIKE @ja ESCAPE '\\'
           OR e.gloss_f LIKE @en ESCAPE '\\'
           OR e.raw_f LIKE @ja ESCAPE '\\')`,
    )
    .all({ kind, ja: likeJa, en: likeEn }) as Row[];

  const best = new Map<string, { row: Row; score: number }>();
  for (const r of rows) {
    const key = r.norm_term ?? `#${r.id}`;
    const score = scoreRow(r, qJa, qEn, now);
    const cur = best.get(key);
    if (!cur || score > cur.score) best.set(key, { row: r, score });
  }

  const wordResults = [...best.values()].map(({ row, score }) => ({
    normTerm: row.norm_term,
    term: row.w_term ?? row.term ?? row.raw,
    reading: row.w_reading ?? row.reading,
    gloss: row.w_gloss ?? row.gloss,
    kind: row.kind,
    occurrenceCount: row.occurrence_count ?? 1,
    lessonCount: row.lesson_count ?? (row.source_type === 'lesson' ? 1 : 0),
    sources: row.sources
      ? (JSON.parse(row.sources) as { sourceType: string; sourceRef: string }[])
      : [{ sourceType: row.source_type, sourceRef: row.source_ref }],
    score,
  }));

  const grammarResults =
    kind === 'all' || kind === 'grammar' ? searchGrammarPoints(db, qJa, qEn) : [];

  return [...wordResults, ...grammarResults]
    .sort((a, b) => b.score - a.score || b.lessonCount - a.lessonCount)
    .slice(0, 50);
}
