import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  safeStorage,
  session,
  shell,
  type IpcMainInvokeEvent,
} from 'electron'
import { registerLocalSyncIpc } from './localNode/ipc'
import { createLocalNode } from './localNode/node'
import { isTrustedIpcSender } from './localNode/trust'
import { buildMenu } from './menu'
import {
  APP_SCHEME,
  buildAppUrl,
  isExternalWebUrl,
  isInternalNavigation,
  PWA_SCRIPT_PATHS,
  resolveAssetPath,
} from './protocol'

const APP_ID = 'app.lifespire.desktop'
const APP_NAME = 'LifeSpire'
const DEV_URL = process.env.LIFESPIRE_DEV_URL ?? 'http://localhost:5173'
const BACKGROUND = '#f1f0ea'

app.setName(APP_NAME)

// Throwaway data directory for local verification and automated smoke runs.
const userDataOverride = process.env.LIFESPIRE_USER_DATA
if (userDataOverride) app.setPath('userData', userDataOverride)

// `standard` + `secure` give the renderer a stable origin, so the existing
// localStorage save keeps working; `supportFetchAPI` lets the app and the fonts
// load exactly as they do over http.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      codeCache: true,
    },
  },
])

let mainWindow: BrowserWindow | null = null

function webRoot(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, 'web')
  return path.join(app.getAppPath(), '..', 'web', 'dist')
}

function registerAppProtocol(): void {
  const root = webRoot()

  protocol.handle(APP_SCHEME, async (request) => {
    let pathname: string
    try {
      pathname = new URL(request.url).pathname
    } catch {
      return new Response('Not found', { status: 404 })
    }

    // The service worker belongs to the browser build. The packaged shell
    // serves assets from disk, so it answers the registration with a no-op.
    if (PWA_SCRIPT_PATHS.has(pathname)) {
      return new Response('', {
        status: 200,
        headers: { 'content-type': 'text/javascript' },
      })
    }

    const filePath = resolveAssetPath(root, request.url)
    if (!filePath) return new Response('Not found', { status: 404 })

    try {
      return await net.fetch(pathToFileURL(filePath).toString())
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

/**
 * The LAN node runs in the main process: it owns the device certificate, the
 * peer tokens and the HTTPS/UDP sockets. The renderer only sends the current
 * document mirror and receives discovered peers and incoming saves.
 */
function registerLocalSync(): void {
  const usesPlainTextBackend = (): boolean => {
    if (process.platform !== 'linux') return false
    try {
      return safeStorage.getSelectedStorageBackend() === 'basic_text'
    } catch {
      return true
    }
  }

  const node = createLocalNode({
    dataDir: app.getPath('userData'),
    secrets: {
      available: safeStorage.isEncryptionAvailable() && !usesPlainTextBackend(),
      encrypt: (value) => safeStorage.encryptString(value).toString('base64'),
      decrypt: (value) => safeStorage.decryptString(Buffer.from(value, 'base64')),
    },
  })

  const guard = (raw: unknown): void => {
    const event = raw as IpcMainInvokeEvent
    const window = mainWindow
    const frame = event.senderFrame
    const trusted = isTrustedIpcSender(
      {
        senderIsMainWindow: window !== null && event.sender === window.webContents,
        frameIsMainFrame: frame !== null && frame === event.sender.mainFrame,
        frameUrl: frame?.url,
      },
      { isPackaged: app.isPackaged, devUrl: DEV_URL },
    )
    if (!trusted) throw new Error('Untrusted IPC sender')
  }

  const dispose = registerLocalSyncIpc({
    ipcMain,
    node,
    guard,
    send: (channel, payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, payload)
      }
    },
  })

  app.on('before-quit', () => {
    dispose()
    void node.stop()
  })
}

/** Save exports go through a native dialog instead of Chromium's silent path. */
function registerDownloads(): void {
  session.defaultSession.on('will-download', (_event, item) => {
    // Chromium already suggests a name from the download attribute; keep only
    // the basename so it can never point outside the Downloads folder.
    const suggested = path.basename(item.getFilename())
    const target = dialog.showSaveDialogSync({
      title: 'Save LifeSpire data',
      defaultPath: path.join(app.getPath('downloads'), suggested),
    })

    if (!target) {
      item.cancel()
      return
    }

    item.setSavePath(target)
  })
}

/** Denies every permission request: the local-first app needs none of them. */
function restrictPermissions(): void {
  const target = session.defaultSession
  target.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  target.setPermissionCheckHandler(() => false)
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    minHeight: 600,
    title: APP_NAME,
    backgroundColor: BACKGROUND,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow = window

  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  // Local-only shell: never spawn a second window, never navigate away.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalWebUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const guardNavigation = (event: { preventDefault: () => void }, url: string) => {
    if (isInternalNavigation(url, { isPackaged: app.isPackaged, devUrl: DEV_URL })) return
    event.preventDefault()
    if (isExternalWebUrl(url)) void shell.openExternal(url)
  }

  window.webContents.on('will-navigate', guardNavigation)
  window.webContents.on('will-redirect', guardNavigation)

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      // -3 is an aborted load, which happens on normal navigations.
      if (!isMainFrame || errorCode === -3) return
      dialog.showErrorBox(
        'LifeSpire could not open',
        `${errorDescription} (${errorCode})\n${validatedUrl}`,
      )
    },
  )

  window.webContents.on('render-process-gone', (_event, details) => {
    dialog.showErrorBox('LifeSpire stopped', `The window process exited: ${details.reason}`)
  })

  watchResponsiveness(window)

  if (app.isPackaged) {
    void window.loadURL(buildAppUrl())
  } else {
    void window.loadURL(DEV_URL)
  }
}

/**
 * A hung renderer leaves the window frozen with no way out. Electron reports it
 * through the browser process, so offer a reload instead of forcing a kill.
 */
function watchResponsiveness(window: BrowserWindow): void {
  let prompting = false

  window.on('unresponsive', () => {
    console.error('[lifespire] renderer unresponsive')
    if (prompting) return
    prompting = true
    void dialog
      .showMessageBox(window, {
        type: 'warning',
        buttons: ['Wait', 'Reload'],
        defaultId: 0,
        cancelId: 0,
        title: 'LifeSpire is not responding',
        message: 'The window stopped responding.',
        detail:
          'Your save is stored on this device and will be restored after a reload. Reload only if waiting does not help.',
      })
      .then((result) => {
        if (result.response === 1) window.webContents.reload()
      })
      .finally(() => {
        prompting = false
      })
  })

  window.on('responsive', () => {
    console.error('[lifespire] renderer responsive again')
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID)
    registerAppProtocol()
    Menu.setApplicationMenu(buildMenu(app.isPackaged))
    registerDownloads()
    restrictPermissions()
    registerLocalSync()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}
