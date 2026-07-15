import { describe, expect, test } from 'vitest';
import { parseVocabLine } from './parseVocabLine.js';

describe('parseVocabLine', () => {
  test('standard enriched line, no space before dash', () => {
    expect(parseVocabLine('涙（なみだ）- tears')).toEqual({
      term: '涙',
      reading: 'なみだ',
      gloss: 'tears',
    });
  });

  test('Genki style with spaces around dash and part-of-speech marker', () => {
    expect(parseVocabLine('雨（あめ） - rain *n.*')).toEqual({
      term: '雨',
      reading: 'あめ',
      gloss: 'rain n.',
    });
  });

  test('katakana loanword', () => {
    expect(parseVocabLine('アットホーム - homey; cozy')).toEqual({
      term: 'アットホーム',
      reading: null,
      gloss: 'homey; cozy',
    });
  });

  test('per-kanji furigana phrase', () => {
    expect(parseVocabLine('作（つく）りましたか - did you make it?')).toEqual({
      term: '作りましたか',
      reading: 'つくりましたか',
      gloss: 'did you make it?',
    });
  });

  test('Quartet bracket aside', () => {
    expect(parseVocabLine('空く（［～が］あく） - to become available [vi.]')).toEqual({
      term: '空く',
      reading: 'あく',
      gloss: 'to become available [vi.]',
    });
  });

  test('bare bullet with no gloss (2023-style)', () => {
    expect(parseVocabLine('ケーキと　なにを　のみました')).toEqual({
      term: 'ケーキと　なにを　のみました',
      reading: null,
      gloss: null,
    });
  });

  test('gloss containing hyphenated words is not split again', () => {
    expect(parseVocabLine('ううん - uh-uh; no *exp.*')).toEqual({
      term: 'ううん',
      reading: null,
      gloss: 'uh-uh; no exp.',
    });
  });

  test('strips bold markers and NBSP', () => {
    expect(parseVocabLine('**梅雨（つゆ）** - rainy season')).toEqual({
      term: '梅雨',
      reading: 'つゆ',
      gloss: 'rainy season',
    });
  });

  test('gloss with parens survives', () => {
    expect(parseVocabLine('度（たび）- times (x time, each time); degree')).toEqual({
      term: '度',
      reading: 'たび',
      gloss: 'times (x time, each time); degree',
    });
  });
});
