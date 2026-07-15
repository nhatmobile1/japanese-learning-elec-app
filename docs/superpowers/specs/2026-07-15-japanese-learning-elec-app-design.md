# Japanese Learning macOS App (Electron) — Design

**Date:** 2026-07-15
**Status:** Approved by user (brainstorming session)

## Goal

A double-clickable macOS desktop app — no terminal, no browser — that unifies
the two existing projects into one Japanese learning app:

- **japanese-vocab-app** — Hono server + better-sqlite3 index over the Obsidian
  vault (read-only), React UI. Needs a live server (vault watcher, SQLite).
- **japanese-grammar-app** — static reference of grammar points (Tofugu +
  custom lessons JSON, ~173 detail files, ~9 MB). No server needed.

Shell choice: **Electron** — the existing Node server (native better-sqlite3
module + chokidar) runs as-is. The server stays a standalone process spawned
by the shell, so a future native Swift shell can reuse it unchanged.

## 1. Project structure

New repo at `~/Documents/projects/japanese-learning-elec-app`:

```
japanese-learning-elec-app/
├── src/          # Hono server — seeded by copying from japanese-vocab-app
├── web/          # React UI — seeded by copying, then desktop-adapted
├── tests/        # copied vitest suites, kept green
├── electron/     # NEW thin shell: main.ts, menu.ts (~200 lines)
└── package.json  # one project: server + UI + shell + electron-builder
```

- Seed by **copying** `src/`, `web/`, `tests/` from japanese-vocab-app. This
  repo is the app going forward; the original repo stays untouched as the
  web version.
- External data stays external and is never modified:
  - Vault (read-only): `~/documents/obsidian-main/nhat-mind/efforts/japanese-learning`
  - Grammar JSON: `~/Documents/projects/japanese-grammar-app/data`

## 2. Architecture & lifecycle

- Electron **main process** spawns the server as a child via `utilityProcess`,
  waits for a ready signal (which includes the bound port), then opens a
  `BrowserWindow` at `http://127.0.0.1:<port>`. The shell knows nothing about
  vocab/SQLite — only "start server, show window."
- The server remains independently runnable (`npm run dev` in a browser),
  preserving today's dev flow and the future Swift-shell option.
- **Lifecycle (Claude Desktop / Spotify pattern):**
  - Red close button → `hide()` — app and server keep running, vault watcher
    stays live.
  - Dock (or optional menu-bar/tray icon) click → instant `show()`.
  - ⌘Q / app menu Quit → kill server child cleanly, exit fully.
- **Native menu bar** with real shortcuts: ⌘F or `/` (focus search), ⌘1–4
  (views), ⌘, (settings), ⌘W (hide window), standard Edit menu so
  copy/paste and IME behave.
- Server binding unchanged: `127.0.0.1`, default port 3456. The Tailscale
  phone workflow (`HOST=0.0.0.0`) still works since it is the same server.

## 3. Grammar integration (data + API)

- Grammar app's JSON is the **single source of truth**, living in its repo.
  New server config `GRAMMAR_DATA_PATH`
  (default `~/Documents/projects/japanese-grammar-app/data`).
- Indexed at startup, same pattern as the vault:
  - `tofugu_grammar_complete.json` + `custom_grammar.json` → master list of
    grammar points (title, slug, description, JLPT level, categories).
  - `grammar_content/*.json` (~173 files) → full detail pages (explanations,
    examples, furigana).
- Grammar points join SQLite alongside vocab (new tables, same FTS approach):
  the one search bar finds 〜てしまう via `てしまう`, `shimau`, or `ended up`.
- New API: `/api/grammar-points` (list/browse), `/api/grammar-points/:slug`
  (detail).
- Packaged app bundles a **fallback copy** of the grammar data; if the sibling
  repo exists on disk, it reads live from there — custom-grammar edits appear
  on next launch without rebuilding the app.

### Vault grammar notes vs. reference grammar points

The existing Grammar tab shows the user's own vault grammar notes; the grammar
app brings canonical reference points. Treatment:

- The 文法 Grammar section's primary browse/read experience is the
  **reference grammar points** (JLPT levels, categories — full content).
- **Cross-linking:** a reference point's detail page shows a "from your
  lessons" section listing matching vault notes; a vault grammar note links to
  its canonical reference point. Vault notes remain searchable as today.
- Matching is fuzzy (title/pattern string match). It catches obvious pairs
  (〜てしまう ↔ te-shimau) and shows **nothing when unsure — never a wrong
  link**.
- Search results visually distinguish reference points from lesson notes
  (e.g. a small 参 reference mark vs. existing lesson styling).

## 4. Desktop UI adaptation

Keep the existing design language (five themes × light/dark, patterns,
ink-wash search, petal, stamp). Adapt layout for a desktop window:

- **Window chrome:** hidden-inset title bar — the header band runs
  edge-to-edge behind the traffic lights, with a draggable region on the
  header. No web focus rings on chrome, no text cursor on chrome,
  system-native context menus.
- **Navigation:** current tab row (All · Vocab · Grammar · Sentences) promoted
  to top-level app navigation; 文法 Grammar becomes the full reference section.
  ⌘1–4 switch views; `/` or ⌘F focuses search from anywhere; Esc unchanged.
- **Master–detail at wide widths:** word/grammar detail opens as a second
  column beside the results list (arrow through results left, read right).
  Below a width threshold, falls back to today's single-column stack.
- **Grammar section UI:** browse by JLPT level (N5→N1) and category, rendered
  with existing components/themes — the grammar app's content moves in, not
  its separate look.
- IME guards (`isComposing || keyCode === 229`) must survive all edits.

## 5. Packaging & dev workflow

- `npm run dev` — server + Vite hot reload in a browser (today's flow).
- `npm run app:dev` — same, inside the Electron window (shell testing).
- `npm run app:build` — build UI, then electron-builder produces the `.app`
  (+ `.dmg`). App name: **Japanese Learning** (bundle id
  `com.nhattran.japanese-learning`); a custom icon is designed during
  implementation. Ad-hoc signed — runs locally without an Apple Developer
  account.
- **Config for a terminal-less world:** packaged app reads
  `~/Library/Application Support/japanese-learning-app/config.json`
  (vault path, grammar path, port) with sensible defaults; env vars still win
  in dev.

## 6. Error handling

- **Server fails to start** (bad vault path, port taken): window shows a plain
  diagnostic page with the real error and a Retry button — never an eternal
  blank window. Port 3456 taken → try 3457–3460; shell passes the winning port
  to the window.
- **Server crashes mid-session:** shell restarts it once automatically; a
  second death shows the diagnostic page.
- **Vault temporarily unreadable:** unchanged from today — serve last index;
  watcher recovers when it returns.
- **Grammar repo absent:** log a warning, use bundled fallback data; app fully
  functional.

## 7. Testing

- Copied parser/search/API vitest suites keep running (`npm test`).
- New unit tests: grammar-data indexer (JSON → SQLite), grammar API routes,
  vault-note ↔ reference-point matcher (table-driven, including
  "no match → no link").
- Shell behavior (hide-on-close, quit, restart-on-crash) verified by a manual
  checklist in the implementation plan — the surface is ~200 rarely-changing
  lines; an Electron e2e harness isn't warranted.
- Manual desktop pass: master–detail at wide/narrow widths, ⌘ shortcuts, IME
  composition in search.

## Out of scope (this project)

- SRS / stats views (Phase 3 backlog of the vocab app — port later).
- Native Swift shell (possible future; enabled by the standalone-server
  architecture, not built now).
- Auto-update, notarization, distribution beyond this Mac.
