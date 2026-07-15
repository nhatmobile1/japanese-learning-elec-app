import { describe, expect, test } from 'vitest';
import { parseLessonFile } from './parseLessonFile.js';

const SAMPLE = `---
tags: [japanese, lessons, 2025]
month: 2025-06
---

# June 2025 — Japanese Lessons

## 2025-06-01

> [!example]+ Vocabulary
> -   涙（なみだ）- tears
> -   もう1年（ねん）- one more year
>     -   税金（ぜいきん）の還付（かんぷ）- tax refund

## 2025-06-02

> [!example]+ Vocabulary
> -   手作り（てづくり）- handmade

> [!tip]+ Grammar & Patterns
> -   〜倍 - times

> [!quote]+ Example Sentences
> -   ケーキと　なにを　のみました

> [!note]+ Something Else
> -   this should be reported, not indexed
`;

describe('parseLessonFile', () => {
  const result = parseLessonFile(SAMPLE);

  test('extracts vocab entries with their lesson date', () => {
    const namida = result.entries.find((e) => e.term === '涙');
    expect(namida).toMatchObject({
      reading: 'なみだ',
      gloss: 'tears',
      kind: 'vocab',
      sourceType: 'lesson',
      sourceRef: '2025-06-01',
    });
  });

  test('nested bullets become children of the preceding top-level entry', () => {
    const parent = result.entries.find((e) => e.term === 'もう1年');
    expect(parent?.children).toHaveLength(1);
    expect(parent?.children[0]).toMatchObject({
      term: '税金の還付',
      gloss: 'tax refund',
    });
  });

  test('tip callouts become grammar, quote callouts become sentences', () => {
    expect(result.entries.find((e) => e.raw.includes('〜倍'))?.kind).toBe('grammar');
    const sentence = result.entries.find((e) => e.kind === 'sentence');
    expect(sentence?.sourceRef).toBe('2025-06-02');
    expect(sentence?.gloss).toBe(null);
  });

  test('bullets in unknown callouts go to unparsed, not entries', () => {
    expect(result.entries.some((e) => e.raw.includes('should be reported'))).toBe(false);
    expect(result.unparsed.some((u) => u.reason === 'bullet in unknown callout')).toBe(true);
  });

  test('counts: 5 top-level entries across both days (涙, もう1年, 手作り, 〜倍, sentence)', () => {
    expect(result.entries).toHaveLength(5);
  });

  test('bullets with no callout header go to unparsed', () => {
    const r = parseLessonFile('## 2025-01-01\n\n> -   迷子（まいご）- lost child\n');
    expect(r.entries).toHaveLength(0);
    expect(r.unparsed).toEqual([
      { line: 3, text: '> -   迷子（まいご）- lost child', reason: 'bullet outside any callout' },
    ]);
  });
});
