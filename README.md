# AIoT Monitor

模擬工廠機台每秒產生的感測資料，由 Node.js API 收集並儲存在 SQLite，前端以 Vue 3 + ECharts 呈現即時監控、歷史查詢、告警與趨勢預測。

**Demo：<https://kentfolio.dev/aiot-monitor/>**（前端展示版，資料由瀏覽器內的模擬器產生，不需後端）

- 前端：Vue 3、TypeScript、Vite、Pinia、Vue Router、ECharts（vue-echarts，按需引入）
- 後端：Node.js 22、Fastify、`node:sqlite`、zod、SSE、OpenAPI
- 共用：`packages/shared`（型別、schema、資料轉換）、`packages/simulator`（機台模擬器）
- 測試：Vitest、@vue/test-utils、Playwright

## 狀態

第一至三階段功能已完成；前端展示版已部署，API 雲端部署暫緩。資料量刻意保持小：資料庫保留 24 小時、約 7 萬筆以內。規格見 [docs/PRD-aiot-monitor.md](docs/PRD-aiot-monitor.md)，開發順序見 [docs/TODO.md](docs/TODO.md)。

## 開發方式：規格驅動的 AI 協作

本專案以 AI 輔助開發（Claude Code）。我的重心在**規劃與把關**：先把需求拆成可驗收的規格，再把開發流程與程式規範寫成 skill，讓 AI 每一次都照同一套流程產出，最後由測試與 CI 驗證。

### 1. 規格先行：總規格 → 功能 PRD → TODO

- [總規格](docs/PRD-aiot-monitor.md)定義系統目標、架構、資料量與保存策略，拆成 22 份功能 PRD（[docs/](docs/README.md)）。
- 每份 PRD 用同一個格式：目標、MoSCoW 範圍（Must / Should / Could / Won't）、使用情境、狀態流程、API 介面、邊界情況（EC）、Given-When-Then 驗收標準（AC）。
- [TODO](docs/TODO.md) 依相依關係分三個階段排序，每一項標明「基於」哪些前置項目，先打基礎建設與共用 schema，再做頁面。
- 驗收時把每個邊界情況對應到實際的測試檔，記錄在 PRD 裡；沒驗證到的項目照實標示「尚未驗證」。
- 範圍調整寫進變更紀錄：例如資料保留由 7 天縮為 24 小時、即時讀值改為每 10 秒寫入一筆，讓本機啟動與測試維持在數秒內。

### 2. 流程寫成 skill：讓 AI 照規矩做事

`.claude/skills/` 把「怎麼做」固定下來，不必每次重新交代：

| 階段 | skill | 規範的內容 |
|------|-------|-----------|
| 規劃 | `feature-spec` | 實作前先產出上述格式的 PRD |
| 實作 | `api-endpoint` | 新增端點一律依 shared zod schema → Fastify 路由 → 前端 `ApiClient`（http 與 mock 兩種實作）的順序，前後端不會不同步 |
| 實作 | `new-page`、`chart-panel`、`vue-conventions` | 頁面結構、URL query 同步、圖表封裝與 ECharts 按需引入、Vue / Pinia 撰寫規範 |
| 品質 | `add-tests`、`perf-audit`、`verify-and-stop` | 各層測試寫法、打包體積與繪製效能量測、只驗收不擴大範圍 |
| 修改 | `investigate-first`、`surgical-patch`、`safe-refactor` | 先找原因再動手、在最小範圍修 bug、重構時保持行為不變 |
| 交付 | `git-commit`、`deploy-check` | lint、型別檢查、測試通過才提交；上線前檢查 base 路徑與路由 |

### 3. 我做的技術決策

- 前後端共用 zod schema，API 回應在前端也驗證。
- 即時資料用 SSE，斷線時重連、用 `Last-Event-ID` 補資料，失敗再退回輪詢。
- 伺服器端分桶降採樣，加上前端 LTTB，控制圖表繪製點數。
- 沒有後端時自動切換為瀏覽器內模擬資料，作品隨時可以展示。

### 4. AI 負責的部分

- 依 PRD 與 skill 產生實作程式碼與測試，後端 API 與資料庫層主要由 AI 實作，我負責審查並能說明完整資料流。
- 所有變更都要通過 lint、型別檢查、單元 / 元件 / E2E 測試與 CI 才合併。

## 開發

需要 Node.js 22.13 以上。

```bash
npm install
npm run dev        # API（http://127.0.0.1:3100）+ 前端（http://localhost:5173）
npm run dev:mock   # 只啟動前端，資料由瀏覽器內的模擬器產生
```

5173 被占用時 Vite 會自動改用下一個 port，以終端機顯示的網址為準。

| 頁面 | 網址 |
|------|------|
| 總覽 | `#/` |
| 機台詳情 | `#/machines/CNC-01` |
| 歷史查詢 | `#/history` |
| 告警中心 | `#/alerts` |
| 陣列方法實驗室 | `#/lab/array` |
| 架構說明 | `#/about` |
| API 文件 | `/api/docs` |

資料存在 `apps/api/data/aiot.db`（不進 git）。刪除這個檔案後重新啟動，API 會重新回填過去 24 小時的資料。

## 檢查

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium   # 第一次執行 E2E 前
npm run test:e2e
```

## 環境變數（API）

| 變數 | 預設 | 說明 |
|------|------|------|
| `PORT` | 3100 | API port；前端 proxy 用 `API_PORT` 指定同一個值 |
| `DB_PATH` | `apps/api/data/aiot.db` | SQLite 檔案位置 |
| `SEED` | 42 | 模擬器亂數種子 |
| `BACKFILL_HOURS` | 24 | 首次啟動回填時數 |
| `WRITE_INTERVAL_SEC` | 10 | 寫入資料庫間隔 |
| `RETENTION_HOURS` | 24 | 讀值保留時數 |
