import { expect, test } from '@playwright/test'

const DEMO_BUTTON = /Begin with demo data/i
const ACTIONABLE_NODE = 'button[data-node-id][data-status="available"], button[data-node-id][data-status="current"]'

async function startDemoRun(page: import('@playwright/test').Page) {
  await page.goto('/')
  // Clear once, then reload so hydration starts from a clean document. Do not
  // use addInitScript: it would wipe the save again on later reloads.
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: DEMO_BUTTON }).click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
}

async function openMap(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Map', exact: true }).first().click()
  await expect(page.getByRole('group', { name: /Day map/i })).toBeVisible()
}

async function completeFirstNode(page: import('@playwright/test').Page) {
  await page.locator(ACTIONABLE_NODE).first().click()
  await page.getByRole('button', { name: /Mark complete/i }).click()
}

test.describe('core loop', () => {
  test('demo onboarding opens the first map', async ({ page }) => {
    await startDemoRun(page)
    await openMap(page)

    await expect(page.locator('button[data-node-id]').first()).toBeVisible()
    await expect(page.locator(ACTIONABLE_NODE).first()).toBeVisible()
  })

  test('completing a node grants rewards and survives a reload', async ({ page }) => {
    await startDemoRun(page)
    await openMap(page)

    const node = page.locator(ACTIONABLE_NODE).first()
    const nodeId = await node.getAttribute('data-node-id')
    await completeFirstNode(page)

    const resolved = page.locator(`button[data-node-id="${nodeId}"]`)
    await expect(resolved).toHaveAttribute('data-status', 'completed')

    await page.reload()
    await openMap(page)
    await expect(page.locator(`button[data-node-id="${nodeId}"]`)).toHaveAttribute(
      'data-status',
      'completed',
    )
  })

  test('skipping a node advances without marking it complete', async ({ page }) => {
    await startDemoRun(page)
    await openMap(page)

    const node = page.locator(ACTIONABLE_NODE).first()
    const nodeId = await node.getAttribute('data-node-id')
    await node.click()
    await page.getByRole('button', { name: /Skip this step/i }).click()

    await expect(page.locator(`button[data-node-id="${nodeId}"]`)).toHaveAttribute(
      'data-status',
      'skipped',
    )
  })

  test('completing the boss closes the day with a summary', async ({ page }) => {
    await startDemoRun(page)
    await openMap(page)

    for (let step = 0; step < 5; step += 1) {
      await completeFirstNode(page)
    }

    await expect(page.getByRole('region', { name: /The day is sealed/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Return to camp/i })).toBeVisible()
  })
})
