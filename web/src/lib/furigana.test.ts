import { describe, expect, test } from 'vitest';
import { parseFurigana } from './furigana';

describe('parseFurigana', () => {
  test('kanji run with reading becomes a ruby segment', () => {
    expect(parseFurigana('日本（にほん）に来た')).toEqual([
      { base: '日本', ruby: 'にほん' },
      { base: 'に来た' },
    ]);
  });
  test('multiple readings in one sentence', () => {
    expect(parseFurigana('全部（ぜんぶ）食（た）べた')).toEqual([
      { base: '全部', ruby: 'ぜんぶ' },
      { base: '食', ruby: 'た' },
      { base: 'べた' },
    ]);
  });
  test('non-kana parenthetical is left as plain text', () => {
    expect(parseFurigana('て form（Te Form）')).toEqual([{ base: 'て form（Te Form）' }]);
  });
  test('text without furigana passes through', () => {
    expect(parseFurigana('ただのテキスト')).toEqual([{ base: 'ただのテキスト' }]);
  });
});
