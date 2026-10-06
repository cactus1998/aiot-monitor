<script setup lang="ts">
import { ref, useId } from 'vue'
import type { QueryStatus } from '@/composables/useQuery.ts'
import { formatNumber } from '@/utils/format.ts'
import StateBlock from '../StateBlock.vue'

/**
 * Frame for every chart: title, status (loading / empty / error with retry),
 * "view as table" toggle and point / timing info.
 */
const {
  title,
  description = '',
  status = 'success',
  error = null,
  emptyHint = '請調整時間範圍或篩選條件',
  rawPoints = null,
  drawnPoints = null,
  elapsedMs = null,
  height = 260,
  tableAvailable = true,
} = defineProps<{
  title: string
  description?: string
  status?: QueryStatus
  error?: string | null
  emptyHint?: string
  rawPoints?: number | null
  drawnPoints?: number | null
  elapsedMs?: number | null
  height?: number
  tableAvailable?: boolean
}>()
const emit = defineEmits<{ retry: [] }>()
const showTable = ref(false)
const headingId = useId()
</script>

<template>
  <section class="card chart-panel" :aria-labelledby="headingId">
    <header class="chart-header">
      <div>
        <h3 :id="headingId" class="chart-title">{{ title }}</h3>
        <p v-if="description" class="chart-desc">{{ description }}</p>
      </div>
      <div class="chart-tools">
        <slot name="tools" />
        <button
          v-if="tableAvailable && status === 'success'"
          type="button"
          class="btn btn-sm btn-ghost"
          :aria-pressed="showTable"
          @click="showTable = !showTable"
        >
          {{ showTable ? '以圖表檢視' : '以表格檢視' }}
        </button>
      </div>
    </header>

    <div class="chart-body" :style="{ minHeight: `${height}px` }">
      <StateBlock v-if="status === 'loading' || status === 'idle'" kind="loading" />
      <StateBlock
        v-else-if="status === 'error'"
        kind="error"
        :message="error ?? undefined"
        @retry="emit('retry')"
      />
      <StateBlock
        v-else-if="status === 'empty'"
        kind="empty"
        message="此範圍沒有資料"
        :hint="emptyHint"
      />
      <template v-else>
        <div v-if="showTable" class="table-wrap" :style="{ maxHeight: `${height}px` }">
          <slot name="table" />
        </div>
        <div v-else :style="{ height: `${height}px` }">
          <slot />
        </div>
      </template>
    </div>

    <footer
      v-if="status === 'success' && (rawPoints !== null || drawnPoints !== null)"
      class="chart-footer"
    >
      <span v-if="rawPoints !== null">原始 {{ formatNumber(rawPoints) }} 點</span>
      <span v-if="drawnPoints !== null">繪製 {{ formatNumber(drawnPoints) }} 點</span>
      <span v-if="elapsedMs !== null">耗時 {{ formatNumber(elapsedMs, 1) }} ms</span>
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.chart-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.chart-title {
  margin: 0;
  font-size: 1rem;
}
.chart-desc {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
.chart-tools {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.chart-body {
  position: relative;
}
.table-wrap {
  overflow: auto;
}
.chart-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
