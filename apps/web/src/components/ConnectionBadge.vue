<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionStore } from '@/stores/connection.ts'
import { useLiveStore } from '@/stores/live.ts'

const conn = useConnectionStore()
const live = useLiveStore()

const view = computed(() => {
  if (conn.isMock)
    return {
      cls: 'mock',
      icon: '◆',
      label: '模擬資料',
      title: '資料由瀏覽器內的模擬器產生，只存在記憶體',
    }
  switch (live.connection) {
    case 'live':
      return { cls: 'live', icon: '●', label: '即時', title: 'SSE 已連線，每秒更新' }
    case 'reconnecting':
      return { cls: 'warn', icon: '↻', label: '重連中', title: '連線中斷，正在重新連線' }
    case 'polling':
      return { cls: 'warn', icon: '⟳', label: '輪詢', title: 'SSE 無法連線，改為每 5 秒輪詢' }
    default:
      return { cls: 'muted', icon: '…', label: '連線中', title: '正在建立 SSE 連線' }
  }
})
</script>

<template>
  <span class="conn" :class="view.cls" :title="view.title" role="status" aria-live="polite">
    <span aria-hidden="true">{{ view.icon }}</span>
    {{ view.label }}
  </span>
</template>

<style scoped>
.conn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid currentColor;
  white-space: nowrap;
}
.live {
  color: var(--status-running);
}
.warn {
  color: var(--color-warn);
}
.mock {
  color: var(--color-forecast);
}
.muted {
  color: var(--color-text-muted);
}
</style>
