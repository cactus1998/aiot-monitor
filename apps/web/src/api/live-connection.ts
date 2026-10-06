import type { Alert, ReadingEvent } from '@aiot/shared'
import { AlertEventSchema, ReadingEventSchema, ResyncEventSchema, SSE_RETRY_MS } from '@aiot/shared'
import type { LiveEventSource } from './types.ts'

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'polling'

export const MAX_CONNECT_FAILURES = 3
export const RECONNECT_TIMEOUT_MS = 30_000
export const POLL_INTERVAL_MS = 5_000
export const SSE_RETRY_INTERVAL_MS = 60_000

const CLOSED = 2

export interface LiveConnectionOptions {
  open(lastEventId?: number): LiveEventSource
  poll(): Promise<void> | void
  onReading(event: ReadingEvent): void
  onAlert(alert: Alert): void
  onResync(): void
  onState(state: ConnectionState): void
}

/**
 * SSE connection state machine (framework-free so it can be unit tested with
 * fake timers):
 *
 *   connecting --open--> live --error--> reconnecting --open--> live
 *   connecting --3 failures--> polling
 *   reconnecting --30 s--> polling --60 s--> connecting
 *
 * The browser retries a dropped EventSource by itself (sending Last-Event-ID);
 * when it gives up (readyState CLOSED, e.g. HTTP 502) we reopen manually with
 * `?lastEventId=` so the server can replay the gap.
 */
export class LiveConnection {
  state: ConnectionState = 'connecting'
  lastEventId: number | undefined
  #source: LiveEventSource | null = null
  #failures = 0
  #reconnectDeadline: ReturnType<typeof setTimeout> | null = null
  #reopen: ReturnType<typeof setTimeout> | null = null
  #pollTimer: ReturnType<typeof setInterval> | null = null
  #retryTimer: ReturnType<typeof setTimeout> | null = null
  #stopped = false
  readonly #o: LiveConnectionOptions

  constructor(options: LiveConnectionOptions) {
    this.#o = options
  }

  start(): void {
    this.#stopped = false
    this.#connect()
  }

  stop(): void {
    this.#stopped = true
    this.#closeSource()
    this.#clearTimers()
  }

  #setState(state: ConnectionState): void {
    if (this.state === state) return
    this.state = state
    this.#o.onState(state)
  }

  #connect(): void {
    this.#clearTimers()
    this.#failures = 0
    this.#setState('connecting')
    this.#open()
  }

  #open(): void {
    this.#closeSource()
    const source = this.#o.open(this.lastEventId)
    this.#source = source
    source.onopen = () => {
      if (source !== this.#source) return
      this.#failures = 0
      if (this.#reconnectDeadline) clearTimeout(this.#reconnectDeadline)
      this.#reconnectDeadline = null
      this.#setState('live')
    }
    source.onerror = () => {
      if (source !== this.#source) return
      this.#handleError(source)
    }
    source.addEventListener('reading', (e) => {
      const parsed = ReadingEventSchema.safeParse(JSON.parse(e.data))
      if (!parsed.success) return
      // Ignore duplicates (EC-04): ticks are strictly increasing.
      if (this.lastEventId !== undefined && parsed.data.ts <= this.lastEventId) return
      this.lastEventId = parsed.data.ts
      this.#o.onReading(parsed.data)
    })
    source.addEventListener('alert', (e) => {
      const parsed = AlertEventSchema.safeParse(JSON.parse(e.data))
      if (parsed.success) this.#o.onAlert(parsed.data)
    })
    source.addEventListener('resync', (e) => {
      if (!ResyncEventSchema.safeParse(JSON.parse(e.data)).success) return
      this.lastEventId = undefined
      this.#o.onResync()
    })
  }

  #handleError(source: LiveEventSource): void {
    if (this.state === 'connecting') {
      this.#failures += 1
      if (this.#failures >= MAX_CONNECT_FAILURES) return this.#toPolling()
    } else if (this.state === 'live') {
      this.#setState('reconnecting')
      this.#reconnectDeadline = setTimeout(() => this.#toPolling(), RECONNECT_TIMEOUT_MS)
    }
    if (source.readyState === CLOSED && !this.#reopen) {
      this.#reopen = setTimeout(() => {
        this.#reopen = null
        if (!this.#stopped && this.state !== 'polling') this.#open()
      }, SSE_RETRY_MS)
    }
  }

  #toPolling(): void {
    this.#closeSource()
    this.#clearTimers()
    this.#setState('polling')
    void this.#o.poll()
    this.#pollTimer = setInterval(() => void this.#o.poll(), POLL_INTERVAL_MS)
    this.#retryTimer = setTimeout(() => this.#connect(), SSE_RETRY_INTERVAL_MS)
  }

  #closeSource(): void {
    this.#source?.close()
    this.#source = null
  }

  #clearTimers(): void {
    for (const t of [this.#reconnectDeadline, this.#reopen, this.#retryTimer])
      if (t) clearTimeout(t)
    if (this.#pollTimer) clearInterval(this.#pollTimer)
    this.#reconnectDeadline = this.#reopen = this.#retryTimer = this.#pollTimer = null
  }
}
