import type { z } from 'zod'
import type { Alert, AlertRule, Reading, ReadingEvent, RuleState } from '@aiot/shared'
import {
  AlertRuleBodySchema,
  AlertRulePatchSchema,
  AlertsQuerySchema,
  buildOverview,
  bucketize,
  bucketSize,
  CSV_BOM,
  DEFAULT_ALERT_RULES,
  evaluateRule,
  HOUR,
  initialRuleState,
  MINUTE,
  ReadingsCsvQuerySchema,
  ReadingsQuerySchema,
  ruleApplies,
  SECOND,
  SeriesQuerySchema,
  sortReadings,
  SSE_REPLAY_SECONDS,
  startOfTaipeiDay,
  toCsv,
} from '@aiot/shared'
import type { Simulator } from '@aiot/simulator'
import { createSimulator, generateHistory, MACHINES } from '@aiot/simulator'
import { ApiRequestError } from './errors.ts'
import type { ApiClient, LiveEventSource } from './types.ts'

const RETENTION_MS = 24 * HOUR
const WRITE_INTERVAL_MS = 10 * SECOND

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input)
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join('; ')
    throw new ApiRequestError('VALIDATION_ERROR', message, 400)
  }
  return result.data
}

function notFound(message: string): never {
  throw new ApiRequestError('NOT_FOUND', message, 404)
}

/** Resolve after a short random delay so loading states are visible; rejects on abort. */
function latency(signal?: AbortSignal, min = 150, max = 400): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, min + Math.random() * (max - min))
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

type Message = { type: 'reading'; data: ReadingEvent } | { type: 'alert'; data: Alert }

/**
 * In-browser stand-in for the Node API. Same simulator, same retention and
 * write interval, same shared functions for paging, buckets, overview and
 * alert rules. Everything lives in memory: closing the tab discards it.
 */
export class MockBackend {
  readonly sim: Simulator
  /** Stored readings (one-minute backfill + one every 10 s), sorted by ts. */
  readings: Reading[]
  latest: Reading[] = []
  rules: AlertRule[]
  alerts: Alert[] = []
  readonly #replay: ReadingEvent[] = []
  readonly #listeners = new Set<(m: Message) => void>()
  readonly #ruleStates = new Map<string, RuleState>()
  #nextRuleId = 1
  #nextAlertId = 1
  #lastWrite: number
  #timer: ReturnType<typeof setInterval> | null = null
  readonly #now: () => number

  constructor(options: { now?: () => number; seed?: number } = {}) {
    this.#now = options.now ?? Date.now
    const now = this.#now() - (this.#now() % SECOND)
    const from = now - (now % MINUTE) - 24 * HOUR
    this.sim = createSimulator({ seed: options.seed ?? 42, startTs: from })
    this.readings = generateHistory(this.sim, from, now, MINUTE)
    this.latest = this.readings.slice(-MACHINES.length)
    this.rules = DEFAULT_ALERT_RULES.map((r) => ({ ...r, id: this.#nextRuleId++ }))
    for (const r of this.readings) this.#evaluate(r)
    this.#lastWrite = now
  }

  start(): void {
    if (this.#timer) return
    this.#timer = setInterval(() => this.tick(), SECOND)
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer)
    this.#timer = null
  }

  tick(ts = this.#now() - (this.#now() % SECOND)): void {
    const batch = this.sim.tick(ts)
    this.latest = batch
    const event = { ts, readings: batch }
    this.#replay.push(event)
    if (this.#replay.length > SSE_REPLAY_SECONDS) this.#replay.shift()
    this.#emit({ type: 'reading', data: event })
    for (const r of batch)
      for (const alert of this.#evaluate(r)) this.#emit({ type: 'alert', data: alert })
    if (ts - this.#lastWrite >= WRITE_INTERVAL_MS) {
      this.readings.push(...batch)
      this.#lastWrite = ts
      const cutoff = ts - RETENTION_MS
      const firstKept = this.readings.findIndex((r) => r.ts >= cutoff)
      if (firstKept > 0) this.readings.splice(0, firstKept)
    }
  }

  subscribe(listener: (m: Message) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  replaySince(ts: number): ReadingEvent[] | null {
    const oldest = this.#replay[0]
    if (!oldest) return []
    if (ts < oldest.ts - SECOND) return null
    return this.#replay.filter((e) => e.ts > ts)
  }

  #emit(message: Message): void {
    for (const l of this.#listeners) l(message)
  }

  #evaluate(reading: Reading): Alert[] {
    const fired: Alert[] = []
    for (const rule of this.rules) {
      if (!ruleApplies(rule, reading.machineId)) continue
      const key = `${rule.id}:${reading.machineId}`
      const { state, trigger } = evaluateRule(
        rule,
        reading,
        this.#ruleStates.get(key) ?? initialRuleState(),
      )
      this.#ruleStates.set(key, state)
      if (trigger) {
        const alert: Alert = {
          id: this.#nextAlertId++,
          ruleId: rule.id,
          machineId: reading.machineId,
          metric: rule.metric,
          op: rule.op,
          threshold: rule.threshold,
          ts: trigger.ts,
          value: trigger.value,
          ackedAt: null,
        }
        this.alerts.push(alert)
        fired.push(alert)
      }
    }
    return fired
  }

  filter(q: { from: number; to: number; machineId?: string | undefined }): Reading[] {
    return this.readings.filter(
      (r) =>
        r.ts >= q.from && r.ts < q.to && (q.machineId === undefined || r.machineId === q.machineId),
    )
  }

  get now(): number {
    return this.#now()
  }

  createRule(body: unknown): AlertRule {
    const parsed = parse(AlertRuleBodySchema, body)
    this.#assertMachine(parsed.machineId)
    const rule = { ...parsed, id: this.#nextRuleId++ }
    this.rules.push(rule)
    return rule
  }

  updateRule(id: number, patch: unknown): AlertRule {
    const parsed = parse(AlertRulePatchSchema, patch)
    this.#assertMachine(parsed.machineId)
    const index = this.rules.findIndex((r) => r.id === id)
    if (index < 0) notFound(`找不到規則 ${id}`)
    const rule = { ...this.rules[index]!, ...parsed }
    this.rules = this.rules.with(index, rule)
    return rule
  }

  deleteRule(id: number): void {
    if (!this.rules.some((r) => r.id === id)) notFound(`找不到規則 ${id}`)
    this.rules = this.rules.filter((r) => r.id !== id)
  }

  ack(id: number): Alert {
    const alert = this.alerts.find((a) => a.id === id) ?? notFound(`找不到告警 ${id}`)
    alert.ackedAt ??= this.#now()
    return { ...alert }
  }

  #assertMachine(machineId: string | null | undefined): void {
    if (machineId && !MACHINES.some((m) => m.id === machineId)) {
      throw new ApiRequestError('VALIDATION_ERROR', `找不到機台 ${machineId}`, 400)
    }
  }
}

/** EventSource look-alike fed by the MockBackend. */
class MockEventSource implements LiveEventSource {
  readyState = 0
  onopen: LiveEventSource['onopen'] = null
  onerror: LiveEventSource['onerror'] = null
  readonly #listeners = new Map<string, ((e: MessageEvent<string>) => void)[]>()
  readonly #unsubscribe: () => void

  constructor(backend: MockBackend, lastEventId?: number) {
    const pending: Message[] = []
    let opened = false
    this.#unsubscribe = backend.subscribe((m) => (opened ? this.#dispatch(m) : pending.push(m)))
    setTimeout(() => {
      if (this.readyState === 2) return
      this.readyState = 1
      opened = true
      this.onopen?.call(undefined as never, new Event('open'))
      if (lastEventId !== undefined) {
        const missed = backend.replaySince(lastEventId)
        if (missed === null) this.#fire('resync', { ts: lastEventId })
        else for (const e of missed) this.#fire('reading', e, e.ts)
      }
      for (const m of pending) this.#dispatch(m)
    }, 50)
  }

  addEventListener(type: string, listener: (e: MessageEvent<string>) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener])
  }

  close(): void {
    this.readyState = 2
    this.#unsubscribe()
  }

  #dispatch(m: Message): void {
    if (m.type === 'reading') this.#fire('reading', m.data, m.data.ts)
    else this.#fire('alert', m.data)
  }

  #fire(type: string, data: unknown, id?: number): void {
    const event = new MessageEvent<string>(type, {
      data: JSON.stringify(data),
      lastEventId: id === undefined ? '' : String(id),
    })
    for (const l of this.#listeners.get(type) ?? []) l(event)
  }
}

export function createMockClient(
  backend = new MockBackend(),
): ApiClient & { backend: MockBackend } {
  backend.start()
  return {
    mode: 'mock',
    backend,
    async health(signal) {
      await latency(signal, 20, 60)
      return { status: 'ok', time: backend.now, readings: backend.readings.length }
    },
    async getMachines(signal) {
      await latency(signal)
      return {
        items: MACHINES.map((m) => ({
          ...m,
          latest: backend.latest.find((r) => r.machineId === m.id) ?? null,
        })),
      }
    },
    async getSeries(machineId, query, signal) {
      const q = parse(SeriesQuerySchema, query)
      await latency(signal)
      if (!MACHINES.some((m) => m.id === machineId)) notFound(`找不到機台 ${machineId}`)
      const rows = backend.filter({ from: q.from, to: q.to, machineId })
      const points = bucketize(
        rows.map((r) => ({ ts: r.ts, value: r[q.metric] })),
        q.from,
        q.to,
        q.points,
      )
      return {
        machineId,
        metric: q.metric,
        from: q.from,
        to: q.to,
        bucketMs: bucketSize(q.from, q.to, q.points),
        rawCount: rows.length,
        points,
      }
    },
    async getReadings(query, signal) {
      const q = parse(ReadingsQuerySchema, query)
      await latency(signal)
      const sorted = sortReadings(backend.filter(q), q.sort)
      const start = (q.page - 1) * q.pageSize
      return {
        items: sorted.slice(start, start + q.pageSize),
        total: sorted.length,
        page: q.page,
        pageSize: q.pageSize,
      }
    },
    async exportReadingsCsv(query, signal) {
      const q = parse(ReadingsCsvQuerySchema, query)
      await latency(signal)
      const rows = backend
        .filter(q)
        .toSorted((a, b) => a.ts - b.ts || a.machineId.localeCompare(b.machineId))
      return new Blob([`${CSV_BOM}${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' })
    },
    async getOverview(signal) {
      await latency(signal)
      const now = backend.now
      return buildOverview({
        now,
        machines: MACHINES,
        todayReadings: backend.filter({ from: startOfTaipeiDay(now), to: now + 1 }),
        latest: backend.latest,
        openAlerts: backend.alerts.filter((a) => a.ackedAt === null).length,
      })
    },
    async listAlertRules(signal) {
      await latency(signal)
      return { items: backend.rules.map((r) => ({ ...r })) }
    },
    async createAlertRule(body, signal) {
      await latency(signal)
      return backend.createRule(body)
    },
    async updateAlertRule(id, patch, signal) {
      await latency(signal)
      return backend.updateRule(id, patch)
    },
    async deleteAlertRule(id, signal) {
      await latency(signal)
      backend.deleteRule(id)
    },
    async listAlerts(query, signal) {
      const q = parse(AlertsQuerySchema, query)
      await latency(signal)
      const items = backend.alerts
        .filter((a) => q.status === 'all' || (q.status === 'open') === (a.ackedAt === null))
        .filter((a) => q.machineId === undefined || a.machineId === q.machineId)
        .toSorted((a, b) => b.ts - a.ts || b.id - a.id)
        .slice(0, q.limit)
        .map((a) => ({ ...a }))
      return { items, openCount: backend.alerts.filter((a) => a.ackedAt === null).length }
    },
    async ackAlert(id, signal) {
      await latency(signal)
      return backend.ack(id)
    },
    openStream(lastEventId) {
      return new MockEventSource(backend, lastEventId)
    },
  }
}
