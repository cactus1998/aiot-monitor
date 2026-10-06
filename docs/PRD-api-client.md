# PRD：前端 API 存取層（api-client）

## 目標

元件與 composable 只依賴 `ApiClient` 介面，不直接呼叫 `fetch`。同一個介面有 http（真實 API）與 mock（瀏覽器內模擬）兩種實作，沒有後端也能完整展示。

## 範圍

- **Must**：
  - `apps/web/src/api/types.ts`：`ApiClient` 介面，所有方法接受 `AbortSignal`。
  - `httpClient`：`fetch` + 10 秒逾時（`AbortSignal.any` 合併使用者 signal 與 timeout）、非 2xx 轉成 `ApiRequestError`（含 `code`、`status`）、回應以 shared 的 `ResponseSchema.parse` 驗證。
  - `mockClient`：瀏覽器內執行 simulator，資料存在記憶體（不寫 localStorage）：
    - 啟動時產生 24 小時、每分鐘一筆；之後每秒 tick，每 10 秒保留一筆，與後端相同。
    - 分頁、排序、分桶、總覽、告警規則與告警判定都用 shared 的同一套函式，結果語意與後端一致。
    - 模擬 150–400ms 延遲，讓 loading 狀態看得到。
  - `openStream(lastEventId?)`：回傳類 `EventSource` 物件；http 用原生 `EventSource`，mock 用計時器發出相同事件。
  - 模式：`VITE_API_MODE=http | mock`（`npm run dev:mock` 使用 mock）。http 模式下 `/api/health` 失敗時，頁面顯示提示與「切換為模擬資料」按鈕；切換只在記憶體，重新整理後回到設定值。
- **Won't**：請求快取、重試佇列。

## 資料與介面

```ts
interface ApiClient {
  readonly mode: 'http' | 'mock'
  health(signal?): Promise<HealthResponse>
  getMachines(signal?): Promise<MachinesResponse>
  getSeries(machineId, query: SeriesQuery, signal?): Promise<SeriesResponse>
  getReadings(query: ReadingsQuery, signal?): Promise<ReadingsResponse>
  exportReadingsCsv(query: ReadingsCsvQuery, signal?): Promise<Blob>
  getOverview(signal?): Promise<OverviewResponse>
  listAlertRules / createAlertRule / updateAlertRule / deleteAlertRule
  listAlerts(query: AlertsQuery, signal?) / ackAlert(id, signal?)
  openStream(lastEventId?: number): LiveEventSource
}
```

## 邊界情況

| 編號 | 情境 | 預期行為 |
|------|------|----------|
| EC-01 | 請求被 abort | 丟出 `AbortError`，呼叫端忽略，不顯示錯誤 |
| EC-02 | 超過 10 秒 | 丟出 `ApiRequestError`（code `TIMEOUT`），訊息「請求逾時」 |
| EC-03 | 回應不符 schema | 丟出 `ApiRequestError`（code `INVALID_RESPONSE`） |
| EC-04 | API 回 4xx / 5xx | 使用回應中的 `error.message` |

## 驗收標準

- [x] AC-01：mock 與 http 的同一查詢回傳相同結構，皆通過 schema 驗證。
- [x] AC-02：http 模式且 API 未啟動時，顯示提示並可一鍵切換 mock，標示「模擬資料」（總規格 AC-06）。
- [x] AC-03：EC-01 ~ EC-04 有單元測試。

## 開發紀錄

- 2026-10-06：完成。mock 的告警判定與後端共用 `evaluateRule`，總覽共用 `buildOverview`。
