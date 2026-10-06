import type { DatabaseSync } from 'node:sqlite'
import type {
  MachineStatus,
  MetricKey,
  Reading,
  ReadingSort,
  ReadingsCsvQuery,
  ReadingsQueryParsed,
  ReadingsResponse,
  SeriesPoint,
} from '@aiot/shared'
import { bucketSize, METRICS } from '@aiot/shared'
import { transaction } from './database.ts'

interface ReadingRow {
  machine_id: string
  ts: number
  temperature: number | null
  vibration: number | null
  spindle_load: number | null
  rpm: number | null
  status: MachineStatus
  output: number
  good: number
}

export const toReading = (row: ReadingRow): Reading => ({
  machineId: row.machine_id,
  ts: row.ts,
  temperature: row.temperature,
  vibration: row.vibration,
  spindleLoad: row.spindle_load,
  rpm: row.rpm,
  status: row.status,
  output: row.output,
  good: row.good,
})

/** Whitelisted ORDER BY clause; user input never reaches the SQL string directly. */
function orderBy(sort: ReadingSort): string {
  const desc = sort.startsWith('-')
  const field = (desc ? sort.slice(1) : sort) as 'ts' | MetricKey
  const column = field === 'ts' ? 'ts' : METRICS[field].column
  const dir = desc ? 'DESC' : 'ASC'
  return field === 'ts'
    ? `ts ${dir}, machine_id ASC`
    : `${column} ${dir} NULLS LAST, ts DESC, machine_id ASC`
}

const FILTER = `ts >= :from AND ts < :to AND (:machineId IS NULL OR machine_id = :machineId)`

export function createReadingsRepo(db: DatabaseSync) {
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO readings
       (machine_id, ts, temperature, vibration, spindle_load, rpm, status, output, good)
     VALUES (:machineId, :ts, :temperature, :vibration, :spindleLoad, :rpm, :status, :output, :good)`,
  )
  const countAllStmt = db.prepare('SELECT COUNT(*) AS n FROM readings')
  const latestTsStmt = db.prepare('SELECT MAX(ts) AS ts FROM readings')
  const latestPerMachineStmt = db.prepare(
    `SELECT r.* FROM readings r
     JOIN (SELECT machine_id, MAX(ts) AS ts FROM readings GROUP BY machine_id) m
       ON r.machine_id = m.machine_id AND r.ts = m.ts
     ORDER BY r.machine_id`,
  )
  const countStmt = db.prepare(`SELECT COUNT(*) AS n FROM readings WHERE ${FILTER}`)
  const rangeStmt = db.prepare(`SELECT * FROM readings WHERE ${FILTER} ORDER BY machine_id, ts`)
  const csvStmt = db.prepare(`SELECT * FROM readings WHERE ${FILTER} ORDER BY ts, machine_id`)
  const deleteStmt = db.prepare('DELETE FROM readings WHERE ts < ?')
  const pageStmts = new Map<ReadingSort, ReturnType<DatabaseSync['prepare']>>()
  const seriesStmts = new Map<MetricKey, ReturnType<DatabaseSync['prepare']>>()

  return {
    insertMany(readings: readonly Reading[]): void {
      transaction(db, () => {
        for (const r of readings) insertStmt.run({ ...r })
      })
    },

    count(): number {
      return (countAllStmt.get() as { n: number }).n
    },

    latestTs(): number | null {
      return (latestTsStmt.get() as { ts: number | null }).ts
    },

    latestPerMachine(): Reading[] {
      return (latestPerMachineStmt.all() as unknown as ReadingRow[]).map(toReading)
    },

    /** All readings in range, ordered by machine then time. */
    range(query: { from: number; to: number; machineId?: string | undefined }): Reading[] {
      const params = { from: query.from, to: query.to, machineId: query.machineId ?? null }
      return (rangeStmt.all(params) as unknown as ReadingRow[]).map(toReading)
    },

    page(query: ReadingsQueryParsed): ReadingsResponse {
      const params = { from: query.from, to: query.to, machineId: query.machineId ?? null }
      let stmt = pageStmts.get(query.sort)
      if (!stmt) {
        stmt = db.prepare(
          `SELECT * FROM readings WHERE ${FILTER} ORDER BY ${orderBy(query.sort)} LIMIT :limit OFFSET :offset`,
        )
        pageStmts.set(query.sort, stmt)
      }
      const total = (countStmt.get(params) as { n: number }).n
      const rows = stmt.all({
        ...params,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      }) as unknown as ReadingRow[]
      return { items: rows.map(toReading), total, page: query.page, pageSize: query.pageSize }
    },

    /** Stream rows for CSV export without loading the whole range into memory. */
    *iterate(query: ReadingsCsvQuery): Generator<Reading> {
      const params = { from: query.from, to: query.to, machineId: query.machineId ?? null }
      for (const row of csvStmt.iterate(params)) yield toReading(row as unknown as ReadingRow)
    },

    /** Fixed-width time buckets computed in SQL. */
    series(
      machineId: string,
      metric: MetricKey,
      from: number,
      to: number,
      points: number,
    ): { bucketMs: number; rawCount: number; points: SeriesPoint[] } {
      let stmt = seriesStmts.get(metric)
      if (!stmt) {
        const col = METRICS[metric].column
        stmt = db.prepare(
          // JS numbers bind as REAL, so cast to get integer bucket indexes.
          `SELECT CAST((ts - :from) / :bucket AS INTEGER) AS b, COUNT(*) AS n,
                  AVG(${col}) AS avg, MIN(${col}) AS min, MAX(${col}) AS max
           FROM readings
           WHERE machine_id = :machineId AND ts >= :from AND ts < :to
           GROUP BY b ORDER BY b`,
        )
        seriesStmts.set(metric, stmt)
      }
      const bucketMs = bucketSize(from, to, points)
      const rows = stmt.all({ machineId, from, to, bucket: bucketMs }) as unknown as {
        b: number
        n: number
        avg: number | null
        min: number | null
        max: number | null
      }[]
      return {
        bucketMs,
        rawCount: rows.reduce((sum, r) => sum + r.n, 0),
        points: rows.map((r) => ({
          ts: from + r.b * bucketMs,
          avg: r.avg,
          min: r.min,
          max: r.max,
        })),
      }
    },

    deleteBefore(ts: number): number {
      return Number(deleteStmt.run(ts).changes)
    },
  }
}

export type ReadingsRepo = ReturnType<typeof createReadingsRepo>
