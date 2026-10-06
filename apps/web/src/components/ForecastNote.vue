<script setup lang="ts">
import { computed } from 'vue'
import type { MetricKey } from '@aiot/shared'
import { HOUR, METRICS } from '@aiot/shared'
import type { MetricView } from '@/composables/useMachineSeries.ts'
import { formatDuration, formatMetric, formatTime } from '@/utils/format.ts'

/** Predictive-maintenance hint from the linear trend of the last 15 minutes. */
const { metric, forecast } = defineProps<{ metric: MetricKey; forecast: MetricView['forecast'] }>()

const view = computed(() => {
  if (!forecast) return null
  const def = METRICS[metric]
  if (forecast.reached) {
    return {
      tone: 'alarm',
      text: `趨勢已達告警閾值 ${formatMetric(metric, def.alarm)}，建議立即檢查`,
    }
  }
  if (forecast.eta === null) return { tone: 'ok', text: '近 15 分鐘趨勢持平或下降' }
  const remaining = forecast.eta - Date.now()
  if (remaining > 2 * HOUR) return { tone: 'ok', text: '2 小時內不會達到告警閾值' }
  return {
    tone: remaining < 30 * 60_000 ? 'alarm' : 'warn',
    text: `預計 ${formatDuration(Math.max(0, remaining))}後（${formatTime(forecast.eta)}）達到 ${formatMetric(metric, def.alarm)}，建議安排保養`,
  }
})
</script>

<template>
  <span v-if="view" class="forecast" :class="view.tone">
    <span aria-hidden="true">↗</span> 趨勢預測：{{ view.text }}
    <span class="r2" title="線性迴歸決定係數，越接近 1 越可信"
      >R² {{ forecast!.r2.toFixed(2) }}</span
    >
  </span>
</template>

<style scoped>
.forecast {
  font-size: 0.75rem;
}
.ok {
  color: var(--color-text-muted);
}
.warn {
  color: var(--color-warn);
  font-weight: 600;
}
.alarm {
  color: var(--color-alarm);
  font-weight: 600;
}
.r2 {
  margin-left: 0.35rem;
  color: var(--color-text-muted);
  font-weight: 400;
}
</style>
