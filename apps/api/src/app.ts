import type { DatabaseSync } from 'node:sqlite'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify, { type FastifyServerOptions } from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { MACHINES } from '@aiot/simulator'
import { createAlertsRepo } from './db/alerts.ts'
import { openDatabase, seedMachines } from './db/database.ts'
import { createMachinesRepo } from './db/machines.ts'
import { createReadingsRepo } from './db/readings.ts'
import { registerErrorHandlers } from './errors.ts'
import { alertRoutes } from './routes/alerts.ts'
import { machineRoutes } from './routes/machines.ts'
import { readingRoutes } from './routes/readings.ts'
import { statsRoutes } from './routes/stats.ts'
import { streamRoutes } from './routes/stream.ts'
import { StreamHub } from './services/hub.ts'
import type { LiveSource } from './services/ingest.ts'

export interface AppOptions {
  dbPath?: string
  db?: DatabaseSync
  hub?: StreamHub
  live?: LiveSource
  now?: () => number
  corsOrigin?: string | boolean
  logger?: FastifyServerOptions['logger']
}

export function createContext(options: AppOptions) {
  const db = options.db ?? openDatabase(options.dbPath ?? ':memory:')
  seedMachines(db, MACHINES)
  return {
    db,
    machines: createMachinesRepo(db),
    readings: createReadingsRepo(db),
    alerts: createAlertsRepo(db),
    hub: options.hub ?? new StreamHub(),
    live: options.live ?? { latest: () => null },
    now: options.now ?? Date.now,
  }
}

export type AppContext = ReturnType<typeof createContext>

declare module 'fastify' {
  interface FastifyInstance {
    ctx: AppContext
  }
}

export async function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false }).withTypeProvider<ZodTypeProvider>()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.decorate('ctx', createContext(options))
  registerErrorHandlers(app)

  await app.register(cors, { origin: options.corsOrigin ?? true })
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'AIoT Monitor API',
        description: '模擬機台讀值、時間序列、總覽統計、告警與 SSE 即時串流。',
        version: '0.1.0',
      },
    },
    transform: jsonSchemaTransform,
  })
  await app.register(swaggerUi, { routePrefix: '/api/docs' })

  await app.register(
    async (api) => {
      await api.register(machineRoutes)
      await api.register(readingRoutes)
      await api.register(statsRoutes)
      await api.register(alertRoutes)
      await api.register(streamRoutes)
    },
    { prefix: '/api' },
  )

  app.addHook('onClose', async () => {
    if (!options.db) app.ctx.db.close()
  })
  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
