---
name: api-endpoint
description: 新增或修改 API 端點的完整流程：packages/shared 的 zod schema 與型別 → apps/api 的 Fastify 路由與 repository → 測試 → apps/web 的 ApiClient（http 與 mock 兩種實作）。使用時機：/api-endpoint <方法 路徑 或描述>，或使用者說「加一支 API」「後端要提供 xxx」。
argument-hint: <METHOD /api/path 或描述>
---

# 新增 API 端點

前後端共用同一份 schema 是這個專案的面試亮點，任何端點都依同樣順序完成，不能只改一邊。

## 順序

1. **規格**：對照 `docs/PRD-aiot-monitor.md` 的 API 表與相關 PRD。新端點不在總規格中時，先詢問使用者並補進總規格。
2. **shared**（`packages/shared/src/api/<resource>.ts`）：
   - 定義 `<Name>QuerySchema`、`<Name>BodySchema`、`<Name>ResponseSchema`，匯出 `z.infer` 型別。
   - query 字串轉數字用 `z.coerce`；時間範圍 refine `from < to` 且不超過 24 小時；`pageSize` 上限 500。
   - 從 `packages/shared/src/index.ts` 匯出。
3. **api**：
   - repository（`apps/api/src/db/<resource>.ts`）：參數化 SQL，回傳已整形的資料；不在路由裡寫 SQL。
   - 路由（`apps/api/src/routes/<resource>.ts`）：用 shared schema 驗證輸入，失敗回 `400 { error: { code: 'VALIDATION_ERROR', message } }`；找不到回 404。
   - 在 `apps/api/src/app.ts` 註冊。`buildApp({ dbPath })` 必須能在測試以 `:memory:` 建立。
4. **測試**（`apps/api/src/routes/<resource>.test.ts`）：用 `app.inject()` 測正常回應（以 `ResponseSchema.parse` 斷言）、400、404、分頁與時間邊界。
5. **web**：
   - 在 `ApiClient` 介面加方法，`httpClient` 實作並以 `ResponseSchema.parse` 驗證回應，`mockClient` 以 simulator 資料實作相同語意（分頁、排序、篩選結果要一致）。
   - 支援 `AbortSignal` 參數。
6. **驗證**：`npm run typecheck`、`npm test -w apps/api`、`npm test -w packages/shared`；手動 `curl` 一次並貼出回應摘要。
7. **文件**：更新總規格 API 表；有 OpenAPI（PRD 24）時確認文件產生正確。

## 原則

- 回應不直接吐資料表欄位名稱（snake_case），在 repository 轉成 camelCase。
- 時間一律 UTC 毫秒整數。
- 大量資料的端點（CSV、讀值）用串流或分頁，不一次載入記憶體。
- SSE 事件格式同樣在 shared 定義 schema。
