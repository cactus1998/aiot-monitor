import { afterEach, describe, expect, it } from 'vitest'
import {
  AlertsResponseSchema,
  CSV_HEADER,
  HOUR,
  MachinesResponseSchema,
  OverviewResponseSchema,
  ReadingsResponseSchema,
  SeriesResponseSchema,
} from '@aiot/shared'
import { createMockClient, MockBackend } from '../mock.ts'

const NOW = Date.UTC(2026, 9, 6, 4, 0)
let client: ReturnType<typeof createMockClient>

afterEach(() => client?.backend.stop())

function setup() {
  client = createMockClient(new MockBackend({ now: () => NOW }))
  return client
}

describe('mock client', () => {
  it('backfills 24 hours of one-minute readings in memory', () => {
    const { backend } = setup()
    expect(backend.readings).toHaveLength(24 * 60 * 8)
  })

  it('returns schema-valid machines and overview', async () => {
    setup()
    const machines = MachinesResponseSchema.parse(await client.getMachines())
    expect(machines.items).toHaveLength(8)
    const overview = OverviewResponseSchema.parse(await client.getOverview())
    expect(overview.machineCount).toBe(8)
  })

  // AC-01 (api-client): same semantics as the API
  it('pages, sorts and exports the same rows as the API would', async () => {
    setup()
    const q = { machineId: 'CNC-01', from: NOW - HOUR + 1, to: NOW + 1 }
    const page = ReadingsResponseSchema.parse(
      await client.getReadings({ ...q, pageSize: 10, sort: '-temperature' }),
    )
    expect(page.total).toBe(60)
    const temps = page.items.map((r) => r.temperature ?? -Infinity)
    expect(temps).toEqual(temps.toSorted((a, b) => b - a))
    const blob = await client.exportReadingsCsv(q)
    // UTF-8 BOM so Excel detects the encoding; Blob.text() strips it when decoding.
    expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const csv = await blob.text()
    expect(csv.startsWith(CSV_HEADER)).toBe(true)
    expect(csv.trimEnd().split('\n')).toHaveLength(page.total + 1)
  })

  it('buckets series to at most the requested points', async () => {
    setup()
    const res = SeriesResponseSchema.parse(
      await client.getSeries('CNC-01', {
        metric: 'temperature',
        from: NOW - 24 * HOUR + 1,
        to: NOW + 1,
        points: 100,
      }),
    )
    expect(res.points.length).toBeLessThanOrEqual(100)
    expect(res.rawCount).toBe(24 * 60)
  })

  it('validates queries with the shared schemas', async () => {
    setup()
    await expect(client.getReadings({ from: NOW, to: NOW - 1 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
    await expect(
      client.getSeries('NOPE', { metric: 'rpm', from: NOW - HOUR, to: NOW }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('supports alert rule CRUD and acknowledging alerts in memory', async () => {
    setup()
    const rule = await client.createAlertRule({
      machineId: 'CNC-01',
      metric: 'temperature',
      op: 'gt',
      threshold: 0,
      durationSec: 0,
      enabled: true,
    })
    expect((await client.listAlertRules()).items.map((r) => r.id)).toContain(rule.id)
    expect((await client.updateAlertRule(rule.id, { enabled: false })).enabled).toBe(false)
    await expect(client.updateAlertRule(999, { enabled: false })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await client.deleteAlertRule(rule.id)

    client.backend.alerts.push({
      id: 9999,
      ruleId: 1,
      machineId: 'CNC-01',
      metric: 'temperature',
      op: 'gt',
      threshold: 85,
      ts: NOW,
      value: 90,
      ackedAt: null,
    })
    const acked = await client.ackAlert(9999)
    expect(acked.ackedAt).toBe(NOW)
    const open = AlertsResponseSchema.parse(await client.listAlerts({ status: 'open' }))
    expect(open.items.some((a) => a.id === 9999)).toBe(false)
  })

  it('keeps one stored reading every 10 seconds while ticking every second', () => {
    const { backend } = setup()
    const before = backend.readings.length
    for (let s = 1; s <= 20; s++) backend.tick(NOW + s * 1000)
    expect(backend.readings.length - before).toBe(16)
    expect(backend.replaySince(NOW + 18_000)!.map((e) => e.ts)).toEqual([
      NOW + 19_000,
      NOW + 20_000,
    ])
  })
})
