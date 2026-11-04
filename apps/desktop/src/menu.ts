import { Menu, shell, type MenuItemConstructorOptions } from 'electron'

const ISSUES_URL = 'https://github.com/ToguDV/lifespire/issues'
const APP_NAME = 'LifeSpire'

export interface MenuHandlers {
  isPackaged: boolean
  onAbout: () => void
  onCheckForUpdates: () => void
}

/**
 * Desktop menu. Reload/devtools only exist in unpackaged builds; editing roles
 * are required on Windows/Linux for clipboard shortcuts inside the save-name
 * fields. Update actions stay native so the renderer never needs update IPC.
 */
export function buildMenu({ isPackaged, onAbout, onCheckForUpdates }: MenuHandlers): Menu {
  const isMac = process.platform === 'darwin'

  const developmentItems: MenuItemConstructorOptions[] = isPackaged
    ? []
    : [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
      ]

  const appMenu: MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: APP_NAME,
          submenu: [
            { label: 'About LifeSpire', click: onAbout },
            { label: 'Check for updates…', click: onCheckForUpdates },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
      ]
    : []

  const fileMenu: MenuItemConstructorOptions = isMac
    ? { role: 'fileMenu' }
    : {
        label: 'File',
        submenu: [
          { label: 'Check for updates…', click: onCheckForUpdates },
          { type: 'separator' },
          { role: 'quit' },
        ],
      }

  const template: MenuItemConstructorOptions[] = [
    ...appMenu,
    fileMenu,
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        ...developmentItems,
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        ...(isMac
          ? []
          : ([
              { label: 'About LifeSpire', click: onAbout },
              { type: 'separator' },
            ] satisfies MenuItemConstructorOptions[])),
        {
          label: 'Report an issue',
          click: () => void shell.openExternal(ISSUES_URL),
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}
