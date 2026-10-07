# PRD：測試基礎建設（test-infra）

## 目標

每個 workspace 都能寫測試並在 CI 執行。涵蓋純函式、API、元件、E2E 四層測試。

## 範圍

- **Must**：
  - 每個 workspace 有 `vitest.config.ts` 與 `test`（`vitest run`）、`test:run`、`test:watch` 指令。
  - `packages/*`、`apps/api`：Node 環境；`apps/web`：jsdom + @vue/test-utils。
  - api 測試以 `buildApp({ dbPath: ':memory:' })` 建立應用程式，用 `app.inject()` 打路由，不開 port。
  - spike 測試確認 Vitest 能載入 `node:sqlite`。
  - Playwright：`e2e/` 目錄、`playwright.config.ts`，以 mock 模式啟動 web（`VITE_API_MODE=mock`），只跑 Chromium。
- **Won't**：覆蓋率門檻、多瀏覽器 E2E、視覺回歸。

## 邊界情況

| 編號 | 情境 | 預期行為 |
|------|------|----------|
| EC-01 | Vitest 無法解析 `node:sqlite` | spike 測試失敗即可發現；改用 `server.deps` 或 `better-sqlite3` |
| EC-02 | E2E 執行時 5173 已被占用 | `reuseExistingServer` 僅在非 CI 環境啟用 |

## 驗收標準

- [x] AC-01：`npm test` 執行全部 workspace 測試並通過。
- [x] AC-02：api 有一支 `node:sqlite` 的 `:memory:` 測試通過。
- [x] AC-03：`npm run test:e2e` 以 mock 模式 build + preview（port 4173）後跑完 E2E。

## 開發紀錄

- 2026-10-06：完成。Vitest 5 可直接載入 `node:sqlite`（spike 測試在 `apps/api/src/db/db.test.ts` 的 `node:sqlite` 區塊），不需額外設定。
