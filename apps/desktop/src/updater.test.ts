import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHECK_INTERVAL_MS,
  FIRST_CHECK_DELAY_MS,
  setupAutoUpdater,
  type DialogLike,
  type TimerApi,
  type UpdaterLike,
} from './updater'

type Listener = (value: unknown) => void

function createHarness() {
  const listeners = new Map<string, Listener[]>()
  const updater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    currentVersion: { compare: vi.fn(() => 0) },
    checkForUpdates: vi.fn(async () => ({ updateInfo: { version: '0.4.0' } })),
    quitAndInstall: vi.fn(),
    on: vi.fn((event: string, listener: Listener) => {
      const current = listeners.get(event) ?? []
      current.push(listener)
      listeners.set(event, current)
      return updater
    }),
    removeListener: vi.fn((event: string, listener: Listener) => {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((candidate) => candidate !== listener),
      )
      return updater
    }),
  }
  const dialog = {
    showMessageBox: vi.fn(async () => ({ response: 0 })),
  }
  const log = vi.fn()
  const emit = (event: string, value: unknown) => {
    for (const listener of listeners.get(event) ?? []) listener(value)
  }
  return {
    updater: updater as unknown as UpdaterLike,
    dialog: dialog as unknown as DialogLike & { showMessageBox: ReturnType<typeof vi.fn> },
    log,
    emit,
  }
}

function setupHarness(overrides: Partial<Parameters<typeof setupAutoUpdater>[0]> = {}) {
  const harness = createHarness()
  const controller = setupAutoUpdater({
    isPackaged: true,
    appVersion: '0.3.1',
    autoUpdater: harness.updater,
    dialog: harness.dialog,
    log: harness.log,
    ...overrides,
  })
  return { ...harness, controller }
}

const realSetTimeout = globalThis.setTimeout
const realClearTimeout = globalThis.clearTimeout
const realSetInterval = globalThis.setInterval
const realClearInterval = globalThis.clearInterval

describe('setupAutoUpdater', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.setTimeout = realSetTimeout
    globalThis.clearTimeout = realClearTimeout
    globalThis.setInterval = realSetInterval
    globalThis.clearInterval = realClearInterval
  })

  it('leaves unpackaged builds alone but explains a manual check', async () => {
    const harness = createHarness()
    const controller = setupAutoUpdater({
      isPackaged: false,
      appVersion: '0.3.1',
      autoUpdater: harness.updater,
      dialog: harness.dialog,
      log: harness.log,
    })

    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS)
    expect(harness.updater.checkForUpdates).not.toHaveBeenCalled()
    expect(harness.dialog.showMessageBox).not.toHaveBeenCalled()

    await controller.checkForUpdates()
    expect(harness.dialog.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('packaged builds') }),
    )
  })

  it('checks shortly after start and then every six hours', async () => {
    const { updater } = setupHarness()

    expect(updater.autoDownload).toBe(true)
    expect(updater.autoInstallOnAppQuit).toBe(true)
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS - 1)
    expect(updater.checkForUpdates).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('logs background failures without interrupting the user', async () => {
    const { emit, dialog, log } = setupHarness()

    emit('error', new Error('offline'))

    expect(log).toHaveBeenCalledWith(expect.stringContaining('offline'))
    expect(dialog.showMessageBox).not.toHaveBeenCalled()
  })

  it('prompts to restart and installs when accepted', async () => {
    const { emit, dialog, updater } = setupHarness()
    dialog.showMessageBox.mockResolvedValueOnce({ response: 0 })

    emit('update-downloaded', { version: '0.4.0' })
    await vi.advanceTimersByTimeAsync(0)

    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('0.4.0') }),
    )
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it('reports an install failure after the user accepts the restart', async () => {
    const { emit, dialog, updater } = setupHarness()
    dialog.showMessageBox.mockResolvedValueOnce({ response: 0 })

    emit('update-downloaded', { version: '0.4.0' })
    await vi.advanceTimersByTimeAsync(0)
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1)

    emit('error', new Error('permission denied'))
    await vi.advanceTimersByTimeAsync(0)

    expect(dialog.showMessageBox).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'error',
        message: expect.stringContaining('could not install'),
        detail: expect.stringContaining('permission denied'),
      }),
    )
  })

  it('keeps the downloaded update for quit when the user chooses later', async () => {
    const { emit, dialog, updater } = setupHarness()
    dialog.showMessageBox.mockResolvedValueOnce({ response: 1 })

    emit('update-downloaded', { version: '0.4.0' })
    await vi.advanceTimersByTimeAsync(0)

    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('reports a manual check with no update information', async () => {
    const { controller, dialog, updater } = setupHarness()
    updater.checkForUpdates = vi.fn(async () => null)

    await controller.checkForUpdates()

    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('No update information') }),
    )
  })

  it('reports when the installed version is current', async () => {
    const { controller, dialog, updater } = setupHarness()
    updater.currentVersion.compare = vi.fn(() => 0)

    await controller.checkForUpdates()

    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('up to date') }),
    )
  })

  it('explains that a newer version is downloading', async () => {
    const { controller, dialog, updater } = setupHarness()
    updater.currentVersion.compare = vi.fn(() => -1)

    await controller.checkForUpdates()

    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('is available') }),
    )
  })

  it('shows the failure detail when a manual check fails', async () => {
    const { controller, dialog, updater } = setupHarness()
    updater.checkForUpdates = vi.fn(async () => {
      throw new Error('network down')
    })

    await controller.checkForUpdates()

    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Could not check for updates'),
        detail: expect.stringContaining('network down'),
      }),
    )
  })

  it('clears its timers and listeners on dispose', async () => {
    const { controller, updater } = setupHarness()

    controller.dispose()
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS + CHECK_INTERVAL_MS)

    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(updater.removeListener).toHaveBeenCalledTimes(2)
  })

  it('uses an injected timer implementation', async () => {
    const timers: TimerApi = {
      setTimeout: vi.fn(() => 'timeout'),
      clearTimeout: vi.fn(),
      setInterval: vi.fn(() => 'interval'),
      clearInterval: vi.fn(),
    }
    setupHarness({ timers, firstDelayMs: 1_000, intervalMs: 2_000 })

    expect(timers.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1_000)
    expect(timers.setInterval).toHaveBeenCalledWith(expect.any(Function), 2_000)
  })
})
