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
