<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import type { AlertFilter, AlertRule, AlertRuleBody, MetricKey } from '@aiot/shared'
import {
  ALERT_FILTERS,
  AlertRuleBodySchema,
  METRIC_KEYS,
  METRICS,
  RULE_OP_LABELS,
  RULE_OPS,
} from '@aiot/shared'
import { errorMessage } from '@/api'
import StateBlock from '@/components/StateBlock.vue'
import { useQuery } from '@/composables/useQuery.ts'
import { queryString, useUrlState } from '@/composables/useUrlState.ts'
import { useConnectionStore } from '@/stores/connection.ts'
import { useLiveStore } from '@/stores/live.ts'
import { formatDateTime, formatMetric } from '@/utils/format.ts'

const conn = useConnectionStore()
const live = useLiveStore()

// ----- alerts list -----
const FILTER_LABELS: Record<AlertFilter, string> = { open: '未處理', acked: '已確認', all: '全部' }
const { state, update } = useUrlState((q) => {
  const s = queryString(q, 'status')
  return {
    status: (ALERT_FILTERS as readonly string[]).includes(s ?? '') ? (s as AlertFilter) : 'open',
  }
})
const alerts = useQuery(
  () => ({ status: state.value.status }),
  (client, p, signal) => client.listAlerts({ status: p.status, limit: 200 }, signal),
  { isEmpty: (d) => d.items.length === 0 },
)
watch(
  () => alerts.data.value?.openCount,
  (count) => count !== undefined && live.setOpenAlerts(count),
)
// New alerts arrive over SSE: refresh the list.
watch(
  () => live.recentAlerts[0]?.id,
  () => void alerts.refresh(),
)

const acking = ref(new Set<number>())
const actionError = ref<string | null>(null)
async function ack(id: number): Promise<void> {
  if (!conn.client) return
  acking.value = new Set(acking.value).add(id)
  actionError.value = null
  try {
    await conn.client.ackAlert(id)
    await alerts.refresh()
  } catch (error) {
    actionError.value = errorMessage(error)
  } finally {
    const next = new Set(acking.value)
    next.delete(id)
    acking.value = next
  }
}

// ----- rules -----
const rules = useQuery(
  () => ({}),
  (client, _p, signal) => client.listAlertRules(signal),
  { isEmpty: (d) => d.items.length === 0 },
)

const emptyForm = (): AlertRuleBody => ({
  machineId: null,
  metric: 'temperature',
  op: 'gt',
  threshold: METRICS.temperature.alarm,
  durationSec: 10,
  enabled: true,
})
const form = ref<AlertRuleBody>(emptyForm())
const editingId = ref<number | null>(null)
const formError = ref<string | null>(null)
const saving = ref(false)
const confirmDelete = ref<number | null>(null)
const formHeading = useTemplateRef<HTMLHeadingElement>('formHeading')

function onMetricChange(metric: MetricKey): void {
  form.value.metric = metric
  if (editingId.value === null) form.value.threshold = METRICS[metric].alarm
}

async function edit(rule: AlertRule): Promise<void> {
  editingId.value = rule.id
  const { id: _id, ...body } = rule
  form.value = { ...body }
  formError.value = null
  await nextTick()
  formHeading.value?.focus()
}

function cancelEdit(): void {
  editingId.value = null
  form.value = emptyForm()
  formError.value = null
}

async function save(): Promise<void> {
  if (!conn.client) return
  const parsed = AlertRuleBodySchema.safeParse({
    ...form.value,
    threshold: Number(form.value.threshold),
    durationSec: Number(form.value.durationSec),
  })
  if (!parsed.success) {
    formError.value = parsed.error.issues.map((i) => `${i.path.join('.')}：${i.message}`).join('；')
    return
  }
  saving.value = true
  formError.value = null
  try {
    if (editingId.value === null) await conn.client.createAlertRule(parsed.data)
    else await conn.client.updateAlertRule(editingId.value, parsed.data)
    cancelEdit()
    await rules.refresh()
  } catch (error) {
    formError.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}

async function toggle(rule: AlertRule): Promise<void> {
  if (!conn.client) return
  try {
    await conn.client.updateAlertRule(rule.id, { enabled: !rule.enabled })
    await rules.refresh()
  } catch (error) {
    actionError.value = errorMessage(error)
  }
}

async function remove(id: number): Promise<void> {
  if (!conn.client) return
  try {
    await conn.client.deleteAlertRule(id)
    confirmDelete.value = null
    if (editingId.value === id) cancelEdit()
    await rules.refresh()
  } catch (error) {
    actionError.value = errorMessage(error)
  }
}

const ruleText = (r: Pick<AlertRule, 'metric' | 'op' | 'threshold' | 'durationSec'>) =>
  `${METRICS[r.metric].label} ${RULE_OP_LABELS[r.op]} ${formatMetric(r.metric, r.threshold)}，持續 ${r.durationSec} 秒`
const unit = computed(() => METRICS[form.value.metric].unit)
</script>

<template>
  <div class="alerts-page">
    <header class="page-header">
      <div>
        <h1>告警中心</h1>
        <p>規則與確認紀錄寫入資料庫；新告警由 SSE 即時推播。</p>
      </div>
    </header>
    <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>

    <section class="card" aria-labelledby="alerts-heading">
      <div class="section-head">
        <h2 id="alerts-heading">告警紀錄</h2>
        <div class="segmented" role="group" aria-label="篩選告警">
          <button
            v-for="f in ALERT_FILTERS"
            :key="f"
            type="button"
            :aria-pressed="state.status === f"
            @click="update({ status: f })"
          >
            {{ FILTER_LABELS[f]
            }}<template v-if="f === 'open'"
              >（{{ alerts.data.value?.openCount ?? live.openAlerts }}）</template
            >
          </button>
        </div>
      </div>
      <StateBlock v-if="alerts.status.value === 'loading' && !alerts.data.value" kind="loading" />
      <StateBlock
        v-else-if="alerts.status.value === 'error'"
        kind="error"
        :message="alerts.error.value ?? undefined"
        @retry="alerts.refresh"
      />
      <StateBlock
        v-else-if="alerts.status.value === 'empty'"
        kind="empty"
        :message="state.status === 'open' ? '目前沒有未處理的告警' : '沒有告警紀錄'"
      />
      <div v-else class="scroll">
        <table class="simple">
          <thead>
            <tr>
              <th>時間</th>
              <th>機台</th>
              <th>內容</th>
              <th>觸發值</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in alerts.data.value?.items ?? []" :key="a.id">
              <td>{{ formatDateTime(a.ts) }}</td>
              <td>
                <RouterLink :to="`/machines/${a.machineId}`">{{ a.machineId }}</RouterLink>
              </td>
              <td>
                {{ METRICS[a.metric].label }} {{ RULE_OP_LABELS[a.op] }}
                {{ formatMetric(a.metric, a.threshold) }}
              </td>
              <td class="value">{{ formatMetric(a.metric, a.value) }}</td>
              <td>
                <button
                  v-if="a.ackedAt === null"
                  type="button"
                  class="btn btn-sm"
                  :disabled="acking.has(a.id)"
                  @click="ack(a.id)"
                >
                  {{ acking.has(a.id) ? '確認中…' : '確認' }}
                </button>
                <span v-else class="muted">✓ 已確認 {{ formatDateTime(a.ackedAt) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="rules-grid">
      <section class="card" aria-labelledby="rules-heading">
        <h2 id="rules-heading">告警規則</h2>
        <StateBlock v-if="rules.status.value === 'loading' && !rules.data.value" kind="loading" />
        <StateBlock
          v-else-if="rules.status.value === 'error'"
          kind="error"
          :message="rules.error.value ?? undefined"
          @retry="rules.refresh"
        />
        <StateBlock
          v-else-if="rules.status.value === 'empty'"
          kind="empty"
          message="尚未建立規則"
        />
        <ul v-else class="rule-list">
          <li
            v-for="r in rules.data.value?.items ?? []"
            :key="r.id"
            :class="{ disabled: !r.enabled }"
          >
            <div>
              <strong>{{ r.machineId ?? '全部機台' }}</strong>
              <div class="muted">{{ ruleText(r) }}</div>
            </div>
            <div class="rule-actions">
              <label class="switch">
                <input type="checkbox" :checked="r.enabled" @change="toggle(r)" />
                {{ r.enabled ? '啟用' : '停用' }}
              </label>
              <button type="button" class="btn btn-sm" @click="edit(r)">編輯</button>
              <template v-if="confirmDelete === r.id">
                <button type="button" class="btn btn-sm btn-danger" @click="remove(r.id)">
                  確認刪除
                </button>
                <button type="button" class="btn btn-sm btn-ghost" @click="confirmDelete = null">
                  取消
                </button>
              </template>
              <button
                v-else
                type="button"
                class="btn btn-sm btn-danger"
                @click="confirmDelete = r.id"
              >
                刪除
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section class="card" aria-labelledby="form-heading">
        <h2 id="form-heading" ref="formHeading" tabindex="-1">
          {{ editingId === null ? '新增規則' : `編輯規則 #${editingId}` }}
        </h2>
        <form class="rule-form" novalidate @submit.prevent="save">
          <label class="field">
            機台
            <select v-model="form.machineId">
              <option :value="null">全部機台</option>
              <option v-for="m in live.machines" :key="m.id" :value="m.id">{{ m.id }}</option>
            </select>
          </label>
          <label class="field">
            指標
            <select
              :value="form.metric"
              @change="onMetricChange(($event.target as HTMLSelectElement).value as MetricKey)"
            >
              <option v-for="m in METRIC_KEYS" :key="m" :value="m">{{ METRICS[m].label }}</option>
            </select>
          </label>
          <label class="field">
            條件
            <select v-model="form.op">
              <option v-for="op in RULE_OPS" :key="op" :value="op">{{ RULE_OP_LABELS[op] }}</option>
            </select>
          </label>
          <label class="field">
            閾值（{{ unit }}）
            <input v-model.number="form.threshold" type="number" step="any" required />
          </label>
          <label class="field">
            持續秒數
            <input
              v-model.number="form.durationSec"
              type="number"
              min="0"
              max="3600"
              step="1"
              required
            />
          </label>
          <label class="field checkbox">
            <span><input v-model="form.enabled" type="checkbox" /> 啟用</span>
          </label>
          <p class="preview muted">預覽：{{ form.machineId ?? '全部機台' }} {{ ruleText(form) }}</p>
          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
          <div class="form-actions">
            <button v-if="editingId !== null" type="button" class="btn" @click="cancelEdit">
              取消
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? '儲存中…' : editingId === null ? '新增' : '儲存' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.alerts-page {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
h2 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}
h2:focus {
  outline: none;
}
.section-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.section-head h2 {
  margin: 0;
}
.scroll {
  overflow: auto;
  max-height: 420px;
}
.value {
  font-weight: 600;
  color: var(--color-alarm);
}
.rules-grid {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 0.75rem;
  align-items: start;
}
.rule-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.rule-list li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.875rem;
}
.rule-list li.disabled {
  opacity: 0.6;
}
.rule-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.switch {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
}
.rule-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}
.checkbox {
  justify-content: flex-end;
}
.preview,
.rule-form .form-error,
.form-actions {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.8rem;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
@media (max-width: 900px) {
  .rules-grid {
    grid-template-columns: 1fr;
  }
}
</style>
