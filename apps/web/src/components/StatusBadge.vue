<script setup lang="ts">
import type { MachineStatus } from '@aiot/shared'
import { MACHINE_STATUS_LABELS } from '@aiot/shared'

/** Status shown with colour + icon + text, never colour alone. */
const { status } = defineProps<{ status: MachineStatus }>()
const ICONS: Record<MachineStatus, string> = { running: '▶', idle: '❚❚', alarm: '⚠', offline: '■' }
</script>

<template>
  <span class="badge" :class="status">
    <span aria-hidden="true" class="icon">{{ ICONS[status] }}</span>
    {{ MACHINE_STATUS_LABELS[status] }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  color: var(--badge-color);
  background: color-mix(in srgb, var(--badge-color) 14%, transparent);
}
.icon {
  font-size: 0.65rem;
}
.running {
  --badge-color: var(--status-running);
}
.idle {
  --badge-color: var(--status-idle);
}
.alarm {
  --badge-color: var(--status-alarm);
}
.offline {
  --badge-color: var(--status-offline);
}
</style>
