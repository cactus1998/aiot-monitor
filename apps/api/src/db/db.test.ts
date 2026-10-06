import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { HOUR, SECOND } from '@aiot/shared'
import { MACHINES } from '@aiot/simulator'
import { StreamHub } from '../services/hub.ts'
import { Ingestor } from '../services/ingest.ts'
import { createAlertsRepo } from './alerts.ts'
import { openDatabase, seedMachines } from './database.ts'
import { createReadingsRepo } from './readings.ts'

const NOW = Date.UTC(2026, 9, 6, 4, 0)
const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function ingestor(db: DatabaseSync, now = NOW) {
  seedMachines(db, MACHINES)
  const hub = new StreamHub()
  return {
    hub,
    ingest: new Ingestor({
      readings: createReadingsRepo(db),
      alerts: createAlertsRepo(db),
      hub,
      seed: 42,
      backfillHours: 24,
      writeIntervalSec: 10,
      retentionHours: 24,
      now: () => now,
    }),
  }
}

describe('node:sqlite', () => {
  it('runs in Vitest with an in-memory database', () => {
    const db = new DatabaseSync(':memory:')
    expect(db.prepare('SELECT sqlite_version() AS v').get()).toHaveProperty('v')
    db.close()
  })
})

describe('storage', () => {
  // AC-01
  it('backfills 24 hours at one-minute steps on an empty database', () => {
    const db = openDatabase(':memory:')
    const { ingest } = ingestor(db)
    const t0 = Date.now()
    ingest.init()
    expect(Date.now() - t0).toBeLessThan(3000)
    expect(createReadingsRepo(db).count()).toBe(24 * 60 * 8)
    expect(createAlertsRepo(db).listRules()).toHaveLength(3)
  })

  // AC-02, EC-02
  it('keeps data across restarts and continues counters without backfilling again', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aiot-'))
    dirs.push(dir)
    const path = join(dir, 'nested', 'aiot.db')

    let db = openDatabase(path)
    ingestor(db).ingest.init()
    const alerts = createAlertsRepo(db)
    const rule = alerts.createRule({
      machineId: null,
      metric: 'rpm',
      op: 'gt',
      threshold: 1,
      durationSec: 0,
      enabled: false,
    })
    const alert = alerts.insertAlert({
      ruleId: rule.id,
      machineId: 'CNC-01',
      metric: 'rpm',
      op: 'gt',
      threshold: 1,
      ts: NOW,
      value: 2,
    })
    alerts.ack(alert.id, NOW)
    const before = createReadingsRepo(db).latestPerMachine()
    const count = createReadingsRepo(db).count()
    db.close()

    db = openDatabase(path)
    const { ingest } = ingestor(db, NOW + 60 * SECOND)
    ingest.init()
    expect(createReadingsRepo(db).count()).toBe(count)
    expect(createAlertsRepo(db).getRule(rule.id)).toBeDefined()
    expect(
      createAlertsRepo(db)
        .listAlerts({ status: 'acked', limit: 10 })
        .map((a) => a.id),
    ).toContain(alert.id)
    const next = ingest.tick(NOW + 61 * SECOND)
    next.forEach((r) => {
      const prev = before.find((b) => b.machineId === r.machineId)!
      expect(r.output).toBeGreaterThanOrEqual(prev.output)
    })
    db.close()
  })

  // EC-03
  it('backfills again when the stored data is older than the retention period', () => {
    const db = openDatabase(':memory:')
    ingestor(db, NOW - 30 * HOUR).ingest.init()
    const { ingest } = ingestor(db, NOW)
    ingest.init()
    expect(createReadingsRepo(db).latestTs()).toBe(NOW)
  })

  it('writes to the database every 10 seconds but publishes every second', () => {
    const db = openDatabase(':memory:')
    const { ingest, hub } = ingestor(db)
    ingest.init()
    const repo = createReadingsRepo(db)
    const before = repo.count()
    const events: number[] = []
    hub.subscribe((m) => m.type === 'reading' && events.push(m.data.ts))
    for (let s = 1; s <= 20; s++) ingest.tick(NOW + s * SECOND)
    expect(events).toHaveLength(20)
    expect(repo.count() - before).toBe(2 * 8)
    expect(ingest.latest()).toHaveLength(8)
  })

  // AC-04
  it('deletes only readings older than the cutoff', () => {
    const db = openDatabase(':memory:')
    ingestor(db).ingest.init()
    const repo = createReadingsRepo(db)
    const removed = repo.deleteBefore(NOW - 12 * HOUR)
    // Backfill covers (NOW - 24h, NOW]; the reading exactly at the cutoff is kept.
    expect(removed).toBe((12 * 60 - 1) * 8)
    expect(repo.count()).toBe((12 * 60 + 1) * 8)
    expect(repo.range({ from: 0, to: NOW - 12 * HOUR }).length).toBe(0)
  })

  // EC-04
  it('ignores duplicate (machine_id, ts) inserts', () => {
    const db = openDatabase(':memory:')
    seedMachines(db, MACHINES)
    const repo = createReadingsRepo(db)
    const r = {
      machineId: 'CNC-01',
      ts: NOW,
      temperature: 1,
      vibration: 1,
      spindleLoad: 1,
      rpm: 1,
      status: 'running' as const,
      output: 1,
      good: 1,
    }
    repo.insertMany([r, r])
    expect(repo.count()).toBe(1)
  })

  // AC-03
  it('uses the primary key for machine time-range queries', () => {
    const db = openDatabase(':memory:')
    const plan = db
      .prepare(
        `EXPLAIN QUERY PLAN SELECT * FROM readings WHERE machine_id = 'CNC-01' AND ts >= 0 AND ts < 10`,
      )
      .all()
      .map((r) => String(r.detail))
      .join(' ')
    expect(plan).toMatch(/PRIMARY KEY|INDEX/)
    expect(plan).not.toMatch(/SCAN readings$/)
  })
})

describe('StreamHub', () => {
  it('replays ticks after a Last-Event-ID and asks for a resync when too old', () => {
    const hub = new StreamHub(3)
    for (let s = 1; s <= 5; s++) hub.publishReadings(s * 1000, [])
    expect(hub.since(4000)!.map((e) => e.ts)).toEqual([5000])
    expect(hub.since(2000)!.map((e) => e.ts)).toEqual([3000, 4000, 5000])
    expect(hub.since(1000)).toBeNull()
    expect(new StreamHub().since(1)).toEqual([])
  })
})
