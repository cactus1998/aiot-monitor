import { z } from 'zod'
import { METRIC_KEYS } from '../metrics.ts'

export const RULE_OPS = ['gt', 'lt'] as const
export const RuleOpSchema = z.enum(RULE_OPS)
export type RuleOp = z.infer<typeof RuleOpSchema>
export const RULE_OP_LABELS: Record<RuleOp, string> = { gt: '高於', lt: '低於' }

export const AlertRuleSchema = z.object({
  id: z.number().int(),
  /** null applies the rule to every machine. */
  machineId: z.string().nullable(),
  metric: z.enum(METRIC_KEYS),
  op: RuleOpSchema,
  threshold: z.number(),
  durationSec: z.number().int().min(0).max(3600),
  enabled: z.boolean(),
})
export type AlertRule = z.infer<typeof AlertRuleSchema>

export const AlertRuleBodySchema = AlertRuleSchema.omit({ id: true })
export type AlertRuleBody = z.infer<typeof AlertRuleBodySchema>

export const AlertRulePatchSchema = AlertRuleBodySchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: '至少需要一個欄位' },
)
export type AlertRulePatch = z.infer<typeof AlertRulePatchSchema>

export const AlertRulesResponseSchema = z.object({ items: z.array(AlertRuleSchema) })
export type AlertRulesResponse = z.infer<typeof AlertRulesResponseSchema>

export const IdParamsSchema = z.object({ id: z.coerce.number().int().positive() })

export const AlertSchema = z.object({
  id: z.number().int(),
  ruleId: z.number().int(),
  machineId: z.string(),
  metric: z.enum(METRIC_KEYS),
  op: RuleOpSchema,
  threshold: z.number(),
  ts: z.number().int(),
  value: z.number(),
  ackedAt: z.number().int().nullable(),
})
export type Alert = z.infer<typeof AlertSchema>

export const ALERT_FILTERS = ['open', 'acked', 'all'] as const
export type AlertFilter = (typeof ALERT_FILTERS)[number]

export const AlertsQuerySchema = z.object({
  status: z.enum(ALERT_FILTERS).default('all'),
  machineId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})
export type AlertsQuery = z.input<typeof AlertsQuerySchema>
export type AlertsQueryParsed = z.output<typeof AlertsQuerySchema>

export const AlertsResponseSchema = z.object({
  items: z.array(AlertSchema),
  openCount: z.number().int().nonnegative(),
})
export type AlertsResponse = z.infer<typeof AlertsResponseSchema>
