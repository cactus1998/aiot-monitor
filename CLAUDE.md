# aiot-monitor

作品集專案：模擬工廠機台 → Node.js API + SQLite → Vue 3 + ECharts 即時與歷史視覺化。規格見 `docs/PRD-aiot-monitor.md`。

## 工作方式

- 開工前讀 `docs/TODO.md`，依編號與「基於」欄位的依賴順序進行。
- 每一項先有 `docs/PRD-<slug>.md`（`/feature-spec`），實作以 Must 範圍為準；完成後勾選 AC、補開發紀錄、更新 TODO 與 `docs/README.md` 狀態。
- 範圍超出總規格時先詢問。

## Skills

| 情境 | skill |
|------|-------|
| 寫規格 | `/feature-spec` |
| 新增 API（shared schema → api → ApiClient） | `/api-endpoint` |
| 新增頁面 | `/new-page` |
| 圖表 | `/chart-panel` |
| 前端撰寫規範 | `vue-conventions` |
| 補測試 | `/add-tests` |
| 修 bug / 重構 / 查原因 / 驗收 | `surgical-patch`、`safe-refactor`、`investigate-first`、`verify-and-stop` |
| 效能量測 | `/perf-audit` |
| commit 與 push、上線 | `/git-commit`（有 upstream 時自動 push）、`/deploy-check`（push main 前） |

## 必守

- 業務資料只存在後端資料庫，不寫 `localStorage`。
- 前後端型別與 schema 只定義在 `packages/shared`。
- 時間一律 UTC 毫秒傳遞與儲存，顯示時轉 Asia/Taipei。
- push 只透過 `/git-commit`（有 upstream 才推、不 force），不代為操作雲端主機或 GitHub Secrets。
