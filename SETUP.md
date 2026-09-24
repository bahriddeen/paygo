# Setup guide

## Prerequisites

- **Node.js ≥ 22.14.0** (Electron ≥ 36, which this project pins, bundles a
  Node new enough for `node:sqlite` without the `--experimental-sqlite`
  flag). Any recent Node 22/24 works — developed against Node 24.
- **macOS or Windows** to run the app in dev. Building the Windows installer
  is possible from macOS but is smoother on Windows/CI (see below).
- No database server, no native build toolchain — `node:sqlite` is built
  into Electron and every other dependency is pure JS.

## 1. Install dependencies

```bash
npm install
```

## 2. Generate the license signing keypair (one-time)

The app can't activate without an embedded public key, and you can't mint
codes without the matching private key:

```bash
npm run license:keygen
```

This writes:
- `tools/license-gen/keys/private.pem` — **secret, gitignored.** Signs every
  activation code. Back it up somewhere safe outside the repo; if it's lost,
  every previously-sold code still works but you can never mint new ones
  with the same key (customers would need new codes from a new key, and old
  and new codes wouldn't be interchangeable).
- `src/main/license/publicKey.ts` — committed, shipped in the app.

Only run this once per key generation you actually intend to keep. Re-running
it overwrites both files with a brand-new keypair.

## 3. Run in development

```bash
npm run dev
```

electron-vite opens the app with hot module reload for the renderer. On
first launch (fresh `userData` profile) you'll see the **activation screen**:

```bash
npm run mint -- 1        # prints one activation code to stdout
```

Paste the code in. You'll then be asked to set a 4-digit PIN — this gates
the app on every subsequent launch.

> **Main-process changes need a manual restart.** electron-vite hot-reloads
> the renderer automatically but does not reliably restart the main
> process. If you edit anything under `src/main/**` (IPC handlers,
> repositories, migrations, licensing, etc.) and see errors like `No
> handler registered for 'clients:list'`, stop the dev server (Ctrl+C) and
> run `npm run dev` again.

## 4. Seed demo data (optional)

To populate the app's real local database with realistic demo data (varied
open/partial/paid/overdue debts, borrows, all three currencies):

```bash
npm run seed                    # 50 clients, 500 transactions (defaults)
npm run seed -- 20 200          # or specify counts
```

This writes directly into the same SQLite file the running app uses
(`~/Library/Application Support/qarz-daftari/qarz.db` on macOS — see
`tools/seed/seed.ts` for the path logic, overridable via `QARZ_DB`). Run it
against a throwaway profile if you don't want to mix demo data into a real
one — see `.claude/skills/run-desktop/SKILL.md` for how to launch with an
isolated `--user-data-dir`.

## 5. Type-check and test

```bash
npm run typecheck     # tsc, both main/preload and renderer configs
npm test               # vitest run — all tests
npx vitest run src/main/db/repositories/stats.test.ts   # a single file
npx vitest run -t "paid excludes payments"                # a single test by name
```

Repository/business-logic tests run against an in-memory `node:sqlite`
database with real migrations applied, not mocks.

## 6. Build

```bash
npm run build          # electron-vite build -> out/main, out/preload, out/renderer
npm run preview        # preview the production build
```

## 7. Build the Windows installer

Full details and code-signing notes live in **[BUILD.md](BUILD.md)**.
Summary:

- **Recommended:** push a version tag (`vX.Y.Z`) or run the
  `Build Windows installer` GitHub Actions workflow manually — it builds
  natively on `windows-latest`, no Wine involved, and uploads the installer
  as a workflow artifact.
- **From macOS:** `brew install --cask wine-stable`, then
  `npm run build:win`. Produces
  `release/Qarz Daftari-<version>-x64-setup.exe`.

The CLI build refuses to run in CI if `src/main/license/publicKey.ts` is
missing — that file must be generated locally (step 2) and committed before
the first build.

## Troubleshooting

- **`ERESOLVE` / peer dependency conflicts on install** — this project pins
  `vite@^7` and `@vitejs/plugin-react@^5` specifically for compatibility
  with `electron-vite@5`. Don't bump either independently without checking
  they still resolve together.
- **Notifications don't appear on Windows** — requires
  `app.setAppUserModelId()`, already set in `src/main/index.ts`; if you're
  debugging this, use the "Test Notification" button in Settings rather
  than waiting for a real overdue/reminder trigger.
- **Electron's binary fails to download during `npm install`** — usually a
  network/proxy issue reaching Electron's CDN; retry, or run
  `node node_modules/electron/install.js` manually once the network is
  reachable.
