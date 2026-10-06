import { describe, expect, it } from 'vitest'
import { METRICS } from '@aiot/shared'
import {
  buildBarOption,
  buildGaugeOption,
  buildLineOption,
  buildPieOption,
  drawnPoints,
  metricThresholds,
} from '../options.ts'
import { DEFAULT_CHART_THEME as theme } from '../theme.ts'

type AnySeries = {
  type: string
  name?: string
  data: unknown[]
  connectNulls?: boolean
  markLine?: { data: { yAxis?: number; xAxis?: number }[] }
}

describe('buildLineOption', () => {
  const points: [number, number | null][] = [
    [1000, 50],
    [2000, null],
    [3000, 60],
  ]

  // EC-07
  it('keeps null values so the line breaks instead of dropping to 0', () => {
    const option = buildLineOption({ series: [{ name: '溫度', points }] }, theme)
    const series = option.series as AnySeries[]
    expect(series[0]!.data).toEqual(points)
    expect(series[0]!.connectNulls).toBe(false)
    expect(option.xAxis).toMatchObject({ type: 'time' })
  })

  it('draws warn and alarm threshold lines on the first series', () => {
    const option = buildLineOption(
      { series: [{ name: '溫度', points }], thresholds: metricThresholds('temperature') },
      theme,
    )
    const series = option.series as AnySeries[]
    expect(series[0]!.markLine!.data.map((d) => d.yAxis)).toEqual([
      METRICS.temperature.warn,
      METRICS.temperature.alarm,
    ])
  })

  it('stretches the y axis so threshold lines stay visible', () => {
    const option = buildLineOption(
      {
        series: [{ name: '振動', points: [[1000, 2]] }],
        thresholds: metricThresholds('vibration'),
      },
      theme,
    )
    const max = (option.yAxis as { max: (e: { max: number }) => number }).max
    expect(max({ max: 3 })).toBeCloseTo(METRICS.vibration.alarm * 1.05)
    expect(max({ max: 20 })).toBe(20)
  })

  it('adds a vertical marker for the selected time', () => {
    const option = buildLineOption({ series: [{ name: 'a', points }], markerTs: 2000 }, theme)
    const series = option.series as AnySeries[]
    expect(series[0]!.markLine!.data.some((d) => d.xAxis === 2000)).toBe(true)
  })

  it('adds stacked band series for min / max ranges', () => {
    const option = buildLineOption(
      { series: [{ name: 'a', points, band: [[1000, 40, 55]] }] },
      theme,
    )
    const series = option.series as AnySeries[]
    expect(series).toHaveLength(3)
    expect(series[2]!.data).toEqual([[1000, 15]])
  })

  it('enables zoom controls only when asked', () => {
    expect(buildLineOption({ series: [], zoom: true }, theme).dataZoom).toHaveLength(2)
    expect(buildLineOption({ series: [] }, theme).dataZoom).toHaveLength(0)
  })

  it('counts drawn points', () => {
    expect(
      drawnPoints([
        { name: 'a', points },
        { name: 'b', points: points.slice(0, 1) },
      ]),
    ).toBe(4)
  })
})

describe('buildPieOption', () => {
  it('maps every status with its colour and shows the total', () => {
    const option = buildPieOption({ running: 5, idle: 1, alarm: 1, offline: 1 }, theme)
    const pie = (
      option.series as { data: { name: string; value: number; itemStyle: { color: string } }[] }[]
    )[0]!
    expect(pie.data.map((d) => d.value)).toEqual([5, 1, 1, 1])
    expect(pie.data[2]!.itemStyle.color).toBe(theme.status.alarm)
    const graphic = option.graphic as { style: { text: string } }[]
    expect(graphic[0]!.style.text).toBe('8')
  })
})

describe('buildGaugeOption', () => {
  it('converts a ratio to a clamped percentage', () => {
    const value = (o: ReturnType<typeof buildGaugeOption>) =>
      (o.series as { data: { value: number }[] }[])[0]!.data[0]!.value
    expect(value(buildGaugeOption(0.7567, theme))).toBe(75.7)
    expect(value(buildGaugeOption(1.4, theme))).toBe(100)
    expect(value(buildGaugeOption(-1, theme))).toBe(0)
  })
})

describe('buildBarOption', () => {
  it('uses labels as categories', () => {
    const option = buildBarOption([{ label: '早班', value: 10 }], theme)
    expect(option.xAxis).toMatchObject({ data: ['早班'] })
    expect((option.series as { data: number[] }[])[0]!.data).toEqual([10])
  })
})
