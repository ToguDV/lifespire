import type { MessageBoxOptions, MessageBoxReturnValue } from 'electron'
import type { AppUpdater, UpdateDownloadedEvent } from 'electron-updater'

/** Wait before the first background check, so startup is never delayed. */
export const FIRST_CHECK_DELAY_MS = 10_000
/** Background cadence while the app stays open. */
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * The subset of `electron-updater`'s singleton this module uses. Keeping it
 * narrow lets the tests exercise every branch without loading Electron.
 */
export type UpdaterLike = Pick<
  AppUpdater,
  | 'autoDownload'
  | 'autoInstallOnAppQuit'
  | 'currentVersion'
  | 'on'
  | 'removeListener'
  | 'checkForUpdates'
  | 'quitAndInstall'
>

export interface DialogLike {
  showMessageBox(options: MessageBoxOptions): Promise<MessageBoxReturnValue>
}

export interface TimerApi {
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
  setInterval(callback: () => void, ms: number): unknown
  clearInterval(handle: unknown): void
}

const defaultTimers: TimerApi = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
}

export interface AutoUpdateOptions {
  isPackaged: boolean
  appVersion: string
  autoUpdater: UpdaterLike
  dialog: DialogLike
  log?: (message: string) => void
  timers?: TimerApi
  firstDelayMs?: number
  intervalMs?: number
}

export interface AutoUpdateController {
  /** Explicit "Check for updates…" action; always answers through a dialog. */
  checkForUpdates(): Promise<void>
  dispose(): void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Wires `electron-updater` to the desktop shell:
 *
 * - background checks 10 s after start and every 6 h, always silent on failure;
 * - downloads automatically and asks before restarting;
 * - the manual menu action always reports an outcome (including "up to date").
 *
 * Unpackaged builds never check, because there is no `app-update.yml` feed.
 */
export function setupAutoUpdater(options: AutoUpdateOptions): AutoUpdateController {
  const {
    isPackaged,
    appVersion,
    autoUpdater,
    dialog,
    log = (message: string) => console.warn(message),
    timers = defaultTimers,
    firstDelayMs = FIRST_CHECK_DELAY_MS,
    intervalMs = CHECK_INTERVAL_MS,
  } = options

  let timeout: unknown
  let interval: unknown
  let disposed = false

  const info = (message: string, detail?: string): Promise<void> => {
    const box: MessageBoxOptions = { type: 'info', title: 'Check for updates', message, buttons: ['OK'] }
    if (detail) box.detail = detail
    return dialog.showMessageBox(box).then(() => undefined)
  }

  const checkForUpdates = async (): Promise<void> => {
    if (!isPackaged) {
      await info('Updates are only available in packaged builds.')
      return
    }

    try {
      const result = await autoUpdater.checkForUpdates()
      if (!result) {
        await info('No update information is available.')
        return
      }
      if (autoUpdater.currentVersion.compare(result.updateInfo.version) >= 0) {
        await info(`LifeSpire ${appVersion} is up to date.`)
        return
      }
      await info(
        `LifeSpire ${result.updateInfo.version} is available and downloading.`,
        'You will be asked to restart when it is ready.',
      )
    } catch (error) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Check for updates',
        message: 'Could not check for updates.',
        detail: errorMessage(error),
        buttons: ['OK'],
      })
    }
  }

  if (!isPackaged) {
    return { checkForUpdates, dispose: () => undefined }
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  let restartRequested = false

  const onError = (error: Error): void => {
    const detail = errorMessage(error)
    log(`[lifespire] update check failed: ${detail}`)
    if (!restartRequested) return
    // The user explicitly asked to restart: an install failure (read-only
    // AppImage, missing sudo/pkexec, antivirus) must not disappear silently.
    restartRequested = false
    void dialog
      .showMessageBox({
        type: 'error',
        title: 'Update failed',
        message: 'LifeSpire could not install the update.',
        detail,
        buttons: ['OK'],
      })
      .catch(() => undefined)
  }

  const onDownloaded = (update: UpdateDownloadedEvent): void => {
    void dialog
      .showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: `LifeSpire ${update.version} is ready to install.`,
        detail: 'Restart now to use the new version, or later — it installs when you quit.',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response !== 0) return
        restartRequested = true
        try {
          autoUpdater.quitAndInstall()
        } catch (error) {
          restartRequested = false
          onError(error instanceof Error ? error : new Error(String(error)))
        }
      })
      .catch((error: unknown) => {
        log(`[lifespire] could not show the restart prompt: ${errorMessage(error)}`)
      })
  }

  autoUpdater.on('error', onError)
  autoUpdater.on('update-downloaded', onDownloaded)

  const backgroundCheck = (): void => {
    if (disposed) return
    void autoUpdater.checkForUpdates().catch((error: unknown) => {
      log(`[lifespire] update check failed: ${errorMessage(error)}`)
    })
  }

  timeout = timers.setTimeout(backgroundCheck, firstDelayMs)
  interval = timers.setInterval(backgroundCheck, intervalMs)

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    timers.clearTimeout(timeout)
    timers.clearInterval(interval)
    autoUpdater.removeListener('error', onError)
    autoUpdater.removeListener('update-downloaded', onDownloaded)
  }

  return { checkForUpdates, dispose }
}
