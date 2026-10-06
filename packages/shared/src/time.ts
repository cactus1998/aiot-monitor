export const SECOND = 1000
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE

/** Longest range any query may cover; matches the 24 h retention. */
export const MAX_RANGE_MS = 24 * HOUR

export const RANGE_PRESETS = ['1h', '6h', '24h'] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]

export const RANGE_PRESET_MS: Record<RangePreset, number> = {
  '1h': HOUR,
  '6h': 6 * HOUR,
  '24h': 24 * HOUR,
}

export const TIME_ZONE = 'Asia/Taipei'
const TAIPEI_OFFSET_MS = 8 * HOUR

/** UTC ms of the most recent Taipei midnight at or before `ts`. */
export function startOfTaipeiDay(ts: number): number {
  const local = ts + TAIPEI_OFFSET_MS
  return local - (local % (24 * HOUR)) - TAIPEI_OFFSET_MS
}

export const SHIFTS = [
  { key: 'C', label: '大夜班', startHour: 0 },
  { key: 'A', label: '早班', startHour: 8 },
  { key: 'B', label: '中班', startHour: 16 },
] as const
export type ShiftKey = (typeof SHIFTS)[number]['key']
