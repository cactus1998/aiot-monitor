import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import {
  AlertRuleBodySchema,
  AlertRulePatchSchema,
  AlertRuleSchema,
  AlertRulesResponseSchema,
  AlertSchema,
  AlertsQuerySchema,
  AlertsResponseSchema,
  IdParamsSchema,
} from '@aiot/shared'
import { sendError } from '../errors.ts'

export const alertRoutes: FastifyPluginAsyncZod = async (app) => {
  const { alerts, machines, now } = app.ctx

  const unknownMachine = (machineId: string | null | undefined) =>
    machineId !== null && machineId !== undefined && !machines.get(machineId)

  app.get(
    '/alert-rules',
    {
      schema: {
        tags: ['alerts'],
        summary: '告警規則清單',
        response: { 200: AlertRulesResponseSchema },
      },
    },
    async () => ({ items: alerts.listRules() }),
  )

  app.post(
    '/alert-rules',
    {
      schema: {
        tags: ['alerts'],
        summary: '新增告警規則',
        body: AlertRuleBodySchema,
        response: { 201: AlertRuleSchema },
      },
    },
    async (request, reply) => {
      if (unknownMachine(request.body.machineId)) {
        return sendError(reply, 400, 'VALIDATION_ERROR', `找不到機台 ${request.body.machineId}`)
      }
      return reply.status(201).send(alerts.createRule(request.body))
    },
  )

  app.patch(
    '/alert-rules/:id',
    {
      schema: {
        tags: ['alerts'],
        summary: '修改告警規則',
        params: IdParamsSchema,
        body: AlertRulePatchSchema,
        response: { 200: AlertRuleSchema },
      },
    },
    async (request, reply) => {
      if (unknownMachine(request.body.machineId)) {
        return sendError(reply, 400, 'VALIDATION_ERROR', `找不到機台 ${request.body.machineId}`)
      }
      const rule = alerts.updateRule(request.params.id, request.body)
      return rule ?? sendError(reply, 404, 'NOT_FOUND', `找不到規則 ${request.params.id}`)
    },
  )

  app.delete(
    '/alert-rules/:id',
    { schema: { tags: ['alerts'], summary: '刪除告警規則', params: IdParamsSchema } },
    async (request, reply) => {
      if (!alerts.deleteRule(request.params.id)) {
        return sendError(reply, 404, 'NOT_FOUND', `找不到規則 ${request.params.id}`)
      }
      return reply.status(204).send()
    },
  )

  app.get(
    '/alerts',
    {
      schema: {
        tags: ['alerts'],
        summary: '告警紀錄',
        querystring: AlertsQuerySchema,
        response: { 200: AlertsResponseSchema },
      },
    },
    async (request) => ({ items: alerts.listAlerts(request.query), openCount: alerts.openCount() }),
  )

  app.patch(
    '/alerts/:id/ack',
    {
      schema: {
        tags: ['alerts'],
        summary: '確認告警',
        params: IdParamsSchema,
        response: { 200: AlertSchema },
      },
    },
    async (request, reply) => {
      const alert = alerts.ack(request.params.id, now())
      return alert ?? sendError(reply, 404, 'NOT_FOUND', `找不到告警 ${request.params.id}`)
    },
  )
}
