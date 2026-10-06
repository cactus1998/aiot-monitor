# PRD：CI 流程（ci-pipeline）

## 目標

push 與 PR 時自動跑 lint、typecheck、單元測試、build 與 E2E，確保 master 隨時可展示。對應總規格 AC-08。

## 範圍

- **Must**：
  - `.github/workflows/ci.yml`，觸發條件：push 到 `master` / `main`、所有 PR。
  - 單一 job，Node 22（`actions/setup-node` + npm cache）：`npm ci` → `lint` → `typecheck` → `test` → `build` → 安裝 Playwright Chromium → `test:e2e`。
  - E2E 失敗時上傳 `playwright-report/` artifact（保留 7 天）。
- **Won't**：部署（暫緩，見 TODO 15）、matrix 多版本 Node。

## 邊界情況

| 編號 | 情境 | 預期行為 |
|------|------|----------|
| EC-01 | 任一步失敗 | 後續步驟不執行，run 標示失敗 |
| EC-02 | 同一分支連續 push | `concurrency` 取消較舊的 run |

## 驗收標準

- [x] AC-01：workflow 檔案通過 YAML 語法檢查，步驟與本機指令一致。
- [x] AC-02：push 後 GitHub Actions 全綠（run 37408735968）。

## 開發紀錄

- 2026-10-06：workflow 建立完成；本機已依相同順序跑過全部關卡。
