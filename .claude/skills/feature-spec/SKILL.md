---
name: feature-spec
description: 在實作前先寫精簡規格：目標、範圍、狀態流程、API 介面、邊界情況與 Given-When-Then 驗收標準，存成 docs/PRD-<slug>.md，並同步 docs/TODO.md 與 docs/README.md。使用時機：/feature-spec <slug 或功能描述>，或使用者說「先規劃這個功能」「寫個規格」「需求拆解」。
argument-hint: <TODO 編號、slug 或功能描述>
---

# 功能規格

規格要短：一頁內寫完，重點是讓實作與測試有明確依據。面試時也能拿來說明「我怎麼拆需求」。

## 存放位置（必守）

- PRD 一律寫在 `docs/PRD-<slug>.md`，slug 與 `docs/TODO.md` 的連結一致。
- 在 `docs/README.md` 文件清單加一列（狀態 Draft），並把 `docs/TODO.md` 該列狀態改為「PRD 完成」。
- 範圍必須落在 `docs/PRD-aiot-monitor.md` 之內；需要超出總規格時，先詢問使用者並同步更新總規格。

## 原則

- **明確**：不寫「適當的延遲」「流暢的動畫」，要寫具體數值（例如 SSE 心跳 15 秒、圖表繪製點數 ≤ 2000）。
- **涵蓋邊界**：除了正常流程，一定要列出錯誤、空資料、極端輸入、快速重複操作、網路中斷、感測值缺漏。
- **前後端一起想**：牽涉 API 時，寫出路徑、query、回應 schema（放 `packages/shared`）與錯誤碼。
- **可驗收**：每個需求對應至少一條驗收標準，驗收標準要能直接寫成測試。
- **先澄清**：需求只有一句話時，先列出 3–5 個關鍵決策與建議選項（例如「降採樣在前端還是後端做？」），跟使用者確認後再寫。

## 步驟

1. 讀 `docs/PRD-aiot-monitor.md` 與 `docs/TODO.md` 該列的內容與依賴項目，確認依賴的 PRD 已完成或已有介面。
2. 必要時提出關鍵決策問題。
3. 用下方模板寫入 `docs/PRD-<slug>.md`，同步 README 與 TODO。
4. 有狀態轉換（載入、錯誤、重連等）時，附 Mermaid 狀態圖。
5. 回報規格摘要與建議實作順序。

## 模板

```markdown
# PRD：<功能名稱>（<slug>）

## 目標
<這個功能解決什麼問題、對應哪個面試考點（2–3 句）>

## 範圍
- **Must**：
- **Should**：
- **Won't**：

## 使用情境
- 身為 <廠長 / 設備工程師 / 品管 / 面試官>，我想要 <操作>，以便 <目的>。

## 狀態與流程
\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Loading : 送出查詢
    Loading --> Success : 回應成功
    Loading --> Empty : 無資料
    Loading --> Error : 回應失敗
    Error --> Loading : 重試
\`\`\`

## 資料與介面
- API：<方法 路徑、query、回應 schema 名稱>
- Shared：<新增的型別 / schema / 純函式>
- 前端：<元件 Props / Emits、composable 介面>

## 邊界情況
| 編號 | 情境 | 預期行為 |
|------|------|----------|
| EC-01 | | |

## 非功能需求
- 效能：<數值目標>
- 無障礙：<鍵盤操作、ARIA、圖表替代表格>
- RWD：<最小寬度 400px>

## 驗收標準
- [ ] AC-01：Given <前置條件>，When <操作>，Then <預期結果>

## 開發紀錄
<完成後補：實際做法、與規格的差異、量測數據>
```

## 與其他 skill 的關係

- `/new-page`、`/api-endpoint`、`/chart-panel`：實作以 PRD 的 Must 範圍為準，不額外擴充。
- `/add-tests`：每條 AC 與 EC 至少對應一個測試。
- `/showcase-review`：對照 PRD 列出未完成的 AC。
