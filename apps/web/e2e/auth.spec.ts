import { expect, test } from '@playwright/test'

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde'
const DEMO_BUTTON = /Begin with demo data/i

async function openSyncDialog(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: DEMO_BUTTON }).click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await page.getByRole('button', { name: 'Set up sync' }).click()
  await expect(page.locator('#sync-reset-token')).toBeVisible({ timeout: 15000 })
}

test.describe('account links', () => {
  test('the reset link opens the password screen and submits the token', async ({
    page,
    context,
  }) => {
    const bodies: Array<{ token?: string; password?: string }> = []
    await context.route('**/v1/auth/reset-password', async (route) => {
      bodies.push(JSON.parse(route.request().postData() ?? '{}'))
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    })
    await context.route('**/v1/auth/logout', async (route) => {
      await route.fulfill({ status: 204, body: '' })
    })

    await page.goto(`/reset-password#token=${TOKEN}`)
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
    await expect(page.getByRole('button', { name: DEMO_BUTTON })).toHaveCount(0)
    await expect(page.locator('#auth-link-token')).toHaveValue(TOKEN)
    await page.locator('#auth-link-password').fill('a-strong-password-123')
    await page.locator('#auth-link-confirm').fill('a-strong-password-123')
    await page.getByRole('button', { name: 'Set new password' }).click()

    await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible()
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toMatchObject({ token: TOKEN, password: 'a-strong-password-123' })
    expect(new URL(page.url()).hash).toBe('')
  })

  test('the invite link accepts the token and signs in', async ({ page, context }) => {
    const bodies: Array<{ token?: string; password?: string }> = []
    await context.route('**/v1/auth/accept-invite', async (route) => {
      bodies.push(JSON.parse(route.request().postData() ?? '{}'))
      await route.fulfill({
        status: 201,
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
          email: 'invited@example.com',
          role: 'USER',
          status: 'ACTIVE',
          totpEnabled: false,
          createdAt: '2026-10-24T00:00:00.000Z',
        }),
      })
    })
    await context.route('**/v1/sync/watch*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ version: null, updatedAt: null }),
      })
    })
    await context.route('**/v1/sync', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ title: 'No cloud save' }),
      })
    })

    await page.goto(`/accept-invite#token=${TOKEN}`)
    await expect(page.getByRole('heading', { name: 'Accept your invite' })).toBeVisible()
    await page.locator('#auth-link-password').fill('a-strong-password-123')
    await page.locator('#auth-link-confirm').fill('a-strong-password-123')
    await page.getByRole('button', { name: 'Accept invite' }).click()

    await expect(page.getByRole('heading', { name: 'Invite accepted' })).toBeVisible()
    await expect(page.getByText('You are signed in as invited@example.com.')).toBeVisible()
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toMatchObject({ token: TOKEN, password: 'a-strong-password-123' })
  })
})

test.describe('account access from the welcome screen', () => {
  test('a fresh browser can reach the sync forms without creating a profile', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: DEMO_BUTTON })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Already have an account? Sign in' }).click()
    await expect(page.locator('#sync-email')).toBeVisible()
    await expect(page.locator('#sync-reset-token')).toBeVisible()
  })
})

test.describe('manual reset form', () => {
  test('shows the API error next to the reset form, not the login form', async ({
    page,
    context,
  }) => {
    await context.route('**/v1/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ title: 'Invalid reset link', code: 'RESET_INVALID' }),
      })
    })
    await page.goto('/')
    await openSyncDialog(page)

    await page.locator('#sync-reset-token').fill(`https://app.example.com/reset-password#token=${TOKEN}`)
    await page.locator('#sync-reset-password').fill('a-strong-password-123')
    await page.getByRole('button', { name: 'Set new password' }).click()

    const resetForm = page.locator('form').filter({ has: page.locator('#sync-reset-token') })
    await expect(resetForm.getByRole('alert')).toHaveText(/not valid on this server/)
    const loginForm = page.locator('form').filter({ has: page.locator('#sync-email') })
    await expect(loginForm.getByRole('alert')).toHaveCount(0)
  })
})
