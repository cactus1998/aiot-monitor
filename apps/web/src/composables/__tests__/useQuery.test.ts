import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { ApiClient } from '@/api'
import { ApiRequestError } from '@/api'
import { useConnectionStore } from '@/stores/connection.ts'
import { useQuery } from '../useQuery.ts'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

function setup<T>(
  fetcher: (p: number, signal: AbortSignal) => Promise<T>,
  isEmpty?: (d: T) => boolean,
) {
  setActivePinia(createPinia())
  useConnectionStore().useClient({ mode: 'mock' } as ApiClient)
  const param = ref(1)
  const scope = effectScope()
  const query = scope.run(() =>
    useQuery(
      () => param.value,
      (_client, p, signal) => fetcher(p, signal),
      isEmpty ? { isEmpty } : {},
    ),
  )!
  return { query, param, scope }
}

describe('useQuery', () => {
  it('goes from loading to success', async () => {
    const d = deferred<string>()
    const { query } = setup(() => d.promise)
    expect(query.status.value).toBe('loading')
    d.resolve('ok')
    await flush()
    expect(query.status.value).toBe('success')
    expect(query.data.value).toBe('ok')
  })

  it('reports empty results', async () => {
    const { query } = setup(
      async () => [] as number[],
      (d) => d.length === 0,
    )
    await flush()
    expect(query.status.value).toBe('empty')
  })

  it('reports errors and recovers on retry', async () => {
    let fail = true
    const { query } = setup(async () => {
      if (fail) throw new ApiRequestError('INTERNAL_ERROR', '伺服器發生錯誤', 500)
      return 'ok'
    })
    await flush()
    expect(query.status.value).toBe('error')
    expect(query.error.value).toBe('伺服器發生錯誤')
    fail = false
    await query.refresh()
    expect(query.status.value).toBe('success')
  })

  // EC-01: a slower, older request must not overwrite the newer result.
  it('aborts the previous request when params change and ignores its late response', async () => {
    const calls: { p: number; signal: AbortSignal; d: ReturnType<typeof deferred<string>> }[] = []
    const { query, param } = setup((p, signal) => {
      const d = deferred<string>()
      calls.push({ p, signal, d })
      return d.promise
    })
    param.value = 2
    await nextTick()
    expect(calls).toHaveLength(2)
    expect(calls[0]!.signal.aborted).toBe(true)

    calls[1]!.d.resolve('second')
    await flush()
    calls[0]!.d.resolve('first (late)')
    await flush()
    expect(query.data.value).toBe('second')
    expect(query.status.value).toBe('success')
  })

  it('does not show an error for an aborted request', async () => {
    const { query, param } = setup(
      (_p, signal) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(new DOMException('a', 'AbortError'))),
        ),
    )
    param.value = 2
    await flush()
    expect(query.status.value).toBe('loading')
    expect(query.error.value).toBeNull()
  })

  it('aborts the in-flight request when the scope is disposed', async () => {
    const spy = vi.fn()
    const { scope } = setup((_p, signal) => {
      signal.addEventListener('abort', spy)
      return new Promise(() => {})
    })
    scope.stop()
    expect(spy).toHaveBeenCalled()
  })
})
