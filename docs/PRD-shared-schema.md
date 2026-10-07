# PRD：共用型別、schema 與資料轉換（shared-schema）

## 目標

前後端只有一份資料契約：指標定義、zod schema、API 型別與純函式都放在 `packages/shared`。資料轉換全部用 array 方法實作並有單元測試。

## 範圍

- **Must**：
  - 指標定義 `METRICS`：`temperature`（°C）、`vibration`（mm/s）、`spindleLoad`（%）、`rpm`（rpm），含標籤、單位、小數位、警告與告警閾值。
  - 機台與讀值 schema：`MachineSchema`、`ReadingSchema`（感測值可為 `null`）、`MachineStatus`（`running` / `idle` / `alarm` / `offline`）。
  - API schema（`src/api/*`）：health、machines、series、readings、overview、alert-rules、alerts、stream 事件、錯誤格式。
  - 時間範圍：`TimeRangeSchema` refine `from < to` 且不超過 24 小時；預設範圍 `1h` / `6h` / `24h`。
  - 轉換函式（array 方法）：`groupByMachine`（`Object.groupBy`）、`countBy`（`reduce`）、`latestByMachine`（`findLast`）、`sortReadings`（`toSorted`）、`bucketize`（分桶 avg / min / max）、`summarize`（忽略 null）、`toCsv`（`map` / `join`）、`toSeriesRows`（`flatMap`）。
  - `computeOee`、`computeMachineOee`（可用率 × 效能 × 良率）。
  - `lttb` 降採樣、`linearRegression` 與 `forecastThreshold`（給 TODO 17、20 使用）。
  - 告警規則判定 `evaluateRule`（持續超過 `durationSec` 才觸發）。
- **Won't**：時間格式化（屬前端顯示，放 `apps/web`）。

## 資料與介面

| 函式 | 輸入 | 輸出 |
|------|------|------|
| `bucketize(points, from, to, buckets)` | `{ ts, value }[]` | `SeriesPoint[]`（`avg/min/max` 可為 null） |
| `computeOee(input)` | 計畫時間、運轉時間、理想週期、總數、良品數 | `{ availability, performance, quality, oee }`，皆 0–1 |
| `computeMachineOee(readings, idealCycleSec)` | 依時間排序的讀值 | 同上；樣本間隔以下一筆的時間差計算，上限 120 秒 |
| `lttb(points, threshold)` | `{ ts, value }[]` | 長度 ≤ threshold，保留首尾 |
| `forecastThreshold(points, threshold)` | 最近 N 點 | 預計到達時間（ms）；斜率方向不會到達時回 `null` |

## 邊界情況

| 編號 | 情境 | 預期行為 |
|------|------|----------|
| EC-01 | 空陣列 | 所有函式回傳空結果或 0，不丟例外 |
| EC-02 | 感測值為 null | `summarize`、`bucketize` 忽略 null；整桶都是 null 時回 null |
| EC-03 | 總數為 0 | OEE 各項回 0，不出現 NaN |
| EC-04 | 效能超過 100% | clamp 到 1 |
| EC-05 | 範圍 from ≥ to 或超過 24 小時 | schema 驗證失敗，訊息為中文 |

## 驗收標準

- [x] AC-01：每個轉換函式都有正常、空陣列、null 值的單元測試。
- [x] AC-02：`ReadingsQuerySchema` 拒絕 `pageSize > 500` 與超過 24 小時的範圍。
- [x] AC-03：web 與 api 皆從 `@aiot/shared` 匯入型別，沒有重複定義。

## 開發紀錄

- 2026-10-06：完成。轉換函式集中在 `src/transform.ts`，並在陣列方法實驗室頁面重用。
