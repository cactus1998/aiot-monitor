<script setup lang="ts">
/** Shared loading / empty / error presentation for any data block. */
const {
  kind,
  message = '',
  hint = '',
} = defineProps<{
  kind: 'loading' | 'empty' | 'error'
  message?: string
  hint?: string
}>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="state" :class="kind" :role="kind === 'error' ? 'alert' : 'status'" aria-live="polite">
    <template v-if="kind === 'loading'">
      <span class="spinner" aria-hidden="true" />
      <span>{{ message || '載入中…' }}</span>
    </template>
    <template v-else-if="kind === 'empty'">
      <span class="icon" aria-hidden="true">∅</span>
      <strong>{{ message || '沒有資料' }}</strong>
      <span v-if="hint" class="hint">{{ hint }}</span>
    </template>
    <template v-else>
      <span class="icon" aria-hidden="true">!</span>
      <strong>{{ message || '載入失敗' }}</strong>
      <button type="button" class="btn btn-sm" @click="emit('retry')">重試</button>
    </template>
  </div>
</template>

<style scoped>
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 160px;
  padding: 1rem;
  color: var(--color-text-muted);
  text-align: center;
}
.state.error {
  color: var(--color-alarm);
}
.icon {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 2px solid currentColor;
  font-weight: 700;
}
.hint {
  font-size: 0.85rem;
}
.spinner {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 3s;
  }
}
</style>
