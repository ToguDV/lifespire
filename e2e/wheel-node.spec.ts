import { expect, test } from '@playwright/test'

const DEMO_BUTTON = /Begin with demo data/i

async function startDemoRun(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: DEMO_BUTTON }).click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
}

/** Forces the first wheel node of the open day to be the current one. */
async function forceWheelCurrent(page: import('@playwright/test').Page): Promise<string> {
  const wheelId = await page.evaluate(() => {
    const raw = window.localStorage.getItem('lifespire:mvp0')
    if (!raw) throw new Error('missing save')
    const document = JSON.parse(raw) as {
      run?: { days?: Array<{ map?: { layers?: Array<Array<{ id: string; type: string }>>; boss?: { id: string; type: string } }; currentNodeId?: string | null }> }
    }
    const day = document.run?.days?.find((entry) => entry.map)
    const map = day?.map
    if (!day || !map) throw new Error('missing map')
    const wheel = (map.layers ?? []).flat().find((node) => node.type === 'wheel')
    if (!wheel) throw new Error('missing wheel node')
    day.currentNodeId = wheel.id
    map.currentNodeId = wheel.id
    window.localStorage.setItem('lifespire:mvp0', JSON.stringify(document))
    return wheel.id
  })
  await page.reload()
  return wheelId
}

test.describe('wheel node', () => {
  test('spin reveals the outcome and claim advances the map', async ({ page }) => {
    await startDemoRun(page)
    const wheelId = await forceWheelCurrent(page)

    await expect(page.getByRole('button', { name: /Spin the wheel/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Skip this step/i })).toBeVisible()

    await page.getByRole('button', { name: /Spin the wheel/i }).click()
    await expect(page.getByRole('status').filter({ hasText: /Spinning/i }).first()).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Claim reward/i }),
    ).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.wheel__result')).toBeVisible()

    await page.getByRole('button', { name: /Claim reward/i }).click()
    await expect(page.getByRole('heading', { name: /Your reward/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Done$/i })).toBeVisible()

    await page.getByRole('button', { name: /^Done$/i }).click()
    await expect(page.getByRole('status').filter({ hasText: /Wheel:/ }).first()).toBeVisible()
    await expect(page.locator(`button[data-node-id="${wheelId}"]`)).toHaveAttribute(
      'data-status',
      'completed',
    )

    await page.reload()
    await page.getByRole('button', { name: 'Map', exact: true }).first().click()
    await expect(page.locator(`button[data-node-id="${wheelId}"]`)).toHaveAttribute(
      'data-status',
      'completed',
    )
  })

  test('skip is available without spinning and advances without reward', async ({ page }) => {
    await startDemoRun(page)
    const wheelId = await forceWheelCurrent(page)

    await expect(page.getByRole('button', { name: /Spin the wheel/i })).toBeVisible()
    await page.getByRole('button', { name: /Skip this step/i }).click()

    await expect(page.locator(`button[data-node-id="${wheelId}"]`)).toHaveAttribute(
      'data-status',
      'skipped',
    )
  })

  test('the recap is a dead end until Done', async ({ page }) => {
    await startDemoRun(page)
    await forceWheelCurrent(page)

    await page.getByRole('button', { name: /Spin the wheel/i }).click()
    await expect(
      page.getByRole('button', { name: /Claim reward/i }),
    ).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: /Claim reward/i }).click()
    await expect(page.getByRole('heading', { name: /Your reward/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Done$/i })).toBeVisible()
    await expect(page.locator('.node-back')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Back to step/i })).toHaveCount(0)
  })
})
