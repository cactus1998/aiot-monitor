import type { Alert, Reading, RuleState } from '@aiot/shared'
import { evaluateRule, HOUR, initialRuleState, MINUTE, ruleApplies, SECOND } from '@aiot/shared'
import type { Simulator } from '@aiot/simulator'
import { createSimulator, generateHistory } from '@aiot/simulator'
import type { AlertsRepo } from '../db/alerts.ts'
import type { ReadingsRepo } from '../db/readings.ts'
import type { StreamHub } from './hub.ts'

export interface IngestOptions {
  readings: ReadingsRepo
  alerts: AlertsRepo
  hub: StreamHub
  seed: number
  backfillHours: number
  writeIntervalSec: number
  retentionHours: number
  now?: () => number
  log?: (message: string) => void
}

export interface LiveSource {
  /** Latest per-second reading of every machine, or null before the first tick. */
  latest(): Reading[] | null
}

const ALERT_RETENTION_MS = 7 * 24 * HOUR
const CLEANUP_INTERVAL_MS = 10 * MINUTE

/**
 * Drives the simulator: backfills history on first start, then ticks every
 * second, publishes to SSE, evaluates alert rules and writes to SQLite every
 * `writeIntervalSec` seconds.
 */
export class Ingestor implements LiveSource {
  readonly #o: Required<IngestOptions>
  #sim: Simulator | null = null
  #latest: Reading[] | null = null
  #ruleStates = new Map<string, RuleState>()
  #lastWrite = 0
  #lastCleanup = 0
  #timer: ReturnType<typeof setInterval> | null = null

  constructor(options: IngestOptions) {
    this.#o = { now: Date.now, log: () => {}, ...options }
  }

  latest(): Reading[] | null {
    return this.#latest
  }

  get simulator(): Simulator | null {
    return this.#sim
  }

  /** Prepare the simulator, backfilling if the stored data is missing or stale. */
  init(): void {
    const { readings, alerts, seed, backfillHours, retentionHours, log } = this.#o
    const now = floorSecond(this.#o.now())
    alerts.seedDefaultRules()

    const latestTs = readings.latestTs()
    if (latestTs === null || latestTs < now - retentionHours * HOUR) {
      const from = floorMinute(now - backfillHours * HOUR)
      const t0 = performance.now()
      this.#sim = createSimulator({ seed, startTs: from })
      const history = generateHistory(this.#sim, from, now, MINUTE)
      readings.insertMany(history)
      const fired = history.flatMap((r) => this.#evaluate(r))
      log(
        `backfilled ${history.length} readings and ${fired.length} alerts in ${Math.round(performance.now() - t0)}ms`,
      )
    } else {
      this.#sim = createSimulator({
        seed: seed + latestTs,
        startTs: now,
        initial: readings.latestPerMachine(),
      })
      log(
        `resumed from ${new Date(latestTs).toISOString()} with ${readings.count()} stored readings`,
      )
    }
    this.#lastWrite = now
    this.#lastCleanup = now
  }

  start(): void {
    if (!this.#sim) this.init()
    this.#timer = setInterval(() => this.tick(), SECOND)
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer)
    this.#timer = null
  }

  /** One live step; exposed for tests. */
  tick(ts = floorSecond(this.#o.now())): Reading[] {
    if (!this.#sim) this.init()
    const { readings, alerts, hub, writeIntervalSec, retentionHours } = this.#o
    const batch = this.#sim!.tick(ts)
    this.#latest = batch
    hub.publishReadings(ts, batch)
    for (const alert of batch.flatMap((r) => this.#evaluate(r))) hub.publishAlert(alert)

    if (ts - this.#lastWrite >= writeIntervalSec * SECOND) {
      readings.insertMany(batch)
      this.#lastWrite = ts
    }
    if (ts - this.#lastCleanup >= CLEANUP_INTERVAL_MS) {
      readings.deleteBefore(ts - retentionHours * HOUR)
      alerts.deleteBefore(ts - ALERT_RETENTION_MS)
      this.#lastCleanup = ts
    }
    return batch
  }

  #evaluate(reading: Reading): Alert[] {
    const fired: Alert[] = []
    for (const rule of this.#o.alerts.listRules()) {
      if (!ruleApplies(rule, reading.machineId)) continue
      const key = `${rule.id}:${reading.machineId}`
      const { state, trigger } = evaluateRule(
        rule,
        reading,
        this.#ruleStates.get(key) ?? initialRuleState(),
      )
      this.#ruleStates.set(key, state)
      if (trigger) {
        fired.push(
          this.#o.alerts.insertAlert({
            ruleId: rule.id,
            machineId: reading.machineId,
            metric: rule.metric,
            op: rule.op,
            threshold: rule.threshold,
            ts: trigger.ts,
            value: trigger.value,
          }),
        )
      }
    }
    return fired
  }
}

const floorSecond = (ts: number) => ts - (ts % SECOND)
const floorMinute = (ts: number) => ts - (ts % MINUTE)
