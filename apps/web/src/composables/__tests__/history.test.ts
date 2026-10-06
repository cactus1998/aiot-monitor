import { describe, expect, it } from 'vitest'
import { HOUR } from '@aiot/shared'
import { fromTaipeiInput, toTaipeiInput, formatMetric } from '@/utils/format.ts'
import { parseHistoryQuery } from '../useHistoryQuery.ts'

const NOW = Date.UTC(2026, 9, 6, 4, 0, 30)

describe('parseHistoryQuery', () => {
  it('fills defaults for an empty query', () => {
    expect(parseHistoryQuery({}, NOW)).toEqual({
      machineId: 'CNC-01',
      metric: 'temperature',
      from: NOW - HOUR,
      to: NOW,
      page: 1,
      pageSize: 50,
      sort: '-ts',
    })
  })

  it('keeps valid values from the URL', () => {
    const state = parseHistoryQuery(
      {
        machineId: 'all',
        metric: 'rpm',
        from: '100',
        to: '200',
        page: '3',
        pageSize: '20',
        sort: 'vibration',
      },
      NOW,
    )
    expect(state).toEqual({
      machineId: 'all',
      metric: 'rpm',
      from: 100,
      to: 200,
      page: 3,
      pageSize: 20,
      sort: 'vibration',
    })
  })

  it('replaces invalid values with defaults', () => {
    const state = parseHistoryQuery(
      { metric: 'nope', sort: 'drop table', page: '-1', from: 'abc' },
      NOW,
    )
    expect(state.metric).toBe('temperature')
    expect(state.sort).toBe('-ts')
    expect(state.page).toBe(1)
    expect(state.from).toBe(NOW - HOUR)
  })
})

describe('Taipei datetime-local helpers', () => {
  it('round-trips through the input format in Asia/Taipei', () => {
    const ts = Date.UTC(2026, 9, 5, 17, 30) // 2026-10-06 01:30 Taipei
    expect(toTaipeiInput(ts)).toBe('2026-10-06T01:30')
    expect(fromTaipeiInput('2026-10-06T01:30')).toBe(ts)
  })

  it('returns NaN for incomplete input', () => {
    expect(fromTaipeiInput('2026-10-06')).toBeNaN()
    expect(fromTaipeiInput('')).toBeNaN()
  })
})

describe('formatMetric', () => {
  // EC-07
  it('shows an em dash for missing values and keeps units otherwise', () => {
    expect(formatMetric('temperature', null)).toBe('—')
    expect(formatMetric('temperature', 71.25)).toBe('71.3 °C')
    expect(formatMetric('rpm', 8123.4, false)).toBe('8,123')
  })
})
