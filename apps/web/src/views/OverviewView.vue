<script setup lang="ts">
import { computed } from 'vue'
import { MACHINE_STATUS_LABELS, MACHINE_STATUSES } from '@aiot/shared'
import BarChart from '@/components/charts/BarChart.vue'
import ChartPanel from '@/components/charts/ChartPanel.vue'
import GaugeChart from '@/components/charts/GaugeChart.vue'
import PieChart from '@/components/charts/PieChart.vue'
import KpiCard from '@/components/KpiCard.vue'
import MachineCard from '@/components/MachineCard.vue'
import StateBlock from '@/components/StateBlock.vue'
import { useInterval } from '@/composables/useInterval.ts'
import { useQuery } from '@/composables/useQuery.ts'
import { useConnectionStore } from '@/stores/connection.ts'
import { useLiveStore } from '@/stores/live.ts'
import { formatNumber, formatPercent } from '@/utils/format.ts'

const live = useLiveStore()
const conn = useConnectionStore()

const overview = useQuery(
  () => ({}),
  (client, _p, signal) => client.getOverview(signal),
)
// Today's totals change slowly; machine cards and the pie update every second from SSE.
useInterval(() => void overview.refresh(), 10_000)

const o = computed(() => overview.data.value)
const statusCounts = computed(() => live.statusCounts)
const machineCount = computed(() => live.machines.length)
const runningRatio = computed(() =>
  machineCount.value ? statusCounts.value.running / machineCount.value : 0,
)
const outputByMachine = computed(
  () => new Map((o.value?.machineOutput ?? []).map((m) => [m.machineId, m.output])),
)
const shiftData = computed(() =>
  (o.value?.shiftOutput ?? []).map((s) => ({ label: s.label, value: s.output })),
)
const pieLabel = computed(
  () =>
    `機台狀態分布：${MACHINE_STATUSES.map((s) => `${MACHINE_STATUS_LABELS[s]} ${statusCounts.value[s]} 台`).join('，')}`,
)
const kpiStatus = computed(() => (o.value ? 'success' : overview.status.value))
</script>

<template>
  <div class="overview">
    <header class="page-header">
      <div>
        <h1>總覽</h1>
        <p>今日（台北時間 00:00 起）產線狀態，機台卡片每秒更新。</p>
      </div>
    </header>

    <section class="kpis" aria-label="關鍵指標">
      <template v-if="kpiStatus === 'success' && o">
        <KpiCard
          label="運轉率（目前）"
          :value="formatPercent(runningRatio)"
          :sub="`${statusCounts.running} / ${machineCount} 台運轉中`"
          :tone="runningRatio >= 0.75 ? 'good' : 'warn'"
        />
        <div class="card kpi-gauge">
          <div class="gauge-label">今日 OEE</div>
          <div class="gauge">
            <GaugeChart :value="o.oee.oee" :summary="`今日 OEE ${formatPercent(o.oee.oee)}`" />
          </div>
          <div class="oee-parts">
            <span>可用率 {{ formatPercent(o.oee.availability) }}</span>
            <span>效能 {{ formatPercent(o.oee.performance) }}</span>
            <span>良率 {{ formatPercent(o.oee.quality) }}</span>
          </div>
        </div>
        <KpiCard
          label="今日產量"
          :value="`${formatNumber(o.outputToday)} 件`"
          :sub="`良品 ${formatNumber(o.goodToday)} 件（${formatPercent(o.outputToday ? o.goodToday / o.outputToday : 0)}）`"
        />
        <RouterLink to="/alerts" class="kpi-link">
          <KpiCard
            label="未處理告警"
            :value="formatNumber(live.openAlerts || o.openAlerts)"
            sub="點擊前往告警中心"
            :tone="(live.openAlerts || o.openAlerts) > 0 ? 'alarm' : 'good'"
          />
        </RouterLink>
      </template>
      <div v-else class="card kpi-state">
        <StateBlock
          :kind="kpiStatus === 'error' ? 'error' : 'loading'"
          :message="overview.error.value ?? undefined"
          @retry="overview.refresh"
        />
      </div>
    </section>

    <section class="charts">
      <ChartPanel
        title="機台狀態分布"
        description="即時（SSE），顏色搭配文字標示"
        :status="machineCount ? 'success' : conn.health === 'down' ? 'error' : 'loading'"
        :error="conn.healthError"
        :height="240"
        @retry="conn.checkHealth()"
      >
        <PieChart :counts="statusCounts" :summary="pieLabel" />
        <template #table>
          <table class="simple">
            <thead>
              <tr>
                <th>狀態</th>
                <th>台數</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in MACHINE_STATUSES" :key="s">
                <td>{{ MACHINE_STATUS_LABELS[s] }}</td>
                <td>{{ statusCounts[s] }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </ChartPanel>

      <ChartPanel
        title="班別產量"
        description="大夜 00–08、早班 08–16、中班 16–24"
        :status="o ? 'success' : overview.status.value"
        :error="overview.error.value"
        :height="240"
        @retry="overview.refresh"
      >
        <BarChart
          :data="shiftData"
          unit="件"
          :summary="`班別產量：${shiftData.map((d) => `${d.label} ${d.value} 件`).join('，')}`"
        />
        <template #table>
          <table class="simple">
            <thead>
              <tr>
                <th>班別</th>
                <th>產量（件）</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in shiftData" :key="d.label">
                <td>{{ d.label }}</td>
                <td>{{ formatNumber(d.value) }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </ChartPanel>
    </section>

    <section aria-labelledby="machines-heading">
      <h2 id="machines-heading" class="section-title">機台</h2>
      <div v-if="live.machines.length" class="machines">
        <MachineCard
          v-for="m in live.machines"
          :key="m.id"
          :machine="m"
          :reading="live.latest[m.id] ?? null"
          :output-today="outputByMachine.get(m.id) ?? null"
        />
      </div>
      <div v-else class="card">
        <StateBlock kind="loading" message="讀取機台中…" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}
.kpi-state {
  grid-column: 1 / -1;
}
.kpi-link {
  color: inherit;
  text-decoration: none;
  display: grid;
}
.kpi-gauge {
  display: flex;
  flex-direction: column;
  padding-bottom: 0.6rem;
}
.gauge-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
.gauge {
  height: 110px;
}
.oee-parts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.2rem 0.6rem;
  font-size: 0.72rem;
  color: var(--color-text-muted);
}
.charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
.section-title {
  font-size: 1.05rem;
  margin: 0.5rem 0 0.75rem;
}
.machines {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}
@media (max-width: 1100px) {
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 720px) {
  .charts {
    grid-template-columns: 1fr;
  }
}
</style>
