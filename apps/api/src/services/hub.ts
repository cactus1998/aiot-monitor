import type { Alert, Reading, ReadingEvent } from '@aiot/shared'
import { SSE_REPLAY_SECONDS } from '@aiot/shared'

export type HubMessage = { type: 'reading'; data: ReadingEvent } | { type: 'alert'; data: Alert }

type Listener = (message: HubMessage) => void

/**
 * In-process pub/sub between the ingest loop and SSE clients. Keeps the last
 * few minutes of per-second ticks so a reconnecting client can catch up via
 * Last-Event-ID (the database only stores one sample every 10 seconds).
 */
export class StreamHub {
  readonly #listeners = new Set<Listener>()
  readonly #buffer: ReadingEvent[] = []
  readonly #capacity: number

  constructor(capacity = SSE_REPLAY_SECONDS) {
    this.#capacity = capacity
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  get size(): number {
    return this.#listeners.size
  }

  publishReadings(ts: number, readings: Reading[]): void {
    const event: ReadingEvent = { ts, readings }
    this.#buffer.push(event)
    if (this.#buffer.length > this.#capacity) this.#buffer.shift()
    this.#emit({ type: 'reading', data: event })
  }

  publishAlert(alert: Alert): void {
    this.#emit({ type: 'alert', data: alert })
  }

  /**
   * Ticks newer than `lastTs`. Returns null when `lastTs` is older than the
   * buffer, meaning the client missed data it can only get by refetching.
   */
  since(lastTs: number): ReadingEvent[] | null {
    const oldest = this.#buffer[0]
    if (!oldest) return []
    if (lastTs < oldest.ts - 1000) return null
    return this.#buffer.filter((e) => e.ts > lastTs)
  }

  #emit(message: HubMessage): void {
    for (const listener of this.#listeners) listener(message)
  }
}
