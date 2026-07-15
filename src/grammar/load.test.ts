import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { makeGrammarFixture } from '../../tests/fixture.js';
import { jlptForTitle } from './jlpt.js';
import { loadGrammarContent, loadGrammarPoints, resolveGrammarDataPath, SLUG_RE } from './load.js';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grammar-'));
  makeGrammarFixture(dir);
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('loadGrammarPoints', () => {
  test('merges tofugu + custom, applies JLPT map to tofugu titles', () => {
    const points = loadGrammarPoints(dir);
    expect(points).toHaveLength(4);
    const te = points.find((p) => p.slug === 'te-form')!;
    expect(te.source).toBe('tofugu');
    expect(te.jlptLevel).toBe('N5'); // from the title map, not the JSON
    const shimau = points.find((p) => p.slug === 'te-shimau')!;
    expect(shimau.source).toBe('lessons');
    expect(shimau.jlptLevel).toBe('N4'); // from the custom JSON itself
  });

  test('unmapped tofugu title gets null level', () => {
    const points = loadGrammarPoints(dir);
    const sa = points.find((p) => p.slug === 'adjective-suffix-sa')!;
    // 'Adjective さ (Objective Nouns)' IS in the N3 list — assert the map works
    expect(sa.jlptLevel).toBe('N3');
  });
});

describe('loadGrammarContent', () => {
  test('reads a content file by slug', () => {
    const c = loadGrammarContent(dir, 'te-shimau')!;
    expect(c.title).toBe('〜てしまう・〜ちゃう');
    expect(c.content.some((b) => b.type === 'example')).toBe(true);
  });
  test('missing slug returns null', () => {
    expect(loadGrammarContent(dir, 'no-such-slug')).toBeNull();
  });
  test('SLUG_RE rejects traversal attempts', () => {
    expect(SLUG_RE.test('../../etc/passwd')).toBe(false);
    expect(SLUG_RE.test('te-shimau')).toBe(true);
  });
});

describe('resolveGrammarDataPath', () => {
  test('primary wins when it exists', () => {
    expect(resolveGrammarDataPath(dir, '/nope')).toBe(dir);
  });
  test('falls back when primary is missing', () => {
    expect(resolveGrammarDataPath('/no/such/dir', dir)).toBe(dir);
  });
  test('null when neither exists', () => {
    expect(resolveGrammarDataPath('/no/such/dir', null)).toBeNull();
  });
});

describe('jlptForTitle', () => {
  test('known N5 title', () => expect(jlptForTitle('て Form')).toBe('N5'));
  test('unknown title', () => expect(jlptForTitle('Totally Made Up')).toBeNull());
});
