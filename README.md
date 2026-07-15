# Japanese Vocab App

Instant lookup over 2+ years of italki lesson notes plus Genki/Quartet
vocabulary, indexed read-only from an Obsidian vault.

## Usage

    npm start          # build UI, index the vault, serve http://localhost:3456
    npm run dev        # dev mode: API on :3456, hot-reloading UI on :5173
    npm test           # parser + search + API tests
    npm run typecheck

The vault is watched — new lesson notes saved in Obsidian appear in search
within a couple of seconds. The SQLite file (`data/vocab.db`) is a disposable
cache, rebuilt from the vault on every start.

## Search & Browse

- Kanji (還付), kana (かんぷ / カンプ), or English (refund) — one box.
- `/` focuses search · ↑↓ select · Enter opens word detail · Esc goes back.
- Tabs are views: **All** searches everything; **Vocab** / **Grammar** browse
  the full sorted list when the box is empty (Recent · あいうえお · Most seen ·
  Chapter) and filter as you type; **Sentences** is a newest-first timeline
  grouped by month.
- ⚙ opens Settings: five color themes (瑠璃と月 · 若草 · 桔梗 · ポニョ · 辞書),
  light/dark, and a traditional pattern for the header bands (青海波 · 七宝 ·
  矢羽根 · none). ☾/☀ is the quick theme switch. Everything persists locally.
- `/api/unparsed` lists vault lines the parser couldn't classify.

## Config (env vars)

| Var          | Default                                                        |
| ------------ | -------------------------------------------------------------- |
| `VAULT_PATH` | `/Users/nhattran/documents/obsidian-main/nhat-mind/efforts/japanese-learning` |
| `DB_PATH`    | `data/vocab.db`                                                |
| `PORT`       | `3456`                                                         |
| `HOST`       | `127.0.0.1` — localhost-only. Set `HOST=0.0.0.0` to reach the app from a phone/tablet (use only on a trusted network or over Tailscale; the vault is personal) |

## Phone / second device

The app is local-first and is not deployable to static hosts (Vercel etc.) —
the API, SQLite index, and vault all live on this machine. To use it from a
phone or tablet, install [Tailscale](https://tailscale.com) on both devices,
start the app with `HOST=0.0.0.0 npm start`, and open
`http://<laptop-tailscale-name>:3456` on the phone.

## Phase 2/3 (planned)

Browse by month/chapter, stats, then SRS review. See
`docs/superpowers/specs/2026-07-05-japanese-vocab-app-design.md`.
