export const METRIC_KEYS = ['temperature', 'vibration', 'spindleLoad', 'rpm'] as const
export type MetricKey = (typeof METRIC_KEYS)[number]

export interface MetricDefinition {
  key: MetricKey
  label: string
  unit: string
  decimals: number
  /** Value above which the metric is considered abnormal. */
  warn: number
  /** Value above which an alarm should be raised. */
  alarm: number
  /** Column name in the SQLite `readings` table. */
  column: string
}

export const METRICS: Record<MetricKey, MetricDefinition> = {
  temperature: {
    key: 'temperature',
    label: '溫度',
    unit: '°C',
    decimals: 1,
    warn: 75,
    alarm: 85,
    column: 'temperature',
  },
  vibration: {
    key: 'vibration',
    label: '振動 RMS',
    unit: 'mm/s',
    decimals: 2,
    warn: 4.5,
    alarm: 7.1,
    column: 'vibration',
  },
  spindleLoad: {
    key: 'spindleLoad',
    label: '主軸負載',
    unit: '%',
    decimals: 0,
    warn: 85,
    alarm: 95,
    column: 'spindle_load',
  },
  rpm: {
    key: 'rpm',
    label: '轉速',
    unit: 'rpm',
    decimals: 0,
    warn: 11000,
    alarm: 12000,
    column: 'rpm',
  },
}

export function isMetricKey(value: unknown): value is MetricKey {
  return typeof value === 'string' && (METRIC_KEYS as readonly string[]).includes(value)
}
