import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const DEMO_BUTTON = /Begin with demo data/i

interface MockUser {
  id: string
  email: string
  role: 'ADMIN' | 'USER'
  status: string
  deviceCount: number
  lastLoginAt: string | null
  lastSyncAt: string | null
  createdAt: string
}

function adminUser(email: string): MockUser {
  return {
    id: `id-${email}`,
    email,
    role: 'USER',
    status: 'ACTIVE',
    deviceCount: 1,
    lastLoginAt: null,
    lastSyncAt: null,
    createdAt: '2026-10-24T00:00:00.000Z',
  }
}

async function routeAdmin(context: BrowserContext, role: 'ADMIN' | 'USER', users: MockUser[]) {
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
        id: role === 'ADMIN' ? 'admin1' : 'user1',
        email: role === 'ADMIN' ? 'admin@example.com' : 'tester@example.com',
        role,
        status: 'ACTIVE',
        totpEnabled: true,
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
  await context.route('**/v1/admin/users*', async (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      const payload = JSON.parse(req.postData() ?? '{}') as { email?: string; role?: string }
      const created = adminUser(payload.email ?? 'new@example.com')
      created.role = payload.role === 'ADMIN' ? 'ADMIN' : 'USER'
      users.push(created)
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: created.id,
          email: created.email,
          inviteLink: `http://localhost:5173/accept-invite#token=invite-for-${created.id}`,
        }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total: users.length, page: 1, pageSize: 100, users }),
    })
  })
}

async function signInAs(page: Page, role: 'ADMIN' | 'USER') {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.evaluate((sessionRole) => {
    window.localStorage.setItem(
      'lifespire:mvp0:session',
      JSON.stringify({
        id: sessionRole === 'ADMIN' ? 'admin1' : 'user1',
        email: sessionRole === 'ADMIN' ? 'admin@example.com' : 'tester@example.com',
        role: sessionRole,
      }),
    )
  }, role)
  await page.reload()
  await expect(page.getByRole('button', { name: DEMO_BUTTON })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: DEMO_BUTTON }).click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 15000 })
}

test.describe('admin panel', () => {
  test('admin lists users and creates an invite link', async ({ browser }) => {
    const users = [adminUser('admin@example.com'), adminUser('member@example.com')]
    const ctx = await browser.newContext()
    try {
      await routeAdmin(ctx, 'ADMIN', users)
      const page = await ctx.newPage()
      await signInAs(page, 'ADMIN')

      await expect(page.getByText('Create an account.')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('member@example.com')).toBeVisible()

      await page.locator('#admin-email').fill('newbie@example.com')
      await page.getByRole('button', { name: 'Create account' }).click()
      await expect(page.locator('#admin-invite-link')).toHaveValue(/accept-invite#token=/, {
        timeout: 15000,
      })
      await expect(page.getByText('newbie@example.com')).toBeVisible()
    } finally {
      await ctx.close()
    }
  })

  test('non-admins never see the admin section', async ({ browser }) => {
    const ctx = await browser.newContext()
    try {
      await routeAdmin(ctx, 'USER', [adminUser('tester@example.com')])
      const page = await ctx.newPage()
      await signInAs(page, 'USER')

      await expect(page.getByText('Signed in as')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('Create an account.')).toBeHidden()
    } finally {
      await ctx.close()
    }
  })
})
