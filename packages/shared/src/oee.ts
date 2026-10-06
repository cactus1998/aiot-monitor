import type { Oee } from './api/overview.ts'
import type { Reading } from './machine.ts'

export interface OeeInput {
  /** Time the machine was expected to produce, seconds. */
  plannedSec: number
  /** Time the machine was actually running, seconds. */
  runSec: number
  idealCycleSec: number
  totalCount: number
  goodCount: number
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

/**
 * OEE = availability × performance × quality.
 * - availability = run time / planned time
 * - performance = (ideal cycle × total count) / run time
 * - quality = good / total
 */
export function computeOee(input: OeeInput): Oee {
  const availability = input.plannedSec > 0 ? clamp01(input.runSec / input.plannedSec) : 0
  const performance =
    input.runSec > 0 ? clamp01((input.idealCycleSec * input.totalCount) / input.runSec) : 0
  const quality = input.totalCount > 0 ? clamp01(input.goodCount / input.totalCount) : 0
  return { availability, performance, quality, oee: availability * performance * quality }
}

/** Longest gap a single sample may represent; longer gaps are treated as missing data. */
export const MAX_SAMPLE_GAP_SEC = 120

/**
 * OEE inputs from one machine's readings (sorted by ts ascending). Each sample
 * stands for the time until the next sample, capped at MAX_SAMPLE_GAP_SEC.
 * Offline time counts as planned time (unplanned stop).
 */
export function machineOeeInput(readings: readonly Reading[], idealCycleSec: number): OeeInput {
  const durations = readings.map((r, i) => {
    const next = readings[i + 1]
    const gap = next ? (next.ts - r.ts) / 1000 : 0
    return { status: r.status, sec: Math.min(Math.max(gap, 0), MAX_SAMPLE_GAP_SEC) }
  })
  const plannedSec = durations.reduce((sum, d) => sum + d.sec, 0)
  const runSec = durations.filter((d) => d.status === 'running').reduce((sum, d) => sum + d.sec, 0)
  const first = readings.at(0)
  const last = readings.at(-1)
  const totalCount = first && last ? Math.max(0, last.output - first.output) : 0
  const goodCount = first && last ? Math.max(0, last.good - first.good) : 0
  return { plannedSec, runSec, idealCycleSec, totalCount, goodCount }
}

export function computeMachineOee(readings: readonly Reading[], idealCycleSec: number): Oee {
  return computeOee(machineOeeInput(readings, idealCycleSec))
}

/** Plant-level OEE: sum each machine's inputs, weighting performance by ideal cycle time. */
export function combineOee(inputs: readonly OeeInput[]): Oee {
  const planned = inputs.reduce((s, i) => s + i.plannedSec, 0)
  const run = inputs.reduce((s, i) => s + i.runSec, 0)
  const idealSec = inputs.reduce((s, i) => s + i.idealCycleSec * i.totalCount, 0)
  const total = inputs.reduce((s, i) => s + i.totalCount, 0)
  const good = inputs.reduce((s, i) => s + i.goodCount, 0)
  const availability = planned > 0 ? clamp01(run / planned) : 0
  const performance = run > 0 ? clamp01(idealSec / run) : 0
  const quality = total > 0 ? clamp01(good / total) : 0
  return { availability, performance, quality, oee: availability * performance * quality }
}
