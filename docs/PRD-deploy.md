# PRD：部署（deploy）

## 目標

把前端展示版放上作品集網域，讓面試官不必在本機啟動後端就能操作完整畫面；作品集首頁加入入口。

## 範圍

- **Must**：
  - 前端以 mock 模式建置（`npm run build:mock -w @aiot/web`，輸出 `apps/web/dist-mock`），機台資料由瀏覽器內的 simulator 產生，不需後端。
  - 部署到 `cactus1998/portfolio-dist` 的 `aiot-monitor/` 子資料夾，網址 `https://kentfolio.dev/aiot-monitor/`。
  - `base: './'` 搭配 hash 路由，子路徑與深層網址重新整理都不需要 `404.html` 轉址。
  - `cactus1998/portfolio` 的 `src/data/sites.ts` 加入作品卡片（含原始碼連結）。
- **Won't**（暫緩）：API 部署到雲端主機、IIS 部署（TODO 22）、本 repo 的自動部署 workflow。

## 部署步驟

1. 本機關卡：`npm run lint`、`npm run typecheck`、`npm test`。
2. `npm run build:mock -w @aiot/web`，確認 `dist-mock/index.html` 引用的資源都是 `./assets/...` 相對路徑。
3. 在 `portfolio-dist` repo：`git pull --ff-only`，以 `dist-mock` 的內容取代 `aiot-monitor/` 資料夾（先刪舊檔，避免殘留舊 hash 檔案）。
4. commit 訊息格式 `deploy(aiot-monitor): <摘要>`，push 到 `master`，GitHub Pages 自動更新。
5. 開啟線上網址，確認總覽、機台詳情、歷史查詢、告警中心可正常操作。

## 邊界情況

| 編號 | 情境 | 預期行為 |
|------|------|----------|
| EC-01 | 深層網址（`/aiot-monitor/#/machines/CNC-01`）重新整理 | hash 路由，伺服器只收到 `/aiot-monitor/`，正常載入 |
| EC-02 | 線上沒有 API | mock 模式不發出 `/api` 請求，連線狀態顯示模擬資料 |
| EC-03 | 重新部署後舊 chunk 殘留 | 步驟 3 先清空資料夾再複製 |

## 驗收標準

- [x] AC-01：Given 部署完成，When 開啟 `https://kentfolio.dev/aiot-monitor/`，Then 回應 200 並載入最新的 `index-*.js`。
- [x] AC-02：Given 作品集 CI 完成，When 開啟 `https://kentfolio.dev/`，Then 作品區出現 AIoT Monitor 卡片並連到上述網址。
- [ ] AC-03：API 部署到雲端主機，前端改以 http 模式連線（暫緩）。

## 開發紀錄

- 2026-10-07：前端 mock 版部署到 `portfolio-dist/aiot-monitor/`（commit `aba8d9f`）；作品集新增卡片（`portfolio` commit `7efe5b5`，CI 成功）。線上確認 200 與卡片連結。API 部署仍暫緩。
