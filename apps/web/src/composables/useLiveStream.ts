import { onScopeDispose, watch } from 'vue'
import { errorMessage } from '@/api'
import { LiveConnection } from '@/api/live-connection.ts'
import { useConnectionStore } from '@/stores/connection.ts'
import { useLiveStore } from '@/stores/live.ts'

/**
 * The single app-wide SSE connection. Writes into the live store; components
 * read from the store and never open their own EventSource.
 */
export function useLiveStream(): void {
  const conn = useConnectionStore()
  const live = useLiveStore()
  let connection: LiveConnection | null = null

  async function loadMachines(): Promise<void> {
    const client = conn.client
    if (!client) return
    try {
      live.setMachines(await client.getMachines())
      const alerts = await client.listAlerts({ status: 'open', limit: 1 })
      live.setOpenAlerts(alerts.openCount)
    } catch (error) {
      console.warn('[live] 讀取機台失敗', errorMessage(error))
    }
  }

  function start(): void {
    connection?.stop()
    live.reset()
    const client = conn.client
    if (!client) return
    void loadMachines()
    connection = new LiveConnection({
      open: (lastEventId) => client.openStream(lastEventId),
      poll: loadMachines,
      onReading: (event) => live.applyTick(event),
      onAlert: (alert) => live.applyAlert(alert),
      onResync: () => {
        live.resync()
        void loadMachines()
      },
      onState: (state) => {
        live.connection = state
      },
    })
    connection.start()
  }

  const onVisibility = () => {
    if (!document.hidden) live.onVisible()
  }
  document.addEventListener('visibilitychange', onVisibility)

  watch(() => conn.client, start, { immediate: true })

  onScopeDispose(() => {
    connection?.stop()
    document.removeEventListener('visibilitychange', onVisibility)
  })
}
