# Japanese Learning Electron App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A double-clickable macOS app ("Japanese Learning") that unifies the vocab app (Hono server + SQLite index over the Obsidian vault) and the grammar app (Tofugu + custom grammar-point JSON) into one desktop app with a Claude-Desktop-style lifecycle.

**Architecture:** The existing Node server stays a standalone process; a thin Electron shell (`electron/`, ~200 lines) spawns it via `utilityProcess`, waits for a ready message, and opens a `BrowserWindow` at `http://127.0.0.1:<port>`. Grammar JSON is indexed into SQLite at startup for unified search; detail content is read from disk per request. The React UI gains a Grammar reference section and a wide-window master–detail layout.

**Tech Stack:** TypeScript, Hono, better-sqlite3, chokidar, React 19, Vite, Electron, esbuild (server/shell bundling), electron-builder, vitest.

**Repo:** `/Users/nhattran/Documents/projects/japanese-learning-elec-app` (remote `https://github.com/nhatmobile1/japanese-learning-elec-app.git`). All commands run from this directory unless stated otherwise.

**Spec:** `docs/superpowers/specs/2026-07-15-japanese-learning-elec-app-design.md`

## Global Constraints

- Server binds `127.0.0.1` by default; port default `3456`; `HOST` env opt-in for other binds (Tailscale flow must keep working).
- Vault path (read-only): `/Users/nhattran/documents/obsidian-main/nhat-mind/efforts/japanese-learning`. Never write to it.
- Grammar data (read-only): `/Users/nhattran/Documents/projects/japanese-grammar-app/data`. Never write to it.
- IME guards `isComposing || keyCode === 229` must survive every keyboard-handler edit.
- New UI must reuse existing CSS custom properties (`--accent`, `--muted`, `--bg`, etc.) — no new hard-coded colors.
- App name **Japanese Learning**, bundle id **com.nhattran.japanese-learning**; user config at `~/Library/Application Support/japanese-learning-app/config.json`.
- Env vars override config-file values, which override defaults.
- Cross-linking between vault notes and reference points must never show a wrong link — unsure = no link.
- After every task: `npm test` and `npm run typecheck` pass. Commit at each task's final step.
- Runtime `dependencies` in package.json must end at exactly `{ better-sqlite3 }` after Task 14 (everything else is bundled by esbuild/vite and belongs in devDependencies).

---

### Task 1: Seed the repo from japanese-vocab-app

**Files:**
- Create: `src/`, `web/`, `tests/`, `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `README.md` (all copied)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a green baseline — every later task edits these copied files. Key modules later tasks import: `src/db.ts` (`openDb`), `src/app.ts` (`createApp(db)`), `src/search.ts` (`search(db, q, kind)`), `src/lib/japanese.ts` (`foldForSearch`, `normalizeTerm`), `tests/fixture.ts` (`makeFixtureVault(dir)`).

- [ ] **Step 1: Copy the source tree**

```bash
cd /Users/nhattran/Documents/projects/japanese-learning-elec-app
rsync -a \
  --exclude node_modules --exclude data --exclude 'web/dist' \
  --exclude .git --exclude docs --exclude .superpowers \
  /Users/nhattran/Documents/projects/japanese-vocab-app/ ./
```

Expected: `src/`, `web/`, `tests/`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `README.md` now exist here; `docs/` still contains only this project's spec/plan.

- [ ] **Step 2: Rename the package**

In `package.json` change only the name line:

```json
  "name": "japanese-learning-elec-app",
```

- [ ] **Step 3: Install and verify the baseline is green**

```bash
npm install
npm test
npm run typecheck
```

Expected: all existing suites pass (parser, indexer, search, app, japanese lib); typecheck clean. If `npm test` fails here, stop — the copy is broken; do not proceed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: seed server, web UI, and tests from japanese-vocab-app"
```

---

### Task 2: Config loader with config.json support

**Files:**
- Modify: `src/config.ts`
- Test: `src/config.test.ts` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  ```ts
  export interface AppConfig {
    vaultPath: string;
    dbPath: string;
    port: number;
    host: string;
    grammarDataPath: string;      // primary grammar JSON dir
    grammarFallbackPath: string | null; // bundled copy, set by the shell
    webDistPath: string;          // static UI dir served by the server
  }
  export interface FileConfig { vaultPath?: string; dbPath?: string; port?: number; host?: string; grammarDataPath?: string; }
  export function loadConfig(env: Record<string, string | undefined>, fileCfg?: FileConfig): AppConfig
  export const config: AppConfig  // loadConfig(process.env, <parsed APP_DATA_DIR/config.json or {}>)
  ```
  Precedence: env var > file config > default. The Electron shell (Task 12) sets `APP_DATA_DIR`, `GRAMMAR_FALLBACK_PATH`, `WEB_DIST` in the child env.

- [ ] **Step 1: Write the failing test**

Create `src/config.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  test('defaults when env and file are empty', () => {
    const c = loadConfig({});
    expect(c.port).toBe(3456);
    expect(c.host).toBe('127.0.0.1');
    expect(c.dbPath).toBe('data/vocab.db');
    expect(c.webDistPath).toBe('./web/dist');
    expect(c.grammarDataPath).toBe(
      '/Users/nhattran/Documents/projects/japanese-grammar-app/data',
    );
    expect(c.grammarFallbackPath).toBeNull();
  });

  test('file config beats defaults, env beats file', () => {
    const c = loadConfig(
      { PORT: '4000' },
      { port: 3999, vaultPath: '/tmp/vault-from-file' },
    );
    expect(c.port).toBe(4000);
    expect(c.vaultPath).toBe('/tmp/vault-from-file');
  });

  test('APP_DATA_DIR moves the default dbPath into the data dir', () => {
    const c = loadConfig({ APP_DATA_DIR: '/tmp/appdata' });
    expect(c.dbPath).toBe(path.join('/tmp/appdata', 'vocab.db'));
  });

  test('readFileConfig-equivalent: config singleton tolerates a missing file', async () => {
    // config.ts must not throw at import time when APP_DATA_DIR has no config.json
    const mod = await import('./config.js');
    expect(mod.config.port).toBeTypeOf('number');
  });

  test('env GRAMMAR_FALLBACK_PATH and WEB_DIST are honored', () => {
    const c = loadConfig({ GRAMMAR_FALLBACK_PATH: '/tmp/gd', WEB_DIST: '/tmp/dist' });
    expect(c.grammarFallbackPath).toBe('/tmp/gd');
    expect(c.webDistPath).toBe('/tmp/dist');
  });

  test('malformed config.json is ignored, not fatal', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));
    fs.writeFileSync(path.join(dir, 'config.json'), '{not json');
    const c = loadConfig({ APP_DATA_DIR: dir });
    expect(c.port).toBe(3456);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/config.test.ts`
Expected: FAIL — `loadConfig` is not exported.

- [ ] **Step 3: Rewrite `src/config.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';

export interface AppConfig {
  vaultPath: string;
  dbPath: string;
  port: number;
  host: string;
  grammarDataPath: string;
  grammarFallbackPath: string | null;
  webDistPath: string;
}

export interface FileConfig {
  vaultPath?: string;
  dbPath?: string;
  port?: number;
  host?: string;
  grammarDataPath?: string;
}

function readFileConfig(appDataDir: string | undefined): FileConfig {
  if (!appDataDir) return {};
  try {
    return JSON.parse(
      fs.readFileSync(path.join(appDataDir, 'config.json'), 'utf8'),
    ) as FileConfig;
  } catch {
    return {}; // missing or malformed → defaults; never fatal
  }
}

export function loadConfig(
  env: Record<string, string | undefined>,
  fileCfg?: FileConfig,
): AppConfig {
  const file = fileCfg ?? readFileConfig(env.APP_DATA_DIR);
  return {
    vaultPath:
      env.VAULT_PATH ??
      file.vaultPath ??
      '/Users/nhattran/documents/obsidian-main/nhat-mind/efforts/japanese-learning',
    dbPath:
      env.DB_PATH ??
      file.dbPath ??
      (env.APP_DATA_DIR ? path.join(env.APP_DATA_DIR, 'vocab.db') : 'data/vocab.db'),
    port: Number(env.PORT ?? file.port ?? 3456),
    // Localhost-only by default: the vault is personal. Set HOST=0.0.0.0 (or a
    // Tailscale IP) deliberately to reach the app from other devices.
    host: env.HOST ?? file.host ?? '127.0.0.1',
    grammarDataPath:
      env.GRAMMAR_DATA_PATH ??
      file.grammarDataPath ??
      '/Users/nhattran/Documents/projects/japanese-grammar-app/data',
    grammarFallbackPath: env.GRAMMAR_FALLBACK_PATH ?? null,
    webDistPath: env.WEB_DIST ?? './web/dist',
  };
}

export const config: AppConfig = loadConfig(process.env);
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test && npm run typecheck`
Expected: PASS (all suites — `server.ts` still reads the same `config` fields it did before).

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/config.test.ts
git commit -m "feat: config loader with config.json support and grammar/webDist paths"
```

---

### Task 3: Grammar data loader + JLPT map

**Files:**
- Create: `src/grammar/types.ts`, `src/grammar/jlpt.ts`, `src/grammar/load.ts`
- Test: `src/grammar/load.test.ts`
- Modify: `tests/fixture.ts` (add `makeGrammarFixture`)

**Interfaces:**
- Consumes: `foldForSearch` is NOT needed here (loader returns raw data; folding happens in Task 4's indexer).
- Produces:
  ```ts
  // src/grammar/types.ts
  export interface GrammarPoint {
    slug: string; title: string; description: string;
    categories: string[]; source: 'tofugu' | 'lessons'; jlptLevel: string | null;
  }
  export interface GrammarContentBlock {
    type: 'heading' | 'paragraph' | 'formula' | 'example';
    text?: string; level?: number; id?: string;      // heading/paragraph/formula
    japanese?: string; english?: string;              // example
  }
  export interface GrammarContentFile {
    title: string; description: string; slug: string;
    categories: string[]; content: GrammarContentBlock[];
    examples: { japanese: string; english: string; type?: string }[];
  }
  // src/grammar/jlpt.ts
  export function jlptForTitle(title: string): string | null
  // src/grammar/load.ts
  export function resolveGrammarDataPath(primary: string, fallback: string | null): string | null
  export function loadGrammarPoints(dataPath: string): GrammarPoint[]
  export function loadGrammarContent(dataPath: string, slug: string): GrammarContentFile | null
  export const SLUG_RE: RegExp  // ^[a-z0-9-]+$
  ```

- [ ] **Step 1: Add the grammar fixture to `tests/fixture.ts`**

Append to `tests/fixture.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing test**

Create `src/grammar/load.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/grammar/load.test.ts`
Expected: FAIL — modules don't exist.

- [ ] **Step 4: Create `src/grammar/types.ts`**

Use exactly the interfaces from this task's **Produces** block above (copy them verbatim into the file).

- [ ] **Step 5: Create `src/grammar/jlpt.ts`**

Copy the `jlptLevels` object **verbatim** from
`/Users/nhattran/Documents/projects/japanese-grammar-app/index.html` lines 1488–1534
(the `const jlptLevels = { "N5": [...], "N4": [...], "N3": [...], "N2": [...], "N1": [] }` literal) into this structure:

```ts
// Ported from japanese-grammar-app/index.html — title → JLPT level for Tofugu
// points (custom points carry their own jlptLevel field).
const JLPT_LEVELS: Record<string, string[]> = {
  // ⟵ paste the five arrays here verbatim from index.html:1488-1534
};

const TITLE_TO_LEVEL = new Map<string, string>();
for (const [level, titles] of Object.entries(JLPT_LEVELS)) {
  for (const t of titles) TITLE_TO_LEVEL.set(t, level);
}

export function jlptForTitle(title: string): string | null {
  return TITLE_TO_LEVEL.get(title) ?? null;
}
```

Verify after pasting: `grep -c '"' src/grammar/jlpt.ts` should show well over 100 quoted titles, and the N3 array must contain `"Adjective さ (Objective Nouns)"` and the N5 array `"て Form"` (the tests depend on these two).

- [ ] **Step 6: Create `src/grammar/load.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { jlptForTitle } from './jlpt.js';
import type { GrammarContentFile, GrammarPoint } from './types.js';

export const SLUG_RE = /^[a-z0-9-]+$/;

interface RawPoint {
  title: string; description: string; categories?: string[];
  slug: string; source?: string; jlptLevel?: string;
}

export function resolveGrammarDataPath(
  primary: string,
  fallback: string | null,
): string | null {
  if (fs.existsSync(path.join(primary, 'tofugu_grammar_complete.json'))) return primary;
  if (fallback && fs.existsSync(path.join(fallback, 'tofugu_grammar_complete.json')))
    return fallback;
  return null;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function loadGrammarPoints(dataPath: string): GrammarPoint[] {
  const tofugu = readJson<{ grammar_points: RawPoint[] }>(
    path.join(dataPath, 'tofugu_grammar_complete.json'),
  ).grammar_points.map<GrammarPoint>((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    categories: p.categories ?? [],
    source: 'tofugu',
    jlptLevel: jlptForTitle(p.title),
  }));

  let custom: GrammarPoint[] = [];
  try {
    custom = readJson<{ grammar_points: RawPoint[] }>(
      path.join(dataPath, 'custom_grammar.json'),
    ).grammar_points.map<GrammarPoint>((p) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      categories: p.categories ?? [],
      source: 'lessons',
      jlptLevel: p.jlptLevel ?? null,
    }));
  } catch {
    // custom file is optional — Tofugu-only is a valid dataset
  }
  return [...tofugu, ...custom];
}

export function loadGrammarContent(
  dataPath: string,
  slug: string,
): GrammarContentFile | null {
  if (!SLUG_RE.test(slug)) return null;
  const file = path.join(dataPath, 'grammar_content', `${slug}.json`);
  try {
    return readJson<GrammarContentFile>(file);
  } catch {
    return null;
  }
}
```

- [ ] **Step 7: Run tests, verify pass**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/grammar tests/fixture.ts
git commit -m "feat: grammar data loader with JLPT title map and content reader"
```

---

### Task 4: Grammar table + indexer

**Files:**
- Modify: `src/db.ts`
- Create: `src/grammar/indexGrammar.ts`
- Test: `src/grammar/indexGrammar.test.ts`

**Interfaces:**
- Consumes: `openDb` (`src/db.ts`), `GrammarPoint` (Task 3), `foldForSearch` (`src/lib/japanese.ts`).
- Produces:
  ```ts
  // table grammar_points(slug PK, title, description, categories JSON, source,
  //                      jlpt_level, title_f, desc_f)
  export function indexGrammarPoints(db: Database.Database, points: GrammarPoint[]): number
  ```
  Rows store `title_f = foldForSearch(title)` and `desc_f = description.normalize('NFKC').toLowerCase()` for search (Task 6).

- [ ] **Step 1: Write the failing test**

Create `src/grammar/indexGrammar.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type Database from 'better-sqlite3';
import { openDb } from '../db.js';
import { makeGrammarFixture } from '../../tests/fixture.js';
import { loadGrammarPoints } from './load.js';
import { indexGrammarPoints } from './indexGrammar.js';

let dir: string;
let db: Database.Database;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grammar-idx-'));
  makeGrammarFixture(dir);
  db = openDb(':memory:');
});
afterAll(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('indexGrammarPoints', () => {
  test('inserts every point with folded search columns', () => {
    const n = indexGrammarPoints(db, loadGrammarPoints(dir));
    expect(n).toBe(4);
    const row = db
      .prepare('SELECT * FROM grammar_points WHERE slug = ?')
      .get('te-shimau') as { title_f: string; jlpt_level: string; categories: string };
    expect(row.title_f).toBe('〜てしまう・〜ちゃう'.normalize('NFKC').toLowerCase());
    expect(row.jlpt_level).toBe('N4');
    expect(JSON.parse(row.categories)).toEqual(['Verb Form']);
  });

  test('re-indexing replaces, never duplicates', () => {
    indexGrammarPoints(db, loadGrammarPoints(dir));
    const n = (db.prepare('SELECT COUNT(*) AS n FROM grammar_points').get() as { n: number }).n;
    expect(n).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/grammar/indexGrammar.test.ts`
Expected: FAIL — no such table / module.

- [ ] **Step 3: Add the table to `src/db.ts`**

Bump the version comment and constant:

```ts
// v3: added grammar_points (rebuild artifact — dropped and reindexed at startup).
const SCHEMA_VERSION = 3;
```

In `createSchema`, extend the migration drop (words logic unchanged):

```ts
  if (version < SCHEMA_VERSION) {
    db.exec('DROP TABLE IF EXISTS words; DROP TABLE IF EXISTS grammar_points;');
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }
```

Append to the `db.exec` schema string:

```sql
    CREATE TABLE IF NOT EXISTS grammar_points (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      categories TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('tofugu','lessons')),
      jlpt_level TEXT,
      title_f TEXT NOT NULL,
      desc_f TEXT NOT NULL
    );
```

- [ ] **Step 4: Create `src/grammar/indexGrammar.ts`**

```ts
import type Database from 'better-sqlite3';
import { foldForSearch } from '../lib/japanese.js';
import type { GrammarPoint } from './types.js';

/** Replace-all index of reference grammar points. Startup-only; cheap (~200 rows). */
export function indexGrammarPoints(
  db: Database.Database,
  points: GrammarPoint[],
): number {
  const ins = db.prepare(`
    INSERT INTO grammar_points (slug, title, description, categories, source, jlpt_level, title_f, desc_f)
    VALUES (@slug, @title, @description, @categories, @source, @jlptLevel, @titleF, @descF)
  `);
  db.transaction(() => {
    db.exec('DELETE FROM grammar_points');
    for (const p of points) {
      ins.run({
        slug: p.slug,
        title: p.title,
        description: p.description,
        categories: JSON.stringify(p.categories),
        source: p.source,
        jlptLevel: p.jlptLevel,
        titleF: foldForSearch(p.title),
        descF: p.description.normalize('NFKC').toLowerCase(),
      });
    }
  })();
  return points.length;
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test && npm run typecheck`
Expected: PASS (including all pre-existing suites — the schema addition must not break them).

- [ ] **Step 6: Commit**

```bash
git add src/db.ts src/grammar/indexGrammar.ts src/grammar/indexGrammar.test.ts
git commit -m "feat: grammar_points table and startup indexer (schema v3)"
```

---

### Task 5: Grammar API routes

**Files:**
- Modify: `src/app.ts`, `src/app.test.ts`
- Test: `src/app.test.ts`

**Interfaces:**
- Consumes: `loadGrammarContent`, `SLUG_RE` (Task 3); `grammar_points` table (Task 4).
- Produces:
  ```ts
  export interface AppOptions { grammarDataPath?: string | null }
  export function createApp(db: Database.Database, opts?: AppOptions): Hono
  // GET /api/grammar-points?level=N4&category=Verb%20Form
  //   → { total, results: [{ slug, title, description, categories: string[], source, jlptLevel }] }
  //   ordered by jlpt (N5..N1, null last) then title
  // GET /api/grammar-points/:slug
  //   → { point: {…same shape…}, content: GrammarContentFile, lessonNotes: [] }
  //   400 bad slug · 404 unknown · lessonNotes filled in Task 7
  ```
  `createApp(db)` with no opts stays valid (grammar routes 404) so existing tests/utilities don't break.

- [ ] **Step 1: Write the failing tests**

In `src/app.test.ts`, extend the setup to index grammar fixtures and pass the path:

```ts
// add imports
import { makeGrammarFixture } from '../tests/fixture.js';
import { loadGrammarPoints } from './grammar/load.js';
import { indexGrammarPoints } from './grammar/indexGrammar.js';

// in beforeAll, after indexVault(db, vault):
  grammarDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-grammar-'));
  makeGrammarFixture(grammarDir);
  indexGrammarPoints(db, loadGrammarPoints(grammarDir));
  app = createApp(db, { grammarDataPath: grammarDir });
// add `let grammarDir: string;` next to the other lets and rm it in afterAll
```

Append a new describe block:

```ts
describe('GET /api/grammar-points', () => {
  test('lists all points N5-first, null level last', async () => {
    const res = await app.request('/api/grammar-points');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      total: number;
      results: { slug: string; jlptLevel: string | null; categories: string[] }[];
    };
    expect(body.total).toBe(4);
    expect(body.results[0].jlptLevel).toBe('N5'); // て Form
    expect(body.results[0].categories).toEqual(['Verb Form']);
  });

  test('level and category filters', async () => {
    const res = await app.request('/api/grammar-points?level=N4');
    const body = (await res.json()) as { results: { slug: string }[] };
    expect(body.results.map((r) => r.slug).sort()).toEqual(['saseru', 'te-shimau']);

    const res2 = await app.request(
      '/api/grammar-points?category=' + encodeURIComponent('Adjective Form'),
    );
    const body2 = (await res2.json()) as { results: { slug: string }[] };
    expect(body2.results.map((r) => r.slug)).toEqual(['adjective-suffix-sa']);
  });

  test('detail returns point + content blocks', async () => {
    const res = await app.request('/api/grammar-points/te-shimau');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      point: { title: string; source: string };
      content: { content: { type: string }[] };
      lessonNotes: unknown[];
    };
    expect(body.point.title).toBe('〜てしまう・〜ちゃう');
    expect(body.content.content.some((b) => b.type === 'example')).toBe(true);
    expect(Array.isArray(body.lessonNotes)).toBe(true);
  });

  test('bad slug is 400, unknown slug is 404', async () => {
    expect((await app.request('/api/grammar-points/..%2F..%2Fetc')).status).toBe(400);
    expect((await app.request('/api/grammar-points/zzzz-none')).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/app.test.ts`
Expected: FAIL — 404s on the new routes.

- [ ] **Step 3: Implement the routes in `src/app.ts`**

Add imports and the options parameter:

```ts
import { loadGrammarContent, SLUG_RE } from './grammar/load.js';

export interface AppOptions {
  grammarDataPath?: string | null;
}

const JLPT_ORDER: Record<string, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };

interface GrammarRow {
  slug: string; title: string; description: string; categories: string;
  source: string; jlpt_level: string | null;
}

function grammarRowToResult(r: GrammarRow) {
  return {
    slug: r.slug,
    title: r.title,
    description: r.description,
    categories: JSON.parse(r.categories) as string[],
    source: r.source,
    jlptLevel: r.jlpt_level,
  };
}

export function createApp(db: Database.Database, opts: AppOptions = {}): Hono {
```

Inside `createApp`, before `return app;`:

```ts
  app.get('/api/grammar-points', (c) => {
    const level = c.req.query('level');
    const category = c.req.query('category');
    let rows = db
      .prepare('SELECT slug, title, description, categories, source, jlpt_level FROM grammar_points')
      .all() as GrammarRow[];
    if (level) rows = rows.filter((r) => r.jlpt_level === level);
    if (category)
      rows = rows.filter((r) => (JSON.parse(r.categories) as string[]).includes(category));
    rows.sort(
      (a, b) =>
        (JLPT_ORDER[a.jlpt_level ?? ''] ?? 9) - (JLPT_ORDER[b.jlpt_level ?? ''] ?? 9) ||
        a.title.localeCompare(b.title, 'ja'),
    );
    return c.json({ total: rows.length, results: rows.map(grammarRowToResult) });
  });

  app.get('/api/grammar-points/:slug', (c) => {
    const slug = c.req.param('slug');
    if (!SLUG_RE.test(slug)) return c.json({ error: 'bad slug' }, 400);
    const row = db
      .prepare('SELECT slug, title, description, categories, source, jlpt_level FROM grammar_points WHERE slug = ?')
      .get(slug) as GrammarRow | undefined;
    if (!row) return c.json({ error: 'not found' }, 404);
    const content = opts.grammarDataPath
      ? loadGrammarContent(opts.grammarDataPath, slug)
      : null;
    return c.json({ point: grammarRowToResult(row), content, lessonNotes: [] });
  });
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.ts src/app.test.ts
git commit -m "feat: /api/grammar-points list and detail routes"
```

---

### Task 6: Reference points in unified search

**Files:**
- Modify: `src/search.ts`
- Test: `src/search.test.ts`

**Interfaces:**
- Consumes: `grammar_points` table (Task 4), `foldForSearch`.
- Produces: `SearchResultWord` gains `slug?: string`; grammar-point hits appear in `search()` output with `kind: 'grammar-point'`, `normTerm: null`, `sources: [{ sourceType: 'reference', sourceRef: 'Tofugu' | 'Custom' }]`. Included only when `kind` is `'all'` or `'grammar'`. The web UI (Tasks 9–10) keys off `kind === 'grammar-point'` and `slug`.

- [ ] **Step 1: Write the failing tests**

`src/search.test.ts` builds its DB with `openDb(':memory:')` + `indexVault` in a `beforeAll`. Extend it exactly like app.test.ts:

```ts
// add imports
import { makeGrammarFixture } from '../tests/fixture.js';
import { loadGrammarPoints } from './grammar/load.js';
import { indexGrammarPoints } from './grammar/indexGrammar.js';

// add next to the other lets
let grammarDir: string;

// at the end of beforeAll:
  grammarDir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-grammar-'));
  makeGrammarFixture(grammarDir);
  indexGrammarPoints(db, loadGrammarPoints(grammarDir));

// in afterAll:
  fs.rmSync(grammarDir, { recursive: true, force: true });
```

Then append:

```ts
describe('grammar-point search', () => {
  test('Japanese query finds a reference point', () => {
    const hits = search(db, 'てしまう', 'all');
    const gp = hits.find((r) => r.kind === 'grammar-point');
    expect(gp).toBeDefined();
    expect(gp!.slug).toBe('te-shimau');
    expect(gp!.term).toBe('〜てしまう・〜ちゃう');
    expect(gp!.sources).toEqual([{ sourceType: 'reference', sourceRef: 'Custom' }]);
  });

  test('romaji slug query finds a reference point', () => {
    const hits = search(db, 'shimau', 'all');
    expect(hits.some((r) => r.kind === 'grammar-point' && r.slug === 'te-shimau')).toBe(true);
  });

  test('English description query finds a reference point', () => {
    const hits = search(db, 'completely finished', 'all');
    expect(hits.some((r) => r.slug === 'te-shimau')).toBe(true);
  });

  test('kind=vocab excludes reference points, kind=grammar includes them', () => {
    expect(search(db, 'てしまう', 'vocab').some((r) => r.kind === 'grammar-point')).toBe(false);
    expect(search(db, 'てしまう', 'grammar').some((r) => r.kind === 'grammar-point')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/search.test.ts`
Expected: FAIL — no grammar-point results.

- [ ] **Step 3: Implement in `src/search.ts`**

Add `slug?: string;` to the exported `SearchResultWord` interface. Add below `scoreRow`:

```ts
interface GrammarPointRow {
  slug: string; title: string; description: string;
  source: string; title_f: string; desc_f: string;
}

function scoreGrammarPoint(r: GrammarPointRow, qJa: string, qEn: string): number {
  if (r.title_f === qJa) return 1000;
  if (r.title_f.startsWith(qJa) || r.title_f.startsWith('〜' + qJa)) return 600;
  if (r.slug === qEn) return 600;
  if (r.slug.includes(qEn)) return 450;
  if (r.title_f.includes(qJa)) return 400;
  return 200; // matched in description
}

function searchGrammarPoints(
  db: Database.Database,
  qJa: string,
  qEn: string,
): SearchResultWord[] {
  const likeJa = `%${escapeLike(qJa)}%`;
  const likeEn = `%${escapeLike(qEn)}%`;
  const rows = db
    .prepare(
      `SELECT slug, title, description, source, title_f, desc_f FROM grammar_points
       WHERE title_f LIKE @ja ESCAPE '\\'
          OR slug LIKE @en ESCAPE '\\'
          OR desc_f LIKE @en ESCAPE '\\'`,
    )
    .all({ ja: likeJa, en: likeEn }) as GrammarPointRow[];
  return rows.map((r) => ({
    normTerm: null,
    term: r.title,
    reading: null,
    gloss: r.description,
    kind: 'grammar-point',
    occurrenceCount: 0,
    lessonCount: 0,
    sources: [
      { sourceType: 'reference', sourceRef: r.source === 'lessons' ? 'Custom' : 'Tofugu' },
    ],
    score: scoreGrammarPoint(r, qJa, qEn),
    slug: r.slug,
  }));
}
```

In `search()`, merge before the final sort — replace the `return [...best.values()]…` expression with:

```ts
  const wordResults = [...best.values()].map(({ row, score }) => ({
    normTerm: row.norm_term,
    term: row.w_term ?? row.term ?? row.raw,
    reading: row.w_reading ?? row.reading,
    gloss: row.w_gloss ?? row.gloss,
    kind: row.kind,
    occurrenceCount: row.occurrence_count ?? 1,
    lessonCount: row.lesson_count ?? (row.source_type === 'lesson' ? 1 : 0),
    sources: row.sources
      ? (JSON.parse(row.sources) as { sourceType: string; sourceRef: string }[])
      : [{ sourceType: row.source_type, sourceRef: row.source_ref }],
    score,
  }));

  const grammarResults =
    kind === 'all' || kind === 'grammar' ? searchGrammarPoints(db, qJa, qEn) : [];

  return [...wordResults, ...grammarResults]
    .sort((a, b) => b.score - a.score || b.lessonCount - a.lessonCount)
    .slice(0, 50);
```

(The `.sort(...).slice(0, 50)` previously applied to word results alone now applies to the merged list — delete the old sort/slice/map chain.)

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test && npm run typecheck`
Expected: PASS, including the pre-existing search suite (ranking of word results must be unchanged when no grammar points match).

- [ ] **Step 5: Commit**

```bash
git add src/search.ts src/search.test.ts
git commit -m "feat: reference grammar points join unified search results"
```

---

### Task 7: Vault-note ↔ reference-point matcher + cross-link wiring

**Files:**
- Create: `src/grammar/match.ts`
- Test: `src/grammar/match.test.ts`
- Modify: `src/app.ts`, `src/app.test.ts`

**Interfaces:**
- Consumes: `normalizeTerm`, `foldForSearch` (`src/lib/japanese.ts`); `words` + `grammar_points` tables.
- Produces:
  ```ts
  export function patternTokens(title: string): string[]
  export function titleMatchesTerm(pointTitle: string, vaultNormTerm: string): boolean
  ```
  API additions:
  - `/api/grammar-points/:slug` → `lessonNotes: { normTerm, term, reading, gloss, kind }[]` (matching vault grammar words).
  - `/api/word/:normTerm` → adds `grammarRefs: { slug, title, jlptLevel }[]`.

- [ ] **Step 1: Write the failing matcher tests**

Create `src/grammar/match.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { patternTokens, titleMatchesTerm } from './match.js';

describe('patternTokens', () => {
  test('splits on ・ and strips 〜 and ASCII parentheticals', () => {
    expect(patternTokens('〜てしまう・〜ちゃう')).toEqual(['てしまう', 'ちゃう']);
    expect(patternTokens('〜させる (Causative)')).toEqual(['させる']);
    expect(patternTokens('て Form')).toEqual(['て']);
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
  ];
  for (const [title, term, expected] of cases) {
    test(`${title} vs ${term} → ${expected}`, () => {
      expect(titleMatchesTerm(title, term)).toBe(expected);
    });
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/grammar/match.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `src/grammar/match.ts`**

```ts
import { foldForSearch } from '../lib/japanese.js';

/**
 * Japanese pattern tokens from a reference-point title.
 * "〜てしまう・〜ちゃう" → ["てしまう","ちゃう"];  "〜させる (Causative)" → ["させる"].
 */
export function patternTokens(title: string): string[] {
  return title
    .replace(/\([^)]*\)/g, '') // ASCII parenthetical (English annotation)
    .split(/[・／\/]/)
    .map((t) => foldForSearch(t.replace(/^[～〜]+|[～〜]+$/g, '')))
    // Drop English-only fragments ("form") and empties; keep Japanese tokens.
    .map((t) => t.replace(/[a-z0-9\s'-]+/g, ''))
    .filter(Boolean);
}

/**
 * Conservative match: a vault term links to a reference point only when the
 * normalized term EQUALS one of the title's pattern tokens of length ≥ 2.
 * Unsure = false — the UI must never show a wrong link.
 */
export function titleMatchesTerm(pointTitle: string, vaultNormTerm: string): boolean {
  const term = foldForSearch(vaultNormTerm);
  if (term.length < 2) return false;
  return patternTokens(pointTitle).some((tok) => tok.length >= 2 && tok === term);
}
```

Run: `npx vitest run src/grammar/match.test.ts` — adjust nothing else until this passes exactly as tabled.

- [ ] **Step 4: Write failing API cross-link tests**

Append to the grammar describe block in `src/app.test.ts` (the vault fixture has a grammar note `〜させる`; the grammar fixture has point `saseru` titled `〜させる (Causative)`):

```ts
  test('detail lists matching vault notes as lessonNotes', async () => {
    const body = (await (await app.request('/api/grammar-points/saseru')).json()) as {
      lessonNotes: { normTerm: string; term: string }[];
    };
    expect(body.lessonNotes.map((n) => n.normTerm)).toEqual(['させる']);
  });

  test('detail with no matching vault note has empty lessonNotes', async () => {
    const body = (await (await app.request('/api/grammar-points/te-form')).json()) as {
      lessonNotes: unknown[];
    };
    expect(body.lessonNotes).toEqual([]);
  });

  test('/api/word gains grammarRefs for a matching reference point', async () => {
    const body = (await (
      await app.request(`/api/word/${encodeURIComponent('させる')}`)
    ).json()) as { grammarRefs: { slug: string; title: string }[] };
    expect(body.grammarRefs.map((g) => g.slug)).toEqual(['saseru']);
  });

  test('/api/word without a reference match has empty grammarRefs', async () => {
    const body = (await (
      await app.request(`/api/word/${encodeURIComponent('還付')}`)
    ).json()) as { grammarRefs: unknown[] };
    expect(body.grammarRefs).toEqual([]);
  });
```

Run: `npx vitest run src/app.test.ts` — expected: FAIL.

- [ ] **Step 5: Wire the matcher into `src/app.ts`**

Import: `import { titleMatchesTerm } from './grammar/match.js';`

In the `:slug` route, replace `lessonNotes: []` with a computed list (add above the return):

```ts
    const vaultGrammar = db
      .prepare("SELECT norm_term, term, reading, gloss, kind FROM words WHERE kind = 'grammar'")
      .all() as { norm_term: string; term: string; reading: string | null; gloss: string | null; kind: string }[];
    const lessonNotes = vaultGrammar
      .filter((w) => titleMatchesTerm(row.title, w.norm_term))
      .map((w) => ({
        normTerm: w.norm_term, term: w.term, reading: w.reading, gloss: w.gloss, kind: w.kind,
      }));
    return c.json({ point: grammarRowToResult(row), content, lessonNotes });
```

In `/api/word/:normTerm`, before the final `return c.json({ word: … })`:

```ts
    const allPoints = db
      .prepare('SELECT slug, title, jlpt_level FROM grammar_points')
      .all() as { slug: string; title: string; jlpt_level: string | null }[];
    const grammarRefs = allPoints
      .filter((p) => titleMatchesTerm(p.title, normTerm))
      .map((p) => ({ slug: p.slug, title: p.title, jlptLevel: p.jlpt_level }));

    return c.json({ word: word ?? null, occurrences, mentions, grammarRefs });
```

- [ ] **Step 6: Run tests, verify pass**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/grammar/match.ts src/grammar/match.test.ts src/app.ts src/app.test.ts
git commit -m "feat: conservative vault-note to reference-point cross-linking"
```

---

### Task 8: Server startup — grammar indexing, port retry, ready signal

**Files:**
- Create: `src/listen.ts`
- Test: `src/listen.test.ts`
- Modify: `src/server.ts`

**Interfaces:**
- Consumes: everything above; `config` fields from Task 2.
- Produces:
  ```ts
  // src/listen.ts
  export function listenWithRetry(
    fetch: (req: Request) => Response | Promise<Response>,
    host: string, basePort: number, attempts?: number, // default 5
  ): Promise<{ port: number; server: ServerType }>
  ```
  On success `server.ts` calls `process.parentPort?.postMessage({ type: 'ready', port })` — the contract Task 12's shell waits on. `server.ts` becomes `async function main()` (esbuild CJS output forbids top-level await).

- [ ] **Step 1: Write the failing test**

Create `src/listen.test.ts`:

```ts
import net from 'node:net';
import { afterAll, describe, expect, test } from 'vitest';
import { Hono } from 'hono';
import { listenWithRetry } from './listen.js';

const closers: (() => void)[] = [];
afterAll(() => closers.forEach((c) => c()));

describe('listenWithRetry', () => {
  test('binds the base port when free', async () => {
    const app = new Hono().get('/', (c) => c.text('ok'));
    const { port, server } = await listenWithRetry(app.fetch, '127.0.0.1', 0, 1);
    closers.push(() => server.close());
    expect(port).toBeGreaterThan(0);
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(await res.text()).toBe('ok');
  });

  test('falls through to the next port when taken', async () => {
    const blocker = net.createServer().listen(0, '127.0.0.1');
    await new Promise((r) => blocker.once('listening', r));
    const taken = (blocker.address() as net.AddressInfo).port;
    closers.push(() => blocker.close());

    const app = new Hono().get('/', (c) => c.text('ok'));
    const { port, server } = await listenWithRetry(app.fetch, '127.0.0.1', taken, 5);
    closers.push(() => server.close());
    expect(port).toBe(taken + 1);
  });

  test('rejects when every attempt is taken', async () => {
    const blocker = net.createServer().listen(0, '127.0.0.1');
    await new Promise((r) => blocker.once('listening', r));
    const taken = (blocker.address() as net.AddressInfo).port;
    closers.push(() => blocker.close());

    const app = new Hono();
    await expect(listenWithRetry(app.fetch, '127.0.0.1', taken, 1)).rejects.toThrow();
  });
});
```

Note: `listenWithRetry(fetch, host, 0, 1)` uses port 0 (OS-assigned) — resolve with the *actual* bound port from `server.address()`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/listen.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `src/listen.ts`**

```ts
import type { AddressInfo } from 'node:net';
import { serve, type ServerType } from '@hono/node-server';

/** Try basePort, basePort+1, … on EADDRINUSE. Resolves with the actual bound port. */
export function listenWithRetry(
  fetch: (req: Request) => Response | Promise<Response>,
  host: string,
  basePort: number,
  attempts = 5,
): Promise<{ port: number; server: ServerType }> {
  return new Promise((resolve, reject) => {
    const tryPort = (i: number) => {
      const server = serve({ fetch, port: basePort + i, hostname: host });
      server.once('error', (err: NodeJS.ErrnoException) => {
        server.close();
        if (err.code === 'EADDRINUSE' && i + 1 < attempts) tryPort(i + 1);
        else reject(err);
      });
      server.once('listening', () => {
        resolve({ port: (server.address() as AddressInfo).port, server });
      });
    };
    tryPort(0);
  });
}
```

Run: `npx vitest run src/listen.test.ts` — expected: PASS.

- [ ] **Step 4: Rewrite `src/server.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.js';
import { config } from './config.js';
import { openDb } from './db.js';
import { indexGrammarPoints } from './grammar/indexGrammar.js';
import { loadGrammarPoints, resolveGrammarDataPath } from './grammar/load.js';
import { indexVault, rebuildWords } from './indexer.js';
import { listenWithRetry } from './listen.js';
import { startWatcher } from './watcher.js';

// Under Electron's utilityProcess this exists; under plain node it doesn't.
const parentPort = (process as unknown as { parentPort?: { postMessage(m: unknown): void } })
  .parentPort;

async function main(): Promise<void> {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = openDb(config.dbPath);

  const vaultExists = fs.existsSync(config.vaultPath);
  if (!vaultExists) {
    const existing = (db.prepare('SELECT COUNT(*) AS n FROM entries').get() as { n: number }).n;
    if (existing > 0) {
      console.warn(`[server] vault not found at ${config.vaultPath} — serving stale index (${existing} entries)`);
      rebuildWords(db);
    } else {
      console.error(`[server] vault not found at ${config.vaultPath} and no existing index. Set VAULT_PATH.`);
      process.exit(1);
    }
  } else {
    const t0 = Date.now();
    const { files, entries } = indexVault(db, config.vaultPath);
    console.log(`[server] indexed ${entries} entries from ${files} files in ${Date.now() - t0}ms`);
    startWatcher(db, config.vaultPath);
  }

  const grammarPath = resolveGrammarDataPath(config.grammarDataPath, config.grammarFallbackPath);
  if (grammarPath) {
    const n = indexGrammarPoints(db, loadGrammarPoints(grammarPath));
    console.log(`[server] indexed ${n} grammar points from ${grammarPath}`);
  } else {
    console.warn(`[server] grammar data not found at ${config.grammarDataPath} (no fallback) — grammar section will be empty`);
  }

  const app = createApp(db, { grammarDataPath: grammarPath });
  app.get('/api/*', (c) => c.json({ error: 'not found' }, 404));
  // @hono/node-server's serveStatic treats root/path as cwd-relative; the shell
  // passes an absolute WEB_DIST, so convert (path.relative handles both cases).
  const webDist = path.relative(process.cwd(), path.resolve(config.webDistPath)) || '.';
  app.use('/*', serveStatic({ root: webDist }));
  app.get('*', serveStatic({ path: path.join(webDist, 'index.html') }));

  const { port } = await listenWithRetry(app.fetch, config.host, config.port);
  console.log(`[server] http://localhost:${port} (bound to ${config.host})`);
  if (config.host !== '127.0.0.1') {
    console.warn('[server] non-localhost bind: the app is reachable by other devices on this network');
  }
  parentPort?.postMessage({ type: 'ready', port });
}

main().catch((err) => {
  console.error('[server] fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 5: Verify the dev flow end to end**

```bash
npm test && npm run typecheck
npm run build
npx tsx src/server.ts &
sleep 3
curl -s http://127.0.0.1:3456/api/status
curl -s http://127.0.0.1:3456/api/grammar-points | head -c 300
kill %1
```

Expected: status shows real vault counts (~9,4xx words); grammar-points returns 173 results (`"total":173`) read live from the sibling repo.

- [ ] **Step 6: Commit**

```bash
git add src/listen.ts src/listen.test.ts src/server.ts
git commit -m "feat: startup grammar indexing, port retry, and utilityProcess ready signal"
```

---

### Task 9: Web — Grammar reference browse view

**Files:**
- Create: `web/src/GrammarBrowse.tsx`
- Modify: `web/src/types.ts`, `web/src/api.ts`, `web/src/App.tsx`, `web/src/styles.css`

**Interfaces:**
- Consumes: `/api/grammar-points` (Task 5).
- Produces:
  ```ts
  // web/src/types.ts additions
  export interface GrammarPointSummary {
    slug: string; title: string; description: string;
    categories: string[]; source: string; jlptLevel: string | null;
  }
  // SearchResultWord gains: slug?: string
  // web/src/api.ts
  export async function grammarPointsApi(signal?: AbortSignal): Promise<GrammarPointSummary[]>
  // web/src/GrammarBrowse.tsx
  export default function GrammarBrowse({ onOpen }: { onOpen: (slug: string) => void })
  ```
  App state additions (used by Task 10): `grammarSub: 'ref' | 'notes'`, and `view` union replacing `detail` — `{ type: 'word'; word: SearchResultWord } | { type: 'grammar'; slug: string } | null`.

No unit tests for React components (per spec §7 the UI is covered by the manual desktop pass); `npm run typecheck` gates every step.

- [ ] **Step 1: Add types and API helper**

In `web/src/types.ts` add `slug?: string;` to `SearchResultWord`, add `grammarRefs?: { slug: string; title: string; jlptLevel: string | null }[]` to `WordResponse`, and append the `GrammarPointSummary` interface above. In `web/src/api.ts` append:

```ts
export async function grammarPointsApi(signal?: AbortSignal): Promise<GrammarPointSummary[]> {
  const res = await fetch('/api/grammar-points', { signal });
  if (!res.ok) throw new Error(`grammar points failed: ${res.status}`);
  return ((await res.json()) as { results: GrammarPointSummary[] }).results;
}
```

(and add `GrammarPointSummary` to the type import).

- [ ] **Step 2: Create `web/src/GrammarBrowse.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { grammarPointsApi } from './api';
import type { GrammarPointSummary } from './types';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', null] as const;

export default function GrammarBrowse({ onOpen }: { onOpen: (slug: string) => void }) {
  const [points, setPoints] = useState<GrammarPointSummary[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    grammarPointsApi(ctrl.signal).then(setPoints, (err) => {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError('Couldn’t load grammar points — is the server running?');
      }
    });
    return () => ctrl.abort();
  }, []);

  const categories = useMemo(
    () => [...new Set(points.flatMap((p) => p.categories))].sort(),
    [points],
  );
  const filtered = category ? points.filter((p) => p.categories.includes(category)) : points;

  if (error) return <p className="error">{error}</p>;

  return (
    <div className="grammar-browse">
      <nav className="sort-tabs category-chips" aria-label="Category filter">
        <button
          type="button"
          className={category === null ? 'tab active' : 'tab'}
          onClick={() => setCategory(null)}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            type="button"
            key={c}
            className={category === c ? 'tab active' : 'tab'}
            onClick={() => setCategory(category === c ? null : c)}
          >
            {c}
          </button>
        ))}
      </nav>
      {LEVELS.map((level) => {
        const group = filtered.filter((p) => p.jlptLevel === level);
        if (group.length === 0) return null;
        return (
          <section key={level ?? 'other'} className="jlpt-group">
            <h2 className="jlpt-heading">{level ?? 'その他'}</h2>
            <ul className="results">
              {group.map((p) => (
                <li key={p.slug} className="result" onClick={() => onOpen(p.slug)}>
                  <span className="term">{p.title}</span>
                  <span className="gloss">{p.description}</span>
                  <span className="badges">
                    <span className="badge ref">参 {p.source === 'lessons' ? 'Custom' : 'Tofugu'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Wire into `web/src/App.tsx`**

1. Replace the `detail` state with the view union and add the sub-tab state:

```tsx
type OpenView =
  | { type: 'word'; word: SearchResultWord }
  | { type: 'grammar'; slug: string }
  | null;

// inside App():
const [view, setView] = useState<OpenView>(null);
const [grammarSub, setGrammarSub] = useState<'ref' | 'notes'>('ref');
```

Every previous `setDetail(r)` becomes:

```tsx
const openResult = (r: SearchResultWord) => {
  setHover(null);
  setView(
    r.kind === 'grammar-point' && r.slug
      ? { type: 'grammar', slug: r.slug }
      : { type: 'word', word: r },
  );
};
```

`detail ? <WordDetail …/> : …` becomes `view ? …` — for this task render `view.type === 'word' ? <WordDetail key={view.word.normTerm ?? view.word.term} result={view.word} onBack={() => setView(null)} /> : <p className="empty">grammar detail arrives in the next task</p>` (Task 10 replaces the placeholder). Esc handler: `else if (view) setView(null);` replaces the detail branch.

2. Grammar sub-tabs — in the `browsing && kind !== 'sentence'` sort-tab block, when `kind === 'grammar'` render sub-tabs *instead of* the word sorts:

```tsx
{browsing && kind === 'grammar' && (
  <nav className="sort-tabs" aria-label="Grammar source">
    {(
      [
        { key: 'ref', label: '参考 Reference' },
        { key: 'notes', label: 'ノート My notes' },
      ] as const
    ).map((s) => (
      <button
        type="button"
        key={s.key}
        className={grammarSub === s.key ? 'tab active' : 'tab'}
        aria-pressed={grammarSub === s.key}
        onClick={() => setGrammarSub(s.key)}
      >
        {s.label}
      </button>
    ))}
  </nav>
)}
{browsing && kind !== 'sentence' && kind !== 'grammar' && (
  /* existing WORD_SORTS nav unchanged, minus the grammar-chapter filter special-case */
)}
```

3. Browse body: when `browsing && kind === 'grammar' && grammarSub === 'ref'`, render `<GrammarBrowse onOpen={(slug) => setView({ type: 'grammar', slug })} />` instead of the words list; `grammarSub === 'notes'` keeps the existing words list + load-more. The existing `browsing` effect must not fetch words while the Reference sub-tab is showing — first line of the effect body becomes:

```tsx
    if (!browsing || (kind === 'grammar' && grammarSub === 'ref')) return;
```

and the dependency array becomes `[browsing, kind, effectiveSort, grammarSub]` (so flipping to ノート triggers the fetch).

4. `WordRows` badge: inside the badges span, grammar-point rows show the reference mark — at the top of `sourceBadges` add:

```tsx
if (r.kind === 'grammar-point') {
  return r.sources.map((s) => ({ text: `参 ${s.sourceRef}`, tb: true }));
}
```

- [ ] **Step 4: CSS additions in `web/src/styles.css`**

```css
/* Grammar reference browse */
.jlpt-heading {
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  color: var(--muted);
  margin: 1.25rem 0 0.25rem;
  padding-left: 0.25rem;
}
.category-chips {
  flex-wrap: wrap;
  row-gap: 0.25rem;
}
.badge.ref {
  color: var(--accent);
  border-color: currentColor;
}
```

(Match the existing `.badge`/`.sort-tabs` declarations' property style — these extend them.)

- [ ] **Step 5: Verify by hand**

```bash
npm run typecheck && npm test
npm run dev
```

In the browser: Grammar tab shows 参考/ノート sub-tabs; Reference lists ~173 points grouped N5→N1 with category chips; My notes shows the old vault list; searching `てしまう` shows a 参-badged row. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "feat: grammar reference browse view with JLPT groups and sub-tabs"
```

---

### Task 10: Web — furigana renderer + grammar detail view + cross-links

**Files:**
- Create: `web/src/lib/furigana.ts`, `web/src/lib/furigana.test.ts`, `web/src/GrammarDetail.tsx`
- Modify: `vitest.config.ts`, `web/src/api.ts`, `web/src/types.ts`, `web/src/App.tsx`, `web/src/WordDetail.tsx`, `web/src/styles.css`

**Interfaces:**
- Consumes: `/api/grammar-points/:slug` (Tasks 5+7), `grammarRefs` on `/api/word` (Task 7).
- Produces:
  ```ts
  // web/src/lib/furigana.ts — pure, unit-tested
  export interface RubySegment { base: string; ruby?: string }
  export function parseFurigana(text: string): RubySegment[]
  // web/src/GrammarDetail.tsx
  export default function GrammarDetail(props: {
    slug: string;
    onBack: () => void;
    onOpenWord: (word: SearchResultWord) => void;
  })
  // web/src/WordDetail.tsx gains prop: onOpenGrammar?: (slug: string) => void
  ```

- [ ] **Step 1: Include web lib tests in vitest**

`vitest.config.ts`:

```ts
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'web/src/lib/**/*.test.ts'] },
});
```

- [ ] **Step 2: Write the failing furigana tests**

Create `web/src/lib/furigana.test.ts`:

```ts
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
```

Run: `npx vitest run web/src/lib/furigana.test.ts` — expected: FAIL.

- [ ] **Step 3: Create `web/src/lib/furigana.ts`**

Same character classes as `src/lib/japanese.ts` (duplicated deliberately — the web bundle must not import server code):

```ts
const KANJI_RUN = '[\\u3400-\\u4dbf\\u4e00-\\u9fff々〆]+';
const KANA_ONLY_RE = /^[ぁ-ゖァ-ヺー-ヾゝゞー・、。～]+$/;
const PAIR_RE = new RegExp(`(${KANJI_RUN})（([^（）]+)）`, 'g');

export interface RubySegment {
  base: string;
  ruby?: string;
}

/** Split 漢字（かな） furigana notation into ruby segments; leaves other text alone. */
export function parseFurigana(text: string): RubySegment[] {
  const out: RubySegment[] = [];
  let last = 0;
  for (const m of text.matchAll(PAIR_RE)) {
    if (!KANA_ONLY_RE.test(m[2])) continue; // （English） etc. — not furigana
    if (m.index > last) out.push({ base: text.slice(last, m.index) });
    out.push({ base: m[1], ruby: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ base: text.slice(last) });
  return out;
}
```

Run: `npx vitest run web/src/lib/furigana.test.ts` — expected: PASS.

- [ ] **Step 4: API helper + types**

`web/src/types.ts` — append:

```ts
export interface GrammarContentBlock {
  type: 'heading' | 'paragraph' | 'formula' | 'example';
  text?: string;
  level?: number;
  japanese?: string;
  english?: string;
}

export interface GrammarDetailResponse {
  point: GrammarPointSummary;
  content: { content: GrammarContentBlock[] } | null;
  lessonNotes: { normTerm: string; term: string; reading: string | null; gloss: string | null; kind: string }[];
}
```

`web/src/api.ts` — append:

```ts
export async function grammarPointApi(slug: string): Promise<GrammarDetailResponse> {
  const res = await fetch(`/api/grammar-points/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`grammar point failed: ${res.status}`);
  return (await res.json()) as GrammarDetailResponse;
}
```

- [ ] **Step 5: Create `web/src/GrammarDetail.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { grammarPointApi } from './api';
import { parseFurigana } from './lib/furigana';
import { PatternBand } from './PatternDefs';
import type { GrammarContentBlock, GrammarDetailResponse, SearchResultWord } from './types';

function Furigana({ text }: { text: string }) {
  return (
    <>
      {parseFurigana(text).map((seg, i) =>
        seg.ruby ? (
          <ruby key={i}>
            {seg.base}
            <rt>{seg.ruby}</rt>
          </ruby>
        ) : (
          <span key={i}>{seg.base}</span>
        ),
      )}
    </>
  );
}

function Block({ b }: { b: GrammarContentBlock }) {
  if (b.type === 'heading') {
    if (b.text === 'Table of Contents') return null; // scraped artifact, meaningless here
    return b.level === 2 ? <h2>{b.text}</h2> : <h3>{b.text}</h3>;
  }
  if (b.type === 'paragraph')
    return (
      <p className="grammar-para">
        <Furigana text={b.text ?? ''} />
      </p>
    );
  if (b.type === 'formula') return <p className="grammar-formula">{b.text}</p>;
  return (
    <div className="grammar-example">
      <p className="example-ja">
        <Furigana text={b.japanese ?? ''} />
      </p>
      {b.english && <p className="example-en">{b.english}</p>}
    </div>
  );
}

export default function GrammarDetail({
  slug,
  onBack,
  onOpenWord,
}: {
  slug: string;
  onBack: () => void;
  onOpenWord: (word: SearchResultWord) => void;
}) {
  const [data, setData] = useState<GrammarDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    grammarPointApi(slug).then(setData, () => setError('Could not load this grammar point.'));
  }, [slug]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <article className="word-detail" />;

  return (
    <article className="word-detail grammar-detail">
      <button className="back" onClick={onBack}>
        ← results
      </button>
      <h2 className="detail-term stamp">
        {data.point.title}
        {data.point.jlptLevel && <span className="badge ref jlpt">{data.point.jlptLevel}</span>}
      </h2>
      <PatternBand className="detail-band" />
      <p className="detail-gloss">{data.point.description}</p>

      {data.lessonNotes.length > 0 && (
        <section>
          <h2>From your lessons</h2>
          <ul>
            {data.lessonNotes.map((n) => (
              <li key={n.normTerm} className="occurrence lesson-note-link">
                <button
                  type="button"
                  className="linkish"
                  onClick={() =>
                    onOpenWord({
                      normTerm: n.normTerm, term: n.term, reading: n.reading,
                      gloss: n.gloss, kind: n.kind, occurrenceCount: 0, lessonCount: 0,
                      sources: [], score: 0,
                    })
                  }
                >
                  {n.term}
                  {n.gloss ? ` — ${n.gloss}` : ''}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.content?.content.map((b, i) => <Block key={i} b={b} />)}
    </article>
  );
}
```

- [ ] **Step 6: Wire routing + WordDetail backlink**

`web/src/App.tsx` — replace Task 9's placeholder branch:

```tsx
{view ? (
  view.type === 'word' ? (
    <WordDetail
      key={view.word.normTerm ?? view.word.term}
      result={view.word}
      onBack={() => setView(null)}
      onOpenGrammar={(slug) => setView({ type: 'grammar', slug })}
    />
  ) : (
    <GrammarDetail
      key={view.slug}
      slug={view.slug}
      onBack={() => setView(null)}
      onOpenWord={(word) => setView({ type: 'word', word })}
    />
  )
) : searching ? (
  …unchanged…
```

`web/src/WordDetail.tsx` — accept `onOpenGrammar?: (slug: string) => void` and, after the Mentions section, add:

```tsx
{data && data.grammarRefs && data.grammarRefs.length > 0 && onOpenGrammar && (
  <section>
    <h2>Reference</h2>
    <ul>
      {data.grammarRefs.map((g) => (
        <li key={g.slug} className="occurrence">
          <button type="button" className="linkish" onClick={() => onOpenGrammar(g.slug)}>
            参 {g.title}
            {g.jlptLevel ? ` · ${g.jlptLevel}` : ''}
          </button>
        </li>
      ))}
    </ul>
  </section>
)}
```

- [ ] **Step 7: CSS additions in `web/src/styles.css`**

```css
/* Grammar detail */
.grammar-detail ruby rt {
  font-size: 0.55em;
  color: var(--muted);
}
.grammar-formula {
  font-family: inherit;
  border: 1px solid var(--muted);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  display: inline-block;
  letter-spacing: 0.05em;
}
.grammar-example {
  margin: 0.75rem 0;
  padding-left: 0.75rem;
  border-left: 2px solid var(--accent);
}
.example-en {
  color: var(--muted);
  font-size: 0.9em;
}
.badge.jlpt {
  vertical-align: middle;
  margin-left: 0.5rem;
}
.linkish {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--accent);
  cursor: pointer;
}
.linkish:hover {
  text-decoration: underline;
}
```

- [ ] **Step 8: Verify**

```bash
npm test && npm run typecheck
npm run dev
```

Manual: open Grammar → Reference → て Form (full article with ruby furigana, formula boxes, examples); open 〜させる → "From your lessons" shows your vault note; click it → WordDetail; its Reference section links back. Search `shimau` → 参 row opens the detail. Esc walks back correctly.

- [ ] **Step 9: Commit**

```bash
git add vitest.config.ts web/src
git commit -m "feat: grammar detail view with furigana rendering and two-way cross-links"
```

---

### Task 11: Master–detail wide layout

**Files:**
- Modify: `web/src/App.tsx`, `web/src/styles.css`

**Interfaces:**
- Consumes: `view`/`OpenView` from Task 9.
- Produces: at ≥ 900px window width, the results list and open detail render side by side; ↑/↓ moves the selection AND repoints an open word detail. Below 900px, behavior is exactly today's (detail replaces list).

- [ ] **Step 1: Add a `useWide` hook in `App.tsx`**

```tsx
function useWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}
```

- [ ] **Step 2: Restructure the render**

In `App()` add `const wide = useWide();`. Wrap the list and detail in a split container. Structure (replacing the current `view ? … : searching ? … : browsing ? …` chain):

```tsx
const listPane = searching ? (
  <ul className="results cascade" key={wave} onMouseLeave={() => setHover(null)}>
    …existing search list…
  </ul>
) : browsing ? (
  …existing browse body (grammar sub-tabs content, sentences, words + load-more)…
) : (
  <ul className="results" />
);

const detailPane = view ? (
  view.type === 'word' ? (
    <WordDetail … />
  ) : (
    <GrammarDetail … />
  )
) : null;

return (
  …header unchanged…
  {wide ? (
    <div className={detailPane ? 'split has-detail' : 'split'}>
      <div className="split-list">{listPane}</div>
      {detailPane && <div className="split-detail">{detailPane}</div>}
    </div>
  ) : detailPane ? (
    detailPane
  ) : (
    listPane
  )}
);
```

- [ ] **Step 3: Arrow keys repoint an open word detail in wide mode**

In `onInputKey`, after the existing ArrowDown/ArrowUp `setSel` calls, add (both branches):

```tsx
if (wide && view?.type === 'word') {
  const next = navRows[/* the newly computed index used in setSel */];
  if (next && next.kind !== 'grammar-point') setView({ type: 'word', word: next });
  else if (next?.kind === 'grammar-point' && next.slug) setView({ type: 'grammar', slug: next.slug });
}
```

Compute the clamped index once into a local (`const nextIdx = Math.min(highlight + 1, navRows.length - 1)` / `Math.max(highlight - 1, 0)`) and reuse it for both `setSel(nextIdx)` and the view update. IME guard at the top of the handler stays untouched.

- [ ] **Step 4: CSS**

```css
/* Master–detail at desktop widths */
@media (min-width: 900px) {
  .split {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    align-items: start;
  }
  .split.has-detail {
    grid-template-columns: minmax(300px, 5fr) 7fr;
  }
  .split.has-detail .split-detail {
    position: sticky;
    top: 5.5rem; /* below the sticky search header */
    max-height: calc(100vh - 6rem);
    overflow-y: auto;
  }
  .split.has-detail .word-detail .back {
    display: none; /* list is visible beside it; Esc still closes */
  }
}
```

(Check `top:` against the real rendered header height in the browser and adjust to the actual value.)

- [ ] **Step 5: Verify**

`npm run typecheck && npm test`, then `npm run dev`. Manual: wide window — Enter opens detail beside the list, arrows walk the list while the right pane follows, Esc closes the pane; narrow window (< 900px) — detail replaces list exactly as before.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "feat: master-detail split layout at desktop widths"
```

---

### Task 12: Electron shell — window, server child, lifecycle, diagnostics

**Files:**
- Create: `electron/main.ts`, `electron/preload.ts`, `electron/diag.html`
- Modify: `package.json` (scripts, main, devDeps)

**Interfaces:**
- Consumes: server ready message `{ type: 'ready', port }` (Task 8); env contract `APP_DATA_DIR` / `GRAMMAR_FALLBACK_PATH` / `WEB_DIST` (Task 2).
- Produces: `window.desktop` bridge — `{ onMenuAction(cb: (id: string) => void): void }` (used in Task 13) — and the packaged/dev boot flow. `npm run app:dev` launches the full app.

- [ ] **Step 1: Install tooling and add scripts**

```bash
npm install --save-dev electron esbuild @electron/rebuild
```

package.json — set `"main": "dist-electron/main.cjs"` and add scripts:

```json
    "build:server": "esbuild src/server.ts --bundle --platform=node --format=cjs --external:better-sqlite3 --outfile=dist-electron/server.cjs",
    "build:shell": "esbuild electron/main.ts electron/preload.ts --bundle --platform=node --format=cjs --external:electron --outdir=dist-electron --out-extension:.js=.cjs && cp electron/diag.html dist-electron/",
    "app:dev": "npm run build && npm run build:server && npm run build:shell && electron .",
    "rebuild:electron": "electron-rebuild -f -w better-sqlite3",
    "rebuild:node": "npm rebuild better-sqlite3"
```

Add `dist-electron/` and `release/` to `.gitignore`.

- [ ] **Step 2: Create `electron/preload.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  onMenuAction: (cb: (id: string) => void) => {
    ipcRenderer.on('menu-action', (_e, id: string) => cb(id));
  },
  retry: () => ipcRenderer.send('diag-retry'),
});
```

- [ ] **Step 3: Create `electron/diag.html`**

```html
<meta charset="utf-8" />
<style>
  body { font: 15px/1.6 -apple-system, sans-serif; margin: 4rem auto; max-width: 34rem; color: #333; }
  pre { background: #f4f2ec; padding: 1rem; border-radius: 8px; white-space: pre-wrap; }
  button { font: inherit; padding: 0.4rem 1.2rem; }
  @media (prefers-color-scheme: dark) { body { color: #ddd; background: #1a1a1c; } pre { background: #26262a; } }
</style>
<h1>語彙 — server didn’t start</h1>
<pre id="err">unknown error</pre>
<button onclick="window.desktop.retry()">Retry</button>
<script>
  const err = new URLSearchParams(location.search).get('err');
  if (err) document.getElementById('err').textContent = err;
</script>
```

- [ ] **Step 4: Create `electron/main.ts`**

```ts
import path from 'node:path';
import {
  app,
  BrowserWindow,
  ipcMain,
  utilityProcess,
  type UtilityProcess,
} from 'electron';

// Spec-pinned config dir: ~/Library/Application Support/japanese-learning-app
app.setPath('userData', path.join(app.getPath('appData'), 'japanese-learning-app'));

const ROOT = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
const SERVER_PATH = path.join(__dirname, 'server.cjs');
const READY_TIMEOUT_MS = 20_000;

let win: BrowserWindow | null = null;
let child: UtilityProcess | null = null;
let quitting = false;
let restartedOnce = false;
let stderrTail: string[] = [];

function serverEnv(): Record<string, string> {
  return {
    ...process.env,
    APP_DATA_DIR: app.getPath('userData'),
    GRAMMAR_FALLBACK_PATH: path.join(ROOT, 'grammar-data'),
    WEB_DIST: path.join(ROOT, 'web/dist'),
  } as Record<string, string>;
}

function startServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    stderrTail = [];
    child = utilityProcess.fork(SERVER_PATH, [], { stdio: 'pipe', env: serverEnv() });
    child.stderr?.on('data', (d: Buffer) => {
      stderrTail = [...stderrTail, d.toString()].slice(-30);
      process.stderr.write(d);
    });
    child.stdout?.on('data', (d: Buffer) => process.stdout.write(d));

    const timer = setTimeout(
      () => reject(new Error(`server not ready after ${READY_TIMEOUT_MS / 1000}s\n${stderrTail.join('')}`)),
      READY_TIMEOUT_MS,
    );
    child.on('message', (msg: { type?: string; port?: number }) => {
      if (msg?.type === 'ready' && typeof msg.port === 'number') {
        clearTimeout(timer);
        resolve(msg.port);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (quitting) return;
      if (!restartedOnce) {
        restartedOnce = true;
        console.warn(`[shell] server exited (${code}) — restarting once`);
        boot();
      } else {
        showDiagnostic(`server exited with code ${code}\n${stderrTail.join('')}`);
      }
    });
  });
}

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 680,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
    },
  });
  // Red button hides (Claude Desktop pattern); App menu Quit really quits.
  w.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      w.hide();
    }
  });
  return w;
}

function showDiagnostic(message: string): void {
  win ??= createWindow();
  // diag.html is copied into dist-electron by build:shell, next to main.cjs
  void win.loadFile(path.join(__dirname, 'diag.html'), {
    query: { err: message.slice(0, 4000) },
  });
  win.show();
}

async function boot(): Promise<void> {
  try {
    const port = await startServer();
    win ??= createWindow();
    await win.loadURL(`http://127.0.0.1:${port}`);
    win.show();
  } catch (err) {
    showDiagnostic(String(err instanceof Error ? err.message : err));
  }
}

ipcMain.on('diag-retry', () => {
  restartedOnce = false;
  child?.kill();
  child = null;
  void boot();
});

app.on('before-quit', () => {
  quitting = true;
  child?.kill();
});

app.on('activate', () => {
  win?.show();
});

app.on('window-all-closed', () => {
  /* keep running — lifecycle is hide, not quit */
});

void app.whenReady().then(boot);
```

Also add to the `whenReady` boot path (before calling `boot()`): `installMenu(() => win);` — the import and `electron/menu.ts` arrive in Task 13; until then leave the default menu (skip this line and add it in Task 13).

- [ ] **Step 5: Launch and smoke-test**

```bash
npm run app:dev
```

If the window shows the diagnostic page with `NODE_MODULE_VERSION` mismatch text (better-sqlite3 ABI), run `npm run rebuild:electron` and relaunch; from then on use `npm run rebuild:node` before `npm test`/`npm run dev` and `rebuild:electron` before `app:dev`/`app:build` (README documents this in Task 15). If versions happen to agree, no rebuild is ever needed.

Verify each of these by hand:
1. Window opens showing the app UI (not a browser), search works, grammar reference browse works.
2. Red close button → window disappears, app stays in Dock; Dock click → window returns instantly (no re-index — server never died: `curl -s 127.0.0.1:3456/api/status` still answers while hidden).
3. ⌘Q → app quits fully; `curl -s --max-time 2 127.0.0.1:3456/api/status` now fails (server child was killed with the app).
4. Occupy the port (`python3 -m http.server 3456 &`) and relaunch → app appears on 3457 and works; kill the blocker.
5. Break the vault path (`VAULT_PATH=/nope npm run app:dev` with a fresh `APP_DATA_DIR`… simplest: `VAULT_PATH=/nope DB_PATH=/tmp/empty-test.db npm run app:dev`) → diagnostic page shows the real error; Retry works after unsetting.

- [ ] **Step 6: Commit**

```bash
git add electron package.json package-lock.json .gitignore
git commit -m "feat: Electron shell with utilityProcess server, hide-on-close lifecycle, diagnostics"
```

---

### Task 13: Native menu, shortcuts, and desktop window chrome

**Files:**
- Create: `electron/menu.ts`, `web/src/desktop.d.ts`
- Modify: `electron/main.ts`, `web/src/App.tsx`, `web/src/main.tsx`, `web/src/styles.css`

**Interfaces:**
- Consumes: `window.desktop.onMenuAction` (Task 12).
- Produces: menu-action ids — `'view:all' | 'view:vocab' | 'view:grammar' | 'view:sentence' | 'focus-search' | 'toggle-settings'` — handled in `App.tsx`. Renderer also handles ⌘1–4/⌘F/⌘, directly so the browser dev flow behaves the same.

- [ ] **Step 1: Create `electron/menu.ts`**

```ts
import { app, Menu, type BrowserWindow } from 'electron';

export function installMenu(getWin: () => BrowserWindow | null): void {
  const send = (id: string) => () => getWin()?.webContents.send('menu-action', id);
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'Cmd+,',
          click: send('toggle-settings'),
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' }, // full Edit roles: copy/paste/select-all — IME needs these
    {
      label: 'View',
      submenu: [
        { label: 'All', accelerator: 'Cmd+1', click: send('view:all') },
        { label: 'Vocab', accelerator: 'Cmd+2', click: send('view:vocab') },
        { label: 'Grammar', accelerator: 'Cmd+3', click: send('view:grammar') },
        { label: 'Sentences', accelerator: 'Cmd+4', click: send('view:sentence') },
        { type: 'separator' },
        { label: 'Focus Search', accelerator: 'Cmd+F', click: send('focus-search') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' }, // minimize, zoom, close(⌘W → our hide handler)
  ]);
  Menu.setApplicationMenu(menu);
}
```

In `electron/main.ts`: `import { installMenu } from './menu.js';` and call `installMenu(() => win);` inside the `whenReady` boot path (before `boot()`).

- [ ] **Step 2: Type the bridge — create `web/src/desktop.d.ts`**

```ts
export {};

declare global {
  interface Window {
    desktop?: {
      onMenuAction: (cb: (id: string) => void) => void;
      retry: () => void;
    };
  }
}
```

- [ ] **Step 3: Handle actions in `web/src/App.tsx`**

Add one effect (uses existing `setKind`, `inputRef`, `setSettingsOpen`):

```tsx
useEffect(() => {
  const act = (id: string) => {
    if (id.startsWith('view:')) {
      setKind(id.slice(5));
      setView(null);
    } else if (id === 'focus-search') {
      inputRef.current?.focus();
    } else if (id === 'toggle-settings') {
      setSettingsOpen((o) => !o);
    }
  };
  window.desktop?.onMenuAction(act);
  const onKey = (e: KeyboardEvent) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (!e.metaKey || e.ctrlKey || e.altKey) return;
    const views: Record<string, string> = { '1': 'all', '2': 'vocab', '3': 'grammar', '4': 'sentence' };
    if (views[e.key]) {
      e.preventDefault();
      act(`view:${views[e.key]}`);
    } else if (e.key === 'f') {
      e.preventDefault();
      act('focus-search');
    } else if (e.key === ',') {
      e.preventDefault();
      act('toggle-settings');
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);
```

(`onMenuAction` registers an ipc listener for the window's lifetime — the app component never unmounts, so no teardown is needed for it.)

- [ ] **Step 4: Desktop chrome CSS**

`web/src/main.tsx` — before render: `if (window.desktop) document.body.classList.add('desktop');`

`web/src/styles.css` — append:

```css
/* Desktop (Electron) window chrome */
body.desktop .app-header {
  -webkit-app-region: drag;       /* window moves by its header band */
  -webkit-user-select: none;
  user-select: none;
  padding-left: 84px;             /* clear the hidden-inset traffic lights */
}
body.desktop .app-header .icon-btn,
body.desktop .app-header button {
  -webkit-app-region: no-drag;
}
body.desktop .filter-tabs,
body.desktop .sort-tabs {
  -webkit-user-select: none;
  user-select: none;
}
```

Check the traffic-light padding against the real window: the wordmark 語彙 must not sit under the buttons; adjust 84px to what looks right (traffic lights end ≈ 78px with `hiddenInset`).

- [ ] **Step 5: Verify**

`npm run typecheck && npm test`, then `npm run app:dev`. Manual: ⌘1–4 switch views (menu items AND raw keys), ⌘F focuses search, ⌘, opens settings, ⌘W hides (not quits), Edit-menu copy/paste works in the search field, Japanese IME composition still commits correctly (type こうえん, convert, Enter — must not trigger row-open), window drags by the header, traffic lights overlay cleanly.

- [ ] **Step 6: Commit**

```bash
git add electron web/src
git commit -m "feat: native menu, keyboard shortcuts, and desktop window chrome"
```

---

### Task 14: Packaging — icon, grammar fallback data, electron-builder

**Files:**
- Create: `scripts/copy-grammar-data.mjs`, `scripts/make-icon.sh`, `assets/icon.svg`, `electron-builder.yml`, `grammar-data/` (generated, committed), `assets/icon.icns` (generated, committed)
- Modify: `package.json`

**Interfaces:**
- Consumes: everything.
- Produces: `npm run app:build` → `release/mac-arm64/Japanese Learning.app` (+ `.dmg`).

- [ ] **Step 1: Create `scripts/copy-grammar-data.mjs`**

```js
// Refresh the bundled grammar-data fallback from the sibling repo.
import fs from 'node:fs';
import path from 'node:path';

const SRC = '/Users/nhattran/Documents/projects/japanese-grammar-app/data';
const DEST = new URL('../grammar-data', import.meta.url).pathname;

if (!fs.existsSync(path.join(SRC, 'tofugu_grammar_complete.json'))) {
  console.error(`grammar repo not found at ${SRC} — keeping existing fallback`);
  process.exit(fs.existsSync(DEST) ? 0 : 1);
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(path.join(DEST, 'grammar_content'), { recursive: true });
for (const f of ['tofugu_grammar_complete.json', 'custom_grammar.json']) {
  fs.copyFileSync(path.join(SRC, f), path.join(DEST, f));
}
for (const f of fs.readdirSync(path.join(SRC, 'grammar_content'))) {
  if (f.endsWith('.json'))
    fs.copyFileSync(path.join(SRC, 'grammar_content', f), path.join(DEST, 'grammar_content', f));
}
console.log('grammar-data fallback refreshed');
```

Run it: `node scripts/copy-grammar-data.mjs` — expected: `grammar-data/` holds 2 index files + 173 content files (~9 MB). This directory is **committed** (reproducible builds even if the sibling repo moves).

- [ ] **Step 2: Create the app icon**

`assets/icon.svg` (ruri-blue rounded rect, white 語 — macOS Big-Sur-style with margin):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect x="100" y="100" width="824" height="824" rx="185" fill="#1f3a5f"/>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="none" stroke="#ffffff22" stroke-width="6"/>
  <text x="512" y="512" font-family="Hiragino Mincho ProN, Noto Serif JP, serif"
        font-size="520" fill="#f5f1e8" text-anchor="middle" dominant-baseline="central">語</text>
</svg>
```

`scripts/make-icon.sh`:

```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build-icon.iconset
qlmanage -t -s 1024 -o build-icon.iconset assets/icon.svg >/dev/null
mv build-icon.iconset/icon.svg.png build-icon.iconset/icon_512x512@2x.png
for spec in "16 icon_16x16" "32 icon_16x16@2x" "32 icon_32x32" "64 icon_32x32@2x" \
            "128 icon_128x128" "256 icon_128x128@2x" "256 icon_256x256" \
            "512 icon_256x256@2x" "512 icon_512x512"; do
  size=${spec% *}; name=${spec#* }
  sips -z "$size" "$size" build-icon.iconset/icon_512x512@2x.png \
       --out "build-icon.iconset/$name.png" >/dev/null
done
iconutil -c icns build-icon.iconset -o assets/icon.icns
rm -rf build-icon.iconset
echo "assets/icon.icns written"
```

Run: `chmod +x scripts/make-icon.sh && ./scripts/make-icon.sh` — expected `assets/icon.icns written`. Open `assets/icon.icns` in Preview to eyeball it. Commit the icns.

- [ ] **Step 3: Create `electron-builder.yml`**

```yaml
appId: com.nhattran.japanese-learning
productName: Japanese Learning
directories:
  output: release
files:
  - dist-electron/**
  - package.json
extraResources:
  - from: web/dist
    to: web/dist
  - from: grammar-data
    to: grammar-data
asarUnpack:
  - node_modules/better-sqlite3/**
mac:
  target:
    - dir
    - dmg
  icon: assets/icon.icns
  category: public.app-category.education
  identity: null   # ad-hoc signing — personal machine, no Developer ID
```

- [ ] **Step 4: Prune runtime dependencies**

Everything except better-sqlite3 is bundled (server by esbuild, UI by vite), so move `@fontsource/noto-sans-jp`, `@hono/node-server`, `chokidar`, `hono`, `react`, `react-dom` from `dependencies` to `devDependencies` in package.json — `dependencies` must end as exactly:

```json
  "dependencies": {
    "better-sqlite3": "^12.11.1"
  },
```

Then `npm install && npm test && npm run typecheck && npm run build` — all must still pass (they run from devDeps).

- [ ] **Step 5: Add the build script and build**

package.json:

```json
    "app:build": "npm run build && npm run build:server && npm run build:shell && node scripts/copy-grammar-data.mjs && electron-builder --mac"
```

```bash
npm install --save-dev electron-builder
npm run rebuild:electron   # ensure electron ABI before packaging (harmless if already)
npm run app:build
```

Expected: `release/mac-arm64/Japanese Learning.app` and a `.dmg`. Then verify:

```bash
codesign -dv "release/mac-arm64/Japanese Learning.app" 2>&1 | head -3   # ad-hoc signature present
open "release/mac-arm64/Japanese Learning.app"
```

First-run checklist on the packaged app:
1. Launches from Finder with the 語 icon; indexes the real vault (counts in header).
2. Grammar reference section fully populated (reads live sibling repo; then rename the sibling repo folder temporarily and relaunch → still populated via bundled fallback + a warning in Console.app; rename back).
3. `~/Library/Application Support/japanese-learning-app/vocab.db` exists (db no longer writes into the repo).
4. Close-button/Dock/⌘Q lifecycle identical to Task 12's checks.
5. Drag the .app to /Applications and launch from there — still works (no cwd-relative path leaks).

- [ ] **Step 6: Commit**

```bash
git add scripts assets electron-builder.yml package.json package-lock.json grammar-data
git commit -m "feat: electron-builder packaging with icon and bundled grammar fallback"
```

---

### Task 15: README, config docs, final verification, push

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/manual-checklist.md`

**Interfaces:** none new — documentation + final gate.

- [ ] **Step 1: Rewrite `README.md`**

```markdown
# Japanese Learning (macOS app)

One desktop app for 2+ years of italki lesson notes, Genki/Quartet vocabulary
(indexed read-only from the Obsidian vault), and the full grammar reference
(Tofugu + custom points from the sibling japanese-grammar-app repo).

## Run

Double-click **Japanese Learning.app** (built via `npm run app:build`,
found in `release/mac-arm64/`). The red button hides the window — the app and
its vault watcher keep running; click the Dock icon to bring it back; ⌘Q quits.

## Develop

    npm run dev          # server :3456 + hot-reload UI :5173 in a browser
    npm run app:dev      # the same app inside the Electron shell
    npm test             # parser + search + grammar + API tests
    npm run typecheck
    npm run app:build    # package Japanese Learning.app + dmg into release/

**Native-module ABI:** better-sqlite3 must match the runtime. Before
`npm test` / `npm run dev` after any Electron work: `npm run rebuild:node`.
Before `app:dev` / `app:build`: `npm run rebuild:electron`. (If no
NODE_MODULE_VERSION error ever appears, your Node and Electron ABIs agree and
you can ignore this.)

## Config

Packaged app: `~/Library/Application Support/japanese-learning-app/config.json`

    { "vaultPath": "...", "grammarDataPath": "...", "port": 3456 }

Dev: env vars win over the file — `VAULT_PATH`, `GRAMMAR_DATA_PATH`,
`DB_PATH`, `PORT`, `HOST` (set `HOST=0.0.0.0` for the Tailscale phone flow).
Grammar data reads live from `~/Documents/projects/japanese-grammar-app/data`
when present, else the bundled `grammar-data/` fallback
(refresh with `node scripts/copy-grammar-data.mjs`).

## Search & views

`/` or ⌘F focuses search; one box finds kanji, kana, romaji slugs, and English
across vocab, sentences, your grammar notes, and reference grammar points
(参 badge). ⌘1–4 switch All · Vocab · Grammar · Sentences. The Grammar view
has 参考 Reference (JLPT-grouped Tofugu + custom points, cross-linked to your
lesson notes) and ノート My notes. Wide windows show list + detail side by side.
```

- [ ] **Step 2: Write and run the manual checklist**

Create `docs/superpowers/manual-checklist.md` with the checks from Task 12 Step 5, Task 13 Step 5, and Task 14 Step 5 as one list; run through every item against the **packaged** app and mark each `[x]` with a note if behavior deviated. Any failed item → fix before proceeding (reopen the relevant task).

- [ ] **Step 3: Final gate and push**

```bash
npm run rebuild:node && npm test && npm run typecheck
git add README.md docs/superpowers/manual-checklist.md
git commit -m "docs: README for the desktop app and executed manual checklist"
git push origin main
```

Expected: all green, pushed.

---

## Post-plan notes (not tasks)

- **Deferred (vocab-app Phase 2/3 backlog):** stats view, unparsed-report UI, SRS. Port into this repo later via a fresh spec.
- **Future Swift shell:** everything the shell knows is `spawn dist-electron/server.cjs` (any Node), env contract from Task 2, and `{type:'ready',port}` on the message port — a Swift shell replaces Tasks 12–14 without touching `src/` or `web/`.
