import type { DatabaseSync } from 'node:sqlite'

/**
 * Ordered migrations. Each entry's index+1 is its target user_version.
 * Never edit a shipped migration — append a new one.
 */
const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  CREATE TABLE branches (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE client_groups (
    id        INTEGER PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name      TEXT NOT NULL
  );

  CREATE TABLE clients (
    id          INTEGER PRIMARY KEY,
    branch_id   INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    group_id    INTEGER REFERENCES client_groups(id) ON DELETE SET NULL,
    name        TEXT NOT NULL,
    phone       TEXT,
    description TEXT,
    trust_level INTEGER NOT NULL DEFAULT 3 CHECK (trust_level BETWEEN 1 AND 5),
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    archived_at INTEGER
  );
  CREATE INDEX idx_clients_branch_name ON clients(branch_id, name);

  CREATE TABLE transactions (
    id          INTEGER PRIMARY KEY,
    branch_id   INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    direction   TEXT NOT NULL CHECK (direction IN ('lend','borrow')),
    amount      INTEGER NOT NULL CHECK (amount > 0),
    currency    TEXT NOT NULL CHECK (currency IN ('KGS','USD','UZS')),
    description TEXT,
    issued_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    due_at      INTEGER,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX idx_txn_branch_client ON transactions(branch_id, client_id);
  CREATE INDEX idx_txn_due ON transactions(branch_id, due_at);

  CREATE TABLE payments (
    id             INTEGER PRIMARY KEY,
    branch_id      INTEGER NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    amount         INTEGER NOT NULL CHECK (amount > 0),
    currency       TEXT NOT NULL CHECK (currency IN ('KGS','USD','UZS')),
    method         TEXT,
    note           TEXT,
    paid_at        INTEGER NOT NULL DEFAULT (unixepoch()),
    created_at     INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX idx_pay_txn ON payments(transaction_id);
  CREATE INDEX idx_pay_branch_date ON payments(branch_id, paid_at);

  CREATE TABLE app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  -- Seed a default branch so the app has something to scope to on first run.
  INSERT INTO branches (name) VALUES ('Asosiy');
  `,

  // v2 — suppliers: a client row can represent either a customer or a
  // supplier; existing rows default to 'client'. Categories are scoped the
  // same way so folders don't mix between the two sections.
  `
  ALTER TABLE clients ADD COLUMN kind TEXT NOT NULL DEFAULT 'client' CHECK (kind IN ('client','supplier'));
  ALTER TABLE client_groups ADD COLUMN kind TEXT NOT NULL DEFAULT 'client' CHECK (kind IN ('client','supplier'));
  CREATE INDEX idx_clients_branch_kind ON clients(branch_id, kind);
  `,

  // v3 — demo data marker. A brand-new install is auto-seeded with sample
  // clients/suppliers/transactions (see src/main/db/demoSeed.ts) so the
  // dashboard isn't empty on first launch; these rows are tagged so the
  // "Start" button in the top bar can remove exactly them, and only them.
  `
  ALTER TABLE clients ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE transactions ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
  `
]

export function runMigrations(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
  let version = row.user_version

  for (let i = version; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[i])
      // PRAGMA user_version does not accept bound params.
      db.exec(`PRAGMA user_version = ${i + 1}`)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    version = i + 1
  }
}
