<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import './echarts.ts'
import { buildBarOption, type BarDatum } from './options.ts'
import { useChartTheme } from './theme.ts'

const {
  data,
  unit = '',
  summary,
} = defineProps<{ data: readonly BarDatum[]; unit?: string; summary: string }>()
const theme = useChartTheme()
const option = computed(() => buildBarOption(data, theme.value, unit))
</script>

<template>
  <div class="chart" role="img" :aria-label="summary">
    <VChart :option="option" autoresize />
  </div>
</template>

<style scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
