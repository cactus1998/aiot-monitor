import { z } from 'zod'
import { METRIC_KEYS } from '../metrics.ts'
import { epochMs, refineTimeRange } from './common.ts'

export const MAX_SERIES_POINTS = 2000
export const DEFAULT_SERIES_POINTS = 720

export const SeriesQuerySchema = refineTimeRange(
  z.object({
    metric: z.enum(METRIC_KEYS),
    from: epochMs,
    to: epochMs,
    points: z.coerce.number().int().min(10).max(MAX_SERIES_POINTS).default(DEFAULT_SERIES_POINTS),
  }),
)
export type SeriesQuery = z.input<typeof SeriesQuerySchema>
export type SeriesQueryParsed = z.output<typeof SeriesQuerySchema>

export const SeriesPointSchema = z.object({
  /** Bucket start, UTC ms. */
  ts: z.number().int(),
  avg: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
})
export type SeriesPoint = z.infer<typeof SeriesPointSchema>

export const SeriesResponseSchema = z.object({
  machineId: z.string(),
  metric: z.enum(METRIC_KEYS),
  from: z.number().int(),
  to: z.number().int(),
  bucketMs: z.number().int().positive(),
  /** Number of stored readings that fell into the range before bucketing. */
  rawCount: z.number().int().nonnegative(),
  points: z.array(SeriesPointSchema),
})
export type SeriesResponse = z.infer<typeof SeriesResponseSchema>
