/** Read-only bridge exposed by the Electron preload (apps/desktop/src/preload.ts). */
export interface DesktopBridge {
  isDesktop?: boolean
  platform?: string
}

declare global {
  interface Window {
    lifespireDesktop?: DesktopBridge
  }
}

type DesktopScope = { lifespireDesktop?: DesktopBridge } | null | undefined

/**
 * True only inside the packaged Electron shell. The browser, the tests and
 * server-side code all see `false`; callers pass an explicit scope when there
 * is no real window.
 */
export function isDesktopShell(
  scope: DesktopScope = typeof window === 'undefined' ? undefined : window,
): boolean {
  return scope?.lifespireDesktop?.isDesktop === true
}
