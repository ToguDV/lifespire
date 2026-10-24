import { expect, test } from '@playwright/test'

const DEMO_BUTTON = /Begin with demo data/i
const ACTIONABLE_NODE =
  'button[data-node-id][data-status="available"], button[data-node-id][data-status="current"]'

async function startDemoRun(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: DEMO_BUTTON }).click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
}

async function openMap(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Map', exact: true }).first().click()
  await expect(page.getByRole('group', { name: /Day map/i })).toBeVisible()
}

test.describe('quiet juice', () => {
  test('completing a node shows the rich reward toast', async ({ page }) => {
    await startDemoRun(page)
    await openMap(page)

    await page.locator(ACTIONABLE_NODE).first().click()
    const spin = page.getByRole('button', { name: /Spin the wheel/i })
    const mark = page.getByRole('button', { name: /Mark complete/i })
    await expect(spin.or(mark)).toBeVisible()
    if (await spin.isVisible()) {
      await spin.click()
      await page.getByRole('button', { name: /^Done$/i }).click({ timeout: 25000 })
    } else {
      await mark.click()
    }

    const toast = page.locator('.reward-toast')
    await expect(toast).toBeVisible()
    await expect(toast).toContainText(/\+.*(XP|gold)|weekly/i)

    await toast.getByRole('button', { name: /Dismiss/i }).click()
    await expect(toast).toBeHidden()
  })

  test('settings offers sound and vibration toggles, on by default', async ({ page }) => {
    await startDemoRun(page)
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click()

    const sound = page.getByRole('switch', { name: 'Sound' })
    const haptics = page.getByRole('switch', { name: 'Vibration' })
    await expect(sound).toHaveAttribute('aria-checked', 'true')
    await expect(haptics).toHaveAttribute('aria-checked', 'true')

    await sound.click()
    await expect(sound).toHaveAttribute('aria-checked', 'false')
    await page.reload()
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
    await expect(page.getByRole('switch', { name: 'Sound' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  test('sealing the day staggers the path rows', async ({ page }) => {
    await startDemoRun(page)
    await openMap(page)

    const layerCount = await page.evaluate(() => {
      const raw = window.localStorage.getItem('lifespire:mvp0')
      const document = JSON.parse(raw ?? '{}') as {
        run?: { days?: Array<{ map?: { layers?: unknown[] } }> }
      }
      return document.run?.days?.find((entry) => entry.map)?.map?.layers?.length ?? 0
    })

    for (let step = 0; step < layerCount + 1; step += 1) {
      const actionable = page.locator(ACTIONABLE_NODE).first()
      await actionable.click()
      const spin = page.getByRole('button', { name: /Spin the wheel/i })
      const mark = page.getByRole('button', { name: /Mark complete/i })
      await expect(spin.or(mark)).toBeVisible()
      if (await spin.isVisible()) {
        await spin.click()
        await page.getByRole('button', { name: /^Done$/i }).click({ timeout: 25000 })
      } else {
        await mark.click()
      }
    }

    await expect(page.getByRole('region', { name: /The day is sealed/i })).toBeVisible()
    await expect(page.locator('.path-row--enter').first()).toBeVisible()
  })
})
