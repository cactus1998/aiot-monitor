import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DataTable from '../DataTable.vue'
import type { Column } from '../table.ts'

interface Row {
  id: string
  value: number | null
}

const columns: Column<Row, 'value'>[] = [
  { key: 'id', label: 'ID', format: (r) => r.id },
  {
    key: 'value',
    label: '數值',
    sortKey: 'value',
    align: 'right',
    format: (r) => (r.value === null ? '—' : String(r.value)),
  },
]

function mountTable(props: Record<string, unknown> = {}) {
  return mount(DataTable, {
    // Generic SFCs infer T from props; the loose cast keeps the test setup short.
    props: {
      columns,
      rows: [
        { id: 'a', value: 1 },
        { id: 'b', value: null },
      ],
      rowKey: (r: Row) => r.id,
      total: 120,
      page: 1,
      pageSize: 50,
      sort: '-value',
      status: 'success',
      caption: '測試表格',
      ...props,
    } as never,
  })
}

describe('DataTable', () => {
  it('renders rows and shows an em dash for null', () => {
    const wrapper = mountTable()
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('—')
    expect(wrapper.text()).toContain('第 1–50 筆，共 120 筆')
  })

  // AC-01
  it('toggles sort direction from descending to ascending', async () => {
    const wrapper = mountTable({ sort: '-value' })
    await wrapper.find('th button').trigger('click')
    expect(wrapper.emitted('update:sort')).toEqual([['value']])
    const asc = mountTable({ sort: 'value' })
    await asc.find('th button').trigger('click')
    expect(asc.emitted('update:sort')).toEqual([['-value']])
    expect(wrapper.find('th[aria-sort="descending"]').exists()).toBe(true)
  })

  // AC-02
  it('disables previous buttons on the first page and next buttons on the last page', async () => {
    const first = mountTable({ page: 1 })
    expect(first.find('[aria-label="上一頁"]').attributes('disabled')).toBeDefined()
    expect(first.find('[aria-label="下一頁"]').attributes('disabled')).toBeUndefined()
    await first.find('[aria-label="最後一頁"]').trigger('click')
    expect(first.emitted('update:page')).toEqual([[3]])

    const last = mountTable({ page: 3 })
    expect(last.find('[aria-label="下一頁"]').attributes('disabled')).toBeDefined()
  })

  // AC-03
  it('shows loading skeleton, empty and error states', async () => {
    expect(mountTable({ status: 'loading', rows: [] }).findAll('.skeleton-row')).toHaveLength(5)
    expect(mountTable({ status: 'empty', rows: [], total: 0 }).text()).toContain('查無資料')
    const error = mountTable({ status: 'error', rows: [], error: '伺服器發生錯誤' })
    expect(error.text()).toContain('伺服器發生錯誤')
    await error.find('.state button').trigger('click')
    expect(error.emitted('retry')).toHaveLength(1)
  })

  it('emits rowClick on click and Enter', async () => {
    const wrapper = mountTable()
    const row = wrapper.find('tbody tr')
    await row.trigger('click')
    await row.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('rowClick')).toHaveLength(2)
  })
})
