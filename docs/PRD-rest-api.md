# PRD：REST API（rest-api）

## 目標

提供前端需要的查詢端點，輸入輸出全部以 `@aiot/shared` 的 zod schema 驗證。對應筆試題「串接 API 並呈現表格與折線圖」的後端部分。

## 範圍

- **Must**：
  - Fastify 5 + `fastify-type-provider-zod`：同一份 zod schema 用於請求驗證、回應序列化與 OpenAPI。
  - 端點：

    | 方法 | 路徑 | 說明 |
    |------|------|------|
    | GET | `/api/health` | `{ status, time, readings }` |
    | GET | `/api/machines` | 機台清單 + 最新讀值（即時狀態優先，沒有就取 DB 最新） |
    | GET | `/api/machines/:id/series` | `metric`、`from`、`to`、`points`（預設 720，上限 2000）；SQL `GROUP BY (ts - from) / bucket` 回傳 avg / min / max 與 `rawCount` |
    | GET | `/api/readings` | `machineId?`、`from`、`to`、`page`、`pageSize`（≤ 500）、`sort`（`ts` / 指標，`-` 前綴為遞減，null 排最後） |
    | GET | `/api/readings.csv` | 同篩選條件，串流輸出，依時間遞增 |
    | GET | `/api/stats/overview` | 今日（台北時間 00:00 起）OEE、產量、班別產量、各機台產量、狀態分布、未處理告警數 |

  - 錯誤格式 `{ error: { code, message } }`：驗證失敗 400 `VALIDATION_ERROR`、找不到 404 `NOT_FOUND`、其他 500 `INTERNAL_ERROR`。
  - CORS 允許 `CORS_ORIGIN`（預設允許全部，開發時由 Vite proxy 同源存取）。
- **Won't**：寫入讀值的公開 API（只由模擬器寫入）、認證。

## 邊界情況

| 編號 | 情境 | 預期行為 |
|------|------|----------|
| EC-01 | from ≥ to、範圍 > 24 小時、pageSize > 500 | 400，訊息說明原因 |
| EC-02 | 不存在的機台 id | series 回 404 |
| EC-03 | 範圍內無資料 | `points: []`、`items: []`、`total: 0`；CSV 只有表頭 |
| EC-04 | 頁碼超過總頁數 | `items: []`，`total` 照實回傳 |
| EC-05 | 感測值 null | JSON 為 `null`；CSV 為空欄位；avg 忽略 null |

## 驗收標準

- [x] AC-01：每個端點的正常回應都通過對應 `ResponseSchema.parse`。
- [x] AC-02：series 回傳點數 ≤ `points`，24 小時查詢本機 < 300ms。
- [x] AC-03：CSV 資料列數等於同條件 `/api/readings` 的 `total`。
- [x] AC-04：EC-01 ~ EC-05 都有路由測試。

## 開發紀錄

- 2026-10-06：完成。OEE 在 JS 端用 shared 的 `machineOeeInput` / `combineOee` 計算（今日最多約 7 萬筆，耗時數十毫秒），讓前端 mock 模式與後端使用同一套公式。
