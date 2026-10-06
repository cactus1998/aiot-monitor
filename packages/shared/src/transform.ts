import type { MachineStatus, Reading } from './machine.ts'
import { MACHINE_STATUSES } from './machine.ts'
import type { MetricKey } from './metrics.ts'
import { METRICS, METRIC_KEYS } from './metrics.ts'
import type { ReadingSort } from './api/readings.ts'
import type { SeriesPoint } from './api/series.ts'

export interface TimeValue {
  ts: number
  value: number | null
}

/** Group readings by machine id (`Object.groupBy`). */
export function groupByMachine(readings: readonly Reading[]): Partial<Record<string, Reading[]>> {
  return Object.groupBy(readings, (r) => r.machineId)
}

/** Count items per key (`reduce`). Keys listed in `keys` start at 0 so the result is complete. */
export function countBy<T, K extends string>(
  items: readonly T[],
  keyOf: (item: T) => K,
  keys: readonly K[] = [],
): Record<K, number> {
  const initial = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
  return items.reduce((acc, item) => {
    const key = keyOf(item)
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, initial)
}

/** Machine status distribution with every status present. */
export function statusDistribution(
  statuses: readonly MachineStatus[],
): Record<MachineStatus, number> {
  return countBy(statuses, (s) => s, MACHINE_STATUSES)
}

/** Most recent reading per machine (`findLast`, input sorted by ts ascending). */
export function latestByMachine(
  readings: readonly Reading[],
  machineIds: readonly string[],
): Map<string, Reading | undefined> {
  return new Map(machineIds.map((id) => [id, readings.findLast((r) => r.machineId === id)]))
}

/** Pick a metric value from a reading. */
export function metricValue(reading: Reading, metric: MetricKey): number | null {
  return reading[metric]
}

/**
 * Sort readings without mutating the input (`toSorted`).
 * Nulls always go last; ties fall back to ts descending so paging is stable.
 */
export function sortReadings(readings: readonly Reading[], sort: ReadingSort): Reading[] {
  const desc = sort.startsWith('-')
  const field = (desc ? sort.slice(1) : sort) as 'ts' | MetricKey
  const dir = desc ? -1 : 1
  return readings.toSorted((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (av === bv) return b.ts - a.ts || a.machineId.localeCompare(b.machineId)
    if (av === null) return 1
    if (bv === null) return -1
    return (av - bv) * dir
  })
}

export interface Summary {
  count: number
  min: number | null
  max: number | null
  avg: number | null
}

/** Count / min / max / avg ignoring nulls (`filter` + `reduce`). */
export function summarize(values: readonly (number | null)[]): Summary {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v))
  if (nums.length === 0) return { count: 0, min: null, max: null, avg: null }
  const { min, max, sum } = nums.reduce(
    (acc, v) => ({ min: Math.min(acc.min, v), max: Math.max(acc.max, v), sum: acc.sum + v }),
    { min: Infinity, max: -Infinity, sum: 0 },
  )
  return { count: nums.length, min, max, avg: sum / nums.length }
}

/** Width of each bucket so that `[from, to)` splits into at most `buckets` buckets. */
export function bucketSize(from: number, to: number, buckets: number): number {
  return Math.max(1, Math.ceil((to - from) / Math.max(1, buckets)))
}

/**
 * Down-sample points into fixed-width time buckets with avg / min / max.
 * Only buckets that received at least one point are returned; a bucket whose
 * points are all null yields null values so the chart shows a gap.
 */
export function bucketize(
  points: readonly TimeValue[],
  from: number,
  to: number,
  buckets: number,
): SeriesPoint[] {
  const size = bucketSize(from, to, buckets)
  const grouped = Map.groupBy(
    points.filter((p) => p.ts >= from && p.ts < to),
    (p) => Math.floor((p.ts - from) / size),
  )
  return [...grouped.entries()]
    .toSorted(([a], [b]) => a - b)
    .map(([index, group]) => {
      const s = summarize(group.map((p) => p.value))
      return { ts: from + index * size, avg: s.avg, min: s.min, max: s.max }
    })
}

/** Flatten per-machine series into table rows (`flatMap`). */
export function toSeriesRows(
  series: readonly { machineId: string; points: readonly SeriesPoint[] }[],
): { machineId: string; ts: number; avg: number | null }[] {
  return series.flatMap((s) =>
    s.points.map((p) => ({ machineId: s.machineId, ts: p.ts, avg: p.avg })),
  )
}

export const CSV_COLUMNS = [
  'machine_id',
  'ts',
  'time_iso',
  ...METRIC_KEYS.map((k) => METRICS[k].column),
  'status',
  'output',
  'good',
] as const

function csvCell(value: string | number | null): string {
  if (value === null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** One CSV line (no trailing newline) for a reading. */
export function toCsvRow(r: Reading): string {
  return [
    r.machineId,
    r.ts,
    new Date(r.ts).toISOString(),
    ...METRIC_KEYS.map((k) => r[k]),
    r.status,
    r.output,
    r.good,
  ]
    .map(csvCell)
    .join(',')
}

export const CSV_HEADER = CSV_COLUMNS.join(',')

/** UTF-8 byte order mark; lets Excel detect the encoding of exported CSV files. */
export const CSV_BOM = String.fromCharCode(0xfeff)

/** Full CSV document with header (`map` + `join`). */
export function toCsv(readings: readonly Reading[]): string {
  return [CSV_HEADER, ...readings.map(toCsvRow)].join('\n') + '\n'
}
