---
name: perf-audit
description: 量測 aiot-monitor 的效能：web 打包體積（ECharts 按需引入）、圖表繪製與即時更新、API 查詢耗時與 SQLite 查詢計畫，輸出依影響排序的改善清單。使用時機：/perf-audit [web | api | chart | all]，或使用者說「很慢」「檢查效能」「打包太大」。
argument-hint: [web | api | chart | all]
---

# 效能檢查

先量測再下結論。每個建議都附改善前數據與預估效果。

## web 打包

1. `npm run build -w apps/web`，記錄每個檔案大小與 gzip 大小。
2. 首次載入量：`index.html` 直接引用的 JS + CSS gzip 總和，目標 ≤ 250KB。列出 lazy chunk。
3. 單一 chunk gzip 超過 150KB 時用 `npx vite-bundle-visualizer -c apps/web/vite.config.ts` 找來源；確認 ECharts 只註冊 `components/charts/echarts.ts` 中的模組。

## 圖表（chart）

1. `npm run dev`，開啟機台詳情頁 7d 範圍與即時模式。
2. 量測：
   - 首次繪製：`performance.now()` 包住 `setOption`，或看 `ChartPanel` 顯示的耗時。
   - 即時更新：DevTools Performance 錄 10 秒，檢查長任務（> 50ms）與每秒 frame 數。
   - 記憶體：Memory 面板錄 5 分鐘，確認環形緩衝沒有讓 heap 持續成長。
3. 分頁在背景時 rAF 會暫停，量測前先讓分頁在前景。

## API

1. 用 `curl -w "%{time_total}\n" -o /dev/null -s <url>` 對 `/api/machines/:id/series`（7d）、`/api/readings`（最後一頁）、`/api/readings.csv` 各量 10 次，取 p50 / p95。目標 `/series` p95 < 300ms。
2. 慢的查詢用 `EXPLAIN QUERY PLAN` 確認有走 `(machine_id, ts)` 索引，沒有 `SCAN readings`。
3. 深分頁用 OFFSET 很慢時，評估 keyset pagination（`ts < ?`）。

## 報告

| 項目 | 目前 | 目標 | 做法 | 預估效果 |
|------|------|------|------|----------|

詢問使用者要做哪些項目，確認後再改；改完重新量測，commit 內文附前後數據，並更新 `docs/PRD-chart-perf.md` 的開發紀錄。

## 原則

- 打包以 gzip 為準，API 以 p95 為準，並註明量測方式與資料量。
- 不為數字犧牲正確性：降採樣後的極值（尖峰）必須保留。
