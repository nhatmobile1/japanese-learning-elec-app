import { describe, expect, test } from 'vitest';
import {
  extractReading,
  foldForSearch,
  hasKanji,
  isKanaOnly,
  kataToHira,
  normalizeTerm,
  stripReadings,
} from './japanese.js';

describe('kataToHira', () => {
  test('folds katakana to hiragana, leaves the rest', () => {
    expect(kataToHira('アットホーム')).toBe('あっとほーむ');
    expect(kataToHira('雨とrain')).toBe('雨とrain');
  });
});

describe('hasKanji / isKanaOnly', () => {
  test('detects kanji including 々', () => {
    expect(hasKanji('次々と')).toBe(true);
    expect(hasKanji('こぼれ')).toBe(false);
  });
  test('kana-only accepts hiragana, katakana, ー and punctuation used in readings', () => {
    expect(isKanaOnly('ぼっくすせき')).toBe(true);
    expect(isKanaOnly('アットホーム')).toBe(true);
    expect(isKanaOnly('あく')).toBe(true);
    expect(isKanaOnly('見る')).toBe(false);
    expect(isKanaOnly('')).toBe(false);
  });
});

describe('stripReadings', () => {
  test('removes whole-word and per-kanji reading groups', () => {
    expect(stripReadings('見上げる（みあげる）')).toBe('見上げる');
    expect(stripReadings('作（つく）りましたか')).toBe('作りましたか');
    expect(stripReadings('日本語（にほんご）の勉強（べんきょう）')).toBe('日本語の勉強');
  });
  test('removes reading groups that carry ［…］ asides (Quartet style)', () => {
    expect(stripReadings('空く（［～が］あく）')).toBe('空く');
    expect(stripReadings('流れてくる（［すしが］ながれてくる）')).toBe('流れてくる');
  });
  test('keeps non-reading parens', () => {
    expect(stripReadings('度（たび）- times (x time)')).toBe('度- times (x time)');
  });
});

describe('extractReading', () => {
  test('whole-word furigana', () => {
    expect(extractReading('見上げる（みあげる）')).toBe('みあげる');
    expect(extractReading('乗り換え（のりかえ）')).toBe('のりかえ');
    expect(extractReading('涙（なみだ）')).toBe('なみだ');
  });
  test('whole-word furigana on a katakana-prefixed word', () => {
    expect(extractReading('ボックス席（ぼっくすせき）')).toBe('ぼっくすせき');
  });
  test('per-kanji furigana in a longer phrase', () => {
    expect(extractReading('作（つく）りましたか')).toBe('つくりましたか');
    expect(extractReading('日本語（にほんご）の勉強（べんきょう）')).toBe('にほんごのべんきょう');
  });
  test('Quartet ［…］ asides are dropped from readings', () => {
    expect(extractReading('空く（［～が］あく）')).toBe('あく');
  });
  test('kana-only head returns itself folded', () => {
    expect(extractReading('アットホーム')).toBe('あっとほーむ');
  });
  test('returns null when bare kanji remain', () => {
    expect(extractReading('大切な文化')).toBe(null);
  });
});

describe('foldForSearch / normalizeTerm', () => {
  test('folds case, width, katakana, and strips all whitespace kinds', () => {
    expect(foldForSearch('ケーキと　なにを')).toBe('けーきとなにを');
    expect(foldForSearch('Tax Refund')).toBe('taxrefund');
  });
  test('normalizeTerm drops ［…］ and edge tildes', () => {
    expect(normalizeTerm('〜倍')).toBe('倍');
    expect(normalizeTerm('［～が］空く')).toBe('空く');
  });
});
