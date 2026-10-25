import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, dialog, Menu, net, protocol, session, shell } from 'electron'
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

/** Save exports go through a native dialog instead of Chromium's silent path. */
function registerDownloads(): void {
  session.defaultSession.on('will-download', (_event, item) => {
    const target = dialog.showSaveDialogSync({
      title: 'Save LifeSpire data',
      defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
    })

    if (!target) {
      item.cancel()
      return
    }

    item.setSavePath(target)
  })
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

  window.webContents.on('will-navigate', (event, url) => {
    if (isInternalNavigation(url, { isPackaged: app.isPackaged, devUrl: DEV_URL })) return
    event.preventDefault()
    if (isExternalWebUrl(url)) void shell.openExternal(url)
  })

  if (app.isPackaged) {
    void window.loadURL(buildAppUrl())
  } else {
    void window.loadURL(DEV_URL)
  }
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
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}
