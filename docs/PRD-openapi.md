# PRD：OpenAPI 文件（openapi，Could）

## 目標

不另外維護 API 文件：路由用的 zod schema 直接產生 OpenAPI，`/api/docs` 可以互動測試。

## 範圍

- **Must**：
  - `@fastify/swagger` + `fastify-type-provider-zod` 的 `jsonSchemaTransform`。
  - `@fastify/swagger-ui` 掛在 `/api/docs`，JSON 在 `/api/docs/json`。
  - 每個路由有 `tags` 與中文 `summary`。
- **Won't**：產生前端 client 程式碼（前端直接用 shared 的型別）。

## 驗收標準

- [x] AC-01：路由測試確認 `/api/docs/json` 含 `/api/readings`。
- [x] AC-02：開發模式下 `http://localhost:5173/api/docs` 可開啟（經 Vite proxy）。

## 開發紀錄

- 2026-10-06：完成。
