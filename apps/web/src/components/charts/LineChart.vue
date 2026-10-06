<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import VChart from 'vue-echarts'
import './echarts.ts'
import { buildLineOption, type LineChartInput } from './options.ts'
import { useChartTheme } from './theme.ts'

const props = defineProps<
  LineChartInput & {
    /** Accessible summary, e.g. "CNC-01 溫度，最近 1 小時，最高 78°C". */
    summary: string
    /** Charts in the same group share tooltip and zoom. */
    group?: string
  }
>()
const emit = defineEmits<{ zoom: [range: { start: number; end: number }] }>()

const theme = useChartTheme()
const option = computed(() => buildLineOption(props, theme.value))
const chart = useTemplateRef<InstanceType<typeof VChart>>('chart')

function onZoom(): void {
  const instance = chart.value
  if (!instance) return
  // Read the visible window back from the chart (works for inside + slider zoom).
  const opt = instance.getOption?.() as
    { dataZoom?: { startValue?: number; endValue?: number }[] } | undefined
  const zoom = opt?.dataZoom?.[0]
  if (zoom?.startValue !== undefined && zoom.endValue !== undefined) {
    emit('zoom', { start: zoom.startValue, end: zoom.endValue })
  }
}
</script>

<template>
  <div class="chart" role="img" :aria-label="summary">
    <VChart
      ref="chart"
      :option="option"
      :update-options="{ notMerge: false, lazyUpdate: true }"
      :group="group"
      autoresize
      @datazoom="onZoom"
    />
  </div>
</template>

<style scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
