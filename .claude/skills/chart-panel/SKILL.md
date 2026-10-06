---
name: chart-panel
description: aiot-monitor 的圖表規範與新增流程：ECharts 按需引入、封裝元件介面、主題 token、即時增量更新、降採樣、生命週期清理、空與錯誤狀態、表格替代檢視。新增或修改 apps/web/src/components/charts 下的元件、或在頁面放圖表時套用。使用時機：/chart-panel <圖表描述>，或使用者說「加一張折線圖 / 圓餅圖」「這張圖要即時更新」。
argument-hint: <圖表類型與資料描述>
---

# 圖表

折線圖與圓餅圖是這間公司前端的日常工作，也是筆試考點。圖表要正確、清楚、不卡、可存取。

## 封裝元件

位置 `apps/web/src/components/charts/`：

| 元件 | 用途 |
|------|------|
| `ChartPanel.vue` | 外框：標題、說明、狀態（loading / empty / error + 重試）、「以表格檢視」切換、點數與耗時資訊 |
| `LineChart.vue` | 時間序列，多指標、閾值線（`markLine`）、dataZoom、null 斷線 |
| `PieChart.vue` | 狀態分布（環形），中心顯示總數 |
| `GaugeChart.vue` | OEE、負載百分比 |
| `BarChart.vue` | 班別 / 機台產量 |

資料一律以 shared 的型別傳入（例如 `SeriesPoint[]`），元件內部轉成 ECharts option；頁面不直接寫 ECharts option。

## 規則

- **按需引入**：在 `components/charts/echarts.ts` 統一 `use([...])` 註冊用到的 chart、component 與 `CanvasRenderer`，不 `import * as echarts`。
- **主題**：顏色從 CSS 變數讀取（狀態色、序列色、文字與格線色），切換深淺色主題時重新套用；序列顏色固定對應指標，不依順序變動。
- **即時更新**：用 `setOption(partial, { lazyUpdate: true })` 增量更新，不重建 instance；以 `requestAnimationFrame` 合併；`document.hidden` 時暫停。
- **資料量**：繪製點數 ≤ 2000。長時間範圍用 API 的 `points` 參數分桶，前端需要時用 shared 的 `lttb()`；`ChartPanel` 顯示「原始 N 點 / 繪製 M 點」。
- **缺值**：null 保留為 null（`connectNulls: false`），不要補 0。
- **時間軸**：`type: 'time'`，tooltip 與軸標籤用 Asia/Taipei 格式化，數值帶單位。
- **尺寸與清理**：ResizeObserver 觸發 `resize()`；unmount 時 `dispose()` 並解除 observer。
- **無障礙**：容器 `role="img"` 與 `aria-label` 摘要（例如「CNC-01 溫度，最近 1 小時，最高 78°C」）；「以表格檢視」顯示相同資料的 `<table>`；圖例不只靠顏色（線型或符號區分）。
- **空狀態**：無資料時不顯示空座標軸，改顯示提示與調整條件的建議。

## 步驟

1. 確認資料來源與型別（shared），沒有就先 `/api-endpoint`。
2. 優先重用既有封裝元件；確實需要新類型才新增，並在上表加一列。
3. 測試：測「輸入資料 → 產生的 option」（純函式抽成 `buildXxxOption()`），以及 unmount 時呼叫 `dispose`。
4. 瀏覽器確認：淺色 / 深色、400px 寬、表格檢視、即時更新時 DevTools Performance 無長任務。
