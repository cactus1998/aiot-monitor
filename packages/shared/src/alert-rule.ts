import type { AlertRule, AlertRuleBody } from './api/alerts.ts'
import type { Reading } from './machine.ts'

/** Rules created on first start (API) or page load (mock). */
export const DEFAULT_ALERT_RULES: AlertRuleBody[] = [
  {
    machineId: null,
    metric: 'temperature',
    op: 'gt',
    threshold: 85,
    durationSec: 10,
    enabled: true,
  },
  { machineId: null, metric: 'vibration', op: 'gt', threshold: 7.1, durationSec: 5, enabled: true },
  {
    machineId: null,
    metric: 'spindleLoad',
    op: 'gt',
    threshold: 95,
    durationSec: 30,
    enabled: true,
  },
]

export function ruleApplies(rule: AlertRule, machineId: string): boolean {
  return rule.enabled && (rule.machineId === null || rule.machineId === machineId)
}

export function breaches(rule: Pick<AlertRule, 'op' | 'threshold'>, value: number | null): boolean {
  if (value === null) return false
  return rule.op === 'gt' ? value > rule.threshold : value < rule.threshold
}

/** Per (rule, machine) state kept between ticks. */
export interface RuleState {
  /** ts when the condition started being true, null when it is false. */
  since: number | null
  /** Whether an alert already fired for the current breach. */
  fired: boolean
}

export const initialRuleState = (): RuleState => ({ since: null, fired: false })

export interface RuleEvaluation {
  state: RuleState
  /** Set when this reading triggers a new alert. */
  trigger: { ts: number; value: number } | null
}

/**
 * Advance one rule for one reading. An alert fires once when the condition has
 * held for `durationSec`; it re-arms after the condition clears. A null reading
 * neither starts nor clears a breach (sensor dropout).
 */
export function evaluateRule(rule: AlertRule, reading: Reading, prev: RuleState): RuleEvaluation {
  const value = reading[rule.metric]
  if (value === null) return { state: prev, trigger: null }
  if (!breaches(rule, value)) return { state: initialRuleState(), trigger: null }

  const since = prev.since ?? reading.ts
  const held = reading.ts - since >= rule.durationSec * 1000
  if (held && !prev.fired) {
    return { state: { since, fired: true }, trigger: { ts: reading.ts, value } }
  }
  return { state: { since, fired: prev.fired }, trigger: null }
}
