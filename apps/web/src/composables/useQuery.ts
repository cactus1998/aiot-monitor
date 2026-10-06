import { onScopeDispose, ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue'
import { errorMessage, isAbortError } from '@/api'
import type { ApiClient } from '@/api'
import { useConnectionStore } from '@/stores/connection.ts'

export type QueryStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

export interface QueryResult<T> {
  data: ShallowRef<T | null>
  status: Ref<QueryStatus>
  error: Ref<string | null>
  refresh: () => Promise<void>
}

export interface QueryOptions<T> {
  isEmpty?: (data: T) => boolean
  /** Keep showing the previous data while a refetch is running (default true). */
  keepPrevious?: boolean
}

/**
 * Data fetching with the states every block needs (loading / success / empty /
 * error) and race handling: whenever the params change, the previous request
 * is aborted and its late response is ignored (EC-01).
 *
 * `params` returns null to skip fetching (e.g. invalid form input).
 */
export function useQuery<P, T>(
  params: () => P | null,
  fetcher: (client: ApiClient, params: P, signal: AbortSignal) => Promise<T>,
  options: QueryOptions<T> = {},
): QueryResult<T> {
  const conn = useConnectionStore()
  const data = shallowRef<T | null>(null)
  const status = ref<QueryStatus>('idle')
  const error = ref<string | null>(null)
  let controller: AbortController | null = null

  async function run(): Promise<void> {
    controller?.abort()
    const p = params()
    const client = conn.client
    if (p === null || !client) {
      controller = null
      status.value = 'idle'
      return
    }
    const current = new AbortController()
    controller = current
    status.value = 'loading'
    error.value = null
    if (options.keepPrevious === false) data.value = null
    try {
      const result = await fetcher(client, p, current.signal)
      if (current !== controller) return
      data.value = result
      status.value = options.isEmpty?.(result) ? 'empty' : 'success'
    } catch (e) {
      if (current !== controller || isAbortError(e) || current.signal.aborted) return
      error.value = errorMessage(e)
      status.value = 'error'
    }
  }

  watch([params, () => conn.client], () => void run(), { immediate: true, deep: true })
  onScopeDispose(() => controller?.abort())

  return { data, status, error, refresh: run }
}
