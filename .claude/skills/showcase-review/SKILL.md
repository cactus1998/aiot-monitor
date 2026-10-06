---
name: showcase-review
description: 面試展示前的品質檢查：對照 PRD 驗收標準，檢查型別、資料狀態、競態、資源清理、圖表效能、無障礙、RWD 與 API 驗證，找出面試官可能挑出的問題。使用時機：/showcase-review <slug 或 all>，或使用者說「幫我檢查能不能拿去面試」「review 這個 demo」。
argument-hint: <PRD slug | all>
---

# 展示前檢查

用嚴格面試官的角度審查。目標是在面試前找出會被挑出的問題，不是給稱讚。

## 步驟

1. 範圍：指定 slug 時只檢查該 PRD 涉及的檔案；`all` 時檢查全部 workspace，並對照 `docs/PRD-aiot-monitor.md` 的考點對照表，逐列確認現場能展示。
2. 對照 `docs/PRD-<slug>.md` 列出未完成的 AC / EC。
3. 執行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`，記錄失敗項目。
4. 依下方清單閱讀程式碼。每個問題附檔案與行號，說明面試官會怎麼問。
5. 需要實際互動驗證時，啟動 `npm run dev`，在瀏覽器確認（鍵盤操作、400px 寬、斷開 API 時 fallback mock）。
6. 輸出報告，依嚴重度排序：
   - **必修**：bug、型別錯誤、記憶體洩漏、競態、API 未驗證輸入、明顯的無障礙缺陷。
   - **建議**：可讀性、命名、可抽出的 composable、缺少的邊界狀態。
   - **加分**：讓 demo 更亮眼的小改動（例如顯示繪製點數與耗時、naive 與優化版切換）。
7. 詢問使用者要修哪些項目，確認後再改。

## 檢查清單

**TypeScript 與 schema**
- 沒有 `any`、不必要的 `as`、`!`。
- API 回應在前端經 zod 驗證；前後端使用 `packages/shared` 的同一份 schema，沒有重複定義型別。

**正確性**
- loading、空資料、錯誤、重試都有畫面。
- 查詢有 AbortController 或請求序號處理競態。
- 時間一律 UTC ms 傳遞，顯示時才轉 Asia/Taipei。
- 感測值 null 時圖表斷線、表格顯示「—」。

**資源清理**
- ECharts instance、ResizeObserver、EventSource、`setInterval`、Worker 在 `onScopeDispose` / `onUnmounted` 清理。

**圖表與效能**
- ECharts 按需引入，沒有 `import * as echarts`。
- 每次更新使用 `setOption` 增量更新，不重建 instance；繪製點數 ≤ 2000。
- 背景分頁暫停重繪。
- 大陣列用 `shallowRef`，不放深層響應。

**API**
- 所有 query / body 以 zod 驗證，時間範圍與 pageSize 有上限。
- SQL 使用參數化查詢，沒有字串拼接。
- 錯誤格式統一 `{ error: { code, message } }`。

**無障礙**
- 圖表有「以表格檢視」替代；狀態不只靠顏色辨識。
- 互動元素是 `<button>` / `<a>`，鍵盤可操作，focus 看得到。
- 即時更新的數字區塊使用合適的 `aria-live`（避免每秒朗讀）。

**展示效果**
- 頁面看得出在展示什麼（標題、說明、連線狀態標示）。
- 400px 寬不破版；深色與淺色主題下圖表文字都清楚。
