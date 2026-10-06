---
name: written-test-drill
description: 模擬一小時前端筆試：出題（JS array 方法小範例、框架優缺點、串接 API 呈現表格與折線圖），計時讓使用者作答，再依評分表批改並記錄到 docs/interview/drills/。使用時機：/written-test-drill [array | framework | api | full]，或使用者說「模擬筆試」「幫我出題練習」。
argument-hint: [array | framework | api | full]
---

# 模擬筆試

常見題型：限時一小時作答，內容包含 JS array 方法與小範例、所用框架的優缺點、實作串接 API 並把資料呈現成表格與折線圖。

## 出題

- `full`（預設）：三題都出，總時限 60 分鐘，建議配置 array 15 分、framework 10 分、api 35 分。
- `array`：從 `map`、`filter`、`reduce`、`find` / `findIndex` / `findLast`、`some` / `every`、`flat` / `flatMap`、`sort` / `toSorted`、`splice` / `slice` / `toSpliced`、`includes` / `indexOf`、`Object.groupBy`、`Array.from` 中挑 4–5 個，每個要求寫出用途、是否改變原陣列、一個小範例；再加一題組合題（例如用 `reduce` 依機台分組並算平均溫度）。
- `framework`：說明所用框架（Vue 3）的優缺點，並與 React、jQuery 比較；追加一題情境題（例如「大量即時資料的儀表板，你會怎麼避免效能問題」）。
- `api`：使用公開免費 API 出題，每次換題，例如：
  - Open-Meteo 逐時氣溫（`https://api.open-meteo.com/v1/forecast?latitude=25.03&longitude=121.56&hourly=temperature_2m`）
  - 環境部開放資料、CoinGecko 歷史價格等不需金鑰的端點
  要求：取得資料、整理成表格（含至少一個排序或篩選）、畫折線圖、處理 loading 與錯誤。不限框架，可用 CDN 版 Vue / ECharts / Chart.js。
- 出題前先用 WebFetch 確認 API 可用，並附上回應格式摘要。
- 題目寫入 `docs/interview/drills/<YYYY-MM-DD>-<n>/QUESTION.md`，作答放同資料夾。

## 作答

- 告訴使用者開始時間與結束時間，期間不提供答案或提示；使用者明確求救時只給方向，並記錄在評語中。
- 使用者說「交卷」或時間到時進入批改。

## 批改

依下表給分，每項附具體理由與改進範例：

| 項目 | 配分 | 看什麼 |
|------|------|--------|
| array 正確性 | 20 | 用途、是否改變原陣列、範例可執行 |
| array 表達 | 5 | 範例貼近實務（例如感測資料） |
| framework | 15 | 優缺點具體、有取捨、能連到實際經驗 |
| api 功能 | 30 | 資料正確、表格、折線圖、排序或篩選 |
| api 健壯性 | 15 | loading、錯誤、空資料、時間格式、單位 |
| 程式品質 | 10 | 命名、拆分、無多餘全域變數 |
| 時間 | 5 | 是否在時限內完成 |

## 紀錄

1. 在題目資料夾寫 `REVIEW.md`：分數、耗時、卡關點、下次要練的項目。
2. 在 `docs/interview/drills/README.md` 加一列（日期、題型、分數、耗時）。沒有該檔就建立。
3. 卡關點與本專案程式碼相關時，指出 aiot-monitor 中可參考的檔案。
