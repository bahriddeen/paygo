# Manual testing checklist

A page-by-page walkthrough for testing Qarz Daftari by hand before a
release. Automated tests (`npm test`) cover calculation logic; this
checklist covers things only a human (or a driven browser) can catch —
UI behavior, flows across screens, and the three languages.

Use `npm run dev`, or drive it programmatically with
`.claude/skills/run-desktop/driver.mjs` (see that SKILL.md for gotchas —
notably: **HashRouter**, so only hash changes should navigate, never a
full page reload, or you'll hit the PIN lock screen again).

## 1. Activation & lock screen

- [ ] Fresh profile (no `userData` dir, or `--user-data-dir` pointed at an
      empty folder) shows the **activation screen** first, not the app.
- [ ] Pasting a real minted code (`npm run mint -- 1`) activates and moves
      to PIN setup.
- [ ] Pasting garbage / an expired-format code is rejected with an error,
      doesn't crash.
- [ ] The Telegram contact link on the activation screen opens
      `t.me/talk2bahriddin_bot` in the OS browser, not in-app.
- [ ] Entering the master code (`20040325`) activates instantly, bypassing
      verification.
- [ ] After activation, set a PIN — app unlocks and shows the dashboard.
- [ ] Quit and relaunch — PIN screen appears again (not activation).
- [ ] Wrong PIN is rejected; correct PIN unlocks.
- [ ] "Forgot PIN?" link → entering the master code lets you set a brand
      new PIN, which then works on the next lock.
- [ ] "Forgot PIN?" with a wrong code stays locked.

## 2. Demo data & Start button

- [ ] On a genuinely fresh profile, first launch (after activation + PIN)
      shows **15 demo clients, 5 demo suppliers, and 100 demo transactions**
      already populated — dashboard, Clients, Suppliers, Statistics, and
      Reminders should all show real-looking (fake) activity, not empty
      states.
- [ ] Demo transaction dates are relative to **today**, not a fixed date —
      some should show as overdue, some due soon, matching whatever "today"
      actually is when you test.
- [ ] A red **"Начать работу"** button appears in the top bar, immediately
      to the left of the language selector.
- [ ] Clicking it **immediately** clears all demo data — no confirmation
      dialog (by design). Clients, Suppliers, and dashboard totals all go
      back to zero/empty.
- [ ] After clearing, the app reloads to the **PIN screen** (expected side
      effect of the reload-based refresh, same as the Delete Account
      flow) — re-entering the PIN lands on a clean, empty app.
- [ ] The red button is now **gone** and does not reappear on subsequent
      launches.
- [ ] Add a real client, then click Start (on a fresh profile where demo
      data still exists) — the real client must survive; only demo-tagged
      rows are removed.
- [ ] Quit and relaunch the app a second time on the *same* profile (before
      ever clicking Start) — demo data must **not** be re-seeded a second
      time on top of itself (still exactly 15/5/100).

## 3. Main dashboard

- [ ] Branch switcher lists branches and switching one reloads all
      figures scoped to that branch only (create a second branch and a
      client in each to confirm no cross-branch leakage).
- [ ] "Umumiy qoldiq qarz" (outstanding) shows one pill per currency, only
      for currencies with actual open lend debt.
- [ ] "Siz qarzdorsiz" (you owe / borrow total) likewise, per currency.
- [ ] "Bugungi to'lovlar" (today's payments) — record a payment on a
      **lend** transaction today, confirm it's counted; record a payment
      on a **borrow** (supplier) transaction today, confirm it is **not**
      counted here (money going out isn't "received").
- [ ] "Muddati o'tgan" (overdue) — create a debt due exactly today: not
      overdue yet. Create one due yesterday: overdue. Create one due
      tomorrow: not overdue, not "due soon" until within the reminder
      window.
- [ ] Clicking into Overdue / Today's Payments drill-down pages shows the
      matching filtered transaction/payment list, and the payments
      drill-down also excludes borrow-side payments.
- [ ] "New transaction" flow from the main page: pick a client, direction,
      currency, amount, issued/due dates — appears correctly afterward.

## 4. Clients

- [ ] List loads, search filters by name/phone, sort options (name /
      newest / trust) all work.
- [ ] Pagination works past one page (seed data with `npm run seed` to get
      volume).
- [ ] Add a client (name, phone, description, trust level 1–5, category).
- [ ] Edit a client, archive a client (archived clients disappear from the
      default list).
- [ ] Client detail page: balance summary, transaction history, add a
      lend transaction (defaults to `lend` direction), add an installment
      payment, edit a transaction, delete a transaction.
- [ ] Category manager: create/rename/delete a client category; confirm
      supplier categories don't show up here (separate `kind`).
- [ ] Sort-by-debt with clients holding **different currencies** ranks by
      their largest single-currency amount, not a nonsensical summed
      total.

## 5. Suppliers

Same checks as Clients, plus:

- [ ] New transaction from a supplier's detail page defaults to `borrow`
      direction (you owe them), not `lend`.
- [ ] Supplier categories are separate from client categories (add one of
      each with the same name — both should exist independently).
- [ ] Sidebar/nav label reads "Taminotchilar" in Uzbek (not the old
      "Yetkazib beruvchilar").

## 6. Transactions & payments

- [ ] Amount fields accept only numeric input (no letters, correct
      handling of thousands separators if used).
- [ ] Adding a payment larger than the remaining balance is rejected.
- [ ] Editing a transaction's amount below what's already been paid is
      rejected.
- [ ] Deleting a transaction also removes its payments (check the
      client's balance updates correctly after).
- [ ] Currency is inherited from the parent transaction on every payment
      and can't drift.

## 7. Statistics

- [ ] Totals (owed to you / debtor count / overdue) match the dashboard
      for the same branch.
- [ ] Date-range filter narrows the "Dinamika" chart correctly.
- [ ] Chart's "lent" and "paid" (collected) lines both only reflect
      **lend**-side activity — add a borrow payment inside the selected
      range and confirm the "paid" line doesn't move.
- [ ] "Eng ko'p qarzdorlar" (top debtors) ranks correctly per currency and
      excludes fully-settled clients.

## 8. Reminders & WhatsApp

- [ ] Reminder center groups overdue vs. due-soon debts, sourced only
      from lend-direction debts.
- [ ] With WhatsApp reminders disabled in Settings, no "Remind All" or
      per-row WhatsApp buttons appear anywhere on the Reminders page.
- [ ] With it enabled but **not connected**, clicking "Remind All" shows
      a prompt with "Send manually" (opens the old one-at-a-time
      click-to-chat queue) and "Connect WhatsApp" (jumps to Settings).
- [ ] Per-row single-debtor WhatsApp button always uses manual
      click-to-chat (`wa.me`), never auto-send, regardless of connection
      state — only the batch "Remind All" auto-sends.
- [ ] Message template is pre-filled and reflects the Settings template
      for the currently selected language.
- [ ] Editing the WhatsApp template in Settings changes what gets
      pre-filled on the next send.

### WhatsApp auto-send (unofficial — real ban risk, see INFO.md)

**Use a secondary/burner WhatsApp number for all of this, never a shop
owner's real one**, until the ban risk is better understood in practice.

- [ ] Settings → WhatsApp Template → enabling the toggle shows a
      "WhatsApp not connected" card with a Connect button.
- [ ] Clicking Connect shows a real, scannable QR code within a few
      seconds (this needs live internet access to WhatsApp's servers).
- [ ] Scanning it with a phone (WhatsApp → Linked Devices → Link a
      Device) flips the UI to "Connected: <phone number>" with a
      Disconnect button.
- [ ] Quit and relaunch the app — it should reconnect automatically
      without a fresh QR scan (session persisted at
      `userData/whatsapp-session/`).
- [ ] With it connected, "Remind All" opens the auto-send queue directly
      (no manual-vs-connect prompt) and sends each message with a
      20–60s randomized gap between them — confirm the delay is actually
      happening, not instant.
- [ ] Each row shows a spinner while sending, then a checkmark (sent) or
      an X (failed, e.g. an invalid/unregistered number) — one failure
      must not stop the rest of the batch.
- [ ] Cancel mid-batch stops before the next send and shows how many
      went out vs. total.
- [ ] Disconnect in Settings, then relaunch — should show "not
      connected" again (session file actually removed, not just the UI
      state).

## 9. Settings

- [ ] Switching language (ru/ky/uz) updates all visible UI text — check a
      few different pages after switching, not just Settings itself, and
      confirm no raw i18n keys are shown (a sign of a missing locale
      entry).
- [ ] Theme toggle (light/dark) persists across a relaunch.
- [ ] Change PIN (requires current PIN) — old PIN stops working, new PIN
      works.
- [ ] Branch management: create, rename, delete a branch (deleting a
      branch with data should be blocked or clearly warn — check current
      behavior).
- [ ] "Test Notification" button actually shows an OS notification
      (important on Windows specifically — silently no-ops without
      `setAppUserModelId`, already set, but worth confirming on a real
      Windows build).
- [ ] JSON export prompts a save dialog and writes a valid file.
- [ ] JSON import (merge mode) adds data without clobbering existing
      records; (replace mode) fully replaces branch data — test both on a
      throwaway profile.
- [ ] **Danger Zone — delete account**: on a throwaway profile only.
      Opening the confirmation modal shows the full-data-loss warning.
      Entering a wrong PIN shows an error and does not delete anything.
      Entering the correct PIN wipes the database file and the app
      relaunches to the **activation screen** (not the dashboard) — never
      run this against a real/production profile.
- [ ] Round-trip: export → import into a clean profile → data matches.
- [ ] Excel export opens in a spreadsheet app and shows the debtor list
      (name, phone, per-currency owed, overdue flag, oldest debt).
- [ ] Backup: choose a folder, "Backup now" writes a timestamped file
      there; scheduled backup runs automatically on launch when due.

## 10. Cross-cutting

- [ ] Overdue OS notification fires on launch when there's overdue debt
      (not just via the manual test button).
- [ ] No screen anywhere sums amounts across KGS/USD/UZS into one number.
- [ ] Dates display consistently as `DD.MM.YYYY` regardless of selected
      language (not a locale-dependent `Intl` format that can swap
      day/month for ky/uz).
- [ ] Navigating anywhere in-app never causes a full page reload / re-hit
      of the PIN lock screen (HashRouter only, no `location.href` or
      `<a>` navigations that reload the document).

## 11. Packaged build (Windows)

- [ ] Installer runs on a real Windows x64 machine/VM (not arm64), shows
      the SmartScreen "unknown publisher" warning if unsigned (expected
      until code-signed — see `BUILD.md`).
- [ ] Fresh install → activation → PIN → basic usage all work identically
      to the dev build.
- [ ] Uninstaller removes the app cleanly (NSIS `perMachine: false`, so
      confirm it targets the right per-user install).
