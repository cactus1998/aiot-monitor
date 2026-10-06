<script setup lang="ts">
import { useConnectionStore } from '@/stores/connection.ts'

const conn = useConnectionStore()

const tables = [
  {
    name: 'readings',
    columns: 'machine_id, ts, temperature, vibration, spindle_load, rpm, status, output, good',
    note: '主鍵 (machine_id, ts)、WITHOUT ROWID：同一台機台的時間序列在磁碟上相鄰；另建 ts 索引給跨機台查詢。保留 24 小時。',
  },
  {
    name: 'machines',
    columns: 'id, name, type, line, ideal_cycle_sec',
    note: '8 台機台設定，啟動時寫入。',
  },
  {
    name: 'alert_rules',
    columns: 'id, machine_id?, metric, op, threshold, duration_sec, enabled',
    note: '告警規則；machine_id 為 NULL 表示套用到全部機台。',
  },
  {
    name: 'alerts',
    columns: 'id, rule_id, machine_id, metric, op, threshold, ts, value, acked_at?',
    note: '告警紀錄與確認時間；保存觸發當下的規則快照，規則改了歷史也不變。',
  },
]

const choices = [
  [
    '前端',
    'Vue 3 + TypeScript + Vite + Pinia + Vue Router',
    '組合式 API 方便把資料邏輯抽成 composable；hash 路由可部署在任何靜態主機子路徑',
  ],
  [
    '圖表',
    'Apache ECharts + vue-echarts（按需引入）',
    '折線、圓餅、儀表、長條、dataZoom、閾值線全內建；按需引入控制打包體積',
  ],
  ['後端', 'Node.js 22 + Fastify 5', 'schema 驗證與序列化內建、inject() 測試不必開 port'],
  ['資料庫', 'SQLite（node:sqlite）', '零安裝、單一檔案；以索引、分桶查詢與保留期控制資料量'],
  ['即時', 'Server-Sent Events', '單向推播足夠；瀏覽器自動重連並帶 Last-Event-ID；可穿過反向代理'],
  [
    '契約',
    'zod（packages/shared）',
    '同一份 schema：後端驗證請求與回應、前端驗證 API 回應、產生 OpenAPI 文件',
  ],
  ['測試', 'Vitest、@vue/test-utils、Playwright', '純函式、API 路由、元件、E2E 四層'],
]
</script>

<template>
  <div class="about">
    <header class="page-header">
      <div>
        <h1>架構說明</h1>
        <p>資料從哪裡來、存在哪裡、怎麼變成圖表。</p>
      </div>
    </header>

    <section class="card" aria-labelledby="flow-heading">
      <h2 id="flow-heading">資料流</h2>
      <svg class="diagram" viewBox="0 0 860 300" role="img" aria-labelledby="flow-title flow-desc">
        <title id="flow-title">系統資料流</title>
        <desc id="flow-desc">
          模擬器每秒產生 8 台機台讀值；API 每 10 秒寫一筆到 SQLite，並以 SSE
          每秒推播給瀏覽器；瀏覽器透過 REST 查詢歷史資料並以 ECharts 繪圖。
        </desc>
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 10 5 0 10z" class="arrow-head" />
          </marker>
        </defs>
        <g class="box">
          <rect x="20" y="40" width="190" height="80" rx="10" />
          <text x="115" y="72">packages/simulator</text>
          <text x="115" y="96" class="sub">8 台機台 · 每秒 tick</text>
        </g>
        <g class="box">
          <rect x="330" y="40" width="200" height="80" rx="10" />
          <text x="430" y="72">apps/api（Fastify）</text>
          <text x="430" y="96" class="sub">REST · SSE · 告警判定</text>
        </g>
        <g class="box db">
          <rect x="330" y="190" width="200" height="80" rx="10" />
          <text x="430" y="222">SQLite 檔案</text>
          <text x="430" y="246" class="sub">apps/api/data/aiot.db</text>
        </g>
        <g class="box">
          <rect x="650" y="40" width="190" height="80" rx="10" />
          <text x="745" y="72">apps/web（Vue 3）</text>
          <text x="745" y="96" class="sub">Pinia · ECharts</text>
        </g>
        <g class="box shared">
          <rect x="650" y="190" width="190" height="80" rx="10" />
          <text x="745" y="222">packages/shared</text>
          <text x="745" y="246" class="sub">zod schema · 純函式</text>
        </g>
        <path d="M210 80H330" class="line" marker-end="url(#arrow)" />
        <text x="270" y="70" class="label">讀值</text>
        <path d="M410 120V190" class="line" marker-end="url(#arrow)" />
        <text x="404" y="160" class="label end">每 10 秒寫入</text>
        <path d="M450 190V120" class="line" marker-end="url(#arrow)" />
        <text x="456" y="160" class="label start">查詢</text>
        <path d="M530 70H650" class="line" marker-end="url(#arrow)" />
        <text x="590" y="62" class="label">SSE 每秒</text>
        <path d="M650 100H530" class="line" marker-end="url(#arrow)" />
        <text x="590" y="116" class="label">REST 查詢</text>
        <path d="M745 190V120" class="line dashed" />
        <path d="M650 230H600V112H530" class="line dashed" />
        <text x="606" y="180" class="label start">共用型別</text>
      </svg>
      <p class="muted small">
        目前模式：<strong>{{
          conn.isMock
            ? '模擬資料（瀏覽器內執行 simulator，資料只在記憶體）'
            : 'API（資料在後端 SQLite）'
        }}</strong
        >。 前端只把 UI 偏好（深淺色主題）存在 localStorage，業務資料一律在後端資料庫。
      </p>
    </section>

    <section class="card" aria-labelledby="store-heading">
      <h2 id="store-heading">資料存在哪裡</h2>
      <ul class="facts">
        <li>
          <strong>寫入頻率</strong>：SSE 每秒推播即時值；資料庫每 10 秒寫一筆 / 台，降低寫入量。
        </li>
        <li>
          <strong>啟動回填</strong>：資料庫為空時，以固定 seed 產生過去 24 小時、每分鐘一筆，約 1.2
          萬筆。
        </li>
        <li><strong>保留期</strong>：每 10 分鐘刪除 24 小時前的讀值，資料量上限約 7 萬筆。</li>
        <li>
          <strong>查詢</strong>：圖表走 <code>/series</code> 在 SQL 以
          <code>GROUP BY (ts - from) / bucket</code> 分桶，繪製點數 ≤ 2000；表格走分頁。
        </li>
        <li>
          <strong>斷線補資料</strong>：伺服器在記憶體保留最近 300 秒的 tick，依 Last-Event-ID 補送。
        </li>
        <li>
          <strong>正式環境</strong>：資料量變大時可換 TimescaleDB / InfluxDB，repository 層隔離了
          SQL，前端與 API 介面不變。
        </li>
      </ul>
      <div class="scroll">
        <table class="simple">
          <thead>
            <tr>
              <th>資料表</th>
              <th>欄位</th>
              <th>說明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tables" :key="t.name">
              <td>
                <code>{{ t.name }}</code>
              </td>
              <td class="wrap">
                <code>{{ t.columns }}</code>
              </td>
              <td class="wrap">{{ t.note }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card" aria-labelledby="tech-heading">
      <h2 id="tech-heading">技術選型</h2>
      <div class="scroll">
        <table class="simple">
          <thead>
            <tr>
              <th>項目</th>
              <th>選擇</th>
              <th>理由</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="[k, v, why] in choices" :key="k">
              <td>{{ k }}</td>
              <td class="wrap">{{ v }}</td>
              <td class="wrap">{{ why }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted small">
        API 文件：<a href="/api/docs" target="_blank" rel="noopener">/api/docs</a
        >（OpenAPI，由同一份 zod schema 產生；需啟動後端）。
      </p>
    </section>
  </div>
</template>

<style scoped>
.about {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
h2 {
  margin: 0 0 0.6rem;
  font-size: 1rem;
}
.diagram {
  width: 100%;
  max-height: 320px;
}
.box rect {
  fill: var(--color-surface-2);
  stroke: var(--color-primary);
  stroke-width: 1.5;
}
.box.db rect {
  stroke: var(--status-running);
}
.box.shared rect {
  stroke: var(--color-forecast);
  stroke-dasharray: 5 4;
}
.box text {
  fill: var(--color-text);
  text-anchor: middle;
  font-size: 15px;
  font-weight: 600;
}
.box text.sub {
  fill: var(--color-text-muted);
  font-size: 12px;
  font-weight: 400;
}
.line {
  stroke: var(--color-text-muted);
  stroke-width: 1.6;
  fill: none;
}
.line.dashed {
  stroke-dasharray: 4 4;
}
.arrow-head {
  fill: var(--color-text-muted);
}
.label {
  fill: var(--color-text-muted);
  font-size: 12px;
  text-anchor: middle;
}
.label.end {
  text-anchor: end;
}
.label.start {
  text-anchor: start;
}
.facts {
  margin: 0 0 0.75rem;
  padding-left: 1.2rem;
  font-size: 0.9rem;
}
.facts li {
  margin-bottom: 0.3rem;
}
.scroll {
  overflow-x: auto;
}
.wrap {
  white-space: normal !important;
}
.small {
  font-size: 0.8rem;
  margin: 0.6rem 0 0;
}
</style>
