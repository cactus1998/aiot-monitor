import type { Machine, MachineStatus, Reading } from '@aiot/shared'
import { METRICS } from '@aiot/shared'
import { MACHINES, PROFILES } from './machines.ts'
import { Random } from './random.ts'

export const ANOMALY_KINDS = ['overheat', 'vibration', 'stoppage'] as const
export type AnomalyKind = (typeof ANOMALY_KINDS)[number]

export const ANOMALY_LABELS: Record<AnomalyKind, string> = {
  overheat: '漸進升溫',
  vibration: '振動突波',
  stoppage: '停機',
}

const DEFAULT_DURATION_SEC: Record<AnomalyKind, [number, number]> = {
  overheat: [600, 900],
  vibration: [30, 90],
  stoppage: [120, 300],
}

const OVERHEAT_RATE_PER_SEC = 0.06
const OVERHEAT_MAX = 40
const VIBRATION_FACTOR = 3.5
const IDLE_RATE_PER_SEC = 1 / 1800
const AMBIENT_TEMPERATURE = 30
/** Temperature time constant, seconds. */
const THERMAL_TAU = 90

export interface SimulatorOptions {
  seed?: number
  /** Simulation clock start, UTC ms. */
  startTs: number
  machines?: readonly Machine[]
  /** Latest stored reading per machine, used to continue counters after a restart. */
  initial?: readonly Reading[]
  anomalyRatePerHour?: number
  /** Probability that one sensor value is missing (null). */
  dropoutRate?: number
}

export interface ActiveAnomaly {
  machineId: string
  kind: AnomalyKind
  remainingSec: number
}

export interface Simulator {
  readonly machines: readonly Machine[]
  /** Advance the clock to `ts` and return one reading per machine. */
  tick(ts: number): Reading[]
  inject(machineId: string, kind: AnomalyKind, durationSec?: number): boolean
  anomalies(): ActiveAnomaly[]
}

interface MachineState {
  machine: Machine
  rng: Random
  temperature: number
  idleRemaining: number
  anomaly: { kind: AnomalyKind; remaining: number; elapsed: number } | null
  cycleProgress: number
  cycleFactor: number
  output: number
  good: number
  last: Reading
}

const round = (v: number, decimals: number) => {
  const f = 10 ** decimals
  return Math.round(v * f) / f
}

export function createSimulator(options: SimulatorOptions): Simulator {
  const {
    seed = 42,
    startTs,
    machines = MACHINES,
    initial = [],
    anomalyRatePerHour = 0.4,
    dropoutRate = 0.002,
  } = options
  let clock = startTs

  const states: MachineState[] = machines.map((machine, index) => {
    const rng = new Random(seed * 31 + index * 7919 + 1)
    const profile = PROFILES[machine.type]
    const restored = initial.findLast((r) => r.machineId === machine.id)
    const output = restored?.output ?? rng.int(2000, 8000)
    const good = restored?.good ?? Math.round(output * 0.97)
    const temperature = restored?.temperature ?? profile.temperature + rng.gaussian(1)
    const last: Reading = restored ?? {
      machineId: machine.id,
      ts: startTs,
      temperature: round(temperature, 1),
      vibration: profile.vibration,
      spindleLoad: profile.spindleLoad,
      rpm: profile.rpm,
      status: 'running',
      output,
      good,
    }
    return {
      machine,
      rng,
      temperature,
      idleRemaining: 0,
      anomaly: null,
      cycleProgress: rng.float(),
      cycleFactor: rng.between(1.05, 1.25),
      output,
      good,
      last,
    }
  })

  function startAnomaly(state: MachineState, kind: AnomalyKind, durationSec?: number) {
    const [min, max] = DEFAULT_DURATION_SEC[kind]
    state.anomaly = { kind, remaining: durationSec ?? state.rng.int(min, max), elapsed: 0 }
    if (kind === 'stoppage') state.idleRemaining = 0
  }

  function advance(state: MachineState, ts: number, dt: number): Reading {
    const { machine, rng } = state
    const profile = PROFILES[machine.type]

    // 1. Anomalies: finish the running one or maybe start a new one.
    if (state.anomaly) {
      state.anomaly.elapsed += dt
      state.anomaly.remaining -= dt
      if (state.anomaly.remaining <= 0) state.anomaly = null
    } else if (rng.happens(anomalyRatePerHour / 3600, dt)) {
      startAnomaly(state, rng.pick(ANOMALY_KINDS))
    }
    const kind = state.anomaly?.kind

    // 2. Planned idle (changeover).
    if (state.idleRemaining > 0) state.idleRemaining = Math.max(0, state.idleRemaining - dt)
    else if (kind !== 'stoppage' && rng.happens(IDLE_RATE_PER_SEC, dt)) {
      state.idleRemaining = rng.int(60, 300)
    }

    const mode: 'offline' | 'idle' | 'active' =
      kind === 'stoppage' ? 'offline' : state.idleRemaining > 0 ? 'idle' : 'active'

    // 3. Sensor values.
    const overheat =
      kind === 'overheat'
        ? Math.min(OVERHEAT_MAX, state.anomaly!.elapsed * OVERHEAT_RATE_PER_SEC)
        : 0
    let spindleLoad: number
    let rpm: number
    let vibration: number
    let target: number
    if (mode === 'active') {
      spindleLoad = Math.min(100, Math.max(0, profile.spindleLoad + rng.gaussian(4)))
      rpm = profile.rpm * (1 + rng.gaussian(0.02))
      vibration =
        profile.vibration * (1 + rng.gaussian(0.08)) * (kind === 'vibration' ? VIBRATION_FACTOR : 1)
      target = profile.temperature + (spindleLoad - profile.spindleLoad) * 0.2 + overheat
    } else if (mode === 'idle') {
      spindleLoad = Math.max(0, 3 + rng.gaussian(1))
      rpm = 0
      vibration = Math.max(0, 0.3 + rng.gaussian(0.05))
      target = profile.temperature - 15 + overheat
    } else {
      spindleLoad = 0
      rpm = 0
      vibration = Math.max(0, 0.05 + rng.gaussian(0.01))
      target = AMBIENT_TEMPERATURE
    }
    state.temperature +=
      (target - state.temperature) * (1 - Math.exp(-dt / THERMAL_TAU)) + rng.gaussian(0.3)

    const status: MachineStatus =
      mode === 'offline'
        ? 'offline'
        : mode === 'idle'
          ? 'idle'
          : state.temperature >= METRICS.temperature.alarm || vibration >= METRICS.vibration.alarm
            ? 'alarm'
            : 'running'

    // 4. Production: alarm still produces, with worse quality.
    if (status === 'running' || status === 'alarm') {
      const quality = status === 'alarm' || kind ? 0.85 : 0.97
      state.cycleProgress += dt / (machine.idealCycleSec * state.cycleFactor)
      while (state.cycleProgress >= 1) {
        state.cycleProgress -= 1
        state.output += 1
        if (rng.float() < quality) state.good += 1
        state.cycleFactor = rng.between(1.05, 1.25)
      }
    }

    const sensor = (value: number, decimals: number) =>
      rng.float() < dropoutRate ? null : round(value, decimals)

    return {
      machineId: machine.id,
      ts,
      temperature: sensor(state.temperature, 1),
      vibration: sensor(vibration, 2),
      spindleLoad: sensor(spindleLoad, 1),
      rpm: sensor(rpm, 0),
      status,
      output: state.output,
      good: state.good,
    }
  }

  return {
    machines,
    tick(ts) {
      const dt = (ts - clock) / 1000
      if (dt <= 0) return states.map((s) => s.last)
      clock = ts
      return states.map((s) => {
        s.last = advance(s, ts, dt)
        return s.last
      })
    },
    inject(machineId, kind, durationSec) {
      const state = states.find((s) => s.machine.id === machineId)
      if (!state) return false
      startAnomaly(state, kind, durationSec)
      return true
    },
    anomalies() {
      return states
        .filter((s) => s.anomaly !== null)
        .map((s) => ({
          machineId: s.machine.id,
          kind: s.anomaly!.kind,
          remainingSec: Math.ceil(s.anomaly!.remaining),
        }))
    },
  }
}

/** Tick the simulator from `from` (exclusive) to `to` (inclusive) every `stepMs`. */
export function generateHistory(
  sim: Simulator,
  from: number,
  to: number,
  stepMs: number,
): Reading[] {
  const readings: Reading[] = []
  for (let ts = from + stepMs; ts <= to; ts += stepMs) readings.push(...sim.tick(ts))
  return readings
}
