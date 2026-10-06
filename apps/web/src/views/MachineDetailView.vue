<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, toRef } from 'vue'
import type { Alert, RangePreset } from '@aiot/shared'
import {
  MACHINE_TYPE_LABELS,
  METRIC_KEYS,
  METRICS,
  RANGE_PRESETS,
  RULE_OP_LABELS,
  summarize,
} from '@aiot/shared'
import ChartPanel from '@/components/charts/ChartPanel.vue'
import { connect, disconnect } from '@/components/charts/echarts.ts'
import LineChart from '@/components/charts/LineChart.vue'
import { metricThresholds, type LineSeries } from '@/components/charts/options.ts'
import { useChartTheme } from '@/components/charts/theme.ts'
import ForecastNote from '@/components/ForecastNote.vue'
import StateBlock from '@/components/StateBlock.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useInterval } from '@/composables/useInterval.ts'
import { useMachineSeries } from '@/composables/useMachineSeries.ts'
import { useQuery } from '@/composables/useQuery.ts'
import { queryString, useUrlState } from '@/composables/useUrlState.ts'
import { useLiveStore } from '@/stores/live.ts'
import { formatDateTime, formatMetric, formatNumber, formatTime } from '@/utils/format.ts'

const props = defineProps<{ id: string }>()
const machineId = toRef(props, 'id')
const live = useLiveStore()
const theme = useChartTheme()
const GROUP = 'machine-detail'

const RANGE_LABELS: Record<RangePreset, string> = {
  '1h': '1 小時',
  '6h': '6 小時',
  '24h': '24 小時',
}
const { state, update } = useUrlState((q) => {
  const r = queryString(q, 'range')
  return {
    range: (RANGE_PRESETS as readonly string[]).includes(r ?? '') ? (r as RangePreset) : '1h',
  }
})
const range = computed(() => state.value.range)

const machine = computed(() => live.machines.find((m) => m.id === machineId.value))
const notFound = computed(() => live.machines.length > 0 && !machine.value)
const reading = computed(() => live.latest[machineId.value] ?? null)

const series = useMachineSeries(
  machineId,
  range,
  computed(() => machine.value !== undefined),
)
// Long ranges refresh every minute; 1 h is extended live from SSE.
useInterval(() => {
  if (range.value !== '1h') series.reload()
}, 60_000)

const alertsQuery = useQuery(
  () => (machine.value ? { machineId: machineId.value } : null),
  (client, p, signal) => client.listAlerts({ machineId: p.machineId, limit: 20 }, signal),
  { isEmpty: (d) => d.items.length === 0 },
)
const events = computed<Alert[]>(() => {
  const stored = alertsQuery.data.value?.items ?? []
  const fresh = live.recentAlerts.filter(
    (a) => a.machineId === machineId.value && !stored.some((s) => s.id === a.id),
  )
  return [...fresh, ...stored].slice(0, 20)
})

function chartSeries(metric: (typeof METRIC_KEYS)[number]): LineSeries[] {
  const view = series.views.value?.[metric]
  if (!view) return []
  const main: LineSeries = {
    name: METRICS[metric].label,
    points: view.points,
    color: theme.value.metric[metric],
  }
  if (view.band) main.band = view.band
  const out: LineSeries[] = [main]
  if (view.forecast && view.forecast.eta !== null) {
    out.push({
      name: '趨勢預測',
      points: view.forecast.line,
      color: theme.value.forecast,
      dashed: true,
    })
  }
  return out
}

function ariaSummary(metric: (typeof METRIC_KEYS)[number]): string {
  const view = series.views.value?.[metric]
  const s = summarize(view?.points.map((p) => p[1]) ?? [])
  return `${machineId.value} ${METRICS[metric].label}，最近 ${RANGE_LABELS[range.value]}，最高 ${formatMetric(metric, s.max)}，平均 ${formatMetric(metric, s.avg)}`
}

onMounted(() => connect(GROUP))
onBeforeUnmount(() => disconnect(GROUP))
</script>

<template>
  <div class="detail">
    <template v-if="notFound">
      <div class="card">
        <StateBlock kind="empty" :message="`找不到機台 ${machineId}`" hint="請從總覽選擇機台" />
        <p class="back"><RouterLink to="/">← 返回總覽</RouterLink></p>
      </div>
    </template>
    <template v-else>
      <header class="page-header">
        <div>
          <p class="crumb"><RouterLink to="/">總覽</RouterLink> / 機台詳情</p>
          <h1>
            {{ machine?.name ?? machineId }}
            <StatusBadge v-if="reading" :status="reading.status" />
          </h1>
          <p v-if="machine">
            {{ machineId }} · {{ MACHINE_TYPE_LABELS[machine.type] }} · {{ machine.line }} 線 ·
            理想週期 {{ machine.idealCycleSec }} 秒
            <template v-if="reading"> · 累計產量 {{ formatNumber(reading.output) }} 件</template>
          </p>
        </div>
        <div class="segmented" role="group" aria-label="時間範圍">
          <button
            v-for="r in RANGE_PRESETS"
            :key="r"
            type="button"
            :aria-pressed="range === r"
            @click="update({ range: r })"
          >
            {{ RANGE_LABELS[r] }}
          </button>
        </div>
      </header>

      <p class="range-note muted">
        {{
          range === '1h'
            ? '最近 1 小時：資料庫每 10 秒一筆 + SSE 每秒即時追加'
            : `最近 ${RANGE_LABELS[range]}：伺服器端分桶（平均線 + 最小/最大範圍帶），每 60 秒更新`
        }}
        <template v-if="series.fetchMs.value !== null">
          · API 4 個請求共 {{ formatNumber(series.fetchMs.value, 0) }} ms</template
        >
      </p>

      <section class="grid" aria-label="指標折線圖">
        <ChartPanel
          v-for="metric in METRIC_KEYS"
          :key="metric"
          :title="`${METRICS[metric].label}（${METRICS[metric].unit}）`"
          :status="series.status.value"
          :error="series.error.value"
          :raw-points="series.views.value?.[metric].rawCount ?? null"
          :drawn-points="series.views.value?.[metric].drawn ?? null"
          :elapsed-ms="series.views.value?.[metric].elapsedMs ?? null"
          :height="220"
          @retry="series.refresh"
        >
          <LineChart
            :series="chartSeries(metric)"
            :unit="METRICS[metric].unit"
            :decimals="METRICS[metric].decimals"
            :thresholds="metricThresholds(metric)"
            :show-seconds="range === '1h'"
            :group="GROUP"
            zoom
            :summary="ariaSummary(metric)"
          />
          <template #table>
            <table class="simple">
              <thead>
                <tr>
                  <th>時間</th>
                  <th>{{ METRICS[metric].label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in series.views.value?.[metric].points.slice(-200).toReversed()"
                  :key="p[0]"
                >
                  <td>{{ formatDateTime(p[0]) }}</td>
                  <td>{{ formatMetric(metric, p[1]) }}</td>
                </tr>
              </tbody>
            </table>
          </template>
          <template #footer>
            <ForecastNote
              :metric="metric"
              :forecast="series.views.value?.[metric].forecast ?? null"
            />
          </template>
        </ChartPanel>
      </section>

      <section class="card events" aria-labelledby="events-heading">
        <h2 id="events-heading">事件（最近 20 筆告警）</h2>
        <StateBlock
          v-if="alertsQuery.status.value === 'loading' && !alertsQuery.data.value"
          kind="loading"
        />
        <StateBlock
          v-else-if="alertsQuery.status.value === 'error'"
          kind="error"
          :message="alertsQuery.error.value ?? undefined"
          @retry="alertsQuery.refresh"
        />
        <StateBlock v-else-if="events.length === 0" kind="empty" message="沒有告警紀錄" />
        <ul v-else class="event-list">
          <li v-for="a in events" :key="a.id" :class="{ acked: a.ackedAt !== null }">
            <time :datetime="new Date(a.ts).toISOString()">{{ formatDateTime(a.ts) }}</time>
            <span>
              <strong>{{ METRICS[a.metric].label }}</strong>
              {{ formatMetric(a.metric, a.value) }}（{{ RULE_OP_LABELS[a.op] }}
              {{ formatMetric(a.metric, a.threshold) }}）
            </span>
            <span class="tag">{{
              a.ackedAt === null ? '未處理' : `已確認 ${formatTime(a.ackedAt)}`
            }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.crumb {
  font-size: 0.8rem;
}
h1 {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.range-note {
  margin: -0.5rem 0 0;
  font-size: 0.8rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
.events h2 {
  font-size: 1rem;
  margin: 0 0 0.5rem;
}
.event-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.85rem;
}
.event-list li {
  display: grid;
  grid-template-columns: 11rem 1fr auto;
  gap: 0.75rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--color-border);
}
.event-list li.acked {
  color: var(--color-text-muted);
}
time {
  font-variant-numeric: tabular-nums;
}
.tag {
  font-size: 0.75rem;
}
li:not(.acked) .tag {
  color: var(--color-alarm);
  font-weight: 600;
}
.back {
  text-align: center;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .event-list li {
    grid-template-columns: 1fr;
    gap: 0.1rem;
  }
}
</style>
