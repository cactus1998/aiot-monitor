import type { DatabaseSync } from 'node:sqlite'
import type {
  Alert,
  AlertRule,
  AlertRuleBody,
  AlertRulePatch,
  AlertsQueryParsed,
  MetricKey,
  RuleOp,
} from '@aiot/shared'
import { DEFAULT_ALERT_RULES } from '@aiot/shared'

interface RuleRow {
  id: number
  machine_id: string | null
  metric: MetricKey
  op: RuleOp
  threshold: number
  duration_sec: number
  enabled: number
}

interface AlertRow {
  id: number
  rule_id: number
  machine_id: string
  metric: MetricKey
  op: RuleOp
  threshold: number
  ts: number
  value: number
  acked_at: number | null
}

const toRule = (r: RuleRow): AlertRule => ({
  id: r.id,
  machineId: r.machine_id,
  metric: r.metric,
  op: r.op,
  threshold: r.threshold,
  durationSec: r.duration_sec,
  enabled: r.enabled === 1,
})

const toAlert = (r: AlertRow): Alert => ({
  id: r.id,
  ruleId: r.rule_id,
  machineId: r.machine_id,
  metric: r.metric,
  op: r.op,
  threshold: r.threshold,
  ts: r.ts,
  value: r.value,
  ackedAt: r.acked_at,
})

const ruleParams = (b: AlertRuleBody) => ({
  machineId: b.machineId,
  metric: b.metric,
  op: b.op,
  threshold: b.threshold,
  durationSec: b.durationSec,
  enabled: b.enabled ? 1 : 0,
})

export function createAlertsRepo(db: DatabaseSync) {
  const listRulesStmt = db.prepare('SELECT * FROM alert_rules ORDER BY id')
  const getRuleStmt = db.prepare('SELECT * FROM alert_rules WHERE id = ?')
  const countRulesStmt = db.prepare('SELECT COUNT(*) AS n FROM alert_rules')
  const insertRuleStmt = db.prepare(
    `INSERT INTO alert_rules (machine_id, metric, op, threshold, duration_sec, enabled)
     VALUES (:machineId, :metric, :op, :threshold, :durationSec, :enabled)
     RETURNING *`,
  )
  const updateRuleStmt = db.prepare(
    `UPDATE alert_rules SET machine_id = :machineId, metric = :metric, op = :op,
       threshold = :threshold, duration_sec = :durationSec, enabled = :enabled
     WHERE id = :id RETURNING *`,
  )
  const deleteRuleStmt = db.prepare('DELETE FROM alert_rules WHERE id = ?')

  const insertAlertStmt = db.prepare(
    `INSERT INTO alerts (rule_id, machine_id, metric, op, threshold, ts, value)
     VALUES (:ruleId, :machineId, :metric, :op, :threshold, :ts, :value)
     RETURNING *`,
  )
  const listAlertsStmt = db.prepare(
    `SELECT * FROM alerts
     WHERE (:status = 'all' OR (:status = 'open' AND acked_at IS NULL) OR (:status = 'acked' AND acked_at IS NOT NULL))
       AND (:machineId IS NULL OR machine_id = :machineId)
     ORDER BY ts DESC, id DESC LIMIT :limit`,
  )
  const openCountStmt = db.prepare('SELECT COUNT(*) AS n FROM alerts WHERE acked_at IS NULL')
  const ackStmt = db.prepare(
    'UPDATE alerts SET acked_at = COALESCE(acked_at, :ackedAt) WHERE id = :id RETURNING *',
  )
  const deleteAlertsStmt = db.prepare('DELETE FROM alerts WHERE ts < ?')

  const getRule = (id: number): AlertRule | undefined => {
    const row = getRuleStmt.get(id) as unknown as RuleRow | undefined
    return row ? toRule(row) : undefined
  }
  const createRule = (body: AlertRuleBody): AlertRule =>
    toRule(insertRuleStmt.get(ruleParams(body)) as unknown as RuleRow)

  return {
    listRules(): AlertRule[] {
      return (listRulesStmt.all() as unknown as RuleRow[]).map(toRule)
    },
    getRule,
    createRule,
    updateRule(id: number, patch: AlertRulePatch): AlertRule | undefined {
      const current = getRule(id)
      if (!current) return undefined
      const next = { ...current, ...patch }
      return toRule(updateRuleStmt.get({ id, ...ruleParams(next) }) as unknown as RuleRow)
    },
    deleteRule(id: number): boolean {
      return Number(deleteRuleStmt.run(id).changes) > 0
    },
    seedDefaultRules(): void {
      if ((countRulesStmt.get() as { n: number }).n > 0) return
      for (const rule of DEFAULT_ALERT_RULES) createRule(rule)
    },

    insertAlert(alert: Omit<Alert, 'id' | 'ackedAt'>): Alert {
      return toAlert(insertAlertStmt.get({ ...alert }) as unknown as AlertRow)
    },
    listAlerts(query: AlertsQueryParsed): Alert[] {
      const rows = listAlertsStmt.all({
        status: query.status,
        machineId: query.machineId ?? null,
        limit: query.limit,
      }) as unknown as AlertRow[]
      return rows.map(toAlert)
    },
    openCount(): number {
      return (openCountStmt.get() as { n: number }).n
    },
    ack(id: number, ackedAt: number): Alert | undefined {
      const row = ackStmt.get({ id, ackedAt }) as unknown as AlertRow | undefined
      return row ? toAlert(row) : undefined
    },
    deleteBefore(ts: number): number {
      return Number(deleteAlertsStmt.run(ts).changes)
    },
  }
}

export type AlertsRepo = ReturnType<typeof createAlertsRepo>
