# PRD：圖表效能展示（chart-perf，Could）

## 目標

資料量刻意保持小，這一項只示範「知道大量資料時怎麼處理」：伺服器端分桶、前端 LTTB、背景暫停重繪，並把數字顯示在畫面上。

## 範圍

- **Must**：
  - 每張折線圖底下顯示「原始 N 點 / 繪製 M 點 / 耗時」。
  - 長範圍走 `/series` 伺服器端分桶（≤ 720 點，上限 2000）。
  - 機台詳情 1 小時範圍：歷史點 + SSE 即時點超過 2000 時，用 shared `lttb()` 降到 2000 點。
  - 分頁在背景時不重繪：live store 以 `requestAnimationFrame` 合併更新、`document.hidden` 時不排程，回到前景一次更新（總規格 EC-06）。
  - 首頁打包體積量測腳本 `scripts/bundle-size.mjs`。
- **Won't**：Web Worker。LTTB 處理 4000 點在主執行緒不到 1ms，搬到 Worker 的傳輸成本反而更高；面試時口頭說明何時需要（數十萬點以上）。

## 驗收標準

- [x] AC-01：所有折線圖繪製點數 ≤ 2000（E2E 檢查 24 小時範圍）。
- [x] AC-02：`lttb()` 單元測試：保留首尾與峰值、長度等於門檻。
- [ ] AC-03：首頁 JS gzip ≤ 250KB —— 未達成，見開發紀錄。

## 開發紀錄

- 2026-10-06：`node scripts/bundle-size.mjs apps/web/dist OverviewView` 量測首頁 JS gzip 約 293KB，其中 ECharts 6（line、pie、gauge、bar、dataZoom、markLine、legend、graphic、canvas 按需引入）約 204KB、zod 約 25KB、Vue 約 24KB。已移除未使用的 markPoint、markArea、title、legend scroll。若要壓到 250KB 以下，可選：總覽頁的儀表改用純 CSS、或把 zod 換成 `zod/mini`；目前保留，待決定。
