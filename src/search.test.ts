import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type Database from 'better-sqlite3';
import { openDb } from './db.js';
import { indexVault } from './indexer.js';
import { search } from './search.js';
import { makeFixtureVault, makeGrammarFixture } from '../tests/fixture.js';
import { loadGrammarPoints } from './grammar/load.js';
import { indexGrammarPoints } from './grammar/indexGrammar.js';

let vault: string;
let db: Database.Database;
let grammarDir: string;

beforeAll(() => {
  vault = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-search-'));
  makeFixtureVault(vault);
  db = openDb(':memory:');
  indexVault(db, vault);

  grammarDir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-grammar-'));
  makeGrammarFixture(grammarDir);
  indexGrammarPoints(db, loadGrammarPoints(grammarDir));
});

afterAll(() => {
  db.close();
  fs.rmSync(vault, { recursive: true, force: true });
  fs.rmSync(grammarDir, { recursive: true, force: true });
});

describe('search', () => {
  test('kanji query finds the word', () => {
    const r = search(db, '還付');
    expect(r[0].term).toBe('還付');
    expect(r[0].occurrenceCount).toBe(2);
  });

  test('kana query matches via reading', () => {
    const r = search(db, 'かんぷ');
    expect(r[0].term).toBe('還付');
  });

  test('katakana query is folded to hiragana', () => {
    const r = search(db, 'カンプ');
    expect(r[0].term).toBe('還付');
  });

  test('English query matches gloss', () => {
    const r = search(db, 'refund');
    expect(r[0].term).toBe('還付');
  });

  test('exact match outranks substring match', () => {
    // 還付 (exact) must beat 税金の還付 (contains) for query 還付
    const r = search(db, '還付');
    expect(r[0].term).toBe('還付');
    const idx = r.findIndex((x) => x.term === '税金の還付');
    expect(idx).toBeGreaterThan(0);
  });

  test('kind filter restricts results', () => {
    const r = search(db, '倍', 'grammar');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.kind === 'grammar')).toBe(true);
    expect(search(db, '倍', 'sentence')).toHaveLength(0);
  });

  test('results grouped: two 還付 lesson entries collapse into one word', () => {
    const r = search(db, '還付');
    expect(r.filter((x) => x.term === '還付')).toHaveLength(1);
  });

  test('sentences are searchable', () => {
    const r = search(db, 'もらいました');
    expect(r.some((x) => x.kind === 'sentence')).toBe(true);
  });

  test('empty and whitespace queries return nothing', () => {
    expect(search(db, '')).toHaveLength(0);
    expect(search(db, '   ')).toHaveLength(0);
  });

  test('LIKE wildcards in the query are escaped', () => {
    expect(search(db, '%')).toHaveLength(0);
  });
});

describe('grammar-point search', () => {
  test('Japanese query finds a reference point', () => {
    const hits = search(db, 'てしまう', 'all');
    const gp = hits.find((r) => r.kind === 'grammar-point');
    expect(gp).toBeDefined();
    expect(gp!.slug).toBe('te-shimau');
    expect(gp!.term).toBe('〜てしまう・〜ちゃう');
    expect(gp!.sources).toEqual([{ sourceType: 'reference', sourceRef: 'Custom' }]);
  });

  test('romaji slug query finds a reference point', () => {
    const hits = search(db, 'shimau', 'all');
    expect(hits.some((r) => r.kind === 'grammar-point' && r.slug === 'te-shimau')).toBe(true);
  });

  test('English description query finds a reference point', () => {
    const hits = search(db, 'completely finished', 'all');
    expect(hits.some((r) => r.slug === 'te-shimau')).toBe(true);
  });

  test('kind=vocab excludes reference points, kind=grammar includes them', () => {
    expect(search(db, 'てしまう', 'vocab').some((r) => r.kind === 'grammar-point')).toBe(false);
    expect(search(db, 'てしまう', 'grammar').some((r) => r.kind === 'grammar-point')).toBe(true);
  });
});
