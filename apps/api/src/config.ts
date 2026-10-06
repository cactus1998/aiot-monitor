import { fileURLToPath } from 'node:url'

const num = (value: string | undefined, fallback: number) => {
  const n = Number(value)
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback
}

export interface Config {
  port: number
  host: string
  dbPath: string
  seed: number
  backfillHours: number
  writeIntervalSec: number
  retentionHours: number
  corsOrigin: string | boolean
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: num(env.PORT, 3100),
    host: env.HOST ?? '127.0.0.1',
    dbPath: env.DB_PATH ?? fileURLToPath(new URL('../data/aiot.db', import.meta.url)),
    seed: num(env.SEED, 42),
    backfillHours: num(env.BACKFILL_HOURS, 24),
    writeIntervalSec: num(env.WRITE_INTERVAL_SEC, 10),
    retentionHours: num(env.RETENTION_HOURS, 24),
    corsOrigin: env.CORS_ORIGIN ?? true,
  }
}
