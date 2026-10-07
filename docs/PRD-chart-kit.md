# PRD：圖表元件（chart-kit）

## 目標

用 Apache ECharts + vue-echarts 封裝四種圖表，頁面只傳 shared 型別的資料，不直接寫 ECharts option。

## 範圍

- **Must**：
  - `components/charts/echarts.ts`：按需引入（`LineChart`、`PieChart`、`GaugeChart`、`BarChart`、Grid、Tooltip、Legend、DataZoom、MarkLine、MarkArea、Title、Graphic、`CanvasRenderer`）。
  - `ChartPanel.vue`：標題、說明、loading / empty / error（重試）、「以表格檢視」切換、點數與耗時資訊。
  - `LineChart.vue`：多序列、時間軸（台北時間）、閾值線（`markLine`）、可選 dataZoom、null 斷線（`connectNulls: false`）、可選預測線。
  - `PieChart.vue`：環形狀態分布、中心顯示總數。
  - `GaugeChart.vue`：0–100%，分段顏色。
  - `BarChart.vue`：類別長條圖。
  - option 一律由純函式 `buildXxxOption()` 產生並有單元測試。
  - 顏色從 CSS 變數讀取，深淺主題切換時重新套用。
  - vue-echarts `autoresize`（ResizeObserver）；元件卸載時 dispose（vue-echarts 內建）。
  - 容器 `role="img"` 與 `aria-label` 摘要。
- **Won't**：3D、地圖。

## 驗收標準

- [x] AC-01：每個 `buildXxxOption` 有測試：資料轉換、閾值線、null 保留。
- [x] AC-02：空資料時不顯示座標軸，顯示提示（總規格 EC-02）。
- [ ] AC-03：首頁 JS gzip ≤ 250KB（按需引入 + 路由 lazy load）—— 實測約 293KB，見 `PRD-chart-perf.md`。

## 開發紀錄

- 2026-10-06：完成。ECharts 6 的 `grid.containLabel` 已改由預設的 `outerBounds` 處理，不再設定。閾值高於資料最大值時，y 軸上限自動延伸，閾值線不會被截掉。
