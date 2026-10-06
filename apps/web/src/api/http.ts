import type { z } from 'zod'
import {
  AlertRuleSchema,
  AlertRulesResponseSchema,
  AlertSchema,
  AlertsResponseSchema,
  ApiErrorSchema,
  HealthResponseSchema,
  MachinesResponseSchema,
  OverviewResponseSchema,
  ReadingsResponseSchema,
  SeriesResponseSchema,
} from '@aiot/shared'
import { ApiRequestError, REQUEST_TIMEOUT_MS } from './errors.ts'
import type { ApiClient, LiveEventSource } from './types.ts'

export function toQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (
      typeof value === 'string'
        ? value !== ''
        : typeof value === 'number' || typeof value === 'boolean'
    ) {
      params.set(key, String(value))
    }
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

interface RequestOptions {
  signal?: AbortSignal | undefined
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  timeoutMs?: number
}

export function createHttpClient(base = import.meta.env.VITE_API_BASE ?? ''): ApiClient {
  const root = `${base.replace(/\/$/, '')}/api`

  async function send(path: string, options: RequestOptions): Promise<Response> {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS)
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
    let res: Response
    try {
      res = await fetch(`${root}${path}`, {
        method: options.method ?? 'GET',
        signal,
        headers: options.body === undefined ? {} : { 'content-type': 'application/json' },
        body: options.body === undefined ? null : JSON.stringify(options.body),
      })
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason ?? error
      if (timeout.aborted) throw new ApiRequestError('TIMEOUT', '請求逾時（超過 10 秒）')
      throw new ApiRequestError('NETWORK', '無法連線到 API 伺服器')
    }
    if (!res.ok) {
      const parsed = ApiErrorSchema.safeParse(await res.json().catch(() => null))
      if (parsed.success) {
        throw new ApiRequestError(parsed.data.error.code, parsed.data.error.message, res.status)
      }
      throw new ApiRequestError(
        res.status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        `API 回應 ${res.status}`,
        res.status,
      )
    }
    return res
  }

  async function json<S extends z.ZodType>(
    path: string,
    schema: S,
    options: RequestOptions = {},
  ): Promise<z.output<S>> {
    const res = await send(path, options)
    const parsed = schema.safeParse(await res.json())
    if (!parsed.success) {
      throw new ApiRequestError(
        'INVALID_RESPONSE',
        `API 回應格式不符：${parsed.error.issues[0]?.message ?? ''}`,
      )
    }
    return parsed.data
  }

  return {
    mode: 'http',
    health: (signal) => json('/health', HealthResponseSchema, { signal, timeoutMs: 3000 }),
    getMachines: (signal) => json('/machines', MachinesResponseSchema, { signal }),
    getSeries: (machineId, query, signal) =>
      json(
        `/machines/${encodeURIComponent(machineId)}/series${toQueryString({ ...query })}`,
        SeriesResponseSchema,
        {
          signal,
        },
      ),
    getReadings: (query, signal) =>
      json(`/readings${toQueryString({ ...query })}`, ReadingsResponseSchema, { signal }),
    async exportReadingsCsv(query, signal) {
      const res = await send(`/readings.csv${toQueryString({ ...query })}`, {
        signal,
        timeoutMs: 60_000,
      })
      return res.blob()
    },
    getOverview: (signal) => json('/stats/overview', OverviewResponseSchema, { signal }),
    listAlertRules: (signal) => json('/alert-rules', AlertRulesResponseSchema, { signal }),
    createAlertRule: (body, signal) =>
      json('/alert-rules', AlertRuleSchema, { signal, method: 'POST', body }),
    updateAlertRule: (id, patch, signal) =>
      json(`/alert-rules/${id}`, AlertRuleSchema, { signal, method: 'PATCH', body: patch }),
    async deleteAlertRule(id, signal) {
      await send(`/alert-rules/${id}`, { signal, method: 'DELETE' })
    },
    listAlerts: (query, signal) =>
      json(`/alerts${toQueryString({ ...query })}`, AlertsResponseSchema, { signal }),
    ackAlert: (id, signal) => json(`/alerts/${id}/ack`, AlertSchema, { signal, method: 'PATCH' }),
    openStream(lastEventId) {
      return new EventSource(
        `${root}/stream${toQueryString({ lastEventId })}`,
      ) as unknown as LiveEventSource
    },
  }
}
