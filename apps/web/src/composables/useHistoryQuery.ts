import { computed } from 'vue'
import type { LocationQuery } from 'vue-router'
import type { MetricKey, ReadingSort } from '@aiot/shared'
import { HOUR, isMetricKey, isReadingSort, MAX_PAGE_SIZE, METRIC_KEYS, SECOND } from '@aiot/shared'
import { useLiveStore } from '@/stores/live.ts'
import { useQuery } from './useQuery.ts'
import { queryInt, queryString, useUrlState } from './useUrlState.ts'

export const ALL_MACHINES = 'all'

export interface HistoryState extends Record<string, string | number | undefined> {
  machineId: string
  metric: MetricKey
  from: number
  to: number
  page: number
  pageSize: number
  sort: ReadingSort
}

const PAGE_SIZES = [20, 50, 100]

/** Turn any URL query into a valid history state; bad values fall back to defaults. */
export function parseHistoryQuery(query: LocationQuery, now = Date.now()): HistoryState {
  const to = queryInt(query, 'to') ?? now - (now % SECOND)
  const from = queryInt(query, 'from') ?? to - HOUR
  const metric = queryString(query, 'metric')
  const sort = queryString(query, 'sort')
  const pageSize = queryInt(query, 'pageSize') ?? 50
  return {
    machineId: queryString(query, 'machineId') || 'CNC-01',
    metric: isMetricKey(metric) ? metric : 'temperature',
    from,
    to,
    page: Math.max(1, queryInt(query, 'page') ?? 1),
    pageSize: PAGE_SIZES.includes(pageSize)
      ? pageSize
      : Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize)),
    sort: isReadingSort(sort) ? sort : '-ts',
  }
}

/**
 * The history page's data: URL-synced filters, the paged table and the chart.
 * Both queries abort their previous request when the filters change (EC-01).
 */
export function useHistoryQuery() {
  const live = useLiveStore()
  const { state, update } = useUrlState((q) => parseHistoryQuery(q))
  const machineFilter = computed(() =>
    state.value.machineId === ALL_MACHINES ? undefined : state.value.machineId,
  )

  const table = useQuery(
    () => ({
      machineId: machineFilter.value,
      from: state.value.from,
      to: state.value.to,
      page: state.value.page,
      pageSize: state.value.pageSize,
      sort: state.value.sort,
    }),
    (client, p, signal) => client.getReadings(p, signal),
    { isEmpty: (d) => d.total === 0 },
  )

  const chartMachineIds = computed(() =>
    machineFilter.value ? [machineFilter.value] : live.machines.map((m) => m.id),
  )

  const chart = useQuery(
    () =>
      chartMachineIds.value.length === 0
        ? null
        : {
            ids: chartMachineIds.value,
            metric: state.value.metric,
            from: state.value.from,
            to: state.value.to,
          },
    async (client, p, signal) => {
      const t0 = performance.now()
      const series = await Promise.all(
        p.ids.map((id) =>
          client.getSeries(id, { metric: p.metric, from: p.from, to: p.to, points: 720 }, signal),
        ),
      )
      return { series, elapsedMs: performance.now() - t0 }
    },
    { isEmpty: (d) => d.series.every((s) => s.points.length === 0) },
  )

  return { state, update, machineFilter, table, chart, metrics: METRIC_KEYS }
}
