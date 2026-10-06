<script setup lang="ts" generic="T, S extends string">
import { computed } from 'vue'
import type { QueryStatus } from '@/composables/useQuery.ts'
import { formatNumber } from '@/utils/format.ts'
import StateBlock from './StateBlock.vue'
import type { Column } from './table.ts'

const {
  columns,
  rows,
  rowKey,
  total,
  page,
  pageSize,
  sort,
  status,
  error = null,
  selectedKey = null,
  caption,
  pageSizes = [20, 50, 100],
  emptyHint = '請調整篩選條件',
} = defineProps<{
  columns: Column<T, S>[]
  rows: readonly T[]
  rowKey: (row: T) => string
  total: number
  page: number
  pageSize: number
  /** Current sort: `field` ascending, `-field` descending. */
  sort: S | `-${S}`
  status: QueryStatus
  error?: string | null
  selectedKey?: string | null
  caption: string
  pageSizes?: number[]
  emptyHint?: string
}>()

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: number]
  'update:sort': [sort: S | `-${S}`]
  retry: []
  rowClick: [row: T]
}>()

const pageCount = computed(() => Math.max(1, Math.ceil(total / pageSize)))
const firstIndex = computed(() => (total === 0 ? 0 : (page - 1) * pageSize + 1))
const lastIndex = computed(() => Math.min(total, page * pageSize))

const sortField = computed(() => (sort.startsWith('-') ? sort.slice(1) : sort))
const sortDesc = computed(() => sort.startsWith('-'))

function ariaSort(col: Column<T, S>): 'ascending' | 'descending' | 'none' | undefined {
  if (!col.sortKey) return undefined
  if (col.sortKey !== sortField.value) return 'none'
  return sortDesc.value ? 'descending' : 'ascending'
}

/** First click sorts descending (largest / newest first), second click ascending. */
function toggleSort(col: Column<T, S>): void {
  if (!col.sortKey) return
  const next =
    col.sortKey === sortField.value && sortDesc.value ? col.sortKey : (`-${col.sortKey}` as const)
  // The parent resets the page together with the sort (one URL update, no race).
  emit('update:sort', next)
}

function go(target: number): void {
  const clamped = Math.min(pageCount.value, Math.max(1, target))
  if (clamped !== page) emit('update:page', clamped)
}

const showSkeleton = computed(() => status === 'loading' && rows.length === 0)
</script>

<template>
  <div class="data-table">
    <div class="scroll" :aria-busy="status === 'loading'">
      <table>
        <caption class="sr-only">
          {{
            caption
          }}
        </caption>
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              :aria-sort="ariaSort(col)"
              :class="`align-${col.align ?? 'left'}`"
            >
              <button v-if="col.sortKey" type="button" class="sort-btn" @click="toggleSort(col)">
                {{ col.label }}
                <span class="sort-icon" aria-hidden="true">
                  {{ col.sortKey === sortField ? (sortDesc ? '▼' : '▲') : '↕' }}
                </span>
              </button>
              <template v-else>{{ col.label }}</template>
            </th>
          </tr>
        </thead>
        <tbody v-if="showSkeleton">
          <tr v-for="i in 5" :key="i" class="skeleton-row" aria-hidden="true">
            <td v-for="col in columns" :key="col.key"><span class="skeleton" /></td>
          </tr>
        </tbody>
        <tbody
          v-else-if="status === 'success' || (status === 'loading' && rows.length > 0)"
          :class="{ stale: status === 'loading' }"
        >
          <tr
            v-for="row in rows"
            :key="rowKey(row)"
            tabindex="0"
            :class="{ selected: rowKey(row) === selectedKey }"
            :aria-selected="rowKey(row) === selectedKey"
            @click="emit('rowClick', row)"
            @keydown.enter="emit('rowClick', row)"
          >
            <td v-for="col in columns" :key="col.key" :class="`align-${col.align ?? 'left'}`">
              {{ col.format(row) }}
            </td>
          </tr>
        </tbody>
      </table>
      <StateBlock v-if="status === 'empty'" kind="empty" message="查無資料" :hint="emptyHint" />
      <StateBlock
        v-else-if="status === 'error'"
        kind="error"
        :message="error ?? undefined"
        @retry="emit('retry')"
      />
    </div>

    <nav class="pager" aria-label="表格分頁">
      <span class="range" aria-live="polite">
        第 {{ formatNumber(firstIndex) }}–{{ formatNumber(lastIndex) }} 筆，共
        {{ formatNumber(total) }} 筆
      </span>
      <label class="size">
        每頁
        <select
          :value="pageSize"
          @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="size in pageSizes" :key="size" :value="size">{{ size }}</option>
        </select>
        筆
      </label>
      <div class="buttons">
        <button
          type="button"
          class="btn btn-sm"
          :disabled="page <= 1"
          aria-label="第一頁"
          @click="go(1)"
        >
          «
        </button>
        <button
          type="button"
          class="btn btn-sm"
          :disabled="page <= 1"
          aria-label="上一頁"
          @click="go(page - 1)"
        >
          ‹
        </button>
        <span class="page-no">{{ page }} / {{ pageCount }}</span>
        <button
          type="button"
          class="btn btn-sm"
          :disabled="page >= pageCount"
          aria-label="下一頁"
          @click="go(page + 1)"
        >
          ›
        </button>
        <button
          type="button"
          class="btn btn-sm"
          :disabled="page >= pageCount"
          aria-label="最後一頁"
          @click="go(pageCount)"
        >
          »
        </button>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.scroll {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  font-size: 0.875rem;
}
th,
td {
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}
th {
  position: sticky;
  top: 0;
  background: var(--color-surface-2);
  font-weight: 600;
  text-align: left;
}
.align-right {
  text-align: right;
}
.align-center {
  text-align: center;
}
.sort-btn {
  all: unset;
  cursor: pointer;
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
}
.sort-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.sort-icon {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}
tbody tr {
  cursor: pointer;
}
tbody tr:hover {
  background: var(--color-surface-2);
}
tbody tr:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
tbody tr.selected {
  background: var(--color-primary-soft);
}
tbody.stale {
  opacity: 0.55;
}
.skeleton {
  display: block;
  height: 0.8rem;
  border-radius: 4px;
  background: var(--color-surface-2);
}
.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
.buttons {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.page-no {
  min-width: 4rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.size select {
  margin: 0 0.25rem;
}
</style>
