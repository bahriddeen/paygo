# Qarz Daftari

Offline, local-first desktop debt ledger for shop owners. Track money and
goods lent to customers *and* money the shop borrows from suppliers, across
three currencies, with no internet connection required at any point.

Built with Electron on macOS, shipped as a Windows x64 installer, sold
per-license via offline activation codes.

## Features

- **Bidirectional ledger** — `lend` (customer owes the shop) and `borrow`
  (shop owes a supplier), tracked and totaled separately.
- **Clients & Suppliers** — same underlying engine, separate sections.
- **Multi-currency** — KGS, USD, UZS, each tracked independently (amounts are
  never summed or converted across currencies).
- **Installments** — partial payments against any debt, with running balance.
- **Branches** — fully siloed clients/transactions per branch, with a
  switcher.
- **Dashboard & statistics** — outstanding totals, overdue debts, today's
  payments, a debt-over-time chart, top debtors.
- **Reminders** — an in-app reminder center, native OS notifications, and
  WhatsApp reminders (opt-in, off by default): one-tap click-to-chat for a
  single debtor, or batch auto-send for "Remind All" once WhatsApp is
  linked (see [INFO.md](INFO.md) for the ban-risk tradeoffs of auto-send).
- **Import / export** — full-fidelity JSON backup (merge or replace on
  import), Excel debtor list export, and scheduled local backups.
- **Trilingual UI** — Russian, Kyrgyz, Uzbek.
- **Offline licensing** — Ed25519-signed activation codes, verified with no
  network call. A 4-digit PIN gates the app on launch.

## Tech stack

Electron (`electron-vite`) · React 19 + TypeScript · Tailwind CSS v4 ·
`node:sqlite` (built-in, no native module) · React Query · `react-i18next` ·
`recharts` · `exceljs` · Vitest.

## Quick start

```bash
npm install
npm run license:keygen   # one-time: generates the activation signing keypair
npm run dev               # launches the app
```

On first launch you'll hit the activation screen — mint a code for yourself
with `npm run mint -- 1` and paste it in.

See **[SETUP.md](SETUP.md)** for the full setup guide (prerequisites, dev
workflow, testing, seeding demo data, building the Windows installer),
**[INFO.md](INFO.md)** for architecture notes, data model, and operational
details worth knowing before you touch licensing, the lock screen, or backups,
and **[TESTING.md](TESTING.md)** for the manual QA checklist to run through
before a release.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app in development (hot-reloads the renderer) |
| `npm run build` | Production build to `out/` |
| `npm run build:win` | Build + package the Windows x64 NSIS installer to `release/` |
| `npm run typecheck` | Type-check main/preload and renderer |
| `npm test` | Run the test suite (Vitest) |
| `npm run license:keygen` | Generate a new activation signing keypair (one-time) |
| `npm run mint -- <count>` | Mint `<count>` activation codes |
| `npm run seed` | Populate the app's real local database with demo data |

## Project layout

```
src/
  main/        # Electron main process — DB, business logic, IPC handlers, licensing
  preload/     # contextBridge API surface — the only renderer/main bridge
  renderer/    # React app (UI)
  shared/      # Types/utilities shared by main and renderer
tools/
  license-gen/ # CLI to generate the signing keypair and mint activation codes
  seed/        # Demo-data seeder
  icon/        # App icon generator
```

For the deeper architectural picture (IPC pattern, data model, migration
rules, security-sensitive code), see **[INFO.md](INFO.md)**. Claude Code
instances working in this repo should also read `CLAUDE.md`.

## License

Proprietary / unlicensed — see `package.json`.
