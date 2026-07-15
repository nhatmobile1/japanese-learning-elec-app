# Manual checklist — desktop shell (Electron)

This list compiles every manual/interactive check called for by Task 12 Step 5,
Task 13 Step 5, and Task 14 Step 5 of
`docs/superpowers/plans/2026-07-15-japanese-learning-elec-app.md`, plus items
flagged during code review of Tasks 11/13/14 that still need a human pass.

**Run that produced the `[x]` marks below:** Task 15, 2026-07-15, a
non-interactive coding-agent session (no pointer, no keyboard focus into a
real window, no Finder/Dock). Every `[x]` below has a specific programmatic
substitute check cited inline, with the report it came from
(`.superpowers/sdd/task-12-report.md`, `task-13-report.md`, `task-14-report.md`).
No `[x]` was marked without that cited evidence. Every `[ ]` is a genuine gap —
an interactive, visual, or IME-composition check that requires a human at a
real keyboard/mouse/screen — and is left for the human's first real-world
pass. Do not check any `[ ]` box without actually performing the action
described.

---

## From Task 12 Step 5 (electron shell smoke test)

- [x] `npm run app:dev` builds and launches a real Electron process tree (not
      a browser tab). Evidence: `ps aux` showed main + GPU + network-utility +
      node-utility(server) + renderer processes; `curl 127.0.0.1:3456/` returned
      the built `index.html` and `curl .../api/status` returned real vault
      counts (T12 report, checks 3-4, 6, 8-9).
- [ ] REQUIRES HUMAN — Window opens showing the actual rendered app UI (not
      just the correct HTML/JSON over the wire): search works, grammar
      reference browse works. Look at the window and use it.
- [ ] REQUIRES HUMAN — Red close button click → window disappears, app stays
      in the Dock; clicking the Dock icon brings the window back instantly
      with **no re-index** (server never died). To confirm the server really
      stayed alive rather than silently restarting, run
      `curl -s 127.0.0.1:3456/api/status` right after hiding the window and
      again right after un-hiding it — the counts must be identical and the
      terminal log must show no new `[server] indexed...` line in between.
      (Programmatic substitute exists but is not equivalent: T12 killed the
      main process outright, which is a different code path from
      close→hide→activate — see T12 report "Deferred" section.)
- [ ] REQUIRES HUMAN — ⌘Q (via the actual keystroke or menu Quit item) → app
      quits fully; `curl -s --max-time 2 127.0.0.1:3456/api/status` then fails.
      (T12 verified the *server-dies-with-app* half of this by sending
      `kill` to the main process directly, which produced the same
      curl-fails result — but the literal ⌘Q keystroke through
      `before-quit` was never pressed; T12 report explicitly flags this gap.)
- [x] Occupy the port and relaunch → app appears on the next port (3457) and
      still works; the blocker is then freed. Evidence: a real IPv4-only
      `127.0.0.1:3456` listener was bound, the app relaunched, log showed
      `[server] http://localhost:3457 (bound to 127.0.0.1)`, and
      `curl 127.0.0.1:3457/api/status` returned the real counts JSON (T12
      report, check 11). Note: the brief's suggested blocker
      (`python3 -m http.server 3456`) does *not* reproduce this on this
      machine — it binds IPv6-only and coexists with the app's IPv4 bind
      without conflict; use a real IPv4 blocker instead (T12 report,
      "Notable environment quirk").
- [x] Break the vault path → diagnostic page is reached (not a crash, not a
      silent hang). Evidence: `VAULT_PATH=/nope DB_PATH=/tmp/empty-test.db`
      launch showed the restart-once path fire, then gave up with `ps aux`
      showing main+GPU+network+renderer alive and **no** node-utility
      (server) process and **no** port listening — i.e. the diagnostic-window
      state (T12 report, check 12).
- [ ] REQUIRES HUMAN — On that diagnostic page, the **Retry** button
      (`window.desktop.retry()` → `ipcMain.on('diag-retry', …)`) actually
      works once the underlying problem (e.g. `VAULT_PATH`) is unset. Click
      it and confirm the app recovers into the normal window. Not clicked in
      T12 — code-reviewed only.

## From Task 13 Step 5 (menu, shortcuts, desktop chrome)

- [x] `npm run typecheck && npm test` pass with the menu/shortcut code in
      place, and the packaged shell still boots and serves real data with the
      menu installed. Evidence: 124/124 tests, clean typecheck, and a live
      `env -u ELECTRON_RUN_AS_NODE npx electron .` launch that served real
      `/api/status` JSON with `installMenu` wired in (T13 report, Verification
      log items 1-4).
- [ ] REQUIRES HUMAN — ⌘1–4 switch views All/Vocab/Grammar/Sentences, both via
      the raw keystroke and via clicking the matching View-menu item.
- [ ] REQUIRES HUMAN — ⌘F (raw key and menu item) focuses the search input.
- [ ] REQUIRES HUMAN — ⌘, (raw key and the app-menu "Settings…" item) opens
      the settings panel.
- [ ] REQUIRES HUMAN — ⌘W hides the window (does not quit the app).
- [ ] REQUIRES HUMAN — Edit-menu (`role: editMenu`) copy/paste functions
      correctly in the search field.
- [ ] REQUIRES HUMAN — Japanese IME composition in the search field of the
      **packaged app**: type こうえん, convert with the IME, press Enter to
      commit — this must commit the IME composition and must **not** trigger
      the app's own Enter handling (row-open). This can only be exercised
      with a real IME session; the guard code (`isComposing`/`keyCode===229`)
      has been read and reasoned about (T13 report) but never driven by an
      actual IME.
- [ ] REQUIRES HUMAN — Window drags by the header band; the hidden-inset
      traffic lights overlay cleanly and the 語彙 wordmark does not sit under
      them at the current 84px left-padding value. T13's report explicitly
      left this unverified against a live window ("I did not have a live
      window to visually re-check the 84px figure") — adjust the CSS
      constant in `web/src/styles.css` (`.app-header` `padding-left`) if it
      looks wrong.

## From Task 14 Step 5 (packaged app first-run checklist)

- [x] Packaged binary launches (not via Finder, but by direct exec) and
      indexes the real vault; counts are queryable. Evidence:
      `release/mac-arm64/Japanese Learning.app/Contents/MacOS/Japanese Learning`
      launched directly, log showed
      `[server] indexed 18778 entries from 102 files in 196ms`, and
      `curl 127.0.0.1:3456/api/status` returned
      `{"entryCount":18778,"wordCount":9457,"unparsedCount":3,"fileCount":97}`
      (T14 report, First-run checklist items 1-2).
- [ ] REQUIRES HUMAN — Launch from **Finder** by double-clicking, showing the
      語 icon in Finder/Dock, and confirm the header shows the same live
      counts. (T14 could not use Finder/`open` in its sandbox — `open`
      produced no observable process there — so the launch above was via a
      direct binary exec, not a genuine Finder double-click.)
- [x] Grammar reference fallback path is real and complete, not just present
      on disk. Evidence: launched the packaged binary with
      `GRAMMAR_DATA_PATH` forced to a nonexistent path, log showed
      `indexed 173 grammar points from .../Contents/Resources/grammar-data`,
      and `curl /api/grammar-points` returned `total: 173` plus a full
      `te-form` content payload from the bundled fallback (T14 report,
      "Verification: bundled fallback exercised end-to-end").
- [ ] REQUIRES HUMAN — The *specific* fallback trigger described in the plan:
      temporarily rename the sibling `japanese-grammar-app` repo folder,
      relaunch the packaged app, confirm the grammar section is still fully
      populated (now via the bundled fallback) **and** a warning appears in
      Console.app, then rename the sibling folder back. (T14 forced the
      fallback via an env var instead, since the sibling repo is read-only
      and was never renamed — functionally equivalent for the data path, but
      the Console.app warning itself was never observed, and this is the
      literal check the plan asks for.)
- [x] `vocab.db` is written to the packaged app's real data directory, not
      into the repo. Evidence:
      `~/Library/Application Support/japanese-learning-app/vocab.db` existed
      at 9,359,360 bytes with an mtime matching the exact test run (T14
      report, First-run checklist item 3).
- [ ] REQUIRES HUMAN — Close-button/Dock/⌘Q lifecycle against the **packaged**
      app, identical to the Task 12 checks above (same gap: T14 used `kill`
      on the main PID, not the interactive close-button/Dock-click/⌘Q path).
- [ ] REQUIRES HUMAN — Drag the `.app` to `/Applications` and launch it from
      there — confirm it still works (no cwd-relative path leaks). Never
      attempted (no Finder/Applications-folder drag available to the agent).

## Review-flagged items (raised during Task 11/13/14 code review, not on the original plan checklists)

- [ ] REQUIRES HUMAN — **Wide-window master-detail layout.** `.app` has
      `max-width: 760px` (`web/src/styles.css` line ~146), which caps the
      `.split` grid at ≥900px widths to that same 760px total — so
      `split-list` (`minmax(300px, 5fr)`) and `split-detail` (`7fr`) split a
      760px box, not the full window. On a wide window, check whether this
      feels cramped, and whether it should be widened specifically for the
      `has-detail` wide case. Also check whether the detail pane's
      `position: sticky; top: 11.5rem;` (line ~938) is the right offset — it
      was derived by hand-summing box heights in `.search-header`'s tallest
      state (browsing, with sort-tabs shown), not measured in a live browser
      (Task 11 report, "The sticky-top value I chose, and why" — deferred
      visual tuning).
- [ ] REQUIRES HUMAN — **Settings panel drag region.** Confirm that dragging
      with the mouse *inside* the open settings panel does not move the
      window (the fix in commit `7413c55` added
      `body.desktop .settings-panel { -webkit-app-region: no-drag; }`), and
      that clicking outside the open panel closes it. Not interactively
      exercised — only code-reviewed and typechecked (T13 report, "Fix:
      settings-panel drag region").
- [ ] REQUIRES HUMAN — **Crash-restart-while-hidden behavior.** If the server
      child crashes while the window is hidden (red-button-hidden, not
      quit), `electron/main.ts`'s `child.on('exit', ...)` handler calls
      `boot()` once (`restartedOnce` guard), and `boot()` ends with
      `win.show()` unconditionally after a successful reconnect — so the
      window will pop back on screen even though the user had hidden it and
      never asked to see it again. This is the plan-mandated behavior
      (restart-once-then-diagnostic), not a bug, but it has a visible
      side-effect (an unrequested window pop) that was never watched happen
      on a real screen. Confirm you're OK with this trade-off, or file a
      follow-up if it's surprising in practice.
- [ ] REQUIRES HUMAN — IME composition in the search field of the **packaged**
      app specifically (as opposed to `app:dev`): type こうえん, convert with
      the IME, press Enter — must commit the composition and must not
      trigger a row-open. (Same underlying check as the Task 13 item above,
      called out separately here because it was raised again during the
      Task 14 packaging review as specifically needing to be run against the
      shipped `.app`, not just the dev shell.)
- [ ] REQUIRES HUMAN — **Icon visual check.** Open `assets/icon.icns` in
      Preview.app and look at it; look at the icon in Finder (packaged
      `.app`) and in the Dock while running. T14 only verified the `.icns`
      file format/size/dimensions programmatically (`file`, `sips`) — never
      opened it in Preview or looked at it rendered in Finder/Dock (T14
      report, "Deferred to manual pass").

---

## Tally

- **7** items marked `[x]` verified programmatically, each with a cited
  command/output from the Task 12/13/14 reports.
- **20** items marked `[ ]` REQUIRES HUMAN — genuine interactive/visual/IME
  gaps, each with the plan's original instructions for how to perform the
  check preserved above. Any failure found during that first-run pass should
  reopen the relevant task (12, 13, 14, or the wide-layout follow-up noted in
  Task 11) rather than being patched ad hoc.
