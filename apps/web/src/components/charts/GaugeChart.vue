<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import './echarts.ts'
import { buildGaugeOption } from './options.ts'
import { useChartTheme } from './theme.ts'

/** `value` is a ratio 0–1. */
const {
  value,
  label = 'OEE',
  summary,
} = defineProps<{ value: number; label?: string; summary: string }>()
const theme = useChartTheme()
const option = computed(() => buildGaugeOption(value, theme.value, label))
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
