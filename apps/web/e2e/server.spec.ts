import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const DEMO_BUTTON = /Begin with demo data/i

async function routeMocks(context: BrowserContext) {
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
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ title: 'No cloud save' }),
    })
  })
}

async function openSettings(page: Page) {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await expect(page.getByRole('button', { name: DEMO_BUTTON })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: DEMO_BUTTON }).click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 15000 })
}

test.describe('sync server picker', () => {
  test('a custom server survives reload', async ({ browser }) => {
    const ctx = await browser.newContext()
    try {
      await routeMocks(ctx)
      const page = await ctx.newPage()
      await openSettings(page)

      await expect(page.getByText('Current server:')).toBeVisible()
      await page.locator('#sync-server-url').fill('http://localhost:3000')
      await Promise.all([
        page.waitForNavigation(),
        page.getByRole('button', { name: 'Use this server' }).click(),
      ])
      await expect(page.getByRole('button', { name: DEMO_BUTTON })).toBeHidden({
        timeout: 15000,
      })

      await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({
        timeout: 15000,
      })
      await expect(page.getByText('http://localhost:3000')).toBeVisible()
    } finally {
      await ctx.close()
    }
  })

  test('an invalid URL is rejected without reloading', async ({ browser }) => {
    const ctx = await browser.newContext()
    try {
      await routeMocks(ctx)
      const page = await ctx.newPage()
      await openSettings(page)

      await page.locator('#sync-server-url').fill('notaurl')
      await page.getByRole('button', { name: 'Use this server' }).click()
      await expect(page.getByText('valid http(s) server URL')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    } finally {
      await ctx.close()
    }
  })
})
