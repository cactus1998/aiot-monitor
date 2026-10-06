import type { MachineStatus, MetricKey } from '@aiot/shared'
import { MACHINE_STATUS_LABELS, MACHINE_STATUSES, METRICS } from '@aiot/shared'
import { formatDateTime, formatNumber, formatShortDateTime, formatTime } from '@/utils/format.ts'
import type { EChartsOption } from './echarts.ts'
import type { ChartTheme } from './theme.ts'

/** [ts, value] pair; null value draws a gap (EC-07). */
export type LinePoint = [number, number | null]

export interface LineSeries {
  name: string
  points: readonly LinePoint[]
  color?: string
  /** Optional min/max band drawn behind the line. */
  band?: readonly [number, number | null, number | null][]
  dashed?: boolean
}

export interface Threshold {
  label: string
  value: number
  level: 'warn' | 'alarm'
}

export interface LineChartInput {
  series: readonly LineSeries[]
  unit?: string
  decimals?: number
  thresholds?: readonly Threshold[]
  /** Vertical marker (e.g. the row selected in the history table). */
  markerTs?: number | null
  zoom?: boolean
  /** Show seconds on the time axis (short ranges). */
  showSeconds?: boolean
  yMin?: number
  yMax?: number
  animation?: boolean
}

const tooltipTime = (ts: number) => formatDateTime(ts)

/** Highest threshold plus 5% headroom so its label is not clipped. */
export function thresholdTop(thresholds: readonly Threshold[]): number {
  const top = Math.max(...thresholds.map((t) => t.value))
  return top + Math.abs(top) * 0.05
}

export function buildLineOption(input: LineChartInput, theme: ChartTheme): EChartsOption {
  const decimals = input.decimals ?? 1
  const unit = input.unit ? ` ${input.unit}` : ''
  const thresholds = input.thresholds ?? []

  const series: NonNullable<EChartsOption['series']> = input.series.map((s, i) => ({
    type: 'line' as const,
    name: s.name,
    data: s.points as LinePoint[],
    showSymbol: false,
    connectNulls: false,
    sampling: 'lttb' as const,
    lineStyle: { width: 1.6, type: s.dashed ? ('dashed' as const) : ('solid' as const) },
    color: s.color ?? theme.series[i % theme.series.length],
    emphasis: { focus: 'series' as const },
    ...(i === 0 && (thresholds.length > 0 || input.markerTs != null)
      ? {
          markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            data: [
              ...thresholds.map((t) => ({
                yAxis: t.value,
                name: t.label,
                lineStyle: {
                  color: t.level === 'alarm' ? theme.alarm : theme.warn,
                  type: 'dashed' as const,
                },
                label: {
                  formatter: `${t.label} ${formatNumber(t.value, decimals)}${unit}`,
                  position: 'insideEndTop' as const,
                  color: t.level === 'alarm' ? theme.alarm : theme.warn,
                },
              })),
              ...(input.markerTs != null
                ? [
                    {
                      xAxis: input.markerTs,
                      name: '選取',
                      lineStyle: { color: theme.text, type: 'solid' as const, width: 1 },
                      label: { formatter: formatTime(input.markerTs), color: theme.text },
                    },
                  ]
                : []),
            ],
          },
        }
      : {}),
  }))

  // min/max band: stacked transparent base + filled range.
  input.series.forEach((s, i) => {
    if (!s.band) return
    const color = s.color ?? theme.series[i % theme.series.length]
    series.push(
      {
        type: 'line',
        name: `${s.name} 最小`,
        data: s.band.map(([ts, min]) => [ts, min]),
        stack: `band-${i}`,
        lineStyle: { opacity: 0 },
        showSymbol: false,
        silent: true,
        connectNulls: false,
        tooltip: { show: false },
      },
      {
        type: 'line',
        name: `${s.name} 範圍`,
        data: s.band.map(([ts, min, max]) => [ts, min === null || max === null ? null : max - min]),
        stack: `band-${i}`,
        lineStyle: { opacity: 0 },
        areaStyle: { color, opacity: 0.12 },
        showSymbol: false,
        silent: true,
        connectNulls: false,
        tooltip: { show: false },
      },
    )
  })

  return {
    animation: input.animation ?? false,
    grid: { left: 8, right: 16, top: 28, bottom: input.zoom ? 56 : 24 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.surface,
      borderColor: theme.grid,
      textStyle: { color: theme.text },
      valueFormatter: (v) => (typeof v === 'number' ? `${formatNumber(v, decimals)}${unit}` : '—'),
      axisPointer: { label: { formatter: (p) => tooltipTime(Number(p.value)) } },
    },
    legend:
      input.series.length > 1
        ? { top: 0, textStyle: { color: theme.muted }, data: input.series.map((s) => s.name) }
        : { show: false },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: theme.grid } },
      axisLabel: {
        color: theme.muted,
        hideOverlap: true,
        formatter: (v: number) => (input.showSeconds ? formatTime(v) : formatShortDateTime(v)),
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      ...(input.yMin !== undefined ? { min: input.yMin } : {}),
      // Keep every threshold line inside the axis even when the data stays below it.
      ...(input.yMax !== undefined
        ? { max: input.yMax }
        : thresholds.length > 0
          ? { max: (extent: { max: number }) => Math.max(extent.max, thresholdTop(thresholds)) }
          : {}),
      axisLabel: {
        color: theme.muted,
        formatter: (v: number) => formatNumber(v, Math.min(decimals, 1)),
      },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    dataZoom: input.zoom
      ? [
          {
            type: 'inside',
            filterMode: 'none',
            // Plain wheel scrolls the page; Ctrl + wheel zooms, drag pans.
            zoomOnMouseWheel: 'ctrl',
            moveOnMouseWheel: false,
          },
          {
            type: 'slider',
            height: 20,
            bottom: 8,
            filterMode: 'none',
            labelFormatter: (v: number) => formatShortDateTime(v),
          },
        ]
      : [],
    series,
  }
}

/** Count of points the chart will actually draw. */
export function drawnPoints(series: readonly LineSeries[]): number {
  return series.reduce((sum, s) => sum + s.points.length, 0)
}

export function buildPieOption(
  counts: Record<MachineStatus, number>,
  theme: ChartTheme,
  centerLabel = '台機台',
): EChartsOption {
  const total = MACHINE_STATUSES.reduce((s, k) => s + counts[k], 0)
  return {
    animation: false,
    tooltip: {
      trigger: 'item',
      backgroundColor: theme.surface,
      borderColor: theme.grid,
      textStyle: { color: theme.text },
      formatter: '{b}：{c} 台（{d}%）',
    },
    legend: { bottom: 0, textStyle: { color: theme.muted }, icon: 'circle' },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '38%',
        style: {
          text: String(total),
          fill: theme.text,
          font: '600 28px system-ui',
          align: 'center',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '52%',
        style: { text: centerLabel, fill: theme.muted, font: '12px system-ui', align: 'center' },
      },
    ],
    series: [
      {
        type: 'pie',
        radius: ['52%', '74%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderColor: theme.surface, borderWidth: 2 },
        data: MACHINE_STATUSES.map((status) => ({
          name: MACHINE_STATUS_LABELS[status],
          value: counts[status],
          itemStyle: { color: theme.status[status] },
        })),
      },
    ],
  }
}

export function buildGaugeOption(value: number, theme: ChartTheme, label = 'OEE'): EChartsOption {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 1000) / 10
  return {
    animation: false,
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 100,
        startAngle: 200,
        endAngle: -20,
        radius: '95%',
        center: ['50%', '58%'],
        progress: {
          show: true,
          width: 12,
          itemStyle: {
            color: pct >= 85 ? theme.status.running : pct >= 60 ? theme.warn : theme.alarm,
          },
        },
        axisLine: { lineStyle: { width: 12, color: [[1, theme.grid]] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: { offsetCenter: [0, '28%'], color: theme.muted, fontSize: 12 },
        detail: {
          valueAnimation: false,
          offsetCenter: [0, '-4%'],
          fontSize: 24,
          fontWeight: 600,
          color: theme.text,
          formatter: '{value}%',
        },
        data: [{ value: pct, name: label }],
      },
    ],
  }
}

export interface BarDatum {
  label: string
  value: number
}

export function buildBarOption(
  data: readonly BarDatum[],
  theme: ChartTheme,
  unit = '',
): EChartsOption {
  return {
    animation: false,
    grid: { left: 8, right: 16, top: 16, bottom: 8 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: theme.surface,
      borderColor: theme.grid,
      textStyle: { color: theme.text },
      valueFormatter: (v) => `${formatNumber(Number(v))}${unit ? ` ${unit}` : ''}`,
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.label),
      axisLabel: { color: theme.muted },
      axisLine: { lineStyle: { color: theme.grid } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: theme.muted },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => d.value),
        barMaxWidth: 40,
        itemStyle: { color: theme.series[0], borderRadius: [4, 4, 0, 0] },
        label: {
          show: true,
          position: 'top',
          color: theme.muted,
          formatter: (p) => formatNumber(Number(p.value)),
        },
      },
    ],
  }
}

/** Thresholds of a metric as chart lines. */
export function metricThresholds(metric: MetricKey): Threshold[] {
  const def = METRICS[metric]
  return [
    { label: '警告', value: def.warn, level: 'warn' },
    { label: '告警', value: def.alarm, level: 'alarm' },
  ]
}
