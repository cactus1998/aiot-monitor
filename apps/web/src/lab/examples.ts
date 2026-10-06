import type { Machine, Reading } from '@aiot/shared'
import { METRIC_KEYS, METRICS } from '@aiot/shared'

export interface LabInput {
  /** Latest reading of each machine. */
  latest: Reading[]
  /** Every buffered reading of the last minute, oldest first. */
  recent: Reading[]
  machines: Machine[]
}

export interface LabExample {
  id: string
  title: string
  method: string
  /** Does the method change the original array? */
  mutates: boolean
  note: string
  /** Shown verbatim; `run` executes the same logic. */
  code: string
  run: (input: LabInput) => unknown
}

export const LAB_EXAMPLES: LabExample[] = [
  {
    id: 'map',
    title: '每台機台的溫度標籤',
    method: 'map',
    mutates: false,
    note: '一對一轉換，回傳等長的新陣列。',
    code: `latest.map((r) => \`\${r.machineId}：\${r.temperature ?? '—'} °C\`)`,
    run: ({ latest }) => latest.map((r) => `${r.machineId}：${r.temperature ?? '—'} °C`),
  },
  {
    id: 'filter',
    title: '溫度超過警告值的機台',
    method: 'filter',
    mutates: false,
    note: `回傳符合條件的元素；警告值 ${METRICS.temperature.warn} °C。null 會被 > 比較排除。`,
    code: `latest
  .filter((r) => r.temperature !== null && r.temperature > ${METRICS.temperature.warn})
  .map((r) => r.machineId)`,
    run: ({ latest }) =>
      latest
        .filter((r) => r.temperature !== null && r.temperature > METRICS.temperature.warn)
        .map((r) => r.machineId),
  },
  {
    id: 'reduce',
    title: '全廠平均主軸負載（忽略缺值）',
    method: 'reduce',
    mutates: false,
    note: '把陣列累加成單一值；記得給初始值，空陣列才不會丟錯。',
    code: `const values = latest.map((r) => r.spindleLoad).filter((v) => v !== null)
const sum = values.reduce((acc, v) => acc + v, 0)
const avg = values.length ? sum / values.length : null`,
    run: ({ latest }) => {
      const values = latest.map((r) => r.spindleLoad).filter((v): v is number => v !== null)
      const sum = values.reduce((acc, v) => acc + v, 0)
      return {
        count: values.length,
        sum: Math.round(sum * 10) / 10,
        avg: values.length ? Math.round((sum / values.length) * 10) / 10 : null,
      }
    },
  },
  {
    id: 'groupBy',
    title: '依狀態分組',
    method: 'Object.groupBy',
    mutates: false,
    note: 'ES2024：回傳 { key: 元素[] }，原型為 null。總覽頁圓餅圖的資料就是這樣算出來的。',
    code: `const groups = Object.groupBy(latest, (r) => r.status)
Object.fromEntries(
  Object.entries(groups).map(([status, list]) => [status, list.map((r) => r.machineId)]),
)`,
    run: ({ latest }) => {
      const groups = Object.groupBy(latest, (r) => r.status)
      return Object.fromEntries(
        Object.entries(groups).map(([status, list]) => [status, list!.map((r) => r.machineId)]),
      )
    },
  },
  {
    id: 'reduceGroupBy',
    title: '用 reduce 手寫 groupBy（常見筆試題）',
    method: 'reduce',
    mutates: false,
    note: '不支援 Object.groupBy 的環境，用 reduce 搭配物件累加器。',
    code: `latest.reduce((acc, r) => {
  ;(acc[r.status] ??= []).push(r.machineId)
  return acc
}, {})`,
    run: ({ latest }) =>
      latest.reduce<Record<string, string[]>>((acc, r) => {
        ;(acc[r.status] ??= []).push(r.machineId)
        return acc
      }, {}),
  },
  {
    id: 'toSorted',
    title: '振動最高的三台',
    method: 'toSorted',
    mutates: false,
    note: 'ES2023：排序後回傳新陣列；sort() 會改變原陣列（在 Vue 的 reactive 陣列上會觸發不必要的更新）。',
    code: `latest
  .toSorted((a, b) => (b.vibration ?? -Infinity) - (a.vibration ?? -Infinity))
  .slice(0, 3)
  .map((r) => ({ machineId: r.machineId, vibration: r.vibration }))`,
    run: ({ latest }) =>
      latest
        .toSorted((a, b) => (b.vibration ?? -Infinity) - (a.vibration ?? -Infinity))
        .slice(0, 3)
        .map((r) => ({ machineId: r.machineId, vibration: r.vibration })),
  },
  {
    id: 'flatMap',
    title: '寬表轉長表（給圖表 / CSV 用）',
    method: 'flatMap',
    mutates: false,
    note: 'map 後攤平一層：每台機台展開成 4 列（每個指標一列）。',
    code: `latest.slice(0, 2).flatMap((r) =>
  METRIC_KEYS.map((metric) => ({ machineId: r.machineId, metric, value: r[metric] })),
)`,
    run: ({ latest }) =>
      latest
        .slice(0, 2)
        .flatMap((r) =>
          METRIC_KEYS.map((metric) => ({ machineId: r.machineId, metric, value: r[metric] })),
        ),
  },
  {
    id: 'findLast',
    title: '最近一筆非運轉中的讀值',
    method: 'findLast',
    mutates: false,
    note: 'ES2023：從尾端找，適合「依時間排序後找最新一筆」。找不到回傳 undefined。',
    code: `recent.findLast((r) => r.status !== 'running') ?? '最近一分鐘全部運轉中'`,
    run: ({ recent }) => {
      const r = recent.findLast((x) => x.status !== 'running')
      return r
        ? { machineId: r.machineId, status: r.status, ts: new Date(r.ts).toISOString() }
        : '最近一分鐘全部運轉中'
    },
  },
  {
    id: 'someEvery',
    title: '是否有異常？是否全部運轉？',
    method: 'some / every',
    mutates: false,
    note: 'some 找到一個就停；every 遇到一個不符合就停。空陣列：some → false、every → true。',
    code: `({
  anyAlarm: latest.some((r) => r.status === 'alarm'),
  allRunning: latest.every((r) => r.status === 'running'),
})`,
    run: ({ latest }) => ({
      anyAlarm: latest.some((r) => r.status === 'alarm'),
      allRunning: latest.every((r) => r.status === 'running'),
    }),
  },
  {
    id: 'sortPitfall',
    title: 'sort 預設比較的陷阱',
    method: 'sort',
    mutates: true,
    note: '沒有比較函式時 sort 以字串比較，[10, 9, 1] 會變成 [1, 10, 9]；而且 sort 會改變原陣列。',
    code: `const loads = [10, 9, 1]
const wrong = [...loads].sort()
const right = [...loads].sort((a, b) => a - b)
({ wrong, right, original: loads })`,
    run: () => {
      const loads = [10, 9, 1]
      const wrong = [...loads].sort()
      const right = [...loads].sort((a, b) => a - b)
      return { wrong, right, original: loads }
    },
  },
]
