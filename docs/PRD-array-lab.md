# PRD：陣列方法實驗室（array-lab）

## 目標

對應筆試題「JS array 方法與小範例」：用即時機台資料逐一示範常考方法，左邊程式碼、右邊執行結果，面試時可直接打開講。

## 範圍

- **Must**：
  - 路由 `/lab/array`。
  - 範例（`apps/web/src/lab/examples.ts`）：`map`、`filter`、`reduce`、`Object.groupBy`、用 `reduce` 手寫 groupBy、`toSorted`、`flatMap`、`findLast`、`some` / `every`、`sort` 預設字串比較陷阱。
  - 每個範例標示「是否改變原陣列」與一句重點說明。
  - 資料：取樣當下 8 台的最新讀值 + 最近一分鐘的緩衝讀值；「重新取樣」按鈕、「每 2 秒自動更新」選項。
  - 範例執行錯誤時顯示錯誤訊息，不影響其他範例。
- **Won't**：線上編輯並執行任意程式碼。

## 驗收標準

- [x] AC-01：10 個範例都顯示程式碼與 JSON 結果。
- [x] AC-02：程式碼區關閉字型連字，`=>`、`!==` 照原樣顯示。

## 開發紀錄

- 2026-10-06：完成。同樣的 array 方法也實際用在 `packages/shared/src/transform.ts`，可以從實驗室連到正式程式碼講解。
