import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Machine } from '@aiot/shared'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS machines (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  line            TEXT NOT NULL,
  ideal_cycle_sec REAL NOT NULL
);

-- (machine_id, ts) is the clustered primary key: one machine's time range is
-- stored contiguously, which is exactly how the API reads it.
CREATE TABLE IF NOT EXISTS readings (
  machine_id   TEXT    NOT NULL REFERENCES machines(id),
  ts           INTEGER NOT NULL,
  temperature  REAL,
  vibration    REAL,
  spindle_load REAL,
  rpm          REAL,
  status       TEXT    NOT NULL,
  output       INTEGER NOT NULL,
  good         INTEGER NOT NULL,
  PRIMARY KEY (machine_id, ts)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts);

CREATE TABLE IF NOT EXISTS alert_rules (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id   TEXT REFERENCES machines(id),
  metric       TEXT    NOT NULL,
  op           TEXT    NOT NULL CHECK (op IN ('gt', 'lt')),
  threshold    REAL    NOT NULL,
  duration_sec INTEGER NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 1
);

-- Alerts keep a snapshot of the rule so history survives rule edits and deletes.
CREATE TABLE IF NOT EXISTS alerts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id    INTEGER NOT NULL,
  machine_id TEXT    NOT NULL,
  metric     TEXT    NOT NULL,
  op         TEXT    NOT NULL,
  threshold  REAL    NOT NULL,
  ts         INTEGER NOT NULL,
  value      REAL    NOT NULL,
  acked_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts(ts);
CREATE INDEX IF NOT EXISTS idx_alerts_open ON alerts(acked_at, ts);
`

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA synchronous = NORMAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)
  return db
}

export function seedMachines(db: DatabaseSync, machines: readonly Machine[]): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO machines (id, name, type, line, ideal_cycle_sec)
     VALUES (:id, :name, :type, :line, :idealCycleSec)`,
  )
  transaction(db, () => {
    for (const m of machines) insert.run({ ...m })
  })
}

/** Run `fn` inside BEGIN / COMMIT, rolling back on error. */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
