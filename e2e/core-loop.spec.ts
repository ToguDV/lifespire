import { expect, test } from '@playwright/test'
import {
  MAX_DECISION_LAYERS,
  MAX_LAYER_NODES,
  MIN_DECISION_LAYERS,
  MIN_LAYER_NODES,
} from '../src/domain/balance'

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
  const spin = page.getByRole('button', { name: /Spin the wheel/i })
  const mark = page.getByRole('button', { name: /Mark complete/i })
  await expect(spin.or(mark)).toBeVisible()
  if (await spin.isVisible()) {
    await spin.click()
    await page.getByRole('button', { name: /Claim reward/i }).click({ timeout: 15000 })
  } else {
    await mark.click()
  }
}

test.describe('core loop', () => {
  test('demo onboarding opens the first map', async ({ page }) => {
    await startDemoRun(page)
    await openMap(page)

    await expect(page.locator('button[data-node-id]').first()).toBeVisible()
    await expect(page.locator(ACTIONABLE_NODE).first()).toBeVisible()
    // Demo goals (Wayfarer, Craft) mark their task-bearing nodes with a crest.
    await expect(
      page.locator(
        'button[data-node-id][data-node-icon="compass"], button[data-node-id][data-node-icon="quill"]',
      ).first(),
    ).toBeVisible()
  })

  test('editing a goal crest updates the open map', async ({ page }) => {
    await startDemoRun(page)
    await openMap(page)

    await expect(
      page.locator('button[data-node-id][data-node-icon="compass"]').first(),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Goals', exact: true }).first().click()
    await page.getByRole('button', { name: 'Edit goal Wayfarer' }).click()
    await page.locator('.icon-picker__tile').filter({ hasText: 'Heart' }).click()
    await page.getByRole('button', { name: 'Save goal' }).click()
    await page.getByRole('button', { name: 'Map', exact: true }).first().click()

    await expect(
      page.locator('button[data-node-id][data-node-icon="heart"]').first(),
    ).toBeVisible()
    await expect(
      page.locator('button[data-node-id][data-node-icon="compass"]'),
    ).toHaveCount(0)
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
    expect(layerCount).toBeGreaterThanOrEqual(MIN_DECISION_LAYERS)
    expect(layerCount).toBeLessThanOrEqual(MAX_DECISION_LAYERS)

    for (let step = 0; step < layerCount + 1; step += 1) {
      await completeFirstNode(page)
    }

    await expect(page.getByRole('region', { name: /The day is sealed/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Return to camp/i })).toBeVisible()
  })
})

test.describe('map shape', () => {
  test('layers hold three to five nodes and only connect to their neighbours', async ({ page }) => {
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
    expect(layers.length).toBeGreaterThanOrEqual(MIN_DECISION_LAYERS)
    expect(layers.length).toBeLessThanOrEqual(MAX_DECISION_LAYERS)

    for (const layer of layers) {
      expect(layer.length).toBeGreaterThanOrEqual(MIN_LAYER_NODES)
      expect(layer.length).toBeLessThanOrEqual(MAX_LAYER_NODES)
    }
    expect(layers.some((layer) => layer.length % 2 === 1)).toBe(true)

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

    const smallestLayer = Math.min(...layers.map((layer) => layer.length))
    for (let lane = 0; lane < smallestLayer; lane += 1) {
      const straight = layers.every((layer, layerIndex) => {
        const next = layers[layerIndex + 1]
        if (!next) return true
        return layer[lane]?.connections.includes(next[lane]?.id ?? '')
      })
      expect(straight).toBe(false)
    }
  })
})

test.describe('mobile map labels', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('first tap reveals the task name and the second opens the node', async ({ page }) => {
    await startDemoRun(page)
    await openMap(page)

    const node = page.locator(`${ACTIONABLE_NODE}:not([data-node-icon="wheel"])`).first()
    const label = node.locator('.node__label')

    await expect(label).toBeHidden()

    await node.tap()
    await expect(label).toBeVisible()
    await expect(page.getByRole('group', { name: /Day map/i })).toBeVisible()

    await node.tap()
    await expect(page.getByRole('button', { name: /Mark complete/i })).toBeVisible()
  })
})
