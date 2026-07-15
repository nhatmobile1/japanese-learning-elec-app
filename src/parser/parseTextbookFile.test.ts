import { describe, expect, test } from 'vitest';
import { parseTextbookFile } from './parseTextbookFile.js';

const QUARTET = `---
tags: [japanese, vocabulary, quartet]
textbook: QUARTET I
chapter: L5
entry_count: 113
---

# QUARTET I Lesson 5 — Vocabulary

## 読み 1 (読1)

> [!example]+ Vocabulary (62)
> -   流れる（ながれる） - to flow
>     -   例文（れいぶん） - example sentence
> -   空く（［～が］あく） - to become available [vi.]
`;

const GENKI = `---
tags: [japanese, vocabulary, genki]
textbook: Genki 3rd Edition
chapter: L8
---

## 会話・文法編 (Conversation & Grammar)

> [!example]+ Vocabulary (71)
> -   雨（あめ） - rain *n.*
`;

const INDEX_FILE = `---
tags: [japanese, vocabulary, genki, moc]
textbook: Genki 3rd Edition
---

# Genki — Vocabulary Index

| Chapter | Words |
|---|---|
`;

describe('parseTextbookFile', () => {
  test('Quartet chapter: sourceType, sourceRef, section', () => {
    const r = parseTextbookFile(QUARTET);
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0]).toMatchObject({
      term: '流れる',
      reading: 'ながれる',
      gloss: 'to flow',
      kind: 'vocab',
      sourceType: 'quartet',
      sourceRef: 'Quartet I L5',
      section: '読み 1 (読1)',
    });
  });

  test('nested bullet inside a callout attaches as a child of the preceding top-level entry', () => {
    const r = parseTextbookFile(QUARTET);
    expect(r.entries[0].children).toHaveLength(1);
    expect(r.entries[0].children[0]).toMatchObject({
      term: '例文',
      reading: 'れいぶん',
      gloss: 'example sentence',
    });
  });

  test('Genki chapter maps to genki sourceType', () => {
    const r = parseTextbookFile(GENKI);
    expect(r.entries[0]).toMatchObject({
      term: '雨',
      sourceType: 'genki',
      sourceRef: 'Genki L8',
      section: '会話・文法編 (Conversation & Grammar)',
    });
  });

  test('index files without chapter frontmatter are skipped entirely', () => {
    const r = parseTextbookFile(INDEX_FILE);
    expect(r.entries).toHaveLength(0);
    expect(r.unparsed).toHaveLength(0);
  });
});
