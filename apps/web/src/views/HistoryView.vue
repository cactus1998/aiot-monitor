<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Reading, ReadingSort, ReadingSortField } from '@aiot/shared'
import {
  MACHINE_STATUS_LABELS,
  METRIC_KEYS,
  METRICS,
  RANGE_PRESET_MS,
  RANGE_PRESETS,
  TimeRangeSchema,
} from '@aiot/shared'
import ChartPanel from '@/components/charts/ChartPanel.vue'
import LineChart from '@/components/charts/LineChart.vue'
import { metricThresholds, type LineSeries } from '@/components/charts/options.ts'
import { useChartTheme } from '@/components/charts/theme.ts'
import DataTable from '@/components/DataTable.vue'
import type { Column } from '@/components/table.ts'
import { errorMessage } from '@/api'
import { ALL_MACHINES, useHistoryQuery } from '@/composables/useHistoryQuery.ts'
import { useConnectionStore } from '@/stores/connection.ts'
import { useLiveStore } from '@/stores/live.ts'
import { downloadBlob } from '@/utils/download.ts'
import {
  formatDateTime,
  formatMetric,
  formatNumber,
  fromTaipeiInput,
  toTaipeiInput,
} from '@/utils/format.ts'

const live = useLiveStore()
const conn = useConnectionStore()
const theme = useChartTheme()
const route = useRoute()
const { state, update, machineFilter, table, chart } = useHistoryQuery()

// Pin default filters into the URL so refresh / share reproduces the same result.
onMounted(() => {
  if (!route.query.from || !route.query.to) void update({})
})

// ----- filter form (draft until submitted) -----
const draft = ref({ machineId: '', metric: state.value.metric, from: '', to: '' })
const formError = ref<string | null>(null)
watch(
  state,
  (s) => {
    draft.value = {
      machineId: s.machineId,
      metric: s.metric,
      from: toTaipeiInput(s.from),
      to: toTaipeiInput(s.to),
    }
  },
  { immediate: true },
)

function submit(): void {
  const from = fromTaipeiInput(draft.value.from)
  const to = fromTaipeiInput(draft.value.to)
  if (Number.isNaN(from) || Number.isNaN(to)) {
    formError.value = '請輸入完整的開始與結束時間'
    return
  }
  // Same schema the API validates with (EC-08).
  const check = TimeRangeSchema.safeParse({ from, to })
  if (!check.success) {
    formError.value = check.error.issues[0]?.message ?? '時間範圍不正確'
    return
  }
  formError.value = null
  selected.value = null
  void update({ machineId: draft.value.machineId, metric: draft.value.metric, from, to, page: 1 })
}

function preset(p: (typeof RANGE_PRESETS)[number]): void {
  // Round up to the next minute: datetime-local has minute precision.
  const to = Math.ceil(Date.now() / 60_000) * 60_000
  draft.value.from = toTaipeiInput(to - RANGE_PRESET_MS[p])
  draft.value.to = toTaipeiInput(to)
  submit()
}

// ----- table -----
const selected = ref<Reading | null>(null)
const rowKey = (r: Reading) => `${r.machineId}-${r.ts}`
const columns: Column<Reading, ReadingSortField>[] = [
  { key: 'ts', label: '時間', sortKey: 'ts', format: (r) => formatDateTime(r.ts) },
  { key: 'machineId', label: '機台', format: (r) => r.machineId },
  ...METRIC_KEYS.map((m): Column<Reading, ReadingSortField> => ({
    key: m,
    label: `${METRICS[m].label}（${METRICS[m].unit}）`,
    sortKey: m,
    align: 'right',
    format: (r) => formatMetric(m, r[m], false),
  })),
  { key: 'status', label: '狀態', format: (r) => MACHINE_STATUS_LABELS[r.status] },
  { key: 'output', label: '累計產量', align: 'right', format: (r) => formatNumber(r.output) },
]

function onRowClick(row: Reading): void {
  selected.value = rowKey(row) === (selected.value && rowKey(selected.value)) ? null : row
}

// ----- chart -----
const zoomRange = ref<{ start: number; end: number } | null>(null)
const chartSeries = computed<LineSeries[]>(() =>
  (chart.data.value?.series ?? []).map((s, i) => ({
    name: s.machineId,
    points: s.points.map((p) => [p.ts, p.avg] as [number, number | null]),
    color: machineFilter.value
      ? theme.value.metric[state.value.metric]
      : theme.value.series[i % theme.value.series.length],
  })),
)
const rawCount = computed(
  () => chart.data.value?.series.reduce((s, x) => s + x.rawCount, 0) ?? null,
)
const drawn = computed(() => chartSeries.value.reduce((s, x) => s + x.points.length, 0))
const metricDef = computed(() => METRICS[state.value.metric])

// ----- CSV export (AC-04) -----
const exporting = ref(false)
const exportError = ref<string | null>(null)
async function exportCsv(): Promise<void> {
  if (!conn.client) return
  exporting.value = true
  exportError.value = null
  try {
    const { from, to } = state.value
    const blob = await conn.client.exportReadingsCsv({ machineId: machineFilter.value, from, to })
    const stamp = toTaipeiInput(from).replace(/[-:T]/g, '')
    downloadBlob(blob, `readings-${state.value.machineId}-${stamp}.csv`)
  } catch (error) {
    exportError.value = errorMessage(error)
  } finally {
    exporting.value = false
  }
}

const sortModel = computed({
  get: () => state.value.sort,
  set: (sort: ReadingSort) => void update({ sort, page: 1 }),
})
</script>

<template>
  <div class="history">
    <header class="page-header">
      <div>
        <h1>歷史查詢</h1>
        <p>條件送出後呼叫 REST API，同一批資料同時呈現為表格與折線圖；條件會同步到網址。</p>
      </div>
    </header>

    <form class="card filters" novalidate @submit.prevent="submit">
      <label class="field">
        機台
        <select v-model="draft.machineId">
          <option :value="ALL_MACHINES">全部機台</option>
          <option v-for="m in live.machines" :key="m.id" :value="m.id">
            {{ m.id }}（{{ m.name }}）
          </option>
        </select>
      </label>
      <label class="field">
        圖表指標
        <select v-model="draft.metric">
          <option v-for="m in METRIC_KEYS" :key="m" :value="m">{{ METRICS[m].label }}</option>
        </select>
      </label>
      <label class="field">
        開始時間（台北）
        <input
          v-model="draft.from"
          type="datetime-local"
          required
          :aria-invalid="formError !== null"
        />
      </label>
      <label class="field">
        結束時間（台北）
        <input
          v-model="draft.to"
          type="datetime-local"
          required
          :aria-invalid="formError !== null"
        />
      </label>
      <div class="actions">
        <div class="segmented" role="group" aria-label="快捷範圍">
          <button v-for="p in RANGE_PRESETS" :key="p" type="button" @click="preset(p)">
            最近 {{ p }}
          </button>
        </div>
        <button type="submit" class="btn btn-primary">查詢</button>
      </div>
      <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
    </form>

    <ChartPanel
      :title="`${metricDef.label}趨勢（${machineFilter ?? '全部機台'}）`"
      :description="`${formatDateTime(state.from)} – ${formatDateTime(state.to)}，伺服器端分桶降採樣`"
      :status="chart.status.value"
      :error="chart.error.value"
      :raw-points="rawCount"
      :drawn-points="drawn"
      :elapsed-ms="chart.data.value?.elapsedMs ?? null"
      :height="300"
      @retry="chart.refresh"
    >
      <LineChart
        :series="chartSeries"
        :unit="metricDef.unit"
        :decimals="metricDef.decimals"
        :thresholds="machineFilter ? metricThresholds(state.metric) : []"
        :marker-ts="selected?.ts ?? null"
        zoom
        :summary="`${metricDef.label}歷史折線圖，${chartSeries.length} 條序列`"
        @zoom="zoomRange = $event"
      />
      <template #table>
        <table class="simple">
          <thead>
            <tr>
              <th>機台</th>
              <th>時間（分桶起點）</th>
              <th>平均 {{ metricDef.label }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="s in chart.data.value?.series ?? []" :key="s.machineId">
              <tr v-for="p in s.points" :key="`${s.machineId}-${p.ts}`">
                <td>{{ s.machineId }}</td>
                <td>{{ formatDateTime(p.ts) }}</td>
                <td>{{ formatMetric(state.metric, p.avg) }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </template>
      <template #footer>
        <span v-if="zoomRange"
          >縮放範圍 {{ formatDateTime(zoomRange.start) }} –
          {{ formatDateTime(zoomRange.end) }}</span
        >
        <span v-if="selected"
          >已選取 {{ selected.machineId }} {{ formatDateTime(selected.ts) }}（圖上直線）</span
        >
      </template>
    </ChartPanel>

    <section class="card" aria-labelledby="table-heading">
      <div class="table-head">
        <h2 id="table-heading">原始讀值</h2>
        <div class="export">
          <span v-if="exportError" class="form-error" role="alert">{{ exportError }}</span>
          <button
            type="button"
            class="btn"
            :disabled="exporting || table.status.value !== 'success'"
            @click="exportCsv"
          >
            {{
              exporting ? '匯出中…' : `匯出 CSV（${formatNumber(table.data.value?.total ?? 0)} 筆）`
            }}
          </button>
        </div>
      </div>
      <DataTable
        v-model:sort="sortModel"
        :columns="columns"
        :rows="table.data.value?.items ?? []"
        :row-key="rowKey"
        :total="table.data.value?.total ?? 0"
        :page="state.page"
        :page-size="state.pageSize"
        :status="table.status.value"
        :error="table.error.value"
        :selected-key="selected ? rowKey(selected) : null"
        caption="歷史讀值，可依時間與指標排序"
        empty-hint="此時間範圍沒有讀值，請調整時間範圍"
        @update:page="update({ page: $event })"
        @update:page-size="update({ pageSize: $event, page: 1 })"
        @retry="table.refresh"
        @row-click="onRowClick"
      />
    </section>
  </div>
</template>

<style scoped>
.history {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: end;
}
.actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
}
.filters .form-error {
  grid-column: 1 / -1;
  margin: 0;
}
.table-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.table-head h2 {
  margin: 0;
  font-size: 1rem;
}
.export {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
@media (max-width: 900px) {
  .filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 520px) {
  .filters {
    grid-template-columns: 1fr;
  }
}
</style>
