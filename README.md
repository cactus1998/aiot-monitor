# 機台戰情室 AIoT Monitor

模擬工廠機台每秒產生的感測資料，由 Node.js API 收集並儲存在 SQLite，前端以 Vue 3 + ECharts 呈現即時監控、歷史查詢、告警與趨勢預測。

- 前端：Vue 3、TypeScript、Vite、Pinia、Vue Router、ECharts（vue-echarts，按需引入）
- 後端：Node.js 22、Fastify、`node:sqlite`、zod、SSE、OpenAPI
- 共用：`packages/shared`（型別、schema、資料轉換）、`packages/simulator`（機台模擬器）
- 測試：Vitest、@vue/test-utils、Playwright

## 狀態

第一至三階段功能已完成（Kendo UI 對照頁待確認授權）；部署暫緩。資料量刻意保持小：資料庫保留 24 小時、約 7 萬筆以內。規格見 [docs/PRD-aiot-monitor.md](docs/PRD-aiot-monitor.md)，開發順序見 [docs/TODO.md](docs/TODO.md)。

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
