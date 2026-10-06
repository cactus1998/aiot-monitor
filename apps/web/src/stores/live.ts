import { defineStore } from 'pinia'
import { computed, ref, shallowRef, triggerRef } from 'vue'
import type { Alert, Machine, MachinesResponse, Reading, ReadingEvent } from '@aiot/shared'
import { statusDistribution } from '@aiot/shared'
import type { ConnectionState } from '@/api/live-connection.ts'

/** One hour of per-second points per machine. */
export const BUFFER_SIZE = 3600
const RECENT_ALERTS = 20

/**
 * Cross-page live state: machine list, latest reading and a fixed-size ring
 * buffer per machine. Buffers are not deep-reactive; `frame` bumps at most
 * once per animation frame, and not at all while the tab is hidden (EC-06).
 */
export const useLiveStore = defineStore('live', () => {
  const machines = shallowRef<Machine[]>([])
  const latest = shallowRef<Record<string, Reading>>({})
  const buffers = new Map<string, Reading[]>()
  const connection = ref<ConnectionState>('connecting')
  const lastTs = ref<number | null>(null)
  const openAlerts = ref(0)
  const recentAlerts = shallowRef<Alert[]>([])
  /** Increments when charts should redraw from the buffers. */
  const frame = ref(0)
  /** Increments when the stream gap was too large and pages should reload. */
  const resyncs = ref(0)
  let framePending = false

  const statusCounts = computed(() =>
    statusDistribution(Object.values(latest.value).map((r) => r.status)),
  )

  function requestFrame(): void {
    if (framePending) return
    if (typeof document !== 'undefined' && document.hidden) return
    framePending = true
    const raf =
      globalThis.requestAnimationFrame ?? ((cb: FrameRequestCallback) => setTimeout(cb, 16))
    raf(() => {
      framePending = false
      frame.value += 1
    })
  }

  function setMachines(res: MachinesResponse): void {
    machines.value = res.items.map(({ latest: _latest, ...m }) => m)
    const next = { ...latest.value }
    for (const item of res.items) {
      if (item.latest && (next[item.id]?.ts ?? 0) <= item.latest.ts) {
        next[item.id] = item.latest
        push(item.latest)
      }
    }
    latest.value = next
    requestFrame()
  }

  function push(reading: Reading): void {
    let buffer = buffers.get(reading.machineId)
    if (!buffer) buffers.set(reading.machineId, (buffer = []))
    const last = buffer.at(-1)
    if (last && last.ts >= reading.ts) return
    buffer.push(reading)
    if (buffer.length > BUFFER_SIZE) buffer.splice(0, buffer.length - BUFFER_SIZE)
  }

  function applyTick(event: ReadingEvent): void {
    const next = { ...latest.value }
    for (const r of event.readings) {
      next[r.machineId] = r
      push(r)
    }
    latest.value = next
    lastTs.value = event.ts
    requestFrame()
  }

  function applyAlert(alert: Alert): void {
    recentAlerts.value = [alert, ...recentAlerts.value].slice(0, RECENT_ALERTS)
    openAlerts.value += 1
  }

  function setOpenAlerts(count: number): void {
    openAlerts.value = count
  }

  function resync(): void {
    buffers.clear()
    resyncs.value += 1
  }

  function buffer(machineId: string): readonly Reading[] {
    return buffers.get(machineId) ?? []
  }

  function onVisible(): void {
    requestFrame()
    triggerRef(latest)
  }

  function reset(): void {
    machines.value = []
    latest.value = {}
    buffers.clear()
    recentAlerts.value = []
    openAlerts.value = 0
    lastTs.value = null
    connection.value = 'connecting'
  }

  return {
    machines,
    latest,
    connection,
    lastTs,
    openAlerts,
    recentAlerts,
    frame,
    resyncs,
    statusCounts,
    setMachines,
    applyTick,
    applyAlert,
    setOpenAlerts,
    resync,
    buffer,
    onVisible,
    reset,
  }
})
