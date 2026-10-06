---
name: new-page
description: 在 apps/web 新增路由頁面：view、查詢 composable、lazy load 路由、URL query 同步、loading / 空 / 錯誤狀態、連線狀態、RWD 與測試。使用時機：/new-page <頁面名稱或 PRD slug>，或使用者說「新增一個頁面」「加一頁」。
argument-hint: <PRD slug 或頁面描述>
---

# 新增頁面

## 目錄慣例

```
apps/web/src/
  views/<PageName>View.vue        # 只負責畫面組裝
  components/<page-name>/         # 只給這頁用的子元件（可選）
  composables/use<Xxx>.ts         # 資料查詢與副作用
  composables/__tests__/
```

## 步驟

1. **釐清需求**：以 `docs/PRD-<slug>.md` 的 Must 範圍為準；沒有 PRD 時先建議執行 `/feature-spec`。
2. **API**：需要的端點不存在時，先用 `/api-endpoint` 建立（shared schema → api 路由 → `ApiClient` 兩種實作），再回來做頁面。
3. **路由**：在 `apps/web/src/router/index.ts` 加入，一律 lazy load，並設定 `meta.title`：
   ```ts
   { path: '/history', name: 'history', component: () => import('@/views/HistoryView.vue'), meta: { title: '歷史查詢' } }
   ```
   部署在 GitHub Pages 子路徑，使用 hash 路由與 `import.meta.env.BASE_URL`，不要改成 history 模式。
4. **資料**：
   - 查詢 composable 回傳 `{ data, status, error, refresh }`，條件變動時 abort 舊請求。
   - 篩選條件與 URL query 雙向同步（`useRoute` / `router.replace`），非法值回到預設。
   - 即時資料從 store 取，不另開 SSE。
5. **畫面**：
   - loading（skeleton）、空資料、錯誤 + 重試三種狀態都要有。
   - 圖表使用 `components/charts/`，表格使用 `DataTable`。
   - 頁首顯示標題、一句說明與連線狀態徽章。
   - 400px 寬不破版；圖示按鈕加 `aria-label`。
6. **測試**：composable 涵蓋正常、空資料、錯誤、競態；頁面元件以 mock `ApiClient` 掛載測試；主要頁面在 `e2e/` 加一條 Playwright 流程。
7. **驗證**：`npm run lint`、`npm run typecheck`、`npm test -w apps/web`、`npm run build -w apps/web`，再用 `npm run dev` 在瀏覽器確認直接開啟與重新整理該頁都正常（http 與 mock 模式各一次）。
8. **回報**：新增檔案、路由路徑、使用的 API，以及更新 `docs/TODO.md` 狀態。
