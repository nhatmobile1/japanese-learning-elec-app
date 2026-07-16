import { describe, expect, test } from 'vitest';
import { isFormulaDuplicate, splitConjugationLines, splitFormulaLines } from './formula';

describe('splitFormulaLines', () => {
  test('splits multi-equation formulas (real verb-past-ta-form data)', () => {
    expect(
      splitFormulaLines('会（あ）う + った = 会（あ）った 立（た）つ + った = 立（た）った 割（われ）る + った = 割（わ）った'),
    ).toEqual([
      '会（あ）う + った = 会（あ）った',
      '立（た）つ + った = 立（た）った',
      '割（われ）る + った = 割（わ）った',
    ]);
  });
  test('single equation stays one line', () => {
    expect(splitFormulaLines('書（か）く + いた = 書（か）いた')).toEqual([
      '書（か）く + いた = 書（か）いた',
    ]);
  });
  test('splits arrow pairs when no equals sign', () => {
    expect(splitFormulaLines('会う → 会え 行く → 行け')).toEqual(['会う → 会え', '行く → 行け']);
  });
  test('plain text passes through', () => {
    expect(splitFormulaLines('て form ＋ しまう')).toEqual(['て form ＋ しまう']);
  });
});

describe('splitConjugationLines', () => {
  test('splits table-cell conjugation pairs', () => {
    expect(splitConjugationLines('食（た）べる → 食（た）べた 起（お）きる → 起（お）きた')).toEqual([
      '食（た）べる → 食（た）べた',
      '起（お）きる → 起（お）きた',
    ]);
  });
  test('single pair stays one line', () => {
    expect(splitConjugationLines('食べる → 食べた')).toEqual(['食べる → 食べた']);
  });
});

describe('isFormulaDuplicate', () => {
  test('detects the scraped duplicate even with wrong readings and stray spaces', () => {
    expect(
      isFormulaDuplicate(
        '休（やす）む + んだ = 休（やす）んだ',
        '休（きゅう） む + んだ = 休（きゅう） んだ',
      ),
    ).toBe(true);
  });
  test('unrelated paragraph is kept', () => {
    expect(
      isFormulaDuplicate('書（か）く + いた = 書（か）いた', 'Verbs ending in ぐ change to いだ :'),
    ).toBe(false);
  });
  test('empty strings never match', () => {
    expect(isFormulaDuplicate('', 'anything')).toBe(false);
  });
});
