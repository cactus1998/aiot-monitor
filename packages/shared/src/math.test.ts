import { describe, expect, it } from 'vitest'
import { evaluateRule, initialRuleState } from './alert-rule.ts'
import type { AlertRule } from './api/alerts.ts'
import { ReadingsQuerySchema } from './api/readings.ts'
import { SeriesQuerySchema } from './api/series.ts'
import { forecastThreshold, linearRegression } from './forecast.ts'
import { lttb } from './lttb.ts'
import type { Reading } from './machine.ts'
import { combineOee, computeMachineOee, computeOee } from './oee.ts'
import { HOUR, startOfTaipeiDay } from './time.ts'

describe('computeOee', () => {
  it('multiplies availability, performance and quality', () => {
    const oee = computeOee({
      plannedSec: 100,
      runSec: 80,
      idealCycleSec: 1,
      totalCount: 40,
      goodCount: 38,
    })
    expect(oee.availability).toBeCloseTo(0.8)
    expect(oee.performance).toBeCloseTo(0.5)
    expect(oee.quality).toBeCloseTo(0.95)
    expect(oee.oee).toBeCloseTo(0.38)
  })

  // EC-03
  it('returns zeros instead of NaN when nothing was produced', () => {
    expect(
      computeOee({ plannedSec: 0, runSec: 0, idealCycleSec: 1, totalCount: 0, goodCount: 0 }),
    ).toEqual({ availability: 0, performance: 0, quality: 0, oee: 0 })
  })

  // EC-04
  it('clamps performance to 1', () => {
    const oee = computeOee({
      plannedSec: 10,
      runSec: 10,
      idealCycleSec: 5,
      totalCount: 10,
      goodCount: 10,
    })
    expect(oee.performance).toBe(1)
  })
})

describe('computeMachineOee', () => {
  const base = { machineId: 'M', temperature: 1, vibration: 1, spindleLoad: 1, rpm: 1 }
  const readings: Reading[] = [
    { ...base, ts: 0, status: 'running', output: 0, good: 0 },
    { ...base, ts: 60_000, status: 'idle', output: 10, good: 9 },
    { ...base, ts: 120_000, status: 'running', output: 10, good: 9 },
  ]

  it('weights each sample by the gap to the next one', () => {
    const oee = computeMachineOee(readings, 3)
    expect(oee.availability).toBeCloseTo(0.5)
    expect(oee.performance).toBeCloseTo(0.5)
    expect(oee.quality).toBeCloseTo(0.9)
  })

  it('returns zeros for no readings', () => {
    expect(computeMachineOee([], 3).oee).toBe(0)
  })

  it('combines machines into a plant-level OEE', () => {
    const plant = combineOee([
      { plannedSec: 100, runSec: 100, idealCycleSec: 1, totalCount: 100, goodCount: 100 },
      { plannedSec: 100, runSec: 0, idealCycleSec: 1, totalCount: 0, goodCount: 0 },
    ])
    expect(plant.availability).toBeCloseTo(0.5)
    expect(plant.oee).toBeCloseTo(0.5)
  })
})

describe('lttb', () => {
  const points = Array.from({ length: 1000 }, (_, i) => ({ ts: i, value: i === 500 ? 100 : 0 }))

  it('reduces to the threshold and keeps first, last and peaks', () => {
    const out = lttb(points, 50)
    expect(out).toHaveLength(50)
    expect(out[0]).toEqual(points[0])
    expect(out.at(-1)).toEqual(points.at(-1))
    expect(out.some((p) => p.value === 100)).toBe(true)
  })

  it('returns a copy when no down-sampling is needed', () => {
    expect(lttb(points.slice(0, 10), 50)).toHaveLength(10)
    expect(lttb([], 50)).toEqual([])
  })
})

describe('linearRegression / forecastThreshold', () => {
  const rising = Array.from({ length: 10 }, (_, i) => ({
    ts: 1_700_000_000_000 + i * 1000,
    value: 50 + i,
  }))

  it('fits a perfect line', () => {
    const r = linearRegression(rising)!
    expect(r.slope).toBeCloseTo(0.001)
    expect(r.r2).toBeCloseTo(1)
  })

  it('returns null for fewer than two points', () => {
    expect(linearRegression([])).toBeNull()
    expect(linearRegression(rising.slice(0, 1))).toBeNull()
  })

  it('estimates when a rising trend reaches the threshold', () => {
    const f = forecastThreshold(rising, 69)!
    expect(f.reached).toBe(false)
    expect(f.eta).toBe(rising[0]!.ts + 19_000)
  })

  it('returns no eta for a falling trend', () => {
    const falling = rising.map((p) => ({ ...p, value: 100 - p.value }))
    expect(forecastThreshold(falling, 90)!.eta).toBeNull()
  })

  it('flags a threshold that is already reached', () => {
    expect(forecastThreshold(rising, 55)!.reached).toBe(true)
  })
})

describe('evaluateRule', () => {
  const rule: AlertRule = {
    id: 1,
    machineId: null,
    metric: 'temperature',
    op: 'gt',
    threshold: 80,
    durationSec: 5,
    enabled: true,
  }
  const at = (ts: number, temperature: number | null): Reading => ({
    machineId: 'M',
    ts,
    temperature,
    vibration: 1,
    spindleLoad: 1,
    rpm: 1,
    status: 'running',
    output: 0,
    good: 0,
  })

  it('fires once after the condition holds for the duration and re-arms after it clears', () => {
    let state = initialRuleState()
    const triggers: number[] = []
    for (const [ts, v] of [
      [0, 81],
      [3000, 82],
      [5000, 83],
      [6000, 84],
      [7000, 70],
      [8000, 90],
      [13_000, 90],
    ] as const) {
      const r = evaluateRule(rule, at(ts, v), state)
      state = r.state
      if (r.trigger) triggers.push(r.trigger.ts)
    }
    expect(triggers).toEqual([5000, 13_000])
  })

  it('ignores null readings', () => {
    const prev = { since: 0, fired: false }
    expect(evaluateRule(rule, at(1000, null), prev)).toEqual({ state: prev, trigger: null })
  })
})

describe('query schemas', () => {
  const from = 1_700_000_000_000

  // EC-05
  it('rejects ranges longer than 24 hours', () => {
    const result = ReadingsQuerySchema.safeParse({ from, to: from + 25 * HOUR })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('查詢範圍不可超過 24 小時')
  })

  it('rejects from >= to', () => {
    expect(ReadingsQuerySchema.safeParse({ from, to: from }).success).toBe(false)
  })

  it('rejects pageSize over 500 and unknown sorts', () => {
    expect(ReadingsQuerySchema.safeParse({ from, to: from + HOUR, pageSize: 501 }).success).toBe(
      false,
    )
    expect(ReadingsQuerySchema.safeParse({ from, to: from + HOUR, sort: 'machine' }).success).toBe(
      false,
    )
  })

  it('coerces query strings and applies defaults', () => {
    const parsed = ReadingsQuerySchema.parse({ from: String(from), to: String(from + HOUR) })
    expect(parsed).toMatchObject({ from, to: from + HOUR, page: 1, pageSize: 50, sort: '-ts' })
  })

  it('caps series points at 2000', () => {
    expect(
      SeriesQuerySchema.safeParse({ metric: 'rpm', from, to: from + HOUR, points: 2001 }).success,
    ).toBe(false)
  })
})

describe('startOfTaipeiDay', () => {
  it('returns Taipei midnight in UTC ms', () => {
    // 2026-10-06 01:30 Taipei = 2026-10-05 17:30 UTC
    const ts = Date.UTC(2026, 9, 5, 17, 30)
    expect(startOfTaipeiDay(ts)).toBe(Date.UTC(2026, 9, 5, 16, 0))
  })
})
