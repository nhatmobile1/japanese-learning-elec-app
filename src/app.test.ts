import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type Database from 'better-sqlite3';
import { createApp } from './app.js';
import { openDb } from './db.js';
import { indexVault } from './indexer.js';
import { makeFixtureVault, makeGrammarFixture } from '../tests/fixture.js';
import { loadGrammarPoints } from './grammar/load.js';
import { indexGrammarPoints } from './grammar/indexGrammar.js';

let vault: string;
let grammarDir: string;
let db: Database.Database;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  vault = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-app-'));
  makeFixtureVault(vault);
  db = openDb(':memory:');
  indexVault(db, vault);
  grammarDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-grammar-'));
  makeGrammarFixture(grammarDir);
  indexGrammarPoints(db, loadGrammarPoints(grammarDir));
  app = createApp(db, { grammarDataPath: grammarDir });
});

afterAll(() => {
  db.close();
  fs.rmSync(vault, { recursive: true, force: true });
  fs.rmSync(grammarDir, { recursive: true, force: true });
});

describe('GET /api/search', () => {
  test('returns ranked results', async () => {
    const res = await app.request('/api/search?q=refund');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { term: string }[] };
    expect(body.results[0].term).toBe('還付');
  });

  test('empty query returns empty results, not an error', async () => {
    const res = await app.request('/api/search?q=');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { results: unknown[] }).results).toHaveLength(0);
  });
});

describe('GET /api/word/:normTerm', () => {
  test('returns occurrences with children and mentions', async () => {
    const res = await app.request(`/api/word/${encodeURIComponent('還付')}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      word: { term: string; occurrence_count: number };
      occurrences: { source_ref: string; children: unknown[] }[];
      mentions: { raw: string }[];
    };
    expect(body.word.term).toBe('還付');
    expect(body.occurrences).toHaveLength(2);
    // the sentence 還付（かんぷ）をもらいました and the child 税金の還付 mention it
    expect(body.mentions.length).toBeGreaterThanOrEqual(1);
  });

  test('unknown word returns 404', async () => {
    const res = await app.request('/api/word/zzzzzz');
    expect(res.status).toBe(404);
  });

  test('terms containing a literal % do not crash the route', async () => {
    const res = await app.request(`/api/word/${encodeURIComponent('10%引き')}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/status and /api/unparsed', () => {
  test('status reports counts', async () => {
    const body = (await (await app.request('/api/status')).json()) as {
      entryCount: number;
      wordCount: number;
      unparsedCount: number;
    };
    expect(body.entryCount).toBeGreaterThan(5);
    expect(body.wordCount).toBeGreaterThan(3);
    expect(body.unparsedCount).toBeGreaterThanOrEqual(1);
  });

  test('unparsed lists flagged lines', async () => {
    const body = (await (await app.request('/api/unparsed')).json()) as {
      rows: { reason: string }[];
    };
    expect(body.rows.some((r) => r.reason === 'bullet in unknown callout')).toBe(true);
  });
});

describe('GET /api/browse', () => {
  const terms = async (qs: string) => {
    const res = await app.request(`/api/browse?${qs}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; results: { term: string }[] };
    return { total: body.total, list: body.results.map((r) => r.term) };
  };

  test('vocab recent: newest lesson first, textbook-only last', async () => {
    const { total, list } = await terms('kind=vocab&sort=recent');
    expect(list).toEqual(['還付', '流れる', 'もう1年', '雨']);
    expect(total).toBe(4);
  });

  test('vocab reading: あいうえお order, unreadable terms last', async () => {
    const { list } = await terms('kind=vocab&sort=reading');
    expect(list).toEqual(['雨', '還付', '流れる', 'もう1年']);
  });

  test('vocab frequency: most lessons first', async () => {
    const { list } = await terms('kind=vocab&sort=frequency');
    expect(list).toEqual(['還付', '流れる', 'もう1年', '雨']);
  });

  test('vocab chapter: Genki, then Quartet, lesson-only words last', async () => {
    const { list } = await terms('kind=vocab&sort=chapter');
    expect(list).toEqual(['雨', '流れる', '還付', 'もう1年']);
  });

  test('grammar view lists grammar points, recent first', async () => {
    const { total, list } = await terms('kind=grammar&sort=recent');
    expect(total).toBe(2);
    expect(list).toEqual(['〜倍', '〜させる']);
  });

  test('sentences: newest first with total', async () => {
    const res = await app.request('/api/browse?kind=sentence');
    const body = (await res.json()) as { total: number; results: { raw: string }[] };
    expect(body.total).toBe(1);
    expect(body.results[0].raw).toContain('もらいました');
  });

  test('invalid kind, invalid sort, and chapter-on-grammar are 400', async () => {
    expect((await app.request('/api/browse?kind=bogus')).status).toBe(400);
    expect((await app.request('/api/browse?kind=vocab&sort=bogus')).status).toBe(400);
    expect((await app.request('/api/browse?kind=grammar&sort=chapter')).status).toBe(400);
  });

  test('page past the end returns empty results', async () => {
    const res = await app.request('/api/browse?kind=vocab&sort=recent&page=7');
    const body = (await res.json()) as { results: unknown[] };
    expect(body.results).toEqual([]);
  });

  test('prototype-chain sort keys are rejected with 400', async () => {
    expect((await app.request('/api/browse?kind=vocab&sort=constructor')).status).toBe(400);
    expect((await app.request('/api/browse?kind=vocab&sort=hasOwnProperty')).status).toBe(400);
  });

  test('astronomical page numbers return empty results, not an error', async () => {
    const res = await app.request('/api/browse?kind=vocab&sort=recent&page=1e20');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { results: unknown[] }).results).toEqual([]);
  });
});

describe('GET /api/grammar-points', () => {
  test('lists all points N5-first, null level last', async () => {
    const res = await app.request('/api/grammar-points');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      total: number;
      results: { slug: string; jlptLevel: string | null; categories: string[] }[];
    };
    expect(body.total).toBe(4);
    expect(body.results[0].jlptLevel).toBe('N5'); // て Form
    expect(body.results[0].categories).toEqual(['Verb Form']);
  });

  test('level and category filters', async () => {
    const res = await app.request('/api/grammar-points?level=N4');
    const body = (await res.json()) as { results: { slug: string }[] };
    expect(body.results.map((r) => r.slug).sort()).toEqual(['saseru', 'te-shimau']);

    const res2 = await app.request(
      '/api/grammar-points?category=' + encodeURIComponent('Adjective Form'),
    );
    const body2 = (await res2.json()) as { results: { slug: string }[] };
    expect(body2.results.map((r) => r.slug)).toEqual(['adjective-suffix-sa']);
  });

  test('detail returns point + content blocks', async () => {
    const res = await app.request('/api/grammar-points/te-shimau');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      point: { title: string; source: string };
      content: { content: { type: string }[] };
      lessonNotes: unknown[];
    };
    expect(body.point.title).toBe('〜てしまう・〜ちゃう');
    expect(body.content.content.some((b) => b.type === 'example')).toBe(true);
    expect(Array.isArray(body.lessonNotes)).toBe(true);
  });

  test('bad slug is 400, unknown slug is 404', async () => {
    expect((await app.request('/api/grammar-points/..%2F..%2Fetc')).status).toBe(400);
    expect((await app.request('/api/grammar-points/zzzz-none')).status).toBe(404);
  });
});
