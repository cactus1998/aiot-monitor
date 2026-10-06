# 機台戰情室 AIoT Monitor

模擬工廠機台每秒產生的感測資料，由 Node.js API 收集並儲存在 SQLite，前端以 Vue 3 + ECharts 呈現即時監控、歷史查詢、告警與趨勢預測。

- 前端：Vue 3、TypeScript、Vite、Pinia、Vue Router、ECharts
- 後端：Node.js 22、Fastify、`node:sqlite`、zod、SSE
- 共用：`packages/shared`（型別、schema、資料轉換）、`packages/simulator`（機台模擬器）
- 測試：Vitest、@vue/test-utils、Playwright

## 狀態

規劃中，尚未建立程式碼。資料量刻意保持小（保留 24 小時、DB 約 7 萬筆以內），部署位置暫緩決定。規格見 [docs/PRD-aiot-monitor.md](docs/PRD-aiot-monitor.md)，開發順序見 [docs/TODO.md](docs/TODO.md)。

## 開發

需要 Node.js 22.13 以上。指令在 TODO 01（monorepo-setup）完成後補上。
