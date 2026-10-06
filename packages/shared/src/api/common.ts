import { z } from 'zod'
import { MAX_RANGE_MS } from '../time.ts'

export const ErrorCodeSchema = z.enum(['VALIDATION_ERROR', 'NOT_FOUND', 'INTERNAL_ERROR'])
export type ErrorCode = z.infer<typeof ErrorCodeSchema>

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
  }),
})
export type ApiError = z.infer<typeof ApiErrorSchema>

const epochMs = z.coerce.number().int().nonnegative()

export const TimeRangeSchema = z
  .object({
    from: epochMs,
    to: epochMs,
  })
  .refine((v) => v.from < v.to, { message: '開始時間必須早於結束時間', path: ['from'] })
  .refine((v) => v.to - v.from <= MAX_RANGE_MS, {
    message: '查詢範圍不可超過 24 小時',
    path: ['to'],
  })
export type TimeRange = z.infer<typeof TimeRangeSchema>

/** Same checks as TimeRangeSchema, reusable on objects that carry extra fields. */
export function refineTimeRange<T extends z.ZodType<{ from: number; to: number }>>(schema: T) {
  return schema
    .refine((v) => v.from < v.to, { message: '開始時間必須早於結束時間', path: ['from'] })
    .refine((v) => v.to - v.from <= MAX_RANGE_MS, {
      message: '查詢範圍不可超過 24 小時',
      path: ['to'],
    })
}

export { epochMs }
