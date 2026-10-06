import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { buildOverview, OverviewResponseSchema, startOfTaipeiDay } from '@aiot/shared'

export const statsRoutes: FastifyPluginAsyncZod = async (app) => {
  const { machines, readings, alerts, live, now } = app.ctx

  app.get(
    '/stats/overview',
    {
      schema: {
        tags: ['stats'],
        summary: '今日總覽：OEE、產量、狀態分布、未處理告警',
        response: { 200: OverviewResponseSchema },
      },
    },
    async () => {
      const ts = now()
      return buildOverview({
        now: ts,
        machines: machines.list(),
        todayReadings: readings.range({ from: startOfTaipeiDay(ts), to: ts + 1 }),
        latest: live.latest() ?? readings.latestPerMachine(),
        openAlerts: alerts.openCount(),
      })
    },
  )
}
