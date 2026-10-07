# PRD：Monorepo 基礎建設（monorepo-setup）

## 目標

建立 npm workspaces 單一 repo，讓前端、後端、共用套件與模擬器共用同一份型別與工具設定。

## 範圍

- **Must**：
  - 四個 workspace：`apps/web`（Vite + Vue 3 + TS）、`apps/api`（Fastify + TS）、`packages/shared`、`packages/simulator`。
  - 套件名稱：`@aiot/web`、`@aiot/api`、`@aiot/shared`、`@aiot/simulator`。
  - `packages/*` 不另外編譯，`exports` 直接指向 `src/index.ts`；web 由 Vite、api 由 `tsx` 載入 TS 原始碼。
  - 共用 `tsconfig.base.json`（`strict`、`noUncheckedIndexedAccess`、`moduleResolution: bundler`、`target: ES2023`）。
  - 根目錄 ESLint flat config（typescript-eslint、eslint-plugin-vue、eslint-config-prettier）與 Prettier。
  - 根目錄指令：`dev`（同時啟動 web 與 api）、`lint`、`format`、`typecheck`、`test`、`build`、`test:e2e`。
  - TypeScript 固定 6.0.x（typescript-eslint 尚未支援 7.x）。
- **Won't**：Turborepo / Nx、套件發佈、git hooks。

## 資料與介面

| 指令 | 行為 |
|------|------|
| `npm run dev` | `concurrently` 啟動 `@aiot/api`（port 3100）與 `@aiot/web`（port 5173，`/api` proxy 到 3100；5173 被占用時 Vite 自動換下一個 port） |
| `npm run lint` | `eslint .` |
| `npm run typecheck` | 各 workspace `tsc --noEmit`（web 用 `vue-tsc`） |
| `npm test` | 各 workspace `vitest run` |
| `npm run build` | web `vite build`；api 只做型別檢查（以 `tsx` 執行） |

## 邊界情況

| 編號 | 情境 | 預期行為 |
|------|------|----------|
| EC-01 | 在 web 匯入 `@aiot/shared` | 型別與執行都正常，不需先 build shared |
| EC-02 | api port 3100 被占用 | 啟動失敗並印出錯誤，`PORT` 環境變數可覆寫 |

## 非功能需求

- `npm install` 後一個指令即可啟動整套系統。
- Node 22.13 以上（`node:sqlite` 不需 flag）。

## 驗收標準

- [x] AC-01：Given 乾淨 clone，When `npm install && npm run dev`，Then web 與 api 同時啟動，瀏覽器開 5173 看到頁面，`/api/health` 經 proxy 回 200。
- [x] AC-02：Given 任一 workspace 匯入 `@aiot/shared`，When `npm run typecheck`，Then 無錯誤。
- [x] AC-03：`npm run lint`、`npm run build` 在乾淨狀態通過。

## 開發紀錄

- 2026-10-06：完成。版本：Vue 3.5、Vite 8、TypeScript 6.0、Fastify 5、zod 4、ECharts 6 + vue-echarts 8、Pinia 4、Vue Router 5。
