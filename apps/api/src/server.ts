import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createAlertsRepo } from './db/alerts.ts'
import { openDatabase, seedMachines } from './db/database.ts'
import { createReadingsRepo } from './db/readings.ts'
import { StreamHub } from './services/hub.ts'
import { Ingestor } from './services/ingest.ts'
import { MACHINES } from '@aiot/simulator'

const config = loadConfig()
const db = openDatabase(config.dbPath)
seedMachines(db, MACHINES)
const hub = new StreamHub()

const ingest = new Ingestor({
  readings: createReadingsRepo(db),
  alerts: createAlertsRepo(db),
  hub,
  seed: config.seed,
  backfillHours: config.backfillHours,
  writeIntervalSec: config.writeIntervalSec,
  retentionHours: config.retentionHours,
  log: (message) => console.log(`[ingest] ${message}`),
})
ingest.init()

const app = await buildApp({
  db,
  hub,
  live: ingest,
  corsOrigin: config.corsOrigin,
  logger: { level: 'info' },
})

ingest.start()
await app.listen({ port: config.port, host: config.host })
console.log(`[api] database ${config.dbPath}`)
console.log(`[api] docs     http://${config.host}:${config.port}/api/docs`)

const shutdown = async () => {
  ingest.stop()
  await app.close()
  db.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
