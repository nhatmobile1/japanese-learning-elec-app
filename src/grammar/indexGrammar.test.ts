import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type Database from 'better-sqlite3';
import { openDb } from '../db.js';
import { makeGrammarFixture } from '../../tests/fixture.js';
import { loadGrammarPoints } from './load.js';
import { indexGrammarPoints } from './indexGrammar.js';

let dir: string;
let db: Database.Database;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grammar-idx-'));
  makeGrammarFixture(dir);
  db = openDb(':memory:');
});
afterAll(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('indexGrammarPoints', () => {
  test('inserts every point with folded search columns', () => {
    const n = indexGrammarPoints(db, loadGrammarPoints(dir));
    expect(n).toBe(4);
    const row = db
      .prepare('SELECT * FROM grammar_points WHERE slug = ?')
      .get('te-shimau') as { title_f: string; jlpt_level: string; categories: string };
    expect(row.title_f).toBe('〜てしまう・〜ちゃう'.normalize('NFKC').toLowerCase());
    expect(row.jlpt_level).toBe('N4');
    expect(JSON.parse(row.categories)).toEqual(['Verb Form']);
  });

  test('re-indexing replaces, never duplicates', () => {
    indexGrammarPoints(db, loadGrammarPoints(dir));
    const n = (db.prepare('SELECT COUNT(*) AS n FROM grammar_points').get() as { n: number }).n;
    expect(n).toBe(4);
  });
});
