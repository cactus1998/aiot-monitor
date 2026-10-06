# PRD：機台戰情室 AIoT Monitor（aiot-monitor）

## 背景與目標

目標職缺類型：製造業智慧化（工業 4.0、AIoT、智慧工廠）領域的前端 / 全端工程師。

- **領域業務**：機台聯網與資料蒐集、資料儲存、數據視覺化與監控、資料分析與預測（例如預測性維護）。
- **常見工作內容**：開發與優化前端介面、配合使用者需求測試、與 PM 及後端合作開發 Web 與伺服器端 API。
- **常見技能要求**：JavaScript、jQuery、Node.js；加分項常見 Vue.js 或 React.js、TypeScript、企業 UI 套件（如 Kendo UI）、C# 後端、IIS 部署。
- **常見面試考點**：
  1. 筆試：JS array 方法與小範例、所用框架優缺點、**串接 API 並把資料呈現成表格與折線圖**。
  2. 看作品集時追問「**作品集的資料存在哪裡**」；只回答 localStorage 說服力不足。
  3. 實務上常把資料輸出成折線圖、圓餅圖。
  4. 作品集要能隨時打開，被問到能立刻介紹。

**這個專案要證明的事**：我能用 Vue 3 + TypeScript + Node.js 做出一套「模擬工廠機台 → 後端收集儲存 → API → 即時與歷史視覺化」的完整 AIoT 監控系統，每一項考點都對應到可以現場打開的畫面與程式碼。

## 考點對照

| 考點 | 專案中的對應 | 現場展示 |
|------|--------------|----------|
| JS array 方法 | `packages/shared` 的資料轉換全部以 `map` / `filter` / `reduce` / `Object.groupBy` / `toSorted` / `flatMap` / `findLast` 實作，並有單元測試；「陣列方法實驗室」頁面用真實機台資料逐一示範 | `/lab/array` |
| 框架優缺點 | `docs/interview/framework-tradeoffs.md`：Vue 3 / React / jQuery + Kendo UI 的比較與本專案選型理由 | 口頭 + 文件 |
| API → 表格 + 折線圖 | 歷史查詢頁：篩選條件打 REST API，結果同時呈現為可排序分頁表格與折線圖，兩者連動 | `/history` |
| 資料存在哪裡 | Node.js API + SQLite（WAL、`(machine_id, ts)` 索引、保留期與降採樣）；告警規則與確認紀錄也寫入資料庫；前端只做記憶體快取，localStorage 僅存 UI 偏好 | `/about` 架構圖 + 程式碼 |
| 折線圖、圓餅圖 | 即時多指標折線圖、機台狀態圓餅圖、OEE 儀表、班別產量長條圖 | `/`、`/machines/:id` |
| 作品集隨時可開 | 前端部署到 kentfolio.dev，無後端時自動切換為瀏覽器內模擬資料（mock 模式），連結永遠能開 | 線上網址 |
| 加分：TypeScript、Node.js | 前後端與共用套件全 TypeScript，Node 22 + Fastify | — |
| 加分：IIS | `deploy/iis/web.config`：SPA rewrite 與反向代理到 Node API 的設定與說明 | 文件 |
| 加分：Kendo UI | Should：同一份資料以 Kendo UI for Vue Grid 做對照頁（實作前確認授權） | `/lab/kendo` |

## 範圍

- **Must**
  - 機台模擬器：8 台機台（CNC、成型機、研磨機），每秒產生溫度、振動 RMS、主軸負載、轉速、產量、良品數；可注入異常（漸進升溫、振動突波、停機）。亂數可設定 seed，測試結果可重現。
  - 後端 API：Node 22 + Fastify + `node:sqlite`，提供機台清單、讀值查詢（分頁、排序、時間範圍）、時間序列降採樣、總覽統計、SSE 即時串流、CSV 匯出。所有輸入以 zod 驗證。
  - 總覽頁：KPI 卡片（運轉率、OEE、今日產量、未處理告警）、機台狀態圓餅圖、機台卡片列表（即時更新）。
  - 機台詳情頁：即時多指標折線圖（1h / 24h / 7d、dataZoom、閾值線）、事件列表。
  - 歷史查詢頁：機台、指標、時間範圍篩選；伺服器端分頁排序表格 + 折線圖連動；CSV 匯出。
  - 資料狀態：每個資料區塊都有 loading、空資料、錯誤與重試畫面；請求有競態處理（AbortController）。
  - 共用套件：型別、zod schema、指標定義、OEE 計算與資料轉換函式，前後端共用。
  - 測試：shared / simulator / api 單元測試，web 元件測試，Playwright E2E 走過三個主要頁面；CI 全綠。
  - 部署：前端 GitHub Pages（mock 模式）；API 部署到免費雲端主機（Render 或 Fly.io，實作時再決定）。
- **Should**
  - 告警中心：閾值規則 CRUD（寫入資料庫）、告警確認（ack）、SSE 推播新告警。
  - 趨勢預測：以最近 N 點線性迴歸估算「預計多久達到閾值」，模擬預測性維護。
  - 陣列方法實驗室頁面。
  - 架構說明頁（含資料流與儲存設計圖）。
  - 深色主題、RWD（最小 400px）、鍵盤操作與圖表的表格替代內容。
  - 大量資料效能：7 天 × 8 台 × 1Hz 約 480 萬筆，圖表用 LTTB 降採樣，頁面顯示「原始點數 / 繪製點數 / 耗時」。
  - IIS 部署設定與文件。
- **Could**
  - Kendo UI for Vue Grid 對照頁。
  - OpenAPI 文件（`@fastify/swagger`）。
  - 多語系（中 / 英）。
- **Won't**
  - 使用者登入與權限（以單一示範帳號假設，PRD 說明正式環境做法）。
  - C# 後端實作（只在 framework-tradeoffs 文件中說明若改用 ASP.NET Core 的差異）。
  - 真實硬體 / MQTT broker 接入（模擬器介面預留 adapter，文件說明換成 MQTT 的方式）。

## 使用情境

- 身為**廠長**，我想要打開總覽頁就看到所有機台狀態與 OEE，以便知道今天產線是否正常。
- 身為**設備工程師**，我想要在機台詳情頁看到振動與溫度的即時曲線和趨勢預測，以便在故障前安排保養。
- 身為**品管人員**，我想要查詢指定時間範圍的讀值並匯出 CSV，以便做離線分析。
- 身為**面試官**，我想要看到資料從哪裡來、存在哪裡、怎麼變成圖表，以便評估候選人的全端理解。

## 系統架構

```mermaid
flowchart LR
    SIM[packages/simulator<br/>機台模擬器] -->|每秒寫入| DB[(SQLite<br/>readings / alerts / rules)]
    DB --> API[apps/api<br/>Fastify REST + SSE]
    SIM -->|新讀值事件| API
    API -->|REST JSON| WEB[apps/web<br/>Vue 3 + ECharts]
    API -->|SSE /api/stream| WEB
    SIM -.->|mock 模式：瀏覽器內執行| WEB
    SHARED[packages/shared<br/>型別 / schema / 轉換函式] --- API
    SHARED --- WEB
```

### 目錄

```
aiot-monitor/
  apps/
    web/          Vue 3 + TS + Vite + Pinia + Vue Router + vue-echarts
    api/          Node 22 + Fastify + node:sqlite + zod
  packages/
    shared/       型別、zod schema、指標定義、OEE、資料轉換（純函式）
    simulator/    可設定 seed 的機台資料產生器（Node 與瀏覽器共用）
  deploy/iis/     web.config 與說明
  docs/           PRD、TODO、面試文件
  e2e/            Playwright
```

### 技術選型

| 項目 | 選擇 | 理由 |
|------|------|------|
| 前端框架 | Vue 3 `<script setup>` + TS | 此領域職缺常見；與既有作品一致，可專注在資料視覺化 |
| 圖表 | ECharts（vue-echarts，按需引入） | 工業儀表板常用；內建 dataZoom、大資料 `large` 模式、圓餅與儀表 |
| 表格 | 自製 `DataTable`（伺服器端分頁排序） | 展示 array 與型別設計能力；Kendo Grid 另做對照 |
| 狀態 | Pinia（跨頁的機台清單與即時讀值）+ composable（頁面查詢） | 依 vue-conventions |
| 後端 | Fastify | 內建 schema 驗證、效能好、`inject()` 方便測試 |
| 資料庫 | `node:sqlite`（Node 22 內建） | 零原生相依、單檔、可回答「資料存在哪」；時間序列以索引與降採樣處理 |
| 即時 | SSE | 單向推播足夠、瀏覽器自動重連、可穿過 IIS / 反向代理；文件說明何時改用 WebSocket |
| 驗證 | zod（shared） | 前後端共用同一份 schema，API 回應在前端也驗證 |
| 測試 | Vitest、@vue/test-utils、Playwright | 與既有專案一致 |

## 資料與介面

### 資料表

| 表 | 欄位 | 備註 |
|----|------|------|
| `machines` | `id`, `name`, `type`, `line`, `ideal_cycle_sec` | 啟動時 seed |
| `readings` | `machine_id`, `ts`(ms), `temperature`, `vibration`, `spindle_load`, `rpm`, `status`, `output`, `good` | 索引 `(machine_id, ts)`；保留 7 天 |
| `alert_rules` | `id`, `machine_id?`, `metric`, `op`, `threshold`, `duration_sec`, `enabled` | 告警規則 |
| `alerts` | `id`, `rule_id`, `machine_id`, `ts`, `value`, `acked_at?` | 告警紀錄 |

### API

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/health` | 健康檢查 |
| GET | `/api/machines` | 機台清單與最新狀態 |
| GET | `/api/machines/:id/series?metric&from&to&points` | 時間序列，伺服器端依 `points` 分桶回傳 avg / min / max |
| GET | `/api/readings?machineId&from&to&page&pageSize&sort` | 原始讀值分頁查詢 |
| GET | `/api/readings.csv?machineId&from&to` | CSV 串流匯出 |
| GET | `/api/stats/overview` | 運轉率、OEE、產量、狀態分布 |
| GET | `/api/stream` | SSE：`reading`、`alert` 事件 |
| GET / POST / PATCH / DELETE | `/api/alert-rules` | 告警規則 CRUD |
| GET / PATCH | `/api/alerts`、`/api/alerts/:id/ack` | 告警列表與確認 |

錯誤格式統一為 `{ error: { code, message } }`；查詢範圍上限 7 天、`pageSize` 上限 500。

### 前端資料來源

`apps/web/src/api/` 定義 `ApiClient` 介面，兩種實作：

- `httpClient`：打真實 API，回應經 zod 驗證。
- `mockClient`：在瀏覽器內以 simulator 產生資料（記憶體保存），介面相同。

`VITE_API_MODE=http | mock`；`http` 模式下 `/api/health` 失敗時頁面提示並可一鍵切換 mock。

## 狀態與流程

```mermaid
stateDiagram-v2
    [*] --> Connecting
    Connecting --> Live : SSE open
    Connecting --> Polling : SSE 失敗 3 次
    Live --> Reconnecting : 連線中斷
    Reconnecting --> Live : 重新連上
    Reconnecting --> Polling : 超過 30 秒
    Polling --> Connecting : 每 60 秒重試 SSE
```

畫面右上角顯示連線狀態（即時 / 重連中 / 輪詢 / 模擬資料）。

## 邊界情況

| 編號 | 情境 | 預期行為 |
|------|------|----------|
| EC-01 | 歷史查詢快速切換條件 | 前一個請求被 abort，只顯示最後一次結果 |
| EC-02 | 查詢範圍無資料 | 表格與圖表顯示空狀態與「調整時間範圍」提示，不顯示空白座標軸 |
| EC-03 | API 500 或逾時（10 秒） | 區塊顯示錯誤訊息與重試按鈕，其他區塊不受影響 |
| EC-04 | 查詢 7 天原始資料 | 圖表走降採樣端點，繪製點數不超過 2000；表格走分頁 |
| EC-05 | SSE 斷線 | 依狀態圖重連；重連後補抓斷線期間的資料，不重複、不遺漏 |
| EC-06 | 分頁在背景 | 暫停圖表重繪，回到前景時一次更新 |
| EC-07 | 感測值缺漏（null） | 折線圖斷線而非連到 0；表格顯示「—」 |
| EC-08 | 時間範圍 from > to 或超過上限 | 前端表單阻擋並提示；API 回 400 |
| EC-09 | 視窗縮放、側欄收合 | 圖表以 ResizeObserver 重新計算尺寸 |
| EC-10 | 離開頁面 | ECharts instance dispose、SSE 訂閱與 timer 清除 |

## 非功能需求

- **效能**：首頁 JS gzip ≤ 250KB（ECharts 按需引入）；即時圖表每秒更新時維持 60fps；`/series` 7 天查詢 p95 < 300ms（本機）。
- **無障礙**：所有圖表附「以表格檢視」切換；色彩不作為唯一狀態辨識（加圖示與文字）；鍵盤可操作篩選與分頁。
- **RWD**：最小 400px；手機版 KPI 卡片兩欄、圖表全寬。
- **時間**：一律以 UTC ms 儲存，畫面以 `Intl.DateTimeFormat`（Asia/Taipei）顯示。
- **可維護**：前端無 `any`；API 回應全經 schema 驗證；lint、typecheck、test 在 CI 執行。

## 驗收標準

- [ ] AC-01：Given API 啟動，When 開啟總覽頁，Then 3 秒內看到 8 台機台、KPI 與狀態圓餅圖，且每秒更新。
- [ ] AC-02：Given 機台詳情頁，When 切換 1h / 24h / 7d，Then 折線圖繪製點數 ≤ 2000，並顯示閾值線。
- [ ] AC-03：Given 歷史查詢頁，When 選擇機台與時間範圍送出，Then 表格與折線圖顯示同一批資料，表格可排序與分頁。
- [ ] AC-04：Given 歷史查詢結果，When 點擊匯出，Then 下載的 CSV 筆數與表格總筆數一致。
- [ ] AC-05：Given 重啟 API，When 重新整理頁面，Then 歷史資料、告警規則與確認紀錄仍存在（資料不在 localStorage）。
- [ ] AC-06：Given 線上網址且無後端，When 開啟網站，Then 自動以 mock 模式運作並標示「模擬資料」。
- [ ] AC-07：邊界情況 EC-01 ~ EC-10 都有對應測試或手動驗證紀錄。
- [ ] AC-08：`npm run lint`、`npm run typecheck`、`npm test`、`npm run test:e2e` 在 CI 全部通過。
- [ ] AC-09：`docs/interview/` 內的講稿能在 3 分鐘內完成 demo，涵蓋考點對照表的每一列。

## 風險與待決策

| 項目 | 選項 | 建議 |
|------|------|------|
| API 雲端主機 | Render 免費版（會休眠）/ Fly.io / 自有主機 | 先 Render，休眠時前端自動 fallback mock，不影響面試展示 |
| `node:sqlite` 仍為 experimental | 改用 `better-sqlite3` | 先用內建；repository 層隔離，必要時替換 |
| Kendo UI 授權 | 免費元件 / 試用版 / 不做 | 實作前確認 Kendo UI for Vue 免費元件範圍，不符合就只寫文件比較 |
