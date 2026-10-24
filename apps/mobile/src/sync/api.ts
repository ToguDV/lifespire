import { createApiClient } from '@lifespire/api-client'
import type { ApiClient } from '@lifespire/api-client'
import {
  normalizeBaseUrl,
  resolveSyncBaseUrl,
  validateServerUrl,
} from '@lifespire/app-core/sync/baseUrl'
import { SYNC_BASE_URL_KEY } from '@lifespire/app-core/sync/storageKeys'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { kv } from '../platform/storage'
import { useAuthStore } from './auth'
import { getRefreshToken, setRefreshToken } from './tokenStore'

export {
  checkServerHealth,
  normalizeBaseUrl,
  validateServerUrl,
} from '@lifespire/app-core/sync/baseUrl'
export type { ServerUrlValidation } from '@lifespire/app-core/sync/baseUrl'

function readEnvBaseUrl(): string | undefined {
  const extra = Constants.expoConfig?.extra as { syncBaseUrl?: unknown } | undefined
  return typeof extra?.syncBaseUrl === 'string' && extra.syncBaseUrl.length > 0
    ? extra.syncBaseUrl
    : undefined
}

export function getStoredBaseUrl(): string | null {
  const raw = kv.getItem(SYNC_BASE_URL_KEY)
  return raw ? (normalizeBaseUrl(raw) ?? raw) : null
}

/** Effective base URL: device override, then build default, then empty. */
export function getSyncBaseUrl(): string {
  return resolveSyncBaseUrl(readEnvBaseUrl(), getStoredBaseUrl())
}

export function setStoredBaseUrl(url: string): void {
  const out = validateServerUrl(url)
  if (!out.ok) throw new Error(out.error)
  kv.setItem(SYNC_BASE_URL_KEY, out.normalized)
}

export function clearStoredBaseUrl(): void {
  kv.removeItem(SYNC_BASE_URL_KEY)
}

function buildApiClient(): ApiClient {
  return createApiClient({
    baseUrl: getSyncBaseUrl(),
    mode: 'native',
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
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
        // The token stays in the caller if the store is not ready.
      }
    },
    getRefreshToken,
    setRefreshToken,
  })
}

export let syncApi: ApiClient = buildApiClient()

const engineApiTarget: { current: Pick<ApiClient, 'getSync' | 'putSync'> } = {
  current: syncApi,
}

/** Stable reference for the sync engine while the server can be repointed. */
export const engineApi: Pick<ApiClient, 'getSync' | 'putSync'> = {
  getSync: (ifMatch) => engineApiTarget.current.getSync(ifMatch),
  putSync: (document, opts) => engineApiTarget.current.putSync(document, opts),
}

/** Rebuilds the client after a server URL change; no app reload needed. */
export function refreshSyncApi(): ApiClient {
  syncApi = buildApiClient()
  engineApiTarget.current = syncApi
  try {
    useAuthStore.getState().configure(syncApi)
  } catch {
    // Store is always ready in the app; tests may call this early.
  }
  return syncApi
}

useAuthStore.getState().configure(syncApi)
