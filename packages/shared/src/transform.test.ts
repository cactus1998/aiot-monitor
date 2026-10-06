import { describe, expect, it } from 'vitest'
import type { Reading } from './machine.ts'
import {
  bucketize,
  countBy,
  CSV_HEADER,
  groupByMachine,
  latestByMachine,
  sortReadings,
  statusDistribution,
  summarize,
  toCsv,
  toSeriesRows,
} from './transform.ts'

function reading(partial: Partial<Reading> & Pick<Reading, 'machineId' | 'ts'>): Reading {
  return {
    temperature: 50,
    vibration: 2,
    spindleLoad: 40,
    rpm: 8000,
    status: 'running',
    output: 0,
    good: 0,
    ...partial,
  }
}

const sample: Reading[] = [
  reading({ machineId: 'CNC-01', ts: 1000, temperature: 60 }),
  reading({ machineId: 'CNC-02', ts: 1000, temperature: 70 }),
  reading({ machineId: 'CNC-01', ts: 2000, temperature: null }),
  reading({ machineId: 'CNC-01', ts: 3000, temperature: 65 }),
]

describe('groupByMachine', () => {
  it('groups readings by machine id', () => {
    const grouped = groupByMachine(sample)
    expect(grouped['CNC-01']).toHaveLength(3)
    expect(grouped['CNC-02']).toHaveLength(1)
  })

  it('returns an empty object for no readings', () => {
    expect(groupByMachine([])).toEqual({})
  })
})

describe('countBy / statusDistribution', () => {
  it('counts every status including zeros', () => {
    expect(statusDistribution(['running', 'running', 'alarm'])).toEqual({
      running: 2,
      idle: 0,
      alarm: 1,
      offline: 0,
    })
  })

  it('counts keys that were not pre-declared', () => {
    expect(countBy(['a', 'b', 'a'], (s) => s)).toEqual({ a: 2, b: 1 })
  })
})

describe('latestByMachine', () => {
  it('finds the last reading of each machine', () => {
    const latest = latestByMachine(sample, ['CNC-01', 'CNC-02', 'CNC-03'])
    expect(latest.get('CNC-01')?.ts).toBe(3000)
    expect(latest.get('CNC-02')?.ts).toBe(1000)
    expect(latest.get('CNC-03')).toBeUndefined()
  })
})

describe('sortReadings', () => {
  it('sorts ascending and keeps nulls last', () => {
    const sorted = sortReadings(sample, 'temperature')
    expect(sorted.map((r) => r.temperature)).toEqual([60, 65, 70, null])
  })

  it('sorts descending and keeps nulls last', () => {
    const sorted = sortReadings(sample, '-temperature')
    expect(sorted.map((r) => r.temperature)).toEqual([70, 65, 60, null])
  })

  it('does not mutate the input', () => {
    const copy = sample.slice()
    sortReadings(sample, '-ts')
    expect(sample).toEqual(copy)
  })
})

describe('summarize', () => {
  it('ignores null values', () => {
    expect(summarize([1, null, 3])).toEqual({ count: 2, min: 1, max: 3, avg: 2 })
  })

  it('returns nulls for an empty or all-null input', () => {
    expect(summarize([])).toEqual({ count: 0, min: null, max: null, avg: null })
    expect(summarize([null, null])).toEqual({ count: 0, min: null, max: null, avg: null })
  })
})

describe('bucketize', () => {
  it('splits a range into buckets with avg, min and max', () => {
    const points = [
      { ts: 0, value: 1 },
      { ts: 4, value: 3 },
      { ts: 5, value: 10 },
      { ts: 9, value: 20 },
    ]
    expect(bucketize(points, 0, 10, 2)).toEqual([
      { ts: 0, avg: 2, min: 1, max: 3 },
      { ts: 5, avg: 15, min: 10, max: 20 },
    ])
  })

  it('returns null values for a bucket with only nulls', () => {
    expect(bucketize([{ ts: 0, value: null }], 0, 10, 2)).toEqual([
      { ts: 0, avg: null, min: null, max: null },
    ])
  })

  it('drops points outside the range and handles empty input', () => {
    expect(bucketize([{ ts: 10, value: 1 }], 0, 10, 2)).toEqual([])
    expect(bucketize([], 0, 10, 2)).toEqual([])
  })

  it('never returns more points than buckets', () => {
    const points = Array.from({ length: 10_000 }, (_, i) => ({ ts: i, value: i }))
    expect(bucketize(points, 0, 10_000, 500).length).toBeLessThanOrEqual(500)
  })
})

describe('toSeriesRows', () => {
  it('flattens series into rows', () => {
    const rows = toSeriesRows([
      { machineId: 'A', points: [{ ts: 1, avg: 1, min: 1, max: 1 }] },
      {
        machineId: 'B',
        points: [
          { ts: 1, avg: 2, min: 2, max: 2 },
          { ts: 2, avg: null, min: null, max: null },
        ],
      },
    ])
    expect(rows).toEqual([
      { machineId: 'A', ts: 1, avg: 1 },
      { machineId: 'B', ts: 1, avg: 2 },
      { machineId: 'B', ts: 2, avg: null },
    ])
  })
})

describe('toCsv', () => {
  it('writes a header and one line per reading, empty cell for null', () => {
    const csv = toCsv(sample.slice(2, 3))
    const lines = csv.trimEnd().split('\n')
    expect(lines[0]).toBe(CSV_HEADER)
    expect(lines[1]).toBe('CNC-01,2000,1970-01-01T00:00:02.000Z,,2,40,8000,running,0,0')
  })

  it('writes only the header for no readings', () => {
    expect(toCsv([])).toBe(`${CSV_HEADER}\n`)
  })
})
