<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { MachineStatus } from '@aiot/shared'
import './echarts.ts'
import { buildPieOption } from './options.ts'
import { useChartTheme } from './theme.ts'

const {
  counts,
  centerLabel = '台機台',
  summary,
} = defineProps<{
  counts: Record<MachineStatus, number>
  centerLabel?: string
  summary: string
}>()
const theme = useChartTheme()
const option = computed(() => buildPieOption(counts, theme.value, centerLabel))
</script>

<template>
  <div class="chart" role="img" :aria-label="summary">
    <VChart :option="option" :update-options="{ lazyUpdate: true }" autoresize />
  </div>
</template>

<style scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
