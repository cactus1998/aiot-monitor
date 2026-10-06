<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { Reading } from '@aiot/shared'
import { LAB_EXAMPLES, type LabInput } from '@/lab/examples.ts'
import { useLiveStore } from '@/stores/live.ts'
import { formatTime } from '@/utils/format.ts'

const live = useLiveStore()
const autoRefresh = ref(false)
const snapshot = shallowRef<LabInput & { ts: number }>({
  latest: [],
  recent: [],
  machines: [],
  ts: 0,
})

function sample(): void {
  const now = Date.now()
  const recent: Reading[] = live.machines
    .flatMap((m) => live.buffer(m.id).filter((r) => r.ts >= now - 60_000))
    .toSorted((a, b) => a.ts - b.ts)
  snapshot.value = {
    latest: Object.values(live.latest).toSorted((a, b) => a.machineId.localeCompare(b.machineId)),
    recent,
    machines: live.machines,
    ts: now,
  }
}

// Take the first snapshot once data has arrived, then only on demand (or every 2 s when enabled).
let sampled = false
watch(
  () => Object.keys(live.latest).length,
  (n) => {
    if (n > 0 && !sampled) {
      sampled = true
      sample()
    }
  },
  { immediate: true },
)
let timer: ReturnType<typeof setInterval> | null = null
watch(autoRefresh, (on) => {
  if (timer) clearInterval(timer)
  timer = on ? setInterval(sample, 2000) : null
})
onScopeDispose(() => timer && clearInterval(timer))

// Hash routing owns the URL fragment, so scroll in-page instead of using #anchors.
function scrollTo(id: string): void {
  document.getElementById(`lab-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const results = computed(() =>
  LAB_EXAMPLES.map((ex) => {
    try {
      return { ...ex, output: JSON.stringify(ex.run(snapshot.value), null, 2), error: null }
    } catch (error) {
      return { ...ex, output: '', error: error instanceof Error ? error.message : String(error) }
    }
  }),
)
</script>

<template>
  <div class="lab">
    <header class="page-header">
      <div>
        <h1>陣列方法實驗室</h1>
        <p>用即時機台資料示範常考的 array 方法：左邊是程式碼，右邊是執行結果。</p>
      </div>
      <div class="controls">
        <span class="muted"
          >取樣時間 {{ snapshot.ts ? formatTime(snapshot.ts) : '—' }} ·
          {{ snapshot.latest.length }} 台 / 最近一分鐘 {{ snapshot.recent.length }} 筆</span
        >
        <label class="auto"><input v-model="autoRefresh" type="checkbox" /> 每 2 秒自動更新</label>
        <button type="button" class="btn btn-primary" @click="sample">重新取樣</button>
      </div>
    </header>

    <nav class="toc card" aria-label="方法目錄">
      <button
        v-for="ex in results"
        :key="ex.id"
        type="button"
        class="btn btn-sm btn-ghost"
        @click="scrollTo(ex.id)"
      >
        <code>{{ ex.method }}</code>
      </button>
    </nav>

    <article v-for="ex in results" :id="`lab-${ex.id}`" :key="ex.id" class="card example">
      <header>
        <h2>
          <code>{{ ex.method }}</code> {{ ex.title }}
        </h2>
        <span class="tag" :class="{ mutates: ex.mutates }">{{
          ex.mutates ? '會改變原陣列' : '不改變原陣列'
        }}</span>
      </header>
      <p class="note">{{ ex.note }}</p>
      <div class="split">
        <pre class="code" :aria-label="`${ex.method} 程式碼`"><code>{{ ex.code }}</code></pre>
        <pre
          class="output"
          :aria-label="`${ex.method} 執行結果`"
          aria-live="polite"
        ><code>{{ ex.error ?? ex.output }}</code></pre>
      </div>
    </article>
  </div>
</template>

<style scoped>
.lab {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
}
.toc {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.8rem;
  padding: 0.6rem 1rem;
}
.example header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
h2 {
  margin: 0;
  font-size: 1rem;
}
h2 code {
  color: var(--color-primary);
}
.tag {
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: var(--color-surface-2);
}
.tag.mutates {
  color: var(--color-alarm);
}
.note {
  margin: 0.4rem 0 0.6rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
.split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.6rem;
}
pre {
  margin: 0;
  padding: 0.75rem;
  border-radius: 8px;
  overflow: auto;
  max-height: 260px;
  font-size: 0.8rem;
  line-height: 1.45;
}
.code {
  background: #0f172a;
  color: #e2e8f0;
}
.output {
  background: var(--color-surface-2);
}
@media (max-width: 800px) {
  .split {
    grid-template-columns: 1fr;
  }
}
</style>
