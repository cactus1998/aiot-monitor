import type { OverviewResponse } from './api/overview.ts'
import type { Machine, Reading } from './machine.ts'
import { combineOee, machineOeeInput } from './oee.ts'
import { HOUR, SHIFTS, startOfTaipeiDay } from './time.ts'
import { groupByMachine, statusDistribution } from './transform.ts'

/** Produced count between the first and last reading of a machine's window. */
function delta(readings: readonly Reading[], field: 'output' | 'good'): number {
  const first = readings.at(0)
  const last = readings.at(-1)
  return first && last ? Math.max(0, last[field] - first[field]) : 0
}

/**
 * Today's plant overview. Shared by the API (readings from SQLite) and the
 * browser mock client (readings from memory) so both report identical numbers.
 */
export function buildOverview(input: {
  now: number
  machines: readonly Machine[]
  /** Readings since today's Taipei midnight, sorted by ts within each machine. */
  todayReadings: readonly Reading[]
  latest: readonly Reading[]
  openAlerts: number
}): OverviewResponse {
  const { now, machines, todayReadings, latest, openAlerts } = input
  const dayStart = startOfTaipeiDay(now)
  const byMachine = groupByMachine(todayReadings)

  const inputs = machines.map((m) => machineOeeInput(byMachine[m.id] ?? [], m.idealCycleSec))
  const machineOutput = machines.map((m) => {
    const list = byMachine[m.id] ?? []
    return { machineId: m.id, output: delta(list, 'output'), good: delta(list, 'good') }
  })

  const shiftOutput = SHIFTS.map((shift) => {
    const start = dayStart + shift.startHour * HOUR
    const end = start + 8 * HOUR
    const output = machines.reduce((sum, m) => {
      const inShift = (byMachine[m.id] ?? []).filter((r) => r.ts >= start && r.ts < end)
      return sum + delta(inShift, 'output')
    }, 0)
    return { shift: shift.key, label: shift.label, output }
  })

  const statusCounts = statusDistribution(latest.map((r) => r.status))
  return {
    ts: now,
    machineCount: machines.length,
    statusCounts,
    utilization: machines.length ? statusCounts.running / machines.length : 0,
    oee: combineOee(inputs),
    outputToday: machineOutput.reduce((s, m) => s + m.output, 0),
    goodToday: machineOutput.reduce((s, m) => s + m.good, 0),
    openAlerts,
    shiftOutput,
    machineOutput,
  }
}
