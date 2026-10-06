import { z } from 'zod'
import { ReadingSchema } from '../machine.ts'
import { AlertSchema } from './alerts.ts'

/** One simulator tick: the latest reading of every machine. The SSE `id` is `ts`. */
export const ReadingEventSchema = z.object({
  ts: z.number().int(),
  readings: z.array(ReadingSchema),
})
export type ReadingEvent = z.infer<typeof ReadingEventSchema>

export const AlertEventSchema = AlertSchema
export type AlertEvent = z.infer<typeof AlertEventSchema>

/** Sent when the requested Last-Event-ID is older than the replay buffer. */
export const ResyncEventSchema = z.object({ ts: z.number().int() })
export type ResyncEvent = z.infer<typeof ResyncEventSchema>

export const STREAM_EVENTS = ['reading', 'alert', 'resync'] as const
export type StreamEventName = (typeof STREAM_EVENTS)[number]

export const SSE_HEARTBEAT_MS = 15_000
export const SSE_RETRY_MS = 2_000
/** How many seconds of ticks the server keeps for Last-Event-ID replay. */
export const SSE_REPLAY_SECONDS = 300
