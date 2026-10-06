# PRD：機台模擬器（simulator）

## 目標

沒有真實機台時，用可重現的模擬資料代替感測器。同一份程式在 Node（API 寫入 DB）與瀏覽器（mock 模式）執行，面試時可說明「資料從哪裡來」與「換成 MQTT 時要改哪一層」。

## 範圍

- **Must**：
  - seeded PRNG（mulberry32），同一個 seed 與相同 tick 序列產生完全相同的讀值。
  - 8 台機台設定檔：CNC-01～03（A 線、理想週期 45 秒）、MLD-01～03（B 線射出成型、30 秒）、GRD-01～02（C 線研磨、60 秒）。
  - `tick(ts)` 以時間差推進狀態，可用每秒（即時）或每分鐘（回填）步進。
  - 正常波動：溫度向目標值收斂加雜訊；振動、負載、轉速依機型基準值波動。
  - 狀態：`running`、`idle`（換線，隨機 1–5 分鐘）、`alarm`（溫度或振動超過告警閾值）、`offline`（停機異常）。
  - 產量與良品數為累計值；運轉中依理想週期 × 1.05–1.25 完成一個工件，良率約 97%，異常期間約 85%。
  - 異常注入：`overheat`（漸進升溫，最多 +40°C）、`vibration`（振動 ×3.5，30–90 秒）、`stoppage`（停機 2–5 分鐘）；隨機發生（每台每小時約 0.4 次）或以 `inject()` 手動觸發。
  - 感測值缺漏：每個欄位 0.2% 機率為 `null`。
  - `initial` 參數：以 DB 最新讀值還原累計產量與溫度，API 重啟後數字連續。
- **Won't**：MQTT adapter 實作（只在文件說明）。

## 資料與介面

```ts
createSimulator({ seed, startTs, machines?, initial?, anomalyRatePerHour?, dropoutRate? }): Simulator
interface Simulator {
  machines: Machine[]
  tick(ts: number): Reading[]           // ts 必須遞增；回傳每台一筆
  inject(machineId, kind, durationSec?): boolean
  anomalies(): { machineId, kind, remainingSec }[]
}
generateHistory(sim, from, to, stepMs): Reading[]
```

## 邊界情況

| 編號 | 情境 | 預期行為 |
|------|------|----------|
| EC-01 | `tick` 的 ts 未遞增 | 回傳上一筆狀態，不倒退 |
| EC-02 | 不存在的機台 inject | 回傳 false |
| EC-03 | 大步進（60 秒） | 機率以 `1 - e^(-rate·dt)` 換算，與每秒步進的統計行為一致 |

## 驗收標準

- [x] AC-01：相同 seed 產生相同結果；不同 seed 結果不同。
- [x] AC-02：產量與良品數只增不減，良品數 ≤ 產量。
- [x] AC-03：inject `overheat` 後溫度上升並出現 `alarm`；`stoppage` 期間狀態為 `offline` 且產量不變。
- [x] AC-04：24 小時回填（每分鐘一筆）在 Node 執行時間 < 500ms。

## 開發紀錄

- 2026-10-06：完成。24 小時 × 8 台回填約 1.15 萬筆，測試中耗時約數十毫秒。
