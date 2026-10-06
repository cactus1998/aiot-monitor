import type { MetricKey } from '@aiot/shared'
import { HOUR, METRICS, TIME_ZONE } from '@aiot/shared'

const dateTime = new Intl.DateTimeFormat('zh-TW', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})
const timeOnly = new Intl.DateTimeFormat('zh-TW', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})
const shortDateTime = new Intl.DateTimeFormat('zh-TW', {
  timeZone: TIME_ZONE,
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export const formatDateTime = (ts: number) => dateTime.format(ts)
export const formatTime = (ts: number) => timeOnly.format(ts)
export const formatShortDateTime = (ts: number) => shortDateTime.format(ts)

const numberFormats = new Map<number, Intl.NumberFormat>()
export function formatNumber(value: number, decimals = 0): string {
  let f = numberFormats.get(decimals)
  if (!f) {
    f = new Intl.NumberFormat('zh-TW', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    numberFormats.set(decimals, f)
  }
  return f.format(value)
}

const percent = new Intl.NumberFormat('zh-TW', { style: 'percent', maximumFractionDigits: 1 })
export const formatPercent = (ratio: number) => percent.format(ratio)

/** Metric value with unit; null shows an em dash (EC-07). */
export function formatMetric(metric: MetricKey, value: number | null, withUnit = true): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const def = METRICS[metric]
  const text = formatNumber(value, def.decimals)
  return withUnit ? `${text} ${def.unit}` : text
}

const TAIPEI_OFFSET = 8 * HOUR

/** UTC ms to `YYYY-MM-DDTHH:mm` in Taipei time, for `<input type="datetime-local">`. */
export function toTaipeiInput(ts: number): string {
  return new Date(ts + TAIPEI_OFFSET).toISOString().slice(0, 16)
}

/** Parse a Taipei `datetime-local` value back to UTC ms; NaN when invalid. */
export function fromTaipeiInput(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return Number.NaN
  return Date.parse(`${value}:00Z`) - TAIPEI_OFFSET
}

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return '不到 1 分鐘'
  if (minutes < 60) return `${minutes} 分鐘`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小時 ${rest} 分鐘` : `${hours} 小時`
}
