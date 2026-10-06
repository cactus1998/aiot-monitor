import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { SSE_HEARTBEAT_MS, SSE_RETRY_MS } from '@aiot/shared'
import type { HubMessage } from '../services/hub.ts'

const StreamQuerySchema = z.object({
  /** Same as the Last-Event-ID header; used when the client opens a fresh EventSource. */
  lastEventId: z.coerce.number().int().nonnegative().optional(),
})

function frame(event: string, data: unknown, id?: number): string {
  return `${id === undefined ? '' : `id: ${id}\n`}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export const streamRoutes: FastifyPluginAsyncZod = async (app) => {
  const { hub } = app.ctx
  const open = new Set<() => void>()
  app.addHook('onClose', async () => {
    for (const close of open) close()
  })

  app.get(
    '/stream',
    {
      schema: {
        tags: ['stream'],
        summary: 'SSE 即時串流（reading、alert、resync 事件）',
        querystring: StreamQuerySchema,
      },
    },
    (request, reply) => {
      const header = request.headers['last-event-id']
      const headerId = typeof header === 'string' && header !== '' ? Number(header) : undefined
      const lastEventId = Number.isFinite(headerId) ? headerId : request.query.lastEventId

      reply.hijack()
      const res = reply.raw
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        // Disable proxy buffering (nginx; IIS ARR has its own setting).
        'x-accel-buffering': 'no',
        'access-control-allow-origin': '*',
      })
      res.write(`retry: ${SSE_RETRY_MS}\n\n`)

      if (lastEventId !== undefined) {
        const missed = hub.since(lastEventId)
        if (missed === null) res.write(frame('resync', { ts: lastEventId }))
        else for (const e of missed) res.write(frame('reading', e, e.ts))
      }

      const unsubscribe = hub.subscribe((message: HubMessage) => {
        if (message.type === 'reading') res.write(frame('reading', message.data, message.data.ts))
        else res.write(frame('alert', message.data))
      })
      const heartbeat = setInterval(() => res.write(': ping\n\n'), SSE_HEARTBEAT_MS)

      const close = () => {
        clearInterval(heartbeat)
        unsubscribe()
        open.delete(close)
        res.end()
      }
      open.add(close)
      request.raw.on('close', close)
    },
  )
}
