import { contextBridge, ipcRenderer } from 'electron'
import type { ProxyResult, SessionState } from './apiProxy'

/**
 * Narrow bridge for the unmodified web build. The renderer never sees the
 * refresh token: API traffic goes through the main-process proxy and the token
 * lives in the OS keychain (or main-process memory). Channel names are
 * duplicated here because a sandboxed preload cannot import local modules at
 * runtime; keep them in sync with `API_PROXY_CHANNELS` in `apiProxy.ts`.
 */
interface DesktopApiRequest {
  path: string
  method: string
  headers?: Record<string, string>
  body?: string
  origin?: string
}

const CHANNELS = {
  request: 'lifespire:api-request',
  setServer: 'lifespire:sync-set-server',
  sessionState: 'lifespire:auth-session-state',
  signOut: 'lifespire:auth-sign-out',
} as const

const bridge = Object.freeze({
  isDesktop: true as const,
  platform: process.platform,
  api: Object.freeze({
    request: (request: DesktopApiRequest): Promise<ProxyResult> =>
      ipcRenderer.invoke(CHANNELS.request, request),
  }),
  sync: Object.freeze({
    setServer: (origin: string | null): Promise<SessionState> =>
      ipcRenderer.invoke(CHANNELS.setServer, origin),
  }),
  auth: Object.freeze({
    sessionState: (): Promise<SessionState> => ipcRenderer.invoke(CHANNELS.sessionState),
    signOut: (): Promise<SessionState> => ipcRenderer.invoke(CHANNELS.signOut),
  }),
})

contextBridge.exposeInMainWorld('lifespireDesktop', bridge)

export type LifespireDesktopBridge = typeof bridge
