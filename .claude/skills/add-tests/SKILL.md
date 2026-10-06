---
name: add-tests
description: 為 aiot-monitor 的某個 workspace 或 PRD 補測試：shared / simulator 純函式、api 路由（fastify.inject）、web 元件與 composable（@vue/test-utils），必要時加 Playwright E2E。使用時機：/add-tests <slug 或 workspace>，或使用者說「幫這個功能寫測試」「補測試」。
argument-hint: <PRD slug | web | api | shared | simulator>
---

# 加測試

面試時，有測試的 demo 比沒有測試的更有說服力。測試要驗證行為，不是驗證實作細節。

## 位置

| workspace | 測試位置 | 工具 |
|-----------|----------|------|
| `packages/shared`、`packages/simulator` | `src/**/*.test.ts` | Vitest |
| `apps/api` | `src/**/*.test.ts` | Vitest + `app.inject()`，資料庫用 `:memory:` |
| `apps/web` | `src/**/__tests__/*.test.ts` | Vitest + @vue/test-utils + jsdom |
| E2E | `e2e/*.spec.ts` | Playwright，web 以 mock 模式啟動 |

workspace 尚未設定 Vitest 時，依 `docs/PRD-test-infra.md` 設定；該 PRD 還沒完成時先告知使用者，不要自行發明另一套設定。

## 撰寫

有 `docs/PRD-<slug>.md` 時，每條 AC 與 EC 至少對應一個測試，測試名稱或註解標上編號（例如 `// EC-03`）。

優先順序：
1. **純函式**（shared 的轉換、OEE、降採樣；simulator 的產生器）：涵蓋正常、邊界值（空陣列、單一點、null 值、極大值）與錯誤輸入。simulator 一律指定 seed，斷言可重現。
2. **API 路由**：正常回應符合 shared schema（用 `schema.parse` 斷言）、400 驗證錯誤、404、分頁邊界、時間範圍上限。
3. **composable / 元件**：mock `ApiClient` 介面而不是 mock `fetch`；測 loading → success / empty / error、重試、AbortController 競態（較舊的請求較晚回來）。
4. **時間與即時**：`vi.useFakeTimers()` 測心跳、重連退避與輪詢切換；SSE 用假的 EventSource。
5. **清理**：unmount 後確認 ECharts dispose、EventSource close、timer 清除。

原則：
- 測試名稱描述行為，例如 `it('aborts the previous request when filters change')`。
- 不測 Vue / ECharts 本身，不做大量 snapshot；圖表測「傳給 ECharts 的 option」即可。
- 每個測試獨立，不共用可變狀態或資料庫檔案。

## 驗證

執行該 workspace 的 `npm run test:run -w <workspace>`，再執行 `npm run typecheck`。回報測試數量與涵蓋的 AC / EC。發現產品程式碼有 bug 時先回報並詢問，不要為了讓測試通過而改斷言。
