import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type Database from 'better-sqlite3';
import { openDb } from './db.js';
import { indexVault } from './indexer.js';
import { search } from './search.js';
import { makeFixtureVault } from '../tests/fixture.js';

let vault: string;
let db: Database.Database;

beforeAll(() => {
  vault = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-search-'));
  makeFixtureVault(vault);
  db = openDb(':memory:');
  indexVault(db, vault);
});

afterAll(() => {
  db.close();
  fs.rmSync(vault, { recursive: true, force: true });
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
