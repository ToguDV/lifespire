import { createApiClient } from '@lifespire/api-client'
import type { ApiClient } from '@lifespire/api-client'
import {
  normalizeBaseUrl,
  resolveSyncBaseUrl,
  validateServerUrl,
} from '@lifespire/app-core/sync/baseUrl'
import type {
  DesktopBridge,
  DesktopSessionState,
} from '../ui/lib/platform'
import { isDesktopShell } from '../ui/lib/platform'
import { useAuthStore } from './authStore'
import { SYNC_BASE_URL_KEY } from './storageKeys'

function readEnvBaseUrl(): string | undefined {
  try {
    const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_SYNC_BASE_URL
    if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv
  } catch {
    // Tests and non-Vite runtimes fall back to same-origin.
  }
  return undefined
}

function readStoredBaseUrl(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(SYNC_BASE_URL_KEY)
  } catch {
    return null
  }
}

export {
  checkServerHealth,
  normalizeBaseUrl,
  resolveSyncBaseUrl,
  validateServerUrl,
} from '@lifespire/app-core/sync/baseUrl'
export type { ServerUrlValidation } from '@lifespire/app-core/sync/baseUrl'

/** Effective base URL: device override, then build default, then same-origin. */
export function getSyncBaseUrl(): string {
  return resolveSyncBaseUrl(readEnvBaseUrl(), readStoredBaseUrl())
}

export function getStoredBaseUrl(): string | null {
  const raw = readStoredBaseUrl()
  return raw ? (normalizeBaseUrl(raw) ?? raw) : null
}

export function setStoredBaseUrl(url: string): void {
  const out = validateServerUrl(url)
  if (!out.ok) throw new Error(out.error)
  try {
    localStorage.setItem(SYNC_BASE_URL_KEY, out.normalized)
  } catch {
    throw new Error('Could not save the server URL in this browser.')
  }
}

export function clearStoredBaseUrl(): void {
  try {
    localStorage.removeItem(SYNC_BASE_URL_KEY)
  } catch {
    // Private mode: nothing persisted, nothing to clear.
  }
}

/** The Electron bridge, only when the renderer is the desktop shell. */
function desktopBridge(): DesktopBridge | null {
  if (!isDesktopShell()) return null
  const bridge = typeof window === 'undefined' ? undefined : window.lifespireDesktop
  return bridge?.api?.request ? bridge : null
}

function headerRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {}
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    const out: Record<string, string> = {}
    headers.forEach((value, key) => {
      out[key] = value
    })
    return out
  }
  if (Array.isArray(headers)) {
    const out: Record<string, string> = {}
    for (const [key, value] of headers) out[key] = value
    return out
  }
  return { ...(headers as Record<string, string>) }
}

/**
 * fetch adapter for the desktop shell. API calls go through `api.request` in
 * the main process; the renderer only builds a Response from the returned
 * status/headers/body and never sees the refresh token. A missing base URL is
 * an explicit "not configured" error, never a same-origin fallback.
 */
function createDesktopFetch(baseUrl: string, bridge: DesktopBridge): typeof fetch {
  const configured = baseUrl.replace(/\/+$/, '')
  const api = bridge.api
  if (!api) throw new Error('The desktop bridge is missing the API channel.')

  return async (input, init = {}) => {
    const request = typeof Request !== 'undefined' && input instanceof Request ? input : null
    const raw = request ? request.url : String(input)
    let url: URL
    try {
      url = new URL(raw, 'lifespire-app://app')
    } catch {
      throw new Error('The sync request URL is invalid.')
    }

    const method = (init.method ?? request?.method ?? 'GET').toUpperCase()
    const path = `${url.pathname}${url.search}`
    const health = path === '/health/live' && method === 'GET'
    let origin: string | undefined
    if (health) {
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Enter the LifeSpire server URL to test it.')
      }
      origin = url.origin
    } else {
      if (!configured) {
        throw new Error('Choose a sync server in Settings before syncing.')
      }
      if (url.origin !== configured) {
        throw new Error('The sync request does not match the configured server.')
      }
    }

    const body = typeof init.body === 'string' ? init.body : undefined
    const result = await api.request({
      path,
      method,
      headers: headerRecord(init.headers ?? request?.headers),
      body,
      origin,
    })
    if (!result.ok) throw new Error(result.error.message)

    const responseInit: ResponseInit = {
      status: result.response.status,
      statusText: result.response.statusText,
      headers: result.response.headers,
    }
    if (result.response.status === 204 || result.response.status === 304) {
      return new Response(null, responseInit)
    }
    return new Response(result.response.body, responseInit)
  }
}

/** Shared transport for the sync client and the server health probe. */
export function getSyncFetch(): typeof fetch {
  const bridge = desktopBridge()
  if (!bridge) return fetch
  return createDesktopFetch(getSyncBaseUrl(), bridge)
}

/** Whether the desktop session survives a restart (settings note). */
export async function getDesktopSessionState(): Promise<DesktopSessionState | null> {
  const bridge = desktopBridge()
  if (!bridge?.auth?.sessionState) return null
  try {
    return await bridge.auth.sessionState()
  } catch {
    return null
  }
}

/** Clears the main-process credential even if the server logout call fails. */
async function signOutDesktop(bridge: DesktopBridge): Promise<void> {
  try {
    await bridge.auth?.signOut?.()
  } catch {
    // Local sign-out already happened in the auth store.
  }
}

function buildApiClient(): ApiClient {
  const baseUrl = getSyncBaseUrl()
  const bridge = desktopBridge()
  const client = createApiClient({
    baseUrl,
    fetchFn: bridge ? createDesktopFetch(baseUrl, bridge) : undefined,
    getAccessToken: () => {
      try {
        return useAuthStore.getState().getAccessToken()
      } catch {
        return null
      }
    },
    setAccessToken: (token) => {
      try {
        useAuthStore.getState().setAccessToken(token)
      } catch {
        // Store may not be ready in unit tests; the token stays in the caller.
      }
    },
  })

  if (bridge) {
    // The main process holds the only allowlisted origin. Fire-and-forget is
    // ordered before any later renderer IPC call, including the boot restore.
    void bridge.sync?.setServer(baseUrl || null)
    const logout = client.logout.bind(client)
    const logoutAll = client.logoutAll.bind(client)
    client.logout = async () => {
      try {
        await logout()
      } finally {
        await signOutDesktop(bridge)
      }
    }
    client.logoutAll = async () => {
      try {
        await logoutAll()
      } finally {
        await signOutDesktop(bridge)
      }
    }
  }
  return client
}

export let syncApi: ApiClient = buildApiClient()

/**
 * Stable engine endpoint: the sync engine keeps this reference for its whole
 * lifetime while every server switch repoints the underlying client, so the
 * app never needs a reload to talk to the new server.
 */
const engineApiTarget: { current: Pick<ApiClient, 'getSync' | 'putSync'> } = {
  current: syncApi,
}

export const engineApi: Pick<ApiClient, 'getSync' | 'putSync'> = {
  getSync: (ifMatch) => engineApiTarget.current.getSync(ifMatch),
  putSync: (document, opts) => engineApiTarget.current.putSync(document, opts),
}

/**
 * Rebuilds the client from the current stored/build base URL and repoints the
 * engine and the auth store at it. Call after saving or clearing the server
 * override; the caller stays on screen, no reload needed.
 */
export function refreshSyncApi(): ApiClient {
  syncApi = buildApiClient()
  engineApiTarget.current = syncApi
  try {
    useAuthStore.getState().configure(syncApi)
  } catch {
    // Store may not be ready in unit tests; the client is still returned.
  }
  return syncApi
}

useAuthStore.getState().configure(syncApi)
