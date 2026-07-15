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
