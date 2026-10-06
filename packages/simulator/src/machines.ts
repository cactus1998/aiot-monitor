import type { Machine, MachineType } from '@aiot/shared'

export interface MachineProfile {
  temperature: number
  vibration: number
  spindleLoad: number
  rpm: number
}

/** Normal operating point of each machine type. */
export const PROFILES: Record<MachineType, MachineProfile> = {
  cnc: { temperature: 58, vibration: 2.2, spindleLoad: 58, rpm: 8000 },
  molding: { temperature: 66, vibration: 1.4, spindleLoad: 46, rpm: 180 },
  grinding: { temperature: 52, vibration: 3.1, spindleLoad: 62, rpm: 3200 },
}

export const MACHINES: Machine[] = [
  { id: 'CNC-01', name: 'CNC 加工機 01', type: 'cnc', line: 'A', idealCycleSec: 45 },
  { id: 'CNC-02', name: 'CNC 加工機 02', type: 'cnc', line: 'A', idealCycleSec: 45 },
  { id: 'CNC-03', name: 'CNC 加工機 03', type: 'cnc', line: 'A', idealCycleSec: 45 },
  { id: 'MLD-01', name: '射出成型機 01', type: 'molding', line: 'B', idealCycleSec: 30 },
  { id: 'MLD-02', name: '射出成型機 02', type: 'molding', line: 'B', idealCycleSec: 30 },
  { id: 'MLD-03', name: '射出成型機 03', type: 'molding', line: 'B', idealCycleSec: 30 },
  { id: 'GRD-01', name: '研磨機 01', type: 'grinding', line: 'C', idealCycleSec: 60 },
  { id: 'GRD-02', name: '研磨機 02', type: 'grinding', line: 'C', idealCycleSec: 60 },
]
