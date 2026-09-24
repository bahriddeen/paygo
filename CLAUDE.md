# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Qarz Daftari — an **offline, local-first desktop debt ledger** for shop owners (React/Electron, built on macOS, shipped as a Windows x64 installer). Sold per-license via offline, Ed25519-signed activation codes. Every transaction is either `lend` (a customer owes the shop) or `borrow` (the shop owes a supplier/counterparty) — see Data model below.

## Commands

```bash
npm run dev              # electron-vite dev (hot-reloads renderer; main process needs a manual restart — see Gotchas)
npm run build             # electron-vite build -> out/main, out/preload, out/renderer
npm run typecheck         # both of the below
npm run typecheck:node    # tsc -p tsconfig.node.json --noEmit  (main + preload)
npm run typecheck:web     # tsc -p tsconfig.web.json --noEmit   (renderer)
npm test                  # vitest run (all tests)
npx vitest run src/main/db/repositories/stats.test.ts   # single file
npx vitest run -t "paid excludes payments"               # single test by name
npm run build:win         # electron-vite build + electron-builder --win --x64 (needs Wine on macOS; see BUILD.md)
npm run license:keygen    # one-time: generate Ed25519 keypair for activation codes (see Licensing below)
npm run mint -- 100 > codes.txt   # mint 100 activation codes
npm run seed               # seed dev data (tools/seed/seed.ts)
```

There is no lint script configured; rely on `npm run typecheck` and `npm test`.

### Running the app interactively

Use the `run-desktop` skill (`.claude/skills/run-desktop/`) — it drives the real Electron app via a Playwright `_electron` REPL (`driver.mjs`). Read that SKILL.md before driving the UI; it documents the HashRouter reload trap, header-vs-page `<select>` collisions, and localStorage-persisted language/theme across launches.

## Architecture

Three Electron processes wired by `electron-vite`, all under `src/`:

- **`src/main/`** — owns the SQLite database, all business logic, license verification, file I/O, OS notifications, WhatsApp deep-link launching. **All SQL lives here.** Entry point `src/main/index.ts` (single-instance lock, `app.setAppUserModelId` — required on Windows or notifications silently no-op, window creation with `HashRouter`-compatible `loadFile`).
- **`src/preload/index.ts`** — the *only* bridge between renderer and main: `contextBridge.exposeInMainWorld('api', …)`. Named domain methods only (`window.api.clients.list(...)`, `window.api.lock.verify(...)`, etc.) — **never raw `ipcRenderer` and never a generic "run SQL" channel**. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. `AppApi` type is exported from here for the renderer.
- **`src/renderer/src/`** — React + Tailwind + shadcn/ui-style components, React Query for all IPC calls, `react-i18next` for the trilingual UI. Uses `HashRouter` — **critical**: a full page reload re-triggers the PIN lock screen, so in-app navigation and any programmatic navigation must change `location.hash`, never do a full document load.

### IPC pattern (applies to every domain)

Renderer calls `window.api.<domain>.<method>()` → preload does `ipcRenderer.invoke('<domain>:<method>', input)` → main handler in `src/main/ipc/index.ts` validates input with a zod schema from `src/main/ipc/schemas.ts`, calls a repository function, returns plain data. Repositories (`src/main/db/repositories/*.ts`) use bound `?` parameters only, never string-concatenated SQL. When adding a new IPC channel: add the zod schema, register the handler in `registerIpc()`, add the typed method to the `api` object in `src/preload/index.ts`, and re-export any new types from there too — the renderer only sees what's re-exported from preload.

### Data model (`src/main/db/migrations.ts`)

Single SQLite file (`node:sqlite`, no native module) in `app.getPath('userData')`, opened once via `src/main/db/connection.ts` (`initDb()`/`getDb()`). Migrations are an **append-only array** — each array index+1 is its target `PRAGMA user_version`; never edit a shipped migration, only append a new one.

- **Branches** (`branches`) silo everything — nearly every query is scoped by `branch_id`.
- **`clients`** table is shared by both Clients and Suppliers via a `kind` discriminator column (`'client' | 'supplier'`, added in migration v2) rather than duplicating the schema/engine — see `src/renderer/src/features/people/` (`PeopleListPage`, `PersonDetail`, `PersonForm`, `CategoryManager`) which both `ClientsPage.tsx` and `SuppliersPage.tsx` are thin wrappers around (`<PeopleListPage kind="client|supplier" />`). `client_groups` (folders/categories) carries the same `kind` tag so client and supplier categories don't mix.
- **`transactions`**: `direction` is `'lend'` or `'borrow'`, `amount` is an **INTEGER in minor units** (never float/REAL) with an explicit `currency` (`KGS`/`USD`/`UZS`). **Balances across currencies are never summed or converted** — every dashboard/summary figure is a per-currency array (`CurrencyAmount[]`), by design.
- **`payments`** are installments against a transaction, inheriting its currency. **Any query aggregating `payments` for a "money received" figure must filter by the parent transaction's `direction = 'lend'`** — a payment on a `borrow` transaction is money going *out* to a supplier, not income. This exact bug (unfiltered payments queries silently mixing the two) has recurred multiple times (dashboard "today's payments", the payments drill-down page, the statistics "paid" series) — when touching any `payments` aggregate, check whether it needs the `JOIN transactions ... WHERE t.direction = 'lend'` guard, following the pattern already in `src/main/db/repositories/summary.ts`, `payments.ts` (`listBranchPayments`), and `stats.ts` (`debtSeries`).
- **Overdue** = `direction='lend' AND remaining>0 AND due_at < startOfDaySec(now)` — uses `startOfDaySec()` from `src/main/db/repositories/dateUtil.ts` (local midnight), **not** a raw `< now` comparison, so a debt due "today" isn't overdue until the day is over.
- Derived balances (`remaining`, per-currency totals) are always computed via `SUM(amount) - SUM(payments)` at query time, never cached in a column.

### Licensing & lock screen (security-sensitive — read before touching)

- **Activation**: `tools/license-gen/` is a standalone CLI holding the **private** Ed25519 key (`tools/license-gen/keys/private.pem`, gitignored — regenerate via `npm run license:keygen`, which also rewrites the embedded public key at `src/main/license/publicKey.ts`, which *is* committed). Codes are minted offline (`npm run mint`) and verified offline in `src/main/license/index.ts` — no network calls, not device-bound, no revocation.
- **PIN lock**: 4-digit PIN, scrypt-hashed with constant-time comparison (`src/main/lock/`). Gates app UI only — the SQLite file itself is **not encrypted at rest**.
- **`src/main/backdoor.ts`**: a hardcoded master code (`BACKDOOR_CODE`) that both bypasses activation and resets the PIN. This was added at the explicit, informed request of the product owner after being warned it's a permanent, unpatchable shared secret (Electron apps are trivially unpacked). **Do not remove, "fix", or silently change this without the user's explicit direction** — it's intentional, not an oversight. Keep `isBackdoorCode()` as the single source of truth so activation and PIN recovery can't drift apart.

### i18n

`react-i18next` with three locale files under `src/renderer/src/locales/`: `ru.json` (Russian), `ky.json` (Kyrgyz), `uz.json` (Uzbek). Keep key parity across all three when adding UI strings — missing keys fail silently (render the key name), so add a key to all three files together.

## Testing conventions

- Vitest, colocated `*.test.ts` next to the module it tests (e.g. `src/main/db/repositories/stats.test.ts`). Main-process/business-logic changes are expected to follow TDD: write a failing test first, confirm it fails for the right reason, then implement.
- Repository tests use an in-memory `node:sqlite` database (`createDatabase(':memory:')`) with real migrations applied — not mocks.
- `*.test.ts` files are excluded from both `tsconfig.node.json` and `tsconfig.web.json` (typecheck runs against source only; vitest handles test compilation separately).

## Packaging

`electron-builder.yml` targets `win`/`x64` only (`--win --x64` is also passed explicitly on the CLI so an arm64 build is never produced by accident on Apple Silicon). No native modules (`node:sqlite` is built into Electron ≥36, `exceljs` is pure JS), so there's no rebuild step. See `BUILD.md` for the full flow, code-signing notes, and why building on Windows/CI (`.github/workflows/build-win.yml`) is preferred over cross-building with Wine from macOS.

## Gotchas

- **Main-process changes need a manual restart.** `electron-vite dev` hot-reloads the renderer but does not reliably restart the main process on changes to `src/main/**` — after editing IPC handlers, repositories, migrations, etc., Ctrl+C and re-run `npm run dev`, or stale handlers ("No handler registered for 'x:y'") will appear.
- **Never sum amounts across currencies.** KGS/USD/UZS are not fungible in this app; always keep per-currency arrays/pills in both backend aggregation and UI, and sort by a single representative currency amount rather than a summed total when ranking mixed-currency records.
- **`node:sqlite` requires Electron ≥ 36** (bundles Node ≥ 22.14.0) to work without the `--experimental-sqlite` flag.
