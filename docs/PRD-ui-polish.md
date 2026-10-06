# PRD：介面細節（ui-polish）

## 目標

讓作品在任何裝置與設定下都能展示：深色主題、手機寬度、鍵盤操作、減少動態。

## 範圍

- **Must**：
  - 深色 / 淺色主題：CSS 變數 token，`[data-theme="dark"]` 覆寫；預設跟隨系統；切換結果存 localStorage（`aiot:ui`，格式 `{ version: 1, data }`，唯一的 localStorage 用途）；`index.html` 在首次繪製前套用，避免閃爍；圖表顏色從 CSS 變數讀取並隨主題更新。
  - RWD：最小 400px；860px 以下側欄改為抽屜；KPI 兩欄、圖表單欄；表格區塊內橫向捲動。
  - 無障礙：
    - 「跳到主要內容」連結（hash 路由下改為直接 focus `<main>`）。
    - 圖表容器 `role="img"` + 摘要 `aria-label`，並可切換「以表格檢視」。
    - 狀態用顏色 + 圖示 + 文字；資料表 `aria-sort`、列可用 Tab / Enter。
    - 告警通知 `aria-live="assertive"`；連線狀態 `role="status"`。
  - 圖表滾輪：一般滾輪捲動頁面，Ctrl + 滾輪縮放，避免頁面卡在圖表上。
  - `prefers-reduced-motion`：關閉轉場與動畫。
  - 換頁回到頂端；只改 query（篩選、分頁）時保留捲動位置。
- **Won't**：高對比主題、多語系。

## 驗收標準

- [x] AC-01：E2E 在 400px 寬度檢查 6 個頁面都沒有水平捲軸。
- [x] AC-02：深淺主題切換後圖表顏色同步更新。

## 開發紀錄

- 2026-10-06：完成。瀏覽器實測時發現兩個問題並修正：dataZoom 攔截滾輪導致頁面無法捲動、`#main` 錨點被 hash 路由當成路徑。
