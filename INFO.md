# Important information

Operational and architectural reference for people (not just Claude Code)
working on this repo. This is a **private** repo — some of what's below is
sensitive (master codes, key locations) and should stay that way; don't
copy it into public docs, issues, or support channels.

## What this app is

An offline, local-first Windows desktop app for shop owners to track debts:
money/goods lent to customers, and money the shop itself borrows from
suppliers. No server, no accounts, no telemetry — everything lives in one
local SQLite file. Sold per-license, one activation code per shop.

## Architecture at a glance

Three Electron processes:

- **Main** (`src/main/`) — owns the SQLite DB, all business logic, IPC
  handlers, licensing, notifications, WhatsApp deep links, import/export.
  All SQL lives here.
- **Preload** (`src/preload/index.ts`) — the only bridge to the renderer.
  Exposes named domain methods (`window.api.clients.list(...)`) via
  `contextBridge`. Never raw `ipcRenderer`, never a generic SQL channel.
- **Renderer** (`src/renderer/src/`) — React + Tailwind, React Query for all
  data fetching, `react-i18next` for the UI, `HashRouter` for routing.

Full detail (IPC pattern, migration rules, testing conventions) is in
`CLAUDE.md` — written for Claude Code but equally useful as a technical
architecture doc for a human.

## Data model essentials

- One SQLite file per install, in `app.getPath('userData')`
  (`~/Library/Application Support/qarz-daftari/qarz.db` on macOS).
- Money is stored as **integer minor units** per currency — never floats,
  never converted or summed across currencies. KGS/USD/UZS are always kept
  as separate totals everywhere in the app (dashboard, statistics, exports).
- **Clients and Suppliers share one table** (`clients`, with a `kind`
  column: `'client' | 'supplier'`) and one engine
  (`src/renderer/src/features/people/`) rather than being separate
  subsystems — `ClientsPage` and `SuppliersPage` are thin wrappers around
  the same `PeopleListPage`.
- Every `payments` aggregate that represents "money received" **must**
  filter to `direction = 'lend'` on the parent transaction — a payment
  against a `borrow` (supplier) debt is money going *out*, not income. This
  has been a recurring bug source (dashboard today's-payments figure, the
  payments drill-down page, the statistics "paid" series were all fixed for
  this); check this whenever adding a new payments query.
- Migrations (`src/main/db/migrations.ts`) are append-only — never edit a
  shipped one.
- **When a migration adds a column, check `src/main/importexport/json.ts`
  too.** `kind` (v2) and `is_demo` (v3) both shipped without being added
  to `exportData`'s SELECTs or `importData`'s INSERTs — every supplier
  silently became a plain client on any export→import round-trip (JSON
  export, backup/restore, and merge/replace import all share this code
  path) since `kind` defaults to `'client'` on insert when omitted. Fixed,
  but the same class of bug will recur for any future column that isn't
  explicitly threaded through `BranchDump` and both directions of
  `dumpBranch()`/`insertBranchDump()`.

## Licensing

- Activation codes are Ed25519-signed, verified **fully offline**, and are
  **not device-bound** — a code works on any machine, and there's no
  revocation mechanism. This was an accepted trade-off for a fully offline
  product.
- The private signing key lives only at
  `tools/license-gen/keys/private.pem` (gitignored) and on whatever machine
  generated it. **Back this up outside the repo.** Losing it means you can
  never mint a code compatible with previously-shipped installs' embedded
  public key again.
- `codes.txt` at the repo root (also gitignored) holds previously-minted,
  real, sellable codes — treat it like a list of license keys, because it
  is one. Don't paste its contents anywhere public.
- Mint more with `npm run mint -- <count>`.

## The backdoor / master code

`src/main/backdoor.ts` defines a hardcoded master code:

```
20040325
```

Entering it on the **activation screen** activates the app instantly
(bypassing signature verification). Entering it on the **PIN lock
screen's "forgot PIN?" flow** lets you set a brand-new PIN without knowing
the old one.

This was added at the explicit, informed request of the product owner,
after being told clearly that it is a **permanent, unpatchable, shared
secret**: because Electron apps ship their JS unencrypted and are trivially
unpacked, this code is extractable from any installed copy by a motivated
user, and — because there's no server component — it can never be revoked
or rotated without shipping a whole new build to every customer. It
defeats both the paid-activation model and the PIN lock for anyone who
finds it.

**Do not remove, "fix," or change this without explicit direction** — it's
intentional, not an oversight, and future sessions (human or Claude) should
not treat it as a vulnerability to silently patch.

## Settings keys (`app_settings` table)

Single-row key/value store, accessed via `settings:getAll` / `settings:set`
IPC. Known keys: `default_currency`, `wa_template_ru`, `wa_template_ky`,
`wa_template_uz`, `backup_folder`, `backup_schedule`, `backup_last`, plus
internal ones set outside the Settings UI: `activation_code_id`,
`activated_at`, PIN hash/salt (see `src/main/lock/pin.ts`).

## Backups & data portability

- **JSON export/import** — full-fidelity, schema-versioned, scoped to one
  branch or all. Import supports merge (remap IDs) or replace.
- **Excel export** — debtor list only (client, phone, owed per currency,
  overdue flag, oldest debt) via `exceljs`.
- **Scheduled local backup** — `runBackup()` writes a timestamped copy to a
  user-chosen folder on a schedule set in Settings; `maybeAutoBackup()` runs
  on app start if one is due.
- The database itself is **not encrypted at rest** — the PIN only gates the
  app's UI. Anyone with filesystem access to `qarz.db` can read it directly.
  This is a known, accepted limitation (documented in the original design
  plan), not a bug.
- **Factory reset ("Delete account")**: Settings → Danger Zone. Requires the
  current PIN, shows a full-data-loss warning, then wipes every table via
  SQL on the live connection (`wipeDatabase()`, `src/main/db/reset.ts`),
  reseeds the one default branch, **re-seeds demo data**
  (`maybeSeedDemoData()`), and **reloads the window in place** so the app
  comes back up on the activation screen exactly as if freshly installed
  (activation, PIN, all branches/clients/transactions — everything is
  gone, replaced by demo data once re-activated). There is **no undo**
  and **no export prompt on the way out** — if the shop owner wants their
  data first, they need to export JSON *before* using this. Only ever
  test this against a throwaway profile, never a real one.
  - Deliberately wipes data via `DELETE FROM` on the same live connection
    rather than closing the connection and deleting/recreating the SQLite
    file. An earlier version did close+unlink+reopen (and, separately,
    reloaded via `webContents.reload()` rather than `app.relaunch()` for
    the dev-mode reasons below) — that unlink reliably threw `EBUSY` on
    Windows CI, even through a ~3.75s retry-with-backoff window. This
    isn't a timing race: `node:sqlite` is still experimental and its
    `close()` does not reliably release the file handle on Windows before
    an immediate unlink, so no amount of retrying fixes it. Wiping rows in
    place never touches file-handle lifecycle at all, sidestepping the
    problem entirely — same technique `clearDemoData()` already used
    safely. **Don't reintroduce close+delete+reopen here.**
  - The window-reload approach itself (vs. `app.relaunch() + app.exit()`)
    is unrelated and still correct: relaunch spawns a whole new OS
    process, and on macOS that goes through Launch Services, which
    doesn't reliably pass through `ELECTRON_RENDERER_URL` (the dev server
    URL `electron-vite dev` sets) — the relaunched instance then had
    nothing to load in `npm run dev` (`out/renderer/index.html` doesn't
    exist outside a production build) and showed a blank window. Reloading
    the existing window's already-loaded URL has no such dependency and
    behaves identically in dev and prod. Don't reintroduce relaunch here
    either.

## Demo data on first launch

A genuinely fresh install auto-seeds **15 demo clients, 5 demo suppliers,
and 100 demo transactions** (`src/main/db/demoSeed.ts`, triggered once from
`main/index.ts` via `maybeSeedDemoData()`) so the app isn't an empty shell
on first open — dates are generated relative to `Date.now()` at seed time,
not hardcoded, so overdue/due-soon reminders look current whenever someone
actually installs the app.

- Every demo row is tagged `is_demo = 1` (migration v3, `clients` and
  `transactions`). A red **"Start"** button in the top bar (before the
  language selector) appears only while demo data exists; clicking it
  calls `clearDemoData()` **immediately, with no confirmation** (a
  deliberate choice — it only ever removes demo/fake data) and reloads the
  window, same reload pattern as the account-reset feature. Note this
  means the **PIN screen reappears** after clearing, since reload
  re-mounts the whole app — that's expected, not a bug.
- Seeding is guarded by a `demo_seeded` setting so it only ever happens
  once per install, even if the shop owner later deletes all their real
  data — it will not come back.
- `clearDemoData()` is careful about a demo client that's since gained a
  **real** (non-demo) transaction: it deletes that client's demo
  transactions but keeps the client itself, since deleting it would
  either orphan real data or hit the `ON DELETE RESTRICT` FK constraint
  on `transactions.client_id`.
- Demo data is invisible to the "Delete account" factory reset's warning
  copy and to backups — it's just regular rows with a flag, included in
  JSON export/import like anything else. If a shop owner exports before
  clicking Start, their backup will include the demo data too.

## WhatsApp auto-send (unofficial, opt-in, ban risk)

`src/main/whatsapp/client.ts` uses **Baileys** (`@whiskeysockets/baileys`) to
link the shop owner's own WhatsApp as a "linked device" (same mechanism as
WhatsApp Web — QR code scan) and send batch reminders programmatically, with
no manual "Send" click needed in WhatsApp itself.

**This is explicitly against WhatsApp's Terms of Service.** It was built at
the user's explicit request after being told clearly that: (a) there is no
officially-supported way to skip the manual send click on `wa.me` links —
that's WhatsApp's own anti-spam design, not a limitation we're working
around; (b) the only ways to truly automate sending are this unofficial
route (free, ban risk) or the official WhatsApp Business Platform (Meta
verification, dedicated business number, paid per-conversation, needs live
internet). The user chose the unofficial route, informed of the risk.

- **Ban-risk mitigation**: `sendBatch()` enforces a randomized delay
  (currently hardcoded 20–60s, matching what the user asked for) between
  each message in a batch — this is a mitigation, not a guarantee. Batch-
  sending to many different people in a row is exactly the pattern
  WhatsApp's abuse detection targets. If banned, the shop owner loses
  WhatsApp entirely on that number, not just this feature.
- **Recommend testing with a secondary/burner WhatsApp number first**,
  never a shop owner's primary personal/business number, until real-world
  send volume and ban risk are better understood.
- **Version pin matters**: `@whiskeysockets/baileys` is pinned to
  `^6.7.24` (the `legacy` dist-tag), not the newer `6.17.x`/`7.0.0-rc*`
  line. `6.17.16` looked newer by version number but is actually an
  abandoned branch still affected by a message-spoofing zero-day
  (GHSA-qvv5-jq5g-4cgg); `6.7.24` is the maintained, patched line and also
  avoids a Rust/WASM native bridge dependency the newer line pulls in.
  Don't "helpfully" bump this to the highest-numbered version without
  re-checking the advisory and dependency tree.
- **Module loading**: `@whiskeysockets/baileys` is ESM-only
  (`"type": "module"`) while the main process builds to CJS. `client.ts`
  loads it via a **dynamic** `await import(...)` inside `connectWa()`,
  never a static top-level import — a static import would get compiled to
  a CJS `require()` by the bundler, which can fail against an ESM-only
  package depending on the Node/Electron version's `require(esm)` support.
  Dynamic `import()` works from CJS regardless of that.
- **Session storage**: auth credentials persist at
  `userData/whatsapp-session/` (Baileys' `useMultiFileAuthState`), separate
  from the SQLite DB — not included in JSON export/import or Excel export,
  and deleted on disconnect (`logoutWa()`). Treat it like a login session:
  don't back it up, don't copy it between machines.
- **No recurring/scheduled auto-send** — explicitly skipped per the user's
  answer when this was discussed, given the app also has no background
  process (see below), so "recurring" could only ever mean "check on
  next launch," which the user chose to skip for now rather than build.
- The delay range (20–60s) is currently hardcoded in
  `AutoSendQueue.tsx`/`sendBatch` calls, not a Settings field. Worth
  exposing as a Settings control if the user wants it configurable later.
- **`connectWa()` has a 25s timeout, error surfacing, and a 3-strikes cap
  on silent auto-reconnect.** The original version had none of these: any
  failure during setup (a thrown exception, or Baileys just never firing
  a `connection.update` event at all) left the module-level `connecting`
  flag stuck `true` forever, permanently disabling the Connect button
  with no recovery except restarting the whole app. `WaStatus` now
  carries an `error` field; Settings shows it with a **Reset** button
  (reuses `logoutWa()` — clears the session dir and all in-flight state)
  so a stuck/corrupted session is always recoverable from the UI. Tested:
  a fully-corrupted `creds.json` doesn't even need this — Baileys/
  `useMultiFileAuthState` already self-heals from that specific case and
  issues a fresh QR — but the timeout+error path is what protects against
  whatever *doesn't* self-heal (a true network-level hang, an
  unanticipated Baileys internal error, etc.), which the old code had no
  defense against at all.

## Product decisions worth knowing (so they don't get "fixed")

- **No cross-currency conversion anywhere**, by design — KGS/USD/UZS are
  treated as genuinely non-fungible. Any UI or calculation that sums them
  together is a bug, not a feature.
- **Branches are fully siloed** — the same real person in two branches is
  two separate client rows on purpose.
- **Overdue** is computed from local midnight of "today"
  (`startOfDaySec()`), not the exact current timestamp — a debt due today
  isn't overdue until the day is over.
- **Uzbek terminology**: suppliers are labeled "Taminotchi(lar)" in the
  Uzbek locale (renamed from an earlier "Yetkazib beruvchi(lar)").
- WhatsApp reminders use plain `wa.me` click-to-chat links opened via
  `shell.openExternal` — not the WhatsApp Business API. Sending many at
  once is intentionally throttled/queued in the UI rather than opening
  dozens of tabs at once (a bug that was fixed).

## Contact / activation screen

The activation screen shows a Telegram contact link
(`t.me/talk2bahriddin_bot`) for customers who need help — this is the
product owner's chosen support channel, deliberately Telegram-only.

## Where to look next

- `CLAUDE.md` — architecture, IPC pattern, testing conventions, gotchas
  (written for AI agents, but accurate and current for humans too).
- `SETUP.md` — day-to-day dev setup and workflow.
- `BUILD.md` — Windows installer build + code signing.
- `.claude/skills/run-desktop/SKILL.md` — how to launch and drive the real
  app for manual testing (Playwright `_electron` driver), including the
  `HashRouter` reload trap and other UI-testing gotchas.
