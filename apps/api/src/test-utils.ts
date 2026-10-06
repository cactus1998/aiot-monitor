import { HOUR, MINUTE } from '@aiot/shared'
import { createSimulator, generateHistory } from '@aiot/simulator'
import { buildApp } from './app.ts'

/** Fixed clock for tests: 2026-10-06 12:00 Taipei. */
export const NOW = Date.UTC(2026, 9, 6, 4, 0)

/** App on an in-memory database with `hours` of one-minute readings ending at NOW. */
export async function createTestApp(hours = 2) {
  const app = await buildApp({ dbPath: ':memory:', now: () => NOW })
  const from = NOW - hours * HOUR
  const sim = createSimulator({ seed: 1, startTs: from, anomalyRatePerHour: 0, dropoutRate: 0 })
  const history = generateHistory(sim, from, NOW, MINUTE)
  app.ctx.readings.insertMany(history)
  app.ctx.alerts.seedDefaultRules()
  return { app, history, from }
}
