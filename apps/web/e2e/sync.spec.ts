import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const DEMO_BUTTON = /Begin with demo data/i
const ACTIONABLE_NODE = 'button[data-node-id][data-status="available"], button[data-node-id][data-status="current"]'

interface CloudState {
  version: number | null
  document: unknown | null
  updatedAt: string
}

function createMockServer() {
  const cloud: CloudState = { version: null, document: null, updatedAt: new Date().toISOString() }
  const puts: Array<{ ifMatch: string | null; create: boolean }> = []

  async function route(context: BrowserContext) {
    await context.route('**/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'test-token' }),
      })
    })
    await context.route('**/v1/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user1',
          email: 'tester@example.com',
          role: 'USER',
          status: 'ACTIVE',
          totpEnabled: false,
          createdAt: '2026-10-24T00:00:00.000Z',
        }),
      })
    })
    await context.route('**/v1/sync', async (route) => {
      const req = route.request()
      const method = req.method()
      if (method === 'GET') {
        const ifNoneMatch = req.headers()['if-none-match']
        if (cloud.version === null) {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ title: 'No cloud save' }) })
          return
        }
        if (ifNoneMatch && ifNoneMatch.includes(String(cloud.version))) {
          await route.fulfill({ status: 304, body: '' })
          return
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { ETag: `"${cloud.version}"` },
          body: JSON.stringify({
            version: String(cloud.version),
            schemaVersion: 3,
            document: cloud.document,
            updatedAt: cloud.updatedAt,
          }),
        })
        return
      }
      if (method === 'PUT') {
        const headers = req.headers()
        const ifMatch = headers['if-match'] ?? null
        const ifNoneMatch = headers['if-none-match'] ?? null
        const payload = JSON.parse(req.postData() ?? '{}') as { document?: unknown }
        puts.push({ ifMatch, create: ifNoneMatch === '*' })
        if (ifNoneMatch === '*') {
          if (cloud.version !== null) {
            await route.fulfill({
              status: 412,
              contentType: 'application/json',
              body: JSON.stringify({ currentVersion: String(cloud.version), currentUpdatedAt: cloud.updatedAt }),
            })
            return
          }
          cloud.version = 1
          cloud.document = payload.document ?? null
          cloud.updatedAt = new Date().toISOString()
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            headers: { ETag: '"1"' },
            body: JSON.stringify({ version: '1', updatedAt: cloud.updatedAt }),
          })
          return
        }
        const expected = ifMatch?.replace(/"/g, '')
        if (cloud.version === null || expected !== String(cloud.version)) {
          await route.fulfill({
            status: 412,
            contentType: 'application/json',
            body: JSON.stringify({ currentVersion: String(cloud.version ?? '?'), currentUpdatedAt: cloud.updatedAt }),
          })
          return
        }
        cloud.version += 1
        cloud.document = payload.document ?? null
        cloud.updatedAt = new Date().toISOString()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { ETag: `"${cloud.version}"` },
          body: JSON.stringify({ version: String(cloud.version), updatedAt: cloud.updatedAt }),
        })
        return
      }
      await route.continue()
    })
  }

  return { cloud, puts, route }
}

async function signIn(page: Page) {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.evaluate(() => {
    window.localStorage.setItem(
      'lifespire:mvp0:session',
      JSON.stringify({ id: 'user1', email: 'tester@example.com', role: 'USER' }),
    )
  })
  await page.reload()
  await expect(page.getByRole('button', { name: DEMO_BUTTON })).toBeVisible({ timeout: 15000 })
}

async function startDemo(page: Page) {
  await page.getByRole('button', { name: DEMO_BUTTON }).click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15000 })
}

async function openMap(page: Page) {
  await page.getByRole('button', { name: 'Map', exact: true }).first().click()
  await expect(page.getByRole('group', { name: /Day map/i })).toBeVisible()
}

async function completeFirstNode(page: Page): Promise<string | null> {
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
  return null
}

test.describe('sync engine', () => {
  test('A pushes a completion and B pulls it', async ({ browser }) => {
    const server = createMockServer()
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    try {
      await server.route(ctxA)
      await server.route(ctxB)
      const pageA = await ctxA.newPage()
      const pageB = await ctxB.newPage()

      await signIn(pageA)
      await startDemo(pageA)
      await expect.poll(async () => server.cloud.version, { timeout: 15000 }).toBe(1)

      await signIn(pageB)
      await expect(pageB.getByRole('button', { name: DEMO_BUTTON })).toBeHidden({ timeout: 20000 })

      await openMap(pageA)
      const nodeId = await pageA.locator(ACTIONABLE_NODE).first().getAttribute('data-node-id')
      await completeFirstNode(pageA)
      await expect.poll(async () => server.cloud.version, { timeout: 15000 }).toBe(2)

      await pageB.reload()
      await openMap(pageB)
      await expect(pageB.locator(`button[data-node-id="${nodeId}"]`)).toHaveAttribute(
        'data-status',
        'completed',
        { timeout: 15000 },
      )
    } finally {
      await ctxA.close()
      await ctxB.close()
    }
  })

  test('concurrent edits open the conflict dialog with zero loss', async ({ browser }) => {
    const server = createMockServer()
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    try {
      await server.route(ctxA)
      await server.route(ctxB)
      const pageA = await ctxA.newPage()
      const pageB = await ctxB.newPage()

      await signIn(pageA)
      await startDemo(pageA)
      await expect.poll(async () => server.cloud.version, { timeout: 15000 }).toBe(1)
      await signIn(pageB)
      await expect(pageB.getByRole('button', { name: DEMO_BUTTON })).toBeHidden({ timeout: 20000 })

      await openMap(pageA)
      await openMap(pageB)
      await completeFirstNode(pageA)
      await expect.poll(async () => server.cloud.version, { timeout: 15000 }).toBe(2)

      // B edits against the stale v1 base: force a push without pulling first.
      await completeFirstNode(pageB)
      await expect(pageB.getByRole('dialog', { name: /Sync conflict/i })).toBeVisible({ timeout: 20000 })
      await expect(pageB.getByRole('heading', { name: /This device/i })).toBeVisible()
      await expect(pageB.getByRole('heading', { name: /^Cloud$/i })).toBeVisible()

      await pageB.getByRole('button', { name: /Keep this device/i }).click()
      await expect.poll(async () => server.cloud.version, { timeout: 15000 }).toBe(3)
      await expect(pageB.getByRole('dialog', { name: /Sync conflict/i })).toBeHidden({ timeout: 10000 })
    } finally {
      await ctxA.close()
      await ctxB.close()
    }
  })
})
