import { createApiClient } from '@lifespire/api-client'
import type { ApiClient } from '@lifespire/api-client'
import {
  normalizeBaseUrl,
  resolveSyncBaseUrl,
  validateServerUrl,
} from '@lifespire/app-core/sync/baseUrl'
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

function buildApiClient(): ApiClient {
  return createApiClient({
    baseUrl: getSyncBaseUrl(),
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
