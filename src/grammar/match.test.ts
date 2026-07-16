import { describe, expect, test } from 'vitest';
import { patternTokens, titleMatchesTerm } from './match.js';

describe('patternTokens', () => {
  test('splits on ・ and strips 〜 and ASCII parentheticals', () => {
    expect(patternTokens('〜てしまう・〜ちゃう')).toEqual(['てしまう', 'ちゃう']);
    expect(patternTokens('〜させる (Causative)')).toEqual(['させる']);
    expect(patternTokens('て Form')).toEqual(['て']);
  });

  test('never merges Japanese fragments across stripped English runs', () => {
    expect(patternTokens('い-Adjective く Form')).toEqual(['い', 'く']);
    expect(patternTokens('い-Adjectiveく (Adverb Form)')).toEqual(['い', 'く']);
  });

  test('never merges Japanese fragments across whitespace alone', () => {
    expect(patternTokens('こと 事')).toEqual(['こと', '事']);
  });
});

// Table-driven per the spec: unsure = no link, never a wrong link.
describe('titleMatchesTerm', () => {
  const cases: [title: string, term: string, expected: boolean][] = [
    ['〜てしまう・〜ちゃう', 'てしまう', true],   // exact token
    ['〜てしまう・〜ちゃう', 'ちゃう', true],     // second token
    ['〜させる (Causative)', 'させる', true],     // vault 〜させる normalizes to させる
    ['〜させる (Causative)', 'させられる', false], // superstring — NOT a match
    ['て Form', 'て', false],                     // 1-char token: too weak, no link
    ['Adjective さ (Objective Nouns)', 'さ', false], // 1-char token again
    ['〜てしまう・〜ちゃう', 'しまう', false],    // substring — NOT a match
    ['Particle は', 'は', false],                 // 1-char
    ['い-Adjective く Form', 'いく', false],        // fabricated cross-run token — NOT a match
    ['い-Adjectiveく (Noun)', 'いく', false],       // same, without the space
  ];
  for (const [title, term, expected] of cases) {
    test(`${title} vs ${term} → ${expected}`, () => {
      expect(titleMatchesTerm(title, term)).toBe(expected);
    });
  }
});
