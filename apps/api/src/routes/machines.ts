import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import {
  HealthResponseSchema,
  MachineParamsSchema,
  MachinesResponseSchema,
  SeriesQuerySchema,
  SeriesResponseSchema,
} from '@aiot/shared'
import { sendError } from '../errors.ts'

export const machineRoutes: FastifyPluginAsyncZod = async (app) => {
  const { machines, readings, live, now } = app.ctx

  app.get(
    '/health',
    { schema: { tags: ['system'], response: { 200: HealthResponseSchema } } },
    async () => ({ status: 'ok' as const, time: now(), readings: readings.count() }),
  )

  app.get(
    '/machines',
    {
      schema: {
        tags: ['machines'],
        summary: '機台清單與最新讀值',
        response: { 200: MachinesResponseSchema },
      },
    },
    async () => {
      const latest = live.latest() ?? readings.latestPerMachine()
      return {
        items: machines.list().map((m) => ({
          ...m,
          latest: latest.find((r) => r.machineId === m.id) ?? null,
        })),
      }
    },
  )

  app.get(
    '/machines/:id/series',
    {
      schema: {
        tags: ['machines'],
        summary: '時間序列（伺服器端分桶降採樣）',
        params: MachineParamsSchema,
        querystring: SeriesQuerySchema,
        response: { 200: SeriesResponseSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      if (!machines.get(id)) return sendError(reply, 404, 'NOT_FOUND', `找不到機台 ${id}`)
      const { metric, from, to, points } = request.query
      return { machineId: id, metric, from, to, ...readings.series(id, metric, from, to, points) }
    },
  )
}
