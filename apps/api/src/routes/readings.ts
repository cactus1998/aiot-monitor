import { Readable } from 'node:stream'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import {
  CSV_BOM,
  CSV_HEADER,
  ReadingsCsvQuerySchema,
  ReadingsQuerySchema,
  ReadingsResponseSchema,
  toCsvRow,
} from '@aiot/shared'

export const readingRoutes: FastifyPluginAsyncZod = async (app) => {
  const { readings } = app.ctx

  app.get(
    '/readings',
    {
      schema: {
        tags: ['readings'],
        summary: '原始讀值分頁查詢',
        querystring: ReadingsQuerySchema,
        response: { 200: ReadingsResponseSchema },
      },
    },
    async (request) => readings.page(request.query),
  )

  app.get(
    '/readings.csv',
    {
      schema: {
        tags: ['readings'],
        summary: '匯出 CSV（串流）',
        querystring: ReadingsCsvQuerySchema,
      },
    },
    async (request, reply) => {
      const query = request.query
      const name = `readings-${query.machineId ?? 'all'}-${new Date(query.from).toISOString().slice(0, 16).replace(':', '')}.csv`
      function* lines() {
        // BOM so Excel opens the UTF-8 file correctly.
        yield `${CSV_BOM}${CSV_HEADER}\n`
        for (const r of readings.iterate(query)) yield `${toCsvRow(r)}\n`
      }
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="${name}"`)
        .send(Readable.from(lines()))
    },
  )
}
