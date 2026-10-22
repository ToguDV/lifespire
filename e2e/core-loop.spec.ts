import { expect, test } from '@playwright/test'

const DEMO_BUTTON = /Begin with demo data/i
const ACTIONABLE_NODE = 'button[data-node-id][data-status="available"], button[data-node-id][data-status="current"]'

async function readMapLayerCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('lifespire:mvp0')
    const document = JSON.parse(raw ?? '{}') as {
      run?: { days?: Array<{ map?: { layers?: unknown[] } }> }
    }
    const day = document.run?.days?.find((entry) => entry.map)
    return day?.map?.layers?.length ?? 0
  })
}

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

    const layerCount = await readMapLayerCount(page)
    expect(layerCount).toBeGreaterThanOrEqual(3)
    expect(layerCount).toBeLessThanOrEqual(5)

    for (let step = 0; step < layerCount + 1; step += 1) {
      await completeFirstNode(page)
    }

    await expect(page.getByRole('region', { name: /The day is sealed/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Return to camp/i })).toBeVisible()
  })
})

test.describe('map shape', () => {
  test('layers hold two to five nodes and only connect to their neighbours', async ({ page }) => {
    await startDemoRun(page)
    await openMap(page)

    const map = await page.evaluate(() => {
      const raw = window.localStorage.getItem('lifespire:mvp0')
      const document = JSON.parse(raw ?? '{}') as {
        run: { days: Array<{ map: unknown }> }
      }
      const day = document.run.days.find((entry) => entry.map)
      return day?.map as
        | {
            layers: Array<{
              id: string
              connections: string[]
            }[]>
          }
        | undefined
    })

    expect(map).toBeDefined()
    const layers = map?.layers ?? []
    expect(layers.length).toBeGreaterThanOrEqual(3)
    expect(layers.length).toBeLessThanOrEqual(5)

    for (const layer of layers) {
      expect(layer.length).toBeGreaterThanOrEqual(2)
      expect(layer.length).toBeLessThanOrEqual(5)
    }

    layers.forEach((layer, layerIndex) => {
      const next = layers[layerIndex + 1]
      if (!next) return
      layer.forEach((node, nodeIndex) => {
        for (const targetId of node.connections) {
          const targetIndex = next.findIndex((target) => target.id === targetId)
          expect(targetIndex).toBeGreaterThanOrEqual(0)
          expect(Math.abs(nodeIndex - targetIndex)).toBeLessThanOrEqual(1)
        }
      })
    })
  })
})

test.describe('mobile map labels', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('first tap reveals the task name and the second opens the node', async ({ page }) => {
    await startDemoRun(page)
    await openMap(page)

    const node = page.locator(ACTIONABLE_NODE).first()
    const label = node.locator('.node__label')

    await expect(label).toBeHidden()

    await node.tap()
    await expect(label).toBeVisible()
    await expect(page.getByRole('group', { name: /Day map/i })).toBeVisible()

    await node.tap()
    await expect(page.getByRole('button', { name: /Mark complete/i })).toBeVisible()
  })
})
