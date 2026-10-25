/** Read-only bridge exposed by the Electron preload (apps/desktop/src/preload.ts). */
export type DesktopSessionPersistence = 'encrypted' | 'memory-only'

export interface DesktopSessionState {
  persistence: DesktopSessionPersistence
  signedIn: boolean
  serverOrigin: string | null
}

export interface DesktopApiRequest {
  path: string
  method: string
  headers?: Record<string, string>
  body?: string
  /** Only used for the unauthenticated `/health/live` probe. */
  origin?: string
}

export interface DesktopApiResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}

export type DesktopApiResult =
  | { ok: true; response: DesktopApiResponse }
  | { ok: false; error: { code: string; message: string } }

export interface DesktopBridge {
  isDesktop?: boolean
  platform?: string
  api?: {
    request(request: DesktopApiRequest): Promise<DesktopApiResult>
  }
  sync?: {
    setServer(origin: string | null): Promise<DesktopSessionState>
  }
  auth?: {
    sessionState(): Promise<DesktopSessionState>
    signOut(): Promise<DesktopSessionState>
  }
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
