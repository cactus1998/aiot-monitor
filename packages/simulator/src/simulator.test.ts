import { describe, expect, it } from 'vitest'
import { HOUR, MINUTE, SECOND } from '@aiot/shared'
import { MACHINES } from './machines.ts'
import { mulberry32 } from './random.ts'
import { createSimulator, generateHistory } from './simulator.ts'

const START = Date.UTC(2026, 9, 6, 0, 0)

function run(seed: number, seconds: number) {
  const sim = createSimulator({ seed, startTs: START })
  return generateHistory(sim, START, START + seconds * SECOND, SECOND)
}

describe('mulberry32', () => {
  it('is deterministic for a seed and stays in [0, 1)', () => {
    const a = mulberry32(1)
    const b = mulberry32(1)
    const values = Array.from({ length: 100 }, () => a())
    expect(values).toEqual(Array.from({ length: 100 }, () => b()))
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true)
  })
})

describe('createSimulator', () => {
  // AC-01
  it('produces identical readings for the same seed and different ones for another seed', () => {
    expect(run(7, 60)).toEqual(run(7, 60))
    expect(run(7, 60)).not.toEqual(run(8, 60))
  })

  it('returns one reading per machine per tick', () => {
    const sim = createSimulator({ seed: 1, startTs: START })
    const readings = sim.tick(START + SECOND)
    expect(readings.map((r) => r.machineId)).toEqual(MACHINES.map((m) => m.id))
    expect(readings.every((r) => r.ts === START + SECOND)).toBe(true)
  })

  // EC-01
  it('does not move backwards when ts does not increase', () => {
    const sim = createSimulator({ seed: 1, startTs: START })
    const first = sim.tick(START + SECOND)
    expect(sim.tick(START + SECOND)).toEqual(first)
    expect(sim.tick(START)).toEqual(first)
  })

  // AC-02
  it('only increases output and good, with good ≤ output', () => {
    const readings = run(3, 3600)
    const byMachine = Object.groupBy(readings, (r) => r.machineId)
    for (const list of Object.values(byMachine)) {
      list!.forEach((r, i) => {
        expect(r.good).toBeLessThanOrEqual(r.output)
        if (i > 0) {
          expect(r.output).toBeGreaterThanOrEqual(list![i - 1]!.output)
          expect(r.good).toBeGreaterThanOrEqual(list![i - 1]!.good)
        }
      })
      expect(list!.at(-1)!.output).toBeGreaterThan(list![0]!.output)
    }
  })

  // AC-03
  it('raises temperature into alarm after an overheat injection', () => {
    const sim = createSimulator({ seed: 1, startTs: START, anomalyRatePerHour: 0, dropoutRate: 0 })
    expect(sim.inject('CNC-01', 'overheat', 1200)).toBe(true)
    const readings = generateHistory(sim, START, START + 15 * MINUTE, SECOND).filter(
      (r) => r.machineId === 'CNC-01',
    )
    expect(readings.at(-1)!.temperature!).toBeGreaterThan(readings[0]!.temperature! + 20)
    expect(readings.some((r) => r.status === 'alarm')).toBe(true)
  })

  it('keeps output flat and status offline during a stoppage', () => {
    const sim = createSimulator({ seed: 1, startTs: START, anomalyRatePerHour: 0 })
    sim.inject('MLD-01', 'stoppage', 120)
    const readings = generateHistory(sim, START, START + 100 * SECOND, SECOND).filter(
      (r) => r.machineId === 'MLD-01',
    )
    expect(readings.every((r) => r.status === 'offline')).toBe(true)
    expect(new Set(readings.map((r) => r.output)).size).toBe(1)
    expect(sim.anomalies()).toEqual([{ machineId: 'MLD-01', kind: 'stoppage', remainingSec: 20 }])
  })

  // EC-02
  it('rejects injection into an unknown machine', () => {
    const sim = createSimulator({ seed: 1, startTs: START })
    expect(sim.inject('NOPE', 'overheat')).toBe(false)
  })

  it('produces some null values when dropout is enabled', () => {
    const sim = createSimulator({ seed: 1, startTs: START, dropoutRate: 0.5 })
    const readings = generateHistory(sim, START, START + 10 * SECOND, SECOND)
    expect(readings.some((r) => r.temperature === null)).toBe(true)
  })

  it('continues counters from initial readings', () => {
    const initial = run(5, 10).filter((r) => r.ts === START + 10 * SECOND)
    const sim = createSimulator({ seed: 99, startTs: START + 10 * SECOND, initial })
    const next = sim.tick(START + 11 * SECOND)
    next.forEach((r, i) => expect(r.output).toBeGreaterThanOrEqual(initial[i]!.output))
  })

  // AC-04, EC-03
  it('backfills 24 hours at one-minute steps quickly', () => {
    const sim = createSimulator({ seed: 42, startTs: START - 24 * HOUR })
    const t0 = Date.now()
    const readings = generateHistory(sim, START - 24 * HOUR, START, MINUTE)
    const elapsed = Date.now() - t0
    expect(readings).toHaveLength(24 * 60 * MACHINES.length)
    expect(elapsed).toBeLessThan(500)
    const running = readings.filter((r) => r.status === 'running').length / readings.length
    expect(running).toBeGreaterThan(0.6)
  })
})
