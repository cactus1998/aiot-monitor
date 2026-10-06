import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { ApiClient, ApiMode } from '@/api'
import { CONFIGURED_MODE, createApiClient, errorMessage } from '@/api'

export type HealthStatus = 'unknown' | 'ok' | 'down'

/** Which backend the app talks to. Switching to mock is kept in memory only. */
export const useConnectionStore = defineStore('connection', () => {
  const client = shallowRef<ApiClient | null>(null)
  const mode = ref<ApiMode>(CONFIGURED_MODE)
  const health = ref<HealthStatus>('unknown')
  const healthError = ref<string | null>(null)
  const isMock = computed(() => mode.value === 'mock')

  async function init(): Promise<void> {
    client.value = await createApiClient(mode.value)
    await checkHealth()
  }

  async function checkHealth(): Promise<void> {
    if (!client.value) return
    try {
      await client.value.health()
      health.value = 'ok'
      healthError.value = null
    } catch (error) {
      health.value = 'down'
      healthError.value = errorMessage(error)
    }
  }

  async function switchMode(next: ApiMode): Promise<void> {
    if (next === mode.value && client.value) return
    const previous = client.value
    if (previous && 'backend' in previous) {
      ;(previous as ApiClient & { backend: { stop(): void } }).backend.stop()
    }
    mode.value = next
    client.value = await createApiClient(next)
    await checkHealth()
  }

  /** Test hook: use a prepared client without the network. */
  function useClient(next: ApiClient): void {
    client.value = next
    mode.value = next.mode
    health.value = 'ok'
  }

  return { client, mode, isMock, health, healthError, init, checkHealth, switchMode, useClient }
})

/** The active client; throws if the app has not finished initialising. */
export function useApi(): ApiClient {
  const store = useConnectionStore()
  if (!store.client) throw new Error('ApiClient 尚未初始化')
  return store.client
}
