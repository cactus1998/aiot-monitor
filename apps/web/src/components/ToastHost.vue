<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import type { Alert } from '@aiot/shared'
import { METRICS, RULE_OP_LABELS } from '@aiot/shared'
import { useLiveStore } from '@/stores/live.ts'
import { formatMetric, formatTime } from '@/utils/format.ts'

/** Pops a short notice for every alert pushed over SSE. */
const live = useLiveStore()
const toasts = ref<Alert[]>([])
const timers = new Set<ReturnType<typeof setTimeout>>()

watch(
  () => live.recentAlerts[0],
  (alert) => {
    if (!alert) return
    toasts.value = [alert, ...toasts.value].slice(0, 3)
    const timer = setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== alert.id)
      timers.delete(timer)
    }, 6000)
    timers.add(timer)
  },
)

onScopeDispose(() => timers.forEach(clearTimeout))

function dismiss(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}
</script>

<template>
  <div class="toasts" role="region" aria-label="即時告警通知" aria-live="assertive">
    <div v-for="t in toasts" :key="t.id" class="toast" role="alert">
      <div>
        <strong>⚠ {{ t.machineId }} {{ METRICS[t.metric].label }}告警</strong>
        <div class="detail">
          {{ formatMetric(t.metric, t.value) }}（{{ RULE_OP_LABELS[t.op] }}
          {{ formatMetric(t.metric, t.threshold) }}）·
          {{ formatTime(t.ts) }}
        </div>
      </div>
      <RouterLink to="/alerts" class="link" @click="dismiss(t.id)">查看</RouterLink>
      <button
        type="button"
        class="btn btn-sm btn-ghost"
        aria-label="關閉通知"
        @click="dismiss(t.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: min(360px, calc(100vw - 2rem));
}
.toast {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem;
  border-radius: var(--radius);
  border-left: 4px solid var(--color-alarm);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  font-size: 0.85rem;
}
.toast > div {
  flex: 1;
}
.detail {
  color: var(--color-text-muted);
  font-size: 0.78rem;
}
.link {
  font-size: 0.8rem;
}
</style>
