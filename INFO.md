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
  current PIN, shows a full-data-loss warning, then permanently deletes the
  SQLite file (and WAL/SHM siblings — `src/main/db/reset.ts`) and restarts
  the app, which comes back up on the activation screen exactly as if
  freshly installed (activation, PIN, all branches/clients/transactions —
  everything is gone). There is **no undo** and **no export prompt on the
  way out** — if the shop owner wants their data first, they need to export
  JSON *before* using this. Only ever test this against a throwaway
  profile, never a real one.

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
