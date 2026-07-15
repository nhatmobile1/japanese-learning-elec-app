import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type Database from 'better-sqlite3';
import { openDb } from './db.js';
import { indexVault, reindexFile, removeFile, routeFile } from './indexer.js';
import { makeFixtureVault } from '../tests/fixture.js';

let vault: string;
let db: Database.Database;

beforeAll(() => {
  vault = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-fixture-'));
  makeFixtureVault(vault);
  db = openDb(':memory:');
  indexVault(db, vault);
});

afterAll(() => {
  db.close();
  fs.rmSync(vault, { recursive: true, force: true });
});

describe('routeFile', () => {
  test('routes regardless of path casing (Obsidian vaults get renamed)', () => {
    expect(routeFile('Lessons/2025/2025-07.md')).toBe('lesson');
    expect(routeFile('lessons/2025/2025-07.md')).toBe('lesson');
    expect(routeFile('Vocabulary/Genki/Genki-L08.md')).toBe('textbook');
    expect(routeFile('vocabulary/genki/genki-l08.md')).toBe('textbook');
    expect(routeFile('Grammar/Grammar-Quick-Reference.md')).toBe('grammar');
    expect(routeFile('grammar/grammar-quick-reference.md')).toBe('grammar');
    expect(routeFile('japanese-frequency.txt')).toBe(null);
  });
});

describe('indexVault', () => {
  test('indexes lesson, textbook, and grammar entries; skips _files and index files', () => {
    const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    // 6 top-level lesson entries (4 vocab incl duplicate 還付, 1 sentence, 1 grammar) + 1 child
    expect(count(`SELECT COUNT(*) AS n FROM entries WHERE source_type = 'lesson'`)).toBe(7);
    expect(count(`SELECT COUNT(*) AS n FROM entries WHERE source_type = 'quartet'`)).toBe(1);
    expect(count(`SELECT COUNT(*) AS n FROM entries WHERE source_type = 'genki'`)).toBe(1);
    expect(count(`SELECT COUNT(*) AS n FROM entries WHERE source_type = 'grammar-note'`)).toBe(1);
  });

  test('children carry parent_id', () => {
    const child = db
      .prepare(`SELECT * FROM entries WHERE gloss = 'tax refund'`)
      .get() as { parent_id: number | null };
    expect(child.parent_id).not.toBe(null);
  });

  test('unknown-callout bullets land in unparsed', () => {
    const rows = db.prepare(`SELECT * FROM unparsed`).all() as { reason: string }[];
    expect(rows.some((r) => r.reason === 'bullet in unknown callout')).toBe(true);
  });

  test('words groups across sources: 流れる has lesson + quartet occurrences', () => {
    const w = db
      .prepare(`SELECT * FROM words WHERE term = '流れる'`)
      .get() as { occurrence_count: number; sources: string; lesson_count: number };
    expect(w.occurrence_count).toBe(2);
    expect(w.lesson_count).toBe(1);
    const sources = JSON.parse(w.sources) as { sourceType: string; sourceRef: string }[];
    expect(sources.map((s) => s.sourceType).sort()).toEqual(['lesson', 'quartet']);
  });

  test('words tracks first/last seen lesson dates for repeated word', () => {
    const w = db
      .prepare(`SELECT * FROM words WHERE term = '還付'`)
      .get() as { occurrence_count: number; first_seen: string; last_seen: string };
    expect(w.occurrence_count).toBe(2);
    expect(w.first_seen).toBe('2025-06-01');
    expect(w.last_seen).toBe('2025-06-02');
  });
});

describe('words sort metadata', () => {
  const get = (sql: string) =>
    db.prepare(sql).get() as {
      kind: string;
      reading_sort: string | null;
      chapter_sort: string | null;
    };

  test('kind is the dominant kind of the group', () => {
    expect(get(`SELECT kind FROM words WHERE term = '還付'`).kind).toBe('vocab');
    expect(get(`SELECT kind FROM words WHERE norm_term = '倍'`).kind).toBe('grammar');
  });

  test('reading_sort uses the reading, falls back to kana-only norm terms, else NULL', () => {
    expect(get(`SELECT reading_sort FROM words WHERE term = '還付'`).reading_sort).toBe('かんぷ');
    // The grammar-note bullet 〜させる has no furigana; its norm_term させる is kana-only.
    expect(get(`SELECT reading_sort FROM words WHERE norm_term = 'させる'`).reading_sort).toBe('させる');
    // もう1年 has no kana rendering (digit + kanji) → NULL, sorted last.
    expect(get(`SELECT reading_sort FROM words WHERE term = 'もう1年'`).reading_sort).toBe(null);
  });

  test('chapter_sort derives from the first textbook source', () => {
    expect(get(`SELECT chapter_sort FROM words WHERE term = '雨'`).chapter_sort).toBe('1-08');
    expect(get(`SELECT chapter_sort FROM words WHERE term = '流れる'`).chapter_sort).toBe('2-05');
    expect(get(`SELECT chapter_sort FROM words WHERE term = '還付'`).chapter_sort).toBe(null);
  });
});

describe('reindexFile / removeFile', () => {
  test('reindexing a changed file replaces its rows', () => {
    const rel = 'Vocabulary/Genki/Genki-L08.md';
    const p = path.join(vault, rel);
    fs.writeFileSync(
      p,
      fs.readFileSync(p, 'utf8') + '> -   曇り（くもり） - cloudy weather *n.*\n',
    );
    reindexFile(db, vault, rel);
    const n = (db.prepare(`SELECT COUNT(*) AS n FROM entries WHERE source_type = 'genki'`).get() as { n: number }).n;
    expect(n).toBe(2);
  });

  test('removeFile deletes rows and rebuilds words', () => {
    removeFile(db, 'Vocabulary/Quartet-1/Quartet-L05.md');
    const w = db.prepare(`SELECT * FROM words WHERE term = '流れる'`).get() as { occurrence_count: number };
    expect(w.occurrence_count).toBe(1);
  });
});
