import type {
  Alert,
  AlertRule,
  AlertRuleBody,
  AlertRulePatch,
  AlertRulesResponse,
  AlertsQuery,
  AlertsResponse,
  HealthResponse,
  MachinesResponse,
  OverviewResponse,
  ReadingsCsvQuery,
  ReadingsQuery,
  ReadingsResponse,
  SeriesQuery,
  SeriesResponse,
} from '@aiot/shared'

export type ApiMode = 'http' | 'mock'

/** Subset of EventSource used by the app; native EventSource satisfies it. */
export interface LiveEventSource {
  readonly readyState: number
  onopen: ((this: never, ev: Event) => unknown) | null
  onerror: ((this: never, ev: Event) => unknown) | null
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void
  close(): void
}

export interface ApiClient {
  readonly mode: ApiMode
  health(signal?: AbortSignal): Promise<HealthResponse>
  getMachines(signal?: AbortSignal): Promise<MachinesResponse>
  getSeries(machineId: string, query: SeriesQuery, signal?: AbortSignal): Promise<SeriesResponse>
  getReadings(query: ReadingsQuery, signal?: AbortSignal): Promise<ReadingsResponse>
  exportReadingsCsv(query: ReadingsCsvQuery, signal?: AbortSignal): Promise<Blob>
  getOverview(signal?: AbortSignal): Promise<OverviewResponse>
  listAlertRules(signal?: AbortSignal): Promise<AlertRulesResponse>
  createAlertRule(body: AlertRuleBody, signal?: AbortSignal): Promise<AlertRule>
  updateAlertRule(id: number, patch: AlertRulePatch, signal?: AbortSignal): Promise<AlertRule>
  deleteAlertRule(id: number, signal?: AbortSignal): Promise<void>
  listAlerts(query: AlertsQuery, signal?: AbortSignal): Promise<AlertsResponse>
  ackAlert(id: number, signal?: AbortSignal): Promise<Alert>
  /** Open the live stream; `lastEventId` resumes after a gap. */
  openStream(lastEventId?: number): LiveEventSource
}
