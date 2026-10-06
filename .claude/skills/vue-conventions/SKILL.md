---
name: vue-conventions
description: aiot-monitor 前端（apps/web）Vue 3 + TypeScript 撰寫規範：元件與 composable、Pinia、資料取得與 ApiClient、即時資料、圖表、效能、無障礙、樣式與時間格式。撰寫或修改 apps/web/src 下任何 .vue / .ts 檔案時套用。
---

# Vue 撰寫規範

## 元件與 composable

- 一律使用 `<script setup lang="ts">`。
- Props 與 emits 用型別宣告：`defineProps<Props>()`、`defineEmits<{ change: [value: string] }>()`。預設值用 props 解構預設值語法。
- 雙向綁定用 `defineModel()`；模板 ref 用 `useTemplateRef()`。
- 元件只負責畫面；邏輯放在 `useXxx` composable，回傳 `ref` / `computed`。
- composable 建立的副作用（listener、timer、observer、EventSource）在同一個 composable 內用 `onScopeDispose` 清理。
- 不使用 `any`。

## 目錄

```
apps/web/src/
  api/            ApiClient 介面、httpClient、mockClient
  components/     共用元件（charts/、DataTable/、StatusBadge 等）
  composables/    useXxx
  stores/         Pinia setup store
  views/          路由頁面
  router/
```

## 資料取得

- 只透過 `ApiClient`（`api/`）取資料，元件與 composable 不直接呼叫 `fetch`。
- 型別與 schema 從 `@aiot/shared` 匯入，不在前端重複定義。
- 每個查詢 composable 回傳 `{ data, status, error, refresh }`，`status` 為 `'idle' | 'loading' | 'success' | 'empty' | 'error'`。
- 條件變動時 abort 前一個請求；逾時 10 秒視為錯誤。
- 頁面篩選條件同步到 URL query，重新整理與分享連結都能還原。

## 狀態管理（Pinia）

- 只有跨頁共用的狀態放 store：機台清單、最新讀值、連線狀態、告警計數。
- setup store 寫法；取值保持響應性用 `storeToRefs`。
- 頁面專屬查詢結果放 composable，不放 store。

## 即時資料

- SSE 連線全站只有一條，由 `useLiveStream` 管理並寫入 store；元件訂閱 store，不各自開連線。
- 即時讀值用固定長度的環形緩衝（例如每台 3600 點），不要無限 push。
- 高頻更新以 `requestAnimationFrame` 合併，一個 frame 最多更新一次圖表。

## 圖表

- 圖表一律使用 `components/charts/` 的封裝元件，規範見 `/chart-panel`。

## 資料持久化

- 業務資料（讀值、告警規則、確認紀錄）只存在後端資料庫，不寫入 `localStorage`。
- `localStorage` 只存 UI 偏好（主題、側欄收合、預設時間範圍），格式 `{ version: 1, data }`，讀取用 `try/catch`，版本不符就捨棄。

## 效能

- 列表固定 `:key`（不用 index）；超過約 1000 筆走伺服器分頁或虛擬化。
- 大陣列（時間序列）用 `shallowRef`，更新時整個替換。
- 路由頁面 lazy load；ECharts 按需引入。
- CPU 密集運算（LTTB、迴歸）可移到 Web Worker。
- 宣稱「更快」時要有量測：`performance.now()` 或頁面上顯示數據。

## 互動與無障礙

- 可點擊元素使用 `<button>`，連結使用 `<a>` / `RouterLink`。
- Modal、Dropdown 處理 focus trap、`Esc` 關閉，關閉後焦點回到觸發元素。
- 機台狀態以顏色 + 圖示 + 文字表示。
- 動畫尊重 `prefers-reduced-motion`。

## 時間與數字

- 傳遞與儲存一律 UTC 毫秒；顯示用 `Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei' })`。
- 數字用 `Intl.NumberFormat`，單位集中在 shared 的指標定義（例如 `°C`、`mm/s`、`%`）。

## 樣式

- scoped CSS + CSS 變數；顏色 token 集中在 `:root`，深色主題用 `[data-theme="dark"]` 覆寫。
- 狀態色（running / idle / alarm / offline）定義為 token，圖表與徽章共用。
- mobile-first，最小支援寬度 400px。
