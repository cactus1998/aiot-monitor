import { z } from 'zod'
import { ReadingSchema } from '../machine.ts'
import { epochMs, refineTimeRange } from './common.ts'

export const READING_SORT_FIELDS = ['ts', 'temperature', 'vibration', 'spindleLoad', 'rpm'] as const
export type ReadingSortField = (typeof READING_SORT_FIELDS)[number]
/** `ts` sorts ascending, `-ts` sorts descending. */
export type ReadingSort = ReadingSortField | `-${ReadingSortField}`

export const READING_SORTS: ReadingSort[] = READING_SORT_FIELDS.flatMap((field): ReadingSort[] => [
  field,
  `-${field}`,
])

export function isReadingSort(value: unknown): value is ReadingSort {
  return typeof value === 'string' && (READING_SORTS as string[]).includes(value)
}

export const ReadingSortSchema = z.enum(READING_SORTS as [ReadingSort, ...ReadingSort[]], {
  message: '不支援的排序欄位',
})

export const MAX_PAGE_SIZE = 500

const readingsFilter = z.object({
  machineId: z.string().min(1).optional(),
  from: epochMs,
  to: epochMs,
})

export const ReadingsQuerySchema = refineTimeRange(
  readingsFilter.extend({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
    sort: ReadingSortSchema.default('-ts'),
  }),
)
export type ReadingsQuery = z.input<typeof ReadingsQuerySchema>
export type ReadingsQueryParsed = z.output<typeof ReadingsQuerySchema>

export const ReadingsCsvQuerySchema = refineTimeRange(readingsFilter)
export type ReadingsCsvQuery = z.output<typeof ReadingsCsvQuerySchema>

export const ReadingsResponseSchema = z.object({
  items: z.array(ReadingSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
})
export type ReadingsResponse = z.infer<typeof ReadingsResponseSchema>
