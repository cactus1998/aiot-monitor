<script setup lang="ts">
import type { Machine, Reading } from '@aiot/shared'
import { MACHINE_TYPE_LABELS, METRIC_KEYS, METRICS } from '@aiot/shared'
import { formatMetric, formatNumber } from '@/utils/format.ts'
import StatusBadge from './StatusBadge.vue'

const {
  machine,
  reading = null,
  outputToday = null,
} = defineProps<{
  machine: Machine
  reading?: Reading | null
  outputToday?: number | null
}>()

function level(key: (typeof METRIC_KEYS)[number], value: number | null): '' | 'warn' | 'alarm' {
  if (value === null) return ''
  const def = METRICS[key]
  return value >= def.alarm ? 'alarm' : value >= def.warn ? 'warn' : ''
}
</script>

<template>
  <RouterLink
    :to="{ name: 'machine', params: { id: machine.id } }"
    class="card machine-card"
    :class="reading?.status"
  >
    <header>
      <div>
        <div class="name">{{ machine.id }}</div>
        <div class="meta">{{ MACHINE_TYPE_LABELS[machine.type] }} · {{ machine.line }} 線</div>
      </div>
      <StatusBadge v-if="reading" :status="reading.status" />
      <span v-else class="meta">等待資料</span>
    </header>
    <dl>
      <div v-for="key in METRIC_KEYS" :key="key" :class="level(key, reading?.[key] ?? null)">
        <dt>{{ METRICS[key].label }}</dt>
        <dd>{{ formatMetric(key, reading?.[key] ?? null) }}</dd>
      </div>
    </dl>
    <footer v-if="outputToday !== null">今日產量 {{ formatNumber(outputToday) }} 件</footer>
  </RouterLink>
</template>

<style scoped>
.machine-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  color: inherit;
  text-decoration: none;
  border-left: 4px solid var(--status-color, var(--color-border));
  transition: box-shadow 0.15s;
}
.machine-card:hover,
.machine-card:focus-visible {
  box-shadow: var(--shadow-lg);
}
.running {
  --status-color: var(--status-running);
}
.idle {
  --status-color: var(--status-idle);
}
.alarm {
  --status-color: var(--status-alarm);
}
.offline {
  --status-color: var(--status-offline);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}
.name {
  font-weight: 700;
}
.meta {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
dl {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem 0.75rem;
  margin: 0;
}
dt {
  font-size: 0.72rem;
  color: var(--color-text-muted);
}
dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.warn dd {
  color: var(--color-warn);
}
.alarm dd {
  color: var(--color-alarm);
}
.warn dd::after,
.alarm dd::after {
  content: ' ▲';
  font-size: 0.65rem;
}
footer {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}
@media (prefers-reduced-motion: reduce) {
  .machine-card {
    transition: none;
  }
}
</style>
