import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { STORAGE_KEY } from '../src/domain/balance'

const DEMO_BUTTON = /Begin with demo data/i
const RECOVERY_HEADING = 'The local save is incomplete or damaged.'

async function readRawSave(page: Page): Promise<string> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)
  if (raw === null) throw new Error('The save key is missing from localStorage.')
  return raw
}

/**
 * Starts from a clean document, then runs the demo onboarding. Each Playwright
 * test already gets a fresh context; clearing also removes the empty document
 * a prior initial load may have written.
 */
async function startDemoRun(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByRole('button', { name: DEMO_BUTTON }).click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
}

/**
 * Creates a real run through the demo onboarding, then rewrites the persisted
 * document into an onboarding draft whose step is past the last screen. Every
 * other field stays schema-valid, so the only reason to reject it is the step
 * bound. Returns the exact raw text written to storage.
 */
async function seedOutOfRangeDraft(page: Page): Promise<string> {
  await startDemoRun(page)

  const raw = await page.evaluate((key) => {
    const stored = window.localStorage.getItem(key)
    if (stored === null) throw new Error('The demo run did not persist a save.')
    const document = JSON.parse(stored) as Record<string, unknown>
    const seeded = {
      ...document,
      profile: null,
      goals: [],
      tasks: [],
      run: null,
      onboardingDraft: {
        step: 5,
        mode: 'custom',
        name: 'Wayfarer',
        goals: [],
        tasks: [],
      },
    }
    const next = JSON.stringify(seeded)
    window.localStorage.setItem(key, next)
    return next
  }, STORAGE_KEY)

  await page.reload()
  return raw
}

test.describe('architecture fixes', () => {
  test('a draft step past the last screen shows recovery instead of empty onboarding', async ({
    page,
  }) => {
    const raw = await seedOutOfRangeDraft(page)

    await expect(page.locator('section[data-screen="recovery"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: RECOVERY_HEADING })).toBeVisible()
    await expect(
      page.getByText(/LifeSpire could not read the document stored in this browser/i),
    ).toBeVisible()

    // The empty onboarding must not be offered as a fallback for a save the
    // schema rejected: the app has to keep the blocked document recoverable.
    await expect(page.locator('section[data-screen="welcome"]')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /A day is a path/i })).toHaveCount(0)

    expect(await readRawSave(page)).toBe(raw)
  })

  test('the recovery screen downloads the exact blocked raw save', async ({ page }) => {
    const raw = await seedOutOfRangeDraft(page)

    await expect(page.locator('section[data-screen="recovery"]')).toBeVisible()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download original save' }).click(),
    ])

    expect(download.suggestedFilename()).toMatch(
      /^lifespire-recovery-\d{4}-\d{2}-\d{2}\.json$/,
    )
    const downloadPath = await download.path()
    expect(downloadPath).not.toBeNull()
    const downloaded = await readFile(downloadPath as string, 'utf8')
    expect(downloaded).toBe(raw)
  })

  test('an oversized import is rejected before it is read and leaves the save untouched', async ({
    page,
  }) => {
    await startDemoRun(page)

    await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
    await expect(page.locator('section[data-screen="settings"]')).toBeVisible()

    const before = await readRawSave(page)
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1, 0x20)

    await page
      .getByLabel('Import a LifeSpire save file')
      .setInputFiles({ name: 'huge.json', mimeType: 'application/json', buffer: oversized })

    const error = page.getByRole('alert').filter({ hasText: /That save is too large/i })
    await expect(error).toBeVisible()
    await expect(error).toContainText(/up to 2 MB/i)

    // Rejected before parsing: no restore preview and no storage write.
    await expect(page.getByRole('heading', { name: 'Restore this save?' })).toHaveCount(0)
    expect(await readRawSave(page)).toBe(before)
  })

  test('a corrupt import shows one actionable message without validator detail', async ({
    page,
  }) => {
    await startDemoRun(page)

    await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
    await expect(page.locator('section[data-screen="settings"]')).toBeVisible()

    const before = await readRawSave(page)

    await page
      .getByLabel('Import a LifeSpire save file')
      .setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') })

    const error = page.getByRole('alert').filter({ hasText: /not a valid LifeSpire save/i })
    await expect(error).toBeVisible()
    await expect(error).toContainText(
      'That file is not a valid LifeSpire save. Choose the JSON file created by Export.',
    )
    // No validator paths leak into the dialog.
    await expect(error).not.toContainText(/layers\[0\]/)

    await expect(page.getByRole('heading', { name: 'Restore this save?' })).toHaveCount(0)
    expect(await readRawSave(page)).toBe(before)
  })
})
