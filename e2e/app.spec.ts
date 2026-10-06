import { expect, test } from '@playwright/test'

test.describe('overview', () => {
  test('shows 8 machines, KPIs and the status pie in mock mode', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('heading', { name: '總覽', level: 1 })).toBeVisible()
    await expect(page.getByText('模擬資料').first()).toBeVisible()
    await expect(page.locator('.machine-card')).toHaveCount(8)
    await expect(page.getByText('今日 OEE')).toBeVisible()
    await expect(page.getByRole('img', { name: /機台狀態分布/ })).toBeVisible()
  })

  test('machine cards update every second', async ({ page }) => {
    await page.goto('./')
    const card = page.locator('.machine-card').first()
    await expect(card).toBeVisible()
    const before = await card.textContent()
    await expect.poll(async () => card.textContent(), { timeout: 5000 }).not.toBe(before)
  })
})

test.describe('machine detail', () => {
  test('switches ranges and keeps the range in the URL', async ({ page }) => {
    await page.goto('./#/machines/CNC-01')
    await expect(page.getByRole('heading', { name: /CNC 加工機 01/ })).toBeVisible()
    await expect(page.getByRole('img', { name: /CNC-01 溫度/ })).toBeVisible()
    await page.getByRole('button', { name: '24 小時' }).click()
    await expect(page).toHaveURL(/range=24h/)
    await expect(page.getByText(/繪製 [\d,]+ 點/).first()).toBeVisible()
    const drawn = await page
      .getByText(/繪製 [\d,]+ 點/)
      .first()
      .textContent()
    expect(Number(drawn!.replace(/\D/g, ''))).toBeLessThanOrEqual(2000)
  })

  test('shows a not-found message for an unknown machine', async ({ page }) => {
    await page.goto('./#/machines/NOPE')
    await expect(page.getByText('找不到機台 NOPE')).toBeVisible()
    await expect(page.getByRole('region', { name: /溫度/ })).toHaveCount(0)
  })
})

test.describe('history', () => {
  test('table and chart show the same query, sorting and CSV export work', async ({ page }) => {
    await page.goto('./#/history')
    await expect(page.getByRole('heading', { name: '歷史查詢', level: 1 })).toBeVisible()
    await expect(page.getByText(/共 [\d,]+ 筆/)).toBeVisible()
    await expect(page.getByRole('img', { name: /歷史折線圖/ })).toBeVisible()

    await page.getByRole('button', { name: /溫度/ }).click()
    await expect(page).toHaveURL(/sort=-temperature/)

    // The export button is enabled once the table has loaded and shows the total.
    const exportButton = page.getByRole('button', { name: /匯出 CSV/ })
    await expect(exportButton).toBeEnabled()
    const total = Number((await exportButton.textContent())!.replace(/\D/g, ''))
    expect(total).toBeGreaterThan(0)
    const download = page.waitForEvent('download')
    await exportButton.click()
    const file = await download
    const stream = await file.createReadStream()
    let text = ''
    for await (const chunk of stream) text += chunk.toString()
    expect(text.trimEnd().split('\n')).toHaveLength(total + 1)
  })

  test('blocks a range longer than 24 hours', async ({ page }) => {
    await page.goto('./#/history')
    await page.getByLabel('開始時間（台北）').fill('2026-01-01T00:00')
    await page.getByLabel('結束時間（台北）').fill('2026-01-03T00:00')
    await page.getByRole('button', { name: '查詢' }).click()
    await expect(
      page.getByRole('alert').filter({ hasText: '查詢範圍不可超過 24 小時' }),
    ).toBeVisible()
  })

  test('restores filters from the URL after reload', async ({ page }) => {
    await page.goto('./#/history?machineId=MLD-02&metric=vibration')
    await expect(page.getByRole('heading', { name: /振動 RMS趨勢（MLD-02）/ })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: /振動 RMS趨勢（MLD-02）/ })).toBeVisible()
  })
})

test.describe('responsive layout', () => {
  test.use({ viewport: { width: 400, height: 800 } })

  for (const path of [
    './',
    './#/machines/CNC-01',
    './#/history',
    './#/alerts',
    './#/lab/array',
    './#/about',
  ]) {
    test(`has no horizontal overflow at 400px: ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('main h1').first()).toBeVisible()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})

test.describe('alerts', () => {
  test('creates a rule and lists alerts', async ({ page }) => {
    await page.goto('./#/alerts')
    await expect(page.getByRole('heading', { name: '告警規則' })).toBeVisible()
    const rules = page.locator('.rule-list li')
    // Three default rules are created on first start.
    await expect(rules).toHaveCount(3)
    await page.getByLabel('持續秒數').fill('20')
    await page.getByRole('button', { name: '新增' }).click()
    await expect(rules).toHaveCount(4)
    await expect(page.getByRole('heading', { name: '告警紀錄' })).toBeVisible()
  })
})
