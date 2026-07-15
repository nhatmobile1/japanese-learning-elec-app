import fs from 'node:fs';
import path from 'node:path';

const LESSON = `---
month: 2025-06
---

## 2025-06-01

> [!example]+ Vocabulary
> -   還付（かんぷ）- refund
> -   流れる（ながれる）- flowing
> -   もう1年（ねん）- one more year
>     -   税金（ぜいきん）の還付（かんぷ）- tax refund

> [!quote]+ Example Sentences
> -   還付（かんぷ）をもらいました

## 2025-06-02

> [!example]+ Vocabulary
> -   還付（かんぷ）- refund (again)

> [!tip]+ Grammar & Patterns
> -   〜倍 - times

> [!wat]+ Unknown
> -   mystery bullet
`;

const QUARTET = `---
textbook: QUARTET I
chapter: L5
---

## 読み 1 (読1)

> [!example]+ Vocabulary
> -   流れる（ながれる） - to flow
`;

const GENKI = `---
textbook: Genki 3rd Edition
chapter: L8
---

## 会話・文法編

> [!example]+ Vocabulary
> -   雨（あめ） - rain *n.*
`;

const GENKI_INDEX = `---
textbook: Genki 3rd Edition
---

# Index — no chapter, must be skipped
`;

const GRAMMAR = `---
tags: [grammar]
---

## Causative

> [!tip]+ Pattern
> -   〜させる - to make someone do
`;

export function makeFixtureVault(dir: string): void {
  const write = (rel: string, content: string) => {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  };
  write('Lessons/2025/2025-06.md', LESSON);
  write('Vocabulary/Quartet-1/Quartet-L05.md', QUARTET);
  write('Vocabulary/Genki/Genki-L08.md', GENKI);
  write('Vocabulary/Genki/Genki.md', GENKI_INDEX);
  write('Grammar/Causative.md', GRAMMAR);
  write('_meta-notes.md', '# should be skipped');
}

const TOFUGU_INDEX = {
  source: 'tofugu', total_points: 2,
  grammar_points: [
    {
      id: 1, title: 'て Form',
      description: 'The て form links actions, events, and states.',
      categories: ['Verb Form'], url: 'https://www.tofugu.com/japanese-grammar/te-form/',
      slug: 'te-form',
    },
    {
      id: 2, title: 'Adjective さ (Objective Nouns)',
      description: 'Adding 〜さ to an adjective turns it into a noun.',
      categories: ['Adjective Form'],
      url: 'https://www.tofugu.com/japanese-grammar/adjective-suffix-sa/',
      slug: 'adjective-suffix-sa',
    },
  ],
};

const CUSTOM_INDEX = {
  grammar_points: [
    {
      id: 1001, title: '〜てしまう・〜ちゃう',
      description: '〜てしまう shows an action is completely finished, often with regret.',
      categories: ['Verb Form'], slug: 'te-shimau', source: 'lessons', jlptLevel: 'N4',
    },
    {
      id: 1002, title: '〜させる (Causative)',
      description: 'The causative form: to make or let someone do something.',
      categories: ['Verb Form'], slug: 'saseru', source: 'lessons', jlptLevel: 'N4',
    },
  ],
};

const CONTENT_TE_SHIMAU = {
  title: '〜てしまう・〜ちゃう', slug: 'te-shimau', categories: ['Verb Form'],
  description: '〜てしまう shows an action is completely finished, often with regret.',
  content: [
    { type: 'heading', level: 2, id: 'the-basics', text: 'The Basics' },
    { type: 'paragraph', text: '食（た）べてしまった means "ended up eating."' },
    { type: 'formula', text: 'て form ＋ しまう' },
    { type: 'example', japanese: '全部（ぜんぶ）食（た）べてしまった。', english: 'I ate it all (oops).' },
  ],
  examples: [{ japanese: 'て form ＋ しまう', english: '', type: 'formula' }],
};

export function makeGrammarFixture(dir: string): void {
  const write = (rel: string, data: unknown) => {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data));
  };
  write('tofugu_grammar_complete.json', TOFUGU_INDEX);
  write('custom_grammar.json', CUSTOM_INDEX);
  write('grammar_content/te-shimau.json', CONTENT_TE_SHIMAU);
  write('grammar_content/te-form.json', {
    ...CONTENT_TE_SHIMAU, title: 'て Form', slug: 'te-form',
    description: 'The て form links actions, events, and states.',
  });
  write('grammar_content/saseru.json', {
    ...CONTENT_TE_SHIMAU, title: '〜させる (Causative)', slug: 'saseru',
    description: 'The causative form: to make or let someone do something.',
  });
}
