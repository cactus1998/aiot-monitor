import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReadingEvent } from '@aiot/shared'
import {
  LiveConnection,
  POLL_INTERVAL_MS,
  RECONNECT_TIMEOUT_MS,
  SSE_RETRY_INTERVAL_MS,
  type ConnectionState,
} from '../live-connection.ts'
import type { LiveEventSource } from '../types.ts'

class FakeSource implements LiveEventSource {
  readyState = 0
  onopen: LiveEventSource['onopen'] = null
  onerror: LiveEventSource['onerror'] = null
  closed = false
  listeners = new Map<string, ((e: MessageEvent<string>) => void)[]>()
  constructor(readonly lastEventId: number | undefined) {}
  addEventListener(type: string, l: (e: MessageEvent<string>) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), l])
  }
  close() {
    this.closed = true
    this.readyState = 2
  }
  open() {
    this.readyState = 1
    this.onopen?.call(undefined as never, new Event('open'))
  }
  fail(closed = false) {
    this.readyState = closed ? 2 : 0
    this.onerror?.call(undefined as never, new Event('error'))
  }
  emit(type: string, data: unknown) {
    for (const l of this.listeners.get(type) ?? [])
      l(new MessageEvent(type, { data: JSON.stringify(data) }))
  }
}

const tick = (ts: number): ReadingEvent => ({ ts, readings: [] })

let sources: FakeSource[]
let states: ConnectionState[]
let readings: number[]
let polls: number
let resyncs: number
let conn: LiveConnection

beforeEach(() => {
  vi.useFakeTimers()
  sources = []
  states = []
  readings = []
  polls = 0
  resyncs = 0
  conn = new LiveConnection({
    open: (id) => {
      const s = new FakeSource(id)
      sources.push(s)
      return s
    },
    poll: () => {
      polls += 1
    },
    onReading: (e) => readings.push(e.ts),
    onAlert: () => {},
    onResync: () => {
      resyncs += 1
    },
    onState: (s) => states.push(s),
  })
  conn.start()
})

afterEach(() => {
  conn.stop()
  vi.useRealTimers()
})

describe('LiveConnection', () => {
  it('goes live when the stream opens and forwards readings', () => {
    sources[0]!.open()
    sources[0]!.emit('reading', tick(1000))
    expect(conn.state).toBe('live')
    expect(readings).toEqual([1000])
  })

  // EC-04
  it('ignores duplicate or older ticks', () => {
    sources[0]!.open()
    for (const ts of [1000, 2000, 2000, 1500, 3000]) sources[0]!.emit('reading', tick(ts))
    expect(readings).toEqual([1000, 2000, 3000])
  })

  it('falls back to polling after 3 failed connection attempts', () => {
    sources[0]!.fail()
    sources[0]!.fail()
    expect(conn.state).toBe('connecting')
    sources[0]!.fail()
    expect(conn.state).toBe('polling')
    expect(sources[0]!.closed).toBe(true)
    expect(polls).toBe(1)
    vi.advanceTimersByTime(POLL_INTERVAL_MS * 2)
    expect(polls).toBe(3)
  })

  it('retries SSE every 60 seconds while polling', () => {
    for (let i = 0; i < 3; i++) sources[0]!.fail()
    vi.advanceTimersByTime(SSE_RETRY_INTERVAL_MS)
    expect(conn.state).toBe('connecting')
    expect(sources).toHaveLength(2)
    sources[1]!.open()
    expect(conn.state).toBe('live')
    const pollsAfter = polls
    vi.advanceTimersByTime(POLL_INTERVAL_MS * 3)
    expect(polls).toBe(pollsAfter)
  })

  it('shows reconnecting after a drop and returns to live on reopen', () => {
    sources[0]!.open()
    sources[0]!.fail()
    expect(conn.state).toBe('reconnecting')
    sources[0]!.open()
    expect(conn.state).toBe('live')
    vi.advanceTimersByTime(RECONNECT_TIMEOUT_MS)
    expect(conn.state).toBe('live')
  })

  it('switches to polling when reconnecting takes longer than 30 seconds', () => {
    sources[0]!.open()
    sources[0]!.fail()
    vi.advanceTimersByTime(RECONNECT_TIMEOUT_MS)
    expect(conn.state).toBe('polling')
  })

  // EC-01 (sse-stream)
  it('reopens a closed stream with the last event id so the server can replay the gap', () => {
    sources[0]!.open()
    sources[0]!.emit('reading', tick(5000))
    sources[0]!.fail(true)
    vi.advanceTimersByTime(2000)
    expect(sources).toHaveLength(2)
    expect(sources[1]!.lastEventId).toBe(5000)
    sources[1]!.open()
    sources[1]!.emit('reading', tick(6000))
    expect(readings).toEqual([5000, 6000])
  })

  // EC-02 (sse-stream)
  it('handles resync by clearing the cursor and notifying', () => {
    sources[0]!.open()
    sources[0]!.emit('reading', tick(5000))
    sources[0]!.emit('resync', { ts: 5000 })
    expect(resyncs).toBe(1)
    sources[0]!.emit('reading', tick(4000))
    expect(readings).toEqual([5000, 4000])
  })

  // EC-03 (sse-stream)
  it('closes the stream and clears timers on stop', () => {
    for (let i = 0; i < 3; i++) sources[0]!.fail()
    conn.stop()
    const before = polls
    vi.advanceTimersByTime(SSE_RETRY_INTERVAL_MS * 2)
    expect(polls).toBe(before)
    expect(sources).toHaveLength(1)
  })

  it('records state transitions in order', () => {
    sources[0]!.open()
    sources[0]!.fail()
    vi.advanceTimersByTime(RECONNECT_TIMEOUT_MS)
    expect(states).toEqual(['live', 'reconnecting', 'polling'])
  })
})
