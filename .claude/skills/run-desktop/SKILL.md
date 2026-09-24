---
name: run-desktop
description: Build, run, and drive the Qarz Daftari Electron desktop app. Use when asked to launch the desktop app, take a screenshot of it, or interact with its UI.
---

Qarz Daftari is an Electron desktop app (React renderer, `HashRouter`).
Drive it via the Playwright `_electron` REPL at `driver.mjs` in this
directory. Works directly on macOS — no xvfb needed (Darwin has a real
WindowServer). All paths below are relative to the repo root.

## Build

```bash
npm run build   # electron-vite build -> out/main, out/preload, out/renderer
```

## Run

```bash
node .claude/skills/run-desktop/driver.mjs
```

It's a REPL — type commands, one per line. Screenshots land in
`/tmp/qarz-shots/` (override with `SCREENSHOT_DIR`).

| command | what it does |
|---|---|
| `launch` | launch the app, wait for windows |
| `ss [name]` | screenshot → `<SCREENSHOT_DIR>/<name>.png` |
| `click <css-sel>` | click element via DOM (not coordinates) |
| `click-text <text>` | click button/link containing exact/partial text |
| `type <text>` / `press <key>` | keyboard input |
| `wait <css-sel>` | wait for element, 10s timeout |
| `eval <js>` | evaluate in the page, print JSON |
| `text [css-sel]` | print innerText |
| `console` | start forwarding page console messages to stdout |
| `windows` | list window URLs |
| `quit` | close app, exit |

## Gotchas

- **The lock screen needs a PIN before anything else works.** After
  `launch`, `type 1234` (or whatever PIN the profile uses) to get past
  it. A fresh/unactivated profile shows an activation screen first —
  mint a code with `npm run mint` if needed.
- **Never navigate with `page.goto()` / a `click` that causes a full
  reload.** This is a `HashRouter` — only the URL hash should change
  (`page.evaluate(() => location.hash = '#/clients')`). A full document
  reload re-initializes React state, which re-locks the app (PIN screen
  again) and loses in-memory state.
- **By default this drives the REAL default profile**
  (`~/Library/Application Support/qarz-daftari/`), not an isolated one —
  `electron.launch({ args: [APP_DIR] })` with no `--user-data-dir`. That
  profile's real data gets read and can be written to (adding clients,
  changing settings). Pass `--user-data-dir=<path>` in `args` for an
  isolated throwaway profile instead when you don't want that.
- **Language/theme persist in `localStorage` across launches**, tied to
  the profile. If a prior driving session changed them, aria-label /
  text selectors written for Russian strings will silently fail to
  match on the next launch. Reset explicitly if needed:
  `eval () => { localStorage.setItem('qarz.language','ru'); localStorage.setItem('qarz.theme','light') }`
  then `quit` and `launch` again (localStorage's `getInitialTheme`/
  `initialLanguage` are read once at module load, so changes need a
  fresh launch — not just an in-page hash change — to take effect).
- **Selectors must be scoped past the header.** The top bar has its own
  `<select>` elements (branch switcher, language) that match generic
  `select` queries before the page's own sort/filter dropdowns do. Use
  `select[aria-label="..."]` (each dropdown has a distinct aria-label)
  rather than positional indexing.
- **Text-matching is substring-based in `click-text`.** "Клиент" matches
  the sidebar nav link "Клиенты" (which appears first in DOM order)
  before it matches the "Добавить клиента" button. Prefer an exact
  string that doesn't collide, or scope the search root.
