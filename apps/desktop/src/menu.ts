import { Menu, shell, type MenuItemConstructorOptions } from 'electron'

const ISSUES_URL = 'https://github.com/ToguDV/lifespire/issues'

/**
 * Desktop menu. Reload/devtools only exist in unpackaged builds; editing roles
 * are required on Windows/Linux for clipboard shortcuts inside the save-name
 * fields.
 */
export function buildMenu(isPackaged: boolean): Menu {
  const isMac = process.platform === 'darwin'

  const developmentItems: MenuItemConstructorOptions[] = isPackaged
    ? []
    : [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
      ]

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? ([{ role: 'appMenu' }] satisfies MenuItemConstructorOptions[]) : []),
    { role: 'fileMenu' },
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
        {
          label: 'Report an issue',
          click: () => void shell.openExternal(ISSUES_URL),
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}
