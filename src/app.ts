import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { search } from './search.js';
import { loadGrammarContent, SLUG_RE } from './grammar/load.js';
import { titleMatchesTerm } from './grammar/match.js';

export interface AppOptions {
  grammarDataPath?: string | null;
}

const ENTRY_COLUMNS =
  'id, term, reading, gloss, raw, kind, source_type, source_ref, section, file, line, parent_id, norm_term';

const PAGE_SIZE = 100;

const JLPT_ORDER: Record<string, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };

// NULLS-LAST orderings; norm_term as the final tiebreaker keeps paging stable.
const WORD_SORTS: Record<string, string> = {
  recent: 'last_seen IS NULL, last_seen DESC, occurrence_count DESC, norm_term',
  reading: 'reading_sort IS NULL, reading_sort, norm_term',
  frequency: 'lesson_count DESC, occurrence_count DESC, norm_term',
  chapter: 'chapter_sort IS NULL, chapter_sort, reading_sort IS NULL, reading_sort, norm_term',
};

interface WordRow {
  norm_term: string;
  term: string;
  reading: string | null;
  gloss: string | null;
  kind: string;
  occurrence_count: number;
  lesson_count: number;
  sources: string;
}

interface GrammarRow {
  slug: string;
  title: string;
  description: string;
  categories: string;
  source: string;
  jlpt_level: string | null;
}

function wordToResult(w: WordRow) {
  return {
    normTerm: w.norm_term,
    term: w.term,
    reading: w.reading,
    gloss: w.gloss,
    kind: w.kind,
    occurrenceCount: w.occurrence_count,
    lessonCount: w.lesson_count,
    sources: JSON.parse(w.sources) as { sourceType: string; sourceRef: string }[],
    score: 0,
  };
}

function grammarRowToResult(r: GrammarRow) {
  return {
    slug: r.slug,
    title: r.title,
    description: r.description,
    categories: JSON.parse(r.categories) as string[],
    source: r.source,
    jlptLevel: r.jlpt_level,
  };
}

export function createApp(db: Database.Database, opts: AppOptions = {}): Hono {
  const app = new Hono();

  app.get('/api/search', (c) => {
    const q = c.req.query('q')?.trim() ?? '';
    const kind = c.req.query('kind') || 'all';
    if (!q) return c.json({ query: q, results: [] });
    return c.json({ query: q, results: search(db, q, kind) });
  });

  app.get('/api/word/:normTerm', (c) => {
    const normTerm = c.req.param('normTerm');
    const word = db.prepare('SELECT * FROM words WHERE norm_term = ?').get(normTerm);
    const parents = db
      .prepare(
        `SELECT ${ENTRY_COLUMNS} FROM entries WHERE norm_term = ? AND parent_id IS NULL
         ORDER BY source_type, source_ref DESC`,
      )
      .all(normTerm) as { id: number }[];
    if (!word && parents.length === 0) return c.json({ error: 'not found' }, 404);

    const childStmt = db.prepare(
      `SELECT ${ENTRY_COLUMNS} FROM entries WHERE parent_id = ? ORDER BY line`,
    );
    const occurrences = parents.map((p) => ({ ...p, children: childStmt.all(p.id) }));
    const mentions = db
      .prepare(
        `SELECT ${ENTRY_COLUMNS} FROM entries
         WHERE raw_f LIKE ? ESCAPE '\\' AND (norm_term IS NULL OR norm_term != ?)
         ORDER BY source_ref DESC LIMIT 100`,
      )
      .all(`%${normTerm.replace(/[\\%_]/g, (ch) => '\\' + ch)}%`, normTerm);

    const allPoints = db
      .prepare('SELECT slug, title, jlpt_level FROM grammar_points')
      .all() as { slug: string; title: string; jlpt_level: string | null }[];
    const grammarRefs = allPoints
      .filter((p) => titleMatchesTerm(p.title, normTerm))
      .map((p) => ({ slug: p.slug, title: p.title, jlptLevel: p.jlpt_level }));

    return c.json({ word: word ?? null, occurrences, mentions, grammarRefs });
  });

  app.get('/api/browse', (c) => {
    const kind = c.req.query('kind') ?? '';
    const sort = c.req.query('sort') || 'recent';
    // Clamp so page * PAGE_SIZE stays a safe SQLite integer (bounded OFFSET).
    const page = Math.min(1_000_000, Math.max(0, Math.trunc(Number(c.req.query('page')) || 0)));

    if (kind !== 'vocab' && kind !== 'grammar' && kind !== 'sentence') {
      return c.json({ error: 'invalid kind' }, 400);
    }

    if (kind === 'sentence') {
      const total = (
        db.prepare(`SELECT COUNT(*) AS n FROM entries WHERE kind = 'sentence' AND parent_id IS NULL`).get() as { n: number }
      ).n;
      const results = db
        .prepare(
          `SELECT ${ENTRY_COLUMNS} FROM entries WHERE kind = 'sentence' AND parent_id IS NULL
           ORDER BY source_ref DESC, file, line LIMIT ? OFFSET ?`,
        )
        .all(PAGE_SIZE, page * PAGE_SIZE);
      return c.json({ total, page, results });
    }

    if (!Object.hasOwn(WORD_SORTS, sort)) return c.json({ error: 'invalid sort' }, 400);
    if (sort === 'chapter' && kind !== 'vocab') {
      return c.json({ error: 'chapter sort is vocab-only' }, 400);
    }

    const total = (
      db.prepare('SELECT COUNT(*) AS n FROM words WHERE kind = ?').get(kind) as { n: number }
    ).n;
    const rows = db
      .prepare(`SELECT * FROM words WHERE kind = ? ORDER BY ${WORD_SORTS[sort]} LIMIT ? OFFSET ?`)
      .all(kind, PAGE_SIZE, page * PAGE_SIZE) as WordRow[];
    return c.json({ total, page, results: rows.map(wordToResult) });
  });

  app.get('/api/status', (c) => {
    const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    return c.json({
      entryCount: n('SELECT COUNT(*) AS n FROM entries'),
      wordCount: n('SELECT COUNT(*) AS n FROM words'),
      unparsedCount: n('SELECT COUNT(*) AS n FROM unparsed'),
      fileCount: n('SELECT COUNT(DISTINCT file) AS n FROM entries'),
    });
  });

  app.get('/api/unparsed', (c) => {
    return c.json({ rows: db.prepare('SELECT * FROM unparsed ORDER BY file, line').all() });
  });

  app.get('/api/grammar-points', (c) => {
    const level = c.req.query('level');
    const category = c.req.query('category');
    let rows = db
      .prepare('SELECT slug, title, description, categories, source, jlpt_level FROM grammar_points')
      .all() as GrammarRow[];
    if (level) rows = rows.filter((r) => r.jlpt_level === level);
    if (category)
      rows = rows.filter((r) => (JSON.parse(r.categories) as string[]).includes(category));
    rows.sort(
      (a, b) =>
        (JLPT_ORDER[a.jlpt_level ?? ''] ?? 9) - (JLPT_ORDER[b.jlpt_level ?? ''] ?? 9) ||
        a.title.localeCompare(b.title, 'ja'),
    );
    return c.json({ total: rows.length, results: rows.map(grammarRowToResult) });
  });

  app.get('/api/grammar-points/:slug', (c) => {
    const slug = c.req.param('slug');
    if (!SLUG_RE.test(slug)) return c.json({ error: 'bad slug' }, 400);
    const row = db
      .prepare('SELECT slug, title, description, categories, source, jlpt_level FROM grammar_points WHERE slug = ?')
      .get(slug) as GrammarRow | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);
    const content = opts.grammarDataPath
      ? loadGrammarContent(opts.grammarDataPath, slug)
      : null;
    const vaultGrammar = db
      .prepare("SELECT norm_term, term, reading, gloss, kind FROM words WHERE kind = 'grammar'")
      .all() as { norm_term: string; term: string; reading: string | null; gloss: string | null; kind: string }[];
    const lessonNotes = vaultGrammar
      .filter((w) => titleMatchesTerm(row.title, w.norm_term))
      .map((w) => ({
        normTerm: w.norm_term, term: w.term, reading: w.reading, gloss: w.gloss, kind: w.kind,
      }));
    return c.json({ point: grammarRowToResult(row), content, lessonNotes });
  });

  return app;
}
