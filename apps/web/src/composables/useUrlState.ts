import { computed, type ComputedRef } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'

type Primitive = string | number

export function queryString(query: LocationQuery, key: string): string | undefined {
  const value = query[key]
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first : undefined
}

export function queryInt(query: LocationQuery, key: string): number | undefined {
  const text = queryString(query, key)
  if (text === undefined || !/^\d+$/.test(text)) return undefined
  return Number(text)
}

/**
 * Page state that lives in the URL query, so refresh and shared links restore
 * it. `parse` must turn any query (including garbage) into a valid state.
 */
export function useUrlState<T extends Record<string, Primitive | undefined>>(
  parse: (query: LocationQuery) => T,
): { state: ComputedRef<T>; update: (patch: Partial<T>) => Promise<void> } {
  const route = useRoute()
  const router = useRouter()
  const state = computed(() => parse(route.query))

  async function update(patch: Partial<T>): Promise<void> {
    const next = { ...state.value, ...patch }
    const query: Record<string, string> = {}
    for (const [key, value] of Object.entries(next)) {
      if (value !== undefined && value !== '') query[key] = String(value)
    }
    await router.replace({ query })
  }

  return { state, update }
}
