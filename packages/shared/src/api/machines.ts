import { z } from 'zod'
import { MachineSchema, ReadingSchema } from '../machine.ts'

export const MachineWithLatestSchema = MachineSchema.extend({
  latest: ReadingSchema.nullable(),
})
export type MachineWithLatest = z.infer<typeof MachineWithLatestSchema>

export const MachinesResponseSchema = z.object({
  items: z.array(MachineWithLatestSchema),
})
export type MachinesResponse = z.infer<typeof MachinesResponseSchema>

export const MachineParamsSchema = z.object({
  id: z.string().min(1),
})
