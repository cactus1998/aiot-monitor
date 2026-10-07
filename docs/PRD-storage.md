# PRD：資料儲存（storage）

## 目標

業務資料持久化在後端：模擬器產生的讀值寫入後端 SQLite 檔案，重啟 API 後資料仍在；前端只讀 API，不寫 localStorage。

## 範圍

- **Must**：
  - `node:sqlite`（`DatabaseSync`），DB 檔 `apps/api/data/aiot.db`（`DB_PATH` 可覆寫，測試用 `:memory:`）。
  - 啟動時 migration（`CREATE TABLE IF NOT EXISTS`）、WAL、`foreign_keys = ON`。
  - 資料表：`machines`、`readings`（主鍵 `(machine_id, ts)`、`WITHOUT ROWID`，另建 `ts` 索引）、`alert_rules`、`alerts`。
  - repository 層：SQL 只寫在 `apps/api/src/db/*`，回傳 camelCase 物件；路由不寫 SQL。
  - 寫入流程（`services/ingest.ts`）：
    - 啟動時 `readings` 為空或最新一筆早於 24 小時前：回填過去 24 小時、每分鐘一筆，單一 transaction；回填期間同時套用告警規則，產生歷史告警。
    - 否則以 DB 最新讀值還原模擬器累計值，接續產生。
    - 每秒 tick：推播給 SSE、更新記憶體中的最新狀態、判定告警。
    - 每 10 秒寫入一筆 / 台。
    - 每 10 分鐘刪除 24 小時前的讀值與 7 天前的告警。
  - 第一次啟動建立預設告警規則：溫度 > 85°C 持續 10 秒、振動 > 7.1 mm/s 持續 5 秒、主軸負載 > 95% 持續 30 秒。
- **Won't**：時間序列資料庫、多節點寫入。

## 資料與介面

| 表 | 欄位 | 索引 / 備註 |
|----|------|-------------|
| `machines` | `id` PK, `name`, `type`, `line`, `ideal_cycle_sec` | 啟動時 `INSERT OR IGNORE` |
| `readings` | `machine_id`, `ts`, `temperature`, `vibration`, `spindle_load`, `rpm`, `status`, `output`, `good` | PK `(machine_id, ts)`、`idx_readings_ts(ts)` |
| `alert_rules` | `id` PK, `machine_id?`, `metric`, `op`, `threshold`, `duration_sec`, `enabled` | |
| `alerts` | `id` PK, `rule_id`, `machine_id`, `metric`, `op`, `threshold`, `ts`, `value`, `acked_at?` | 保存觸發當下的規則快照；`idx_alerts_ts`、`idx_alerts_open` |

環境變數：`DB_PATH`、`SEED`（42）、`BACKFILL_HOURS`（24）、`WRITE_INTERVAL_SEC`（10）、`RETENTION_HOURS`（24）。

## 邊界情況

| 編號 | 情境 | 預期行為 |
|------|------|----------|
| EC-01 | `data/` 目錄不存在 | 自動建立 |
| EC-02 | 重啟 API | 不重新回填；累計產量接續，不倒退 |
| EC-03 | DB 最新資料超過 24 小時 | 視同過期，重新回填 |
| EC-04 | 同一 `(machine_id, ts)` 重複寫入 | `INSERT OR IGNORE`，不報錯 |

## 驗收標準

- [x] AC-01：刪除 DB 檔後啟動，3 秒內完成回填，筆數約 8 × 1440。
- [x] AC-02：重啟後歷史資料、告警規則與確認紀錄仍在（總規格 AC-05）。
- [x] AC-03：`EXPLAIN QUERY PLAN` 顯示讀值查詢使用主鍵或索引，不是全表掃描。
- [x] AC-04：保留期清理只刪除超過 24 小時的讀值。

## 開發紀錄

- 2026-10-06：完成。`readings` 用 `WITHOUT ROWID` 讓主鍵 `(machine_id, ts)` 成為叢集索引，依機台查時間範圍時資料在磁碟上相鄰。
