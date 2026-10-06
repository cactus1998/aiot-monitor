# PRD：資料表格（data-table）

## 目標

泛型 `DataTable<T>`：欄位定義驅動、伺服器端分頁排序，loading / 空 / 錯誤狀態齊全。對應筆試題「API 資料呈現成表格」。

## 範圍

- **Must**：
  - Props：`columns: Column<T>[]`、`rows: T[]`、`rowKey`、`total`、`page`、`pageSize`、`sort`、`status`、`error`、`selectedKey?`。
  - `Column<T>`：`key`、`label`、`sortable?`、`align?`、`format?(row)`。
  - Emits：`update:page`、`update:pageSize`、`update:sort`、`retry`、`rowClick`。
  - 排序：點欄位標題在「遞減 → 遞增」間切換；`aria-sort` 標示。
  - 分頁：第一頁 / 上一頁 / 下一頁 / 最後一頁、每頁筆數 20 / 50 / 100、顯示「第 x–y 筆，共 n 筆」。
  - 狀態：loading 顯示骨架列、空資料顯示提示、錯誤顯示訊息與重試。
  - null 值顯示「—」（總規格 EC-07）。
  - 鍵盤：標題排序用 `<button>`；列可 Tab 聚焦，Enter 觸發 `rowClick`。
- **Won't**：前端排序、虛擬捲動、欄寬拖拉。

## 驗收標準

- [x] AC-01：點欄位標題 emit 正確的 sort 值（`-ts` → `ts`）。
- [x] AC-02：分頁按鈕在第一頁 / 最後一頁時 disabled。
- [x] AC-03：loading、empty、error 三種狀態有元件測試。

## 開發紀錄

- 2026-10-06：完成。
