# PRD：告警中心（alerts）

## 目標

示範「寫入」型的業務資料：告警規則與確認紀錄存在後端資料庫，重啟後仍在。

## 範圍

- **Must**：
  - 規則 CRUD：`GET / POST /api/alert-rules`、`PATCH / DELETE /api/alert-rules/:id`；body 以 `AlertRuleBodySchema` 驗證，`machineId` 必須是既有機台或 `null`（全部機台）。
  - 告警判定（shared `evaluateRule`）：條件持續 `durationSec` 秒才觸發一次；條件解除後重新計時；感測值 null 不觸發也不解除。
  - 告警紀錄：`GET /api/alerts?status=open|acked|all&machineId&limit`、`PATCH /api/alerts/:id/ack`（重複確認保留第一次時間）。
  - SSE `alert` 事件推播新告警；前端顯示通知（6 秒後自動關閉）、側欄未處理數字即時加一。
  - 告警中心頁 `/alerts`：紀錄列表（篩選同步 URL `?status=`）、確認按鈕、規則列表（啟用切換、編輯、兩段式刪除確認）、新增 / 編輯表單（前端同樣用 zod 驗證）。
  - 第一次啟動建立 3 條預設規則（見 `PRD-storage.md`）。
- **Won't**：通知 email / LINE、規則版本紀錄、權限。

## 邊界情況

| 編號 | 情境 | 預期行為 |
|------|------|----------|
| EC-01 | 規則 body 欄位錯誤（op 不是 gt / lt、未知機台、空 PATCH） | 400，表單顯示訊息 |
| EC-02 | 刪除或確認不存在的 id | 404 |
| EC-03 | 規則被刪除後 | 歷史告警仍保留觸發當下的規則快照 |
| EC-04 | 快速連點「確認」 | 按鈕在請求期間 disabled |

## 驗收標準

- [x] AC-01：新增、修改、刪除規則與確認告警後重新整理，結果仍在（總規格 AC-05）。
- [x] AC-02：路由測試涵蓋 CRUD、驗證錯誤、404、ack。
- [x] AC-03：`evaluateRule` 單元測試涵蓋持續時間、重新觸發、null。
- [x] AC-04：E2E 新增一條規則。

## 開發紀錄

- 2026-10-06：完成。刪除用「刪除 → 確認刪除」兩段式按鈕，不用 `window.confirm`。
