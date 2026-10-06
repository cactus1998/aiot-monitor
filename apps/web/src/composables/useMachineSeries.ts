import { computed, ref, type Ref } from 'vue'
import type { MetricKey, RangePreset, SeriesResponse } from '@aiot/shared'
import {
  forecastThreshold,
  lttb,
  METRIC_KEYS,
  METRICS,
  MINUTE,
  RANGE_PRESET_MS,
  SECOND,
} from '@aiot/shared'
import type { LinePoint } from '@/components/charts/options.ts'
import { useLiveStore } from '@/stores/live.ts'
import { useQuery } from './useQuery.ts'

/** Hard cap on points per chart (PRD: ≤ 2000). */
export const MAX_DRAWN = 2000
/** Points requested from the bucketed series endpoint. */
export const SERIES_POINTS = 720
const FORECAST_WINDOW_MS = 15 * MINUTE
const FORECAST_MIN_POINTS = 10

export interface MetricView {
  metric: MetricKey
  points: LinePoint[]
  band: [number, number | null, number | null][] | undefined
  rawCount: number
  drawn: number
  elapsedMs: number
  forecast: { eta: number | null; reached: boolean; line: LinePoint[]; r2: number } | null
}

/**
 * History for all four metrics of one machine plus, for the 1 h range, the
 * per-second live tail from the SSE buffer. Anything above MAX_DRAWN points is
 * reduced with LTTB before it reaches ECharts.
 */
export function useMachineSeries(
  machineId: Ref<string>,
  range: Ref<RangePreset>,
  /** Skip fetching until the machine is known to exist. */
  enabled: Ref<boolean>,
) {
  const live = useLiveStore()
  const nonce = ref(0)

  const query = useQuery(
    () =>
      enabled.value
        ? { id: machineId.value, range: range.value, nonce: nonce.value, resync: live.resyncs }
        : null,
    async (client, p, signal) => {
      const to = Date.now() - (Date.now() % SECOND)
      const from = to - RANGE_PRESET_MS[p.range]
      const t0 = performance.now()
      const results = await Promise.all(
        METRIC_KEYS.map((metric) =>
          client.getSeries(p.id, { metric, from, to, points: SERIES_POINTS }, signal),
        ),
      )
      return {
        from,
        to,
        fetchMs: performance.now() - t0,
        byMetric: Object.fromEntries(results.map((r) => [r.metric, r])) as Record<
          MetricKey,
          SeriesResponse
        >,
      }
    },
    { isEmpty: (d) => METRIC_KEYS.every((m) => d.byMetric[m].points.length === 0) },
  )

  const views = computed<Record<MetricKey, MetricView> | null>(() => {
    const data = query.data.value
    if (!data) return null
    // Re-run on every live frame for the 1 h range.
    const isLive = range.value === '1h'
    if (isLive) void live.frame
    const tail = isLive ? live.buffer(machineId.value) : []
    const windowStart = isLive ? Date.now() - RANGE_PRESET_MS['1h'] : data.from

    return Object.fromEntries(
      METRIC_KEYS.map((metric) => {
        const t0 = performance.now()
        const series = data.byMetric[metric]
        const lastHistoryTs = series.points.at(-1)?.ts ?? data.from
        const history: LinePoint[] = series.points
          .filter((p) => p.ts >= windowStart)
          .map((p) => [p.ts, p.avg])
        const liveTail: LinePoint[] = tail
          .filter((r) => r.ts > lastHistoryTs + series.bucketMs && r.ts >= windowStart)
          .map((r) => [r.ts, r[metric]])
        const all = [...history, ...liveTail]
        const points = all.length > MAX_DRAWN ? downsample(all, MAX_DRAWN) : all
        const band = isLive
          ? undefined
          : series.points.map((p): [number, number | null, number | null] => [p.ts, p.min, p.max])

        return [
          metric,
          {
            metric,
            points,
            band,
            rawCount: series.rawCount + liveTail.length,
            drawn: points.length,
            elapsedMs: performance.now() - t0,
            forecast: buildForecast(metric, all),
          },
        ]
      }),
    ) as Record<MetricKey, MetricView>
  })

  return {
    ...query,
    views,
    fetchMs: computed(() => query.data.value?.fetchMs ?? null),
    reload: () => {
      nonce.value += 1
    },
  }
}

/** LTTB on the non-null points; nulls are dropped because LTTB needs numbers. */
function downsample(points: readonly LinePoint[], threshold: number): LinePoint[] {
  const numeric = points
    .filter((p): p is [number, number] => p[1] !== null)
    .map(([ts, value]) => ({ ts, value }))
  return lttb(numeric, threshold).map((p) => [p.ts, p.value])
}

function buildForecast(metric: MetricKey, points: readonly LinePoint[]): MetricView['forecast'] {
  if (metric === 'rpm') return null
  const last = points.at(-1)
  if (!last) return null
  const recent = points
    .filter((p): p is [number, number] => p[1] !== null && p[0] >= last[0] - FORECAST_WINDOW_MS)
    .map(([ts, value]) => ({ ts, value }))
  if (recent.length < FORECAST_MIN_POINTS) return null
  const threshold = METRICS[metric].alarm
  const result = forecastThreshold(recent, threshold)
  if (!result) return null
  const { slope, intercept, r2 } = result.regression
  const startTs = recent[0]!.ts
  const endTs =
    result.eta && !result.reached ? Math.min(result.eta, last[0] + 2 * 60 * MINUTE) : last[0]
  const line: LinePoint[] = [
    [startTs, slope * startTs + intercept],
    [endTs, slope * endTs + intercept],
  ]
  return { eta: result.eta, reached: result.reached, line, r2 }
}
