import { z } from 'zod'
import { MachineStatusSchema } from '../machine.ts'

export const OeeSchema = z.object({
  availability: z.number().min(0).max(1),
  performance: z.number().min(0).max(1),
  quality: z.number().min(0).max(1),
  oee: z.number().min(0).max(1),
})
export type Oee = z.infer<typeof OeeSchema>

export const OverviewResponseSchema = z.object({
  ts: z.number().int(),
  machineCount: z.number().int().nonnegative(),
  statusCounts: z.record(MachineStatusSchema, z.number().int().nonnegative()),
  /** Share of machines currently running, 0–1. */
  utilization: z.number().min(0).max(1),
  oee: OeeSchema,
  outputToday: z.number().int().nonnegative(),
  goodToday: z.number().int().nonnegative(),
  openAlerts: z.number().int().nonnegative(),
  shiftOutput: z.array(
    z.object({
      shift: z.enum(['C', 'A', 'B']),
      label: z.string(),
      output: z.number().int().nonnegative(),
    }),
  ),
  machineOutput: z.array(
    z.object({
      machineId: z.string(),
      output: z.number().int().nonnegative(),
      good: z.number().int().nonnegative(),
    }),
  ),
})
export type OverviewResponse = z.infer<typeof OverviewResponseSchema>
