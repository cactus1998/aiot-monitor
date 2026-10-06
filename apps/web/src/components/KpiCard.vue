<script setup lang="ts">
const {
  label,
  value,
  sub = '',
  tone = 'default',
} = defineProps<{
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'good' | 'warn' | 'alarm'
}>()
</script>

<template>
  <div class="card kpi" :class="tone">
    <div class="label">{{ label }}</div>
    <div class="value">{{ value }}</div>
    <div v-if="sub || $slots.default" class="sub">
      <slot>{{ sub }}</slot>
    </div>
  </div>
</template>

<style scoped>
.kpi {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}
.label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
.value {
  font-size: 1.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.sub {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}
.good .value {
  color: var(--status-running);
}
.warn .value {
  color: var(--color-warn);
}
.alarm .value {
  color: var(--color-alarm);
}
</style>
