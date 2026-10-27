import { expect, test } from '@playwright/test'

const DEMO_BUTTON = /Begin with demo data/i

const FAKE_PAIRING = {
  v: 1,
  kind: 'lifespire-pair',
  deviceId: 'fake-device-1234',
  name: 'Test desktop',
  fingerprint: 'fake-fingerprint-abcdefghijklmnop',
  host: '127.0.0.1',
  port: 45555,
  secret: '0123456789abcdef0123456789abcdef',
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
}

async function seedDesktopBridge(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((pairing) => {
    const noop = () => () => undefined
    ;(window as unknown as { lifespireDesktop: unknown }).lifespireDesktop = {
      isDesktop: true,
      platform: 'test',
      localSync: {
        start: async () => ({
          deviceId: 'fake-device-1234',
          name: 'Test desktop',
          fingerprint: 'fake-fingerprint-abcdefghijklmnop',
        }),
        stop: async () => undefined,
        setDiscoverable: async () => undefined,
        setDocument: async () => undefined,
        pendingIncoming: async () => [],
        ackIncoming: async () => undefined,
        listPeers: async () => [],
        listNearby: async () => [],
        startPairing: async () => pairing,
        cancelPairing: async () => undefined,
        pair: async () => {
          throw new Error('not used')
        },
        pairWithCode: async () => {
          throw new Error('not used')
        },
        forget: async () => undefined,
        setAutoSync: async () => undefined,
        request: async () => ({ status: 404, body: {} }),
        persistence: async () => 'encrypted',
        onPeersChanged: noop,
        onPaired: noop,
        onIncomingDocument: noop,
        onError: noop,
      },
    }
  }, FAKE_PAIRING)
}

async function openSettings(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: DEMO_BUTTON }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await expect(page.locator('section[data-screen="settings"]')).toBeVisible()
}

test.describe('nearby devices', () => {
  test('shows the local node and its pairing code in the desktop shell', async ({ page }) => {
    await seedDesktopBridge(page)
    await openSettings(page)
    await expect(page.getByText('Nearby devices', { exact: true })).toBeVisible()
    await expect(page.getByText(/This device:/)).toContainText('Test desktop')
    await page.getByRole('button', { name: 'Show my code' }).click()
    await expect(page.getByRole('heading', { name: 'Pair this device' })).toBeVisible()
    await expect(page.locator('#pair-link')).toHaveValue(/^lifespire:\/\/pair\?p=/)
    await expect(page.locator('.pair-code strong')).toHaveText(/^[A-Z2-9]{8}$/)
  })

  test('explains the browser limitation without the desktop bridge', async ({ page }) => {
    await openSettings(page)
    await expect(
      page.getByText(/Nearby sync is available in the Android and desktop apps/i),
    ).toBeVisible()
  })
})
