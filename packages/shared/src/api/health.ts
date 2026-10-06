import { z } from 'zod'

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  time: z.number().int(),
  readings: z.number().int().nonnegative(),
})
export type HealthResponse = z.infer<typeof HealthResponseSchema>
