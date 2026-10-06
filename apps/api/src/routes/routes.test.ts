import { afterEach, describe, expect, it } from 'vitest'
import {
  AlertRuleSchema,
  AlertRulesResponseSchema,
  AlertsResponseSchema,
  ApiErrorSchema,
  CSV_BOM,
  CSV_HEADER,
  HealthResponseSchema,
  HOUR,
  MachinesResponseSchema,
  MINUTE,
  OverviewResponseSchema,
  ReadingsResponseSchema,
  SeriesResponseSchema,
} from '@aiot/shared'
import type { App } from '../app.ts'
import { createTestApp, NOW } from '../test-utils.ts'

let app: App
afterEach(async () => {
  await app?.close()
})

async function setup(hours = 2) {
  const ctx = await createTestApp(hours)
  app = ctx.app
  return ctx
}

describe('GET /api/health', () => {
  it('reports status and stored reading count', async () => {
    const { history } = await setup()
    const res = await app.inject('/api/health')
    expect(res.statusCode).toBe(200)
    expect(HealthResponseSchema.parse(res.json())).toEqual({
      status: 'ok',
      time: NOW,
      readings: history.length,
    })
  })
})

describe('GET /api/machines', () => {
  it('lists 8 machines with their latest stored reading', async () => {
    await setup()
    const body = MachinesResponseSchema.parse((await app.inject('/api/machines')).json())
    expect(body.items).toHaveLength(8)
    expect(body.items.every((m) => m.latest?.ts === NOW)).toBe(true)
  })
})

describe('GET /api/machines/:id/series', () => {
  const url = (q: string) => `/api/machines/CNC-01/series?${q}`

  it('buckets readings and never exceeds the requested points', async () => {
    const { from } = await setup(24)
    const res = await app.inject(
      url(`metric=temperature&from=${from + 1}&to=${NOW + 1}&points=100`),
    )
    expect(res.statusCode).toBe(200)
    const body = SeriesResponseSchema.parse(res.json())
    expect(body.points.length).toBeLessThanOrEqual(100)
    expect(body.rawCount).toBe(24 * 60)
    expect(body.points.every((p) => p.min! <= p.avg! && p.avg! <= p.max!)).toBe(true)
  })

  // EC-02
  it('returns 404 for an unknown machine', async () => {
    await setup()
    const res = await app.inject(
      `/api/machines/NOPE/series?metric=rpm&from=${NOW - HOUR}&to=${NOW}`,
    )
    expect(res.statusCode).toBe(404)
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe('NOT_FOUND')
  })

  // EC-01
  it('rejects an unknown metric and too many points', async () => {
    await setup()
    for (const q of [
      `metric=nope&from=${NOW - HOUR}&to=${NOW}`,
      `metric=rpm&from=${NOW - HOUR}&to=${NOW}&points=5000`,
    ]) {
      const res = await app.inject(url(q))
      expect(res.statusCode).toBe(400)
      expect(ApiErrorSchema.parse(res.json()).error.code).toBe('VALIDATION_ERROR')
    }
  })

  // EC-03
  it('returns no points for an empty range', async () => {
    await setup()
    const body = SeriesResponseSchema.parse(
      (await app.inject(url(`metric=rpm&from=${NOW + HOUR}&to=${NOW + 2 * HOUR}`))).json(),
    )
    expect(body.points).toEqual([])
    expect(body.rawCount).toBe(0)
  })
})

describe('GET /api/readings', () => {
  it('pages and sorts readings', async () => {
    const { from } = await setup()
    const res = await app.inject(
      `/api/readings?machineId=CNC-01&from=${from}&to=${NOW + 1}&page=2&pageSize=10&sort=-temperature`,
    )
    const body = ReadingsResponseSchema.parse(res.json())
    expect(body.total).toBe(120)
    expect(body.items).toHaveLength(10)
    const temps = body.items.map((r) => r.temperature!)
    expect(temps).toEqual(temps.toSorted((a, b) => b - a))
  })

  // EC-01
  it.each([
    ['from >= to', `from=${NOW}&to=${NOW}`],
    ['range over 24 hours', `from=${NOW - 25 * HOUR}&to=${NOW}`],
    ['pageSize over 500', `from=${NOW - HOUR}&to=${NOW}&pageSize=501`],
    ['unknown sort', `from=${NOW - HOUR}&to=${NOW}&sort=machine`],
    ['missing from', `to=${NOW}`],
  ])('returns 400 for %s', async (_, q) => {
    await setup()
    const res = await app.inject(`/api/readings?${q}`)
    expect(res.statusCode).toBe(400)
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe('VALIDATION_ERROR')
  })

  // EC-04
  it('returns an empty page past the end with the real total', async () => {
    const { from } = await setup()
    const body = ReadingsResponseSchema.parse(
      (
        await app.inject(`/api/readings?machineId=CNC-01&from=${from}&to=${NOW + 1}&page=99`)
      ).json(),
    )
    expect(body.items).toEqual([])
    expect(body.total).toBe(120)
  })

  // EC-05
  it('keeps null sensor values as null and sorts them last', async () => {
    await setup()
    app.ctx.readings.insertMany([
      {
        machineId: 'CNC-01',
        ts: NOW + 1000,
        temperature: null,
        vibration: 1,
        spindleLoad: 1,
        rpm: 1,
        status: 'running',
        output: 1,
        good: 1,
      },
    ])
    const body = ReadingsResponseSchema.parse(
      (
        await app.inject(
          `/api/readings?machineId=CNC-01&from=${NOW - HOUR}&to=${NOW + 2000}&sort=temperature&pageSize=500`,
        )
      ).json(),
    )
    expect(body.items.at(-1)!.temperature).toBeNull()
  })
})

describe('GET /api/readings.csv', () => {
  // AC-03
  it('exports the same number of rows as the paged total', async () => {
    const { from } = await setup()
    const q = `from=${from}&to=${NOW + 1}`
    const total = ReadingsResponseSchema.parse(
      (await app.inject(`/api/readings?${q}`)).json(),
    ).total
    const res = await app.inject(`/api/readings.csv?${q}`)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    const lines = res.body.trimEnd().split('\n')
    expect(lines[0]).toBe(`${CSV_BOM}${CSV_HEADER}`)
    expect(lines).toHaveLength(total + 1)
  })

  // EC-03
  it('writes only the header for an empty range', async () => {
    await setup()
    const res = await app.inject(`/api/readings.csv?from=${NOW + HOUR}&to=${NOW + 2 * HOUR}`)
    expect(res.body).toBe(`${CSV_BOM}${CSV_HEADER}\n`)
  })
})

describe('GET /api/stats/overview', () => {
  it('summarises today with every status present', async () => {
    await setup(24)
    const body = OverviewResponseSchema.parse((await app.inject('/api/stats/overview')).json())
    expect(body.machineCount).toBe(8)
    expect(Object.values(body.statusCounts).reduce((a, b) => a + b, 0)).toBe(8)
    expect(body.outputToday).toBeGreaterThan(0)
    expect(body.oee.oee).toBeGreaterThan(0)
    expect(body.shiftOutput.map((s) => s.shift)).toEqual(['C', 'A', 'B'])
    expect(body.machineOutput.reduce((s, m) => s + m.output, 0)).toBe(body.outputToday)
  })
})

describe('alert rules and alerts', () => {
  const rule = {
    machineId: 'CNC-01',
    metric: 'temperature',
    op: 'gt',
    threshold: 80,
    durationSec: 0,
    enabled: true,
  }

  it('creates, updates and deletes a rule', async () => {
    await setup()
    const created = await app.inject({ method: 'POST', url: '/api/alert-rules', payload: rule })
    expect(created.statusCode).toBe(201)
    const { id } = AlertRuleSchema.parse(created.json())

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/alert-rules/${id}`,
      payload: { enabled: false },
    })
    expect(AlertRuleSchema.parse(patched.json())).toMatchObject({
      id,
      enabled: false,
      threshold: 80,
    })

    const list = AlertRulesResponseSchema.parse((await app.inject('/api/alert-rules')).json())
    expect(list.items.map((r) => r.id)).toContain(id)

    expect((await app.inject({ method: 'DELETE', url: `/api/alert-rules/${id}` })).statusCode).toBe(
      204,
    )
    expect((await app.inject({ method: 'DELETE', url: `/api/alert-rules/${id}` })).statusCode).toBe(
      404,
    )
  })

  it('validates rule bodies', async () => {
    await setup()
    const bad = await app.inject({
      method: 'POST',
      url: '/api/alert-rules',
      payload: { ...rule, op: 'eq' },
    })
    expect(bad.statusCode).toBe(400)
    const unknown = await app.inject({
      method: 'POST',
      url: '/api/alert-rules',
      payload: { ...rule, machineId: 'NOPE' },
    })
    expect(unknown.statusCode).toBe(400)
    const empty = await app.inject({ method: 'PATCH', url: '/api/alert-rules/1', payload: {} })
    expect(empty.statusCode).toBe(400)
  })

  it('lists and acknowledges alerts', async () => {
    await setup()
    const alert = app.ctx.alerts.insertAlert({
      ruleId: 1,
      machineId: 'CNC-01',
      metric: 'temperature',
      op: 'gt',
      threshold: 85,
      ts: NOW - MINUTE,
      value: 90,
    })
    let body = AlertsResponseSchema.parse((await app.inject('/api/alerts?status=open')).json())
    expect(body.openCount).toBe(1)
    expect(body.items[0]!.id).toBe(alert.id)

    const acked = await app.inject({ method: 'PATCH', url: `/api/alerts/${alert.id}/ack` })
    expect(acked.json()).toMatchObject({ ackedAt: NOW })

    body = AlertsResponseSchema.parse((await app.inject('/api/alerts?status=open')).json())
    expect(body.items).toEqual([])
    expect(body.openCount).toBe(0)
    expect((await app.inject({ method: 'PATCH', url: '/api/alerts/999/ack' })).statusCode).toBe(404)
  })
})

describe('unknown routes', () => {
  it('returns the standard 404 body', async () => {
    await setup()
    const res = await app.inject('/api/nope')
    expect(res.statusCode).toBe(404)
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe('NOT_FOUND')
  })
})

describe('OpenAPI', () => {
  it('serves the generated document', async () => {
    await setup()
    const res = await app.inject('/api/docs/json')
    expect(res.statusCode).toBe(200)
    expect(Object.keys(res.json().paths)).toContain('/api/readings')
  })
})
