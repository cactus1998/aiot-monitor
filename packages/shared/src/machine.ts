import { z } from 'zod'

export const MACHINE_TYPES = ['cnc', 'molding', 'grinding'] as const
export const MachineTypeSchema = z.enum(MACHINE_TYPES)
export type MachineType = z.infer<typeof MachineTypeSchema>

export const MACHINE_TYPE_LABELS: Record<MachineType, string> = {
  cnc: 'CNC 加工機',
  molding: '射出成型機',
  grinding: '研磨機',
}

export const MACHINE_STATUSES = ['running', 'idle', 'alarm', 'offline'] as const
export const MachineStatusSchema = z.enum(MACHINE_STATUSES)
export type MachineStatus = z.infer<typeof MachineStatusSchema>

export const MACHINE_STATUS_LABELS: Record<MachineStatus, string> = {
  running: '運轉中',
  idle: '待機',
  alarm: '異常',
  offline: '停機',
}

export const MachineSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: MachineTypeSchema,
  line: z.string(),
  idealCycleSec: z.number().positive(),
})
export type Machine = z.infer<typeof MachineSchema>

const sensor = z.number().nullable()

export const ReadingSchema = z.object({
  machineId: z.string(),
  ts: z.number().int(),
  temperature: sensor,
  vibration: sensor,
  spindleLoad: sensor,
  rpm: sensor,
  status: MachineStatusSchema,
  /** Cumulative produced count since the machine was commissioned. */
  output: z.number().int().nonnegative(),
  /** Cumulative good count; always ≤ output. */
  good: z.number().int().nonnegative(),
})
export type Reading = z.infer<typeof ReadingSchema>
