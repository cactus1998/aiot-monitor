import { computed } from 'vue'
import type { MachineStatus, MetricKey } from '@aiot/shared'
import { useTheme } from '@/composables/useUiPrefs.ts'

/** Colours resolved from CSS custom properties so charts follow the theme. */
export interface ChartTheme {
  text: string
  muted: string
  grid: string
  surface: string
  warn: string
  alarm: string
  forecast: string
  status: Record<MachineStatus, string>
  metric: Record<MetricKey, string>
  series: string[]
}

const FALLBACK: ChartTheme = {
  text: '#1f2937',
  muted: '#6b7280',
  grid: '#e5e7eb',
  surface: '#ffffff',
  warn: '#d97706',
  alarm: '#dc2626',
  forecast: '#7c3aed',
  status: { running: '#16a34a', idle: '#2563eb', alarm: '#dc2626', offline: '#6b7280' },
  metric: { temperature: '#ea580c', vibration: '#7c3aed', spindleLoad: '#0891b2', rpm: '#4f46e5' },
  series: ['#2563eb', '#ea580c', '#16a34a', '#9333ea', '#0891b2', '#db2777', '#ca8a04', '#475569'],
}

export function readChartTheme(el: Element = document.documentElement): ChartTheme {
  const css = getComputedStyle(el)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    text: v('--color-text', FALLBACK.text),
    muted: v('--color-text-muted', FALLBACK.muted),
    grid: v('--color-border', FALLBACK.grid),
    surface: v('--color-surface', FALLBACK.surface),
    warn: v('--color-warn', FALLBACK.warn),
    alarm: v('--color-alarm', FALLBACK.alarm),
    forecast: v('--color-forecast', FALLBACK.forecast),
    status: {
      running: v('--status-running', FALLBACK.status.running),
      idle: v('--status-idle', FALLBACK.status.idle),
      alarm: v('--status-alarm', FALLBACK.status.alarm),
      offline: v('--status-offline', FALLBACK.status.offline),
    },
    metric: {
      temperature: v('--metric-temperature', FALLBACK.metric.temperature),
      vibration: v('--metric-vibration', FALLBACK.metric.vibration),
      spindleLoad: v('--metric-spindle-load', FALLBACK.metric.spindleLoad),
      rpm: v('--metric-rpm', FALLBACK.metric.rpm),
    },
    series: FALLBACK.series.map((c, i) => v(`--series-${i + 1}`, c)),
  }
}

export { FALLBACK as DEFAULT_CHART_THEME }

/** Re-read colours whenever the theme toggles. */
export function useChartTheme() {
  const { theme } = useTheme()
  return computed(() => {
    void theme.value
    return typeof document === 'undefined' ? FALLBACK : readChartTheme()
  })
}
