import type { DatabaseSync } from 'node:sqlite'
import type { Machine } from '@aiot/shared'
import { MachineSchema } from '@aiot/shared'

interface MachineRow {
  id: string
  name: string
  type: string
  line: string
  ideal_cycle_sec: number
}

const toMachine = (row: MachineRow): Machine =>
  MachineSchema.parse({
    id: row.id,
    name: row.name,
    type: row.type,
    line: row.line,
    idealCycleSec: row.ideal_cycle_sec,
  })

export function createMachinesRepo(db: DatabaseSync) {
  const listStmt = db.prepare('SELECT * FROM machines ORDER BY id')
  const getStmt = db.prepare('SELECT * FROM machines WHERE id = ?')
  return {
    list(): Machine[] {
      return (listStmt.all() as unknown as MachineRow[]).map(toMachine)
    },
    get(id: string): Machine | undefined {
      const row = getStmt.get(id) as unknown as MachineRow | undefined
      return row ? toMachine(row) : undefined
    },
  }
}

export type MachinesRepo = ReturnType<typeof createMachinesRepo>
