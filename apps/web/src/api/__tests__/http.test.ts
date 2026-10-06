import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError, isAbortError } from '../errors.ts'
import { createHttpClient, toQueryString } from '../http.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('toQueryString', () => {
  it('skips empty values', () => {
    expect(toQueryString({ a: 1, b: undefined, c: '', d: 'x', e: null })).toBe('?a=1&d=x')
    expect(toQueryString({})).toBe('')
  })
})

describe('httpClient', () => {
  it('parses a valid response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ status: 'ok', time: 1, readings: 2 })),
    )
    await expect(createHttpClient('').health()).resolves.toEqual({
      status: 'ok',
      time: 1,
      readings: 2,
    })
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('/api/health')
  })

  // EC-04
  it('uses the API error message for 4xx / 5xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({ error: { code: 'VALIDATION_ERROR', message: '查詢範圍不可超過 24 小時' } }, 400),
      ),
    )
    const error = await createHttpClient('')
      .getReadings({ from: 0, to: 1 })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
      message: '查詢範圍不可超過 24 小時',
    })
  })

  it('falls back to a generic message when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Bad gateway', { status: 502 })),
    )
    await expect(createHttpClient('').getOverview()).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 502,
    })
  })

  // EC-03
  it('rejects responses that do not match the schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ items: [{ id: 1 }] })),
    )
    await expect(createHttpClient('').getMachines()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })

  it('reports network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    )
    await expect(createHttpClient('').getMachines()).rejects.toMatchObject({ code: 'NETWORK' })
  })

  // EC-02
  it('turns a timeout into a TIMEOUT error', async () => {
    const timeout = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) =>
            init.signal!.addEventListener('abort', () => reject(init.signal!.reason)),
          ),
      ),
    )
    const pending = createHttpClient('').getMachines()
    timeout.abort(new DOMException('timed out', 'TimeoutError'))
    await expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' })
  })

  // EC-01
  it('rethrows the caller abort instead of wrapping it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) =>
            init.signal!.addEventListener('abort', () => reject(init.signal!.reason)),
          ),
      ),
    )
    const controller = new AbortController()
    const pending = createHttpClient('').getMachines(controller.signal)
    controller.abort()
    const error = await pending.catch((e: unknown) => e)
    expect(isAbortError(error)).toBe(true)
  })

  it('sends JSON bodies for writes', async () => {
    const rule = {
      id: 1,
      machineId: null,
      metric: 'rpm',
      op: 'gt',
      threshold: 1,
      durationSec: 0,
      enabled: true,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(rule, 201)),
    )
    const { id: _id, ...body } = rule
    await createHttpClient('http://api.test/').createAlertRule(body as never)
    const [url, init] = vi.mocked(fetch).mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('http://api.test/api/alert-rules')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(body)
  })
})
