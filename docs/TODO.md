# 開發 TODO

總規格見 [PRD-aiot-monitor.md](PRD-aiot-monitor.md)。每一項開工前先用 `/feature-spec <slug>` 寫出 `docs/PRD-<slug>.md`（已存在就直接用），完成後勾選該 PRD 的驗收標準並更新下方狀態。

順序依「面試必考 → 加分」排列：第一、二階段完成就能應付筆試考點與作品集展示，第三階段之後是加分項。

後端項目（06、07、09、16）完成後，以白話向開發者說明資料流並回答問題，再進下一項（見總規格「協作方式」）。

## 第一階段：基礎建設

| # | PRD | 內容 | 基於 | 狀態 |
|---|-----|------|------|------|
| 01 | [monorepo-setup](PRD-monorepo-setup.md) | npm workspaces：`apps/web`（Vite vue-ts）、`apps/api`（Fastify）、`packages/shared`、`packages/simulator`；共用 tsconfig、ESLint flat config、Prettier；`npm run dev` 同時啟動 web 與 api | — | 完成 |
| 02 | [test-infra](PRD-test-infra.md) | 各 workspace 導入 Vitest；api 用 `fastify.inject()`；Playwright 設定；spike 確認 Vitest 能載入 `node:sqlite` | 01 | 完成 |
| 03 | [ci-pipeline](PRD-ci-pipeline.md) | GitHub Actions：lint、typecheck、unit test、build、E2E | 02 | 完成 |

## 第二階段：核心功能（面試必考）

| # | PRD | 內容 | 基於 | 狀態 |
|---|-----|------|------|------|
| 04 | [shared-schema](PRD-shared-schema.md) | 指標定義、zod schema、API 型別、OEE 與資料轉換純函式（array 方法），附完整單元測試 | 02 | 完成 |
| 05 | [simulator](PRD-simulator.md) | seeded PRNG、8 台機台設定檔、正常波動與異常注入、可在 Node 與瀏覽器執行 | 04 | 完成 |
| 06 | [storage](PRD-storage.md) | `node:sqlite` schema 與 repository 層；DB 檔 `apps/api/data/aiot.db`；啟動時回填 24 小時（每分鐘一筆）、即時讀值每 10 秒寫入、保留 24 小時清理；WAL 與 `(machine_id, ts)` 索引 | 05 | 完成 |
| 07 | [rest-api](PRD-rest-api.md) | machines、readings（分頁排序）、series（分桶降採樣）、stats/overview、CSV 匯出；統一錯誤格式；查詢範圍上限 24 小時 | 06 | 完成 |
| 08 | [api-client](PRD-api-client.md) | `ApiClient` 介面、http 與 mock 兩種實作、zod 驗證回應、AbortController、API 無回應時切換 mock | 07 | 完成 |
| 09 | [sse-stream](PRD-sse-stream.md) | 後端 `/api/stream`（每秒推播）、心跳、`Last-Event-ID` 補資料；前端連線狀態機（即時 / 重連 / 輪詢 / 模擬資料） | 07、08 | 完成 |
| 10 | [chart-kit](PRD-chart-kit.md) | ECharts + vue-echarts 按需引入；`LineChart`、`PieChart`、`GaugeChart`、`BarChart`；主題 token、ResizeObserver、dispose、空狀態、表格替代檢視 | 08 | 完成 |
| 11 | [data-table](PRD-data-table.md) | 泛型 `DataTable`：欄位定義、伺服器端分頁排序、loading / 空 / 錯誤狀態、鍵盤操作 | 08 | 完成 |
| 12 | [overview-page](PRD-overview-page.md) | 總覽：KPI 卡片、狀態圓餅圖、機台卡片即時更新 | 09、10 | 完成 |
| 13 | [machine-detail](PRD-machine-detail.md) | 機台詳情：即時多指標折線圖、1h / 6h / 24h、dataZoom、閾值線、事件列表 | 09、10 | 完成 |
| 14 | [history-query](PRD-history-query.md) | 歷史查詢：篩選表單、表格與折線圖連動、URL query 同步、CSV 匯出（**筆試題原型**） | 10、11 | 完成 |

## 第三階段：加分項

| # | PRD | 內容 | 基於 | 狀態 |
|---|-----|------|------|------|
| 16 | [alerts](PRD-alerts.md) | 告警規則 CRUD（寫入 DB）、告警判定、ack、SSE 推播、告警中心頁 | 09、11 | 完成 |
| 17 | [trend-forecast](PRD-trend-forecast.md) | 線性迴歸趨勢線與「預計達到閾值時間」，詳情頁顯示保養建議 | 13 | 完成 |
| 18 | [array-lab](PRD-array-lab.md) | `/lab/array`：用即時機台資料示範 `map`、`filter`、`reduce`、`Object.groupBy`、`toSorted`、`flatMap`、`findLast`、`some` / `every`，左程式碼右結果 | 04、08 | 完成 |
| 19 | [about-page](PRD-about-page.md) | `/about`：架構圖、資料流、資料儲存設計（回答「資料存在哪」）、技術選型 | 14 | 完成 |
| 20 | [chart-perf](PRD-chart-perf.md) | （Could）LTTB 降採樣、背景暫停重繪；頁面顯示原始 / 繪製點數與耗時，僅作技能示範（Web Worker 不做） | 13 | 完成 |
| 21 | [ui-polish](PRD-ui-polish.md) | 深色主題、RWD 400px、圖表 a11y、`prefers-reduced-motion` | 14 | 完成 |
| 23 | [kendo-compare](PRD-kendo-compare.md) | （Could）Kendo UI for Vue Grid 對照頁，先確認授權 | 14 | 未做（待確認授權） |
| 24 | [openapi](PRD-openapi.md) | （Could）`@fastify/swagger` 產生 API 文件 | 07 | 完成 |

## 暫緩：部署（部署位置決定後再處理）

| # | PRD | 內容 | 基於 | 狀態 |
|---|-----|------|------|------|
| 15 | [deploy](PRD-deploy.md) | 前端部署（GitHub Pages 或 kentfolio.dev，mock 模式）、API 部署雲端主機、portfolio 首頁加入連結 | 03、14 | 暫緩 |
| 22 | [iis-deploy](PRD-iis-deploy.md) | `deploy/iis/web.config`：URL Rewrite SPA fallback、ARR 反向代理 `/api`、SSE 關閉緩衝；部署文件 | 15 | 暫緩 |

## 第四階段：面試準備

- [ ] 25 `docs/interview/array-methods.md`：常考 array 方法速查與手寫範例（含 `reduce` 實作 `groupBy`、手寫 `map` / `filter` polyfill、`sort` 比較函式陷阱、改變原陣列與否對照）
- [ ] 26 `docs/interview/framework-tradeoffs.md`：Vue 3 vs React vs jQuery + Kendo UI 優缺點、本專案選型理由、圖表套件選型（ECharts vs Chart.js / ApexCharts / Highcharts）、改用 C# ASP.NET Core 後端的差異
- [ ] 27 `docs/interview/data-storage.md`：「資料存在哪裡」完整回答（SQLite schema、索引、24 小時保留期、每 10 秒寫入的取捨、降採樣、為何不用 localStorage、正式環境改用 TimescaleDB / InfluxDB 的考量）
- [ ] 28 `docs/interview/demo-script.md`：3 分鐘 demo 講稿，依考點對照表的順序
- [ ] 29 用 `/written-test-drill` 完成三次一小時模擬筆試（API → 表格 + 折線圖），每次記錄耗時與卡關點
- [ ] 30 用 `/interview-notes` 為 storage、rest-api、sse-stream、history-query 產生講稿

## 需要使用者處理

- [ ] 決定部署位置（15、22 暫緩中）
- [ ] 確認 Kendo UI for Vue 免費元件授權範圍（23）
